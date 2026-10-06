/**
 * Instahyre — India tech hiring platform.
 * DISABLED: the site's WAF returns 403 to datacenter IPs (including
 * GitHub Actions runners) even with full browser headers. Re-enable only
 * if you route requests through a residential proxy.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

const ENABLED = false;

export default {
  id: 'instahyre',
  name: 'Instahyre',
  region: 'india',
  kind: 'html',
  enabled: ENABLED,

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
