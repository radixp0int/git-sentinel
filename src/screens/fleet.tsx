import { Fragment, useMemo } from 'react';
import {
  Badge,
  Banner,
  Card,
  CardNote,
  Cell,
  Dot,
  Empty,
  List,
  ListHead,
  ListRow,
  LockIcon,
  Section,
  StatTile,
  StatusStrip,
  STATE_TONE,
  TileGrid,
  WarningIcon,
  WorkflowName,
} from '../lib/ui';
import {
  blockedRepos,
  commonFailurePoints,
  countByState,
  distinctRepos,
  duration,
  failurePoint,
  gateNote,
  greenRate,
  isConsistent,
  joinNames,
  needsAttention,
  relativeTime,
  shortRepo,
  stepLabel,
  summarizeGates,
  triageAll,
  triageLabel,
  uncoveredRepos,
  workflowFile,
  type FailurePoint,
  type GateSummary,
  type MergeGate,
  type SharedFailure,
  type Triaged,
  type Workflow,
} from '../lib/domain';

/** Repo / file / status chip — the identity block every workflow row shares. */
function Identity({ item, small = false }: { item: Triaged; small?: boolean }) {
  const label = triageLabel(item.triage);
  const tone = STATE_TONE[item.triage.state];

  return (
    <div className="name-line" style={small ? { marginBottom: 0 } : undefined}>
      <Dot tone={tone} small={small} />
      <WorkflowName
        repo={shortRepo(item.workflow.repo)}
        file={workflowFile(item.workflow.path)}
      />
      {!small && label && <Badge tone={tone}>{label}</Badge>}
      {!small && item.blockingChecks.length > 0 && (
        <Badge tone="fail">
          <LockIcon size={10} />
          BLOCKS MERGES
        </Badge>
      )}
    </div>
  );
}

/** Where a failing workflow breaks, and the sampled runs that say so. */
function FailureDetail({ point }: { point: FailurePoint }) {
  return (
    <>
      <div className="detail-line">
        {point.steps.length > 1 ? (
          <>
            <span className="eyebrow">Failed at</span>
            {point.steps.map((step) => (
              <span key={stepLabel(step)} className="step">
                {step.step}
              </span>
            ))}
            <Badge tone="neutral">VARIES · {point.steps.length} STEPS</Badge>
          </>
        ) : (
          <>
            <span className="eyebrow">Fails at</span>
            <span className="step">{stepLabel(point.latest)}</span>
            <span className="mono">
              step {point.latest.number} of {point.latest.of}
            </span>
            {isConsistent(point) && (
              <Badge tone="fail">
                SAME STEP {point.sameStep} / {point.sampled}
              </Badge>
            )}
          </>
        )}
      </div>
      <details className="runs">
        <summary>
          Last {point.sampled} failing {point.sampled === 1 ? 'run' : 'runs'}
        </summary>
        <div className="runs-table">
          <span className="runs-head">Started</span>
          <span className="runs-head">Commit</span>
          <span className="runs-head">Failed step</span>
          {point.runs.map(({ run, step }) => (
            <Fragment key={run.id}>
              <a href={run.htmlUrl} target="_blank" rel="noreferrer">
                {relativeTime(run.createdAt)}
              </a>
              <span>{run.headSha.slice(0, 7)}</span>
              <span className="truncate">{stepLabel(step)}</span>
            </Fragment>
          ))}
        </div>
      </details>
    </>
  );
}

function RequiredChecks({ checks, branch }: { checks: string[]; branch: string }) {
  return (
    <div className="detail-line">
      <span className="eyebrow">Required on {branch}</span>
      {checks.map((check) => (
        <span key={check} className="inline-status">
          <Dot tone="fail" small />
          <span className="mono">{check}</span>
        </span>
      ))}
    </div>
  );
}

function AttentionRow({ item }: { item: Triaged }) {
  const last = item.workflow.runs[0];
  const point = failurePoint(item.workflow);

  return (
    <ListRow>
      <div className="grow">
        <Identity item={item} />
        <div className="reason truncate">{item.triage.reason}</div>
        {item.blockingChecks.length > 0 && (
          <RequiredChecks checks={item.blockingChecks} branch={item.workflow.defaultBranch} />
        )}
        {point && <FailureDetail point={point} />}
      </div>

      <StatusStrip runs={item.workflow.runs} />

      <div className="align-right" style={{ width: 96 }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {last ? relativeTime(last.createdAt) : '—'}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-ghost)', marginTop: 2 }}>
          {last?.event ?? 'never run'}
        </div>
      </div>

      <a className="btn btn-sm" href={last?.htmlUrl ?? '#'} target="_blank" rel="noreferrer">
        Open
      </a>
    </ListRow>
  );
}

function CompactRow({ item }: { item: Triaged }) {
  const last = item.workflow.runs[0];

  return (
    <ListRow>
      <div className="grow">
        <Identity item={item} small />
      </div>
      <StatusStrip runs={item.workflow.runs} small />
      <Cell width={96} mono>
        {last ? relativeTime(last.createdAt) : '—'}
      </Cell>
      <Cell width={66} mono muted>
        {duration(last?.durationMs ?? null)}
      </Cell>
    </ListRow>
  );
}

function SharedFailureRow({ shared }: { shared: SharedFailure }) {
  const repos = [...new Set(shared.workflows.map((wf) => shortRepo(wf.repo)))];
  const count = shared.workflows.length;

  return (
    <div className="side-row">
      <div className="side-row-main">
        <Dot tone={count > 1 ? 'fail' : 'neutral'} small />
        <span className="mono grow truncate">{shared.step}</span>
        <span className="mono">
          {count} {count === 1 ? 'workflow' : 'workflows'}
        </span>
      </div>
      <div className="side-row-sub mono">{repos.join(' · ')}</div>
    </div>
  );
}

function GateRow({ summary }: { summary: GateSummary }) {
  return (
    <div className="side-row">
      <div className="side-row-main">
        <Dot tone={summary.failing.length > 0 ? 'fail' : 'neutral'} small />
        <span className="mono grow truncate">{shortRepo(summary.gate.repo)}</span>
        <span>{gateNote(summary)}</span>
      </div>
      {summary.gate.readable === 'partial' && (
        // Rulesets need GHE 3.9+; without them some required checks may be missing.
        <div className="side-row-sub">Rulesets unreadable, so this may be incomplete.</div>
      )}
    </div>
  );
}

export function Fleet({ workflows, gates }: { workflows: Workflow[]; gates: MergeGate[] }) {
  const triaged = useMemo(() => triageAll(workflows, gates), [workflows, gates]);
  const counts = useMemo(() => countByState(triaged), [triaged]);
  const gateSummaries = useMemo(() => summarizeGates(gates, workflows), [gates, workflows]);
  const shared = useMemo(() => commonFailurePoints(workflows), [workflows]);
  const blocked = blockedRepos(gateSummaries).map(shortRepo);

  const attention = triaged.filter(needsAttention);
  const rest = triaged.filter((item) => !needsAttention(item));
  const longestSilent = triaged.find((item) => item.triage.state === 'silent');
  const uncovered = uncoveredRepos(workflows);
  const brokenRepos = new Set(attention.map((item) => item.workflow.repo)).size;

  return (
    <div className="page">
      <main className="col-main">
        <div className="page-head">
          <div>
            <h1 className="title">Fleet</h1>
            <p className="subtitle">
              {distinctRepos(workflows)} repositories · {workflows.length} workflows
            </p>
          </div>
        </div>

        <TileGrid>
          <StatTile
            label="Failing now"
            value={counts.failing + counts.silent}
            note={`across ${brokenRepos} repositories`}
            tone="fail"
            emphasis
          />
          <StatTile
            label="Silent"
            value={counts.silent}
            note={
              longestSilent
                ? `unnoticed up to ${longestSilent.triage.days}d`
                : 'nothing failing unseen'
            }
            tone="fail"
            emphasis
            icon={<WarningIcon color="var(--fail)" size={12} />}
          />
          <StatTile
            label="Stale"
            value={counts.stale}
            note="schedule stopped firing"
            tone="stale"
            emphasis
          />
          <StatTile
            label="Flaky"
            value={counts.flaky}
            note="passing, but not reliably"
            tone="flaky"
          />
          <StatTile
            label="Healthy"
            value={counts.healthy}
            note="green across the window"
            tone="pass"
          />
        </TileGrid>

        {blocked.length > 0 && (
          <Banner tone="fail">
            <strong>
              Merges are blocked in {blocked.length}{' '}
              {blocked.length === 1 ? 'repository' : 'repositories'}.
            </strong>{' '}
            A required check on the default branch is red in {joinNames(blocked)}, so no pull
            request there can merge.
          </Banner>
        )}

        <Section
          title="Needs attention"
          hint={
            blocked.length > 0
              ? 'merge blockers first, then by how long it has been wrong'
              : 'ordered by how long it has been wrong'
          }
        >
          <List>
            {attention.length === 0 ? (
              <Empty>Nothing is broken, stale or flaky. Enjoy it.</Empty>
            ) : (
              attention.map((item) => (
                <AttentionRow key={`${item.workflow.repo}:${item.workflow.id}`} item={item} />
              ))
            )}
          </List>
        </Section>

        <Section title="Everything else" hint={`${rest.length} workflows`}>
          <List>
            <ListHead>
              <span className="grow">Repository / workflow</span>
              <span style={{ width: 109, flexShrink: 0 }}>Last 14 runs</span>
              <Cell width={96}>Last run</Cell>
              <Cell width={66}>Duration</Cell>
            </ListHead>
            {rest.map((item) => (
              <CompactRow key={`${item.workflow.repo}:${item.workflow.id}`} item={item} />
            ))}
          </List>
        </Section>
      </main>

      <aside className="col-side">
        {shared.length > 0 && (
          <Card title="Common failure points">
            <CardNote>
              When several workflows fail at the same step, the cause is usually shared: a
              runner, a registry, a secret.
            </CardNote>
            {shared.map((item) => (
              <SharedFailureRow key={item.step} shared={item} />
            ))}
          </Card>
        )}

        {gates.length > 0 && (
          <Card title="Merge gates">
            <CardNote>
              Required checks on each default branch. One red check stops every pull request in
              that repository.
            </CardNote>
            {gateSummaries.map((summary) => (
              <GateRow key={summary.gate.repo} summary={summary} />
            ))}
          </Card>
        )}

        <Card title="Alert coverage">
          <CardNote>
            Failures in a repository with no rule reach nobody. That is how a broken
            workflow survives a month.
          </CardNote>
          {uncovered.length === 0 ? (
            <Banner icon={false}>Every repository is covered by a rule.</Banner>
          ) : (
            <Banner tone="stale">
              <strong>
                {uncovered.length} {uncovered.length === 1 ? 'repository has' : 'repositories have'}{' '}
                no rule
              </strong>
              <br />
              <span className="mono" style={{ color: 'var(--stale-body)' }}>
                {uncovered.map(shortRepo).join(' · ')}
              </span>
            </Banner>
          )}
        </Card>

        <Card title="Fleet reliability">
          <div className="big-number" style={{ marginBottom: 6 }}>
            {greenRate(workflows)}%
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-ghost)' }}>
            Share of sampled runs that finished green.
          </p>
        </Card>
      </aside>
    </div>
  );
}
