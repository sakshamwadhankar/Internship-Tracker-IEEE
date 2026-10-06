/**
 * Remotive — free public API (https://remotive.com/api-documentation).
 * Remote-first job board; good source of global tech roles.
 */

import { fetchJson } from './lib.js';

export default {
  id: 'remotive',
  name: 'Remotive',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const data = await fetchJson('https://remotive.com/api/remote-jobs?limit=60', { fetchImpl });
    return (data?.jobs || []).map((r) => ({
      title: r.title,
      company: r.company_name,
      location: r.candidate_required_location || 'Remote',
      region: /india/i.test(String(r.candidate_required_location || '')) ? 'india' : 'global',
      type: /intern/i.test(String(r.title || '')) ? 'internship' : 'fulltime',
      applyUrl: r.url,
      tags: [r.category, r.job_type].filter(Boolean),
      description: r.description,
      postedAt: r.publication_date,
    }));
  },
};
