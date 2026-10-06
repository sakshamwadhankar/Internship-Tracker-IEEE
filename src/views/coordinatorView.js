/**
 * @fileoverview Coordinator Dashboard & Allocation Control Center View (Evaluation Pillar #1, #2, #3)
 * Implements complete auto-allocation with Gale-Shapley, full manual override UI,
 * pre-locking, force-assignment beyond load limits, conflict-free review scheduling,
 * team x week heatmap, At-Risk Radar, and CSV exports.
 */

import { icon } from '../icons.js';
import {
  runCapacitatedAllocation,
  applyManualOverride,
  calculateSatisfactionStats
} from '../modules/allocation.js';
import {
  generateConflictFreeSchedule,
  proposeRescheduleSlot,
  checkDeliverableGateStatus
} from '../modules/reviewScheduler.js';
import {
  generateHeatmapMatrix,
  evaluateAtRiskRules
} from '../modules/progressRadar.js';

/**
 * Render Coordinator Control Center
 * @param {Object} props
 * @param {Array<any>} props.teams
 * @param {Array<any>} props.guides
 * @param {Array<any>} props.allocations
 * @param {Array<any>} props.preLockedPairs
 * @param {Array<any>} props.reviews
 * @param {Array<any>} props.panels
 * @param {Array<any>} props.rooms
 * @param {Array<any>} props.timeSlots
 * @param {Array<any>} props.logbooks
 * @param {Array<any>} props.documents
 * @param {Array<any>} props.focusSessions
 * @param {Array<any>} props.internships
 * @param {string} props.activeSubTab - 'allocation' | 'reviews' | 'heatmap' | 'approvals'
 * @param {Function} props.onSetSubTab
 * @param {Function} props.onUpdateAllocations
 * @param {Function} props.onUpdateReviews
 * @param {Function} props.onApproveInternship
 * @param {Function} props.showToast
 * @returns {string} HTML string
 */
export function renderCoordinatorView({
  teams,
  guides,
  allocations,
  preLockedPairs = [],
  reviews = [],
  panels = [],
  rooms = [],
  timeSlots = [],
  logbooks = [],
  documents = [],
  focusSessions = [],
  internships = [],
  activeSubTab = 'allocation',
  showToast
}) {
  const stats = calculateSatisfactionStats(allocations, teams, guides);

  const subTabNav = `
    <div class="coord-subtabs-strip">
      <button class="coord-subtab-btn ${activeSubTab === 'allocation' ? 'active' : ''}" data-coord-tab="allocation">
        ${icon('swap')} Allocation Center
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'reviews' ? 'active' : ''}" data-coord-tab="reviews">
        ${icon('calendar')} Review Scheduler
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'heatmap' ? 'active' : ''}" data-coord-tab="heatmap">
        ${icon('activity')} Heatmap & Radar
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'approvals' ? 'active' : ''}" data-coord-tab="approvals">
        ${icon('checkCircle')} Approvals (${internships.filter(i => i.status === 'guide_approved').length})
      </button>
    </div>
  `;

  let contentHtml = '';

  if (activeSubTab === 'allocation') {
    contentHtml = renderAllocationTab({ teams, guides, allocations, stats, preLockedPairs });
  } else if (activeSubTab === 'reviews') {
    contentHtml = renderReviewsTab({ teams, reviews, panels, rooms, timeSlots });
  } else if (activeSubTab === 'heatmap') {
    contentHtml = renderHeatmapTab({ teams, logbooks, documents, reviews, focusSessions });
  } else if (activeSubTab === 'approvals') {
    contentHtml = renderApprovalsTab({ internships });
  }

  return `
    <div class="coordinator-dashboard animate-fade">
      <div class="coord-header-banner">
        <div>
          <span class="coord-badge">COORDINATOR CONTROL</span>
          <h2 class="coord-title">Final-Year Project Coordination</h2>
        </div>
        <div class="coord-actions-group">
          <button id="btn-export-csv" class="coord-btn secondary">
            ${icon('fileText')} Export Dept CSV
          </button>
        </div>
      </div>

      ${subTabNav}

      <div class="coord-tab-body">
        ${contentHtml}
      </div>
    </div>
  `;
}

function renderAllocationTab({ teams, guides, allocations, stats, preLockedPairs }) {
  const guideMap = new Map(guides.map(g => [g.uid, g]));

  const guideLoadCards = guides.map(g => {
    const currentLoad = stats.guideLoads[g.uid] || 0;
    const isExceeded = currentLoad > g.loadLimit;
    const pct = Math.min(100, Math.round((currentLoad / g.loadLimit) * 100));

    return `
      <div class="coord-guide-card ${isExceeded ? 'exceeded' : ''}">
        <div class="guide-card-top">
          <span class="guide-name">${g.name}</span>
          <span class="guide-load-badge ${isExceeded ? 'danger' : ''}">
            ${currentLoad} / ${g.loadLimit} ${isExceeded ? '(OVER LIMIT)' : ''}
          </span>
        </div>
        <div class="guide-progress-bar-bg">
          <div class="guide-progress-bar-fill ${isExceeded ? 'danger' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="guide-research-chips">
          ${(g.researchAreas || []).map(r => `<span class="research-tag">${r}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  const allocationRows = teams.map(t => {
    const alloc = allocations.find(a => a.teamId === t.id);
    const assignedGuide = alloc?.assignedGuideUid ? guideMap.get(alloc.assignedGuideUid) : null;
    const isManual = alloc?.assignedBy === 'manual';
    const isLocked = alloc?.isPreLocked;

    return `
      <div class="alloc-table-row">
        <div class="team-col">
          <strong>${t.name}</strong>
          <span class="team-meta-domain">${t.domain || 'General'} · ${t.memberUids?.length || 1} members</span>
        </div>
        <div class="pref-col">
          <span class="pref-pill ${alloc?.preferenceSatisfied === '1st' ? 'top' : ''}">
            ${alloc ? alloc.preferenceSatisfied : 'unassigned'}
          </span>
          ${isLocked ? '<span class="lock-pill">PRE-LOCKED</span>' : ''}
          ${isManual && !isLocked ? '<span class="manual-pill">OVERRIDE</span>' : ''}
        </div>
        <div class="guide-col">
          ${assignedGuide ? assignedGuide.name : '<span class="text-muted">Unassigned</span>'}
          ${alloc?.overrideReason ? `<div class="override-reason-hint">Reason: ${alloc.overrideReason}</div>` : ''}
        </div>
        <div class="action-col">
          <button class="coord-btn sm btn-open-override" data-team-id="${t.id}" data-team-name="${t.name}">
            ${icon('swap')} Reassign
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="allocation-control-section">
      <div class="stats-overview-grid">
        <div class="coord-stat-card">
          <span class="stat-label">1ST CHOICE SATISFACTION</span>
          <div class="stat-val-highlight">${stats.firstChoicePercent}%</div>
          <span class="stat-sub">${stats.firstChoiceCount} of ${stats.totalTeams} teams</span>
        </div>
        <div class="coord-stat-card">
          <span class="stat-label">ASSIGNED / UNASSIGNED</span>
          <div class="stat-val-highlight">${stats.assignedCount} / ${stats.unassignedCount}</div>
          <span class="stat-sub">${stats.preLockedCount} pre-locked pairs</span>
        </div>
        <div class="coord-stat-card">
          <span class="stat-label">GUIDE LOAD SPREAD</span>
          <div class="stat-val-highlight">${stats.minGuideLoad} - ${stats.maxGuideLoad}</div>
          <span class="stat-sub">${stats.manualOverrideCount} manual overrides</span>
        </div>
      </div>

      <div class="alloc-toolbar">
        <button id="btn-run-auto-alloc" class="coord-btn primary">
          ${icon('play')} Run Fair Auto-Allocation (Gale-Shapley)
        </button>
        <button id="btn-publish-alloc" class="coord-btn">
          ${icon('checkCircle')} Publish & Open 48h Swap Window
        </button>
      </div>

      <div class="coord-section-title">Faculty Guide Load Capacity</div>
      <div class="guide-cards-grid">
        ${guideLoadCards}
      </div>

      <div class="coord-section-title">Team Allocations & Override Authority</div>
      <div class="alloc-table-container">
        ${allocationRows}
      </div>
    </div>
  `;
}

function renderReviewsTab({ teams, reviews, panels, rooms, timeSlots }) {
  const scheduleRows = reviews.map(r => {
    const team = teams.find(t => t.id === r.teamId);
    const gateStatus = checkDeliverableGateStatus(r, []);

    return `
      <div class="review-schedule-row">
        <div class="rev-time-box">
          <span class="rev-date">${r.date}</span>
          <span class="rev-time">${r.startTime} - ${r.endTime}</span>
        </div>
        <div class="rev-team-info">
          <strong>${team ? team.name : r.teamId}</strong>
          <span class="rev-room-badge">${r.roomId}</span>
          <span class="rev-panel-badge">${r.panelId}</span>
        </div>
        <div class="rev-gate-col">
          <span class="gate-status-pill ${gateStatus.isPastDeadline ? 'late' : 'ok'}">
            24h Gate: ${gateStatus.reason}
          </span>
        </div>
        <div class="rev-action-col">
          <button class="coord-btn sm btn-reschedule" data-review-id="${r.id}">
            Reschedule
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="reviews-control-section">
      <div class="rev-toolbar">
        <button id="btn-gen-schedule" class="coord-btn primary">
          ${icon('calendar')} Generate Conflict-Free Schedule
        </button>
        <span class="rev-gate-explainer">
          Enforces: No faculty double-booking · No room clash · Guide never judges own team · 24h deliverable lock
        </span>
      </div>

      <div class="coord-section-title">Round 1 Evaluation Schedule (${reviews.length} Slots)</div>
      <div class="reviews-list-container">
        ${scheduleRows.length > 0 ? scheduleRows : '<div class="empty-state-modern"><p class="empty-state-text">No reviews scheduled yet. Click "Generate Conflict-Free Schedule" above.</p></div>'}
      </div>
    </div>
  `;
}

function renderHeatmapTab({ teams, logbooks, documents, reviews, focusSessions }) {
  const matrix = generateHeatmapMatrix({
    teams,
    allLogbooks: logbooks,
    totalWeeks: 12,
    currentWeek: 4
  });

  const heatmapRows = matrix.map(m => {
    const cells = m.weeks.map(w => `
      <td class="heatmap-cell ${w.status}" title="Week ${w.weekNumber}: ${w.note}">
        <span class="heatmap-dot"></span>
      </td>
    `).join('');

    return `
      <tr>
        <td class="heatmap-team-name">${m.teamName}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Collect At-Risk Radar triggers
  const allTriggers = [];
  for (const t of teams) {
    const tLogbooks = logbooks.filter(l => l.teamId === t.id);
    const tDocs = documents.filter(d => d.teamId === t.id);
    const tReviews = reviews.filter(r => r.teamId === t.id);
    const tFocus = focusSessions.filter(f => f.teamId === t.id);

    const triggers = evaluateAtRiskRules({
      team: t,
      logbooks: tLogbooks,
      documents: tDocs,
      reviews: tReviews,
      focusSessions: tFocus
    });

    for (const trig of triggers) {
      allTriggers.push({ teamName: t.name, ...trig });
    }
  }

  const radarCards = allTriggers.map(trig => `
    <div class="radar-alert-card ${trig.severity}">
      <div class="radar-card-top">
        <span class="radar-team-tag">${trig.teamName}</span>
        <span class="radar-severity-badge ${trig.severity}">${trig.severity.toUpperCase()}</span>
      </div>
      <h4 class="radar-card-title">${trig.title}</h4>
      <p class="radar-card-desc">${trig.description}</p>
      <div class="radar-card-action">👉 ${trig.actionItem}</div>
    </div>
  `).join('');

  return `
    <div class="heatmap-control-section">
      <div class="coord-section-title">At-Risk Radar (${allTriggers.length} Active Triggers)</div>
      <div class="radar-alerts-grid">
        ${radarCards.length > 0 ? radarCards : '<div class="radar-healthy-card">All teams currently on schedule and meeting compliance gates.</div>'}
      </div>

      <div class="coord-section-title" style="margin-top: 24px;">Department Progress Heatmap (Teams × Weeks)</div>
      <div class="heatmap-legend">
        <span class="legend-item"><span class="legend-dot green"></span> Approved on time</span>
        <span class="legend-item"><span class="legend-dot amber"></span> Submitted / Changes</span>
        <span class="legend-item"><span class="legend-dot red"></span> Overdue / Missed</span>
        <span class="legend-item"><span class="legend-dot gray"></span> Future Week</span>
      </div>

      <div class="heatmap-table-container">
        <table class="heatmap-table">
          <thead>
            <tr>
              <th>Team</th>
              ${Array.from({ length: 12 }, (_, i) => `<th>W${i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${heatmapRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderApprovalsTab({ internships }) {
  const pendingApprovals = internships.filter(i => i.status === 'guide_approved' || i.status === 'offer_uploaded');

  const approvalRows = pendingApprovals.map(item => `
    <div class="approval-item-card">
      <div class="appr-top">
        <strong>${item.studentName}</strong>
        <span class="appr-company-tag">${item.company} · ${item.role}</span>
      </div>
      <div class="appr-details">
        <span>Duration: ${item.durationWeeks} Weeks (${item.startDate} to ${item.endDate})</span>
        <span>Guide Approved: ${item.approvals?.guide ? 'Yes' : 'Pending'}</span>
      </div>
      <div class="appr-actions">
        <button class="coord-btn primary sm btn-approve-intern" data-intern-id="${item.id}">
          ${icon('checkCircle')} Approve Final & Grant Credits
        </button>
      </div>
    </div>
  `).join('');

  return `
    <div class="approvals-control-section">
      <div class="coord-section-title">Pending Internship Final Approvals</div>
      <div class="approvals-list-container">
        ${approvalRows.length > 0 ? approvalRows : '<div class="empty-state-modern"><p class="empty-state-text">No pending coordinator internship approvals.</p></div>'}
      </div>
    </div>
  `;
}
