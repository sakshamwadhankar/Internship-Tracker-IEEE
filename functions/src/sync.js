/**
 * Sync engine — runs every source adapter, normalizes results, upserts
 * them into Firestore with dedupe, prunes stale listings and records
 * per-source health in sync_meta. Shared by the scheduled function and
 * the on-call `syncNow`.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getSources } from './sources/index.js';
import { normalizeJob } from './normalize.js';
import { sleep, withTimeout } from './sources/lib.js';

// NOTE: initializeApp() is NOT called here — each entrypoint initializes
// credentials itself (index.js: platform defaults; scripts/run-sync.js:
// service-account JSON from env) before invoking runSync().

const FETCH_TIMEOUT_MS = 30000;
const BATCH_SIZE = 250;
const STALE_DAYS = 45;
const STALE_DELETE_LIMIT = 300;
const POLITE_DELAY_MS = 1500;

/**
 * Split an array into fixed-size chunks
 * @param {any[]} items
 * @param {number} size
 */
function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Run a sync across sources.
 * @param {string[]|null} [sourceIds] null = all enabled sources
 * @param {{ fetchImpl?: typeof fetch }} [options] injectable for tests
 * @returns {Promise<Array<{id: string, ok: boolean, count?: number, error?: string, skipped?: string}>>}
 */
export async function runSync(sourceIds = null, options = {}) {
  const db = getFirestore();
  const sources = getSources(sourceIds);
  const results = [];

  for (const src of sources) {
    const metaRef = db.collection('sync_meta').doc(src.id);

    // Explicitly disabled adapter (e.g. LinkedIn) — record and move on
    if (src.enabled === false) {
      await metaRef.set(
        { lastRunAt: FieldValue.serverTimestamp(), ok: true, count: 0, skipped: 'disabled' },
        { merge: true }
      );
      results.push({ id: src.id, ok: true, skipped: 'disabled' });
      continue;
    }

    // Missing API key — skip without burning the run
    const missingKey = (src.requires || []).find((k) => !process.env[k]);
    if (missingKey) {
      await metaRef.set(
        { lastRunAt: FieldValue.serverTimestamp(), ok: true, count: 0, skipped: `missing:${missingKey}` },
        { merge: true }
      );
      results.push({ id: src.id, ok: true, skipped: `missing:${missingKey}` });
      continue;
    }

    try {
      const rawJobs = await withTimeout(
        Promise.resolve(src.fetchJobs({ fetchImpl: options.fetchImpl, env: process.env })),
        FETCH_TIMEOUT_MS
      );

      // Normalize + dedupe (id = hash of company|title|url)
      /** @type {Map<string, object>} */
      const byId = new Map();
      for (const raw of rawJobs || []) {
        const job = normalizeJob(raw, src);
        if (job) byId.set(job.id, job);
      }
      const jobs = [...byId.values()];

      // Upsert
      let upserts = 0;
      for (const batch of chunk(jobs, BATCH_SIZE)) {
        const writer = db.bulkWriter();
        for (const job of batch) {
          // fetchedAt is the "last seen" stamp: the client's listing query
          // sorts on it, and the prune step ages listings out by it. A doc
          // missing this field is invisible to both.
          writer.set(
            db.collection('opportunities').doc(job.id),
            { ...job, fetchedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
        await writer.close();
        upserts += batch.length;
      }

      // Prune listings this source stopped advertising.
      // Uses a single-field range query (auto-indexed) and filters by
      // source in memory — a composite (source + fetchedAt) index would
      // be required otherwise, and its absence fails every write run.
      // Prune problems must never fail the source's listings.
      let staleDeleted = 0;
      try {
        const cutoff = new Date(Date.now() - STALE_DAYS * 86400000);
        const staleSnap = await db
          .collection('opportunities')
          .where('fetchedAt', '<', cutoff)
          .orderBy('fetchedAt')
          .limit(STALE_DELETE_LIMIT)
          .get();
        const staleDocs = staleSnap.docs.filter((d) => d.get('source') === src.id);
        if (staleDocs.length > 0) {
          const deleter = db.bulkWriter();
          staleDocs.forEach((d) => deleter.delete(d.ref));
          await deleter.close();
          staleDeleted = staleDocs.length;
        }
      } catch (pruneErr) {
        console.error(`[sync] prune skipped for ${src.id}:`, pruneErr?.message || pruneErr);
      }

      await metaRef.set(
        {
          lastRunAt: FieldValue.serverTimestamp(),
          ok: true,
          count: jobs.length,
          upserts,
          staleDeleted,
          error: null,
        },
        { merge: true }
      );
      results.push({ id: src.id, ok: true, count: jobs.length });
    } catch (err) {
      const message = err?.message || String(err);
      console.error(`[sync] source ${src.id} failed:`, message);
      await metaRef.set(
        { lastRunAt: FieldValue.serverTimestamp(), ok: false, error: message.slice(0, 300) },
        { merge: true }
      );
      results.push({ id: src.id, ok: false, error: message.slice(0, 300) });
    }

    // Be polite between sources (mostly for the HTML scrapers)
    await sleep(POLITE_DELAY_MS);
  }

  return results;
}
