/**
 * Source registry — every adapter that the sync engine can run.
 *
 * Add a source: create `./<name>.js` default-exporting
 *   { id, name, region, kind, enabled?, requires?, fetchJobs(ctx) }
 * and register it below.
 */

import adzuna from './adzuna.js';
import remotive from './remotive.js';
import arbeitnow from './arbeitnow.js';
import jooble from './jooble.js';
import themuse from './themuse.js';
import jobicy from './jobicy.js';
import hackernews from './hackernews.js';
import smartrecruiters from './smartrecruiters.js';
import careerjet from './careerjet.js';
import weworkremotely from './weworkremotely.js';
import greenhouse from './greenhouse.js';
import lever from './lever.js';
import ashby from './ashby.js';
import internshala from './internshala.js';
import naukri from './naukri.js';
import unstop from './unstop.js';
import instahyre from './instahyre.js';
import letintern from './letintern.js';
import cutshort from './cutshort.js';
import linkedin from './linkedin.js';

/** @type {Array<object>} */
const ALL_SOURCES = [
  // Official / public APIs
  adzuna,
  remotive,
  arbeitnow,
  jooble,
  themuse,
  jobicy,
  hackernews,
  smartrecruiters,
  careerjet,
  weworkremotely,
  // Multi-company ATS boards
  greenhouse,
  lever,
  ashby,
  // Indian boards (HTML)
  internshala,
  naukri,
  unstop,
  instahyre,
  letintern,
  cutshort,
  // ToS-flagged, disabled by default
  linkedin,
];

/**
 * Get all sources, optionally filtered to specific IDs.
 * Sources explicitly disabled by their adapter are only included when
 * requested by ID (so they can still be audited / manually run).
 * @param {string[]|null} [ids] null = every source
 * @returns {Array<object>}
 */
export function getSources(ids = null) {
  if (ids === null || ids === undefined) {
    return ALL_SOURCES.filter((s) => s.enabled !== false);
  }
  const wanted = new Set(ids);
  return ALL_SOURCES.filter((s) => wanted.has(s.id));
}

/** Number of sources that will actually run (enabled + keys present) */
export function activeSourceCount() {
  return ALL_SOURCES.filter(
    (s) => s.enabled !== false && (s.requires || []).every((k) => process.env[k])
  ).length;
}
