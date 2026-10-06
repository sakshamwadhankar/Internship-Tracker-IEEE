/**
 * @fileoverview Review Panel Dashboard & Rubric Scoring Sheet
 * Assigned review slots, time-boxed team dossier, weighted rubric scoring with score lock.
 */

import { icon } from '../icons.js';

/**
 * Render Review Panel View
 * @param {Object} props
 * @param {string} props.panelUid
 * @param {Array<any>} props.reviews
 * @param {Array<any>} props.teams
 * @param {string|null} props.selectedReviewId
 * @returns {string} HTML string
 */
export function renderPanelView({
  panelUid,
  reviews,
  teams,
  selectedReviewId = null
}) {
  const myReviews = reviews.filter(r => (r.panelMemberUids || []).includes(panelUid));
  const selectedReview = myReviews.find(r => r.id === selectedReviewId) || myReviews[0];
  const team = selectedReview ? teams.find(t => t.id === selectedReview.teamId) : null;

  const reviewSlotsList = myReviews.map(r => {
    const t = teams.find(teamItem => teamItem.id === r.teamId);
    const isSelected = selectedReview && selectedReview.id === r.id;
    const isScored = r.scores && r.scores[panelUid];

    return `
      <div class="coord-guide-card ${isSelected ? 'selected' : ''}" style="cursor: pointer;" data-select-rev-id="${r.id}">
        <div class="guide-card-top">
          <strong style="color: #FFF;">${t ? t.name : r.teamId}</strong>
          <span class="pref-pill ${isScored ? 'top' : ''}">${isScored ? 'SCORED' : 'PENDING'}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary-light); margin-top: 6px;">
          ${r.date} · ${r.startTime} - ${r.endTime} · Room: ${r.roomId}
        </div>
      </div>
    `;
  }).join('');

  let scoringSheetHtml = '';
  if (selectedReview && team) {
    const existingScore = selectedReview.scores?.[panelUid];
    const isLocked = Boolean(existingScore);

    scoringSheetHtml = `
      <div class="panel-dossier-card">
        <span class="coord-badge">TEAM DOSSIER (ROUND ${selectedReview.round})</span>
        <h3 style="font-family: var(--font-display); font-size: 1.4rem; color: #FFF; margin: 8px 0;">${team.name}</h3>
        <p style="font-size: 0.9rem; color: var(--text-secondary-light); margin-bottom: 16px;">
          Domain: ${team.domain || 'Engineering & Technology'} · ${team.memberUids?.length || 1} Mentees
        </p>

        <div class="rubric-scoring-box">
          <h4 style="font-family: var(--font-display); color: var(--clr-orange); margin-bottom: 12px;">Weighted Rubric Scoring</h4>
          
          <div class="rubric-criteria-grid">
            <div class="rubric-row">
              <span>Problem Formulation & Novelty (Max 20)</span>
              <input type="number" min="0" max="20" class="rubric-input" id="rubric-prob" value="${existingScore?.problem || 18}" ${isLocked ? 'disabled' : ''} />
            </div>
            <div class="rubric-row">
              <span>Literature Survey & Context (Max 15)</span>
              <input type="number" min="0" max="15" class="rubric-input" id="rubric-lit" value="${existingScore?.literature || 13}" ${isLocked ? 'disabled' : ''} />
            </div>
            <div class="rubric-row">
              <span>System Design & Architecture (Max 20)</span>
              <input type="number" min="0" max="20" class="rubric-input" id="rubric-design" value="${existingScore?.design || 17}" ${isLocked ? 'disabled' : ''} />
            </div>
            <div class="rubric-row">
              <span>Implementation & Live Demo (Max 25)</span>
              <input type="number" min="0" max="25" class="rubric-input" id="rubric-impl" value="${existingScore?.implementation || 22}" ${isLocked ? 'disabled' : ''} />
            </div>
            <div class="rubric-row">
              <span>Presentation & Defense (Max 20)</span>
              <input type="number" min="0" max="20" class="rubric-input" id="rubric-pres" value="${existingScore?.presentation || 18}" ${isLocked ? 'disabled' : ''} />
            </div>
          </div>

          <div style="margin-top: 16px;">
            <label style="font-size: 0.85rem; color: var(--text-secondary-light); display: block; margin-bottom: 4px;">Panel Comments & Recommendations</label>
            <textarea id="panel-comments" rows="3" class="panel-textarea" placeholder="Enter specific technical feedback..." ${isLocked ? 'disabled' : ''}>${existingScore?.comments || 'Solid architectural foundation and good demo progression.'}</textarea>
          </div>

          <div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.9rem; color: #FFF;">Verdict: <strong>${existingScore?.verdict || 'PROCEED'}</strong></span>
            ${!isLocked ? `
              <button id="btn-submit-rubric-score" class="coord-btn primary" data-review-id="${selectedReview.id}">
                ${icon('checkCircle')} Submit & Lock Score
              </button>
            ` : `
              <span class="pref-pill top">${icon('lock')} Score Locked & Submitted</span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="panel-dashboard animate-fade">
      <div class="coord-header-banner">
        <div>
          <span class="coord-badge">EVALUATION PANEL DOSSIER</span>
          <h2 class="coord-title">Review Committee Scoring</h2>
        </div>
      </div>

      <div class="panel-layout-grid">
        <div class="panel-slots-column">
          <div class="coord-section-title">My Assigned Reviews (${myReviews.length})</div>
          ${reviewSlotsList.length > 0 ? reviewSlotsList : '<div class="empty-state-modern"><p class="empty-state-text">No reviews assigned to your panel.</p></div>'}
        </div>

        <div class="panel-dossier-column">
          ${scoringSheetHtml || '<div class="empty-state-modern"><p class="empty-state-text">Select a scheduled review slot on the left to open the team dossier and rubric.</p></div>'}
        </div>
      </div>
    </div>
  `;
}
