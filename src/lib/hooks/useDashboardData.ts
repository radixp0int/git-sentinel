import { useCallback, useEffect, useState } from 'react';
import { fetchFleet, fetchReviewQueue, isConfigured } from '../github';
import { mockPullRequests, mockWorkflows } from '../mock';
import type { PullRequest, Workflow } from '../domain/types';

/** GitHub's REST limit is 5,000/hr; polling this often stays well inside it. */
export const REFRESH_MS = 120_000;

export interface DashboardData {
  workflows: Workflow[];
  pullRequests: PullRequest[];
  /** False when we are showing the sample fleet because no token is configured. */
  live: boolean;
  error: string | null;
  syncedAt: Date;
  refresh: () => void;
}

/**
 * Loads the fleet and the review queue, falling back to sample data when the
 * proxy has no token. Polls on an interval so a dashboard left open on a second
 * monitor stays current without anyone touching it.
 */
export function useDashboardData(repos: string[]): DashboardData {
  const [workflows, setWorkflows] = useState<Workflow[]>(mockWorkflows);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>(mockPullRequests);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState(() => new Date());

  const key = repos.join(',');

  const load = useCallback(async () => {
    const list = key ? key.split(',') : [];
    if (list.length === 0 || !(await isConfigured())) {
      setLive(false);
      setSyncedAt(new Date());
      return;
    }

    try {
      const [fleet, queue] = await Promise.all([fetchFleet(list), fetchReviewQueue()]);
      setWorkflows(fleet);
      setPullRequests(queue);
      setLive(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncedAt(new Date());
    }
  }, [key]);

  useEffect(() => {
    // Synchronising with an external system is what effects are for, and every
    // setState inside load() happens after an await — never during the render
    // pass — so this does not cascade.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { workflows, pullRequests, live, error, syncedAt, refresh: () => void load() };
}
