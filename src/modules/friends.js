/**
 * @fileoverview Friends & Study Buddies Module
 * Allows students to add peers to their friend list, view mutual live presence,
 * and track team/friend progress.
 */

/**
 * @typedef {Object} StudentFriend
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} [avatarUrl]
 * @property {string} [teamId]
 * @property {string} [teamName]
 * @property {number} addedAtMillis
 * @property {Object} [codingProfiles]
 */

const FRIENDS_KEY_PREFIX = 'ptracker_friends_';

/**
 * Get all friends for a user from local storage
 * @param {string} userId
 * @returns {StudentFriend[]}
 */
export function getLocalFriends(userId) {
  if (!userId || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${FRIENDS_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[Friends] Failed reading from localStorage:', err);
  }
  return [];
}

/**
 * Persist friends list to local storage
 * @param {string} userId
 * @param {StudentFriend[]} friends
 */
export function saveLocalFriends(userId, friends) {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${FRIENDS_KEY_PREFIX}${userId}`, JSON.stringify(friends));
  } catch (err) {
    console.warn('[Friends] Failed saving to localStorage:', err);
  }
}

/**
 * Add a friend to a user's friend list
 * @param {string} userId
 * @param {Omit<StudentFriend, 'addedAtMillis'>} friendData
 * @param {StudentFriend[]} [currentFriends]
 * @returns {StudentFriend[]} Updated list of friends
 */
export function addFriendToList(userId, friendData, currentFriends) {
  if (!friendData || !friendData.id) {
    throw new Error('Valid student friend data is required');
  }
  if (friendData.id === userId) {
    throw new Error('You cannot add yourself as a friend');
  }

  const list = currentFriends ? [...currentFriends] : getLocalFriends(userId);
  const exists = list.some(f => f.id === friendData.id || (friendData.email && f.email === friendData.email));
  if (exists) {
    throw new Error(`${friendData.name || 'Student'} is already in your friend list`);
  }

  /** @type {StudentFriend} */
  const newFriend = {
    id: friendData.id,
    name: friendData.name || 'Fellow Student',
    email: friendData.email || '',
    avatarUrl: friendData.avatarUrl || '',
    teamId: friendData.teamId || null,
    teamName: friendData.teamName || null,
    addedAtMillis: Date.now(),
    codingProfiles: friendData.codingProfiles || {}
  };

  const updated = [newFriend, ...list];
  saveLocalFriends(userId, updated);
  return updated;
}

/**
 * Remove a friend from a user's friend list
 * @param {string} userId
 * @param {string} friendId
 * @param {StudentFriend[]} [currentFriends]
 * @returns {StudentFriend[]} Updated list of friends
 */
export function removeFriendFromList(userId, friendId, currentFriends) {
  if (!friendId) return currentFriends || getLocalFriends(userId);

  const list = currentFriends ? [...currentFriends] : getLocalFriends(userId);
  const updated = list.filter(f => f.id !== friendId);
  saveLocalFriends(userId, updated);
  return updated;
}

/**
 * Filter students from a directory to discover new friends
 * @param {Array<{id: string, name: string, email?: string}>} allStudents
 * @param {string} query
 * @param {string[]} existingFriendIds
 * @param {string} currentUserId
 * @returns {Array<{id: string, name: string, email?: string}>}
 */
export function searchStudents(allStudents, query, existingFriendIds = [], currentUserId = '') {
  if (!Array.isArray(allStudents)) return [];
  const q = String(query || '').trim().toLowerCase();
  const friendSet = new Set(existingFriendIds);

  return allStudents.filter(s => {
    if (!s || !s.id) return false;
    if (s.id === currentUserId) return false;
    if (friendSet.has(s.id)) return false;
    if (!q) return true;

    const nameMatch = (s.name || '').toLowerCase().includes(q);
    const emailMatch = (s.email || '').toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });
}
