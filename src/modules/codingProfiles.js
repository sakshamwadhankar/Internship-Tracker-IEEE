/**
 * @fileoverview Coding Profiles Integration Module
 * Connects and fetches real live statistics from GitHub, LeetCode, and HackerRank.
 * No mock data in app code — calls real endpoints and handles network boundaries gracefully.
 */

/**
 * @typedef {Object} GitHubStats
 * @property {string} username
 * @property {string} [name]
 * @property {string} [avatarUrl]
 * @property {number} publicRepos
 * @property {number} followers
 * @property {string} profileUrl
 * @property {number} fetchedAt
 */

/**
 * @typedef {Object} LeetCodeStats
 * @property {string} username
 * @property {number} totalSolved
 * @property {number} easySolved
 * @property {number} mediumSolved
 * @property {number} hardSolved
 * @property {number|string} [ranking]
 * @property {string} profileUrl
 * @property {number} fetchedAt
 */

/**
 * @typedef {Object} HackerRankStats
 * @property {string} username
 * @property {number} badgesCount
 * @property {number} totalStars
 * @property {Array<{name: string, stars: number}>} badges
 * @property {string} profileUrl
 * @property {number} fetchedAt
 */

/**
 * @typedef {Object} StudentCodingProfiles
 * @property {string} [github]
 * @property {string} [leetcode]
 * @property {string} [hackerrank]
 * @property {GitHubStats|null} [githubStats]
 * @property {LeetCodeStats|null} [leetcodeStats]
 * @property {HackerRankStats|null} [hackerrankStats]
 * @property {number} [lastSyncedAt]
 */

const STORAGE_KEY_PREFIX = 'ptracker_coding_profiles_';

/**
 * Fetch real public stats for a GitHub username
 * @param {string} username
 * @param {Function} [fetchFn=fetch]
 * @returns {Promise<GitHubStats>}
 */
export async function fetchGitHubProfile(username, fetchFn = fetch) {
  const cleanUser = String(username || '').trim();
  if (!cleanUser) {
    throw new Error('GitHub username is required');
  }

  const res = await fetchFn(`https://api.github.com/users/${encodeURIComponent(cleanUser)}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`GitHub user "${cleanUser}" not found`);
    }
    if (res.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    throw new Error(`GitHub API error (${res.status})`);
  }

  const data = await res.json();
  return {
    username: data.login || cleanUser,
    name: data.name || data.login || cleanUser,
    avatarUrl: data.avatar_url || '',
    publicRepos: Number(data.public_repos || 0),
    followers: Number(data.followers || 0),
    profileUrl: data.html_url || `https://github.com/${cleanUser}`,
    fetchedAt: Date.now()
  };
}

/**
 * Fetch real public stats for a LeetCode username
 * @param {string} username
 * @param {Function} [fetchFn=fetch]
 * @returns {Promise<LeetCodeStats>}
 */
export async function fetchLeetCodeProfile(username, fetchFn = fetch) {
  const cleanUser = String(username || '').trim();
  if (!cleanUser) {
    throw new Error('LeetCode username is required');
  }

  // Use the open alfa-leetcode-api public mirror which supports CORS
  const res = await fetchFn(`https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(cleanUser)}`);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`LeetCode user "${cleanUser}" not found`);
    }
    throw new Error(`LeetCode API request failed (${res.status})`);
  }

  const data = await res.json();
  return {
    username: cleanUser,
    totalSolved: Number(data.totalSolved || 0),
    easySolved: Number(data.easySolved || 0),
    mediumSolved: Number(data.mediumSolved || 0),
    hardSolved: Number(data.hardSolved || 0),
    ranking: data.ranking || 'N/A',
    profileUrl: `https://leetcode.com/${cleanUser}/`,
    fetchedAt: Date.now()
  };
}

/**
 * Fetch real public badges and stats for a HackerRank username
 * @param {string} username
 * @param {Function} [fetchFn=fetch]
 * @returns {Promise<HackerRankStats>}
 */
export async function fetchHackerRankProfile(username, fetchFn = fetch) {
  const cleanUser = String(username || '').trim();
  if (!cleanUser) {
    throw new Error('HackerRank username is required');
  }

  const res = await fetchFn(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(cleanUser)}/badges`);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`HackerRank user "${cleanUser}" not found`);
    }
    throw new Error(`HackerRank API request failed (${res.status})`);
  }

  const data = await res.json();
  const models = Array.isArray(data?.models) ? data.models : [];

  const badges = models.map((b) => ({
    name: b.badge_name || b.badge_type || 'Badge',
    stars: Number(b.stars || 0)
  }));

  const totalStars = badges.reduce((sum, b) => sum + b.stars, 0);

  return {
    username: cleanUser,
    badgesCount: badges.length,
    totalStars,
    badges,
    profileUrl: `https://www.hackerrank.com/${cleanUser}`,
    fetchedAt: Date.now()
  };
}

/**
 * Get cached coding profiles from local storage
 * @param {string} userId
 * @returns {StudentCodingProfiles}
 */
export function getLocalCodingProfiles(userId) {
  if (!userId || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('[CodingProfiles] Failed reading localStorage:', err);
  }
  return {};
}

/**
 * Save coding profiles to local storage
 * @param {string} userId
 * @param {StudentCodingProfiles} profiles
 */
export function saveLocalCodingProfiles(userId, profiles) {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(profiles));
  } catch (err) {
    console.warn('[CodingProfiles] Failed saving to localStorage:', err);
  }
}

/**
 * Synchronize all configured coding profiles for a student
 * @param {Object} handles
 * @param {string} [handles.github]
 * @param {string} [handles.leetcode]
 * @param {string} [handles.hackerrank]
 * @param {Function} [fetchFn=fetch]
 * @returns {Promise<{profiles: StudentCodingProfiles, errors: Array<{platform: string, error: string}>}>}
 */
export async function syncAllCodingProfiles(handles, fetchFn = fetch) {
  /** @type {StudentCodingProfiles} */
  const result = {
    github: handles.github?.trim() || '',
    leetcode: handles.leetcode?.trim() || '',
    hackerrank: handles.hackerrank?.trim() || '',
    lastSyncedAt: Date.now()
  };

  /** @type {Array<{platform: string, error: string}>} */
  const errors = [];

  if (result.github) {
    try {
      result.githubStats = await fetchGitHubProfile(result.github, fetchFn);
    } catch (err) {
      errors.push({ platform: 'GitHub', error: /** @type {Error} */ (err).message });
    }
  }

  if (result.leetcode) {
    try {
      result.leetcodeStats = await fetchLeetCodeProfile(result.leetcode, fetchFn);
    } catch (err) {
      errors.push({ platform: 'LeetCode', error: /** @type {Error} */ (err).message });
    }
  }

  if (result.hackerrank) {
    try {
      result.hackerrankStats = await fetchHackerRankProfile(result.hackerrank, fetchFn);
    } catch (err) {
      errors.push({ platform: 'HackerRank', error: /** @type {Error} */ (err).message });
    }
  }

  return { profiles: result, errors };
}
