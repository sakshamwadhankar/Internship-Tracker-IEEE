/**
 * Job normalization + deduplication.
 *
 * Every adapter returns raw jobs with loose shapes; normalizeJob() turns
 * them into one canonical document shape and rejects incomplete entries.
 * The doc ID is a hash of (company, title, applyUrl) so re-syncing the
 * same listing is an idempotent upsert instead of a duplicate.
 */

import { createHash } from 'node:crypto';
import { stripHtml } from './sources/lib.js';

export const MAX_DESCRIPTION_LENGTH = 1500;
export const MAX_TAGS = 12;

/**
 * Lowercase slug-ish token used for dedupe keys
 * @param {string} str
 * @returns {string}
 */
function normPart(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Canonical https URL or null
 * @param {string} url
 * @returns {string|null}
 */
export function normalizeUrl(url) {
  const trimmed = String(url || '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^http:\/\//i, 'https://');
}

/**
 * 'internship' when the title looks like one, else 'fulltime'
 * @param {string} title
 * @returns {string}
 */
export function sniffType(title) {
  return /intern|trainee|co-?op/i.test(String(title || '')) ? 'internship' : 'fulltime';
}

/**
 * Convert ISO strings, epoch seconds or ms into ms since epoch (or null)
 * @param {string|number|Date|null|undefined} input
 * @returns {number|null}
 */
export function toMillis(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number' && Number.isFinite(input)) {
    // Heuristic: values below ~10^12 are seconds
    return input < 1e12 ? input * 1000 : input;
  }
  const parsed = Date.parse(String(input));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Clean and bound a tags array
 * @param {string[]} tags
 * @returns {string[]}
 */
export function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    const t = stripHtml(String(tag || '')).toLowerCase().slice(0, 30).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * Build the deterministic document ID for a job
 * @param {{ company?: string, title?: string, applyUrl?: string }} job
 * @returns {string}
 */
export function dedupeKey(job) {
  return createHash('sha256')
    .update(`${normPart(job.company)}|${normPart(job.title)}|${normPart(job.applyUrl)}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Turn a raw adapter job into the canonical Firestore document shape.
 * Returns null when the job is too incomplete to be useful.
 * @param {object} raw
 * @param {{ id: string, region?: string }} source
 * @returns {object|null}
 */
export function normalizeJob(raw, source) {
  if (!raw || typeof raw !== 'object') return null;

  const title = stripHtml(raw.title).slice(0, 160);
  const company = stripHtml(raw.company).slice(0, 100);
  const applyUrl = normalizeUrl(raw.applyUrl);
  if (!title || !company || !applyUrl) return null;

  const description = stripHtml(raw.description).slice(0, MAX_DESCRIPTION_LENGTH);
  const region = raw.region === 'india' || source.region === 'india' ? 'india' : 'global';
  const type = raw.type === 'internship' || raw.type === 'fulltime' ? raw.type : sniffType(title);

  const job = {
    id: '',
    title,
    company,
    location: stripHtml(raw.location).slice(0, 100) || '',
    region,
    type,
    source: source.id,
    sourceName: source.name || source.id,
    applyUrl,
    tags: cleanTags(raw.tags),
    description,
    postedAtMs: toMillis(raw.postedAt),
    stipend: stripHtml(raw.stipend).slice(0, 60) || null,
    deadline: stripHtml(raw.deadline).slice(0, 60) || null,
  };
  job.id = dedupeKey(job);
  return job;
}
