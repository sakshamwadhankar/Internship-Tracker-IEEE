/**
 * The Muse — official public API, no key required for basic use
 * (https://www.themuse.com/developers/api/v2).
 */

import { fetchJson } from './lib.js';

export default {
  id: 'themuse',
  name: 'The Muse',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const data = await fetchJson('https://www.themuse.com/api/public/jobs?page=1&descending=true', { fetchImpl });
    return (data?.results || []).map((r) => {
      const levels = (r.levels || []).map((l) => l.name);
      const isIntern = levels.some((l) => /intern/i.test(l)) || /intern/i.test(String(r.name || ''));
      return {
        title: r.name,
        company: r.company?.display_name || r.company?.name,
        location: (r.locations || []).map((l) => l.name).join(', '),
        region: 'global',
        type: isIntern ? 'internship' : 'fulltime',
        applyUrl: r.refs?.landing_page,
        tags: [...levels, ...(r.categories || []).map((c) => c.name)].slice(0, 6),
        description: r.contents,
        postedAt: r.publication_date,
      };
    });
  },
};
