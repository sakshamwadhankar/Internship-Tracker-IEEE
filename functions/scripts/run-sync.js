/**
 * Standalone sync runner — lets the scraper run on plain Node.js CI
 * (e.g. GitHub Actions) without the Cloud Functions runtime.
 *
 * Auth: set GOOGLE_SERVICE_ACCOUNT_JSON to the FULL JSON of a Firebase
 * service account private key (repo secret, never committed). Falls back
 * to Application Default Credentials when running inside Google infra.
 *
 * Usage:
 *   GOOGLE_SERVICE_ACCOUNT_JSON='...' node scripts/run-sync.js
 *   node scripts/run-sync.js internshala,adzuna   # optional source filter
 */

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { runSync } from '../src/sync.js';

// Service account from the environment (GitHub Actions secret) or ADC.
const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (saJson) {
  const credentials = cert(JSON.parse(saJson));
  initializeApp({ credential: credentials });
} else {
  // GOOGLE_APPLICATION_CREDENTIALS env var or metadata-server default
  initializeApp();
}

// Optional comma-separated source filter, e.g. `node run-sync.js internshala,adzuna`
const arg = process.argv[2];
const sourceIds = arg ? arg.split(',').map((s) => s.trim()).filter(Boolean) : null;

try {
  const results = await runSync(sourceIds, { env: process.env });
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  for (const r of results) {
    if (r.skipped) console.log(`- ${r.id}: skipped (${r.skipped})`);
    else if (r.ok) console.log(`- ${r.id}: ${r.count} listings`);
    else console.log(`- ${r.id}: FAILED — ${r.error}`);
  }
  console.log(`\nSync complete: ${ok}/${results.length} sources ok`);

  if (failed.length > 0) {
    // Non-fatal: a couple of broken HTML adapters should not fail the CI run,
    // but do surface them. Fail the job only if EVERYTHING failed.
    if (ok === 0) {
      console.error('All sources failed.');
      process.exit(1);
    }
  }
} catch (err) {
  console.error('Sync crashed:', err);
  process.exit(1);
}
