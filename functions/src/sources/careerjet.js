/**
 * Careerjet — official affiliate API (free affiliate ID: https://www.careerjet.com/partners/).
 * Skipped automatically when CAREERJET_AFFID is not configured.
 */

import { fetchJson } from './lib.js';

export default {
  id: 'careerjet',
  name: 'Careerjet',
  region: 'india',
  kind: 'api',
  requires: ['CAREERJET_AFFID'],

  /**
   * @param {{ fetchImpl?: typeof fetch, env?: Record<string, string> }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch, env = process.env } = {}) {
    const affid = env.CAREERJET_AFFID;
    const url =
      `https://www.careerjet.com/search/jobs?v=2&affid=${encodeURIComponent(affid)}` +
      `&locale_code=en_IN&keywords=internship&location=India&pagesize=50`;
    const data = await fetchJson(url, { fetchImpl });

    return (data?.jobs || []).map((r) => ({
      title: r.title,
      company: r.company,
      location: Array.isArray(r.locations) ? r.locations.join(', ') : r.location,
      region: 'india',
      applyUrl: r.url,
      tags: [],
      description: r.description,
      postedAt: r.date,
    }));
  },
};
