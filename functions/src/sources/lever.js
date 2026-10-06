/**
 * Lever public postings API. One adapter covers many companies —
 * add board tokens to COMPANIES. Find the token in a careers URL:
 * jobs.lever.co/{token}
 */

import { fetchJson } from './lib.js';

const COMPANIES = [
  'netflix', 'spotify', 'plaid', 'brex', 'mixpanel', 'keeptruckin',
  'shopmonkey', 'lithic', 'sardine', 'dialect',
];

export default {
  id: 'lever',
  name: 'Lever Boards',
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
          `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
          { fetchImpl }
        );
        for (const j of data || []) {
          jobs.push({
            title: j.text,
            company: token,
            location: j.categories?.location || '',
            region: /india/i.test(String(j.categories?.location || '')) ? 'india' : 'global',
            type: /intern/i.test(String(j.text || '')) ? 'internship' : 'fulltime',
            applyUrl: j.hostedUrl,
            tags: [j.categories?.team, j.categories?.commitment].filter(Boolean),
            description: j.descriptionPlain || '',
            postedAt: j.createdAt, // epoch ms
          });
        }
      } catch {
        // Board token not found — skip
      }
    }
    return jobs;
  },
};
