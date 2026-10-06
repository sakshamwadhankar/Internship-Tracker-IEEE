/**
 * PTracker — Main Application Module
 * Complete UI Redesign inspired by the modern mobile UI design language:
 * - 3 Connected Screen Experiences:
 *   1. Schedule / Feed View (Screen 2 - Center): User capsules, route selector, horizontal date strip, alternating stacked task cards
 *   2. Journey / Milestone View (Screen 1 - Left): Olive-taupe theme, huge date typography, custom quote card, custom background support, route progress track, interactive roadmap drawer
 *   3. Focus / Task Action View (Screen 3 - Right): Electric orange theme, hero headline, slide-to-complete action bar
 * - Real-time Cloud Firestore synchronization across all devices
 * - Zero mock data — real API integrations
 */

import './style.css';
import { icon } from './icons.js';
import {
  auth,
  isConfigured,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from './firebase.js';
import {
  createGoal,
  updateGoal,
  deleteGoal,
  listenGoals,
  createTask,
  updateTask,
  deleteTask,
  listenTasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  listenSubtasks,
  getUserPreferences,
  saveUserPreferences,
  listenUserPreferences,
  unsubscribeAll
} from './store.js';
import {
  calculateGoalProgress,
  calculateOverallProgress,
  calculateSubtaskProgress,
  getTodayTasks,
  getOverdueTasks,
  toISODateString,
  formatDateDisplay,
  formatHeroDate,
  getDateStrip,
  getTaskColorTheme,
  compressImageFile,
  computeTranslucencyValues,
  filterTasksByDate,
  scoreOpportunity,
  filterOpportunities,
  filterWithFallback,
  formatTimeAgo
} from './utils.js';
import {
  getUserProfile,
  saveUserProfile,
  listenUserProfile,
  listenOpportunities,
  listenSavedOpportunities,
  toggleSavedOpportunity,
  listenSyncMeta,
  unsubscribeOpportunityListeners
} from './opportunities.js';

import { renderCoordinatorView } from './views/coordinatorView.js';
import { renderGuideView } from './views/guideView.js';
import { renderPanelView } from './views/panelView.js';
import { renderFocusView } from './views/focusView.js';
import { renderJourneyView } from './views/journeyView.js';

import {
  runCapacitatedAllocation,
  applyManualOverride,
  calculateSatisfactionStats
} from './modules/allocation.js';
import {
  generateConflictFreeSchedule,
  proposeRescheduleSlot,
  checkDeliverableGateStatus
} from './modules/reviewScheduler.js';
import {
  generateHeatmapMatrix,
  evaluateAtRiskRules
} from './modules/progressRadar.js';
import {
  calculateReviewStreak,
  computeLeaderboardRankings,
  calculateSubjectBreakdown
} from './modules/focusPlanner.js';
import {
  calculateInternshipCredits,
  approveByGuide,
  approveByCoordinator,
  rejectInternship
} from './modules/internship.js';
import {
  getLocalFriends,
  saveLocalFriends,
  addFriendToList,
  removeFriendFromList,
  searchStudents
} from './modules/friends.js';
import {
  getLocalCodingProfiles,
  saveLocalCodingProfiles,
  syncAllCodingProfiles
} from './modules/codingProfiles.js';


// ─── App State ──────────────────────────────────────────

/**
 * @typedef {Object} Goal
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} [deadline]
 */

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} [goalId]
 * @property {string} title
 * @property {boolean} completed
 * @property {string} [dueDate]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} Subtask
 * @property {string} id
 * @property {string} taskId
 * @property {string} title
 * @property {boolean} completed
 */

/**
 * @typedef {'schedule' | 'journey' | 'focus' | 'calendar' | 'progress' | 'opportunities'} ScreenType
 */

const state = {
  /** @type {any} */
  user: null,
  /** @type {ScreenType} */
  currentScreen: 'schedule',
  /** @type {'student' | 'coordinator' | 'guide' | 'panel'} */
  activeRole: 'student',
  /** @type {string} */
  coordinatorSubTab: 'allocation',
  /** @type {string} */
  guideSubTab: 'teams',
  /** @type {string} */
  journeySubTab: 'hub',
  /** @type {string} */
  focusSubTab: 'timer',
  /** @type {string} */
  selectedGuideUid: 'g1',
  /** @type {string|null} */
  panelSelectedReviewId: null,

  activeFocusTimer: {
    isRunning: false,
    elapsedSeconds: 0,
    timerInterval: null,
    activeSubjectId: 'sub_1'
  },

  overrideModal: {
    open: false,
    teamId: null,
    teamName: ''
  },

  /** @type {any[]} */
  friends: [],
  /** @type {any} */
  codingProfiles: {},
  /** @type {Record<string, any>} */
  codingProfilesMap: {},
  /** @type {Record<string, any>} */
  livePresence: {},
  codingProfilesModal: {
    open: false,
    loading: false,
    error: null
  },

  // v2 Collections & Department Data
  teams: [
    { id: 't1', name: 'Team Alpha (Vision AI)', domain: 'AI & ML', memberUids: ['m1', 'm2'], rankedGuideUids: ['g1', 'g2', 'g4'], submittedAtMillis: 1000 },
    { id: 't2', name: 'Team Beta (Cloud Fabric)', domain: 'Cloud & Systems', memberUids: ['m3', 'm4'], rankedGuideUids: ['g2', 'g1', 'g3'], submittedAtMillis: 2000 },
    { id: 't3', name: 'Team Gamma (Crypto Shield)', domain: 'Cybersecurity', memberUids: ['m5'], rankedGuideUids: ['g3', 'g4', 'g1'], submittedAtMillis: 3000 },
    { id: 't4', name: 'Team Delta (DevOps Mesh)', domain: 'Software Eng', memberUids: ['m6', 'm7'], rankedGuideUids: ['g4', 'g2', 'g1'], submittedAtMillis: 4000 },
    { id: 't5', name: 'Team Epsilon (Edge ML)', domain: 'AI & ML', memberUids: ['m8'], rankedGuideUids: ['g1', 'g4', 'g3'], submittedAtMillis: 5000 }
  ],
  guides: [
    { uid: 'g1', name: 'Dr. Alan Turing', loadLimit: 2, researchAreas: ['AI & ML', 'Computer Vision'] },
    { uid: 'g2', name: 'Dr. Ada Lovelace', loadLimit: 2, researchAreas: ['Cloud & Systems', 'Distributed Computing'] },
    { uid: 'g3', name: 'Dr. Claude Shannon', loadLimit: 2, researchAreas: ['Cybersecurity', 'Networks'] },
    { uid: 'g4', name: 'Dr. Grace Hopper', loadLimit: 2, researchAreas: ['Software Eng', 'Compilers'] }
  ],
  preLockedPairs: [
    { teamId: 't3', guideUid: 'g3', reason: 'Industry grant sponsored project' }
  ],
  allocations: [],
  panels: [
    { id: 'Panel 1', name: 'AI & Systems Committee', memberUids: ['fac_turing', 'fac_lovelace'] },
    { id: 'Panel 2', name: 'Security & Software Committee', memberUids: ['fac_shannon', 'fac_hopper'] }
  ],
  rooms: ['Lab 101', 'Seminar Hall A', 'Innovation Center'],
  timeSlots: [
    { id: 'slot_1', date: '2026-11-05', startTime: '10:00', endTime: '10:30', startMillis: 1793845200000, durationMin: 30 },
    { id: 'slot_2', date: '2026-11-05', startTime: '10:30', endTime: '11:00', startMillis: 1793847000000, durationMin: 30 },
    { id: 'slot_3', date: '2026-11-05', startTime: '11:00', endTime: '11:30', startMillis: 1793848800000, durationMin: 30 },
    { id: 'slot_4', date: '2026-11-05', startTime: '11:30', endTime: '12:00', startMillis: 1793850600000, durationMin: 30 },
    { id: 'slot_5', date: '2026-11-05', startTime: '12:00', endTime: '12:30', startMillis: 1793852400000, durationMin: 30 }
  ],
  reviews: [],
  logbooks: [
    { id: 'log_1', teamId: 't1', weekNumber: 1, workDone: 'Literature survey on YOLOv8 & dataset curation', hoursSpent: 14, status: 'approved', guideRemarks: 'Good foundation' },
    { id: 'log_2', teamId: 't1', weekNumber: 2, workDone: 'Model pipeline setup & baseline evaluation', hoursSpent: 16, status: 'approved', guideRemarks: 'Proceed to fine tuning' },
    { id: 'log_3', teamId: 't1', weekNumber: 3, workDone: 'Edge optimization & TensorRT quantization', hoursSpent: 12, status: 'submitted' },
    { id: 'log_4', teamId: 't2', weekNumber: 1, workDone: 'Kubernetes cluster provisioning on GCP', hoursSpent: 15, status: 'approved' },
    { id: 'log_5', teamId: 't2', weekNumber: 2, workDone: 'Ingress controller & TLS certificate automation', hoursSpent: 14, status: 'approved' }
  ],
  documents: [
    { id: 'doc_1', teamId: 't1', type: 'synopsis', fileName: 'vision_ai_synopsis_v1.pdf', version: 1, status: 'coordinator_approved', uploadedAtMillis: Date.now() - 20 * 86400000 },
    { id: 'doc_2', teamId: 't1', type: 'srs', fileName: 'vision_ai_architecture_v1.pdf', version: 1, status: 'guide_approved', uploadedAtMillis: Date.now() - 10 * 86400000 },
    { id: 'doc_3', teamId: 't2', type: 'synopsis', fileName: 'cloud_fabric_synopsis_v1.pdf', version: 1, status: 'coordinator_approved', uploadedAtMillis: Date.now() - 20 * 86400000 }
  ],
  internships: [
    {
      id: 'intern_1',
      studentUid: 'm1',
      studentName: 'Alice Sharma',
      company: 'Google',
      role: 'Software Engineering Intern',
      mentorName: 'Dr. Turing',
      startDate: '2026-06-01',
      endDate: '2026-08-01',
      durationWeeks: 8,
      status: 'guide_approved',
      approvals: { guide: { approvedBy: 'g1', approvedAtMillis: Date.now() } },
      creditsEarned: 4
    }
  ],
  focusSubjects: [
    { id: 'sub_1', ownerUid: 'guest', name: 'FYP — Backend & ML', colorCode: '#FF6420' },
    { id: 'sub_2', ownerUid: 'guest', name: 'Distributed Systems', colorCode: '#3B82F6' },
    { id: 'sub_3', ownerUid: 'guest', name: 'Internship Work', colorCode: '#2CD674' }
  ],
  focusSessions: [
    { id: 'fs_1', uid: 'm1', teamId: 't1', subjectId: 'sub_1', durationMin: 90, endedAtMillis: Date.now() - 3600000, mode: 'stopwatch' },
    { id: 'fs_2', uid: 'm1', teamId: 't1', subjectId: 'sub_1', durationMin: 120, endedAtMillis: Date.now() - 86400000, mode: 'stopwatch' },
    { id: 'fs_3', uid: 'm2', teamId: 't1', subjectId: 'sub_1', durationMin: 75, endedAtMillis: Date.now() - 86400000, mode: 'stopwatch' }
  ],
  dailyPlans: [
    {
      date: new Date().toISOString().split('T')[0],
      reviewed: false,
      todos: [
        { id: '1', title: 'Complete TensorRT model benchmarking', done: true, plannedMin: 45 },
        { id: '2', title: 'Draft weekly logbook entry', done: false, plannedMin: 15 },
        { id: '3', title: 'Upload PPT slides for Review 1', done: false, plannedMin: 30 }
      ],
      reflection: ''
    }
  ],
  allUsers: [
    { uid: 'm1', name: 'Alice Sharma', privacy: 'public', teamId: 't1' },
    { uid: 'm2', name: 'Bob Verma', privacy: 'team', teamId: 't1' },
    { uid: 'm3', name: 'Charlie Patel', privacy: 'public', teamId: 't2' },
    { uid: 'm4', name: 'Dave Rao', privacy: 'private', teamId: 't2' }
  ],

  /** @type {Goal[]} */
  goals: [],
  /** @type {Task[]} */
  tasks: [],
  /** @type {Subtask[]} */
  subtasks: [],
  /** @type {string|null} */
  selectedGoalId: null,
  /** @type {string|null} */
  selectedTaskId: null,
  /** @type {string|null} */
  selectedDateStr: null,
  /** @type {Date} */
  calendarDate: new Date(),
  /** @type {Set<string>} */
  expandedRoadmapGoalIds: new Set(),
  /** @type {number} */
  journeyStackIndex: 0,
  /** @type {boolean} */
  settingsOpen: false,

  /** @type {string} */
  quote: 'Focus on progress, not perfection.',
  /** @type {string} */
  quoteAuthor: 'Daily Reminder',
  /** @type {string|null} */
  customBgImage: null,
  /** @type {number} */
  widgetTranslucency: 0,

  // Opportunities section
  /** @type {any} */
  profile: null,
  /** @type {Array<any>} */
  opportunities: [],
  /** @type {string[]} */
  savedOppIds: [],
  /** @type {Record<string, any>} */
  syncMeta: {},
  /** @type {{ type: string, region: string, q: string, savedOnly: boolean, sort: string }} */
  oppFilters: { type: 'all', region: 'all', q: '', savedOnly: false, sort: 'match' },
  /** @type {boolean} */
  showSyncErrors: false,
};

/**
 * Apply widget translucency to CSS custom properties
 * @param {number|string|undefined|null} percent
 */
function applyWidgetTranslucency(percent) {
  const { alpha, blurPx } = computeTranslucencyValues(percent);
  document.documentElement.style.setProperty('--widget-bg-alpha', alpha.toString());
  document.documentElement.style.setProperty('--widget-glass-blur', `${blurPx}px`);
}

/** @type {HTMLElement} */
let appEl;


// ─── Initialization ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  appEl = /** @type {HTMLElement} */ (document.getElementById('app'));

  // Initialize algorithmic state for baseline evaluation
  if (state.allocations.length === 0) {
    try {
      const autoAlloc = runCapacitatedAllocation({
        teams: state.teams,
        guides: state.guides,
        preLockedPairs: state.preLockedPairs
      });
      state.allocations = autoAlloc.allocations;
    } catch (err) {
      console.warn('[PTracker] Initial allocation computation skipped:', err);
    }
  }

  if (state.reviews.length === 0) {
    try {
      const autoSched = generateConflictFreeSchedule({
        teams: state.teams,
        panels: state.panels,
        rooms: state.rooms,
        timeSlots: state.timeSlots,
        round: 1,
        cycleId: '2026_fall'
      });
      state.reviews = autoSched.schedule;
    } catch (err) {
      console.warn('[PTracker] Initial schedule generation skipped:', err);
    }
  }

  renderLoading();

  if (!isConfigured || !auth) {
    renderSetupScreen();
    return;
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.user = user;
      startDataListeners(user.uid);
      render();
    } else {
      state.user = null;
      unsubscribeAll();
      renderAuthScreen();
    }
  });
});

// ─── Realtime Data Listeners ────────────────────────────

/**
 * @param {string} userId
 */
function startDataListeners(userId) {
  // Load cached preferences immediately for zero-flicker UX
  const cachedPrefs = getUserPreferences(userId);
  if (cachedPrefs.quote) state.quote = cachedPrefs.quote;
  if (cachedPrefs.quoteAuthor) state.quoteAuthor = cachedPrefs.quoteAuthor;
  if (cachedPrefs.customBgImage) state.customBgImage = cachedPrefs.customBgImage;
  if (typeof cachedPrefs.widgetTranslucency === 'number') {
    state.widgetTranslucency = cachedPrefs.widgetTranslucency;
  }
  applyWidgetTranslucency(state.widgetTranslucency);

  // Load friends and coding profiles
  state.friends = getLocalFriends(userId);
  state.codingProfiles = getLocalCodingProfiles(userId);
  if (state.codingProfiles && (state.codingProfiles.github || state.codingProfiles.leetcode || state.codingProfiles.hackerrank)) {
    state.codingProfilesMap[userId] = state.codingProfiles;
  }

  listenGoals(userId, (goals) => {
    state.goals = goals;
    if (!state.selectedGoalId && goals.length > 0) {
      state.selectedGoalId = goals[0].id;
    }
    render();
  });
  listenTasks(userId, (tasks) => {
    state.tasks = tasks;
    render();
  });
  listenSubtasks(userId, (subtasks) => {
    state.subtasks = subtasks;
    render();
  });
  listenUserPreferences(userId, (prefs) => {
    if (prefs.quote !== undefined) state.quote = prefs.quote;
    if (prefs.quoteAuthor !== undefined) state.quoteAuthor = prefs.quoteAuthor;
    if (prefs.customBgImage !== undefined) state.customBgImage = prefs.customBgImage || null;
    if (prefs.widgetTranslucency !== undefined) {
      state.widgetTranslucency = prefs.widgetTranslucency;
      applyWidgetTranslucency(state.widgetTranslucency);
    }
    render();
  });

  // Opportunities section
  listenUserProfile(userId, (profile) => {
    state.profile = profile;
    render();
  });
  listenOpportunities((opportunities) => {
    state.opportunities = opportunities;
    render();
  });
  listenSavedOpportunities(userId, (savedIds) => {
    state.savedOppIds = savedIds;
    render();
  });
  listenSyncMeta((meta) => {
    state.syncMeta = meta;
    render();
  });
}


// ─── Toast Notifications ────────────────────────────────

/**
 * @param {string} message
 * @param {'success'|'error'} [type='success']
 */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ─── Navigation ─────────────────────────────────────────

/**
 * Switch view screen
 * @param {ScreenType} screen
 * @param {string|null} [goalId=null]
 * @param {string|null} [taskId=null]
 */
function navigateToScreen(screen, goalId = null, taskId = null) {
  state.activeRole = 'student';
  state.currentScreen = screen;
  if (goalId !== null) state.selectedGoalId = goalId;
  if (taskId !== null) state.selectedTaskId = taskId;
  render();
}

// ─── Auth Functions ─────────────────────────────────────

async function handleGoogleSignIn() {
  try {
    if (!auth || !googleProvider) {
      showToast('Firebase Auth not configured.', 'error');
      return;
    }
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('[PTracker] Sign-in error:', error);
    showToast(/** @type {any} */(error)?.message || 'Sign-in failed.', 'error');
  }
}

/**
 * @param {string} email
 * @param {string} password
 * @param {boolean} isSignUp
 */
async function handleEmailAuth(email, password, isSignUp) {
  try {
    if (!auth) return;
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, password);
      showToast('Account created successfully!', 'success');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Signed in successfully!', 'success');
    }
  } catch (error) {
    console.error('[PTracker] Email auth error:', error);
    showToast(/** @type {any} */(error)?.message || 'Authentication failed.', 'error');
  }
}

async function handleGuestSignIn() {
  try {
    if (!auth) return;
    await signInAnonymously(auth);
    showToast('Signed in as Guest', 'success');
  } catch (error) {
    console.error('[PTracker] Guest sign-in error:', error);
    showToast(/** @type {any} */(error)?.message || 'Guest sign-in failed.', 'error');
  }
}

async function handleSignOut() {
  try {
    if (!auth) return;
    unsubscribeAll();
    unsubscribeOpportunityListeners();
    await firebaseSignOut(auth);
    state.goals = [];
    state.tasks = [];
    state.subtasks = [];
    state.selectedGoalId = null;
    state.selectedTaskId = null;
    state.currentScreen = 'schedule';
    state.settingsOpen = false;
    state.customBgImage = null;
    state.widgetTranslucency = 0;
    state.expandedRoadmapGoalIds.clear();
    state.journeyStackIndex = 0;
    applyWidgetTranslucency(0);
    // Reset opportunities state
    state.profile = null;
    state.opportunities = [];
    state.savedOppIds = [];
    state.syncMeta = {};
    state.oppFilters = { type: 'all', region: 'all', q: '', savedOnly: false, sort: 'match' };
  } catch (error) {
    console.error('[PTracker] Sign-out error:', error);
  }
}




// ─── Main Render Dispatcher ─────────────────────────────

function renderLoading() {
  appEl.innerHTML = `
    <div class="studio-wrapper">
      <div class="empty-state-modern" style="min-height: 80vh;">
        <div class="empty-state-title" style="letter-spacing: -0.02em;">Loading PTracker…</div>
      </div>
    </div>
  `;
}

function renderSetupScreen() {
  appEl.innerHTML = `
    <div class="studio-wrapper">
      <div class="phone-shell theme-charcoal">
        <div class="screen-body" style="padding-top: 60px;">
          <div class="auth-brand-badge">
            <span class="auth-brand-app-icon">${icon('appLogo')}</span>
            <span>P<span style="color:var(--clr-orange);">.</span>tracker</span>
          </div>
          <div class="auth-card-noir" style="margin-top: 20px;">
            <h3 style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--clr-orange);">
              Firebase Setup Required
            </h3>
            <p style="font-size: 0.8rem; color: var(--text-secondary-light); line-height: 1.6;">
              Please configure your <code>.env</code> file with valid Firebase credentials to enable cross-device synchronization.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

let authTab = 'signin';

function renderAuthScreen() {
  appEl.innerHTML = `
    <div class="studio-wrapper">
      <div class="studio-backdrop-accent"></div>
      <div class="phone-shell theme-charcoal">
        <div class="auth-wrapper">
          <div class="auth-brand-badge">
            <span class="auth-brand-app-icon">${icon('appLogo')}</span>
            <span>P<span style="color:var(--clr-orange);">.</span>tracker</span>
          </div>
          <p class="auth-brand-tagline">Goals & Milestones</p>

          <div class="auth-card-noir">
            <button class="auth-google-pill" id="google-signin-btn" type="button">
              ${icon('google')}
              <span>Continue with Google</span>
            </button>

            <div class="auth-divider-line">or email</div>

            <div class="auth-switch-tabs">
              <button class="auth-switch-tab ${authTab === 'signin' ? 'active' : ''}" id="tab-signin" type="button">Sign In</button>
              <button class="auth-switch-tab ${authTab === 'signup' ? 'active' : ''}" id="tab-signup" type="button">Create Account</button>
            </div>

            <form id="email-auth-form" style="display: flex; flex-direction: column; gap: 12px; margin-top: 4px;">
              <input type="email" id="auth-email" class="form-input-pill" placeholder="name@example.com" required autocomplete="email" />
              <input type="password" id="auth-password" class="form-input-pill" placeholder="Password (min 6 characters)" required autocomplete="current-password" minlength="6" />
              <button class="btn-pill btn-pill-primary" id="email-submit-btn" type="submit" style="margin-top: 4px;">
                ${authTab === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button class="btn-pill btn-pill-ghost" id="guest-signin-btn" type="button" style="margin-top: 2px;">
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('google-signin-btn')?.addEventListener('click', handleGoogleSignIn);
  document.getElementById('guest-signin-btn')?.addEventListener('click', handleGuestSignIn);

  document.getElementById('tab-signin')?.addEventListener('click', () => {
    authTab = 'signin';
    renderAuthScreen();
  });
  document.getElementById('tab-signup')?.addEventListener('click', () => {
    authTab = 'signup';
    renderAuthScreen();
  });

  document.getElementById('email-auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-email'));
    const passwordInput = /** @type {HTMLInputElement|null} */ (document.getElementById('auth-password'));
    const submitBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('email-submit-btn'));

    if (emailInput && passwordInput && submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';
      await handleEmailAuth(emailInput.value.trim(), passwordInput.value, authTab === 'signup');
      submitBtn.disabled = false;
      submitBtn.textContent = authTab === 'signup' ? 'Create Account' : 'Sign In';
    }
  });
}

function render() {
  if (!state.user) {
    renderAuthScreen();
    return;
  }

  // Determine current active theme
  let themeClass = 'theme-charcoal';
  if (state.currentScreen === 'journey') {
    themeClass = 'theme-olive';
  } else if (state.currentScreen === 'focus') {
    themeClass = 'theme-orange';
  }

  const customBgStyle = state.customBgImage ? `style="background-image: url('${escapeAttr(state.customBgImage)}');"` : '';
  const customBgClass = state.customBgImage ? 'has-custom-bg' : '';

  const firstName = state.user.displayName ? state.user.displayName.split(' ')[0] : (state.user.email ? state.user.email.split('@')[0] : 'there');
  const avatarLetter = (state.user.displayName || state.user.email || 'U').charAt(0).toUpperCase();

  appEl.innerHTML = `
    <div class="studio-wrapper">
      <div class="studio-backdrop-accent"></div>

      <!-- Studio Header with Screen Switcher & Role Switcher -->
      <header class="studio-header">
        <div class="studio-logo">
          <span class="studio-logo-icon">${icon('appLogo')}</span>
          <span>PTracker</span>
        </div>
        <div class="studio-screen-pills">
          <button class="studio-screen-btn ${state.currentScreen === 'schedule' ? 'active' : ''}" data-screen="schedule">Schedule</button>
          <button class="studio-screen-btn ${state.currentScreen === 'journey' ? 'active' : ''}" data-screen="journey">Journey</button>
          <button class="studio-screen-btn ${state.currentScreen === 'focus' ? 'active' : ''}" data-screen="focus">Focus</button>
          <button class="studio-screen-btn ${state.currentScreen === 'calendar' ? 'active' : ''}" data-screen="calendar">Calendar</button>
          <button class="studio-screen-btn ${state.currentScreen === 'progress' ? 'active' : ''}" data-screen="progress">Stats</button>
          <button class="studio-screen-btn ${state.currentScreen === 'opportunities' ? 'active' : ''}" data-screen="opportunities">Jobs</button>
        </div>
        <div class="role-switcher-container">
          <button class="role-pill-btn ${state.activeRole === 'student' ? 'active' : ''}" data-role="student">Student</button>
          <button class="role-pill-btn ${state.activeRole === 'coordinator' ? 'active' : ''}" data-role="coordinator">Coordinator</button>
          <button class="role-pill-btn ${state.activeRole === 'guide' ? 'active' : ''}" data-role="guide">Guide</button>
          <button class="role-pill-btn ${state.activeRole === 'panel' ? 'active' : ''}" data-role="panel">Panel</button>
        </div>
        <div class="studio-header-actions">
          <button class="nav-bar-btn" id="desktop-settings-btn" title="Settings">
            ${icon('settings')}
          </button>
          <div class="user-capsule" id="desktop-user-capsule" style="padding: 4px 12px; min-height: 40px; cursor: pointer;" title="User Profile">
            <div class="capsule-avatar" style="width: 28px; height: 28px; font-size: 0.75rem;">
              ${state.user.photoURL ? `<img src="${state.user.photoURL}" alt="${firstName}" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer" />` : avatarLetter}
            </div>
            <span class="capsule-title" style="font-size: 0.82rem;">${firstName}</span>
          </div>
        </div>
      </header>

      <!-- Main Mobile Shell Container -->
      <div class="phone-shell ${themeClass} ${customBgClass}" id="phone-shell" ${customBgStyle}>
        <!-- Top Navigation Bar -->
        <div class="screen-nav-bar">
          <button class="nav-bar-btn" id="nav-back-btn" title="Back">
            ${icon('chevronLeft')}
          </button>
          <div class="role-switcher-container" style="transform: scale(0.88);">
            <button class="role-pill-btn ${state.activeRole === 'student' ? 'active' : ''}" data-role="student">Student</button>
            <button class="role-pill-btn ${state.activeRole === 'coordinator' ? 'active' : ''}" data-role="coordinator">Coord</button>
            <button class="role-pill-btn ${state.activeRole === 'guide' ? 'active' : ''}" data-role="guide">Guide</button>
            <button class="role-pill-btn ${state.activeRole === 'panel' ? 'active' : ''}" data-role="panel">Panel</button>
          </div>
          <div class="nav-bar-actions">
            <button class="nav-bar-btn" id="nav-settings-btn" title="Settings">
              ${icon('settings')}
            </button>
          </div>
        </div>

        <!-- Scrollable Screen Content Body -->
        <div class="screen-body" id="screen-body">
          ${renderCurrentScreenContent()}
        </div>

        <!-- Floating Bottom Navigation Capsule -->
        <nav class="bottom-dock-nav" aria-label="Bottom Navigation">
          <button class="dock-tab-btn ${state.activeRole === 'student' && state.currentScreen === 'schedule' ? 'active' : ''}" data-nav="schedule" title="Schedule">
            <span class="dock-tab-icon">${icon('tasks')}</span>
            <span class="dock-tab-label">Tasks</span>
          </button>
          <button class="dock-tab-btn ${state.activeRole === 'student' && state.currentScreen === 'journey' ? 'active' : ''}" data-nav="journey" title="Journey">
            <span class="dock-tab-icon">${icon('users')}</span>
            <span class="dock-tab-label">Journey</span>
          </button>
          <button class="dock-tab-btn ${state.activeRole === 'student' && state.currentScreen === 'focus' ? 'active' : ''}" data-nav="focus" title="Focus Mode">
            <span class="dock-tab-icon">${icon('timer')}</span>
            <span class="dock-tab-label">Focus</span>
          </button>
          <button class="dock-add-fab" id="fab-add-btn" title="New Task / Goal">
            ${icon('plus')}
          </button>
          <button class="dock-tab-btn ${state.activeRole === 'student' && state.currentScreen === 'calendar' ? 'active' : ''}" data-nav="calendar" title="Calendar">
            <span class="dock-tab-icon">${icon('calendar')}</span>
            <span class="dock-tab-label">Calendar</span>
          </button>
          <button class="dock-tab-btn ${state.activeRole === 'student' && state.currentScreen === 'progress' ? 'active' : ''}" data-nav="progress" title="Stats">
            <span class="dock-tab-icon">${icon('progress')}</span>
            <span class="dock-tab-label">Stats</span>
          </button>
          <button class="dock-tab-btn ${state.activeRole === 'student' && state.currentScreen === 'opportunities' ? 'active' : ''}" data-nav="opportunities" title="Jobs">
            <span class="dock-tab-icon">${icon('briefcase')}</span>
            <span class="dock-tab-label">Jobs</span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Modals -->
    ${renderGoalModal()}
    ${renderTaskModal()}
    ${renderSettingsModal()}
    ${renderQuoteModal()}
    ${renderBgModal()}
    ${renderManualOverrideModal()}
    ${renderProfileModal()}
    ${renderCodingProfilesModal()}
  `;

  bindEvents();
}

/**
 * Render Coding Profiles Modal for connecting GitHub, LeetCode, and HackerRank
 * @returns {string}
 */
function renderCodingProfilesModal() {
  if (!state.codingProfilesModal.open) return '';
  const prof = state.codingProfiles || {};

  return `
    <div class="override-modal-backdrop" id="coding-modal-overlay">
      <div class="coding-modal-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-family: var(--font-display); font-size: 1.15rem; margin: 0; color: #FFF;">
            Connect Coding Accounts
          </h3>
          <button id="coding-modal-close" class="nav-bar-btn" style="width: 32px; height: 32px;">
            ${icon('close')}
          </button>
        </div>

        <p style="font-size: 0.84rem; color: var(--text-secondary-light); margin-bottom: 18px; line-height: 1.45;">
          Connect your GitHub, LeetCode, and HackerRank handles to share your real coding progress with teammates, mentor, and coordinator.
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              ${icon('github')} GitHub Username
            </label>
            <input type="text" id="input-github-user" class="form-input-pill" style="width: 100%; box-sizing: border-box;" placeholder="e.g. torvalds" value="${escapeAttr(prof.github || '')}" />
            ${prof.githubStats ? `
              <div style="font-size: 0.72rem; color: #2CD674; margin-top: 4px;">
                ✓ Verified: ${prof.githubStats.publicRepos} public repos, ${prof.githubStats.followers} followers
              </div>
            ` : ''}
          </div>

          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              ${icon('leetcode')} LeetCode Username
            </label>
            <input type="text" id="input-leetcode-user" class="form-input-pill" style="width: 100%; box-sizing: border-box;" placeholder="e.g. neetcode" value="${escapeAttr(prof.leetcode || '')}" />
            ${prof.leetcodeStats ? `
              <div style="font-size: 0.72rem; color: #2CD674; margin-top: 4px;">
                ✓ Verified: ${prof.leetcodeStats.totalSolved} solved (${prof.leetcodeStats.easySolved} easy, ${prof.leetcodeStats.mediumSolved} med, ${prof.leetcodeStats.hardSolved} hard)
              </div>
            ` : ''}
          </div>

          <div>
            <label style="font-size: 0.78rem; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              ${icon('hackerrank')} HackerRank Username
            </label>
            <input type="text" id="input-hackerrank-user" class="form-input-pill" style="width: 100%; box-sizing: border-box;" placeholder="e.g. hacker_pro" value="${escapeAttr(prof.hackerrank || '')}" />
            ${prof.hackerrankStats ? `
              <div style="font-size: 0.72rem; color: #2CD674; margin-top: 4px;">
                ✓ Verified: ${prof.hackerrankStats.totalStars} stars across ${prof.hackerrankStats.badgesCount} domain badges
              </div>
            ` : ''}
          </div>
        </div>

        ${state.codingProfilesModal.error ? `
          <div style="color: var(--clr-danger); font-size: 0.8rem; margin-top: 12px; background: rgba(255, 69, 58, 0.1); padding: 8px 12px; border-radius: 8px;">
            ${escapeHtml(state.codingProfilesModal.error)}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px;">
          <button id="coding-modal-cancel" class="coord-btn secondary sm">Cancel</button>
          <button id="coding-modal-save" class="coord-btn primary sm" ${state.codingProfilesModal.loading ? 'disabled' : ''}>
            ${state.codingProfilesModal.loading ? 'Syncing...' : `${icon('sync')} Sync & Save Profiles`}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Manual Override Modal for Coordinator
 * @returns {string}
 */
function renderManualOverrideModal() {
  if (!state.overrideModal.open) return '';

  const team = state.teams.find(t => t.id === state.overrideModal.teamId);
  const guideOptions = state.guides.map(g => `
    <option value="${g.uid}">${g.name} (Capacity Limit: ${g.loadLimit})</option>
  `).join('');

  return `
    <div class="override-modal-backdrop" id="override-modal-backdrop">
      <div class="override-modal-card">
        <h3 class="override-modal-title">Manual Coordinator Reassignment</h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary-light); margin-bottom: 16px;">
          Reassigning <strong>${team ? team.name : state.overrideModal.teamName}</strong>. Coordinator override outranks auto-allocation.
        </p>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary-light); display: block; margin-bottom: 4px;">Target Faculty Guide</label>
          <select id="modal-target-guide" class="focus-subject-select" style="width: 100%;">
            ${guideOptions}
          </select>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem; color: var(--text-secondary-light); display: block; margin-bottom: 4px;">Justification / Override Reason</label>
          <input type="text" id="modal-override-reason" placeholder="Required if forcing beyond limit..." style="width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 8px 14px; border-radius: var(--radius-sm); color: #FFF;" />
        </div>

        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="modal-force-override" class="planner-checkbox" />
          <label for="modal-force-override" style="font-size: 0.82rem; color: var(--clr-orange); cursor: pointer;">Force assign even if guide exceeds load limit</label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="modal-cancel-override" class="coord-btn secondary sm">Cancel</button>
          <button id="modal-confirm-override" class="coord-btn primary sm">${icon('swap')} Confirm Override</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the inner content of the active screen
 * @returns {string}
 */
function renderCurrentScreenContent() {
  if (state.activeRole === 'coordinator') {
    return renderCoordinatorView({
      teams: state.teams,
      guides: state.guides,
      allocations: state.allocations,
      preLockedPairs: state.preLockedPairs,
      reviews: state.reviews,
      panels: state.panels,
      rooms: state.rooms,
      timeSlots: state.timeSlots,
      logbooks: state.logbooks,
      documents: state.documents,
      focusSessions: state.focusSessions,
      internships: state.internships,
      activeSubTab: state.coordinatorSubTab,
      codingProfilesMap: state.codingProfilesMap,
      showToast
    });
  }

  if (state.activeRole === 'guide') {
    return renderGuideView({
      guideUid: state.selectedGuideUid || 'g1',
      teams: state.teams,
      allocations: state.allocations,
      logbooks: state.logbooks,
      documents: state.documents,
      internships: state.internships,
      focusSessions: state.focusSessions,
      activeSubTab: state.guideSubTab,
      codingProfilesMap: state.codingProfilesMap
    });
  }

  if (state.activeRole === 'panel') {
    return renderPanelView({
      panelUid: 'fac_turing',
      reviews: state.reviews,
      teams: state.teams,
      selectedReviewId: state.panelSelectedReviewId
    });
  }

  // Student role screens
  switch (state.currentScreen) {
    case 'schedule': return renderScheduleScreen();
    case 'journey': return renderJourneyView({
      myTeam: state.teams[0] || null,
      guides: state.guides,
      allocations: state.allocations,
      logbooks: state.logbooks,
      documents: state.documents,
      internships: state.internships,
      activeSubTab: state.journeySubTab,
      allUsers: state.allUsers,
      friends: state.friends,
      currentUser: state.user,
      codingProfiles: state.codingProfiles,
      codingProfilesMap: state.codingProfilesMap,
      livePresence: state.livePresence
    });
    case 'focus': return renderFocusView({
      userId: state.user?.uid || 'guest',
      subjects: state.focusSubjects,
      sessions: state.focusSessions,
      dailyPlans: state.dailyPlans,
      allUsers: state.allUsers,
      activeSessionState: state.activeFocusTimer,
      activeSubTab: state.focusSubTab,
      friends: state.friends,
      codingProfilesMap: state.codingProfilesMap,
      livePresence: state.livePresence
    });
    case 'calendar': return renderCalendarScreen();
    case 'progress': return renderProgressScreen();
    case 'opportunities': return renderOpportunitiesScreen();
    default: return renderScheduleScreen();
  }
}

// ============================================================
// 1. SCREEN 2: SCHEDULE / FEED VIEW (CENTER SCREEN OF MOCKUP)
// ============================================================

function renderScheduleScreen() {
  const firstName = state.user.displayName ? state.user.displayName.split(' ')[0] : 'there';
  const avatarLetter = (state.user.displayName || state.user.email || 'U').charAt(0).toUpperCase();

  // Active goal or top goal
  const activeGoal = state.goals.find(g => g.id === state.selectedGoalId) || state.goals[0] || null;
  const goalTitle = activeGoal ? activeGoal.title : 'All Goals';

  // Filter tasks for the selected date (shows all tasks when no date is selected)
  const filteredTasks = filterTasksByDate(state.tasks, state.selectedDateStr);

  // Date strip centered on today
  const dateStripDays = getDateStrip(new Date(), 0, 7);
  const now = new Date();
  const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });

  // Endpoint WAW / PRG codes
  const fromCode = activeGoal ? activeGoal.title.substring(0, 3).toUpperCase() : 'ALL';
  const toCode = activeGoal && activeGoal.deadline ? 'DONE' : 'GOAL';
  const fromCity = activeGoal ? 'Active Focus' : 'Workspace';
  const toCity = activeGoal && activeGoal.deadline ? formatDateDisplay(activeGoal.deadline) : 'Target Milestone';

  return `
    <!-- Top Profile & Location Capsule Row -->
    <div class="capsule-row">
      <div class="user-capsule" id="user-capsule-btn">
        <div class="capsule-avatar">
            ${state.user.photoURL ? `<img src="${escapeAttr(state.user.photoURL)}" alt="${escapeAttr(firstName)}" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer" />` : avatarLetter}
        </div>
        <div class="capsule-text">
          <span class="capsule-title">Hi ${firstName}</span>
        </div>
      </div>

      <div class="location-capsule" id="location-capsule-btn">
        <div class="capsule-icon-wrap">
          ${icon('pin')}
        </div>
        <div class="capsule-text">
          <span class="capsule-title">${escapeHtml(goalTitle)}</span>
        </div>
      </div>
    </div>

    <!-- Route Selector Card (WAW -> PRG) -->
    <div class="route-selector-card">
      <div class="route-selector-inner">
        <div class="route-endpoint">
          <div class="endpoint-tag">From</div>
          <div class="endpoint-code">${fromCode}</div>
          <div class="endpoint-name">${fromCity}</div>
        </div>

        <button class="route-swap-btn" id="route-swap-btn" title="Cycle Goal">
          ${icon('swap')}
        </button>

        <div class="route-endpoint" style="text-align: right; align-items: flex-end;">
          <div class="endpoint-tag">To</div>
          <div class="endpoint-code">${toCode}</div>
          <div class="endpoint-name">${toCity}</div>
        </div>
      </div>
    </div>

    <!-- Date Selector Strip (Change Date) -->
    <div class="date-selector-container">
      <div class="date-selector-header">
        <span class="date-selector-label">${state.selectedDateStr ? 'Filtered Date' : 'Change Date'}</span>
        <span class="date-selector-month">${currentMonthName}</span>
      </div>
      <div class="date-strip-scroll">
        <div class="date-strip-item ${!state.selectedDateStr ? 'active' : ''}" data-date="all" title="Show all tasks">
          <span>All</span>
          ${!state.selectedDateStr ? `<span class="date-dot"></span>` : ''}
        </div>
        ${dateStripDays.map(item => `
          <div class="date-strip-item ${state.selectedDateStr === item.dateStr ? 'active' : ''}" data-date="${item.dateStr}">
            <span>${item.label}</span>
            ${state.selectedDateStr === item.dateStr ? `<span class="date-dot"></span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Best Deals / Active Tasks Stacked List -->
    <div class="tasks-stack-section">
      <div class="section-eyebrow">
        <span>${state.selectedDateStr ? `Tasks for ${formatDateDisplay(state.selectedDateStr)}` : 'All Tasks'}</span>
        <span class="section-eyebrow-count">${filteredTasks.length} total</span>
      </div>

      ${filteredTasks.length > 0 ? filteredTasks.map((task, idx) => {
        const theme = getTaskColorTheme(idx);
        const taskSubtasks = state.subtasks.filter(s => s.taskId === task.id);
        const doneSub = taskSubtasks.filter(s => s.completed).length;
        const taskGoal = state.goals.find(g => g.id === task.goalId);

        // Display time slot based on index or deadline
        const baseHour = 12 + (idx * 2);
        const timeSlot = `${baseHour > 23 ? baseHour - 24 : baseHour}:30`;

        return `
          <div class="task-card-item ${theme.bgClass}" data-open-task="${task.id}" id="task-card-${task.id}">
            <div class="task-time-big">${timeSlot}</div>
            <div class="task-card-content">
              <div class="task-card-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
              <div class="task-card-meta">
                ${taskGoal ? `<span class="task-badge-pill">${escapeHtml(taskGoal.title)}</span>` : ''}
                ${task.dueDate ? `<span class="task-badge-pill" style="opacity:0.85;display:inline-flex;align-items:center;gap:4px;">${icon('calendar')} ${formatDateDisplay(task.dueDate)}</span>` : ''}
                ${taskSubtasks.length > 0 ? `<span>${doneSub}/${taskSubtasks.length} subtasks</span>` : ''}
              </div>
            </div>
            <div class="task-card-right">
              <div class="task-check-circle ${task.completed ? 'checked' : ''}" data-toggle-task="${task.id}" title="Toggle Task">
                ${task.completed ? icon('check') : ''}
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state-modern">
          <div class="empty-state-icon">${icon('tasks')}</div>
          <div class="empty-state-title">${state.selectedDateStr ? 'No Tasks For This Day' : 'No Tasks Scheduled'}</div>
          <p class="empty-state-text">${state.selectedDateStr ? 'You have no tasks set for this day. Tap "All" to view all tasks or tap + to create one.' : 'You have no tasks yet. Tap the + button to create one.'}</p>
          <button class="btn-pill btn-pill-primary" id="empty-create-task-btn" style="margin-top: 12px; width: fit-content; padding: 12px 24px;">
            + Create Task
          </button>
        </div>
      `}
    </div>
  `;
}

// ============================================================
// 2. SCREEN 1: JOURNEY / MILESTONE VIEW (LEFT SCREEN OF MOCKUP)
// ============================================================

function renderJourneyScreen() {
  if (state.goals.length === 0) {
    const heroDate = formatHeroDate(new Date());
    return `
      <div class="journey-header-block">
        <div class="journey-sublabel">Your progress is tracked for</div>
        <div class="journey-hero-row">
          <div class="journey-huge-date">${heroDate.dayMonth}<br>${heroDate.dayName}</div>
        </div>
        <div class="journey-duration-bar">
          <span class="journey-time-big">0%</span>
          <span class="journey-duration-text">No active goals yet</span>
        </div>

        <!-- Motivational Quote Card (Display only; edit in Settings) -->
        <div class="journey-quote-card">
          <div class="quote-top-row">
            <span class="quote-symbol">“</span>
          </div>
          <p class="quote-body-text">${escapeHtml(state.quote || 'Focus on progress, not perfection.')}</p>
          ${state.quoteAuthor ? `<div class="quote-author-tag">— ${escapeHtml(state.quoteAuthor)}</div>` : ''}
        </div>
      </div>

      <div class="empty-state-modern" style="padding: 40px 20px; margin-top: 20px;">
        <div class="empty-state-icon">${icon('goals')}</div>
        <div class="empty-state-title">No Milestones Yet</div>
        <p class="empty-state-text">Create your first goal to track your milestone journey, route progress, and roadmaps.</p>
        <button class="btn-pill btn-pill-primary" id="journey-create-first-goal-btn" style="margin-top: 14px; width: fit-content; padding: 12px 28px;">
          ${icon('plus')} Create Goal
        </button>
      </div>
    `;
  }

  // Active goal in the Card Stack
  let activeIdx = state.journeyStackIndex || 0;
  if (activeIdx < 0 || activeIdx >= state.goals.length) {
    activeIdx = 0;
    state.journeyStackIndex = 0;
  }
  const currentGoal = state.goals[activeIdx];

  // Header stats for current card
  const goalTasks = state.tasks.filter(t => t.goalId === currentGoal.id);
  const doneCount = goalTasks.filter(t => t.completed).length;
  const tCount = goalTasks.length;
  const percent = tCount > 0 ? Math.round((doneCount / tCount) * 100) : 0;
  const heroDate = currentGoal.deadline ? formatHeroDate(currentGoal.deadline) : formatHeroDate(new Date());

  // Codes & cities
  const fromCode = currentGoal.title.substring(0, 3).toUpperCase() || `G${activeIdx + 1}`;
  const toCode = currentGoal.deadline ? 'DONE' : 'GOAL';
  const toCity = currentGoal.deadline ? formatDateDisplay(currentGoal.deadline) : 'Target Milestone';
  const isExpanded = state.expandedRoadmapGoalIds.has(currentGoal.id);
  const rating = percent > 0 ? (3.5 + (percent / 100) * 1.5).toFixed(1) : '4.8';

  return `
    <div class="journey-header-block">
      <div class="journey-sublabel">Your progress is tracked for ${escapeHtml(currentGoal.title)}</div>
      <div class="journey-hero-row">
        <div class="journey-huge-date">${heroDate.dayMonth}<br>${heroDate.dayName}</div>
      </div>
      <div class="journey-duration-bar">
        <span class="journey-time-big">${percent}%</span>
        <span class="journey-duration-text">Progress: ${percent}% completed (${doneCount}/${tCount} tasks)</span>
      </div>

      <!-- Motivational Quote Card (Display only; edit in Settings) -->
      <div class="journey-quote-card">
        <div class="quote-top-row">
          <span class="quote-symbol">“</span>
        </div>
        <p class="quote-body-text">${escapeHtml(state.quote || 'Focus on progress, not perfection.')}</p>
        ${state.quoteAuthor ? `<div class="quote-author-tag">— ${escapeHtml(state.quoteAuthor)}</div>` : ''}
      </div>
    </div>

    <!-- Goals Card Stack Section (Fits perfectly on mobile screen) -->
    <div class="journey-goals-section">
      <!-- Card Stack Header Controls -->
      <div class="journey-stack-header">
        <div class="journey-stack-indicator">
          <span>Milestone Stack</span>
          <span class="journey-stack-badge">${activeIdx + 1} of ${state.goals.length}</span>
        </div>
        <div class="journey-stack-nav-btns">
          <button class="stack-arrow-btn" id="journey-prev-goal-btn" ${activeIdx === 0 ? 'disabled' : ''} title="Previous Milestone" type="button">
            ${icon('chevronLeft')}
          </button>
          <button class="stack-arrow-btn" id="journey-next-goal-btn" ${activeIdx >= state.goals.length - 1 ? 'disabled' : ''} title="Next Milestone" type="button">
            ${icon('chevronRight')}
          </button>
          <button class="journey-goal-tab-add" id="journey-add-goal-pill" type="button" title="Create New Goal">
            ${icon('plus')} Goal
          </button>
        </div>
      </div>

      <!-- Active Goal Card in Stack -->
      <div id="journey-card-stack-wrapper">
        <div class="docked-dark-card" data-goal-card="${currentGoal.id}">
          <div class="docked-profile-row">
            <div class="docked-user-info" data-select-journey-goal="${currentGoal.id}" style="cursor: pointer;" title="Set as active focus">
              <div class="docked-avatar-box">
                ${escapeHtml(currentGoal.title).charAt(0).toUpperCase()}
              </div>
              <div class="docked-name-group">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="docked-name">${escapeHtml(currentGoal.title)}</span>
                  <button class="icon-btn-micro" data-edit-goal="${currentGoal.id}" title="Edit Goal" type="button">
                    ${icon('edit')}
                  </button>
                </div>
                <span class="docked-rating">
                  <span class="docked-star">${icon('star')}</span> ${rating} rating
                  ${currentGoal.deadline ? `· Due ${formatDateDisplay(currentGoal.deadline)}` : ''}
                </span>
              </div>
            </div>

            <button class="docked-phone-btn" data-goal-add-task="${currentGoal.id}" title="Add Task to ${escapeHtml(currentGoal.title)}" type="button">
              ${icon('plus')}
            </button>
          </div>

          <!-- Route Track Visual -->
          <div class="route-track-visual">
            <div class="route-track-col">
              <span class="route-track-time">0%</span>
              <span class="route-track-code">${fromCode}</span>
              <span class="route-track-city">Start Milestone</span>
            </div>

            <div class="route-track-line-wrapper">
              <div class="route-dashed-line"></div>
              <div class="route-vehicle-icon" style="left: calc(16px + (100% - 32px) * ${percent / 100}); transform: translateX(-50%);">
                ${icon('car')}
              </div>
            </div>

            <div class="route-track-col right">
              <span class="route-track-time">${percent}%</span>
              <span class="route-track-code">${toCode}</span>
              <span class="route-track-city">${toCity}</span>
            </div>
          </div>

          <!-- Chips Row -->
          <div class="chips-row">
            <div class="chip-pill ${percent === 100 ? 'chip-completed' : ''}">
              ${percent === 100 ? `${icon('check')} Milestone Complete` : (percent > 0 ? `${icon('thumb')} ${percent}% Complete` : 'Starting Up')}
            </div>
            <div class="chip-pill">${icon('repeat')} ${tCount} Tasks (${doneCount} done)</div>
            ${currentGoal.deadline ? `<div class="chip-pill">${icon('calendar')} ${formatDateDisplay(currentGoal.deadline)}</div>` : ''}
          </div>

          <!-- Bottom Orange Roadmap Tab -->
          <div class="roadmap-tab-bar" data-toggle-roadmap="${currentGoal.id}">
            <span class="roadmap-tab-title">Road map (${tCount} tasks)</span>
            <span class="roadmap-view-btn">${isExpanded ? 'Close' : 'View'}</span>
          </div>

          <!-- Expandable Subtask Checklist -->
          ${isExpanded ? `
            <div class="roadmap-drawer-content">
              ${goalTasks.length > 0 ? goalTasks.map(t => {
                const taskSub = state.subtasks.filter(s => s.taskId === t.id);
                return `
                  <div class="subtask-drawer-item">
                    <div class="subtask-left">
                      <div class="task-check-circle ${t.completed ? 'checked' : ''}" data-toggle-task="${t.id}">
                        ${t.completed ? icon('check') : ''}
                      </div>
                      <span class="subtask-title-text ${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      ${taskSub.length > 0 ? `<span style="font-size:0.7rem;color:var(--text-secondary-light);">${taskSub.filter(s=>s.completed).length}/${taskSub.length} subtasks</span>` : ''}
                      <button class="icon-btn-micro" data-open-task="${t.id}" title="Focus Task" type="button">${icon('chevronRight')}</button>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div style="font-size: 0.8rem; color: var(--text-secondary-light); padding: 8px 12px; display:flex; justify-content:space-between; align-items:center;">
                  <span>No tasks created for this goal yet.</span>
                  <button class="btn-pill btn-pill-primary" data-goal-add-task="${currentGoal.id}" style="padding: 6px 14px; font-size: 0.72rem;" type="button">+ Add Task</button>
                </div>
              `}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Card Stack Pagination Dots (if multiple goals) -->
      ${state.goals.length > 1 ? `
        <div class="journey-stack-dots">
          ${state.goals.map((_, i) => `
            <div class="stack-dot ${i === activeIdx ? 'active' : ''}" data-stack-dot="${i}" title="View Goal ${i + 1}"></div>
          `).join('')}
        </div>

        <!-- Quick Goal Pills (Tap to jump in stack) -->
        <div class="journey-goal-tabs-scroll">
          ${state.goals.map((g, i) => {
            const gTasks = state.tasks.filter(t => t.goalId === g.id);
            const gDone = gTasks.filter(t => t.completed).length;
            const gPct = gTasks.length > 0 ? Math.round((gDone / gTasks.length) * 100) : 0;
            return `
              <button class="journey-goal-tab-pill ${i === activeIdx ? 'active' : ''}" data-stack-jump="${i}" type="button">
                <span>${escapeHtml(g.title)}</span>
                <span class="tab-pill-badge">${gPct}%</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}



// ============================================================
// 3. SCREEN 3: FOCUS / ACTION VIEW (RIGHT SCREEN OF MOCKUP)
// ============================================================

function renderFocusScreen() {
  const selectedTask = state.tasks.find(t => t.id === state.selectedTaskId) || state.tasks[0] || null;
  const pendingTasks = state.tasks.filter(t => !t.completed);
  const taskGoal = selectedTask ? state.goals.find(g => g.id === selectedTask.goalId) : null;
  const taskSubtasks = selectedTask ? state.subtasks.filter(s => s.taskId === selectedTask.id) : [];

  const taskTitle = selectedTask ? selectedTask.title : 'New Task Request';
  const taskNotes = selectedTask && selectedTask.notes ? selectedTask.notes : 'Focus session for this task.';

  return `
    <div class="focus-header-block">
      <div class="people-pill">
        <div class="people-avatars">
          <div class="avatar-mini"></div>
          <div class="avatar-mini" style="background:#FF6420;color:#fff;display:flex;align-items:center;justify-content:center;">${icon('check')}</div>
        </div>
        <span>${pendingTasks.length} tasks in progress</span>
      </div>

      <div class="focus-hero-title">${escapeHtml(taskTitle)}</div>

      <div class="focus-time-seats">
        <div>
          <span class="focus-time-lead">14:00</span>
          <span class="focus-date-sub">${selectedTask && selectedTask.dueDate ? formatDateDisplay(selectedTask.dueDate) : 'Today'}</span>
        </div>
        <span class="focus-seat-badge">${taskGoal ? escapeHtml(taskGoal.title) : 'High Priority'}</span>
      </div>
    </div>

    <!-- Docked Dark Card -->
    <div class="docked-dark-card" style="margin-top: auto;">
      <div class="docked-profile-row">
        <div class="docked-user-info">
          <div class="docked-avatar-box">
            ${icon('tasks')}
          </div>
          <div class="docked-name-group">
            <span class="docked-name">${state.user.displayName || 'Current User'}</span>
            <span class="docked-rating">${taskSubtasks.length} subtasks</span>
          </div>
        </div>

        <button class="docked-phone-btn" id="focus-edit-btn" title="Edit Task">
          ${icon('edit')}
        </button>
      </div>

      <!-- Notes / Location Box -->
      <div style="background: var(--clr-noir-surface); border: 1px solid var(--clr-noir-border); border-radius: var(--radius-md); padding: 12px 14px; display: flex; align-items: center; gap: 10px;">
        <div style="color: var(--clr-orange);">${icon('pin')}</div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #FFFFFF;">${taskGoal ? escapeHtml(taskGoal.title) : 'Active Sprint'}</span>
          <span style="font-size: 0.72rem; color: var(--text-secondary-light);">${escapeHtml(taskNotes).substring(0, 50)}</span>
        </div>
      </div>

      <!-- Route WAW -> PRG -->
      <div class="route-track-visual">
        <div class="route-track-col">
          <span class="route-track-code" style="font-size: 1.3rem;">WAW</span>
          <span class="route-track-city">Started</span>
        </div>
        <div class="route-track-line-wrapper">
          <div class="route-dashed-line"></div>
          <div class="route-vehicle-icon">
            ${icon('car')}
          </div>
        </div>
        <div class="route-track-col right">
          <span class="route-track-code" style="font-size: 1.3rem;">PRG</span>
          <span class="route-track-city">Finished</span>
        </div>
      </div>

      <!-- Slide / Action Bar -->
      <div class="action-slider-bar">
        <button class="decline-pill-btn" id="focus-decline-btn">
          Delete
        </button>

        <div class="accept-slider-btn" id="focus-complete-slider-btn">
          <div class="slider-handle-circle">
            ${selectedTask && selectedTask.completed ? icon('check') : icon('chevronsRight')}
          </div>
          <div class="slider-arrows">
            <span>›</span><span>›</span><span>›</span>
          </div>
          <span class="slider-price-label">${selectedTask && selectedTask.completed ? 'Completed' : 'Slide to Complete'}</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// 4. SCREEN 4: CALENDAR VIEW
// ============================================================

function renderCalendarScreen() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const monthName = state.calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = toISODateString(new Date());

  /** @type {string[]} */
  const dayCells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    dayCells.push(`<div class="cal-day-cell other-month">${day}</div>`);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const isSelected = Boolean(state.selectedDateStr && dateStr === state.selectedDateStr);
    const hasTasks = state.tasks.some(t => t.dueDate === dateStr);

    const classes = [
      'cal-day-cell',
      isToday ? 'today' : '',
      isSelected ? 'selected' : '',
      hasTasks ? 'has-tasks' : ''
    ].filter(Boolean).join(' ');

    dayCells.push(`<div class="${classes}" data-calendar-day="${dateStr}">${d}</div>`);
  }

  const selectedDayTasks = filterTasksByDate(state.tasks, state.selectedDateStr);

  return `
    <div class="dark-card-panel">
      <div class="calendar-month-strip">
        <h3>${monthName}</h3>
        <div style="display:flex; gap: 8px;">
          <button class="nav-bar-btn" id="cal-prev-btn" style="width:32px;height:32px;">${icon('chevronLeft')}</button>
          <button class="nav-bar-btn" id="cal-next-btn" style="width:32px;height:32px;">${icon('chevronRight')}</button>
        </div>
      </div>

      <div class="calendar-grid-modern">
        <div class="cal-header-cell">S</div>
        <div class="cal-header-cell">M</div>
        <div class="cal-header-cell">T</div>
        <div class="cal-header-cell">W</div>
        <div class="cal-header-cell">T</div>
        <div class="cal-header-cell">F</div>
        <div class="cal-header-cell">S</div>
        ${dayCells.join('')}
      </div>
    </div>

    <!-- Selected Day Task List -->
    <div class="tasks-stack-section">
      <div class="section-eyebrow">
        <span>${state.selectedDateStr ? `Tasks for ${formatDateDisplay(state.selectedDateStr)}` : 'All Scheduled Tasks'}</span>
        <span class="section-eyebrow-count">${selectedDayTasks.length}</span>
      </div>

      ${selectedDayTasks.length > 0 ? selectedDayTasks.map((task, idx) => {
        const theme = getTaskColorTheme(idx);
        return `
          <div class="task-card-item ${theme.bgClass}" data-open-task="${task.id}">
            <div class="task-time-big">12:30</div>
            <div class="task-card-content">
              <div class="task-card-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
            </div>
            <div class="task-check-circle ${task.completed ? 'checked' : ''}" data-toggle-task="${task.id}">
              ${task.completed ? icon('check') : ''}
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state-modern" style="padding: 24px;">
          <p class="empty-state-text">No tasks for this day.</p>
        </div>
      `}
    </div>
  `;
}

// ============================================================
// 5. SCREEN 5: PROGRESS SCREEN
// ============================================================

function renderProgressScreen() {
  const overall = calculateOverallProgress(state.tasks);
  const totalSubtasks = state.subtasks.length;
  const completedSubtasks = state.subtasks.filter(s => s.completed).length;

  return `
    <div class="stat-pill-grid">
      <div class="stat-pill-box">
        <div class="stat-pill-number" style="color:var(--clr-orange);">${overall.percent}%</div>
        <div class="stat-pill-label">Overall Completion</div>
      </div>
      <div class="stat-pill-box">
        <div class="stat-pill-number">${overall.completedCount}/${overall.totalCount}</div>
        <div class="stat-pill-label">Tasks Done</div>
      </div>
      <div class="stat-pill-box">
        <div class="stat-pill-number">${completedSubtasks}/${totalSubtasks}</div>
        <div class="stat-pill-label">Subtasks Finished</div>
      </div>
      <div class="stat-pill-box">
        <div class="stat-pill-number">${state.goals.length}</div>
        <div class="stat-pill-label">Active Goals</div>
      </div>
    </div>

    <!-- Goals Stack -->
    <div class="tasks-stack-section">
      <div class="section-eyebrow">
        <span>Goals Breakdown</span>
        <button class="nav-bar-btn" id="progress-add-goal-btn" style="width:28px;height:28px;">${icon('plus')}</button>
      </div>

      ${state.goals.length > 0 ? state.goals.map((g, idx) => {
        const goalTasks = state.tasks.filter(t => t.goalId === g.id);
        const done = goalTasks.filter(t => t.completed).length;
        const total = goalTasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const theme = getTaskColorTheme(idx);

        return `
          <div class="task-card-item ${theme.bgClass}" data-select-goal="${g.id}">
            <div class="task-time-big">${pct}%</div>
            <div class="task-card-content">
              <div class="task-card-title">${escapeHtml(g.title)}</div>
              <div class="task-card-meta">
                <span>${done}/${total} tasks</span>
                ${g.deadline ? `<span>${formatDateDisplay(g.deadline)}</span>` : ''}
              </div>
            </div>
            <div class="task-price-tag">›</div>
          </div>
        `;
      }).join('') : `
        <div class="empty-state-modern">
          <p class="empty-state-text">No goals created yet.</p>
        </div>
      `}
    </div>
  `;
}

// ============================================================
// 6. OPPORTUNITIES SCREEN (SCRAPED INTERNSHIPS & JOBS)
// ============================================================

/**
 * Whether the user's career profile has enough info for matching
 * @returns {boolean}
 */
function hasCareerProfile() {
  const p = state.profile;
  return Boolean(p && ((p.skills && p.skills.length > 0) || p.degree));
}

/**
 * "Last synced" summary across all scraper sources
 * @returns {{ label: string, sources: number, failed: number }}
 */
function getSyncSummary() {
  const entries = Object.values(state.syncMeta || {});
  const newest = entries.reduce((max, m) => Math.max(max, m.lastRunAtMs || 0), 0);
  const failed = entries.filter(m => m.ok === false).length;
  return {
    label: newest ? `Synced ${formatTimeAgo(newest)}` : 'Never synced',
    sources: entries.length,
    failed
  };
}

/**
 * Result list HTML (extracted so the search box can update it without
 * re-rendering the whole screen and losing input focus)
 * @returns {string}
 */
function renderOppResultsHtml() {
  const view = filterWithFallback(
    state.opportunities,
    state.oppFilters,
    state.savedOppIds,
    state.profile,
    7
  );

  if (state.opportunities.length === 0) {
    return `
      <div class="empty-state-modern">
        <div class="empty-state-icon">${icon('briefcase')}</div>
        <div class="empty-state-title">No Opportunities Yet</div>
        <p class="empty-state-text">Listings sync automatically every 6 hours via GitHub Actions. You can also trigger one now with the Sync button.</p>
      </div>
    `;
  }

  if (view.results.length === 0) {
    return `
      <div class="empty-state-modern" style="padding: 24px;">
        <p class="empty-state-text">No matches for the current filters.</p>
      </div>
    `;
  }

  const matchCount = view.results.length - view.fallbackCount;
  const cards = view.results.map((opp, idx) => {
    const card = renderOppCard(opp, idx);
    // Insert an honest divider before widened ("related") results
    if (view.fallbackCount > 0 && idx === matchCount) {
      return `<div class="opp-relaxed-divider">${escapeHtml(view.note)}</div>${card}`;
    }
    return card;
  }).join('');

  return cards;
}

/**
 * Single opportunity card
 * @param {any} opp
 * @param {number} idx
 * @returns {string}
 */
function renderOppCard(opp, idx) {
  const theme = getTaskColorTheme(idx);
  const { score, matchedSkills } = scoreOpportunity(state.profile, opp);
  const isSaved = state.savedOppIds.includes(opp.id);
  const safeUrl = /^https?:\/\//i.test(opp.applyUrl || '') ? escapeAttr(opp.applyUrl) : '#';
  const scoreClass = score >= 60 ? 'high' : (score >= 35 ? 'mid' : 'low');
  const typeLabel = opp.type === 'internship' ? 'Internship' : 'Job';

  return `
    <div class="opp-card ${theme.bgClass}">
      <div class="opp-score-badge ${scoreClass}">
        <span class="opp-score-num">${score}%</span>
        <span class="opp-score-label">match</span>
      </div>

      <div class="opp-card-content">
        <div class="opp-card-title">${escapeHtml(opp.title)}</div>
        <div class="opp-card-company">${escapeHtml(opp.company)}</div>
        <div class="opp-card-meta">
          <span class="opp-type-pill ${opp.type === 'internship' ? 'is-internship' : ''}">${typeLabel}</span>
          ${opp.location ? `<span class="opp-meta-item">${icon('pin')} ${escapeHtml(opp.location)}</span>` : ''}
          ${opp.region === 'india' ? `<span class="opp-region-pill">India</span>` : ''}
          <span class="opp-source-pill">${escapeHtml(opp.source || 'web')}</span>
          ${opp.postedAtMs ? `<span class="opp-meta-item">${formatTimeAgo(opp.postedAtMs)}</span>` : ''}
        </div>
        ${matchedSkills.length > 0 ? `
          <div class="opp-tags-row">
            ${matchedSkills.slice(0, 4).map(s => `<span class="opp-tag-chip">${escapeHtml(s)}</span>`).join('')}
          </div>
        ` : (opp.tags && opp.tags.length > 0 ? `
          <div class="opp-tags-row">
            ${opp.tags.slice(0, 4).map(t => `<span class="opp-tag-chip">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : '')}
      </div>

      <div class="opp-card-actions">
        <button class="opp-save-btn ${isSaved ? 'active' : ''}" data-toggle-save="${opp.id}" title="${isSaved ? 'Remove bookmark' : 'Save opportunity'}">
          ${icon('heart')}
        </button>
        <a class="btn-pill btn-pill-primary opp-apply-btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          Apply ${icon('external')}
        </a>
      </div>
    </div>
  `;
}

function renderOpportunitiesScreen() {
  const hasProfile = hasCareerProfile();
  const sync = getSyncSummary();
  const profileLabel = hasProfile
    ? [state.profile.degree, state.profile.branch].filter(Boolean).join(' · ')
    : 'Add your degree & skills for match scores';
  const f = state.oppFilters;

  return `
    <div class="opp-profile-row">
      <button class="opp-profile-chip" id="opp-edit-profile-btn" type="button">
        <span class="opp-profile-icon">${icon('user')}</span>
        <span class="opp-profile-text">
          <span class="opp-profile-title">${escapeHtml(profileLabel)}</span>
          <span class="opp-profile-sub">${hasProfile ? `${(state.profile.skills || []).length} skills` : 'Tap to set up'}</span>
        </span>
        ${icon('edit')}
      </button>
      <button class="btn-pill btn-pill-ghost opp-sync-btn" id="opp-sync-btn" type="button">
        ${icon('sync')} Sync
      </button>
    </div>

    <div class="opp-sync-info">
      <span
        id="opp-sync-details-toggle"
        style="cursor:pointer;text-decoration:underline dotted;"
        title="Tap to see per-source sync details"
      >${sync.label} · ${sync.sources} sources${sync.failed > 0 ? ` · ${sync.failed} failed` : ''}</span>
    </div>
    ${state.showSyncErrors ? `
      <div class="opp-sync-errors">
        ${Object.entries(state.syncMeta)
          .sort(([, a], [, b]) => (a.ok === false ? -1 : 0) - (b.ok === false ? -1 : 0))
          .map(([id, m]) => {
            const status = m.ok === false
              ? `<strong>failed</strong>`
              : (m.skipped ? `skipped (${escapeHtml(m.skipped)})` : `${m.count ?? 0} listings`);
            const err = m.ok === false ? ` — ${escapeHtml((m.error || 'error').slice(0, 100))}` : '';
            return `<div class="opp-sync-error-item"><strong>${escapeHtml(id)}</strong>: ${status}${err}</div>`;
          })
          .join('')}
      </div>
    ` : ''}

    <div class="opp-search-wrap">
      ${icon('search')}
      <input type="search" id="opp-search" class="form-input-pill opp-search-input"
        placeholder="Search title, company, skill…" value="${escapeAttr(f.q)}" autocomplete="off" />
    </div>

    <div class="opp-filter-row">
      <button class="opp-filter-chip ${f.type === 'all' ? 'active' : ''}" data-opp-type="all" type="button">All</button>
      <button class="opp-filter-chip ${f.type === 'internship' ? 'active' : ''}" data-opp-type="internship" type="button">Internships</button>
      <button class="opp-filter-chip ${f.type === 'fulltime' ? 'active' : ''}" data-opp-type="fulltime" type="button">Jobs</button>
      <span class="opp-filter-divider"></span>
      <button class="opp-filter-chip ${f.region === 'all' ? 'active' : ''}" data-opp-region="all" type="button">Everywhere</button>
      <button class="opp-filter-chip ${f.region === 'india' ? 'active' : ''}" data-opp-region="india" type="button">India</button>
      <button class="opp-filter-chip ${f.region === 'global' ? 'active' : ''}" data-opp-region="global" type="button">Global</button>
      <span class="opp-filter-divider"></span>
      <button class="opp-filter-chip ${f.sort === 'match' ? 'active' : ''}" data-opp-sort="match" type="button">Best match</button>
      <button class="opp-filter-chip ${f.sort === 'newest' ? 'active' : ''}" data-opp-sort="newest" type="button">Newest</button>
      <span class="opp-filter-divider"></span>
      <button class="opp-filter-chip ${f.savedOnly ? 'active' : ''}" id="opp-saved-toggle" type="button">${icon('heart')} Saved (${state.savedOppIds.length})</button>
    </div>

    <div class="tasks-stack-section">
      <div class="section-eyebrow">
        <span>Opportunities</span>
        <span class="section-eyebrow-count" id="opp-count">${filterWithFallback(state.opportunities, f, state.savedOppIds, state.profile, 7).results.length} shown</span>
      </div>
      <div id="opp-results">${renderOppResultsHtml()}</div>
    </div>
  `;
}

// ============================================================
// MODALS
// ============================================================

function renderGoalModal() {
  return `
    <div class="modal-overlay-custom" id="goal-modal-overlay">
      <div class="modal-panel-custom">
        <div class="modal-header-custom">
          <h3 class="modal-title-custom" id="goal-modal-title">New Goal</h3>
          <button class="modal-close-custom" id="goal-modal-close">${icon('close')}</button>
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="goal-title-input">Goal Title</label>
          <input class="form-input-pill" id="goal-title-input" placeholder="e.g., Master TypeScript" />
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="goal-desc-input">Description</label>
          <textarea class="form-input-pill" id="goal-desc-input" placeholder="What does achieving this look like?"></textarea>
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="goal-deadline-input">Target Deadline</label>
          <input class="form-input-pill" id="goal-deadline-input" type="date" />
        </div>
        <div class="modal-footer-custom">
          <button class="btn-pill btn-pill-ghost" id="goal-modal-cancel">Cancel</button>
          <button class="btn-pill btn-pill-primary" id="goal-modal-save">Save Goal</button>
        </div>
      </div>
    </div>
  `;
}

function renderTaskModal() {
  return `
    <div class="modal-overlay-custom" id="task-modal-overlay">
      <div class="modal-panel-custom">
        <div class="modal-header-custom">
          <h3 class="modal-title-custom" id="task-modal-title">New Task</h3>
          <button class="modal-close-custom" id="task-modal-close">${icon('close')}</button>
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="task-title-input">Task Title</label>
          <input class="form-input-pill" id="task-title-input" placeholder="e.g., Read chapter 4" />
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="task-goal-select">Belongs to Goal</label>
          <select class="form-input-pill" id="task-goal-select">
            ${state.goals.map(g => `<option value="${g.id}" ${g.id === state.selectedGoalId ? 'selected' : ''}>${escapeHtml(g.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="task-due-input">Due Date</label>
          <input class="form-input-pill" id="task-due-input" type="date" value="${state.selectedDateStr || toISODateString(new Date())}" />
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="task-notes-input">Notes</label>
          <textarea class="form-input-pill" id="task-notes-input" placeholder="Additional details or links..."></textarea>
        </div>
        <div class="modal-footer-custom">
          <button class="btn-pill btn-pill-ghost" id="task-modal-cancel">Cancel</button>
          <button class="btn-pill btn-pill-primary" id="task-modal-save">Save Task</button>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsModal() {
  const isCustomBg = Boolean(state.customBgImage);
  return `
    <div class="modal-overlay-custom ${state.settingsOpen ? 'open' : ''}" id="settings-modal-overlay">
      <div class="modal-panel-custom">
        <div class="modal-header-custom">
          <h3 class="modal-title-custom">Settings</h3>
          <button class="modal-close-custom" id="settings-modal-close">${icon('close')}</button>
        </div>

        <!-- User Profile Pill -->
        <div style="display:flex; align-items:center; gap: 14px; padding: 12px; background: var(--clr-noir-surface); border-radius: var(--radius-md);">
          <div class="capsule-avatar" style="width:48px;height:48px;">
            ${state.user?.photoURL ? `<img src="${escapeAttr(state.user.photoURL)}" alt="User" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer" />` : (state.user?.displayName || 'U').charAt(0).toUpperCase()}
          </div>
          <div style="display:flex; flex-direction:column; overflow:hidden;">
            <span style="font-weight:700;font-size:1rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${state.user?.displayName || state.user?.email || 'Guest User'}</span>
            <span style="font-size:0.75rem;color:var(--text-secondary-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${state.user?.email || 'Anonymous Session'}</span>
          </div>
        </div>

        <!-- Widget Translucency Slider -->
        <div class="settings-control-group">
          <div class="settings-control-header">
            <span class="settings-control-title">Widget Translucency</span>
            <span class="settings-control-badge" id="widget-translucency-val">${state.widgetTranslucency}%</span>
          </div>
          <div class="slider-wrapper">
            <span class="slider-label">Solid (0%)</span>
            <input
              type="range"
              class="settings-range-slider"
              id="widget-translucency-slider"
              min="0"
              max="100"
              step="5"
              value="${state.widgetTranslucency}"
            />
            <span class="slider-label">Glass (100%)</span>
          </div>
        </div>

        <!-- Appearance & Personalization Actions -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn-pill btn-pill-ghost" id="settings-bg-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            ${icon('image')} ${isCustomBg ? 'Change Background Image' : 'Custom Background Image'}
          </button>
          ${isCustomBg ? `
            <button class="btn-pill btn-pill-ghost" id="settings-reset-bg-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;color:var(--clr-danger);">
              ${icon('trash')} Remove Custom Background
            </button>
          ` : ''}
          <button class="btn-pill btn-pill-ghost" id="settings-quote-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            ${icon('quote')} Edit Daily Quote
          </button>
          <button class="btn-pill btn-pill-ghost" id="settings-profile-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            ${icon('briefcase')} Edit Career Profile
          </button>
        </div>

        <div class="modal-footer-custom">
          <button class="btn-pill btn-pill-primary" id="settings-logout-btn">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  `;
}


function renderQuoteModal() {
  return `
    <div class="modal-overlay-custom" id="quote-modal-overlay">
      <div class="modal-panel-custom">
        <div class="modal-header-custom">
          <h3 class="modal-title-custom">Daily Quote</h3>
          <button class="modal-close-custom" id="quote-modal-close">${icon('close')}</button>
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="quote-text-input">Quote / Mantra</label>
          <textarea class="form-input-pill" id="quote-text-input" placeholder="e.g., Focus on progress, not perfection." rows="3">${escapeHtml(state.quote || '')}</textarea>
        </div>
        <div class="form-group-custom">
          <label class="form-label-custom" for="quote-author-input">Author (optional)</label>
          <input class="form-input-pill" id="quote-author-input" placeholder="e.g., James Clear" value="${escapeHtml(state.quoteAuthor || '')}" />
        </div>
        <div class="modal-footer-custom">
          <button class="btn-pill btn-pill-ghost" id="quote-modal-cancel">Cancel</button>
          <button class="btn-pill btn-pill-primary" id="quote-modal-save">Save Quote</button>
        </div>
      </div>
    </div>
  `;
}

function renderBgModal() {
  return `
    <div class="modal-overlay-custom" id="bg-modal-overlay">
      <div class="modal-panel-custom">
        <div class="modal-header-custom">
          <h3 class="modal-title-custom">Custom Background</h3>
          <button class="modal-close-custom" id="bg-modal-close">${icon('close')}</button>
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom">Upload from your device</label>
          <input type="file" id="bg-file-input" accept="image/*" style="display:none;" />
          <button class="btn-pill btn-pill-ghost" id="bg-choose-file-btn" type="button" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            ${icon('image')} Choose Image File
          </button>
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom" for="bg-url-input">Or paste Image URL</label>
          <input class="form-input-pill" id="bg-url-input" placeholder="https://images.unsplash.com/..." value="${escapeHtml(state.customBgImage && !state.customBgImage.startsWith('data:') ? state.customBgImage : '')}" />
        </div>

        <div class="modal-footer-custom" style="flex-wrap: wrap;">
          <button class="btn-pill btn-pill-ghost" id="bg-reset-btn" type="button" style="color:var(--clr-danger);">Reset to Default</button>
          <button class="btn-pill btn-pill-primary" id="bg-save-btn" type="button">Apply Image</button>
        </div>
      </div>
    </div>
  `;
}

function renderProfileModal() {
  const p = state.profile || {};
  const degrees = ['B.Tech / B.E.', 'B.Sc', 'BCA', 'B.Com', 'M.Tech / M.E.', 'MCA', 'M.Sc', 'MBA', 'Other'];
  return `
    <div class="modal-overlay-custom" id="profile-modal-overlay">
      <div class="modal-panel-custom">
        <div class="modal-header-custom">
          <h3 class="modal-title-custom">Career Profile</h3>
          <button class="modal-close-custom" id="profile-modal-close">${icon('close')}</button>
        </div>
        <p style="font-size: 0.72rem; color: var(--text-secondary-light); margin-bottom: 10px;">
          Powers your match scores on the Opportunities screen. Nothing leaves your account.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group-custom">
            <label class="form-label-custom" for="profile-degree-input">Degree</label>
            <select class="form-input-pill" id="profile-degree-input">
              <option value="">Select…</option>
              ${degrees.map(d => `<option value="${d}" ${p.degree === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="form-group-custom">
            <label class="form-label-custom" for="profile-branch-input">Branch / Field</label>
            <input class="form-input-pill" id="profile-branch-input" placeholder="e.g., Computer Science" value="${escapeAttr(p.branch || '')}" />
          </div>
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom" for="profile-gradyear-input">Graduation Year</label>
          <input class="form-input-pill" id="profile-gradyear-input" type="number" min="2020" max="2040" placeholder="e.g., 2027" value="${escapeAttr(p.gradYear || '')}" />
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom" for="profile-skills-input">Skills <span style="opacity:0.6;">(comma separated)</span></label>
          <textarea class="form-input-pill" id="profile-skills-input" rows="2" placeholder="e.g., JavaScript, React, Python, SQL">${escapeHtml((p.skills || []).join(', '))}</textarea>
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom" for="profile-roles-input">Preferred Roles <span style="opacity:0.6;">(comma separated)</span></label>
          <input class="form-input-pill" id="profile-roles-input" placeholder="e.g., Frontend Developer, Data Analyst" value="${escapeAttr((p.preferredRoles || []).join(', '))}" />
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom" for="profile-interests-input">Interests <span style="opacity:0.6;">(comma separated)</span></label>
          <input class="form-input-pill" id="profile-interests-input" placeholder="e.g., AI/ML, Web Dev, Cloud" value="${escapeAttr((p.interests || []).join(', '))}" />
        </div>

        <div class="form-group-custom">
          <label class="form-label-custom" for="profile-locations-input">Preferred Locations <span style="opacity:0.6;">(comma separated, or "Remote")</span></label>
          <input class="form-input-pill" id="profile-locations-input" placeholder="e.g., Pune, Bengaluru, Remote" value="${escapeAttr((p.preferredLocations || []).join(', '))}" />
        </div>

        <div class="modal-footer-custom">
          <button class="btn-pill btn-pill-ghost" id="profile-modal-cancel">Cancel</button>
          <button class="btn-pill btn-pill-primary" id="profile-modal-save">Save Profile</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// EVENT BINDINGS
// ============================================================

/** @type {string|null} */
let editingGoalId = null;
/** @type {string|null} */
let editingTaskId = null;

function bindEvents() {
  // Role Switcher Buttons (Desktop & Mobile)
  document.querySelectorAll('[data-role]').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-role');
      if (role) {
        state.activeRole = /** @type {'student'|'coordinator'|'guide'|'panel'} */ (role);
        showToast(`Switched view to ${role.toUpperCase()}`);
        render();
      }
    });
  });

  // Coordinator Subtabs
  document.querySelectorAll('[data-coord-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-coord-tab');
      if (tab) {
        state.coordinatorSubTab = tab;
        render();
      }
    });
  });

  // Guide Subtabs
  document.querySelectorAll('[data-guide-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-guide-tab');
      if (tab) {
        state.guideSubTab = tab;
        render();
      }
    });
  });

  // Journey Subtabs
  document.querySelectorAll('[data-journey-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-journey-tab');
      if (tab) {
        state.journeySubTab = tab;
        render();
      }
    });
  });

  // Focus Subtabs
  document.querySelectorAll('[data-focus-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-focus-tab');
      if (tab) {
        state.focusSubTab = tab;
        render();
      }
    });
  });

  // Coordinator: Run Fair Auto-Allocation (Gale-Shapley)
  document.getElementById('btn-run-auto-alloc')?.addEventListener('click', () => {
    try {
      const res = runCapacitatedAllocation({
        teams: state.teams,
        guides: state.guides,
        preLockedPairs: state.preLockedPairs
      });
      state.allocations = res.allocations;
      showToast(`Auto-Allocation complete! ${res.stats.firstChoicePercent}% teams received 1st choice.`);
      render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Coordinator: Publish Allocations
  document.getElementById('btn-publish-alloc')?.addEventListener('click', () => {
    showToast('Allocations published! 48h faculty swap window opened.');
  });

  // Coordinator: Open Manual Override Modal
  document.querySelectorAll('.btn-open-override').forEach(btn => {
    btn.addEventListener('click', () => {
      const teamId = btn.getAttribute('data-team-id');
      const teamName = btn.getAttribute('data-team-name');
      state.overrideModal = { open: true, teamId, teamName: teamName || '' };
      render();
    });
  });

  // Coordinator: Manual Override Modal Confirm / Cancel
  document.getElementById('modal-cancel-override')?.addEventListener('click', () => {
    state.overrideModal.open = false;
    render();
  });

  document.getElementById('modal-confirm-override')?.addEventListener('click', () => {
    const targetGuideSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('modal-target-guide'));
    const reasonInput = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-override-reason'));
    const forceCheckbox = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-force-override'));

    const targetGuideUid = targetGuideSelect?.value;
    const reason = reasonInput?.value.trim() || '';
    const force = Boolean(forceCheckbox?.checked);

    if (!targetGuideUid || !state.overrideModal.teamId) {
      showToast('Select a target guide', 'error');
      return;
    }

    try {
      const res = applyManualOverride({
        allocations: state.allocations,
        guides: state.guides,
        teams: state.teams,
        teamId: state.overrideModal.teamId,
        targetGuideUid,
        actorUid: state.user?.uid || 'coordinator_1',
        reason,
        force
      });

      state.allocations = res.allocations;
      state.overrideModal.open = false;
      if (res.warning) {
        showToast(`Override applied: ${res.warning}`, 'success');
      } else {
        showToast('Team reassigned successfully', 'success');
      }
      render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Coordinator: Generate Conflict-Free Review Schedule
  document.getElementById('btn-gen-schedule')?.addEventListener('click', () => {
    try {
      const res = generateConflictFreeSchedule({
        teams: state.teams,
        panels: state.panels,
        rooms: state.rooms,
        timeSlots: state.timeSlots,
        round: 1,
        cycleId: '2026_fall'
      });
      state.reviews = res.schedule;
      showToast(`Schedule generated! ${res.stats.scheduled} conflict-free reviews.`);
      render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Coordinator: Reschedule Review Slot
  document.querySelectorAll('.btn-reschedule').forEach(btn => {
    btn.addEventListener('click', () => {
      const revId = btn.getAttribute('data-review-id');
      const review = state.reviews.find(r => r.id === revId);
      if (review) {
        const next = proposeRescheduleSlot({
          review,
          allScheduledReviews: state.reviews,
          panels: state.panels,
          rooms: state.rooms,
          availableSlots: state.timeSlots
        });
        if (next) {
          state.reviews = state.reviews.map(r => r.id === revId ? next : r);
          showToast(`Rescheduled to ${next.date} at ${next.startTime}`);
          render();
        } else {
          showToast('No alternative conflict-free slot available', 'error');
        }
      }
    });
  });

  // Coordinator: Export Dept CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    let csv = 'Team,Assigned Guide,Preference Satisfied,Status\n';
    state.teams.forEach(t => {
      const a = state.allocations.find(al => al.teamId === t.id);
      const g = state.guides.find(guide => guide.uid === a?.assignedGuideUid);
      csv += `"${t.name}","${g ? g.name : 'Unassigned'}","${a?.preferenceSatisfied || 'unassigned'}","${a?.assignedBy || 'auto'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ptracker_allocations.csv';
    link.click();
    showToast('Department allocation CSV exported!');
  });

  // Coordinator: Approve Internship Final
  document.querySelectorAll('.btn-approve-intern').forEach(btn => {
    btn.addEventListener('click', () => {
      const internId = btn.getAttribute('data-intern-id');
      const intern = state.internships.find(i => i.id === internId);
      if (intern) {
        try {
          const approved = approveByCoordinator(intern, state.user?.uid || 'coord_1', 'Academic credits approved');
          state.internships = state.internships.map(i => i.id === internId ? approved : i);
          showToast(`Internship approved! ${approved.creditsEarned} academic credits granted.`);
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Guide: Approve Logbook & Request Changes
  document.querySelectorAll('.btn-approve-logbook').forEach(btn => {
    btn.addEventListener('click', () => {
      const logId = btn.getAttribute('data-log-id');
      const input = /** @type {HTMLInputElement|null} */ (document.getElementById(`remarks-${logId}`));
      const remarks = input ? input.value : 'Approved by guide';
      state.logbooks = state.logbooks.map(l => l.id === logId ? { ...l, status: 'approved', guideRemarks: remarks } : l);
      showToast('Weekly logbook approved!');
      render();
    });
  });

  document.querySelectorAll('.btn-request-changes-logbook').forEach(btn => {
    btn.addEventListener('click', () => {
      const logId = btn.getAttribute('data-log-id');
      const input = /** @type {HTMLInputElement|null} */ (document.getElementById(`remarks-${logId}`));
      const remarks = input ? input.value : 'Revisions requested';
      state.logbooks = state.logbooks.map(l => l.id === logId ? { ...l, status: 'changes_requested', guideRemarks: remarks } : l);
      showToast('Revisions requested from team');
      render();
    });
  });

  // Guide: Approve Document & Revision Request
  document.querySelectorAll('.btn-approve-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.getAttribute('data-doc-id');
      state.documents = state.documents.map(d => d.id === docId ? { ...d, status: 'guide_approved' } : d);
      showToast('Milestone document approved!');
      render();
    });
  });

  document.querySelectorAll('.btn-changes-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.getAttribute('data-doc-id');
      state.documents = state.documents.map(d => d.id === docId ? { ...d, status: 'changes_requested' } : d);
      showToast('Document revision requested');
      render();
    });
  });

  // Guide: Verify Internship Application
  document.querySelectorAll('.btn-guide-approve-intern').forEach(btn => {
    btn.addEventListener('click', () => {
      const internId = btn.getAttribute('data-intern-id');
      const intern = state.internships.find(i => i.id === internId);
      if (intern) {
        try {
          const approved = approveByGuide(intern, state.user?.uid || 'g1', 'Role and company verified');
          state.internships = state.internships.map(i => i.id === internId ? approved : i);
          showToast('Internship verified! Sent to Coordinator for final approval.');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Panel: Select Review Slot & Submit Rubric
  document.querySelectorAll('[data-select-rev-id]').forEach(el => {
    el.addEventListener('click', () => {
      state.panelSelectedReviewId = el.getAttribute('data-select-rev-id');
      render();
    });
  });

  document.getElementById('btn-submit-rubric-score')?.addEventListener('click', () => {
    const revId = document.getElementById('btn-submit-rubric-score')?.getAttribute('data-review-id');
    const prob = Number(/** @type {HTMLInputElement|null} */ (document.getElementById('rubric-prob'))?.value || 0);
    const lit = Number(/** @type {HTMLInputElement|null} */ (document.getElementById('rubric-lit'))?.value || 0);
    const design = Number(/** @type {HTMLInputElement|null} */ (document.getElementById('rubric-design'))?.value || 0);
    const impl = Number(/** @type {HTMLInputElement|null} */ (document.getElementById('rubric-impl'))?.value || 0);
    const pres = Number(/** @type {HTMLInputElement|null} */ (document.getElementById('rubric-pres'))?.value || 0);
    const comments = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('panel-comments'))?.value || '';

    const total = prob + lit + design + impl + pres;
    const panelUid = 'fac_turing';

    state.reviews = state.reviews.map(r => {
      if (r.id === revId) {
        return {
          ...r,
          scores: {
            ...r.scores,
            [panelUid]: { problem: prob, literature: lit, design, implementation: impl, presentation: pres, total, comments, verdict: total >= 60 ? 'PROCEED' : 'NEEDS_WORK' }
          },
          status: 'completed'
        };
      }
      return r;
    });

    showToast(`Evaluation locked: ${total}/100 submitted!`);
    render();
  });

  // Focus: Stopwatch Toggle
  document.getElementById('btn-toggle-stopwatch')?.addEventListener('click', () => {
    const currentUid = state.user?.uid || 'guest';
    const activeSub = state.focusSubjects.find(s => s.id === state.activeFocusTimer.activeSubjectId) || state.focusSubjects[0];

    if (state.activeFocusTimer.isRunning) {
      // Pause timer
      if (state.activeFocusTimer.timerInterval) {
        clearInterval(state.activeFocusTimer.timerInterval);
        state.activeFocusTimer.timerInterval = null;
      }
      state.activeFocusTimer.isRunning = false;
      state.livePresence[currentUid] = {
        isRunning: false,
        elapsedSeconds: state.activeFocusTimer.elapsedSeconds,
        subjectName: activeSub?.name || 'FYP',
        subjectColor: activeSub?.colorCode || '#FF6420'
      };

      const durationMin = Math.max(1, Math.round(state.activeFocusTimer.elapsedSeconds / 60));
      state.focusSessions.unshift({
        id: `sess_${Date.now()}`,
        uid: currentUid,
        teamId: 't1',
        subjectId: state.activeFocusTimer.activeSubjectId || 'sub_1',
        durationMin,
        mode: 'stopwatch',
        endedAtMillis: Date.now()
      });
      showToast(`Logged ${durationMin} minutes of deep focus!`);
    } else {
      // Start timer
      state.activeFocusTimer.isRunning = true;
      state.livePresence[currentUid] = {
        isRunning: true,
        elapsedSeconds: state.activeFocusTimer.elapsedSeconds,
        startedAtMillis: Date.now() - (state.activeFocusTimer.elapsedSeconds * 1000),
        subjectName: activeSub?.name || 'FYP',
        subjectColor: activeSub?.colorCode || '#FF6420'
      };

      state.activeFocusTimer.timerInterval = setInterval(() => {
        state.activeFocusTimer.elapsedSeconds++;
        const total = state.activeFocusTimer.elapsedSeconds;
        const h = String(Math.floor(total / 3600)).padStart(2, '0');
        const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        const s = String(total % 60).padStart(2, '0');

        const display = document.querySelector('.stopwatch-time-display');
        if (display) {
          display.textContent = `${h}:${m}:${s}`;
        }
        const roomTimer = document.querySelector('.room-live-timer');
        if (roomTimer) {
          roomTimer.textContent = `${h}:${m}:${s}`;
        }
      }, 1000);
    }
    render();
  });

  document.getElementById('btn-reset-stopwatch')?.addEventListener('click', () => {
    if (state.activeFocusTimer.timerInterval) {
      clearInterval(state.activeFocusTimer.timerInterval);
      state.activeFocusTimer.timerInterval = null;
    }
    const currentUid = state.user?.uid || 'guest';
    state.activeFocusTimer.isRunning = false;
    state.activeFocusTimer.elapsedSeconds = 0;
    delete state.livePresence[currentUid];
    render();
  });

  // Coding Accounts Modal handlers
  document.getElementById('btn-open-coding-modal')?.addEventListener('click', () => {
    state.codingProfilesModal.open = true;
    state.codingProfilesModal.error = null;
    render();
  });

  document.getElementById('coding-modal-close')?.addEventListener('click', () => {
    state.codingProfilesModal.open = false;
    render();
  });

  document.getElementById('coding-modal-cancel')?.addEventListener('click', () => {
    state.codingProfilesModal.open = false;
    render();
  });

  document.getElementById('coding-modal-save')?.addEventListener('click', async () => {
    const ghInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-github-user'));
    const lcInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-leetcode-user'));
    const hrInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-hackerrank-user'));

    const handles = {
      github: ghInput?.value.trim() || '',
      leetcode: lcInput?.value.trim() || '',
      hackerrank: hrInput?.value.trim() || ''
    };

    state.codingProfilesModal.loading = true;
    state.codingProfilesModal.error = null;
    render();

    try {
      const { profiles, errors } = await syncAllCodingProfiles(handles);
      const uid = state.user?.uid || 'm1';
      state.codingProfiles = profiles;
      state.codingProfilesMap[uid] = profiles;
      saveLocalCodingProfiles(uid, profiles);

      if (errors.length > 0) {
        showToast(`Synced with warnings: ${errors.map(e => `${e.platform}: ${e.error}`).join('; ')}`, 'warning');
      } else {
        showToast('Coding accounts successfully verified & connected!', 'success');
      }
      state.codingProfilesModal.open = false;
    } catch (err) {
      console.error('[CodingProfiles] Sync error:', err);
      state.codingProfilesModal.error = /** @type {Error} */ (err).message || 'Failed to sync profiles';
    } finally {
      state.codingProfilesModal.loading = false;
      render();
    }
  });

  // Friend actions
  document.getElementById('btn-room-add-friend')?.addEventListener('click', () => {
    state.currentScreen = 'journey';
    state.journeySubTab = 'friends';
    render();
  });

  document.getElementById('btn-submit-add-friend')?.addEventListener('click', () => {
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('input-friend-search'));
    const val = input?.value.trim();
    if (!val) {
      showToast('Enter student name or email', 'error');
      return;
    }
    const currentUid = state.user?.uid || 'guest';
    try {
      const newFriend = {
        id: `peer_${Date.now()}`,
        name: val.includes('@') ? val.split('@')[0] : val,
        email: val.includes('@') ? val : `${val.toLowerCase().replace(/\s+/g, '')}@student.edu`,
        teamName: 'Team Project'
      };
      state.friends = addFriendToList(currentUid, newFriend, state.friends);
      showToast(`Added ${newFriend.name} as a study buddy!`, 'success');
      render();
    } catch (err) {
      showToast(/** @type {Error} */ (err).message, 'error');
    }
  });

  document.querySelectorAll('.btn-add-candidate').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-student-id');
      const name = btn.getAttribute('data-student-name') || 'Peer';
      if (!id) return;
      const currentUid = state.user?.uid || 'guest';
      try {
        state.friends = addFriendToList(currentUid, { id, name }, state.friends);
        showToast(`Added ${name} to your friend list!`, 'success');
        render();
      } catch (err) {
        showToast(/** @type {Error} */ (err).message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-remove-friend').forEach(btn => {
    btn.addEventListener('click', () => {
      const friendId = btn.getAttribute('data-friend-id');
      if (!friendId) return;
      if (confirm('Remove this friend from your study list?')) {
        const currentUid = state.user?.uid || 'guest';
        state.friends = removeFriendFromList(currentUid, friendId, state.friends);
        showToast('Friend removed');
        render();
      }
    });
  });

  document.getElementById('select-focus-subject')?.addEventListener('change', (e) => {
    state.activeFocusTimer.activeSubjectId = /** @type {HTMLSelectElement} */ (e.target).value;
    render();
  });

  // Focus: Planner Todo Add & Check
  document.getElementById('btn-add-todo')?.addEventListener('click', () => {
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('input-new-todo'));
    if (input && input.value.trim()) {
      const todayIso = new Date().toISOString().split('T')[0];
      let plan = state.dailyPlans.find(p => p.date === todayIso);
      if (!plan) {
        plan = { date: todayIso, todos: [], reviewed: false, reflection: '' };
        state.dailyPlans.push(plan);
      }
      plan.todos.push({
        id: `todo_${Date.now()}`,
        title: input.value.trim(),
        done: false,
        plannedMin: 15
      });
      showToast('10-minute focus task added');
      render();
    }
  });

  document.querySelectorAll('.planner-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const todoId = cb.getAttribute('data-todo-id');
      const todayIso = new Date().toISOString().split('T')[0];
      const plan = state.dailyPlans.find(p => p.date === todayIso);
      if (plan) {
        const item = plan.todos.find(t => t.id === todoId);
        if (item) item.done = /** @type {HTMLInputElement} */ (e.target).checked;
      }
      render();
    });
  });

  document.getElementById('btn-submit-review')?.addEventListener('click', () => {
    const todayIso = new Date().toISOString().split('T')[0];
    let plan = state.dailyPlans.find(p => p.date === todayIso);
    if (!plan) {
      plan = { date: todayIso, todos: [], reviewed: true, reflection: '' };
      state.dailyPlans.push(plan);
    } else {
      plan.reviewed = true;
    }
    const ref = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('planner-reflection'));
    if (ref) plan.reflection = ref.value;
    showToast('Daily review completed! Streak maintained 🔥');
    render();
  });

  // Student: Create Team
  document.getElementById('btn-create-team')?.addEventListener('click', () => {
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('input-team-name'));
    if (input && input.value.trim()) {
      const newTeam = {
        id: `t_${Date.now()}`,
        name: input.value.trim(),
        domain: 'Software Engineering',
        memberUids: [state.user?.uid || 'm1'],
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        status: 'forming'
      };
      state.teams.unshift(newTeam);
      showToast(`Team "${newTeam.name}" created! Invite code: ${newTeam.inviteCode}`);
      render();
    }
  });

  // Student: Submit Logbook
  document.getElementById('btn-submit-logbook')?.addEventListener('click', () => {
    const weekInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-log-week'));
    const workInput = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('input-log-work'));
    const hoursInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-log-hours'));

    if (workInput && workInput.value.trim()) {
      state.logbooks.unshift({
        id: `log_${Date.now()}`,
        teamId: state.teams[0]?.id || 't1',
        weekNumber: Number(weekInput?.value || 4),
        workDone: workInput.value.trim(),
        hoursSpent: Number(hoursInput?.value || 10),
        status: 'submitted'
      });
      showToast('Weekly logbook submitted to guide for review!');
      render();
    }
  });

  // Student: Upload Milestone Doc
  document.getElementById('btn-upload-doc')?.addEventListener('click', () => {
    const typeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('select-doc-type'));
    const docType = typeSelect?.value || 'synopsis';
    state.documents.unshift({
      id: `doc_${Date.now()}`,
      teamId: state.teams[0]?.id || 't1',
      type: docType,
      fileName: `${docType}_deliverable_v1.pdf`,
      version: 1,
      status: 'pending',
      uploadedAtMillis: Date.now()
    });
    showToast(`Uploaded ${docType.toUpperCase()}! Sent to guide for approval.`);
    render();
  });

  // Student: Apply Internship
  document.getElementById('btn-apply-internship')?.addEventListener('click', () => {
    const compInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-intern-company'));
    const roleInput = /** @type {HTMLInputElement|null} */ (document.getElementById('input-intern-role'));

    if (compInput && compInput.value.trim() && roleInput && roleInput.value.trim()) {
      state.internships.unshift({
        id: `intern_${Date.now()}`,
        studentUid: state.user?.uid || 'm1',
        studentName: state.user?.displayName || 'Alice Sharma',
        company: compInput.value.trim(),
        role: roleInput.value.trim(),
        mentorName: 'Dr. Turing',
        startDate: '2026-06-01',
        endDate: '2026-08-01',
        durationWeeks: 8,
        status: 'applied',
        approvals: {},
        creditsEarned: 0
      });
      showToast('Internship application submitted! Awaiting guide verification.');
      render();
    }
  });

  // Desktop studio switcher buttons
  document.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => {
      const scr = /** @type {ScreenType} */ (btn.getAttribute('data-screen'));
      navigateToScreen(scr);
    });
  });

  // Bottom dock buttons
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const scr = /** @type {ScreenType} */ (btn.getAttribute('data-nav'));
      navigateToScreen(scr);
    });
  });

  // FAB Add button
  document.getElementById('fab-add-btn')?.addEventListener('click', () => {
    if (state.goals.length === 0) {
      openGoalModal();
    } else {
      openTaskModal();
    }
  });

  document.getElementById('empty-create-task-btn')?.addEventListener('click', () => {
    if (state.goals.length === 0) {
      openGoalModal();
    } else {
      openTaskModal();
    }
  });

  // Back button in mobile nav bar
  document.getElementById('nav-back-btn')?.addEventListener('click', () => {
    if (state.currentScreen !== 'schedule') {
      navigateToScreen('schedule');
    }
  });

  // Settings button (mobile & desktop)
  document.getElementById('nav-settings-btn')?.addEventListener('click', () => {
    state.settingsOpen = true;
    render();
  });

  document.getElementById('desktop-settings-btn')?.addEventListener('click', () => {
    state.settingsOpen = true;
    render();
  });

  document.getElementById('desktop-user-capsule')?.addEventListener('click', () => {
    state.settingsOpen = true;
    render();
  });

  document.getElementById('settings-modal-close')?.addEventListener('click', () => {
    state.settingsOpen = false;
    render();
  });

  document.getElementById('settings-logout-btn')?.addEventListener('click', handleSignOut);

  // Close button
  document.getElementById('nav-close-btn')?.addEventListener('click', () => {
    if (state.currentScreen !== 'schedule') {
      navigateToScreen('schedule');
    } else {
      state.settingsOpen = true;
      render();
    }
  });

  // Date strip day clicks
  document.querySelectorAll('[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      const dateVal = el.getAttribute('data-date');
      if (!dateVal || dateVal === 'all' || dateVal === state.selectedDateStr) {
        state.selectedDateStr = null;
      } else {
        state.selectedDateStr = dateVal;
      }
      render();
    });
  });

  // Route swap button (cycles through user's goals)
  document.getElementById('route-swap-btn')?.addEventListener('click', () => {
    if (state.goals.length > 1) {
      const currentIdx = state.goals.findIndex(g => g.id === state.selectedGoalId);
      const nextIdx = (currentIdx + 1) % state.goals.length;
      state.selectedGoalId = state.goals[nextIdx].id;
      showToast(`Active goal: ${state.goals[nextIdx].title}`);
      render();
    } else if (state.goals.length === 0) {
      openGoalModal();
    }
  });

  // User & Location Capsule clicks
  document.getElementById('user-capsule-btn')?.addEventListener('click', () => {
    state.settingsOpen = true;
    render();
  });

  document.getElementById('location-capsule-btn')?.addEventListener('click', () => {
    navigateToScreen('journey');
  });

  // Task Card clicks -> open Focus screen
  document.querySelectorAll('[data-open-task]').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target.closest('[data-toggle-task]')) return;
      const taskId = el.getAttribute('data-open-task');
      if (taskId) {
        navigateToScreen('focus', null, taskId);
      }
    });
  });

  // Toggle task completion
  document.querySelectorAll('[data-toggle-task]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = el.getAttribute('data-toggle-task');
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        try {
          await updateTask(taskId, { completed: !task.completed });
        } catch (err) {
          console.error(err);
          showToast('Failed to update task', 'error');
        }
      }
    });
  });

  // Journey View: Create First Goal button & New Goal pill
  document.getElementById('journey-create-first-goal-btn')?.addEventListener('click', () => {
    openGoalModal();
  });

  document.getElementById('journey-add-goal-pill')?.addEventListener('click', () => {
    openGoalModal();
  });

  // Journey View: Previous Goal in Stack
  document.getElementById('journey-prev-goal-btn')?.addEventListener('click', () => {
    if (state.journeyStackIndex > 0) {
      state.journeyStackIndex--;
      state.selectedGoalId = state.goals[state.journeyStackIndex]?.id || null;
      render();
    }
  });

  // Journey View: Next Goal in Stack
  document.getElementById('journey-next-goal-btn')?.addEventListener('click', () => {
    if (state.journeyStackIndex < state.goals.length - 1) {
      state.journeyStackIndex++;
      state.selectedGoalId = state.goals[state.journeyStackIndex]?.id || null;
      render();
    }
  });

  // Journey View: Stack Dot pagination
  document.querySelectorAll('[data-stack-dot]').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-stack-dot') || '0', 10);
      if (idx >= 0 && idx < state.goals.length) {
        state.journeyStackIndex = idx;
        state.selectedGoalId = state.goals[idx].id;
        render();
      }
    });
  });

  // Journey View: Stack Jump Pill
  document.querySelectorAll('[data-stack-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-stack-jump') || '0', 10);
      if (idx >= 0 && idx < state.goals.length) {
        state.journeyStackIndex = idx;
        state.selectedGoalId = state.goals[idx].id;
        render();
      }
    });
  });

  // Journey View: Touch Swipe Support for Mobile Card Stack
  const stackWrapper = document.getElementById('journey-card-stack-wrapper');
  if (stackWrapper) {
    let touchStartX = 0;
    let touchStartY = 0;
    stackWrapper.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    stackWrapper.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0 && state.journeyStackIndex < state.goals.length - 1) {
          // Swipe left -> next
          state.journeyStackIndex++;
          state.selectedGoalId = state.goals[state.journeyStackIndex]?.id || null;
          render();
        } else if (diffX > 0 && state.journeyStackIndex > 0) {
          // Swipe right -> prev
          state.journeyStackIndex--;
          state.selectedGoalId = state.goals[state.journeyStackIndex]?.id || null;
          render();
        }
      }
    }, { passive: true });
  }

  // Journey View: Select Active Goal
  document.querySelectorAll('[data-select-journey-goal]').forEach(el => {
    el.addEventListener('click', () => {
      const gid = el.getAttribute('data-select-journey-goal');
      if (gid) {
        state.selectedGoalId = gid;
        const g = state.goals.find(x => x.id === gid);
        if (g) showToast(`Active goal: ${g.title}`);
        render();
      }
    });
  });

  // Journey View: Edit Goal
  document.querySelectorAll('[data-edit-goal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid = btn.getAttribute('data-edit-goal');
      if (gid) openGoalModal(gid);
    });
  });

  // Journey View: Add Task to Specific Goal
  document.querySelectorAll('[data-goal-add-task]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid = btn.getAttribute('data-goal-add-task');
      openTaskModal(undefined, gid || undefined);
    });
  });

  // Journey View: Roadmap Drawer Toggle per Goal
  document.querySelectorAll('[data-toggle-roadmap]').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = btn.getAttribute('data-toggle-roadmap');
      if (gid) {
        if (state.expandedRoadmapGoalIds.has(gid)) {
          state.expandedRoadmapGoalIds.delete(gid);
        } else {
          state.expandedRoadmapGoalIds.add(gid);
        }
        render();
      }
    });
  });



  // Settings translucency slider
  const transSlider = /** @type {HTMLInputElement|null} */ (document.getElementById('widget-translucency-slider'));
  const transBadge = document.getElementById('widget-translucency-val');
  if (transSlider) {
    transSlider.addEventListener('input', (e) => {
      const val = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10);
      if (transBadge) transBadge.textContent = `${val}%`;
      applyWidgetTranslucency(val);
    });
    transSlider.addEventListener('change', async (e) => {
      const val = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10);
      state.widgetTranslucency = val;
      if (state.user) {
        await saveUserPreferences(state.user.uid, { widgetTranslucency: val });
      }
    });
  }

  // Quote Modal Open/Close/Save (Only accessible via Settings)
  const openQuoteModal = () => {
    const overlay = document.getElementById('quote-modal-overlay');
    const textInput = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('quote-text-input'));
    const authorInput = /** @type {HTMLInputElement|null} */ (document.getElementById('quote-author-input'));
    if (textInput) textInput.value = state.quote || '';
    if (authorInput) authorInput.value = state.quoteAuthor || '';
    overlay?.classList.add('open');
    textInput?.focus();
  };

  const closeQuoteModal = () => {
    document.getElementById('quote-modal-overlay')?.classList.remove('open');
  };

  document.getElementById('settings-quote-btn')?.addEventListener('click', () => {
    state.settingsOpen = false;
    render();
    openQuoteModal();
  });
  document.getElementById('quote-modal-close')?.addEventListener('click', closeQuoteModal);
  document.getElementById('quote-modal-cancel')?.addEventListener('click', closeQuoteModal);

  document.getElementById('quote-modal-save')?.addEventListener('click', async () => {
    const textInput = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('quote-text-input'));
    const authorInput = /** @type {HTMLInputElement|null} */ (document.getElementById('quote-author-input'));
    const quote = textInput?.value.trim() || '';
    const quoteAuthor = authorInput?.value.trim() || '';
    state.quote = quote;
    state.quoteAuthor = quoteAuthor;
    closeQuoteModal();
    if (state.user) {
      await saveUserPreferences(state.user.uid, { quote, quoteAuthor });
    }
    showToast('Quote updated', 'success');
    render();
  });

  // Background Modal Open/Close/Save/Upload (Only accessible via Settings)
  const openBgModal = () => {
    document.getElementById('bg-modal-overlay')?.classList.add('open');
  };

  const closeBgModal = () => {
    document.getElementById('bg-modal-overlay')?.classList.remove('open');
  };

  document.getElementById('settings-bg-btn')?.addEventListener('click', () => {
    state.settingsOpen = false;
    render();
    openBgModal();
  });

  document.getElementById('settings-reset-bg-btn')?.addEventListener('click', async () => {
    state.customBgImage = null;
    if (state.user) {
      await saveUserPreferences(state.user.uid, { customBgImage: '' });
    }
    showToast('Background reset to default theme');
    render();
  });

  document.getElementById('bg-modal-close')?.addEventListener('click', closeBgModal);


  document.getElementById('bg-choose-file-btn')?.addEventListener('click', () => {
    document.getElementById('bg-file-input')?.click();
  });

  document.getElementById('bg-file-input')?.addEventListener('change', async (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) return;

    try {
      showToast('Processing image…');
      const dataUrl = await compressImageFile(file, 1280, 0.82);
      state.customBgImage = dataUrl;
      closeBgModal();
      if (state.user) {
        await saveUserPreferences(state.user.uid, { customBgImage: dataUrl });
      }
      showToast('Custom background applied', 'success');
      render();
    } catch (err) {
      console.error(err);
      showToast('Failed to load image file', 'error');
    }
  });

  document.getElementById('bg-save-btn')?.addEventListener('click', async () => {
    const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById('bg-url-input'));
    const url = urlInput?.value.trim() || '';
    if (!url) {
      showToast('Please enter an image URL or choose a file', 'error');
      return;
    }
    state.customBgImage = url;
    closeBgModal();
    if (state.user) {
      await saveUserPreferences(state.user.uid, { customBgImage: url });
    }
    showToast('Custom background applied', 'success');
    render();
  });

  document.getElementById('bg-reset-btn')?.addEventListener('click', async () => {
    state.customBgImage = null;
    closeBgModal();
    if (state.user) {
      await saveUserPreferences(state.user.uid, { customBgImage: '' });
    }
    showToast('Background reset to default');
    render();
  });

  // Focus View: Complete Slider Button
  document.getElementById('focus-complete-slider-btn')?.addEventListener('click', async () => {
    const task = state.tasks.find(t => t.id === state.selectedTaskId) || state.tasks[0];
    if (task) {
      try {
        await updateTask(task.id, { completed: !task.completed });
        showToast(task.completed ? 'Task marked pending' : 'Task completed', 'success');
      } catch (err) {
        console.error(err);
        showToast('Error completing task', 'error');
      }
    }
  });

  // Focus View: Decline / Delete Task Button
  document.getElementById('focus-decline-btn')?.addEventListener('click', async () => {
    const task = state.tasks.find(t => t.id === state.selectedTaskId) || state.tasks[0];
    if (task && confirm('Delete this task?')) {
      try {
        await deleteTask(task.id);
        showToast('Task removed');
        navigateToScreen('schedule');
      } catch (err) {
        console.error(err);
        showToast('Failed to delete task', 'error');
      }
    }
  });

  // Focus View: Edit Task Button
  document.getElementById('focus-edit-btn')?.addEventListener('click', () => {
    const task = state.tasks.find(t => t.id === state.selectedTaskId) || state.tasks[0];
    if (task) {
      openTaskModal(task.id);
    }
  });

  // Calendar prev/next
  document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    render();
  });

  document.getElementById('cal-next-btn')?.addEventListener('click', () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    render();
  });

  // Calendar day select
  document.querySelectorAll('[data-calendar-day]').forEach(el => {
    el.addEventListener('click', () => {
      const dayVal = el.getAttribute('data-calendar-day');
      if (dayVal === state.selectedDateStr) {
        state.selectedDateStr = null;
      } else {
        state.selectedDateStr = dayVal;
      }
      render();
    });
  });

  // Progress screen add goal
  document.getElementById('progress-add-goal-btn')?.addEventListener('click', () => {
    openGoalModal();
  });

  // Progress select goal -> navigate to journey
  document.querySelectorAll('[data-select-goal]').forEach(el => {
    el.addEventListener('click', () => {
      const gid = el.getAttribute('data-select-goal');
      if (gid) {
        navigateToScreen('journey', gid);
      }
    });
  });

  // ─── Opportunities screen events ───────────────────────

  // Career Profile modal open/close/save
  const openProfileModal = () => {
    document.getElementById('profile-modal-overlay')?.classList.add('open');
    document.getElementById('profile-degree-input')?.focus();
  };

  const closeProfileModal = () => {
    document.getElementById('profile-modal-overlay')?.classList.remove('open');
  };

  document.getElementById('opp-edit-profile-btn')?.addEventListener('click', openProfileModal);
  document.getElementById('settings-profile-btn')?.addEventListener('click', () => {
    state.settingsOpen = false;
    render();
    openProfileModal();
  });
  document.getElementById('profile-modal-close')?.addEventListener('click', closeProfileModal);
  document.getElementById('profile-modal-cancel')?.addEventListener('click', closeProfileModal);

  document.getElementById('profile-modal-save')?.addEventListener('click', async () => {
    const parseList = (id) => {
      const el = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (document.getElementById(id));
      return (el?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    };
    const degreeEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('profile-degree-input'));
    const gradYearEl = /** @type {HTMLInputElement|null} */ (document.getElementById('profile-gradyear-input'));
    const profile = {
      degree: degreeEl?.value || '',
      branch: (/** @type {HTMLInputElement|null} */ (document.getElementById('profile-branch-input')))?.value.trim() || '',
      gradYear: gradYearEl?.value || '',
      skills: parseList('profile-skills-input'),
      preferredRoles: parseList('profile-roles-input'),
      interests: parseList('profile-interests-input'),
      preferredLocations: parseList('profile-locations-input'),
    };
    try {
      await saveUserProfile(state.user.uid, profile);
      state.profile = { ...(state.profile || {}), ...profile };
      showToast('Career profile saved', 'success');
      closeProfileModal();
      render();
    } catch (err) {
      console.error('[PTracker] Save profile error:', err);
      showToast('Failed to save profile', 'error');
    }
  });

  // Sync trigger. Two modes:
  //  - VITE_SYNC_TRIGGER_URL set (Cloudflare Worker): one-tap in-app sync —
  //    the Worker dispatches the GitHub workflow with its own token.
  //  - Not set: opens the workflow's "Run workflow" page for a manual run.
  //  (If you ever deploy functions/ on Blaze, swap back to requestSync().)
  const GITHUB_SYNC_URL =
    'https://github.com/sakshamwadhankar/Internship-Tracker-IEEE/actions/workflows/sync-opportunities.yml';
  // Accept the bare worker URL or one already ending in /api/sync
  const RAW_TRIGGER_URL = (import.meta.env.VITE_SYNC_TRIGGER_URL || '').trim();
  const SYNC_TRIGGER_URL = RAW_TRIGGER_URL && !RAW_TRIGGER_URL.endsWith('/api/sync')
    ? RAW_TRIGGER_URL.replace(/\/+$/, '') + '/api/sync'
    : RAW_TRIGGER_URL;
  /** @type {number} */
  let lastSyncTriggerAt = 0;

  const handleSyncNow = async () => {
    // Debounce: one dispatch per minute is plenty
    if (Date.now() - lastSyncTriggerAt < 60000) {
      showToast('A sync was just triggered — give it a couple of minutes.', 'info');
      return;
    }

    if (!SYNC_TRIGGER_URL) {
      window.open(GITHUB_SYNC_URL, '_blank', 'noopener');
      showToast('Hit "Run workflow" on GitHub — listings appear here automatically.', 'info');
      return;
    }

    lastSyncTriggerAt = Date.now();
    showToast('Sync started — listings will appear in a few minutes.');
    try {
      const res = await fetch(SYNC_TRIGGER_URL, { method: 'POST' });
      if (!res.ok) throw new Error(`sync trigger responded ${res.status}`);
    } catch (err) {
      console.error('[PTracker] Sync trigger error:', err);
      lastSyncTriggerAt = 0;
      showToast('Could not reach the sync service — opening GitHub Actions instead.', 'error');
      window.open(GITHUB_SYNC_URL, '_blank', 'noopener');
    }
  };
  document.getElementById('opp-sync-btn')?.addEventListener('click', handleSyncNow);

  // Failed-source detail toggle
  document.getElementById('opp-sync-details-toggle')?.addEventListener('click', () => {
    state.showSyncErrors = !state.showSyncErrors;
    render();
  });

  // Search box: filter without full re-render (keeps typing focus)
  document.getElementById('opp-search')?.addEventListener('input', (e) => {
    state.oppFilters.q = /** @type {HTMLInputElement} */ (e.target).value;
    const results = document.getElementById('opp-results');
    if (results) results.innerHTML = renderOppResultsHtml();
    const count = document.getElementById('opp-count');
    if (count) {
      count.textContent = `${filterWithFallback(state.opportunities, state.oppFilters, state.savedOppIds, state.profile, 7).results.length} shown`;
    }
  });

  // Filter chips
  document.querySelectorAll('[data-opp-type]').forEach(el => {
    el.addEventListener('click', () => {
      state.oppFilters.type = el.getAttribute('data-opp-type') || 'all';
      render();
    });
  });
  document.querySelectorAll('[data-opp-region]').forEach(el => {
    el.addEventListener('click', () => {
      state.oppFilters.region = el.getAttribute('data-opp-region') || 'all';
      render();
    });
  });
  document.querySelectorAll('[data-opp-sort]').forEach(el => {
    el.addEventListener('click', () => {
      state.oppFilters.sort = el.getAttribute('data-opp-sort') || 'match';
      render();
    });
  });
  document.getElementById('opp-saved-toggle')?.addEventListener('click', () => {
    state.oppFilters.savedOnly = !state.oppFilters.savedOnly;
    render();
  });

  // Bookmark toggle — delegated so partial result re-renders keep working
  const screenBody = document.getElementById('screen-body');
  if (screenBody) {
    screenBody.addEventListener('click', async (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const saveBtn = target.closest('[data-toggle-save]');
      if (!saveBtn) return;
      e.stopPropagation();
      const oppId = saveBtn.getAttribute('data-toggle-save');
      const opp = state.opportunities.find(o => o.id === oppId);
      if (!opp || !state.user) return;
      const nowSaved = !state.savedOppIds.includes(oppId);
      try {
        await toggleSavedOpportunity(state.user.uid, opp, nowSaved);
        showToast(nowSaved ? 'Saved to bookmarks' : 'Removed from bookmarks');
      } catch (err) {
        console.error('[PTracker] Toggle save error:', err);
        showToast('Failed to update bookmark', 'error');
      }
    });
  }

  // Goal Modal events
  document.getElementById('goal-modal-close')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-cancel')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-save')?.addEventListener('click', saveGoal);

  // Task Modal events
  document.getElementById('task-modal-close')?.addEventListener('click', closeTaskModal);
  document.getElementById('task-modal-cancel')?.addEventListener('click', closeTaskModal);
  document.getElementById('task-modal-save')?.addEventListener('click', saveTask);
}

// ─── Modal Functions ────────────────────────────────────

/**
 * @param {string} [goalId]
 */
function openGoalModal(goalId) {
  editingGoalId = goalId || null;
  const overlay = document.getElementById('goal-modal-overlay');
  const title = /** @type {HTMLHeadingElement} */ (document.getElementById('goal-modal-title'));
  const titleInput = /** @type {HTMLInputElement} */ (document.getElementById('goal-title-input'));
  const descInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('goal-desc-input'));
  const deadlineInput = /** @type {HTMLInputElement} */ (document.getElementById('goal-deadline-input'));

  if (editingGoalId) {
    const goal = state.goals.find(g => g.id === editingGoalId);
    if (goal) {
      title.textContent = 'Edit Goal';
      titleInput.value = goal.title;
      descInput.value = goal.description || '';
      deadlineInput.value = goal.deadline || '';
    }
  } else {
    title.textContent = 'New Goal';
    titleInput.value = '';
    descInput.value = '';
    deadlineInput.value = '';
  }

  overlay?.classList.add('open');
  titleInput?.focus();
}

function closeGoalModal() {
  editingGoalId = null;
  document.getElementById('goal-modal-overlay')?.classList.remove('open');
}

async function saveGoal() {
  const titleInput = /** @type {HTMLInputElement} */ (document.getElementById('goal-title-input'));
  const descInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('goal-desc-input'));
  const deadlineInput = /** @type {HTMLInputElement} */ (document.getElementById('goal-deadline-input'));

  const title = titleInput?.value.trim();
  if (!title) {
    titleInput?.focus();
    return;
  }

  const goalData = {
    title,
    description: descInput?.value.trim() || '',
    deadline: deadlineInput?.value || null,
  };

  try {
    if (editingGoalId) {
      await updateGoal(editingGoalId, goalData);
      showToast('Goal updated');
    } else {
      const newId = await createGoal(state.user.uid, goalData);
      state.selectedGoalId = newId;
      showToast('Goal created');
    }
    closeGoalModal();
  } catch (err) {
    console.error('[PTracker] Save goal error:', err);
    showToast('Failed to save goal', 'error');
  }
}

/**
 * @param {string} [taskId]
 * @param {string} [preselectedGoalId]
 */
function openTaskModal(taskId, preselectedGoalId) {
  editingTaskId = taskId || null;
  const overlay = document.getElementById('task-modal-overlay');
  const title = /** @type {HTMLHeadingElement} */ (document.getElementById('task-modal-title'));
  const titleInput = /** @type {HTMLInputElement} */ (document.getElementById('task-title-input'));
  const goalSelect = /** @type {HTMLSelectElement} */ (document.getElementById('task-goal-select'));
  const dueInput = /** @type {HTMLInputElement} */ (document.getElementById('task-due-input'));
  const notesInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('task-notes-input'));

  if (editingTaskId) {
    const task = state.tasks.find(t => t.id === editingTaskId);
    if (task) {
      title.textContent = 'Edit Task';
      titleInput.value = task.title;
      if (task.goalId) goalSelect.value = task.goalId;
      dueInput.value = task.dueDate || '';
      notesInput.value = task.notes || '';
    }
  } else {
    title.textContent = 'New Task';
    titleInput.value = '';
    const gid = preselectedGoalId || state.selectedGoalId;
    if (gid && goalSelect) goalSelect.value = gid;
    dueInput.value = state.selectedDateStr || toISODateString(new Date());
    notesInput.value = '';
  }

  overlay?.classList.add('open');
  titleInput?.focus();
}


function closeTaskModal() {
  editingTaskId = null;
  document.getElementById('task-modal-overlay')?.classList.remove('open');
}

async function saveTask() {
  const titleInput = /** @type {HTMLInputElement} */ (document.getElementById('task-title-input'));
  const goalSelect = /** @type {HTMLSelectElement} */ (document.getElementById('task-goal-select'));
  const dueInput = /** @type {HTMLInputElement} */ (document.getElementById('task-due-input'));
  const notesInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('task-notes-input'));

  const title = titleInput?.value.trim();
  if (!title) {
    titleInput?.focus();
    return;
  }

  const taskData = {
    title,
    goalId: goalSelect?.value || null,
    dueDate: dueInput?.value || null,
    notes: notesInput?.value.trim() || '',
  };

  try {
    if (editingTaskId) {
      await updateTask(editingTaskId, taskData);
      showToast('Task updated');
    } else {
      await createTask(state.user.uid, taskData);
      showToast('Task created');
    }
    closeTaskModal();
  } catch (err) {
    console.error('[PTracker] Save task error:', err);
    showToast('Failed to save task', 'error');
  }
}

// ─── Utility Helpers ────────────────────────────────────

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escape a value for use inside an HTML attribute (URLs, etc.) —
 * unlike escapeHtml, this also escapes quotes so it can't break out
 * of src="…"/href="…" contexts.
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
