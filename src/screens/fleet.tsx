import { useMemo } from 'react';
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
  Section,
  StatTile,
  StatusStrip,
  STATE_TONE,
  TileGrid,
  WarningIcon,
  WorkflowName,
} from '../lib/ui';
import {
  countByState,
  distinctRepos,
  duration,
  greenRate,
  needsAttention,
  relativeTime,
  shortRepo,
  triageAll,
  triageLabel,
  uncoveredRepos,
  workflowFile,
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
    </div>
  );
}

function AttentionRow({ item }: { item: Triaged }) {
  const last = item.workflow.runs[0];

  return (
    <ListRow>
      <div className="grow">
        <Identity item={item} />
        <div className="reason truncate">{item.triage.reason}</div>
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

export function Fleet({ workflows }: { workflows: Workflow[] }) {
  const triaged = useMemo(() => triageAll(workflows), [workflows]);
  const counts = useMemo(() => countByState(triaged), [triaged]);

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

        <Section title="Needs attention" hint="ordered by how long it has been wrong">
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
