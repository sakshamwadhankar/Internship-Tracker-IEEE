import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchGitHubProfile,
  fetchLeetCodeProfile,
  fetchHackerRankProfile,
  syncAllCodingProfiles
} from '../src/modules/codingProfiles.js';

test('Coding Profiles - fetchGitHubProfile maps API response correctly', async () => {
  const mockFetch = async (url) => {
    assert.ok(url.includes('api.github.com/users/octocat'));
    return {
      ok: true,
      json: async () => ({
        login: 'octocat',
        name: 'The Octocat',
        public_repos: 8,
        followers: 12000,
        html_url: 'https://github.com/octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231'
      })
    };
  };

  const profile = await fetchGitHubProfile('octocat', mockFetch);
  assert.equal(profile.username, 'octocat');
  assert.equal(profile.publicRepos, 8);
  assert.equal(profile.followers, 12000);
  assert.equal(profile.profileUrl, 'https://github.com/octocat');
});

test('Coding Profiles - fetchGitHubProfile handles 404', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 404
  });

  await assert.rejects(
    async () => fetchGitHubProfile('nonexistent_user_999999', mockFetch),
    /not found/
  );
});

test('Coding Profiles - fetchLeetCodeProfile parses solved counts', async () => {
  const mockFetch = async (url) => {
    assert.ok(url.includes('alfa-leetcode-api.onrender.com/userProfile/coder123'));
    return {
      ok: true,
      json: async () => ({
        totalSolved: 350,
        easySolved: 150,
        mediumSolved: 170,
        hardSolved: 30,
        ranking: 25410
      })
    };
  };

  const profile = await fetchLeetCodeProfile('coder123', mockFetch);
  assert.equal(profile.username, 'coder123');
  assert.equal(profile.totalSolved, 350);
  assert.equal(profile.easySolved, 150);
  assert.equal(profile.mediumSolved, 170);
  assert.equal(profile.hardSolved, 30);
  assert.equal(profile.ranking, 25410);
});

test('Coding Profiles - fetchHackerRankProfile computes badges and stars', async () => {
  const mockFetch = async (url) => {
    assert.ok(url.includes('hackerrank.com/rest/hackers/devpro/badges'));
    return {
      ok: true,
      json: async () => ({
        models: [
          { badge_name: 'Problem Solving', stars: 6 },
          { badge_name: 'Python', stars: 5 },
          { badge_name: 'SQL', stars: 4 }
        ]
      })
    };
  };

  const profile = await fetchHackerRankProfile('devpro', mockFetch);
  assert.equal(profile.username, 'devpro');
  assert.equal(profile.badgesCount, 3);
  assert.equal(profile.totalStars, 15);
  assert.equal(profile.badges[0].name, 'Problem Solving');
  assert.equal(profile.badges[0].stars, 6);
});

test('Coding Profiles - syncAllCodingProfiles aggregates all three platforms', async () => {
  const mockFetch = async (url) => {
    if (url.includes('github.com')) {
      return {
        ok: true,
        json: async () => ({ login: 'gitUser', public_repos: 12, followers: 4 })
      };
    }
    if (url.includes('leetcode')) {
      return {
        ok: true,
        json: async () => ({ totalSolved: 80, easySolved: 50, mediumSolved: 30, hardSolved: 0 })
      };
    }
    if (url.includes('hackerrank')) {
      return {
        ok: true,
        json: async () => ({ models: [{ badge_name: 'C++', stars: 3 }] })
      };
    }
    throw new Error('Unknown URL: ' + url);
  };

  const { profiles, errors } = await syncAllCodingProfiles({
    github: 'gitUser',
    leetcode: 'leetUser',
    hackerrank: 'hrUser'
  }, mockFetch);

  assert.equal(errors.length, 0);
  assert.equal(profiles.githubStats?.publicRepos, 12);
  assert.equal(profiles.leetcodeStats?.totalSolved, 80);
  assert.equal(profiles.hackerrankStats?.totalStars, 3);
});
