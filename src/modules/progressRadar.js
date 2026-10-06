/**
 * @fileoverview Progress Visibility, Heatmap Matrix & At-Risk Radar (Evaluation Pillar #3)
 * Computes composite weighted progress percentages, generates team x week heatmap
 * status matrices, and evaluates the 5 strict At-Risk Radar rules.
 */

/**
 * @typedef {Object} LogbookEntry
 * @property {string} id
 * @property {string} teamId
 * @property {number} weekNumber
 * @property {number} submittedAtMillis
 * @property {'draft' | 'submitted' | 'approved' | 'changes_requested'} status
 * @property {number} [hoursSpent]
 */

/**
 * @typedef {Object} DocumentRecord
 * @property {string} id
 * @property {string} teamId
 * @property {string} type
 * @property {'pending' | 'guide_approved' | 'changes_requested' | 'coordinator_approved'} status
 * @property {number} uploadedAtMillis
 * @property {number} [updatedAtMillis]
 */

/**
 * @typedef {Object} ReviewScore
 * @property {string} reviewId
 * @property {number} round
 * @property {number} scheduledAtMillis
 * @property {number} [totalScore] - Normalized 0-100
 * @property {boolean} [completed]
 * @property {boolean} [deliverablesMissing]
 */

/**
 * @typedef {Object} FocusSession
 * @property {string} teamId
 * @property {number} endedAtMillis
 * @property {number} durationMin
 */

/**
 * @typedef {Object} RiskTrigger
 * @property {'NO_LOGBOOK_10_DAYS' | 'DOC_PENDING_5_DAYS' | 'SCORE_DROP_15_PERCENT' | 'DELIVERABLES_MISSING_24H' | 'FOCUS_FLATLINE_14_DAYS'} rule
 * @property {'critical' | 'warning' | 'info'} severity
 * @property {string} title
 * @property {string} description
 * @property {string} actionItem
 */

/**
 * Calculate composite weighted progress percentage (0 - 100)
 * Weights: Logbook compliance 30%, Document approvals 30%, Reviews 25%, Final submission 15%
 * @param {Object} params
 * @param {LogbookEntry[]} params.logbooks
 * @param {DocumentRecord[]} params.documents
 * @param {ReviewScore[]} params.reviews
 * @param {boolean} params.finalSubmissionCompleted
 * @param {number} [params.expectedLogbookCount=12]
 * @param {number} [params.expectedDocCount=4]
 * @param {number} [params.expectedReviewCount=3]
 * @returns {{ progressPercent: number, breakdown: { logbooks: number, documents: number, reviews: number, submission: number } }}
 */
export function calculateTeamProgressPercentage({
  logbooks,
  documents,
  reviews,
  finalSubmissionCompleted,
  expectedLogbookCount = 12,
  expectedDocCount = 4,
  expectedReviewCount = 3
}) {
  const approvedLogbooks = logbooks.filter(l => l.status === 'approved').length;
  const logbookScore = Math.min(1, approvedLogbooks / Math.max(1, expectedLogbookCount)) * 30;

  const approvedDocs = documents.filter(d => d.status === 'coordinator_approved' || d.status === 'guide_approved').length;
  const docScore = Math.min(1, approvedDocs / Math.max(1, expectedDocCount)) * 30;

  const completedReviews = reviews.filter(r => r.completed).length;
  const reviewScore = Math.min(1, completedReviews / Math.max(1, expectedReviewCount)) * 25;

  const submissionScore = finalSubmissionCompleted ? 15 : 0;

  const progressPercent = Math.min(100, Math.round(logbookScore + docScore + reviewScore + submissionScore));

  return {
    progressPercent,
    breakdown: {
      logbooks: Math.round(logbookScore),
      documents: Math.round(docScore),
      reviews: Math.round(reviewScore),
      submission: submissionScore
    }
  };
}

/**
 * Evaluate the 5 strict At-Risk Radar rules for a team
 * @param {Object} params
 * @param {{ id: string, name: string, createdAtMillis?: number }} params.team
 * @param {LogbookEntry[]} params.logbooks
 * @param {DocumentRecord[]} params.documents
 * @param {ReviewScore[]} params.reviews
 * @param {FocusSession[]} params.focusSessions
 * @param {number} [params.currentMillis=Date.now()]
 * @returns {RiskTrigger[]}
 */
export function evaluateAtRiskRules({
  team,
  logbooks,
  documents,
  reviews,
  focusSessions,
  currentMillis = Date.now()
}) {
  const triggers = [];
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  // Rule 1: No logbook submitted for >= 10 days
  const submittedLogbooks = logbooks.filter(l => l.status !== 'draft');
  if (submittedLogbooks.length === 0) {
    const age = currentMillis - (team.createdAtMillis || currentMillis);
    if (age >= TEN_DAYS_MS) {
      triggers.push({
        rule: 'NO_LOGBOOK_10_DAYS',
        severity: 'critical',
        title: 'No Logbook for ≥ 10 Days',
        description: 'Team has not submitted any weekly progress log since semester start.',
        actionItem: 'Prompt team leader to submit outstanding weekly entries.'
      });
    }
  } else {
    const latestSubmitted = Math.max(...submittedLogbooks.map(l => l.submittedAtMillis || 0));
    if (currentMillis - latestSubmitted >= TEN_DAYS_MS) {
      triggers.push({
        rule: 'NO_LOGBOOK_10_DAYS',
        severity: 'critical',
        title: 'No Logbook for ≥ 10 Days',
        description: `Last logbook entry was submitted ${Math.floor((currentMillis - latestSubmitted) / (24 * 3600 * 1000))} days ago.`,
        actionItem: 'Send automated logbook overdue reminder to team members.'
      });
    }
  }

  // Rule 2: Document pending review for >= 5 days
  const pendingDocs = documents.filter(d => d.status === 'pending');
  for (const doc of pendingDocs) {
    const age = currentMillis - doc.uploadedAtMillis;
    if (age >= FIVE_DAYS_MS) {
      triggers.push({
        rule: 'DOC_PENDING_5_DAYS',
        severity: 'warning',
        title: 'Document Pending Review ≥ 5 Days',
        description: `Document "${doc.type}" uploaded ${Math.floor(age / (24 * 3600 * 1000))} days ago has not been reviewed by guide.`,
        actionItem: 'Nudge assigned guide to complete document review.'
      });
      break;
    }
  }

  // Rule 3: Review score drop >= 15% between consecutive rounds
  const sortedReviews = [...reviews]
    .filter(r => typeof r.totalScore === 'number' && r.completed)
    .sort((a, b) => a.round - b.round);

  for (let i = 1; i < sortedReviews.length; i++) {
    const prev = sortedReviews[i - 1].totalScore;
    const curr = sortedReviews[i].totalScore;
    if (prev && curr && prev > 0) {
      const dropPct = ((prev - curr) / prev) * 100;
      if (dropPct >= 15) {
        triggers.push({
          rule: 'SCORE_DROP_15_PERCENT',
          severity: 'critical',
          title: `Score Dropped ${Math.round(dropPct)}% in Round ${sortedReviews[i].round}`,
          description: `Team score fell from ${prev} in Round ${sortedReviews[i - 1].round} to ${curr} in Round ${sortedReviews[i].round}.`,
          actionItem: 'Schedule faculty-guide intervention meeting.'
        });
        break;
      }
    }
  }

  // Rule 4: Deliverables missing within 24h of review
  for (const r of reviews) {
    if (!r.completed && r.scheduledAtMillis > currentMillis && (r.scheduledAtMillis - currentMillis) <= TWENTY_FOUR_HOURS_MS) {
      if (r.deliverablesMissing) {
        triggers.push({
          rule: 'DELIVERABLES_MISSING_24H',
          severity: 'critical',
          title: `Missing Deliverables 24h Before Round ${r.round} Review`,
          description: `Presentation review starts in ${Math.round((r.scheduledAtMillis - currentMillis) / (3600 * 1000))} hours but deliverables are missing.`,
          actionItem: 'Notify panel and team leader of pending deliverable lock.'
        });
      }
    }
  }

  // Rule 5: Focus activity flatline (whole team stopped timer usage for 14 days)
  if (focusSessions.length > 0) {
    const latestFocus = Math.max(...focusSessions.map(f => f.endedAtMillis || 0));
    if (currentMillis - latestFocus >= FOURTEEN_DAYS_MS) {
      triggers.push({
        rule: 'FOCUS_FLATLINE_14_DAYS',
        severity: 'warning',
        title: 'Focus Activity Flatline (14 Days)',
        description: 'Zero focus session hours recorded by any team member in the last 14 days.',
        actionItem: 'Check in with team on task bottlenecks and sprint engagement.'
      });
    }
  }

  return triggers;
}

/**
 * Generate team x week heatmap matrix with color coding and drill-down evidence
 * Green: approved on time | Amber: pending/changes requested | Red: overdue/missing | Gray: future
 * @param {Object} params
 * @param {Array<{ id: string, name: string }>} params.teams
 * @param {LogbookEntry[]} params.allLogbooks
 * @param {number} params.totalWeeks
 * @param {number} params.currentWeek - Current 1-based semester week
 * @returns {Array<{ teamId: string, teamName: string, weeks: Array<{ weekNumber: number, status: 'green' | 'amber' | 'red' | 'gray', logbookId?: string, hoursSpent?: number, note: string }> }>}
 */
export function generateHeatmapMatrix({
  teams,
  allLogbooks,
  totalWeeks = 12,
  currentWeek = 1
}) {
  const logbookLookup = new Map();
  for (const l of allLogbooks) {
    logbookLookup.set(`${l.teamId}_w${l.weekNumber}`, l);
  }

  return teams.map(team => {
    const weeks = [];
    for (let w = 1; w <= totalWeeks; w++) {
      if (w > currentWeek) {
        weeks.push({
          weekNumber: w,
          status: 'gray',
          note: 'Upcoming week'
        });
        continue;
      }

      const entry = logbookLookup.get(`${team.id}_w${w}`);
      if (!entry) {
        weeks.push({
          weekNumber: w,
          status: 'red',
          note: 'Logbook missed / not submitted'
        });
      } else if (entry.status === 'approved') {
        weeks.push({
          weekNumber: w,
          status: 'green',
          logbookId: entry.id,
          hoursSpent: entry.hoursSpent,
          note: `Approved (${entry.hoursSpent || 0} hrs logged)`
        });
      } else if (entry.status === 'submitted') {
        weeks.push({
          weekNumber: w,
          status: 'amber',
          logbookId: entry.id,
          hoursSpent: entry.hoursSpent,
          note: 'Submitted — pending guide review'
        });
      } else {
        weeks.push({
          weekNumber: w,
          status: 'amber',
          logbookId: entry.id,
          note: 'Changes requested by guide'
        });
      }
    }

    return {
      teamId: team.id,
      teamName: team.name,
      weeks
    };
  });
}
