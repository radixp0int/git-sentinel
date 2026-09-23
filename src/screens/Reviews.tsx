import { useMemo } from 'react';
import {
  ageTone,
  Avatar,
  Badge,
  Banner,
  Card,
  CardNote,
  Cell,
  DiffStat,
  Dot,
  Empty,
  List,
  ListRow,
  Meta,
  PullRequestRef,
  Section,
  StatTile,
  TileGrid,
} from '../lib/ui';
import {
  groupReviews,
  isSoleReviewer,
  relativeTime,
  shortRepo,
  waitingDays,
  type PullRequest,
} from '../lib/domain';

function WaitingRow({ pr }: { pr: PullRequest }) {
  const days = waitingDays(pr);

  return (
    <ListRow>
      <Avatar login={pr.author} />

      <div className="grow">
        <div className="name-line">
          <span
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}
          >
            {pr.title}
          </span>
          <Badge tone={ageTone(days)}>{days}d waiting</Badge>
        </div>
        <Meta>
          <PullRequestRef repo={shortRepo(pr.repo)} number={pr.number} />
          <span>{pr.author}</span>
          <DiffStat additions={pr.additions} deletions={pr.deletions} />
          <span>{pr.changedFiles} files</span>
        </Meta>
      </div>

      {isSoleReviewer(pr) && <Badge tone="fail">SOLE REVIEWER</Badge>}

      <Cell width={92} muted>
        updated {relativeTime(pr.updatedAt)}
      </Cell>

      <a className="btn btn-primary" href={pr.htmlUrl} target="_blank" rel="noreferrer">
        Review
      </a>
    </ListRow>
  );
}

function CompactRow({ pr, note }: { pr: PullRequest; note: string }) {
  return (
    <ListRow>
      <div className="grow">
        <div className="truncate" style={{ fontSize: 12.5, marginBottom: 3 }}>
          {pr.title}
        </div>
        <Meta>
          <PullRequestRef repo={shortRepo(pr.repo)} number={pr.number} />
          <span>{note}</span>
        </Meta>
      </div>
      <Cell width={40} mono>
        {waitingDays(pr)}d
      </Cell>
    </ListRow>
  );
}

export function Reviews({ pullRequests }: { pullRequests: PullRequest[] }) {
  const groups = useMemo(() => groupReviews(pullRequests), [pullRequests]);
  const oldest = groups.waiting[0];

  return (
    <div className="page">
      <main className="col-main">
        <div className="page-head">
          <div>
            <h1 className="title">Reviews</h1>
            <p className="subtitle">
              {groups.waiting.length} pull requests are blocked on you
              {oldest && (
                <>
                  {' '}
                  · oldest has waited{' '}
                  <span className="mono" style={{ color: 'var(--fail-text)' }}>
                    {waitingDays(oldest)} days
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <TileGrid>
          <StatTile
            label="Waiting on you"
            value={groups.waiting.length}
            note={oldest ? `oldest ${waitingDays(oldest)}d` : 'queue is clear'}
            tone="fail"
            emphasis
          />
          <StatTile
            label="Parked"
            value={groups.parked.length}
            note="checks red, not ready"
            tone="neutral"
          />
          <StatTile
            label="You blocked"
            value={groups.blocked.length}
            note="no push since your review"
            tone="stale"
            emphasis
          />
          <StatTile
            label="Approved, unmerged"
            value={groups.approved.length}
            note="rotting after sign-off"
            tone="pass"
          />
        </TileGrid>

        <Section title="Waiting on you" hint="oldest first · checks already green">
          <List>
            {groups.waiting.length === 0 ? (
              <Empty>Nothing is waiting on your review.</Empty>
            ) : (
              groups.waiting.map((pr) => <WaitingRow key={pr.htmlUrl + pr.number} pr={pr} />)
            )}
          </List>
        </Section>

        <div className="two-up">
          <Section title="You asked for changes">
            <List>
              {groups.blocked.length === 0 ? (
                <Empty>Nothing is blocked on an author.</Empty>
              ) : (
                groups.blocked.map((pr) => (
                  <CompactRow key={pr.number} pr={pr} note={`updated ${relativeTime(pr.updatedAt)}`} />
                ))
              )}
            </List>
          </Section>

          <Section title="Approved but not merged">
            <List>
              {groups.approved.length === 0 ? (
                <Empty>Everything you approved has merged.</Empty>
              ) : (
                groups.approved.map((pr) => (
                  <CompactRow key={pr.number} pr={pr} note="signed off, still open" />
                ))
              )}
            </List>
          </Section>
        </div>
      </main>

      <aside className="col-side">
        <Card title="Parked, not ready">
          <CardNote>
            Requested from you, but the checks are red. Reviewing now means reviewing twice.
          </CardNote>
          {groups.parked.length === 0 ? (
            <Banner icon={false}>Nothing parked.</Banner>
          ) : (
            groups.parked.map((pr) => (
              <div
                key={pr.number}
                style={{ padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <Dot tone="fail" small />
                  <span className="truncate" style={{ fontSize: 12 }}>
                    {pr.title}
                  </span>
                </div>
                <div
                  className="mono"
                  style={{ paddingLeft: 14, fontSize: 11, color: 'var(--fail-body)' }}
                >
                  {shortRepo(pr.repo)} #{pr.number} · checks failing
                </div>
              </div>
            ))
          )}
        </Card>
      </aside>
    </div>
  );
}
