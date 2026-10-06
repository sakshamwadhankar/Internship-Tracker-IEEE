/**
 * @fileoverview Student Project Journey View (PTracker Core Hub)
 * Team formation, guide preference ranking, milestone document pipeline,
 * weekly logbook submission, and internship tracking.
 */

import { icon } from '../icons.js';

/**
 * Render Journey Screen
 * @param {Object} props
 * @param {object|null} props.myTeam
 * @param {Array<any>} props.guides
 * @param {Array<any>} props.allocations
 * @param {Array<any>} props.logbooks
 * @param {Array<any>} props.documents
 * @param {Array<any>} props.internships
 * @param {string} props.activeSubTab - 'hub' | 'logbook' | 'docs' | 'internship' | 'prefs'
 * @returns {string} HTML string
 */
export function renderJourneyView({
  myTeam,
  guides = [],
  allocations = [],
  logbooks = [],
  documents = [],
  internships = [],
  activeSubTab = 'hub',
  allUsers = [],
  friends = [],
  currentUser = null,
  codingProfiles = {},
  codingProfilesMap = {},
  livePresence = {}
}) {
  const teamAlloc = myTeam ? allocations.find(a => a.teamId === myTeam.id) : null;
  const assignedGuide = teamAlloc?.assignedGuideUid ? guides.find(g => g.uid === teamAlloc.assignedGuideUid) : null;

  const subTabNav = `
    <div class="coord-subtabs-strip">
      <button class="coord-subtab-btn ${activeSubTab === 'hub' ? 'active' : ''}" data-journey-tab="hub">
        ${icon('users')} Project Hub
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'friends' ? 'active' : ''}" data-journey-tab="friends">
        ${icon('users')} Friends (${friends.length})
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'prefs' ? 'active' : ''}" data-journey-tab="prefs">
        ${icon('swap')} Guide Prefs
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'logbook' ? 'active' : ''}" data-journey-tab="logbook">
        ${icon('fileText')} Logbook
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'docs' ? 'active' : ''}" data-journey-tab="docs">
        ${icon('fileText')} Documents
      </button>
      <button class="coord-subtab-btn ${activeSubTab === 'internship' ? 'active' : ''}" data-journey-tab="internship">
        ${icon('briefcase')} Internship
      </button>
    </div>
  `;

  let contentHtml = '';

  if (activeSubTab === 'hub') {
    contentHtml = renderHubTab({
      myTeam,
      assignedGuide,
      teamAlloc,
      allUsers,
      currentUser,
      codingProfiles,
      codingProfilesMap,
      livePresence
    });
  } else if (activeSubTab === 'friends') {
    contentHtml = renderFriendsTab({
      friends,
      allUsers,
      currentUserId: currentUser?.uid || 'guest',
      codingProfilesMap,
      livePresence
    });
  } else if (activeSubTab === 'prefs') {
    contentHtml = renderPrefsTab({ guides, teamAlloc });
  } else if (activeSubTab === 'logbook') {
    contentHtml = renderLogbookTab({ logbooks, myTeam });
  } else if (activeSubTab === 'docs') {
    contentHtml = renderDocsTab({ documents, myTeam });
  } else if (activeSubTab === 'internship') {
    contentHtml = renderInternshipTab({ internships });
  }

  return `
    <div class="journey-dashboard animate-fade">
      <div class="coord-header-banner">
        <div>
          <span class="coord-badge">PROJECT JOURNEY</span>
          <h2 class="coord-title">${myTeam ? myTeam.name : 'Final-Year Project'}</h2>
        </div>
      </div>

      ${subTabNav}

      <div class="coord-tab-body">
        ${contentHtml}
      </div>
    </div>
  `;
}

function renderHubTab({
  myTeam,
  assignedGuide,
  teamAlloc,
  allUsers = [],
  currentUser = null,
  codingProfiles = {},
  codingProfilesMap = {},
  livePresence = {}
}) {
  if (!myTeam) {
    return `
      <div class="approval-item-card">
        <h3 style="font-family: var(--font-display); color: #FFF; margin-bottom: 8px;">Create or Join a Project Team</h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary-light); margin-bottom: 16px;">
          Form a team to start submitting guide preferences, weekly logbooks, and milestone deliverables.
        </p>
        <div style="display: flex; gap: 12px;">
          <input type="text" id="input-team-name" placeholder="Enter Team Name..." style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 9999px; color: #FFF;" />
          <button id="btn-create-team" class="coord-btn primary sm">${icon('plus')} Create Team</button>
        </div>
      </div>
    `;
  }

  // Teammates list
  const memberUids = myTeam.memberUids || ['m1'];
  const teamMembers = memberUids.map(uid => {
    if (currentUser && uid === currentUser.uid) {
      return { uid, name: currentUser.displayName || 'You', isCurrent: true };
    }
    const found = allUsers.find(u => u.uid === uid);
    return found || { uid, name: `Student (${uid})` };
  });

  const memberCardsHtml = teamMembers.map(m => {
    const isCurrent = m.isCurrent || (currentUser && m.uid === currentUser.uid);
    const prof = isCurrent ? codingProfiles : (codingProfilesMap[m.uid] || {});
    const presence = livePresence[m.uid] || {};

    return `
      <div class="approval-item-card" style="margin-bottom: 12px; background: rgba(255,255,255,0.03);">
        <div class="appr-top" style="align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="room-avatar" style="width: 34px; height: 34px; font-size: 0.8rem;">
              ${m.name.charAt(0)}
            </div>
            <div>
              <strong style="color: #FFF; font-size: 0.95rem;">${m.name}</strong>
              ${isCurrent ? '<span class="pref-pill top" style="font-size: 0.65rem; margin-left: 6px;">You</span>' : ''}
              <div style="font-size: 0.75rem; color: var(--text-secondary-light);">
                ${presence.isRunning ? '<span style="color: #2CD674;">● Focusing Now</span>' : 'Idle'}
              </div>
            </div>
          </div>
        </div>

        <!-- Teammate Connected Profiles Badges -->
        <div class="room-coding-badges" style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
          ${prof.githubStats ? `
            <a href="${prof.githubStats.profileUrl}" target="_blank" rel="noopener" class="platform-chip gh" title="${prof.githubStats.publicRepos} GitHub Repos">
              ${icon('github')} <span>${prof.githubStats.publicRepos} repos · ${prof.githubStats.followers} flw</span>
            </a>
          ` : (prof.github ? `<span class="platform-chip gh">${icon('github')} <span>@${prof.github}</span></span>` : '<span style="font-size: 0.72rem; color: var(--text-secondary-light); opacity: 0.6;">No GitHub connected</span>')}

          ${prof.leetcodeStats ? `
            <a href="${prof.leetcodeStats.profileUrl}" target="_blank" rel="noopener" class="platform-chip lc" title="${prof.leetcodeStats.totalSolved} Solved">
              ${icon('leetcode')} <span>${prof.leetcodeStats.totalSolved} solved (${prof.leetcodeStats.mediumSolved} med)</span>
            </a>
          ` : (prof.leetcode ? `<span class="platform-chip lc">${icon('leetcode')} <span>@${prof.leetcode}</span></span>` : '')}

          ${prof.hackerrankStats ? `
            <a href="${prof.hackerrankStats.profileUrl}" target="_blank" rel="noopener" class="platform-chip hr" title="${prof.hackerrankStats.totalStars} Stars">
              ${icon('hackerrank')} <span>${prof.hackerrankStats.totalStars}★ (${prof.hackerrankStats.badgesCount} badges)</span>
            </a>
          ` : (prof.hackerrank ? `<span class="platform-chip hr">${icon('hackerrank')} <span>@${prof.hackerrank}</span></span>` : '')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="hub-tab-section">
      <!-- Team Card -->
      <div class="coord-guide-card" style="margin-bottom: 20px;">
        <div class="guide-card-top">
          <span class="guide-name">${myTeam.name}</span>
          <span class="pref-pill top">Invite Code: ${myTeam.inviteCode || 'PTRK26'}</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-secondary-light); margin: 8px 0;">
          Status: <strong>${myTeam.status?.toUpperCase() || 'FORMING'}</strong> · Domain: ${myTeam.domain || 'Software Engineering'}
        </p>
        <div class="stat-sub" style="color: #FFF; margin-top: 12px;">
          Assigned Guide: <strong>${assignedGuide ? assignedGuide.name : 'Allocation in progress by Coordinator'}</strong>
        </div>
        ${teamAlloc?.preferenceSatisfied ? `
          <div style="margin-top: 6px; font-size: 0.82rem; color: var(--clr-orange);">
            Preference Satisfied: ${teamAlloc.preferenceSatisfied} Choice
          </div>
        ` : ''}
      </div>

      <!-- Teammates & Coding Badges -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div class="coord-section-title" style="margin: 0;">Teammates & Coding Activity</div>
        <button id="btn-open-coding-modal" class="coord-btn primary sm">
          ${icon('github')} Connect My Coding Profiles
        </button>
      </div>

      <div class="team-members-list" style="margin-bottom: 24px;">
        ${memberCardsHtml}
      </div>
    </div>
  `;
}

function renderFriendsTab({
  friends = [],
  allUsers = [],
  currentUserId,
  codingProfilesMap = {},
  livePresence = {}
}) {
  const friendCards = friends.map(f => {
    const presence = livePresence[f.id] || {};
    const isFocusing = Boolean(presence.isRunning);
    const coding = codingProfilesMap[f.id] || f.codingProfiles || {};

    return `
      <div class="approval-item-card" style="margin-bottom: 12px;">
        <div class="appr-top" style="align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="room-avatar" style="${isFocusing ? 'border: 2px solid #2CD674;' : ''}">
              ${f.name.charAt(0)}
            </div>
            <div>
              <strong style="color: #FFF; font-size: 1rem;">${f.name}</strong>
              <div style="font-size: 0.78rem; color: var(--text-secondary-light); margin-top: 2px;">
                ${f.email || ''} ${f.teamName ? `· ${f.teamName}` : ''}
              </div>
              <div style="margin-top: 4px; font-size: 0.8rem;">
                ${isFocusing ? `
                  <span style="color: #2CD674; font-weight: 700;">● Focusing on ${presence.subjectName || 'Studies'}</span>
                ` : `
                  <span style="color: var(--text-secondary-light);">Idle</span>
                `}
              </div>
            </div>
          </div>

          <button class="coord-btn secondary sm btn-remove-friend" data-friend-id="${f.id}" title="Remove Friend">
            ${icon('trash')} Remove
          </button>
        </div>

        <!-- Friend Coding Badges -->
        <div class="room-coding-badges" style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
          ${coding.githubStats ? `
            <a href="${coding.githubStats.profileUrl}" target="_blank" rel="noopener" class="platform-chip gh" title="${coding.githubStats.publicRepos} GitHub Repos">
              ${icon('github')} <span>${coding.githubStats.publicRepos} repos</span>
            </a>
          ` : (coding.github ? `<span class="platform-chip gh">${icon('github')} <span>@${coding.github}</span></span>` : '')}

          ${coding.leetcodeStats ? `
            <a href="${coding.leetcodeStats.profileUrl}" target="_blank" rel="noopener" class="platform-chip lc" title="${coding.leetcodeStats.totalSolved} Solved">
              ${icon('leetcode')} <span>${coding.leetcodeStats.totalSolved} solved</span>
            </a>
          ` : (coding.leetcode ? `<span class="platform-chip lc">${icon('leetcode')} <span>@${coding.leetcode}</span></span>` : '')}

          ${coding.hackerrankStats ? `
            <a href="${coding.hackerrankStats.profileUrl}" target="_blank" rel="noopener" class="platform-chip hr" title="${coding.hackerrankStats.totalStars} Stars">
              ${icon('hackerrank')} <span>${coding.hackerrankStats.totalStars}★</span>
            </a>
          ` : (coding.hackerrank ? `<span class="platform-chip hr">${icon('hackerrank')} <span>@${coding.hackerrank}</span></span>` : '')}
        </div>
      </div>
    `;
  }).join('');

  // Find candidate peers to add
  const friendIds = new Set(friends.map(f => f.id));
  const candidateStudents = allUsers.filter(u => u.uid !== currentUserId && !friendIds.has(u.uid));

  const candidatesHtml = candidateStudents.map(c => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="room-avatar" style="width: 28px; height: 28px; font-size: 0.75rem;">
          ${c.name.charAt(0)}
        </div>
        <div>
          <strong style="color: #FFF; font-size: 0.88rem;">${c.name}</strong>
          <span style="font-size: 0.75rem; color: var(--text-secondary-light); margin-left: 6px;">(Team ${c.teamId || 'Open'})</span>
        </div>
      </div>
      <button class="coord-btn primary sm btn-add-candidate" data-student-id="${c.uid}" data-student-name="${c.name}">
        ${icon('plus')} Add
      </button>
    </div>
  `).join('');

  return `
    <div class="friends-tab-section">
      <!-- Add Friend Box -->
      <div class="approval-item-card" style="margin-bottom: 20px;">
        <h3 style="font-family: var(--font-display); color: #FFF; margin-bottom: 6px;">Add a Student Peer</h3>
        <p style="font-size: 0.84rem; color: var(--text-secondary-light); margin-bottom: 14px;">
          Connect with friends across teams to track mutual live focus sessions and coding achievements.
        </p>

        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
          <input type="text" id="input-friend-search" placeholder="Enter student name or email..." style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 9999px; color: #FFF; font-size: 0.88rem;" />
          <button id="btn-submit-add-friend" class="coord-btn primary sm">${icon('plus')} Add Friend</button>
        </div>

        ${candidateStudents.length > 0 ? `
          <div style="margin-top: 10px;">
            <span style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-secondary-light); letter-spacing: 0.05em; display: block; margin-bottom: 8px;">
              Suggested Peers
            </span>
            ${candidatesHtml}
          </div>
        ` : ''}
      </div>

      <!-- Friends List -->
      <div class="coord-section-title">My Friends (${friends.length})</div>
      <div class="friends-list-container">
        ${friends.length > 0 ? friendCards : `
          <div class="empty-state-modern">
            <p class="empty-state-title">No Friends Added Yet</p>
            <p class="empty-state-text">Add peers from your department to share live study timers and compare coding milestones.</p>
          </div>
        `}
      </div>
    </div>
  `;
}


function renderPrefsTab({ guides, teamAlloc }) {
  const guideRows = guides.map((g, idx) => `
    <div class="alloc-table-row">
      <div class="team-col">
        <strong>${g.name}</strong>
        <span class="team-meta-domain">${(g.researchAreas || []).join(', ')}</span>
      </div>
      <div class="pref-col">
        <span class="pref-pill ${idx === 0 ? 'top' : ''}">Choice #${idx + 1}</span>
      </div>
      <div class="guide-col">
        Capacity Limit: ${g.loadLimit} teams
      </div>
    </div>
  `).join('');

  return `
    <div class="prefs-tab-section">
      <div class="coord-section-title">Submitted Guide Preferences</div>
      <p style="font-size: 0.85rem; color: var(--text-secondary-light); margin-bottom: 16px;">
        Ranked faculty preferences evaluated using the capacitated Gale-Shapley matching algorithm.
      </p>
      <div class="alloc-table-container">
        ${guideRows}
      </div>
    </div>
  `;
}

function renderLogbookTab({ logbooks, myTeam }) {
  const entries = logbooks.filter(l => !myTeam || l.teamId === myTeam.id);

  const entriesList = entries.map(l => `
    <div class="approval-item-card">
      <div class="appr-top">
        <strong>Week ${l.weekNumber} Progress Entry</strong>
        <span class="pref-pill ${l.status === 'approved' ? 'top' : ''}">${l.status?.toUpperCase()}</span>
      </div>
      <div style="font-size: 0.88rem; color: #FFF; margin: 8px 0;">
        ${l.workDone || 'Weekly deliverables sprint'}
      </div>
      ${l.guideRemarks ? `
        <div style="font-size: 0.82rem; color: var(--clr-orange); margin-top: 6px;">
          Guide Remarks: ${l.guideRemarks}
        </div>
      ` : ''}
    </div>
  `).join('');

  return `
    <div class="logbook-tab-section">
      <div class="approval-item-card" style="margin-bottom: 24px;">
        <h4 style="font-family: var(--font-display); color: var(--clr-orange); margin-bottom: 8px;">Submit Weekly Progress Log</h4>
        <input type="number" id="input-log-week" placeholder="Week Number (e.g. 4)" min="1" max="15" value="4" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 9999px; color: #FFF; width: 140px; margin-bottom: 8px;" />
        <textarea id="input-log-work" rows="2" class="panel-textarea" placeholder="Work done this week (tasks completed, code written)..."></textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;">
          <input type="number" id="input-log-hours" placeholder="Hours spent" value="12" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 9999px; color: #FFF; width: 120px;" />
          <button id="btn-submit-logbook" class="coord-btn primary sm">${icon('plus')} Submit to Guide</button>
        </div>
      </div>

      <div class="coord-section-title">Logbook Submission History</div>
      ${entriesList.length > 0 ? entriesList : '<div class="empty-state-modern"><p class="empty-state-text">No logbook entries submitted yet.</p></div>'}
    </div>
  `;
}

function renderDocsTab({ documents, myTeam }) {
  const docs = documents.filter(d => !myTeam || d.teamId === myTeam.id);

  const docRows = docs.map(d => `
    <div class="approval-item-card">
      <div class="appr-top">
        <strong>${d.type?.toUpperCase()}</strong>
        <span class="pref-pill ${d.status === 'coordinator_approved' || d.status === 'guide_approved' ? 'top' : ''}">${d.status}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-secondary-light); margin-top: 6px;">
        Version: v${d.version || 1} · File: ${d.fileName || 'document.pdf'}
      </div>
    </div>
  `).join('');

  return `
    <div class="docs-tab-section">
      <div class="approval-item-card" style="margin-bottom: 24px;">
        <h4 style="font-family: var(--font-display); color: var(--clr-orange); margin-bottom: 8px;">Upload Milestone Deliverable</h4>
        <select id="select-doc-type" class="focus-subject-select" style="margin-bottom: 8px;">
          <option value="synopsis">Project Synopsis</option>
          <option value="srs">SRS / System Architecture</option>
          <option value="mid_report">Mid-Semester Report</option>
          <option value="final_report">Final Project Report</option>
          <option value="slides">Presentation PPT</option>
        </select>
        <button id="btn-upload-doc" class="coord-btn primary sm">${icon('plus')} Upload & Submit</button>
      </div>

      <div class="coord-section-title">Deliverables Status Pipeline</div>
      ${docRows.length > 0 ? docRows : '<div class="empty-state-modern"><p class="empty-state-text">No milestone documents uploaded yet.</p></div>'}
    </div>
  `;
}

function renderInternshipTab({ internships }) {
  const myInternship = internships[0];

  if (!myInternship) {
    return `
      <div class="approval-item-card">
        <h3 style="font-family: var(--font-display); color: #FFF; margin-bottom: 8px;">Apply for Internship Academic Credits</h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary-light); margin-bottom: 16px;">
          Upload offer letter for Guide & Coordinator verification to claim course credits (8+ wks = 4 credits).
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <input type="text" id="input-intern-company" placeholder="Company Name (e.g. Google)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 9999px; color: #FFF;" />
          <input type="text" id="input-intern-role" placeholder="Role (e.g. SWE Intern)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 9999px; color: #FFF;" />
          <button id="btn-apply-internship" class="coord-btn primary sm" style="align-self: flex-start; margin-top: 8px;">
            ${icon('briefcase')} Submit Application
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="internship-tab-section">
      <div class="coord-guide-card">
        <div class="guide-card-top">
          <span class="guide-name">${myInternship.company} — ${myInternship.role}</span>
          <span class="pref-pill top">${myInternship.status?.toUpperCase()}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary-light); margin: 8px 0;">
          Duration: ${myInternship.durationWeeks} Weeks · Credits Earned: <strong>${myInternship.creditsEarned || 0} Credits</strong>
        </p>

        <div class="internship-pipeline-steps" style="display: flex; gap: 8px; margin-top: 16px;">
          <span class="pref-pill ${myInternship.status !== 'applied' ? 'top' : ''}">1. Applied</span>
          <span class="pref-pill ${myInternship.status === 'guide_approved' || myInternship.status === 'coordinator_approved' ? 'top' : ''}">2. Guide Approved</span>
          <span class="pref-pill ${myInternship.status === 'coordinator_approved' ? 'top' : ''}">3. Coordinator Final</span>
        </div>
      </div>
    </div>
  `;
}
