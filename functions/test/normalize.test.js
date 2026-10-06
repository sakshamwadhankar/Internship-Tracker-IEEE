import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  sniffType,
  toMillis,
  cleanTags,
  dedupeKey,
  normalizeJob,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS
} from '../src/normalize.js';
import { stripHtml } from '../src/sources/lib.js';

describe('stripHtml', () => {
  test('removes tags and decodes entities', () => {
    assert.equal(stripHtml('<p>Hello <b>world</b> &amp; friends</p>'), 'Hello world & friends');
    assert.equal(stripHtml('A&nbsp;B'), 'A B');
  });

  test('handles empty input', () => {
    assert.equal(stripHtml(''), '');
    assert.equal(stripHtml(null), '');
  });
});

describe('normalizeUrl', () => {
  test('upgrades http to https', () => {
    assert.equal(normalizeUrl('http://example.com/x'), 'https://example.com/x');
  });

  test('accepts https and trims', () => {
    assert.equal(normalizeUrl('  https://example.com  '), 'https://example.com');
  });

  test('rejects non-http schemes and junk', () => {
    assert.equal(normalizeUrl('javascript:alert(1)'), null);
    assert.equal(normalizeUrl('not a url'), null);
    assert.equal(normalizeUrl(''), null);
    assert.equal(normalizeUrl(null), null);
  });
});

describe('sniffType', () => {
  test('flags internship by title keywords', () => {
    assert.equal(sniffType('Summer Intern - Engineering'), 'internship');
    assert.equal(sniffType('Trainee Software Developer'), 'internship');
    assert.equal(sniffType('CO-OP Position'), 'internship');
  });

  test('defaults to fulltime', () => {
    assert.equal(sniffType('Senior Backend Engineer'), 'fulltime');
    assert.equal(sniffType(''), 'fulltime');
  });
});

describe('toMillis', () => {
  test('parses ISO strings', () => {
    assert.equal(toMillis('2026-10-01T00:00:00Z'), Date.parse('2026-10-01T00:00:00Z'));
  });

  test('treats small numbers as seconds and large as ms', () => {
    assert.equal(toMillis(1791000000), 1791000000 * 1000);
    assert.equal(toMillis(1791000000000), 1791000000000);
  });

  test('returns null for garbage', () => {
    assert.equal(toMillis('not a date'), null);
    assert.equal(toMillis(null), null);
    assert.equal(toMillis(''), null);
  });
});

describe('cleanTags', () => {
  test('lowercases, strips, dedupes and caps', () => {
    const tags = cleanTags(['React', 'REACT', '  Node.js ', '<b>SQL</b>', 'Go', 'Rust', 'C++', 'Java', 'Kotlin', 'Ruby', 'PHP', 'Scala', 'Perl', 'Elixir']);
    assert.ok(tags.length <= MAX_TAGS);
    assert.deepEqual(tags.slice(0, 3), ['react', 'node.js', 'sql']);
  });

  test('non-array input yields empty list', () => {
    assert.deepEqual(cleanTags(null), []);
    assert.deepEqual(cleanTags('react'), []);
  });
});

describe('dedupeKey', () => {
  test('is stable regardless of case/whitespace, sensitive to url', () => {
    const a = dedupeKey({ company: 'Acme Corp', title: 'Frontend Intern', applyUrl: 'https://x.com/1' });
    const b = dedupeKey({ company: 'acme CORP ', title: 'frontend INTERN', applyUrl: 'https://x.com/1' });
    const c = dedupeKey({ company: 'Acme Corp', title: 'Frontend Intern', applyUrl: 'https://x.com/2' });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});

describe('normalizeJob', () => {
  const source = { id: 'test', name: 'Test Source' };

  test('builds a full canonical document', () => {
    const job = normalizeJob({
      title: 'React <b>Intern</b>',
      company: 'Acme',
      location: 'Pune',
      applyUrl: 'http://example.com/apply?utm=1',
      tags: ['React', 'react', 'JS'],
      description: '<p>Build things.</p>',
      postedAt: '2026-10-01T00:00:00Z',
      stipend: '₹10,000/mo',
    }, source);

    assert.ok(job);
    assert.equal(job.title, 'React Intern');
    assert.equal(job.source, 'test');
    assert.equal(job.type, 'internship');
    assert.equal(job.applyUrl, 'https://example.com/apply?utm=1');
    assert.equal(job.description, 'Build things.');
    assert.ok(job.id.length === 32);
    assert.deepEqual(job.tags, ['react', 'js']);
    assert.equal(job.postedAtMs, Date.parse('2026-10-01T00:00:00Z'));
    assert.equal(job.stipend, '₹10,000/mo');
    assert.equal(job.region, 'global');
  });

  test('rejects jobs missing title, company or applyUrl', () => {
    assert.equal(normalizeJob({ company: 'A', applyUrl: 'https://x.com' }, source), null);
    assert.equal(normalizeJob({ title: 'T', applyUrl: 'https://x.com' }, source), null);
    assert.equal(normalizeJob({ title: 'T', company: 'A', applyUrl: 'javascript:alert(1)' }, source), null);
    assert.equal(normalizeJob(null, source), null);
  });

  test('truncates long descriptions and caps tags', () => {
    const job = normalizeJob({
      title: 'T',
      company: 'A',
      applyUrl: 'https://x.com',
      description: `<p>${'word '.repeat(500)}</p>`,
      tags: Array.from({ length: 30 }, (_, i) => `tag${i}`),
    }, source);
    assert.ok(job.description.length <= MAX_DESCRIPTION_LENGTH);
    assert.equal(job.tags.length, MAX_TAGS);
  });

  test('region comes from the job when set, else the source', () => {
    const indiaJob = normalizeJob({ title: 'T', company: 'A', applyUrl: 'https://x.com', region: 'india' }, source);
    assert.equal(indiaJob.region, 'india');
    const indiaSource = { id: 's2', region: 'india' };
    const viaSource = normalizeJob({ title: 'T', company: 'A', applyUrl: 'https://x.com' }, indiaSource);
    assert.equal(viaSource.region, 'india');
  });
});
