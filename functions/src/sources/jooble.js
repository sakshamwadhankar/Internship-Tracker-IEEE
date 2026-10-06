/**
 * Jooble — official API (free key: https://jooble.org/api/about).
 * Searches internships in India.
 */

import { fetchJson } from './lib.js';

export default {
  id: 'jooble',
  name: 'Jooble',
  region: 'india',
  kind: 'api',
  requires: ['JOOBLE_API_KEY'],

  /**
   * @param {{ fetchImpl?: typeof fetch, env?: Record<string, string> }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch, env = process.env } = {}) {
    const key = env.JOOBLE_API_KEY;
    const url = `https://jooble.org/api/${encodeURIComponent(key)}`;
    const data = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: 'internship', location: 'India', page: 1 }),
      fetchImpl,
    });

    return (data?.jobs || []).map((r) => ({
      title: r.title,
      company: r.company,
      location: r.location,
      region: 'india',
      applyUrl: r.link,
      tags: r.snippet ? String(r.snippet).split(/[.,•]/).slice(0, 4) : [],
      description: r.snippet,
      postedAt: r.updated,
    }));
  },
};
