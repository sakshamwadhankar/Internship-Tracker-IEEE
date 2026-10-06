import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import adzuna from '../src/sources/adzuna.js';
import internshala from '../src/sources/internshala.js';
import linkedin from '../src/sources/linkedin.js';
import { getSources } from '../src/sources/index.js';
import { normalizeJob } from '../src/normalize.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Minimal Response stub for fetchJson/fetchHtml */
function mockResponse(payload, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => payload,
    text: async () => typeof payload === 'string' ? payload : JSON.stringify(payload),
  };
}

describe('source registry', () => {
  test('exposes 19 runnable sources and excludes disabled ones by default', () => {
    const all = getSources();
    assert.equal(all.length, 19);
    assert.ok(!all.find((s) => s.id === 'linkedin'), 'disabled sources must not run by default');
  });

  test('explicit IDs can include disabled sources for auditing', () => {
    const withLinkedin = getSources(['linkedin', 'adzuna']);
    assert.equal(withLinkedin.length, 2);
    assert.ok(withLinkedin.find((s) => s.id === 'linkedin'));
  });

  test('every adapter has the required shape', () => {
    for (const s of getSources(null).concat(getSources(['linkedin']))) {
      assert.ok(s.id && s.name && typeof s.fetchJobs === 'function', `bad adapter: ${s.id}`);
      assert.ok(['api', 'html'].includes(s.kind));
    }
  });
});

describe('adzuna adapter', () => {
  test('maps API results and marks India region', async () => {
    const fixture = JSON.parse(readFileSync(join(here, 'fixtures/adzuna.json'), 'utf8'));
    const jobs = await adzuna.fetchJobs({
      fetchImpl: async () => mockResponse(fixture),
      env: { ADZUNA_APP_ID: 'test-id', ADZUNA_APP_KEY: 'test-key' },
    });

    // Fixture is served for each of the 3 countries => 3 x 2 results
    assert.equal(jobs.length, 6);

    const mumbai = jobs.find((j) => j.title === 'Web Development Internship');
    assert.ok(mumbai);
    assert.equal(mumbai.company, 'TechCorp Systems');
    assert.equal(mumbai.type, 'internship');
    assert.equal(mumbai.postedAt, '2026-10-01T10:00:00Z');

    // India listing (via the 'in' country call) is tagged india
    assert.ok(jobs.some((j) => j.region === 'india'));
    // Same fixture for GB/US calls yields global regions
    assert.ok(jobs.some((j) => j.region === 'global'));
  });

  test('normalizes into canonical docs with https URLs', async () => {
    const fixture = JSON.parse(readFileSync(join(here, 'fixtures/adzuna.json'), 'utf8'));
    const jobs = await adzuna.fetchJobs({
      fetchImpl: async () => mockResponse(fixture),
      env: { ADZUNA_APP_ID: 'i', ADZUNA_APP_KEY: 'k' },
    });
    const raw = jobs[0];
    const doc = normalizeJob(raw, adzuna);
    assert.ok(doc);
    assert.ok(doc.applyUrl.startsWith('https://'), 'http redirect_url must be upgraded');
    assert.equal(doc.description, 'Build web applications with React and JavaScript.');
  });
});

describe('internshala adapter', () => {
  test('parses listing cards, skips malformed ones, builds absolute URLs', async () => {
    const html = readFileSync(join(here, 'fixtures/internshala.html'), 'utf8');
    const jobs = await internshala.fetchJobs({ fetchImpl: async () => mockResponse(html) });

    assert.equal(jobs.length, 2, 'the broken card must be skipped');

    const first = jobs[0];
    assert.equal(first.title, 'Web Development Intern');
    assert.equal(first.company, 'Acme Softworks');
    assert.equal(first.region, 'india');
    assert.equal(first.type, 'internship');
    assert.equal(first.applyUrl, 'https://internshala.com/internship/detail/web-development-internship-in-pune-x123');
    assert.match(first.stipend, /8,000/);
  });

  test('normalizeJob accepts adapter output end-to-end', async () => {
    const html = readFileSync(join(here, 'fixtures/internshala.html'), 'utf8');
    const jobs = await internshala.fetchJobs({ fetchImpl: async () => mockResponse(html) });
    for (const raw of jobs) {
      const doc = normalizeJob(raw, internshala);
      assert.ok(doc, 'every parsed card should normalize');
      assert.equal(doc.source, 'internshala');
    }
  });
});

describe('disabled adapter behaviour', () => {
  test('linkedin fetchJobs is a no-op while disabled', async () => {
    const jobs = await linkedin.fetchJobs({ fetchImpl: async () => { throw new Error('should not fetch'); } });
    assert.deepEqual(jobs, []);
  });
});
