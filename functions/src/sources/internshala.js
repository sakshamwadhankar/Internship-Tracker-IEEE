/**
 * Internshala — India's largest internship board.
 * Scrapes the public internships listing page. Selectors are best-effort
 * and may need updates if the site's markup changes; a failure here is
 * isolated and visible in sync_meta without affecting other sources.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

export default {
  id: 'internshala',
  name: 'Internshala',
  region: 'india',
  kind: 'html',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const html = await fetchHtml('https://internshala.com/internships/', { fetchImpl });
    const $ = cheerio.load(html);
    const jobs = [];

    $('div.individual_internship').each((_, card) => {
      const $card = $(card);
      const titleEl = $card.find('.profile').first();
      const detailHref = titleEl.find('a').attr('href') || $card.find('a[href*="/internship/detail/"]').attr('href');
      const company = $card.find('.company_name, .company_and_porporate .company_name').first().text();
      const location = $card.find('.location_names, .locations').first().text().replace(/\s+/g, ' ');
      const stipend = $card.find('.stipend').first().text().replace(/\s+/g, ' ');
      const deadline = $card.find('.start_time, .apply_by').first().text().replace(/\s+/g, ' ');

      const title = titleEl.text().replace(/\s+/g, ' ').trim();
      if (!title || !detailHref) return;

      jobs.push({
        title,
        company: company.replace(/\s+/g, ' ').trim() || 'Internshala listing',
        location: location.trim() || 'India',
        region: 'india',
        type: 'internship',
        applyUrl: new URL(detailHref, 'https://internshala.com').href,
        tags: [],
        description: '',
        stipend: stipend.trim(),
        deadline: deadline.trim(),
      });
    });

    return jobs;
  },
};
