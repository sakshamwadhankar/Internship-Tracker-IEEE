/**
 * Data store — abstracts Firestore operations for goals, tasks, subtasks, and notes.
 * Provides real-time listeners for cross-device sync.
 */

import {
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from './firebase.js';

/** @type {Map<string, Function>} Active Firestore unsubscribe handlers */
const activeListeners = new Map();

/**
 * Clean up a listener by name
 * @param {string} name
 */
function unsubscribeListener(name) {
  const unsub = activeListeners.get(name);
  if (unsub) {
    unsub();
    activeListeners.delete(name);
  }
}

/**
 * Unsubscribe all active listeners
 */
export function unsubscribeAll() {
  activeListeners.forEach((unsub) => unsub());
  activeListeners.clear();
}

// ─── GOALS ──────────────────────────────────────────────

/**
 * @param {string} userId
 * @param {object} goalData - { title: string, description?: string, deadline?: string, color?: string }
 * @returns {Promise<string>} Document ID
 */
export async function createGoal(userId, goalData) {
  const docRef = await addDoc(collection(db, 'goals'), {
    ...goalData,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * @param {string} goalId
 * @param {object} updates
 */
export async function updateGoal(goalId, updates) {
  await updateDoc(doc(db, 'goals', goalId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * @param {string} goalId
 */
export async function deleteGoal(goalId) {
  await deleteDoc(doc(db, 'goals', goalId));
}

function getTimestampMillis(item) {
  if (item?.createdAt?.toMillis) return item.createdAt.toMillis();
  if (item?.createdAt?.seconds) return item.createdAt.seconds * 1000;
  return Date.now();
}

/**
 * Listen for real-time updates to user's goals
 * @param {string} userId
 * @param {(goals: Array) => void} callback
 */
export function listenGoals(userId, callback) {
  unsubscribeListener('goals');
  const q = query(
    collection(db, 'goals'),
    where('userId', '==', userId)
  );
  const unsub = onSnapshot(q, (snapshot) => {
    /** @type {Array<{id: string, [key: string]: any}>} */
    const goals = [];
    snapshot.forEach((docSnap) => {
      goals.push({ id: docSnap.id, ...docSnap.data() });
    });
    goals.sort((a, b) => getTimestampMillis(b) - getTimestampMillis(a));
    callback(goals);
  }, (error) => {
    console.error('[PTracker] Goals listener error:', error);
  });
  activeListeners.set('goals', unsub);
}

// ─── TASKS ──────────────────────────────────────────────

/**
 * @param {string} userId
 * @param {object} taskData - { title, goalId, dueDate?, completed?, notes? }
 * @returns {Promise<string>}
 */
export async function createTask(userId, taskData) {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    userId,
    completed: taskData.completed ?? false,
    notes: taskData.notes ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * @param {string} taskId
 * @param {object} updates
 */
export async function updateTask(taskId, updates) {
  await updateDoc(doc(db, 'tasks', taskId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * @param {string} taskId
 */
export async function deleteTask(taskId) {
  await deleteDoc(doc(db, 'tasks', taskId));
}

/**
 * @param {string} userId
 * @param {(tasks: Array) => void} callback
 */
export function listenTasks(userId, callback) {
  unsubscribeListener('tasks');
  const q = query(
    collection(db, 'tasks'),
    where('userId', '==', userId)
  );
  const unsub = onSnapshot(q, (snapshot) => {
    /** @type {Array<{id: string, [key: string]: any}>} */
    const tasks = [];
    snapshot.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() });
    });
    tasks.sort((a, b) => getTimestampMillis(b) - getTimestampMillis(a));
    callback(tasks);
  }, (error) => {
    console.error('[PTracker] Tasks listener error:', error);
  });
  activeListeners.set('tasks', unsub);
}

// ─── SUBTASKS ───────────────────────────────────────────

/**
 * @param {string} userId
 * @param {object} subtaskData - { title, taskId, completed? }
 * @returns {Promise<string>}
 */
export async function createSubtask(userId, subtaskData) {
  const docRef = await addDoc(collection(db, 'subtasks'), {
    ...subtaskData,
    userId,
    completed: subtaskData.completed ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * @param {string} subtaskId
 * @param {object} updates
 */
export async function updateSubtask(subtaskId, updates) {
  await updateDoc(doc(db, 'subtasks', subtaskId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * @param {string} subtaskId
 */
export async function deleteSubtask(subtaskId) {
  await deleteDoc(doc(db, 'subtasks', subtaskId));
}

/**
 * @param {string} userId
 * @param {(subtasks: Array) => void} callback
 */
export function listenSubtasks(userId, callback) {
  unsubscribeListener('subtasks');
  const q = query(
    collection(db, 'subtasks'),
    where('userId', '==', userId)
  );
  const unsub = onSnapshot(q, (snapshot) => {
    /** @type {Array<{id: string, [key: string]: any}>} */
    const subtasks = [];
    snapshot.forEach((docSnap) => {
      subtasks.push({ id: docSnap.id, ...docSnap.data() });
    });
    subtasks.sort((a, b) => getTimestampMillis(a) - getTimestampMillis(b));
    callback(subtasks);
  }, (error) => {
    console.error('[PTracker] Subtasks listener error:', error);
  });
  activeListeners.set('subtasks', unsub);
}

// ─── USER PREFERENCES (Quotes & Custom Background) ──────

/**
 * @typedef {Object} UserPreferences
 * @property {string} [quote]
 * @property {string} [quoteAuthor]
 * @property {string} [customBgImage]
 * @property {number} [widgetTranslucency]
 */

/**
 * Get cached user preferences from localStorage
 * @param {string} userId
 * @returns {UserPreferences}
 */
export function getUserPreferences(userId) {
  try {
    const raw = localStorage.getItem(`ptracker_prefs_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save user preferences to Firestore and localStorage
 * @param {string} userId
 * @param {UserPreferences} prefs
 */
export async function saveUserPreferences(userId, prefs) {
  try {
    const existing = getUserPreferences(userId);
    const merged = { ...existing, ...prefs };
    localStorage.setItem(`ptracker_prefs_${userId}`, JSON.stringify(merged));

    if (db) {
      await setDoc(doc(db, 'user_preferences', userId), {
        ...merged,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('[PTracker] Error saving user preferences:', error);
  }
}

/**
 * Listen for real-time updates to user preferences
 * @param {string} userId
 * @param {(prefs: UserPreferences) => void} callback
 */
export function listenUserPreferences(userId, callback) {
  unsubscribeListener('preferences');
  if (!db) {
    callback(getUserPreferences(userId));
    return;
  }
  const unsub = onSnapshot(doc(db, 'user_preferences', userId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      /** @type {UserPreferences} */
      const prefs = {
        quote: data.quote || '',
        quoteAuthor: data.quoteAuthor || '',
        customBgImage: data.customBgImage || '',
        widgetTranslucency: typeof data.widgetTranslucency === 'number' ? data.widgetTranslucency : 0,
      };
      localStorage.setItem(`ptracker_prefs_${userId}`, JSON.stringify(prefs));
      callback(prefs);
    } else {
      callback(getUserPreferences(userId));
    }
  }, (error) => {
    console.error('[PTracker] Preferences listener error:', error);
    callback(getUserPreferences(userId));
  });
  activeListeners.set('preferences', unsub);
}

// ─── USER PROFILES & ROLES ──────────────────────────────

/**
 * @param {string} userId
 * @param {object} profileData
 */
export async function saveUserProfile(userId, profileData) {
  if (!db) throw new Error('Firestore is not initialized.');
  await setDoc(doc(db, 'users', userId), {
    ...profileData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * @param {string} userId
 * @param {(profile: object|null) => void} callback
 */
export function listenUserProfile(userId, callback) {
  unsubscribeListener(`user_profile_${userId}`);
  if (!db) {
    callback(null);
    return;
  }
  const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('[PTracker] User profile listener error:', err);
    callback(null);
  });
  activeListeners.set(`user_profile_${userId}`, unsub);
}

// ─── TEAMS ──────────────────────────────────────────────

/**
 * @param {string} leaderUid
 * @param {object} teamData - { name: string, department?: string }
 * @returns {Promise<string>}
 */
export async function createTeam(leaderUid, teamData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const docRef = await addDoc(collection(db, 'teams'), {
    ...teamData,
    leaderUid,
    memberUids: [leaderUid],
    inviteCode,
    status: 'forming',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * @param {string} teamId
 * @param {object} updates
 */
export async function updateTeam(teamId, updates) {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'teams', teamId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * @param {(teams: Array) => void} callback
 */
export function listenAllTeams(callback) {
  unsubscribeListener('all_teams');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Teams listener error:', err);
    callback([]);
  });
  activeListeners.set('all_teams', unsub);
}

// ─── ALLOCATIONS ────────────────────────────────────────

/**
 * @param {string} allocId
 * @param {object} allocData
 */
export async function saveAllocationDoc(allocId, allocData) {
  if (!db) throw new Error('Firestore is not initialized.');
  await setDoc(doc(db, 'allocations', allocId), {
    ...allocData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * @param {(allocations: Array) => void} callback
 */
export function listenAllocations(callback) {
  unsubscribeListener('allocations');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'allocations'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Allocations listener error:', err);
    callback([]);
  });
  activeListeners.set('allocations', unsub);
}

// ─── LOGBOOKS ───────────────────────────────────────────

/**
 * @param {object} logData - { teamId, authorUid, weekNumber, workDone, hoursSpent, blockers }
 * @returns {Promise<string>}
 */
export async function createLogbookEntry(logData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const docRef = await addDoc(collection(db, 'logbooks'), {
    ...logData,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * @param {string} entryId
 * @param {'approved' | 'changes_requested'} status
 * @param {string} remarks
 */
export async function reviewLogbookEntry(entryId, status, remarks) {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'logbooks', entryId), {
    status,
    guideRemarks: remarks,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/**
 * @param {(logbooks: Array) => void} callback
 */
export function listenLogbooks(callback) {
  unsubscribeListener('logbooks');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'logbooks'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Logbooks listener error:', err);
    callback([]);
  });
  activeListeners.set('logbooks', unsub);
}

// ─── DOCUMENTS ──────────────────────────────────────────

/**
 * @param {object} docData - { teamId, type, fileName, storagePath, uploadedBy }
 * @returns {Promise<string>}
 */
export async function createDocumentRecord(docData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const docRef = await addDoc(collection(db, 'documents'), {
    ...docData,
    status: 'pending',
    version: 1,
    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * @param {string} docId
 * @param {'guide_approved' | 'changes_requested' | 'coordinator_approved'} status
 * @param {string} [remarks]
 */
export async function reviewDocumentRecord(docId, status, remarks = '') {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'documents', docId), {
    status,
    remarks,
    updatedAt: serverTimestamp()
  });
}

/**
 * @param {(docs: Array) => void} callback
 */
export function listenDocuments(callback) {
  unsubscribeListener('documents');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'documents'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Documents listener error:', err);
    callback([]);
  });
  activeListeners.set('documents', unsub);
}

// ─── REVIEWS ────────────────────────────────────────────

/**
 * @param {string} reviewId
 * @param {object} reviewData
 */
export async function saveScheduledReviewDoc(reviewId, reviewData) {
  if (!db) throw new Error('Firestore is not initialized.');
  await setDoc(doc(db, 'reviews', reviewId), {
    ...reviewData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * @param {string} reviewId
 * @param {string} panelUid
 * @param {object} scoreData - { criteria, totalScore, comments, verdict }
 */
export async function submitReviewScoreDoc(reviewId, panelUid, scoreData) {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'reviews', reviewId), {
    [`scores.${panelUid}`]: {
      ...scoreData,
      submittedAt: serverTimestamp()
    },
    status: 'completed',
    updatedAt: serverTimestamp()
  });
}

/**
 * @param {(reviews: Array) => void} callback
 */
export function listenReviews(callback) {
  unsubscribeListener('reviews');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'reviews'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Reviews listener error:', err);
    callback([]);
  });
  activeListeners.set('reviews', unsub);
}

// ─── INTERNSHIPS ────────────────────────────────────────

/**
 * @param {object} internData
 * @returns {Promise<string>}
 */
export async function createInternshipDoc(internData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const docRef = await addDoc(collection(db, 'internships'), {
    ...internData,
    status: 'applied',
    creditsEarned: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * @param {string} internshipId
 * @param {object} updates
 */
export async function updateInternshipDoc(internshipId, updates) {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'internships', internshipId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * @param {(internships: Array) => void} callback
 */
export function listenInternships(callback) {
  unsubscribeListener('internships');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'internships'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Internships listener error:', err);
    callback([]);
  });
  activeListeners.set('internships', unsub);
}

// ─── FOCUS & PLANNER (YPT) ──────────────────────────────

/**
 * @param {object} subjectData - { ownerUid, name, colorCode }
 * @returns {Promise<string>}
 */
export async function createFocusSubjectDoc(subjectData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const docRef = await addDoc(collection(db, 'focusSubjects'), {
    ...subjectData,
    archived: false,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * @param {string} userId
 * @param {(subjects: Array) => void} callback
 */
export function listenFocusSubjects(userId, callback) {
  unsubscribeListener(`focus_subjects_${userId}`);
  if (!db) {
    callback([]);
    return;
  }
  const q = query(collection(db, 'focusSubjects'), where('ownerUid', '==', userId));
  const unsub = onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Focus subjects listener error:', err);
    callback([]);
  });
  activeListeners.set(`focus_subjects_${userId}`, unsub);
}

/**
 * @param {object} sessionData - { uid, subjectId, taskId, teamId, startedAtMillis, endedAtMillis, durationMin, mode, note }
 * @returns {Promise<string>}
 */
export async function saveFocusSessionDoc(sessionData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const docRef = await addDoc(collection(db, 'focusSessions'), {
    ...sessionData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * @param {(sessions: Array) => void} callback
 */
export function listenFocusSessions(callback) {
  unsubscribeListener('focus_sessions');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'focusSessions'), (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Focus sessions listener error:', err);
    callback([]);
  });
  activeListeners.set('focus_sessions', unsub);
}

/**
 * @param {string} userId
 * @param {string} date - 'YYYY-MM-DD'
 * @param {object} planData - { todos, reflection, reviewed, moodRating }
 */
export async function saveDailyPlanDoc(userId, date, planData) {
  if (!db) throw new Error('Firestore is not initialized.');
  const planDocId = `${userId}_${date}`;
  await setDoc(doc(db, 'dailyPlans', planDocId), {
    uid: userId,
    date,
    ...planData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * @param {string} userId
 * @param {(plans: Array) => void} callback
 */
export function listenDailyPlans(userId, callback) {
  unsubscribeListener(`daily_plans_${userId}`);
  if (!db) {
    callback([]);
    return;
  }
  const q = query(collection(db, 'dailyPlans'), where('uid', '==', userId));
  const unsub = onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error('[PTracker] Daily plans listener error:', err);
    callback([]);
  });
  activeListeners.set(`daily_plans_${userId}`, unsub);
}

/**
 * Update live presence in a team focus room
 * @param {string} roomId
 * @param {string} userId
 * @param {'focus' | 'break' | 'offline'} status
 * @param {string} [subjectName]
 */
export async function updateFocusRoomPresence(roomId, userId, status, subjectName = '') {
  if (!db) return;
  await setDoc(doc(db, 'focusRooms', roomId), {
    [`members.${userId}`]: {
      status,
      subjectName,
      lastHeartbeat: Date.now()
    }
  }, { merge: true });
}

/**
 * @param {string} roomId
 * @param {(room: object|null) => void} callback
 */
export function listenFocusRoom(roomId, callback) {
  unsubscribeListener(`focus_room_${roomId}`);
  if (!db) {
    callback(null);
    return;
  }
  const unsub = onSnapshot(doc(db, 'focusRooms', roomId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('[PTracker] Focus room listener error:', err);
    callback(null);
  });
  activeListeners.set(`focus_room_${roomId}`, unsub);
}

