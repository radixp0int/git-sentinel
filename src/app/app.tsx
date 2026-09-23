import { useState } from 'react';
import { SetupDialog } from './setup-dialog';
import { TopRail, type View } from './top-rail';
import { Banner } from '../lib/ui';
import { useDashboardData } from '../lib/hooks/use-dashboard-data';
import { useSetupPrompt } from '../lib/hooks/use-setup-prompt';
import { Fleet } from '../screens/fleet';
import { Reviews } from '../screens/reviews';

const REPOS = (import.meta.env.VITE_GITHUB_REPOS ?? '')
  .split(',')
  .map((repo: string) => repo.trim())
  .filter(Boolean);

const ORG = import.meta.env.VITE_GITHUB_ORG ?? 'acme-corp';

export default function App() {
  const [view, setView] = useState<View>('fleet');
  const { workflows, gates, pullRequests, ownPullRequests, live, setup, error, syncedAt } =
    useDashboardData(REPOS);
  const prompt = useSetupPrompt(setup);

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
              <span className="banner-line">
                Showing sample data until the dashboard is connected to GitHub.
                {setup && (
                  <button type="button" className="btn btn-sm" onClick={prompt.reopen}>
                    How to connect
                  </button>
                )}
              </span>
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

      <SetupDialog problem={setup} open={prompt.open} onClose={prompt.dismiss} />
    </div>
  );
}
