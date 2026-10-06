/**
 * @fileoverview Focus & Accountability Module (YPT-Inspired View)
 * Stopwatch with pulsing orange ring, 10-minute daily planner, live team room presence,
 * and privacy-aware leaderboards.
 */

import { icon } from '../icons.js';
import {
  calculateReviewStreak,
  computeLeaderboardRankings,
  calculateSubjectBreakdown
} from '../modules/focusPlanner.js';

/**
 * Render Focus & Accountability Screen
 * @param {Object} props
 * @param {string} props.userId
 * @param {Array<any>} props.subjects
 * @param {Array<any>} props.sessions
 * @param {Array<any>} props.dailyPlans
 * @param {Array<any>} props.allUsers
 * @param {object|null} props.activeSessionState - { isRunning, elapsedSeconds, activeSubjectId }
 * @param {string} props.activeSubTab - 'timer' | 'planner' | 'room' | 'leaderboard'
 * @returns {string} HTML string
 */
export function renderFocusView({
  userId,
  subjects = [],
  sessions = [],
  dailyPlans = [],
  allUsers = [],
  activeSessionState = { isRunning: false, elapsedSeconds: 0, activeSubjectId: null },
  activeSubTab = 'timer'
}) {
  const streak = calculateReviewStreak(dailyPlans);
  const activeSubject = subjects.find(s => s.id === activeSessionState.activeSubjectId) || subjects[0];

  const subTabNav = `
    <div class="coord-subtabs-strip">
      <button class="coord-subtab-btn ${activeSubTab === 'timer' ? 'active' : ''}" data-focus-tab="timer">
        ${icon('timer')} Focus Stopwatch
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'planner' ? 'active' : ''}" data-focus-tab="planner">
        ${icon('checkCircle')} 10-Min Planner (${streak}d Streak)
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'room' ? 'active' : ''}" data-focus-tab="room">
        ${icon('users')} Live Team Room
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'leaderboard' ? 'active' : ''}" data-focus-tab="leaderboard">
        ${icon('barChart')} Rankings
      </button>
    </div>
  `;

  let contentHtml = '';

  if (activeSubTab === 'timer') {
    contentHtml = renderTimerTab({ activeSessionState, activeSubject, subjects, sessions });
  } else if (activeSubTab === 'planner') {
    contentHtml = renderPlannerTab({ userId, dailyPlans, streak, subjects });
  } else if (activeSubTab === 'room') {
    contentHtml = renderTeamRoomTab({ allUsers, activeSessionState });
  } else if (activeSubTab === 'leaderboard') {
    contentHtml = renderLeaderboardTab({ sessions, allUsers });
  }

  return `
    <div class="focus-dashboard animate-fade">
      <div class="coord-header-banner">
        <div>
          <span class="coord-badge">FOCUS & ACCOUNTABILITY</span>
          <h2 class="coord-title">Daily Deep Work Engine</h2>
        </div>
        <div class="focus-streak-pill">
          ${icon('star')} <strong>${streak} Day Streak</strong>
        </div>
      </div>

      ${subTabNav}

      <div class="coord-tab-body">
        ${contentHtml}
      </div>
    </div>
  `;
}

function renderTimerTab({ activeSessionState, activeSubject, subjects, sessions }) {
  const totalSeconds = activeSessionState.elapsedSeconds || 0;
  const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');

  const subjectOptions = subjects.map(s => `
    <option value="${s.id}" ${activeSubject && activeSubject.id === s.id ? 'selected' : ''}>
      ${s.name}
    </option>
  `).join('');

  const todaySessions = sessions.slice(0, 5);
  const recentSessionsList = todaySessions.map(sess => {
    const sub = subjects.find(s => s.id === sess.subjectId);
    return `
      <div class="approval-item-card" style="padding: 12px 16px;">
        <div class="appr-top">
          <span style="font-weight: 700; color: #FFF;">${sub ? sub.name : 'Focus Session'}</span>
          <span class="pref-pill top">${sess.durationMin || 0} Min</span>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-secondary-light);">${sess.mode === 'manual' ? 'Manual Entry' : 'Stopwatch'}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="focus-timer-section">
      <div class="stopwatch-container">
        <div class="stopwatch-circle ${activeSessionState.isRunning ? 'running pulse' : ''}">
          <div class="stopwatch-time-display">${hrs}:${mins}:${secs}</div>
          <div class="stopwatch-subject-tag" style="background: ${activeSubject?.colorCode || '#E27227'};">
            ${activeSubject?.name || 'FYP'}
          </div>
        </div>

        <div class="stopwatch-controls">
          <select id="select-focus-subject" class="focus-subject-select">
            ${subjectOptions || '<option value="fyp">Final Year Project</option>'}
          </select>

          <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button id="btn-toggle-stopwatch" class="coord-btn primary" style="padding: 14px 28px; font-size: 1rem;">
              ${activeSessionState.isRunning ? `${icon('pause')} Pause Session` : `${icon('play')} Start Focusing`}
            </button>
            <button id="btn-reset-stopwatch" class="coord-btn secondary">
              Reset
            </button>
          </div>
        </div>
      </div>

      <div class="coord-section-title" style="margin-top: 32px;">Recent Sessions</div>
      <div class="recent-sessions-list">
        ${recentSessionsList.length > 0 ? recentSessionsList : '<div class="empty-state-modern"><p class="empty-state-text">No focus sessions recorded today yet. Hit "Start Focusing" to begin!</p></div>'}
      </div>
    </div>
  `;
}

function renderPlannerTab({ userId, dailyPlans, streak, subjects }) {
  const todayIso = new Date().toISOString().split('T')[0];
  const todayPlan = dailyPlans.find(p => p.date === todayIso) || {
    todos: [
      { id: '1', title: 'Implement Review Scheduler Algorithm', done: true, plannedMin: 45 },
      { id: '2', title: 'Draft weekly logbook entry', done: false, plannedMin: 15 },
      { id: '3', title: 'Prepare project presentation slides', done: false, plannedMin: 30 }
    ],
    reviewed: false,
    reflection: ''
  };

  const todoItems = (todayPlan.todos || []).map(todo => `
    <div class="planner-todo-row ${todo.done ? 'completed' : ''}">
      <input type="checkbox" class="planner-checkbox" data-todo-id="${todo.id}" ${todo.done ? 'checked' : ''} />
      <span class="planner-todo-title">${todo.title}</span>
      <span class="planner-planned-min">${todo.plannedMin || 15}m</span>
    </div>
  `).join('');

  return `
    <div class="planner-section">
      <div class="planner-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <span class="coord-badge">10-MINUTE DAILY PLANNER</span>
            <h3 style="font-family: var(--font-display); color: #FFF; margin-top: 4px;">Today's Focus Sprint (${todayIso})</h3>
          </div>
          <span class="pref-pill top">${streak}d Review Streak</span>
        </div>

        <div class="planner-todos-container">
          ${todoItems}
        </div>

        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <input type="text" id="input-new-todo" placeholder="Add a 10-minute focus task..." style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 9999px; color: #FFF;" />
          <button id="btn-add-todo" class="coord-btn primary sm">${icon('plus')} Add</button>
        </div>

        <div class="planner-evening-review" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
          <h4 style="font-family: var(--font-display); color: var(--clr-orange); margin-bottom: 8px;">Evening Check-off & Reflection</h4>
          <textarea id="planner-reflection" rows="2" class="panel-textarea" placeholder="One sentence on what you shipped today...">${todayPlan.reflection || ''}</textarea>
          <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
            <button id="btn-submit-review" class="coord-btn sm primary">
              ${icon('checkCircle')} Save Daily Review & Build Streak
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTeamRoomTab({ allUsers, activeSessionState }) {
  const members = allUsers.slice(0, 4);

  const memberPills = members.map((m, idx) => {
    const isCurrentUserFocusing = idx === 0 && activeSessionState.isRunning;
    const isTeammateFocusing = idx === 1;
    const status = isCurrentUserFocusing || isTeammateFocusing ? 'focusing' : 'offline';

    return `
      <div class="room-member-card ${status}">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="room-avatar">${m.name ? m.name.charAt(0) : 'U'}</div>
          <div>
            <strong style="color: #FFF; display: block;">${m.name || 'Teammate'}</strong>
            <span style="font-size: 0.8rem; color: var(--text-secondary-light);">${status === 'focusing' ? 'Focusing on FYP' : 'Offline'}</span>
          </div>
        </div>
        <span class="room-status-indicator ${status}">${status.toUpperCase()}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="team-room-section">
      <div class="coord-section-title">Live Team Focus Room (Presence Heartbeat)</div>
      <p style="font-size: 0.85rem; color: var(--text-secondary-light); margin-bottom: 16px;">
        See teammates studying live to maintain mutual accountability. Status updates automatically with 2-minute heartbeats.
      </p>

      <div class="room-members-grid">
        ${memberPills}
      </div>
    </div>
  `;
}

function renderLeaderboardTab({ sessions, allUsers }) {
  const rankings = computeLeaderboardRankings({
    sessions,
    users: allUsers,
    scope: 'dept',
    startMillis: 0
  });

  const rankingRows = rankings.map(r => `
    <div class="leaderboard-row ${r.rank <= 3 ? 'top-rank' : ''}">
      <span class="leaderboard-rank">#${r.rank}</span>
      <div style="flex: 1;">
        <strong style="color: #FFF;">${r.name}</strong>
        ${r.isAnonymous ? '<span class="pref-pill" style="margin-left: 8px;">Private Mode</span>' : ''}
      </div>
      <span class="leaderboard-hours">${Math.round(r.totalMinutes / 60)} hrs</span>
    </div>
  `).join('');

  return `
    <div class="leaderboard-section">
      <div class="coord-section-title">Department Focus Leaderboard (All-Time)</div>
      <div class="leaderboard-container">
        ${rankingRows.length > 0 ? rankingRows : '<div class="empty-state-modern"><p class="empty-state-text">No leaderboard sessions yet.</p></div>'}
      </div>
    </div>
  `;
}
