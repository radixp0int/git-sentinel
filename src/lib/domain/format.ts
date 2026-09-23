const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function relativeTime(iso: string | Date, now: Date = new Date()): string {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  const delta = now.getTime() - then.getTime();
  if (delta < MIN) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MIN)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  const elapsed = Math.floor(delta / DAY);
  if (elapsed < 30) return `${elapsed}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function duration(ms: number | null): string {
  if (ms == null) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function days(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

/** "owner/repo" -> "repo". The owner is the same for the whole fleet; showing it 38 times is noise. */
export function shortRepo(repo: string): string {
  return repo.includes('/') ? repo.slice(repo.indexOf('/') + 1) : repo;
}

/** ".github/workflows/deploy-prod.yml" -> "deploy-prod.yml" */
export function workflowFile(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
