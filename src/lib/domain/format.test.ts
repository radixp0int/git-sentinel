import { describe, expect, it } from 'vitest';
import { duration, joinNames, relativeTime, reviewerName, shortRepo, workflowFile } from './format';
import { DAY, HOUR, NOW, ago } from '../../test/fixtures';

describe('format', () => {
  it('joins names the way a sentence would', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['a'])).toBe('a');
    expect(joinNames(['a', 'b'])).toBe('a and b');
    expect(joinNames(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('prefixes teams with @ and leaves people as they are', () => {
    expect(reviewerName({ kind: 'team', slug: 'platform' })).toBe('@platform');
    expect(reviewerName({ kind: 'user', login: 'alex' })).toBe('alex');
  });

  it('writes relative times at the coarsest honest unit', () => {
    expect(relativeTime(ago(20_000), NOW)).toBe('just now');
    expect(relativeTime(ago(3 * HOUR), NOW)).toBe('3h ago');
    expect(relativeTime(ago(4 * DAY), NOW)).toBe('4d ago');
  });

  it('formats durations and paths', () => {
    expect(duration(null)).toBe('—');
    expect(duration(192_000)).toBe('3m 12s');
    expect(shortRepo('acme/api')).toBe('api');
    expect(workflowFile('.github/workflows/deploy.yml')).toBe('deploy.yml');
  });
});
