/**
 * Naukri — India's largest job portal.
 * The listing pages are heavy SPA output; we attempt the server-rendered
 * job cards and fall back to the embedded state JSON. This source is the
 * most likely to break (anti-bot + markup churn) — failures are isolated.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

export default {
  id: 'naukri',
  name: 'Naukri',
  region: 'india',
  kind: 'html',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const html = await fetchHtml('https://www.naukri.com/internship-jobs?src=jobsearchDesk&seoKey=internship-jobs', { fetchImpl });
    const $ = cheerio.load(html);
    const jobs = [];

    // Path A: server-rendered job cards
    $('div.job-tuple, article.jobTuple').each((_, card) => {
      const $card = $(card);
      const title = $card.find('a.title, .title').first().text().replace(/\s+/g, ' ').trim();
      const href = $card.find('a.title, .title').first().attr('href');
      const company = $card.find('.comp-name, .companyInfo a').first().text().replace(/\s+/g, ' ').trim();
      const location = $card.find('.loc-wrap, .loc, .locations span').first().text().replace(/\s+/g, ' ').trim();
      const description = $card.find('.job-desc, .job-description').first().text().replace(/\s+/g, ' ').trim();
      if (!title || !href) return;
      jobs.push({
        title,
        company: company || 'Naukri listing',
        location: location || 'India',
        region: 'india',
        applyUrl: href,
        tags: [],
        description,
      });
    });

    // Path B: preloaded state JSON when cards are client-rendered
    if (jobs.length === 0) {
      const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          const list = state?.searchResult?.jobDetails || [];
          for (const j of list) {
            const jd = j?.jobDetails || j;
            if (!jd?.title || !jd?.jdURL) continue;
            jobs.push({
              title: jd.title,
              company: jd.companyName || 'Naukri listing',
              location: Array.isArray(jd.locations)
                ? jd.locations.map((l) => l.label).join(', ')
                : 'India',
              region: 'india',
              applyUrl: `https://www.naukri.com${jd.jdURL}`,
              tags: Array.isArray(jd.keySkills) ? jd.keySkills.map((s) => s.label) : [],
              description: jd.jobDescription || '',
            });
          }
        } catch {
          // State JSON shape changed — return whatever we have
        }
      }
    }

    return jobs;
  },
};
