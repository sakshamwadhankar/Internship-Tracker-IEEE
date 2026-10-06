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

