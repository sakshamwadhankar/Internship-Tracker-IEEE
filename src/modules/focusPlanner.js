/**
 * @fileoverview Focus & Accountability Module (YPT-Inspired Engine)
 * Handles focus stopwatch sessions, 10-minute daily planner with unchecked item rollover,
 * streak computation, and multi-scope privacy-aware leaderboard ranking.
 */

/**
 * @typedef {Object} FocusSubject
 * @property {string} id
 * @property {string} ownerUid
 * @property {string} name - e.g. "FYP", "FYP - Backend", "DAA", "Internship prep"
 * @property {string} colorCode - Hex or CSS color
 * @property {boolean} [archived]
 */

/**
 * @typedef {Object} FocusSessionRecord
 * @property {string} id
 * @property {string} uid
 * @property {string} subjectId
 * @property {string} [taskId]
 * @property {string} [teamId]
 * @property {number} startedAtMillis
 * @property {number} endedAtMillis
 * @property {number} durationMin
 * @property {'stopwatch' | 'manual'} mode
 * @property {string} [note]
 */

/**
 * @typedef {Object} DailyTodo
 * @property {string} id
 * @property {string} title
 * @property {string} [subjectId]
 * @property {boolean} done
 * @property {number} [plannedMin]
 */

/**
 * @typedef {Object} DailyPlan
 * @property {string} date - 'YYYY-MM-DD'
 * @property {DailyTodo[]} todos
 * @property {string} [reflection]
 * @property {boolean} reviewed
 * @property {number} [moodRating] - 1 to 5
 */

/**
 * Calculate streak days from consecutive daily reviews
 * @param {DailyPlan[]} dailyPlans - Sorted or unsorted list of plans
 * @param {string} [todayStr] - 'YYYY-MM-DD' anchor date
 * @returns {number}
 */
export function calculateReviewStreak(dailyPlans, todayStr) {
  if (!Array.isArray(dailyPlans) || dailyPlans.length === 0) {
    return 0;
  }

  const reviewedDates = new Set(
    dailyPlans
      .filter(p => p.reviewed && p.date)
      .map(p => p.date)
  );

  let checkDate = todayStr ? new Date(todayStr) : new Date();
  let streak = 0;

  // Format date helper
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayIso = fmt(checkDate);

  // If today is not reviewed yet, check if yesterday was reviewed to preserve active streak
  if (!reviewedDates.has(todayIso)) {
    const yesterday = new Date(checkDate);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!reviewedDates.has(fmt(yesterday))) {
      return 0;
    }
    // Start counting from yesterday
    checkDate = yesterday;
  }

  while (true) {
    const iso = fmt(checkDate);
    if (reviewedDates.has(iso)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Rollover unchecked to-dos from yesterday's daily plan into today's plan
 * @param {DailyPlan} yesterdayPlan
 * @param {DailyPlan} todayPlan
 * @returns {DailyPlan}
 */
export function rolloverUncheckedTodos(yesterdayPlan, todayPlan) {
  if (!yesterdayPlan || !Array.isArray(yesterdayPlan.todos)) {
    return { ...todayPlan };
  }

  const existingTitles = new Set((todayPlan.todos || []).map(t => t.title.toLowerCase().trim()));
  const uncompleted = yesterdayPlan.todos.filter(t => !t.done);

  const rolledOver = [];
  for (const item of uncompleted) {
    if (!existingTitles.has(item.title.toLowerCase().trim())) {
      rolledOver.push({
        id: `rolled_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: item.title,
        subjectId: item.subjectId,
        done: false,
        plannedMin: item.plannedMin
      });
    }
  }

  return {
    ...todayPlan,
    todos: [...(todayPlan.todos || []), ...rolledOver]
  };
}

/**
 * Aggregate focus sessions into leaderboard rankings respecting user privacy
 * @param {Object} params
 * @param {FocusSessionRecord[]} params.sessions
 * @param {Array<{ uid: string, name: string, department?: string, teamId?: string, privacy?: 'public' | 'team' | 'private' }>} params.users
 * @param {'dept' | 'team' | 'subject'} params.scope
 * @param {string} [params.scopeFilterId] - teamId or subjectId if scoped
 * @param {number} [params.startMillis=0] - Filter by time period (daily, weekly, monthly, alltime)
 * @returns {Array<{ rank: number, uid: string, name: string, totalMinutes: number, isAnonymous: boolean }>}
 */
export function computeLeaderboardRankings({
  sessions,
  users,
  scope,
  scopeFilterId,
  startMillis = 0
}) {
  const userMap = new Map(users.map(u => [u.uid, u]));
  const minuteTotals = new Map();

  for (const session of sessions) {
    if (session.endedAtMillis < startMillis) continue;
    if (scope === 'subject' && scopeFilterId && session.subjectId !== scopeFilterId) continue;
    if (scope === 'team' && scopeFilterId && session.teamId !== scopeFilterId) continue;

    const user = userMap.get(session.uid);
    if (!user) continue;

    const current = minuteTotals.get(session.uid) || 0;
    minuteTotals.set(session.uid, current + (session.durationMin || 0));
  }

  /** @type {Array<{ uid: string, totalMinutes: number }>} */
  const rankedList = [];
  for (const [uid, totalMinutes] of minuteTotals.entries()) {
    if (totalMinutes > 0) {
      rankedList.push({ uid, totalMinutes });
    }
  }

  // Sort descending by totalMinutes
  rankedList.sort((a, b) => b.totalMinutes - a.totalMinutes);

  return rankedList.map((entry, index) => {
    const user = userMap.get(entry.uid);
    const privacy = user?.privacy || 'team';

    // Privacy tier handling:
    // If scope is dept and user is private/team-only, anonymize name in public leaderboard
    let displayName = user?.name || 'Anonymous Student';
    let isAnonymous = false;

    if (scope === 'dept' && privacy === 'private') {
      displayName = 'Anonymous Student';
      isAnonymous = true;
    }

    return {
      rank: index + 1,
      uid: entry.uid,
      name: displayName,
      totalMinutes: entry.totalMinutes,
      isAnonymous
    };
  });
}

/**
 * Calculate subject breakdown stats for color-coded donut and charts
 * @param {FocusSessionRecord[]} sessions
 * @param {FocusSubject[]} subjects
 * @returns {Array<{ subjectId: string, name: string, color: string, totalMinutes: number, percent: number }>}
 */
export function calculateSubjectBreakdown(sessions, subjects) {
  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const totals = new Map();
  let totalOverallMin = 0;

  for (const sess of sessions) {
    const mins = sess.durationMin || 0;
    totalOverallMin += mins;
    const current = totals.get(sess.subjectId) || 0;
    totals.set(sess.subjectId, current + mins);
  }

  const results = [];
  for (const [subjectId, totalMinutes] of totals.entries()) {
    const sub = subjectMap.get(subjectId);
    const percent = totalOverallMin > 0 ? Math.round((totalMinutes / totalOverallMin) * 100) : 0;
    results.push({
      subjectId,
      name: sub ? sub.name : 'Other / General',
      color: sub ? sub.colorCode : '#E27227',
      totalMinutes,
      percent
    });
  }

  return results.sort((a, b) => b.totalMinutes - a.totalMinutes);
}
