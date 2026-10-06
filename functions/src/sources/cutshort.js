/**
 * Cutshort — India tech jobs platform (Next.js app).
 * Pulls __NEXT_DATA__ and deep-searches for job entities; falls back to
 * anchor parsing.
 */

import { fetchHtml } from './lib.js';
import * as cheerio from 'cheerio';

/**
 * Recursively find arrays of job-shaped objects
 * @param {any} node
 * @param {object[]} acc
 * @param {number} depth
 */
function collectJobArrays(node, acc, depth = 0) {
  if (depth > 12 || !node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every(
        (item) =>
          item && typeof item === 'object' &&
          (item.title || item.name || item.job_title) &&
          (item.company || item.company_name || item.companyName || item.organization)
      )
    ) {
      acc.push(node);
    } else {
      for (const item of node.slice(0, 5)) collectJobArrays(item, acc, depth + 1);
    }
    return acc;
  }
  for (const key of Object.keys(node)) collectJobArrays(node[key], acc, depth + 1);
  return acc;
}

export default {
  id: 'cutshort',
  name: 'Cutshort',
  region: 'india',
  kind: 'html',

  /**
   * @param {{ fetchImpl?: typeof fetch }} [ctx]
   * @returns {Promise<object[]>}
   */
  async fetchJobs({ fetchImpl = fetch } = {}) {
    const html = await fetchHtml('https://cutshort.io/jobs', { fetchImpl });
    const jobs = [];

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        /** @type {object[][]} */
        const arrays = [];
        collectJobArrays(data, arrays);
        for (const item of arrays[0] || []) {
          const title = item.title || item.name || item.job_title;
          if (!title) continue;
          jobs.push({
            title,
            company: item.company?.name || item.company_name || item.companyName || item.organization || 'Cutshort listing',
            location: item.location || item.job_location || 'India',
            region: /india/i.test(String(item.location || '')) ? 'india' : 'global',
            applyUrl: item.url || item.job_url || item.shareUrl || 'https://cutshort.io/jobs',
            tags: item.skills || item.tags || [],
            description: item.description || '',
          });
        }
      } catch {
        // fall through
      }
    }

    if (jobs.length === 0) {
      const $ = cheerio.load(html);
      $('a[href*="/jobs/"]').each((_, el) => {
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        const href = $(el).attr('href');
        if (title.length > 12 && href) {
          jobs.push({
            title: title.slice(0, 140),
            company: 'Cutshort listing',
            location: 'India',
            region: 'india',
            applyUrl: String(href).startsWith('http') ? href : `https://cutshort.io${href}`,
            tags: [],
            description: '',
          });
        }
      });
    }

    return jobs;
  },
};
