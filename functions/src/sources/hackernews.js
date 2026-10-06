/**
 * Hacker News "Ask HN: Who is hiring?" — via the public Algolia API.
 * Parses the classic `Company | Role | Location` comment format from the
 * newest monthly thread. Free, no key required.
 */

import { fetchJson, stripHtml } from './lib.js';

export default {
  id: 'hackernews',
  name: 'HN Who is Hiring',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const search = await fetchJson(
      'https://hn.algolia.com/api/v1/search_by_date?tags=story&query=%22Ask%20HN%3A%20Who%20is%20hiring%22&hitsPerPage=1',
      { fetchImpl }
    );
    const storyId = search?.hits?.[0]?.objectID;
    if (!storyId) return [];

    const story = await fetchJson(`https://hn.algolia.com/api/v1/items/${storyId}`, { fetchImpl });
    const jobs = [];

    for (const comment of (story?.children || []).slice(0, 60)) {
      const text = stripHtml(comment.text || '');
      if (text.length < 20) continue;

      // Canonical format: "Company | Role | Location | extra"
      const parts = text.split('|').map((p) => p.trim());
      let company = '';
      let title = '';
      let location = '';
      if (parts.length >= 3) {
        company = parts[0].slice(0, 80);
        title = parts[1].slice(0, 120);
        location = parts[2].slice(0, 80);
      } else {
        company = text.split(/[.,\n]/)[0].slice(0, 60);
        title = text.slice(0, 120);
      }

      const linkMatch = text.match(/https?:\/\/[^\s|)]+/);
      const applyUrl = linkMatch?.[0] || `https://news.ycombinator.com/item?id=${comment.id}`;

      jobs.push({
        title,
        company,
        location,
        region: /india/i.test(location) ? 'india' : 'global',
        type: /intern/i.test(text) ? 'internship' : 'fulltime',
        applyUrl,
        tags: [],
        description: text.slice(0, 900),
        postedAt: comment.created_at,
      });
    }
    return jobs;
  },
};
