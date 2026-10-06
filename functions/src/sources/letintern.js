/**
 * LetIntern — Indian internship board.
 * Scrapes the public internships listing page.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

export default {
  id: 'letintern',
  name: 'LetIntern',
  region: 'india',
  kind: 'html',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const html = await fetchHtml('https://letintern.in/internships', { fetchImpl });
    const $ = cheerio.load(html);
    const jobs = [];

    $('.internship-item, .internship-box, .card').each((_, card) => {
      const $card = $(card);
      const titleEl = $card.find('h3, h2, .title').first();
      const title = titleEl.text().replace(/\s+/g, ' ').trim();
      const href = $card.find('a').first().attr('href') || titleEl.find('a').attr('href');
      if (!title || !href) return;
      jobs.push({
        title: title.slice(0, 140),
        company: $card.find('.company, .organisation').first().text().replace(/\s+/g, ' ').trim() || 'LetIntern listing',
        location: $card.find('.location').first().text().replace(/\s+/g, ' ').trim() || 'India',
        region: 'india',
        type: 'internship',
        applyUrl: String(href).startsWith('http') ? href : `https://letintern.in${href}`,
        tags: [],
        description: $card.find('p, .description').first().text().replace(/\s+/g, ' ').trim(),
        stipend: $card.find('.stipend, .salary').first().text().replace(/\s+/g, ' ').trim() || null,
      });
    });

    return jobs;
  },
};
