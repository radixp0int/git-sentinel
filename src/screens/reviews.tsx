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
  ListGroup,
  ListRow,
  Meta,
  ownPullRequestTone,
  PullRequestRef,
  Section,
  StackedCell,
  StatTile,
  TileGrid,
} from '../lib/ui';
import {
  groupOwnPullRequests,
  groupReviews,
  isSoleReviewer,
  joinNames,
  ownPullRequestLabel,
  ownPullRequestSince,
  relativeTime,
  requestRoutes,
  reviewerName,
  shortRepo,
  stateDays,
  waitingDays,
  waitingLabel,
  type OwnPullRequest,
  type PullRequest,
  type Reviewer,
} from '../lib/domain';

/** "via @platform-team", "re-requested directly" */
function Route({ via, again }: { via: Reviewer; again: boolean }) {
  const verb = again ? 're-requested' : 'requested';
  return via.kind === 'team' ? (
    <span>
      {again ? 're-requested via' : 'via'} <span className="mono">{reviewerName(via)}</span>
    </span>
  ) : (
    <span>{verb} directly</span>
  );
}

function WaitingRow({ pr }: { pr: PullRequest }) {
  const days = waitingDays(pr);

  return (
    <ListRow>
      <Avatar login={pr.author} />

      <div className="grow">
        <div className="name-line">
          <span className="truncate row-title">{pr.title}</span>
          <Badge tone={ageTone(days)}>{waitingLabel(days)}</Badge>
        </div>
        <Meta>
          <PullRequestRef repo={shortRepo(pr.repo)} number={pr.number} />
          <span>{pr.author}</span>
          {pr.requestedVia && <Route via={pr.requestedVia} again={pr.reRequested} />}
          <DiffStat additions={pr.additions} deletions={pr.deletions} />
          <span>{pr.changedFiles} files</span>
        </Meta>
      </div>

      {isSoleReviewer(pr) && <Badge tone="fail">SOLE REVIEWER</Badge>}

      <StackedCell
        width={112}
        main={`requested ${relativeTime(pr.reviewRequestedAt ?? pr.createdAt)}`}
        sub={`opened ${relativeTime(pr.createdAt)}`}
      />

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

/** What your pull request is waiting on, in the terms of its state. */
function OwnMeta({ pr }: { pr: OwnPullRequest }) {
  const ref = <PullRequestRef repo={shortRepo(pr.repo)} number={pr.number} />;

  switch (pr.state) {
    case 'checks-failing':
      return (
        <Meta>
          {ref}
          <span>
            {pr.failingCheck ? <span className="mono">{pr.failingCheck}</span> : 'a check'} is red
          </span>
          <span>parked in reviewers' queues until green</span>
        </Meta>
      );
    case 'changes-requested':
      return (
        <Meta>
          {ref}
          <span>{pr.changesRequestedBy} asked for changes</span>
          <span>no push since</span>
        </Meta>
      );
    case 'approved':
      return (
        <Meta>
          {ref}
          {pr.approvedBy.length > 0 && <span>approved by {joinNames(pr.approvedBy)}</span>}
          {pr.checksState === 'success' && <span>checks green</span>}
        </Meta>
      );
    case 'awaiting-review':
      return (
        <Meta>
          {ref}
          {pr.pending.length > 0 && (
            <span>
              {pr.reRequested ? 're-requested' : 'requested'} from{' '}
              {joinNames(pr.pending.map(reviewerName))}
            </span>
          )}
          {pr.reviewers > 0 && (
            <span>
              {pr.reviewed} of {pr.reviewers} reviewed
            </span>
          )}
        </Meta>
      );
  }
}

function OwnRow({ pr }: { pr: OwnPullRequest }) {
  return (
    <ListRow>
      <div className="grow">
        <div className="name-line">
          <span className="truncate row-title">{pr.title}</span>
          <Badge tone={ownPullRequestTone(pr.state, stateDays(pr))}>
            {ownPullRequestLabel(pr)}
          </Badge>
        </div>
        <OwnMeta pr={pr} />
      </div>

      <StackedCell
        width={112}
        main={ownPullRequestSince(pr)}
        sub={`opened ${relativeTime(pr.createdAt)}`}
      />

      <a className="btn btn-sm" href={pr.htmlUrl} target="_blank" rel="noreferrer">
        Open
      </a>
    </ListRow>
  );
}

function routeLabel(via: Reviewer | null): string {
  if (!via) return 'Route not recorded';
  return via.kind === 'team' ? reviewerName(via) : 'Asked for you by name';
}

export function Reviews({
  pullRequests,
  ownPullRequests,
}: {
  pullRequests: PullRequest[];
  ownPullRequests: OwnPullRequest[];
}) {
  const groups = useMemo(() => groupReviews(pullRequests), [pullRequests]);
  const own = useMemo(() => groupOwnPullRequests(ownPullRequests), [ownPullRequests]);
  const routes = useMemo(() => requestRoutes(groups.waiting), [groups.waiting]);
  const oldest = groups.waiting[0];
  const ownNote =
    ownPullRequests.length > 0
      ? ` · ${own.yourMove.length} of your ${ownPullRequests.length} open PRs need you next`
      : null;

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
              {ownNote}
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

        <Section
          title="Your open pull requests"
          hint="your move first · then longest wait · drafts hidden"
        >
          <List>
            {ownPullRequests.length === 0 ? (
              <Empty>You have no open pull requests. Nothing of yours is waiting on anyone.</Empty>
            ) : (
              <>
                {own.yourMove.length > 0 && (
                  <ListGroup label="Your move" count={own.yourMove.length} />
                )}
                {own.yourMove.map((pr) => (
                  <OwnRow key={`${pr.repo}#${pr.number}`} pr={pr} />
                ))}
                {own.waiting.length > 0 && (
                  <ListGroup label="Waiting on reviewers" count={own.waiting.length} />
                )}
                {own.waiting.map((pr) => (
                  <OwnRow key={`${pr.repo}#${pr.number}`} pr={pr} />
                ))}
              </>
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
        {routes.length > 0 && (
          <Card title="Where requests come from">
            <CardNote>
              Waiting counts from the request that reached you, directly or through a team you are
              on — not from when the pull request was opened.
            </CardNote>
            {routes.map((route) => (
              <div key={routeLabel(route.via)} className="side-row side-row-main">
                <span className="grow truncate mono">{routeLabel(route.via)}</span>
                <span className="mono">{route.count}</span>
              </div>
            ))}
          </Card>
        )}

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
