/**
 * Unstop — Indian competitions/internships platform (Next.js app).
 * Strategy: pull __NEXT_DATA__ and deep-search it for entities that look
 * like opportunities (have title + organisation). Markup changes degrade
 * to zero results rather than errors.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

/**
 * Recursively find arrays whose items carry a title-ish + org-ish shape
 * @param {any} node
 * @param {object[]} acc
 * @param {number} depth
 */
function collectOpportunityArrays(node, acc, depth = 0) {
  if (depth > 12 || !node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every(
        (item) =>
          item && typeof item === 'object' &&
          (item.title || item.opportunity_title) &&
          (item.organisation || item.company || item.organisation__name || item.organisation_title)
      )
    ) {
      acc.push(node);
    } else {
      for (const item of node.slice(0, 5)) collectOpportunityArrays(item, acc, depth + 1);
    }
    return acc;
  }
  for (const key of Object.keys(node)) collectOpportunityArrays(node[key], acc, depth + 1);
  return acc;
}

export default {
  id: 'unstop',
  name: 'Unstop',
  region: 'india',
  kind: 'html',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const html = await fetchHtml('https://unstop.com/internships', { fetchImpl });
    const jobs = [];

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        /** @type {object[][]} */
        const arrays = [];
        collectOpportunityArrays(data, arrays);
        for (const item of arrays[0] || []) {
          const title = item.title || item.opportunity_title;
          const href = item.opportunity_url || item.url || item.share_url;
          if (!title) continue;
          const applyUrl = href
            ? (String(href).startsWith('http') ? href : `https://unstop.com${href}`)
            : 'https://unstop.com/internships';
          jobs.push({
            title,
            company: item.organisation?.name || item.organisation_title || item.organisation__name || 'Unstop listing',
            location: item.city || item.location || 'India',
            region: 'india',
            type: 'internship',
            applyUrl,
            tags: [item.category?.name, item.opportunity_type?.name].filter(Boolean),
            description: item.description || item.about || '',
            deadline: item.deadline || item.end_date || null,
          });
        }
      } catch {
        // fall through to empty
      }
    }

    if (jobs.length === 0) {
      // Fallback: generic card parsing
      const $ = cheerio.load(html);
      $('a[href*="/internship/"]').each((_, el) => {
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        const href = $(el).attr('href');
        if (title.length > 12 && href) {
          jobs.push({
            title: title.slice(0, 140),
            company: 'Unstop listing',
            location: 'India',
            region: 'india',
            type: 'internship',
            applyUrl: String(href).startsWith('http') ? href : `https://unstop.com${href}`,
            tags: [],
            description: '',
          });
        }
      });
    }

    return jobs;
  },
};
