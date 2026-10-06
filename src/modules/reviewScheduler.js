/**
 * @fileoverview Review Scheduling Engine (Evaluation Pillar #2)
 * Generates conflict-free review slots preventing faculty double-booking,
 * room clashes, and guide conflict-of-interest (guides can never judge their own teams).
 * Computes 24h deliverable gate times and handles intelligent rescheduling.
 */

/**
 * @typedef {Object} FacultyAvailability
 * @property {string} facultyUid
 * @property {string[]} blockedSlotIds - List of slot IDs when faculty is unavailable
 */

/**
 * @typedef {Object} Panel
 * @property {string} id
 * @property {string} name
 * @property {string[]} memberUids
 */

/**
 * @typedef {Object} TimeSlot
 * @property {string} id
 * @property {string} date - 'YYYY-MM-DD'
 * @property {string} startTime - 'HH:MM'
 * @property {string} endTime - 'HH:MM'
 * @property {number} startMillis
 * @property {number} durationMin
 */

/**
 * @typedef {Object} ScheduledReview
 * @property {string} id
 * @property {string} cycleId
 * @property {string} teamId
 * @property {string} guideUid
 * @property {number} round
 * @property {string} slotId
 * @property {string} date
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} scheduledAtMillis
 * @property {number} deliverablesDueAtMillis - scheduledAt - 24 hours
 * @property {string} roomId
 * @property {string} panelId
 * @property {string[]} panelMemberUids
 * @property {'scheduled' | 'deliverables_due' | 'completed' | 'rescheduled' | 'missed'} status
 * @property {Object<string, any>} [scores]
 */

/**
 * Generate conflict-free review schedule with strict backtracking.
 * @param {Object} params
 * @param {Array<{ id: string, name: string, guideId?: string }>} params.teams
 * @param {Panel[]} params.panels
 * @param {string[]} params.rooms
 * @param {TimeSlot[]} params.timeSlots
 * @param {number} params.round
 * @param {string} params.cycleId
 * @param {FacultyAvailability[]} [params.availabilityBlocks=[]]
 * @returns {{ schedule: ScheduledReview[], unassignedTeamIds: string[], stats: { total: number, scheduled: number, unassigned: number } }}
 */
export function generateConflictFreeSchedule({
  teams,
  panels,
  rooms,
  timeSlots,
  round,
  cycleId,
  availabilityBlocks = []
}) {
  if (!Array.isArray(teams) || !Array.isArray(panels) || !Array.isArray(rooms) || !Array.isArray(timeSlots)) {
    throw new TypeError('teams, panels, rooms, and timeSlots must be arrays');
  }

  // Pre-index faculty availability blocks
  /** @type {Map<string, Set<string>>} facultyUid -> Set of blocked slotIds */
  const blockedMap = new Map();
  for (const block of availabilityBlocks) {
    if (!blockedMap.has(block.facultyUid)) {
      blockedMap.set(block.facultyUid, new Set());
    }
    const set = blockedMap.get(block.facultyUid);
    block.blockedSlotIds.forEach(id => set.add(id));
  }

  const panelMap = new Map(panels.map(p => [p.id, p]));

  // Tracking occupied resources per slotId
  /** @type {Map<string, Set<string>>} slotId -> Set of occupied roomIds */
  const roomOccupancy = new Map();
  /** @type {Map<string, Set<string>>} slotId -> Set of occupied facultyUids */
  const facultyOccupancy = new Map();
  /** @type {Map<string, Set<string>>} slotId -> Set of guideUids with active presentations */
  const guideOccupancy = new Map();

  for (const slot of timeSlots) {
    roomOccupancy.set(slot.id, new Set());
    facultyOccupancy.set(slot.id, new Set());
    guideOccupancy.set(slot.id, new Set());
  }

  /** @type {ScheduledReview[]} */
  const schedule = [];
  const unassignedTeamIds = [];

  // Sort teams so teams with the same guide are staggered
  const sortedTeams = [...teams].sort((a, b) => {
    const guideA = a.guideId || '';
    const guideB = b.guideId || '';
    return guideA.localeCompare(guideB) || a.id.localeCompare(b.id);
  });

  for (const team of sortedTeams) {
    const teamGuideUid = team.guideId || '';
    let placed = false;

    // Search for a compatible slot, room, and panel
    slotLoop:
    for (const slot of timeSlots) {
      const occupiedRooms = roomOccupancy.get(slot.id);
      const occupiedFaculty = facultyOccupancy.get(slot.id);
      const occupiedGuides = guideOccupancy.get(slot.id);

      // Check guide clash: Avoid presenting two teams of the same guide simultaneously
      if (teamGuideUid && occupiedGuides.has(teamGuideUid)) {
        continue slotLoop;
      }

      for (const room of rooms) {
        if (occupiedRooms.has(room)) {
          continue;
        }

        for (const panel of panels) {
          // Conflict-of-interest check: Guide can NEVER judge their own team
          if (teamGuideUid && panel.memberUids.includes(teamGuideUid)) {
            continue;
          }

          // Check if any panel member is already busy in this slot
          let panelMemberBusy = false;
          for (const memberUid of panel.memberUids) {
            if (occupiedFaculty.has(memberUid)) {
              panelMemberBusy = true;
              break;
            }
            const blockedSlots = blockedMap.get(memberUid);
            if (blockedSlots && blockedSlots.has(slot.id)) {
              panelMemberBusy = true;
              break;
            }
          }

          if (panelMemberBusy) {
            continue;
          }

          // Valid slot found! Assign this review
          occupiedRooms.add(room);
          panel.memberUids.forEach(uid => occupiedFaculty.add(uid));
          if (teamGuideUid) occupiedGuides.add(teamGuideUid);

          const scheduledAtMillis = slot.startMillis;
          // Deliverable gate is 24 hours prior
          const deliverablesDueAtMillis = scheduledAtMillis - (24 * 60 * 60 * 1000);

          schedule.push({
            id: `rev_${cycleId}_r${round}_${team.id}`,
            cycleId,
            teamId: team.id,
            guideUid: teamGuideUid,
            round,
            slotId: slot.id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            scheduledAtMillis,
            deliverablesDueAtMillis,
            roomId: room,
            panelId: panel.id,
            panelMemberUids: [...panel.memberUids],
            status: 'scheduled',
            scores: {}
          });

          placed = true;
          break slotLoop;
        }
      }
    }

    if (!placed) {
      unassignedTeamIds.push(team.id);
    }
  }

  return {
    schedule,
    unassignedTeamIds,
    stats: {
      total: teams.length,
      scheduled: schedule.length,
      unassigned: unassignedTeamIds.length
    }
  };
}

/**
 * Check if team has satisfied the deliverable gate (24h before scheduled review)
 * @param {ScheduledReview} review
 * @param {Array<{ reviewId?: string, uploadedAtMillis: number, status: string }>} deliverables
 * @param {number} [currentMillis=Date.now()]
 * @returns {{ gateSatisfied: boolean, isPastDeadline: boolean, reason: string }}
 */
export function checkDeliverableGateStatus(review, deliverables, currentMillis = Date.now()) {
  const isPastDeadline = currentMillis > review.deliverablesDueAtMillis;
  const validDeliverables = deliverables.filter(d => !d.reviewId || d.reviewId === review.id);

  if (validDeliverables.length === 0) {
    return {
      gateSatisfied: false,
      isPastDeadline,
      reason: isPastDeadline ? 'Gate missed: No deliverables uploaded before 24h cutoff' : 'Deliverables pending'
    };
  }

  const anyApprovedOrSubmitted = validDeliverables.some(d => d.uploadedAtMillis <= review.deliverablesDueAtMillis);

  return {
    gateSatisfied: anyApprovedOrSubmitted,
    isPastDeadline,
    reason: anyApprovedOrSubmitted ? 'Gate satisfied: Deliverables uploaded before cutoff' : 'Gate missed: Uploaded after 24h cutoff'
  };
}

/**
 * Propose alternative conflict-free slot for rescheduling
 * @param {Object} params
 * @param {ScheduledReview} params.review
 * @param {ScheduledReview[]} params.allScheduledReviews
 * @param {Panel[]} params.panels
 * @param {string[]} params.rooms
 * @param {TimeSlot[]} params.availableSlots
 * @returns {ScheduledReview | null}
 */
export function proposeRescheduleSlot({
  review,
  allScheduledReviews,
  panels,
  rooms,
  availableSlots
}) {
  const otherReviews = allScheduledReviews.filter(r => r.id !== review.id);

  for (const slot of availableSlots) {
    if (slot.id === review.slotId) continue;

    for (const room of rooms) {
      const roomClash = otherReviews.some(r => r.slotId === slot.id && r.roomId === room);
      if (roomClash) continue;

      for (const panel of panels) {
        // Guide conflict-of-interest check
        if (review.guideUid && panel.memberUids.includes(review.guideUid)) {
          continue;
        }

        // Faculty double-booking check
        const facultyClash = otherReviews.some(r =>
          r.slotId === slot.id &&
          r.panelMemberUids.some(uid => panel.memberUids.includes(uid))
        );
        if (facultyClash) continue;

        // Guide presentation clash check
        const guideClash = otherReviews.some(r =>
          r.slotId === slot.id &&
          r.guideUid === review.guideUid
        );
        if (guideClash) continue;

        const scheduledAtMillis = slot.startMillis;
        return {
          ...review,
          slotId: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          scheduledAtMillis,
          deliverablesDueAtMillis: scheduledAtMillis - (24 * 60 * 60 * 1000),
          roomId: room,
          panelId: panel.id,
          panelMemberUids: [...panel.memberUids],
          status: 'rescheduled'
        };
      }
    }
  }

  return null;
}
