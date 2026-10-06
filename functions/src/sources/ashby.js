/**
 * Ashby public job-board API. One adapter covers many companies —
 * add board tokens to COMPANIES. Find the token in a careers URL:
 * jobs.ashbyhq.com/{token}
 */

import { fetchJson } from './lib.js';

const COMPANIES = [
  'ashby', 'supabase', 'posthog', 'linear', 'vercel', 'ironclad',
  'calendar', 'bottomline',
];

export default {
  id: 'ashby',
  name: 'Ashby Boards',
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
          `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`,
          { fetchImpl }
        );
        for (const j of data?.jobs || []) {
          const loc = [j.location, ...(j.secondaryLocations || []).map((l) => l.location)]
            .filter(Boolean).join(', ');
          jobs.push({
            title: j.title,
            company: token,
            location: j.isRemote ? `${loc || ''} Remote`.trim() : loc,
            region: /india/i.test(loc) ? 'india' : 'global',
            type: /intern/i.test(String(j.title || '')) ? 'internship' : 'fulltime',
            applyUrl: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${token}/${j.id}`,
            tags: j.isRemote ? ['remote'] : [],
            description: '',
            postedAt: j.publishedAt,
          });
        }
      } catch {
        // Board token not found — skip
      }
    }
    return jobs;
  },
};
