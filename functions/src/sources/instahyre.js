/**
 * Instahyre — India tech hiring platform.
 * Scrapes the public job search page; heavily client-rendered, so this
 * attempts the markup and degrades gracefully to zero results.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

export default {
  id: 'instahyre',
  name: 'Instahyre',
  region: 'india',
  kind: 'html',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const html = await fetchHtml('https://www.instahyre.com/search-jobs/', { fetchImpl });
    const $ = cheerio.load(html);
    const jobs = [];

    $('div.opportunity, .job-opportunity').each((_, card) => {
      const $card = $(card);
      const title = $card.find('.job-title, h3').first().text().replace(/\s+/g, ' ').trim();
      const company = $card.find('.company-name, .company').first().text().replace(/\s+/g, ' ').trim();
      const href = $card.find('a').first().attr('href');
      if (!title || !href) return;
      jobs.push({
        title: title.slice(0, 140),
        company: company || 'Instahyre listing',
        location: $card.find('.location, .job-location').first().text().replace(/\s+/g, ' ').trim() || 'India',
        region: 'india',
        applyUrl: String(href).startsWith('http') ? href : `https://www.instahyre.com${href}`,
        tags: [],
        description: '',
      });
    });

    return jobs;
  },
};
