/**
 * @fileoverview Capacitated Stable Matching & Allocation Engine (Evaluation Pillar #1)
 * Implements Gale-Shapley with guide capacity limits, coordinator pre-locking hard constraints,
 * balance repair, satisfaction analytics, and full manual override mechanics.
 */

/**
 * @typedef {Object} Guide
 * @property {string} uid
 * @property {string} name
 * @property {number} loadLimit
 * @property {number} [currentLoad]
 * @property {string[]} [researchAreas]
 * @property {boolean} [isAcceptingPreferences]
 */

/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name
 * @property {string[]} memberUids
 * @property {string[]} [rankedGuideUids] - Ranked guide preferences [1st, 2nd, ...]
 * @property {string} [domain] - Primary research domain or tech stack
 * @property {number} [submittedAtMillis] - Timestamp for tie-breaking
 */

/**
 * @typedef {Object} PreLockedPair
 * @property {string} teamId
 * @property {string} guideUid
 * @property {string} [reason]
 */

/**
 * @typedef {Object} AllocationResult
 * @property {string} teamId
 * @property {string|null} assignedGuideUid
 * @property {string} preferenceSatisfied - '1st' | '2nd' | '3rd' | '4th+' | 'pre_locked' | 'unassigned' | 'manual'
 * @property {'auto' | 'manual'} assignedBy
 * @property {boolean} isPreLocked
 * @property {string} [overrideReason]
 * @property {string} [overrideBy]
 * @property {number} [matchedRank] - 1-based index of preference, or null if unassigned
 */

/**
 * @typedef {Object} SatisfactionStats
 * @property {number} totalTeams
 * @property {number} assignedCount
 * @property {number} unassignedCount
 * @property {number} firstChoiceCount
 * @property {number} firstChoicePercent
 * @property {number} secondChoiceCount
 * @property {number} secondChoicePercent
 * @property {number} thirdChoiceCount
 * @property {number} thirdChoicePercent
 * @property {number} lowerChoiceCount
 * @property {number} preLockedCount
 * @property {number} manualOverrideCount
 * @property {Object<string, number>} guideLoads - guideUid -> assigned count
 * @property {number} maxGuideLoad
 * @property {number} minGuideLoad
 */

/**
 * Score domain alignment between a team and a guide
 * @param {Team} team
 * @param {Guide} guide
 * @returns {number}
 */
export function calculateDomainOverlapScore(team, guide) {
  if (!team.domain || !guide.researchAreas || guide.researchAreas.length === 0) {
    return 0;
  }
  const teamDomain = team.domain.toLowerCase();
  for (const area of guide.researchAreas) {
    const areaLower = area.toLowerCase();
    if (teamDomain.includes(areaLower) || areaLower.includes(teamDomain)) {
      return 10;
    }
  }
  return 0;
}

/**
 * Capacitated Stable Matching algorithm with hard pre-locking and balance repair.
 * @param {Object} params
 * @param {Team[]} params.teams
 * @param {Guide[]} params.guides
 * @param {PreLockedPair[]} [params.preLockedPairs=[]]
 * @returns {{ allocations: AllocationResult[], stats: SatisfactionStats, unassignedTeams: Team[] }}
 */
export function runCapacitatedAllocation({ teams, guides, preLockedPairs = [] }) {
  if (!Array.isArray(teams) || !Array.isArray(guides)) {
    throw new TypeError('teams and guides must be arrays');
  }

  const guideMap = new Map(guides.map(g => [g.uid, { ...g, currentLoad: 0 }]));
  const teamMap = new Map(teams.map(t => [t.id, t]));

  /** @type {Map<string, AllocationResult>} */
  const allocationMap = new Map();

  // 1. Enforce Pre-Locked Pairs (Coordinator authority outranks the algorithm)
  const lockedTeamIds = new Set();
  for (const lock of preLockedPairs) {
    const team = teamMap.get(lock.teamId);
    const guide = guideMap.get(lock.guideUid);
    if (!team) {
      throw new Error(`Pre-locked team not found: ${lock.teamId}`);
    }
    if (!guide) {
      throw new Error(`Pre-locked guide not found: ${lock.guideUid}`);
    }

    lockedTeamIds.add(team.id);
    guide.currentLoad += 1;
    allocationMap.set(team.id, {
      teamId: team.id,
      assignedGuideUid: guide.uid,
      preferenceSatisfied: 'pre_locked',
      assignedBy: 'manual',
      isPreLocked: true,
      overrideReason: lock.reason || 'Coordinator pre-locked assignment',
      matchedRank: team.rankedGuideUids ? team.rankedGuideUids.indexOf(guide.uid) + 1 : 0
    });
  }

  // 2. Prepare teams for matching
  const freeTeams = [];
  /** @type {Map<string, number>} Next preference index to propose */
  const nextProposalIndex = new Map();

  for (const team of teams) {
    if (!lockedTeamIds.has(team.id)) {
      freeTeams.push(team.id);
      nextProposalIndex.set(team.id, 0);
    }
  }

  /** @type {Map<string, string[]>} guideUid -> list of tentatively accepted teamIds */
  const guideAssignments = new Map();
  for (const guide of guides) {
    guideAssignments.set(guide.uid, []);
  }

  // Helper to compare two teams for a guide (higher score is better)
  const compareTeamsForGuide = (teamAId, teamBId, guide) => {
    const teamA = teamMap.get(teamAId);
    const teamB = teamMap.get(teamBId);
    if (!teamA || !teamB) return 0;

    // Tie-breaker 1: Domain overlap
    const domainA = calculateDomainOverlapScore(teamA, guide);
    const domainB = calculateDomainOverlapScore(teamB, guide);
    if (domainA !== domainB) return domainA - domainB;

    // Tie-breaker 2: Submission timestamp (earlier is better)
    const timeA = teamA.submittedAtMillis || 0;
    const timeB = teamB.submittedAtMillis || 0;
    if (timeA !== timeB) return timeB - timeA;

    // Tie-breaker 3: Deterministic string hash
    return teamA.id.localeCompare(teamB.id);
  };

  // 3. Gale-Shapley with capacity limits
  while (freeTeams.length > 0) {
    const teamId = freeTeams.shift();
    if (!teamId) break;

    const team = teamMap.get(teamId);
    if (!team || !team.rankedGuideUids || team.rankedGuideUids.length === 0) {
      // Team has no preferences
      allocationMap.set(teamId, {
        teamId,
        assignedGuideUid: null,
        preferenceSatisfied: 'unassigned',
        assignedBy: 'auto',
        isPreLocked: false,
        matchedRank: null
      });
      continue;
    }

    const propIndex = nextProposalIndex.get(teamId) || 0;
    if (propIndex >= team.rankedGuideUids.length) {
      // Exhausted all preferences without being placed
      allocationMap.set(teamId, {
        teamId,
        assignedGuideUid: null,
        preferenceSatisfied: 'unassigned',
        assignedBy: 'auto',
        isPreLocked: false,
        matchedRank: null
      });
      continue;
    }

    const preferredGuideUid = team.rankedGuideUids[propIndex];
    nextProposalIndex.set(teamId, propIndex + 1);

    const guide = guideMap.get(preferredGuideUid);
    if (!guide) {
      // Invalid guide preference, retry with next
      freeTeams.push(teamId);
      continue;
    }

    const currentAssigned = guideAssignments.get(preferredGuideUid) || [];
    const capacityLimit = guide.loadLimit;

    if (guide.currentLoad < capacityLimit) {
      // Guide has open capacity
      currentAssigned.push(teamId);
      guideAssignments.set(preferredGuideUid, currentAssigned);
      guide.currentLoad += 1;
    } else {
      // Guide is at capacity: check if new team outranks the worst accepted team
      currentAssigned.sort((a, b) => compareTeamsForGuide(a, b, guide));
      const worstTeamId = currentAssigned[0];

      if (compareTeamsForGuide(teamId, worstTeamId, guide) > 0) {
        // Replace worst team
        currentAssigned.shift();
        currentAssigned.push(teamId);
        guideAssignments.set(preferredGuideUid, currentAssigned);

        // Put displaced team back into free teams queue
        freeTeams.push(worstTeamId);
      } else {
        // Rejected; team remains free to propose to next choice
        freeTeams.push(teamId);
      }
    }
  }

  // 4. Record auto matching results
  for (const [guideUid, assignedTeamIds] of guideAssignments.entries()) {
    for (const teamId of assignedTeamIds) {
      const team = teamMap.get(teamId);
      if (!team || !team.rankedGuideUids) continue;

      const rankIndex = team.rankedGuideUids.indexOf(guideUid);
      let satLabel = '4th+';
      if (rankIndex === 0) satLabel = '1st';
      else if (rankIndex === 1) satLabel = '2nd';
      else if (rankIndex === 2) satLabel = '3rd';

      allocationMap.set(teamId, {
        teamId,
        assignedGuideUid: guideUid,
        preferenceSatisfied: satLabel,
        assignedBy: 'auto',
        isPreLocked: false,
        matchedRank: rankIndex >= 0 ? rankIndex + 1 : null
      });
    }
  }

  // 5. Post-pass balance repair
  // If an underloaded guide has capacity and a low-satisfaction team matches their domain,
  // evaluate improving reassignment.
  for (const [teamId, alloc] of allocationMap.entries()) {
    if (alloc.isPreLocked || !alloc.assignedGuideUid) continue;

    const currentRank = alloc.matchedRank || 999;
    if (currentRank > 2) {
      const team = teamMap.get(teamId);
      if (!team || !team.rankedGuideUids) continue;

      for (let r = 0; r < currentRank - 1; r++) {
        const higherChoiceUid = team.rankedGuideUids[r];
        const higherGuide = guideMap.get(higherChoiceUid);
        if (higherGuide && higherGuide.currentLoad < higherGuide.loadLimit) {
          // Reassign to higher choice
          const oldGuide = guideMap.get(alloc.assignedGuideUid);
          if (oldGuide) oldGuide.currentLoad -= 1;
          higherGuide.currentLoad += 1;

          alloc.assignedGuideUid = higherChoiceUid;
          alloc.matchedRank = r + 1;
          alloc.preferenceSatisfied = r === 0 ? '1st' : r === 1 ? '2nd' : '3rd';
          break;
        }
      }
    }
  }

  const finalAllocations = Array.from(allocationMap.values());
  const unassignedTeams = teams.filter(t => {
    const a = allocationMap.get(t.id);
    return !a || !a.assignedGuideUid;
  });

  const stats = calculateSatisfactionStats(finalAllocations, teams, guides);

  return {
    allocations: finalAllocations,
    stats,
    unassignedTeams
  };
}

/**
 * Calculate department-wide satisfaction statistics
 * @param {AllocationResult[]} allocations
 * @param {Team[]} teams
 * @param {Guide[]} guides
 * @returns {SatisfactionStats}
 */
export function calculateSatisfactionStats(allocations, teams, guides) {
  const totalTeams = teams.length;
  let assignedCount = 0;
  let unassignedCount = 0;
  let firstChoiceCount = 0;
  let secondChoiceCount = 0;
  let thirdChoiceCount = 0;
  let lowerChoiceCount = 0;
  let preLockedCount = 0;
  let manualOverrideCount = 0;

  /** @type {Object<string, number>} */
  const guideLoads = {};
  if (Array.isArray(guides)) {
    for (const g of guides) {
      guideLoads[g.uid] = 0;
    }
  }

  for (const a of allocations) {
    if (a.assignedGuideUid) {
      assignedCount++;
      guideLoads[a.assignedGuideUid] = (guideLoads[a.assignedGuideUid] || 0) + 1;
    } else {
      unassignedCount++;
    }

    if (a.isPreLocked) preLockedCount++;
    else if (a.assignedBy === 'manual') manualOverrideCount++;
    else if (a.preferenceSatisfied === '1st') firstChoiceCount++;
    else if (a.preferenceSatisfied === '2nd') secondChoiceCount++;
    else if (a.preferenceSatisfied === '3rd') thirdChoiceCount++;
    else if (a.preferenceSatisfied === '4th+') lowerChoiceCount++;
  }

  const loads = Object.values(guideLoads);
  const maxGuideLoad = loads.length > 0 ? Math.max(...loads) : 0;
  const minGuideLoad = loads.length > 0 ? Math.min(...loads) : 0;

  const pct = (num) => (totalTeams > 0 ? Math.round((num / totalTeams) * 100) : 0);

  return {
    totalTeams,
    assignedCount,
    unassignedCount,
    firstChoiceCount,
    firstChoicePercent: pct(firstChoiceCount),
    secondChoiceCount,
    secondChoicePercent: pct(secondChoiceCount),
    thirdChoiceCount,
    thirdChoicePercent: pct(thirdChoiceCount),
    lowerChoiceCount,
    preLockedCount,
    manualOverrideCount,
    guideLoads,
    maxGuideLoad,
    minGuideLoad
  };
}

/**
 * Apply a manual coordinator override to an allocation.
 * Supports force-assignment beyond load limits when explicit typed reason is provided.
 * @param {Object} params
 * @param {AllocationResult[]} params.allocations
 * @param {Guide[]} params.guides
 * @param {Team[]} params.teams
 * @param {string} params.teamId
 * @param {string} params.targetGuideUid
 * @param {string} params.actorUid
 * @param {string} [params.reason='']
 * @param {boolean} [params.force=false]
 * @returns {{ allocations: AllocationResult[], stats: SatisfactionStats, warning?: string }}
 */
export function applyManualOverride({
  allocations,
  guides,
  teams,
  teamId,
  targetGuideUid,
  actorUid,
  reason = '',
  force = false
}) {
  if (!teamId || !targetGuideUid || !actorUid) {
    throw new Error('teamId, targetGuideUid, and actorUid are required for override');
  }

  const guide = guides.find(g => g.uid === targetGuideUid);
  if (!guide) {
    throw new Error(`Guide with UID ${targetGuideUid} does not exist`);
  }

  const team = teams.find(t => t.id === teamId);
  if (!team) {
    throw new Error(`Team with ID ${teamId} does not exist`);
  }

  // Count current load for target guide
  const currentAssigned = allocations.filter(a => a.assignedGuideUid === targetGuideUid && a.teamId !== teamId).length;
  const willExceedCapacity = currentAssigned + 1 > guide.loadLimit;

  if (willExceedCapacity && !force) {
    throw new Error(
      `Guide ${guide.name} is at capacity (${currentAssigned}/${guide.loadLimit}). Use force=true with a typed reason to override.`
    );
  }

  if (willExceedCapacity && force && (!reason || reason.trim().length < 5)) {
    throw new Error('Overriding capacity requires a typed justification reason of at least 5 characters');
  }

  let matchedRank = null;
  let preferenceSatisfied = 'manual';
  if (team.rankedGuideUids) {
    const idx = team.rankedGuideUids.indexOf(targetGuideUid);
    if (idx >= 0) {
      matchedRank = idx + 1;
      preferenceSatisfied = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : '4th+';
    }
  }

  const updatedAllocations = allocations.map(a => {
    if (a.teamId === teamId) {
      return {
        ...a,
        assignedGuideUid: targetGuideUid,
        preferenceSatisfied,
        assignedBy: /** @type {'manual'} */ ('manual'),
        isPreLocked: false,
        overrideReason: reason || 'Manual reassignment by coordinator',
        overrideBy: actorUid,
        matchedRank
      };
    }
    return a;
  });

  const existingAlloc = updatedAllocations.find(a => a.teamId === teamId);
  if (!existingAlloc) {
    updatedAllocations.push({
      teamId,
      assignedGuideUid: targetGuideUid,
      preferenceSatisfied,
      assignedBy: 'manual',
      isPreLocked: false,
      overrideReason: reason || 'Manual assignment by coordinator',
      overrideBy: actorUid,
      matchedRank
    });
  }

  const stats = calculateSatisfactionStats(updatedAllocations, teams, guides);
  const warning = willExceedCapacity
    ? `Guide ${guide.name} load exceeds capacity limit (${currentAssigned + 1}/${guide.loadLimit})`
    : undefined;

  return {
    allocations: updatedAllocations,
    stats,
    warning
  };
}
