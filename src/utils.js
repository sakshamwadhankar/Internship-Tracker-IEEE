/**
 * Utility functions for calculations, date handling, and filtering.
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} [goalId]
 * @property {string} title
 * @property {boolean} completed
 * @property {string} [dueDate] - YYYY-MM-DD
 * @property {string} [priority] - 'low' | 'medium' | 'high'
 */

/**
 * @typedef {Object} Subtask
 * @property {string} id
 * @property {string} taskId
 * @property {string} title
 * @property {boolean} completed
 */

/**
 * Calculate progress percentage for a specific goal
 * @param {Task[]} tasks
 * @param {string} goalId
 * @returns {{ completedCount: number, totalCount: number, percent: number }}
 */
export function calculateGoalProgress(tasks, goalId) {
  const goalTasks = tasks.filter(t => t.goalId === goalId);
  const completedCount = goalTasks.filter(t => t.completed).length;
  const totalCount = goalTasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent };
}

/**
 * Calculate overall progress percentage across all tasks
 * @param {Task[]} tasks
 * @returns {{ completedCount: number, totalCount: number, percent: number }}
 */
export function calculateOverallProgress(tasks) {
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent };
}

/**
 * Calculate subtasks completion for a task
 * @param {Subtask[]} subtasks
 * @param {string} taskId
 * @returns {{ completedCount: number, totalCount: number, percent: number }}
 */
export function calculateSubtaskProgress(subtasks, taskId) {
  const taskSubtasks = subtasks.filter(s => s.taskId === taskId);
  const completedCount = taskSubtasks.filter(s => s.completed).length;
  const totalCount = taskSubtasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent };
}

/**
 * Get tasks due today
 * @param {Task[]} tasks
 * @param {string} todayStr - YYYY-MM-DD
 * @returns {Task[]}
 */
export function getTodayTasks(tasks, todayStr) {
  return tasks.filter(t => t.dueDate === todayStr);
}

/**
 * Get overdue tasks (not completed and dueDate < todayStr)
 * @param {Task[]} tasks
 * @param {string} todayStr - YYYY-MM-DD
 * @returns {Task[]}
 */
export function getOverdueTasks(tasks, todayStr) {
  return tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr);
}

/**
 * Format a Date object to YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format YYYY-MM-DD to localized display string, or 'All Dates' if empty/all
 * @param {string|null|undefined} [dateStr]
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr || dateStr === 'all') {
    return 'All Dates';
  }
  try {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

/**
 * Filter tasks by specific date string (YYYY-MM-DD).
 * If dateStr is null, undefined, or 'all', returns all tasks irrespective of date.
 * @param {Task[]} tasks
 * @param {string|null|undefined} [dateStr]
 * @returns {Task[]}
 */
export function filterTasksByDate(tasks, dateStr) {
  if (!dateStr || dateStr === 'all') {
    return [...tasks];
  }
  return tasks.filter(t => t.dueDate === dateStr);
}

/**
 * Format a Date or date string into hero components (e.g. "06.04 Thursday")
 * @param {Date|string} inputDate
 * @returns {{ dayMonth: string, dayName: string, monthName: string, dayNum: string, full: string }}
 */
export function formatHeroDate(inputDate) {
  const date = typeof inputDate === 'string'
    ? (inputDate.includes('T') ? new Date(inputDate) : new Date(inputDate + 'T00:00:00'))
    : inputDate;

  if (!date || isNaN(date.getTime())) {
    return {
      dayMonth: '--.--',
      dayName: 'Today',
      monthName: '',
      dayNum: '--',
      full: 'Today'
    };
  }

  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dayMonth = `${d}.${m}`;
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });

  return {
    dayMonth,
    dayName,
    monthName,
    dayNum: d,
    full: `${dayMonth} ${dayName}`
  };
}

/**
 * Generate a date strip of sequential days around a base date
 * @param {Date} baseDate
 * @param {number} [daysBefore=0]
 * @param {number} [daysAfter=7]
 * @returns {Array<{ dateStr: string, dayNum: string, isToday: boolean, label: string }>}
 */
export function getDateStrip(baseDate, daysBefore = 0, daysAfter = 7) {
  const todayStr = toISODateString(new Date());
  /** @type {Array<{ dateStr: string, dayNum: string, isToday: boolean, label: string }>} */
  const list = [];
  const start = -daysBefore;

  for (let i = start; i <= daysAfter; i++) {
    const cur = new Date(baseDate);
    cur.setDate(baseDate.getDate() + i);
    const dateStr = toISODateString(cur);
    const dayNum = String(cur.getDate()).padStart(2, '0');
    const isToday = dateStr === todayStr;
    const label = isToday ? 'Today' : dayNum;

    list.push({
      dateStr,
      dayNum,
      isToday,
      label
    });
  }

  return list;
}

/**
 * @typedef {'mint' | 'cream' | 'orange' | 'slate'} CardTheme
 */

/**
 * Get alternating card color theme from index
 * @param {number} index
 * @returns {{ theme: CardTheme, bgClass: string }}
 */
export function getTaskColorTheme(index) {
  /** @type {Array<{ theme: CardTheme, bgClass: string }>} */
  const themes = [
    { theme: 'mint', bgClass: 'task-card-mint' },
    { theme: 'cream', bgClass: 'task-card-cream' },
    { theme: 'orange', bgClass: 'task-card-orange' },
    { theme: 'slate', bgClass: 'task-card-slate' },
  ];
  return themes[Math.abs(index) % themes.length];
}

/**
 * Compress an image File into a web-friendly DataURL
 * @param {File} file
 * @param {number} [maxWidth=1280]
 * @param {number} [quality=0.82]
 * @returns {Promise<string>}
 */
export function compressImageFile(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Image processing is only supported in browser environments'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate widget background alpha and backdrop blur from translucency percentage
 * @param {number|string|undefined|null} percent - Translucency percentage (0 to 100)
 * @returns {{ alpha: number, blurPx: number }}
 */
export function computeTranslucencyValues(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  // At 0% translucency: alpha = 1.0 (completely solid)
  // At 100% translucency: alpha = 0.0 (fully transparent glass)
  const alpha = Number((1 - (p / 100)).toFixed(2));
  const blurPx = Math.round(12 + (p / 100) * 12);
  return { alpha, blurPx };
}

// ─── OPPORTUNITY MATCHING ───────────────────────────────

/** @typedef {Object} Opportunity
 * @property {string} id
 * @property {string} title
 * @property {string} company
 * @property {string} [location]
 * @property {string} [region] - 'india' | 'global'
 * @property {string} [type] - 'internship' | 'fulltime'
 * @property {string} [applyUrl]
 * @property {string} [source]
 * @property {string[]} [tags]
 * @property {string} [description]
 * @property {number} [postedAtMs]
 */

/** @typedef {import('./opportunities.js').UserProfile} UserProfile */

/**
 * Normalize a phrase into a lowercase token for matching
 * @param {string} str
 * @returns {string}
 */
function normToken(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Score how well an opportunity matches a user profile (0-100).
 * Weights: skills overlap 50, role/interest keywords 20, location 15,
 * degree fit 10, recency 5. Pure function — used in UI and tests.
 * @param {UserProfile|null|undefined} profile
 * @param {Opportunity} opp
 * @returns {{ score: number, matchedSkills: string[] }}
 */
export function scoreOpportunity(profile, opp) {
  const p = profile || {};
  const haystack = normToken([
    opp.title, opp.company, (opp.tags || []).join(' '), opp.description, opp.location
  ].join(' '));

  // 1) Skills overlap — up to 50 (considers at most the first 6 skills)
  const skills = (p.skills || []).map(s => String(s).trim()).filter(Boolean);
  const considered = skills.slice(0, 6);
  const matchedSkills = considered.filter(s => haystack.includes(normToken(s)));
  const skillScore = considered.length > 0
    ? 50 * matchedSkills.length / considered.length
    : 0;

  // 2) Role / interest keywords in the title — up to 20 (first 3 phrases)
  const roles = [...(p.preferredRoles || []), ...(p.interests || [])].map(s => String(s).trim()).filter(Boolean);
  const roleHits = roles.slice(0, 3).filter(r => normToken(opp.title || '').includes(normToken(r)));
  const roleScore = roles.length > 0 ? 20 * roleHits.length / Math.min(roles.length, 3) : 0;

  // 3) Location — up to 15 (7.5 neutral when no preference given)
  const locs = (p.preferredLocations || []).map(s => String(s).trim()).filter(Boolean);
  const oppLoc = normToken(opp.location || '');
  let locationScore = 7.5;
  if (locs.length > 0) {
    const locHit = locs.some(l => {
      const n = normToken(l);
      return oppLoc.includes(n) || (normToken(l) === 'remote' && oppLoc.includes('remote'));
    });
    locationScore = locHit ? 15 : 0;
  }

  // 4) Degree fit — up to 10 (internships suit students graduating soon)
  let degreeScore = 5;
  const gradYear = parseInt(String(p.gradYear || ''), 10);
  const thisYear = new Date().getFullYear();
  if (opp.type === 'internship' && gradYear >= thisYear && gradYear <= thisYear + 2) {
    degreeScore = 10;
  } else if (p.degree && haystack.includes(normToken(String(p.degree)))) {
    degreeScore = 10;
  }

  // 5) Recency — up to 5
  let recencyScore = 0;
  if (opp.postedAtMs) {
    const ageDays = (Date.now() - opp.postedAtMs) / 86400000;
    if (ageDays <= 7) recencyScore = 5;
    else if (ageDays <= 21) recencyScore = 3;
  }

  const score = Math.round(skillScore + roleScore + locationScore + degreeScore + recencyScore);
  return { score: Math.max(0, Math.min(100, score)), matchedSkills };
}

/**
 * Filter and sort opportunities by the active UI filters.
 * @param {Opportunity[]} opportunities
 * @param {{ type: string, region: string, q: string, savedOnly: boolean, sort: string }} filters
 * @param {string[]} [savedIds]
 * @param {UserProfile|null} [profile]
 * @returns {Opportunity[]}
 */
export function filterOpportunities(opportunities, filters, savedIds = [], profile = null) {
  const f = filters || {};
  let list = [...(opportunities || [])];

  if (f.type === 'internship' || f.type === 'fulltime') {
    list = list.filter(o => (o.type || 'fulltime') === f.type);
  }
  if (f.region === 'india' || f.region === 'global') {
    list = list.filter(o => (o.region || 'global') === f.region);
  }
  if (f.savedOnly) {
    list = list.filter(o => savedIds.includes(o.id));
  }
  const q = normToken(f.q || '');
  if (q) {
    list = list.filter(o =>
      normToken(o.title).includes(q) ||
      normToken(o.company).includes(q) ||
      (o.tags || []).some(t => normToken(t).includes(q)) ||
      normToken(o.location).includes(q)
    );
  }

  if (f.sort === 'match' && profile) {
    list.sort((a, b) =>
      scoreOpportunity(profile, b).score - scoreOpportunity(profile, a).score ||
      (b.postedAtMs || 0) - (a.postedAtMs || 0)
    );
  } else {
    list.sort((a, b) => (b.postedAtMs || b.fetchedAtMs || 0) - (a.postedAtMs || a.fetchedAtMs || 0));
  }
  return list;
}

/**
 * Filter with a results guarantee: if the strict filter yields fewer than
 * `minResults` items, progressively widen (drop region → drop type → drop
 * search text) until the target is met. Strict matches always come first;
 * widened ones are returned separately so the UI can label them honestly
 * as "related" instead of pretending they match.
 * @param {Opportunity[]} opportunities
 * @param {{ type: string, region: string, q: string, savedOnly: boolean, sort: string }} filters
 * @param {string[]} [savedIds]
 * @param {UserProfile|null} [profile]
 * @param {number} [minResults]
 * @returns {{ results: Opportunity[], fallbackCount: number, note: string }}
 */
export function filterWithFallback(opportunities, filters, savedIds = [], profile = null, minResults = 7) {
  const f = filters || { type: 'all', region: 'all', q: '', savedOnly: false, sort: 'match' };
  const matches = filterOpportunities(opportunities, f, savedIds, profile);
  if (matches.length >= minResults || opportunities.length === 0) {
    return { results: matches, fallbackCount: 0, note: '' };
  }

  const seen = new Set(matches.map(o => o.id));
  /** @type {Opportunity[]} */
  const fallback = [];

  // Widening ladder, loosest last. savedOnly is never relaxed — a user's
  // bookmark list must stay exact.
  const steps = [
    { ...f, region: 'all' },
    { ...f, region: 'all', type: 'all' },
    { ...f, region: 'all', type: 'all', q: '' },
  ];

  for (const relaxed of steps) {
    const extra = filterOpportunities(opportunities, relaxed, savedIds, profile);
    for (const opp of extra) {
      if (seen.has(opp.id)) continue;
      seen.add(opp.id);
      fallback.push(opp);
      if (matches.length + fallback.length >= minResults) break;
    }
    if (matches.length + fallback.length >= minResults) break;
  }

  const parts = [];
  if (f.region !== 'all') parts.push('other regions');
  if (f.type !== 'all') parts.push('other types');
  if (f.q) parts.push('wider search');
  const note = fallback.length > 0
    ? `Showing related listings from ${parts.length > 0 ? parts.join(' and ') : 'wider filters'}`
    : '';

  return { results: [...matches, ...fallback], fallbackCount: fallback.length, note };
}

/**
 * Format a timestamp (ms epoch, epoch seconds, or Firestore-ish {seconds})
 * as a human "ago" label
 * @param {number|{seconds?: number, toMillis?: Function}|null|undefined} input
 * @returns {string}
 */
export function formatTimeAgo(input) {
  let ms = 0;
  if (typeof input === 'number') ms = input < 1e12 ? input * 1000 : input;
  else if (input && typeof input.toMillis === 'function') ms = input.toMillis();
  else if (input && typeof input.seconds === 'number') ms = input.seconds * 1000;

  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}




