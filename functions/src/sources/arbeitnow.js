/**
 * Arbeitnow — free public job-board API, no key required
 * (https://www.arbeitnow.com/api).
 */

import { fetchJson } from './lib.js';

export default {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api', { fetchImpl });
    return (data?.data || []).map((r) => ({
      title: r.title,
      company: r.company_name,
      location: r.location,
      region: 'global',
      type: r.job_type === 'internship' ? 'internship' : undefined, // fall through to title sniffing
      applyUrl: r.url,
      tags: r.tags || [],
      description: r.description_html || r.description || '',
      postedAt: r.created_at, // unix seconds — handled by toMillis
    }));
  },
};
