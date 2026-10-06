import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runCapacitatedAllocation,
  calculateSatisfactionStats,
  applyManualOverride,
  calculateDomainOverlapScore
} from '../src/modules/allocation.js';

import {
  generateConflictFreeSchedule,
  checkDeliverableGateStatus,
  proposeRescheduleSlot
} from '../src/modules/reviewScheduler.js';

import {
  calculateTeamProgressPercentage,
  evaluateAtRiskRules,
  generateHeatmapMatrix
} from '../src/modules/progressRadar.js';

import {
  calculateReviewStreak,
  rolloverUncheckedTodos,
  computeLeaderboardRankings,
  calculateSubjectBreakdown
} from '../src/modules/focusPlanner.js';

import {
  calculateInternshipCredits,
  approveByGuide,
  approveByCoordinator,
  rejectInternship
} from '../src/modules/internship.js';

describe('Capacitated Stable Matching & Allocation Engine', () => {
  const guides = [
    { uid: 'g1', name: 'Dr. Alan Turing', loadLimit: 2, researchAreas: ['AI', 'Machine Learning'] },
    { uid: 'g2', name: 'Dr. Ada Lovelace', loadLimit: 2, researchAreas: ['Cloud', 'Systems'] },
    { uid: 'g3', name: 'Dr. Claude Shannon', loadLimit: 2, researchAreas: ['Security', 'Networks'] }
  ];

  const teams = [
    { id: 't1', name: 'Team Alpha', memberUids: ['m1', 'm2'], domain: 'AI', rankedGuideUids: ['g1', 'g2', 'g3'], submittedAtMillis: 1000 },
    { id: 't2', name: 'Team Beta', memberUids: ['m3', 'm4'], domain: 'AI', rankedGuideUids: ['g1', 'g3'], submittedAtMillis: 2000 },
    { id: 't3', name: 'Team Gamma', memberUids: ['m5'], domain: 'Cloud', rankedGuideUids: ['g1', 'g2'], submittedAtMillis: 3000 },
    { id: 't4', name: 'Team Delta', memberUids: ['m6'], domain: 'Security', rankedGuideUids: ['g3', 'g2'], submittedAtMillis: 4000 }
  ];

  it('calculates domain overlap scores correctly', () => {
    assert.equal(calculateDomainOverlapScore(teams[0], guides[0]), 10);
    assert.equal(calculateDomainOverlapScore(teams[0], guides[1]), 0);
  });

  it('runs capacitated allocation respecting guide limits and preferences', () => {
    const result = runCapacitatedAllocation({ teams, guides });
    assert.equal(result.allocations.length, 4);
    assert.equal(result.stats.assignedCount, 4);
    assert.equal(result.stats.unassignedCount, 0);

    // Dr. Turing (g1) limit is 2; t1 and t2 have domain overlap and proposed first
    const g1Allocations = result.allocations.filter(a => a.assignedGuideUid === 'g1');
    assert.equal(g1Allocations.length, 2);
  });

  it('enforces coordinator pre-locked pairs strictly before running algorithm', () => {
    const preLockedPairs = [
      { teamId: 't3', guideUid: 'g3', reason: 'Industry grant sponsored project' }
    ];

    const result = runCapacitatedAllocation({ teams, guides, preLockedPairs });
    const t3Alloc = result.allocations.find(a => a.teamId === 't3');
    assert.ok(t3Alloc);
    assert.equal(t3Alloc.assignedGuideUid, 'g3');
    assert.equal(t3Alloc.isPreLocked, true);
    assert.equal(t3Alloc.preferenceSatisfied, 'pre_locked');
  });

  it('calculates department satisfaction stats accurately', () => {
    const result = runCapacitatedAllocation({ teams, guides });
    assert.ok(result.stats.firstChoicePercent >= 50);
    assert.equal(result.stats.totalTeams, 4);
  });

  it('coordinator manual override respects force flag on capacity breach', () => {
    const initial = runCapacitatedAllocation({ teams, guides });

    // Attempting to override into an over-capacity guide without force should throw
    assert.throws(() => {
      applyManualOverride({
        allocations: initial.allocations,
        guides,
        teams,
        teamId: 't4',
        targetGuideUid: 'g1', // g1 is already at capacity (2/2)
        actorUid: 'coordinator_1',
        force: false
      });
    }, /at capacity/);

    // Overriding with force=true and justification reason succeeds
    const overridden = applyManualOverride({
      allocations: initial.allocations,
      guides,
      teams,
      teamId: 't4',
      targetGuideUid: 'g1',
      actorUid: 'coordinator_1',
      reason: 'HOD special exemption for dual interdisciplinary project',
      force: true
    });

    const t4Alloc = overridden.allocations.find(a => a.teamId === 't4');
    assert.equal(t4Alloc.assignedGuideUid, 'g1');
    assert.equal(t4Alloc.assignedBy, 'manual');
    assert.ok(overridden.warning.includes('exceeds capacity limit'));
  });
});

describe('Review Scheduler Engine', () => {
  const panels = [
    { id: 'p1', name: 'Panel 1', memberUids: ['fac_1', 'fac_2'] },
    { id: 'p2', name: 'Panel 2', memberUids: ['fac_3', 'fac_4'] }
  ];

  const rooms = ['Lab 101', 'Seminar Hall'];

  const timeSlots = [
    { id: 'slot_1', date: '2026-11-01', startTime: '10:00', endTime: '10:30', startMillis: 1793500000000, durationMin: 30 },
    { id: 'slot_2', date: '2026-11-01', startTime: '10:30', endTime: '11:00', startMillis: 1793501800000, durationMin: 30 },
    { id: 'slot_3', date: '2026-11-01', startTime: '11:00', endTime: '11:30', startMillis: 1793503600000, durationMin: 30 }
  ];

  const teams = [
    { id: 'team_a', name: 'Team A', guideId: 'fac_1' },
    { id: 'team_b', name: 'Team B', guideId: 'fac_3' },
    { id: 'team_c', name: 'Team C', guideId: 'fac_2' }
  ];

  it('generates conflict-free schedule and never assigns guide to judge their own team', () => {
    const result = generateConflictFreeSchedule({
      teams,
      panels,
      rooms,
      timeSlots,
      round: 1,
      cycleId: '2026_fall'
    });

    assert.equal(result.stats.scheduled, 3);
    assert.equal(result.stats.unassigned, 0);

    for (const rev of result.schedule) {
      assert.ok(!rev.panelMemberUids.includes(rev.guideUid), 'Guide must not be in judging panel');
      assert.equal(rev.deliverablesDueAtMillis, rev.scheduledAtMillis - 24 * 3600 * 1000);
    }
  });

  it('verifies 24h deliverable gate compliance accurately', () => {
    const review = {
      id: 'rev_1',
      deliverablesDueAtMillis: 100000
    };

    const onTime = [{ reviewId: 'rev_1', uploadedAtMillis: 90000, status: 'submitted' }];
    assert.equal(checkDeliverableGateStatus(review, onTime, 110000).gateSatisfied, true);

    const late = [{ reviewId: 'rev_1', uploadedAtMillis: 105000, status: 'submitted' }];
    assert.equal(checkDeliverableGateStatus(review, late, 110000).gateSatisfied, false);
  });

  it('proposes conflict-free rescheduling slot', () => {
    const allReviews = [
      {
        id: 'rev_1',
        teamId: 'team_a',
        guideUid: 'fac_1',
        slotId: 'slot_1',
        roomId: 'Lab 101',
        panelId: 'p2',
        panelMemberUids: ['fac_3', 'fac_4'],
        scheduledAtMillis: 1793500000000,
        deliverablesDueAtMillis: 1793500000000 - 86400000,
        status: 'scheduled'
      }
    ];

    const rescheduled = proposeRescheduleSlot({
      review: allReviews[0],
      allScheduledReviews: allReviews,
      panels,
      rooms,
      availableSlots: timeSlots
    });

    assert.ok(rescheduled);
    assert.notEqual(rescheduled.slotId, 'slot_1');
    assert.equal(rescheduled.status, 'rescheduled');
  });
});

describe('Progress Visibility, Heatmap & At-Risk Radar', () => {
  it('computes composite weighted progress percentage', () => {
    const logbooks = [
      { id: 'l1', teamId: 't1', weekNumber: 1, submittedAtMillis: 100, status: 'approved' },
      { id: 'l2', teamId: 't1', weekNumber: 2, submittedAtMillis: 200, status: 'approved' }
    ];
    const documents = [
      { id: 'd1', teamId: 't1', type: 'synopsis', status: 'coordinator_approved', uploadedAtMillis: 100 }
    ];
    const reviews = [
      { reviewId: 'r1', round: 1, scheduledAtMillis: 100, completed: true }
    ];

    const res = calculateTeamProgressPercentage({
      logbooks,
      documents,
      reviews,
      finalSubmissionCompleted: false,
      expectedLogbookCount: 4,
      expectedDocCount: 2,
      expectedReviewCount: 2
    });

    assert.ok(res.progressPercent > 0);
    assert.equal(typeof res.breakdown.logbooks, 'number');
  });

  it('triggers At-Risk Radar rules on missed logbooks and score drops', () => {
    const currentMillis = 1000000000;
    const team = { id: 'team_x', name: 'Team X', createdAtMillis: currentMillis - (15 * 86400000) };

    const logbooks = [
      { id: 'l1', teamId: 'team_x', weekNumber: 1, submittedAtMillis: currentMillis - (12 * 86400000), status: 'approved' }
    ];

    const documents = [
      { id: 'd1', teamId: 'team_x', type: 'report', status: 'pending', uploadedAtMillis: currentMillis - (6 * 86400000) }
    ];

    const reviews = [
      { reviewId: 'r1', round: 1, scheduledAtMillis: 100, totalScore: 85, completed: true },
      { reviewId: 'r2', round: 2, scheduledAtMillis: 200, totalScore: 65, completed: true } // dropped 23.5%
    ];

    const triggers = evaluateAtRiskRules({
      team,
      logbooks,
      documents,
      reviews,
      focusSessions: [],
      currentMillis
    });

    const ruleNames = triggers.map(t => t.rule);
    assert.ok(ruleNames.includes('NO_LOGBOOK_10_DAYS'));
    assert.ok(ruleNames.includes('DOC_PENDING_5_DAYS'));
    assert.ok(ruleNames.includes('SCORE_DROP_15_PERCENT'));
  });

  it('generates heatmap matrix with green, amber, red, and gray cells', () => {
    const teams = [{ id: 't1', name: 'Team One' }];
    const allLogbooks = [
      { id: 'l1', teamId: 't1', weekNumber: 1, submittedAtMillis: 10, status: 'approved', hoursSpent: 8 }
    ];

    const matrix = generateHeatmapMatrix({
      teams,
      allLogbooks,
      totalWeeks: 3,
      currentWeek: 2
    });

    assert.equal(matrix[0].weeks[0].status, 'green'); // week 1: approved
    assert.equal(matrix[0].weeks[1].status, 'red'); // week 2: missed
    assert.equal(matrix[0].weeks[2].status, 'gray'); // week 3: future
  });
});

describe('Focus & Accountability Module (YPT)', () => {
  it('calculates daily review streak accurately', () => {
    const dailyPlans = [
      { date: '2026-10-06', reviewed: true, todos: [] },
      { date: '2026-10-05', reviewed: true, todos: [] },
      { date: '2026-10-04', reviewed: true, todos: [] },
      { date: '2026-10-02', reviewed: true, todos: [] }
    ];

    const streak = calculateReviewStreak(dailyPlans, '2026-10-06');
    assert.equal(streak, 3);
  });

  it('rolls over unchecked todos from previous day plan', () => {
    const yesterdayPlan = {
      date: '2026-10-05',
      reviewed: true,
      todos: [
        { id: 'td1', title: 'Write Chapter 2', done: false, plannedMin: 45 },
        { id: 'td2', title: 'Submit Logbook', done: true, plannedMin: 15 }
      ]
    };

    const todayPlan = {
      date: '2026-10-06',
      reviewed: false,
      todos: [
        { id: 'td3', title: 'Setup database schema', done: false, plannedMin: 30 }
      ]
    };

    const updated = rolloverUncheckedTodos(yesterdayPlan, todayPlan);
    assert.equal(updated.todos.length, 2);
    assert.ok(updated.todos.some(t => t.title === 'Write Chapter 2'));
  });

  it('computes leaderboards with privacy tiers', () => {
    const users = [
      { uid: 'u1', name: 'Alice', privacy: 'public' },
      { uid: 'u2', name: 'Bob', privacy: 'private' }
    ];

    const sessions = [
      { id: 's1', uid: 'u1', subjectId: 'sub1', endedAtMillis: 1000, durationMin: 120, mode: 'stopwatch' },
      { id: 's2', uid: 'u2', subjectId: 'sub1', endedAtMillis: 1000, durationMin: 90, mode: 'stopwatch' }
    ];

    const rankings = computeLeaderboardRankings({
      sessions,
      users,
      scope: 'dept',
      startMillis: 0
    });

    assert.equal(rankings[0].name, 'Alice');
    assert.equal(rankings[0].totalMinutes, 120);
    assert.equal(rankings[1].name, 'Anonymous Student');
    assert.equal(rankings[1].isAnonymous, true);
  });

  it('calculates subject breakdown stats for color-coded charts', () => {
    const subjects = [
      { id: 'sub1', ownerUid: 'u1', name: 'FYP Backend', colorCode: '#E27227' },
      { id: 'sub2', ownerUid: 'u1', name: 'DAA Grind', colorCode: '#3B82F6' }
    ];

    const sessions = [
      { id: 's1', uid: 'u1', subjectId: 'sub1', durationMin: 60 },
      { id: 's2', uid: 'u1', subjectId: 'sub2', durationMin: 40 }
    ];

    const breakdown = calculateSubjectBreakdown(sessions, subjects);
    assert.equal(breakdown[0].name, 'FYP Backend');
    assert.equal(breakdown[0].percent, 60);
    assert.equal(breakdown[1].percent, 40);
  });
});

describe('Internship Approval Workflow', () => {
  it('maps internship duration to credits correctly', () => {
    assert.equal(calculateInternshipCredits(12), 6);
    assert.equal(calculateInternshipCredits(8), 4);
    assert.equal(calculateInternshipCredits(4), 2);
    assert.equal(calculateInternshipCredits(2), 0);
  });

  it('enforces sequential role approvals (guide then coordinator)', () => {
    const internship = {
      id: 'intern_1',
      studentUid: 'stud_1',
      studentName: 'Om Rai',
      company: 'Google',
      role: 'SWE Intern',
      mentorName: 'Dr. Turing',
      startDate: '2026-06-01',
      endDate: '2026-08-01',
      durationWeeks: 8,
      offerLetterDocId: 'doc_offer_123',
      status: 'applied',
      approvals: {},
      creditsEarned: 0
    };

    // Coordinator cannot approve before guide
    assert.throws(() => {
      approveByCoordinator(internship, 'coord_1');
    }, /Guide approval is required/);

    // Guide approves
    const guideApproved = approveByGuide(internship, 'guide_1', 'Verified company and role alignment');
    assert.equal(guideApproved.status, 'guide_approved');
    assert.equal(guideApproved.approvals.guide.approvedBy, 'guide_1');

    // Now coordinator approves
    const coordinatorApproved = approveByCoordinator(guideApproved, 'coord_1', 'Credits recognized');
    assert.equal(coordinatorApproved.status, 'coordinator_approved');
    assert.equal(coordinatorApproved.creditsEarned, 4);
  });

  it('validates rejection reason length', () => {
    const internship = { id: 'intern_2', status: 'applied', approvals: {} };
    assert.throws(() => {
      rejectInternship(internship, 'guide_1', 'bad');
    }, /min 5 chars/);

    const rejected = rejectInternship(internship, 'guide_1', 'Company offer letter is not signed or verified');
    assert.equal(rejected.status, 'rejected');
  });
});
