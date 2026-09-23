import { useState } from 'react';
import { TopRail, type View } from './top-rail';
import { Banner } from '../lib/ui';
import { useDashboardData } from '../lib/hooks/use-dashboard-data';
import { Fleet } from '../screens/fleet';
import { Reviews } from '../screens/reviews';

const REPOS = (import.meta.env.VITE_GITHUB_REPOS ?? '')
  .split(',')
  .map((repo: string) => repo.trim())
  .filter(Boolean);

const ORG = import.meta.env.VITE_GITHUB_ORG ?? 'acme-corp';

export default function App() {
  const [view, setView] = useState<View>('fleet');
  const { workflows, gates, pullRequests, ownPullRequests, live, error, syncedAt } =
    useDashboardData(REPOS);

  const waiting = pullRequests.filter((pr) => pr.state === 'waiting').length;

  return (
    <div className="app">
      <TopRail
        view={view}
        onChange={setView}
        reviewCount={waiting}
        syncedAt={syncedAt}
        org={live ? ORG : `${ORG} (sample)`}
      />

      {(!live || error) && (
        <div style={{ padding: '14px 24px 0' }}>
          {!live && (
            <Banner>
              Showing sample data. Set <code className="mono">GITHUB_TOKEN</code> and{' '}
              <code className="mono">VITE_GITHUB_REPOS</code> in{' '}
              <code className="mono">.env.local</code>, then restart the dev server.
            </Banner>
          )}
          {error && <Banner tone="stale">Could not reach GitHub: {error}</Banner>}
        </div>
      )}

      {view === 'fleet' ? (
        <Fleet workflows={workflows} gates={gates} />
      ) : (
        <Reviews pullRequests={pullRequests} ownPullRequests={ownPullRequests} />
      )}
    </div>
  );
}
