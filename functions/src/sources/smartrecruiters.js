/**
 * SmartRecruiters — public per-company postings API
 * (https://developers.smartrecruiters.com). Add company IDs to COMPANIES;
 * unknown IDs 404 and are skipped silently.
 */

import { fetchJson } from './lib.js';

const COMPANIES = [
  'ubisoft',
  'palantir-2', // placeholder-style IDs are replaced easily; 404s are skipped
];

export default {
  id: 'smartrecruiters',
  name: 'SmartRecruiters',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const jobs = [];
    for (const company of COMPANIES) {
      try {
        const data = await fetchJson(
          `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=100`,
          { fetchImpl }
        );
        for (const p of data?.content || []) {
          jobs.push({
            title: p.name,
            company: data?.company?.name || company,
            location: [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(', '),
            region: /india/i.test(String(p.location?.country || '')) ? 'india' : 'global',
            type: /intern/i.test(String(p.name || '')) ? 'internship' : 'fulltime',
            applyUrl: `https://jobs.smartrecruiters.com/${company}/${p.id}`,
            tags: (p.releasedDate ? [] : []).concat(p.department?.label || []),
            description: p.jobAd?.sections?.jobDescription?.text || '',
            postedAt: p.releasedDate,
          });
        }
      } catch {
        // Unknown company token — skip and continue with the rest
      }
    }
    return jobs;
  },
};
