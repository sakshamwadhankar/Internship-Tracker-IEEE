/**
 * Shared helpers for source adapters.
 *
 * All adapters receive `{ fetchImpl, env }` so tests can inject a mock
 * fetch and fixture secrets. In production both default to the real ones.
 */

export const USER_AGENT =
  'Mozilla/5.0 (compatible; PTrackerBot/1.0; +https://github.com/sakshamwadhankar/Internship-Tracker-IEEE)';

/**
 * fetch() with browser-like headers and a hard timeout
 * @param {string} url
 * @param {object} [options]
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, fetchImpl = fetch) {
  const { timeoutMs = 20000, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,en-IN;q=0.8',
        ...(rest.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET a JSON endpoint and parse it
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, options = {}) {
  const res = await fetchWithTimeout(url, options, options.fetchImpl);
  if (!res.ok) {
    throw new Error(`${url.slice(0, 80)} responded ${res.status}`);
  }
  return res.json();
}

/**
 * GET an HTML page and return its text
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<string>}
 */
export async function fetchHtml(url, options = {}) {
  const res = await fetchWithTimeout(url, options, options.fetchImpl);
  if (!res.ok) {
    throw new Error(`${url.slice(0, 80)} responded ${res.status}`);
  }
  return res.text();
}

/**
 * Remove HTML tags and decode the common entities
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      try { return String.fromCharCode(Number(code)); } catch { return ' '; }
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sleep between requests to be polite to scraped hosts
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reject a promise if it does not settle within `ms`
 * @param {Promise<any>} promise
 * @param {number} ms
 * @returns {Promise<any>}
 */
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}
