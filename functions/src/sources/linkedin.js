/**
 * LinkedIn guest jobs endpoint — DISABLED BY DEFAULT.
 *
 * LinkedIn's User Agreement prohibits scraping. This adapter uses the
 * public "guest" HTML fragment that requires no login, and is kept off
 * unless the operator explicitly enables it (ENABLED: true below) and
 * accepts that risk. Prefer the API-based sources instead.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

const ENABLED = false;

export default {
  id: 'linkedin',
  name: 'LinkedIn (guest)',
  region: 'india',
  kind: 'html',
  enabled: ENABLED,

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    if (!ENABLED) return [];

    const url =
      'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search' +
      '?keywords=internship&location=India&start=0';
    const html = await fetchHtml(url, { fetchImpl });
    const $ = cheerio.load(html);
    const jobs = [];

    $('li, div.base-card').each((_, card) => {
      const $card = $(card);
      const title = $card.find('h3.base-search-card__title, .base-card__title').first().text().replace(/\s+/g, ' ').trim();
      const company = $card.find('h4.base-search-card__subtitle, .base-search-card__subtitle').first().text().replace(/\s+/g, ' ').trim();
      const location = $card.find('.job-search-card__location').first().text().replace(/\s+/g, ' ').trim();
      const href = $card.find('a.base-card__full-link').first().attr('href');
      const posted = $card.find('time').first().attr('datetime');
      if (!title || !href) return;
      jobs.push({
        title: title.slice(0, 140),
        company: company || 'LinkedIn listing',
        location: location || 'India',
        region: 'india',
        type: /intern/i.test(title) ? 'internship' : 'fulltime',
        applyUrl: href.split('?')[0],
        tags: [],
        description: '',
        postedAt: posted,
      });
    });

    return jobs;
  },
};
