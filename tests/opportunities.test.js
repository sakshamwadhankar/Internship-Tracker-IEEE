import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreOpportunity,
  filterOpportunities,
  formatTimeAgo
} from '../src/utils.js';

const profile = {
  degree: 'B.Tech / B.E.',
  branch: 'Computer Science',
  gradYear: String(new Date().getFullYear() + 1),
  skills: ['JavaScript', 'React', 'Python'],
  interests: ['AI/ML'],
  preferredRoles: ['Frontend Developer'],
  preferredLocations: ['Pune', 'Remote'],
};

const freshOpp = {
  id: 'o1',
  title: 'Frontend Developer Intern',
  company: 'Acme',
  location: 'Pune, India',
  region: 'india',
  type: 'internship',
  tags: ['javascript', 'react'],
  description: 'Build UIs with React and JavaScript.',
  applyUrl: 'https://example.com/apply',
  source: 'test',
  postedAtMs: Date.now() - 2 * 86400000, // 2 days ago
};

describe('scoreOpportunity', () => {
  test('returns a score between 0 and 100 with matched skills', () => {
    const { score, matchedSkills } = scoreOpportunity(profile, freshOpp);
    assert.ok(score >= 0 && score <= 100, `score ${score} out of bounds`);
    assert.ok(matchedSkills.includes('JavaScript'));
    assert.ok(matchedSkills.includes('React'));
  });

  test('scores higher for a well-matching opportunity than a poor one', () => {
    const poorOpp = {
      ...freshOpp,
      id: 'o2',
      title: 'Accountant',
      company: 'Widgets Ltd',
      location: 'Lisbon, Portugal',
      region: 'global',
      type: 'fulltime',
      tags: ['tally', 'accounting'],
      description: 'Bookkeeping and payroll.',
      postedAtMs: Date.now() - 40 * 86400000,
    };
    const good = scoreOpportunity(profile, freshOpp).score;
    const bad = scoreOpportunity(profile, poorOpp).score;
    assert.ok(good > bad, `expected good (${good}) > bad (${bad})`);
  });

  test('handles a missing profile without crashing and stays in bounds', () => {
    const { score } = scoreOpportunity(null, freshOpp);
    assert.ok(score >= 0 && score <= 100);
    const empty = scoreOpportunity({}, freshOpp);
    assert.ok(empty.score >= 0 && empty.score <= 100);
    assert.deepEqual(empty.matchedSkills, []);
  });

  test('missing postedAtMs simply yields no recency bonus', () => {
    const noDate = { ...freshOpp, postedAtMs: undefined };
    const withDate = scoreOpportunity(profile, freshOpp).score;
    const without = scoreOpportunity(profile, noDate).score;
    assert.equal(withDate - without, 5);
  });

  test('location preference hit beats neutral-miss split correctly', () => {
    const remoteOpp = { ...freshOpp, location: 'Remote', region: 'global' };
    const hit = scoreOpportunity(profile, remoteOpp).score;
    const missOpp = { ...freshOpp, location: 'Oslo, Norway', region: 'global' };
    const miss = scoreOpportunity(profile, missOpp).score;
    assert.ok(hit > miss);
  });
});

describe('filterOpportunities', () => {
  const opps = [
    { ...freshOpp, id: 'a', title: 'React Intern', region: 'india', type: 'internship', postedAtMs: 100, tags: ['react'] },
    { ...freshOpp, id: 'b', title: 'Backend Engineer', company: 'Beta', region: 'global', type: 'fulltime', postedAtMs: 300, tags: ['go'] },
    { ...freshOpp, id: 'c', title: 'ML Intern at Gamma', company: 'Gamma', region: 'india', type: 'internship', postedAtMs: 200, tags: ['python'] },
  ];

  test('type filter', () => {
    const out = filterOpportunities(opps, { type: 'internship', region: 'all', q: '', savedOnly: false, sort: 'newest' });
    assert.deepEqual(out.map(o => o.id).sort(), ['a', 'c']);
  });

  test('region filter', () => {
    const out = filterOpportunities(opps, { type: 'all', region: 'india', q: '', savedOnly: false, sort: 'newest' });
    assert.deepEqual(out.map(o => o.id).sort(), ['a', 'c']);
  });

  test('query matches title, company and tags', () => {
    const out = filterOpportunities(opps, { type: 'all', region: 'all', q: 'gamma', savedOnly: false, sort: 'newest' });
    assert.deepEqual(out.map(o => o.id), ['c']);
    const byTag = filterOpportunities(opps, { type: 'all', region: 'all', q: 'react', savedOnly: false, sort: 'newest' });
    assert.deepEqual(byTag.map(o => o.id), ['a']);
  });

  test('savedOnly filter', () => {
    const out = filterOpportunities(opps, { type: 'all', region: 'all', q: '', savedOnly: true, sort: 'newest' }, ['b']);
    assert.deepEqual(out.map(o => o.id), ['b']);
  });

  test('newest sorts by postedAtMs descending', () => {
    const out = filterOpportunities(opps, { type: 'all', region: 'all', q: '', savedOnly: false, sort: 'newest' });
    assert.deepEqual(out.map(o => o.id), ['b', 'c', 'a']);
  });

  test('match sort uses profile scores (ties broken by recency)', () => {
    // c is an India internship in Pune but with zero skill overlap,
    // b is a global fulltime role; a overlaps 2 skills + Pune + internship.
    const opps2 = [
      { ...opps[0] },
      { ...opps[1] },
      { ...opps[2], tags: ['sql'], description: 'Spreadsheet work and reporting.' },
    ];
    const out = filterOpportunities(opps2, { type: 'all', region: 'all', q: '', savedOnly: false, sort: 'match' }, [], profile);
    assert.equal(out[0].id, 'a');
    const scores = out.map(o => scoreOpportunity(profile, o).score);
    assert.deepEqual(scores, [...scores].sort((x, y) => y - x), 'scores must be non-increasing');
  });

  test('empty query and null-ish inputs do not crash', () => {
    assert.doesNotThrow(() => filterOpportunities([], { type: 'all', region: 'all', q: '', savedOnly: false, sort: 'newest' }));
    assert.doesNotThrow(() => filterOpportunities(opps, null));
  });
});

describe('formatTimeAgo', () => {
  test('labels recent timestamps', () => {
    assert.equal(formatTimeAgo(Date.now() - 30000), 'just now');
    assert.equal(formatTimeAgo(Date.now() - 5 * 60000), '5m ago');
    assert.equal(formatTimeAgo(Date.now() - 3 * 3600000), '3h ago');
    assert.equal(formatTimeAgo(Date.now() - 4 * 86400000), '4d ago');
    assert.equal(formatTimeAgo(Date.now() - 70 * 86400000), '2mo ago');
  });

  test('handles epoch seconds and empty input', () => {
    assert.equal(formatTimeAgo((Date.now() - 20000) / 1000), 'just now');
    assert.equal(formatTimeAgo(0), '');
    assert.equal(formatTimeAgo(null), '');
    assert.equal(formatTimeAgo(undefined), '');
  });

  test('future timestamps are clamped to just now', () => {
    assert.equal(formatTimeAgo(Date.now() + 3600000), 'just now');
  });
});
