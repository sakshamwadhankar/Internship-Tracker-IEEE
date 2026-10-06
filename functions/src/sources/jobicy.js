/**
 * Jobicy — free public remote-jobs API, no key required
 * (https://jobicy.com/jobs-rss-feed / /api/v2).
 */

import { fetchJson } from './lib.js';

export default {
  id: 'jobicy',
  name: 'Jobicy',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const data = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=50', { fetchImpl });
    return (data?.jobs || []).map((r) => ({
      title: r.jobTitle,
      company: r.companyName,
      location: r.jobGeo || 'Remote',
      region: 'global',
      type: r.jobLevel === 'Internship' ? 'internship' : undefined,
      applyUrl: r.url,
      tags: [r.jobLevel, r.jobIndustry, ...(r.jobTags || [])].filter(Boolean).slice(0, 8),
      description: r.jobDescription || r.jobExcerpt,
      postedAt: r.pubDate,
    }));
  },
};
