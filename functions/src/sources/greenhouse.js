/**
 * Greenhouse public job-board API. One adapter covers many companies —
 * add board tokens to COMPANIES. Unknown tokens 404 and are skipped.
 * Find a company's token in their careers URL: boards.greenhouse.io/{token}
 */

import { fetchJson } from './lib.js';

const COMPANIES = [
  'stripe', 'airbnb', 'dropbox', 'figma', 'notion', 'databricks',
  'coinbase', 'doordash', 'grammarly', 'gusto', 'benchling', 'concursolabs',
];

export default {
  id: 'greenhouse',
  name: 'Greenhouse Boards',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const jobs = [];
    for (const token of COMPANIES) {
      try {
        const data = await fetchJson(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=false`,
          { fetchImpl }
        );
        for (const j of data?.jobs || []) {
          jobs.push({
            title: j.title,
            company: data?.meta?.name || token,
            location: j.location?.name || '',
            region: /india/i.test(String(j.location?.name || '')) ? 'india' : 'global',
            type: /intern/i.test(String(j.title || '')) ? 'internship' : 'fulltime',
            applyUrl: j.absolute_url,
            tags: [],
            description: '',
            postedAt: j.updated_at,
          });
        }
      } catch {
        // Board token not found — skip
      }
    }
    return jobs;
  },
};
