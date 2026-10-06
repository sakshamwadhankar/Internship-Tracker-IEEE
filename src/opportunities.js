/**
 * Opportunities store — user career profiles, aggregated job/internship
 * listings (written only by the Cloud Functions scraper), and bookmarks.
 */

import { db, app, isConfigured, serverTimestamp } from './firebase.js';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

/** @type {Map<string, Function>} Active Firestore unsubscribe handlers */
const activeListeners = new Map();

function unsubscribeListener(name) {
  const unsub = activeListeners.get(name);
  if (unsub) {
    unsub();
    activeListeners.delete(name);
  }
}

/**
 * Unsubscribe all opportunity-related listeners (call on sign-out)
 */
export function unsubscribeOpportunityListeners() {
  activeListeners.forEach((unsub) => unsub());
  activeListeners.clear();
}

// ─── USER CAREER PROFILE ────────────────────────────────

/**
 * @typedef {Object} UserProfile
 * @property {string} [degree]
 * @property {string} [branch]
 * @property {string} [gradYear]
 * @property {string[]} [skills]
 * @property {string[]} [interests]
 * @property {string[]} [preferredRoles]
 * @property {string[]} [preferredLocations]
 */

/**
 * Get cached user profile from localStorage
 * @param {string} userId
 * @returns {UserProfile}
 */
export function getUserProfile(userId) {
  try {
    const raw = localStorage.getItem(`ptracker_profile_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save user profile to Firestore and localStorage
 * @param {string} userId
 * @param {UserProfile} profile
 */
export async function saveUserProfile(userId, profile) {
  try {
    const existing = getUserProfile(userId);
    const merged = { ...existing, ...profile };
    localStorage.setItem(`ptracker_profile_${userId}`, JSON.stringify(merged));

    if (db) {
      await setDoc(doc(db, 'user_profiles', userId), {
        ...merged,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('[PTracker] Error saving user profile:', error);
    throw error;
  }
}

/**
 * Listen for real-time updates to the user's career profile
 * @param {string} userId
 * @param {(profile: UserProfile) => void} callback
 */
export function listenUserProfile(userId, callback) {
  unsubscribeListener('profile');
  if (!db) {
    callback(getUserProfile(userId));
    return;
  }
  const unsub = onSnapshot(doc(db, 'user_profiles', userId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      /** @type {UserProfile} */
      const profile = {
        degree: data.degree || '',
        branch: data.branch || '',
        gradYear: data.gradYear || '',
        skills: Array.isArray(data.skills) ? data.skills : [],
        interests: Array.isArray(data.interests) ? data.interests : [],
        preferredRoles: Array.isArray(data.preferredRoles) ? data.preferredRoles : [],
        preferredLocations: Array.isArray(data.preferredLocations) ? data.preferredLocations : [],
      };
      localStorage.setItem(`ptracker_profile_${userId}`, JSON.stringify(profile));
      callback(profile);
    } else {
      callback(getUserProfile(userId));
    }
  }, (error) => {
    console.error('[PTracker] Profile listener error:', error);
    callback(getUserProfile(userId));
  });
  activeListeners.set('profile', unsub);
}

// ─── OPPORTUNITY LISTINGS ───────────────────────────────

/**
 * Listen to the most recent aggregated opportunities.
 * Documents are written exclusively by the scraper Cloud Functions.
 * @param {(opportunities: Array<{id: string, [key: string]: any}>) => void} callback
 */
export function listenOpportunities(callback) {
  unsubscribeListener('opportunities');
  if (!db) {
    callback([]);
    return;
  }
  const q = query(
    collection(db, 'opportunities'),
    orderBy('fetchedAt', 'desc'),
    // Free-tier Firestore quota counts every document read; 120 keeps the
    // listing feed healthy without burning the daily 50k-read allowance.
    limit(120)
  );
  const unsub = onSnapshot(q, (snapshot) => {
    /** @type {Array<{id: string, [key: string]: any}>} */
    const opps = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      opps.push({
        id: docSnap.id,
        ...data,
        fetchedAtMs: data.fetchedAt?.toMillis?.() || 0,
      });
    });
    callback(opps);
  }, (error) => {
    console.error('[PTracker] Opportunities listener error:', error);
    callback([]);
  });
  activeListeners.set('opportunities', unsub);
}

/**
 * Listen to the user's saved/bookmarked opportunities
 * @param {string} userId
 * @param {(savedIds: string[]) => void} callback
 */
export function listenSavedOpportunities(userId, callback) {
  unsubscribeListener('savedOpps');
  if (!db) {
    callback([]);
    return;
  }
  const unsub = onSnapshot(collection(db, 'user_profiles', userId, 'saved'), (snapshot) => {
    /** @type {string[]} */
    const ids = [];
    snapshot.forEach((docSnap) => ids.push(docSnap.id));
    callback(ids);
  }, (error) => {
    console.error('[PTracker] Saved opportunities listener error:', error);
    callback([]);
  });
  activeListeners.set('savedOpps', unsub);
}

/**
 * Bookmark or un-bookmark an opportunity
 * @param {string} userId
 * @param {{id: string, title: string, company: string, applyUrl: string, source: string}} opp
 * @param {boolean} saved
 */
export async function toggleSavedOpportunity(userId, opp, saved) {
  if (!db) return;
  const ref = doc(db, 'user_profiles', userId, 'saved', opp.id);
  if (saved) {
    await setDoc(ref, {
      title: opp.title || '',
      company: opp.company || '',
      applyUrl: opp.applyUrl || '',
      source: opp.source || '',
      savedAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(ref);
  }
}

// ─── SYNC META (scraper health) ─────────────────────────

/**
 * Listen to per-source sync metadata ("last synced" indicator)
 * @param {(meta: Record<string, any>) => void} callback
 */
export function listenSyncMeta(callback) {
  unsubscribeListener('syncMeta');
  if (!db) {
    callback({});
    return;
  }
  const unsub = onSnapshot(collection(db, 'sync_meta'), (snapshot) => {
    /** @type {Record<string, any>} */
    const meta = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      meta[docSnap.id] = {
        ...data,
        lastRunAtMs: data.lastRunAt?.toMillis?.() || 0,
      };
    });
    callback(meta);
  }, (error) => {
    console.error('[PTracker] Sync meta listener error:', error);
    callback({});
  });
  activeListeners.set('syncMeta', unsub);
}

// ─── MANUAL SYNC TRIGGER ────────────────────────────────

/**
 * Invoke the `syncNow` Cloud Function (must be deployed)
 * @returns {Promise<any>} sync results
 */
export async function requestSync() {
  if (!isConfigured || !app) {
    throw new Error('Firebase is not configured');
  }
  const functions = getFunctions(app);
  const syncNow = httpsCallable(functions, 'syncNow');
  const result = await syncNow({});
  return result.data;
}
