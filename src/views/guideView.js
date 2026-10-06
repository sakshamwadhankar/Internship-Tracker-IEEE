/**
 * @fileoverview Guide / Faculty Mentor View
 * My Teams dashboard, logbook review queue, document review, and internship approval.
 */

import { icon } from '../icons.js';

/**
 * Render Guide Dashboard
 * @param {Object} props
 * @param {string} props.guideUid
 * @param {Array<any>} props.teams
 * @param {Array<any>} props.allocations
 * @param {Array<any>} props.logbooks
 * @param {Array<any>} props.documents
 * @param {Array<any>} props.internships
 * @param {Array<any>} props.focusSessions
 * @param {string} props.activeSubTab - 'teams' | 'logbooks' | 'documents' | 'internships'
 * @returns {string} HTML string
 */
export function renderGuideView({
  guideUid,
  teams,
  allocations,
  logbooks,
  documents,
  internships,
  focusSessions,
  activeSubTab = 'teams'
}) {
  const myAssignedTeamIds = new Set(
    allocations
      .filter(a => a.assignedGuideUid === guideUid)
      .map(a => a.teamId)
  );

  const myTeams = teams.filter(t => myAssignedTeamIds.has(t.id));
  const pendingLogbooks = logbooks.filter(l => myAssignedTeamIds.has(l.teamId) && l.status === 'submitted');
  const pendingDocs = documents.filter(d => myAssignedTeamIds.has(d.teamId) && d.status === 'pending');
  const pendingInternships = internships.filter(i => i.status === 'offer_uploaded' || i.status === 'applied');

  const subTabNav = `
    <div class="coord-subtabs-strip">
      <button class="coord-subtab-btn ${activeSubTab === 'teams' ? 'active' : ''}" data-guide-tab="teams">
        ${icon('users')} My Teams (${myTeams.length})
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'logbooks' ? 'active' : ''}" data-guide-tab="logbooks">
        ${icon('fileText')} Logbooks (${pendingLogbooks.length})
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'documents' ? 'active' : ''}" data-guide-tab="documents">
        ${icon('fileText')} Documents (${pendingDocs.length})
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'internships' ? 'active' : ''}" data-guide-tab="internships">
        ${icon('briefcase')} Internships (${pendingInternships.length})
      </button>
    </div>
  `;

  let contentHtml = '';

  if (activeSubTab === 'teams') {
    contentHtml = renderGuideTeamsTab({ myTeams, logbooks, focusSessions });
  } else if (activeSubTab === 'logbooks') {
    contentHtml = renderGuideLogbooksTab({ pendingLogbooks, myTeams });
  } else if (activeSubTab === 'documents') {
    contentHtml = renderGuideDocsTab({ pendingDocs, myTeams });
  } else if (activeSubTab === 'internships') {
    contentHtml = renderGuideInternshipsTab({ pendingInternships });
  }

  return `
    <div class="guide-dashboard animate-fade">
      <div class="coord-header-banner">
        <div>
          <span class="coord-badge">FACULTY MENTOR DASHBOARD</span>
          <h2 class="coord-title">Mentorship & Project Guidance</h2>
        </div>
      </div>

      ${subTabNav}

      <div class="coord-tab-body">
        ${contentHtml}
      </div>
    </div>
  `;
}

function renderGuideTeamsTab({ myTeams, logbooks, focusSessions }) {
  if (myTeams.length === 0) {
    return `
      <div class="empty-state-modern">
        <p class="empty-state-title">No Teams Allocated Yet</p>
        <p class="empty-state-text">Once the coordinator completes and publishes allocation, your mentees will appear here.</p>
      </div>
    `;
  }

  const teamCards = myTeams.map(t => {
    const tLogs = logbooks.filter(l => l.teamId === t.id);
    const approvedCount = tLogs.filter(l => l.status === 'approved').length;
    const tFocus = focusSessions.filter(f => f.teamId === t.id);
    const totalFocusMin = tFocus.reduce((acc, s) => acc + (s.durationMin || 0), 0);

    return `
      <div class="coord-guide-card">
        <div class="guide-card-top">
          <strong style="font-size: 1.1rem; color: #FFF;">${t.name}</strong>
          <span class="pref-pill top">${t.domain || 'Engineering'}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary-light); margin: 8px 0;">
          ${t.memberUids?.length || 1} Mentees · Progress: ${approvedCount} Logbooks Approved
        </p>
        <div class="stat-sub" style="color: var(--clr-orange);">
          ${Math.round(totalFocusMin / 60)} Focus Hours Logged by Team
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="guide-cards-grid">
      ${teamCards}
    </div>
  `;
}

function renderGuideLogbooksTab({ pendingLogbooks, myTeams }) {
  if (pendingLogbooks.length === 0) {
    return '<div class="empty-state-modern"><p class="empty-state-text">All weekly logbook entries are up to date and reviewed!</p></div>';
  }

  const teamMap = new Map(myTeams.map(t => [t.id, t]));

  return pendingLogbooks.map(l => {
    const team = teamMap.get(l.teamId);
    return `
      <div class="approval-item-card">
        <div class="appr-top">
          <strong>${team ? team.name : l.teamId} — Week ${l.weekNumber}</strong>
          <span class="pref-pill">${l.hoursSpent || 0} Hours Logged</span>
        </div>
        <div style="font-size: 0.88rem; color: #F4F5EE; margin: 8px 0;">
          <strong>Work Done:</strong> ${l.workDone || 'Weekly deliverables sprint'}
        </div>
        ${l.blockers ? `<div style="font-size: 0.82rem; color: var(--clr-danger);"><strong>Blockers:</strong> ${l.blockers}</div>` : ''}
        <div class="appr-actions" style="margin-top: 12px;">
          <input type="text" class="input-remarks" placeholder="Enter guide remarks..." id="remarks-${l.id}" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 9999px; color: #FFF; width: 60%;" />
          <button class="coord-btn primary sm btn-approve-logbook" data-log-id="${l.id}">Approve</button>
          <button class="coord-btn sm btn-request-changes-logbook" data-log-id="${l.id}">Request Changes</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderGuideDocsTab({ pendingDocs, myTeams }) {
  if (pendingDocs.length === 0) {
    return '<div class="empty-state-modern"><p class="empty-state-text">No milestone documents pending review.</p></div>';
  }

  const teamMap = new Map(myTeams.map(t => [t.id, t]));

  return pendingDocs.map(d => {
    const team = teamMap.get(d.teamId);
    return `
      <div class="approval-item-card">
        <div class="appr-top">
          <strong>${team ? team.name : d.teamId}</strong>
          <span class="pref-pill top">${d.type} (v${d.version || 1})</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary-light); margin: 6px 0;">
          File: ${d.fileName || 'milestone_deliverable.pdf'}
        </div>
        <div class="appr-actions">
          <button class="coord-btn primary sm btn-approve-doc" data-doc-id="${d.id}">Approve Document</button>
          <button class="coord-btn sm btn-changes-doc" data-doc-id="${d.id}">Request Revision</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderGuideInternshipsTab({ pendingInternships }) {
  if (pendingInternships.length === 0) {
    return '<div class="empty-state-modern"><p class="empty-state-text">No student internship verification requests pending.</p></div>';
  }

  return pendingInternships.map(item => `
    <div class="approval-item-card">
      <div class="appr-top">
        <strong>${item.studentName}</strong>
        <span class="pref-pill top">${item.company}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-secondary-light); margin: 6px 0;">
        Role: ${item.role} · Duration: ${item.durationWeeks} Weeks (${item.startDate} to ${item.endDate})
      </div>
      <div class="appr-actions">
        <button class="coord-btn primary sm btn-guide-approve-intern" data-intern-id="${item.id}">
          Verify & Recommend to Coordinator
        </button>
      </div>
    </div>
  `).join('');
}
