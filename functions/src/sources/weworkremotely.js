/**
 * We Work Remotely — public RSS feeds (intended for consumption).
 * Merges the programming and design categories.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

const FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
];

export default {
  id: 'weworkremotely',
  name: 'We Work Remotely',
  region: 'global',
  kind: 'api',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const jobs = [];
    for (const feed of FEEDS) {
      const xml = await fetchHtml(feed, { fetchImpl });
      const $ = cheerio.load(xml, { xmlMode: true });
      $('item').each((_, item) => {
        const rawTitle = $('title', item).text().trim();
        // Feed titles are "Company: Role"
        const idx = rawTitle.indexOf(':');
        const company = idx > 0 ? rawTitle.slice(0, idx).trim() : rawTitle;
        const title = idx > 0 ? rawTitle.slice(idx + 1).trim() : rawTitle;
        jobs.push({
          title,
          company,
          location: 'Remote',
          region: 'global',
          applyUrl: $('link', item).text().trim(),
          tags: [$('category', item).first().text()].filter(Boolean),
          description: $('description', item).text(),
          postedAt: $('pubDate', item).text().trim(),
        });
      });
    }
    return jobs;
  },
};
