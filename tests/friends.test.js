import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFriendToList,
  removeFriendFromList,
  searchStudents
} from '../src/modules/friends.js';

test('Friends Module - addFriendToList', () => {
  const initial = [];
  const friend1 = { id: 'u2', name: 'Bob Smith', email: 'bob@university.edu' };

  const updated = addFriendToList('u1', friend1, initial);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'u2');
  assert.equal(updated[0].name, 'Bob Smith');
  assert.ok(updated[0].addedAtMillis > 0);

  // Prevent duplicate additions
  assert.throws(() => {
    addFriendToList('u1', friend1, updated);
  }, /already in your friend list/);

  // Prevent adding self
  assert.throws(() => {
    addFriendToList('u1', { id: 'u1', name: 'Myself' }, updated);
  }, /cannot add yourself/);
});

test('Friends Module - removeFriendFromList', () => {
  const friends = [
    { id: 'u2', name: 'Bob Smith', email: 'bob@university.edu', addedAtMillis: 100 },
    { id: 'u3', name: 'Charlie', email: 'charlie@university.edu', addedAtMillis: 200 }
  ];

  const updated = removeFriendFromList('u1', 'u2', friends);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'u3');
});

test('Friends Module - searchStudents', () => {
  const students = [
    { id: 'u1', name: 'Alice', email: 'alice@edu.in' },
    { id: 'u2', name: 'Bob', email: 'bob@edu.in' },
    { id: 'u3', name: 'Carol', email: 'carol@edu.in' },
    { id: 'u4', name: 'David', email: 'david@edu.in' }
  ];

  const results = searchStudents(students, 'car', ['u2'], 'u1');
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'Carol');

  // Excludes current user and existing friends
  const allAvailable = searchStudents(students, '', ['u2'], 'u1');
  assert.deepEqual(allAvailable.map(s => s.id), ['u3', 'u4']);
});
