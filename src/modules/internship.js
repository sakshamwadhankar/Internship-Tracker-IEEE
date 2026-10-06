/**
 * @fileoverview Internship Approval Workflow Engine
 * State transitions, role approval gates (guide approval then coordinator approval),
 * document verification, and academic credit calculation.
 */

/**
 * @typedef {'applied' | 'offer_uploaded' | 'guide_approved' | 'coordinator_approved' | 'completed' | 'rejected'} InternshipStatus
 */

/**
 * @typedef {Object} InternshipRecord
 * @property {string} id
 * @property {string} studentUid
 * @property {string} studentName
 * @property {string} company
 * @property {string} role
 * @property {string} mentorName
 * @property {string} startDate - YYYY-MM-DD
 * @property {string} endDate - YYYY-MM-DD
 * @property {number} durationWeeks
 * @property {string} [offerLetterDocId]
 * @property {string} [reportDocId]
 * @property {string} [certificateDocId]
 * @property {InternshipStatus} status
 * @property {Object} approvals
 * @property {{ approvedBy: string, approvedAtMillis: number, remarks?: string }} [approvals.guide]
 * @property {{ approvedBy: string, approvedAtMillis: number, remarks?: string }} [approvals.coordinator]
 * @property {number} creditsEarned
 * @property {string} [rejectionReason]
 */

/**
 * Calculate academic credits based on internship duration
 * @param {number} durationWeeks
 * @returns {number}
 */
export function calculateInternshipCredits(durationWeeks) {
  if (durationWeeks >= 12) return 6;
  if (durationWeeks >= 8) return 4;
  if (durationWeeks >= 4) return 2;
  return 0;
}

/**
 * Transition internship to guide approved status
 * @param {InternshipRecord} internship
 * @param {string} guideUid
 * @param {string} [remarks='']
 * @returns {InternshipRecord}
 */
export function approveByGuide(internship, guideUid, remarks = '') {
  if (!internship.offerLetterDocId && internship.status !== 'applied') {
    throw new Error('Cannot approve internship without uploaded offer letter document');
  }

  if (internship.status === 'rejected') {
    throw new Error('Cannot approve an internship that was previously rejected');
  }

  return {
    ...internship,
    status: 'guide_approved',
    approvals: {
      ...internship.approvals,
      guide: {
        approvedBy: guideUid,
        approvedAtMillis: Date.now(),
        remarks
      }
    }
  };
}

/**
 * Transition internship to coordinator approved status
 * @param {InternshipRecord} internship
 * @param {string} coordinatorUid
 * @param {string} [remarks='']
 * @returns {InternshipRecord}
 */
export function approveByCoordinator(internship, coordinatorUid, remarks = '') {
  if (internship.status !== 'guide_approved' && internship.status !== 'offer_uploaded') {
    throw new Error('Guide approval is required before coordinator can approve internship');
  }

  const credits = calculateInternshipCredits(internship.durationWeeks);

  return {
    ...internship,
    status: 'coordinator_approved',
    creditsEarned: credits,
    approvals: {
      ...internship.approvals,
      coordinator: {
        approvedBy: coordinatorUid,
        approvedAtMillis: Date.now(),
        remarks
      }
    }
  };
}

/**
 * Reject an internship application with required reason
 * @param {InternshipRecord} internship
 * @param {string} actorUid
 * @param {string} reason
 * @returns {InternshipRecord}
 */
export function rejectInternship(internship, actorUid, reason) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('A detailed rejection reason is required (min 5 chars)');
  }

  return {
    ...internship,
    status: 'rejected',
    rejectionReason: reason
  };
}
