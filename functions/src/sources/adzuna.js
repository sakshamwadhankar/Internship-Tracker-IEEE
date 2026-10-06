/**
 * Adzuna — official public API (free key: https://developer.adzuna.com).
 * Searches the internship keyword across India, GB and US.
 */

import { fetchJson } from './lib.js';

export default {
  id: 'adzuna',
  name: 'Adzuna',
  region: 'global',
  kind: 'api',
  requires: ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'],

  /**
   * @param {{ fetchImpl?: typeof fetch, env?: Record<string, string> }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch, env = process.env } = {}) {
    const appId = env.ADZUNA_APP_ID;
    const appKey = env.ADZUNA_APP_KEY;
    const countries = ['in', 'gb', 'us'];
    const jobs = [];

    for (const country of countries) {
      const url =
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
        `?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}` +
        `&results_per_page=50&what=internship&content=0`;
      const data = await fetchJson(url, { fetchImpl });
      for (const r of data?.results || []) {
        jobs.push({
          title: r.title,
          company: r.company?.display_name,
          location: r.location?.display_name,
          region: country === 'in' ? 'india' : 'global',
          type: /intern/i.test(String(r.title || '')) ? 'internship' : 'fulltime',
          applyUrl: r.redirect_url,
          tags: [r.category?.label].filter(Boolean),
          description: r.description,
          postedAt: r.created,
        });
      }
    }
    return jobs;
  },
};
