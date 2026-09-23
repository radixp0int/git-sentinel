import { Dot, SegmentedNav, ShieldIcon, type NavItem } from '../lib/ui';
import { relativeTime } from '../lib/domain';

export type View = 'fleet' | 'reviews';

export function TopRail({
  view,
  onChange,
  reviewCount,
  syncedAt,
  org,
}: {
  view: View;
  onChange: (view: View) => void;
  reviewCount: number;
  syncedAt: Date;
  org: string;
}) {
  const items: NavItem<View>[] = [
    { id: 'fleet', label: 'Workflows' },
    { id: 'reviews', label: 'Reviews', count: reviewCount },
  ];

  return (
    <header className="rail">
      <div className="brand">
        <ShieldIcon color="var(--accent)" size={20} />
        <span className="brand-name">GIT SENTINEL</span>
      </div>

      <div className="rail-divider" />

      <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
        {org}
      </span>

      <SegmentedNav items={items} value={view} onChange={onChange} />

      <div className="rail-spacer" />

      <span className="sync">
        <Dot tone="pass" small />
        synced {relativeTime(syncedAt)}
      </span>
    </header>
  );
}
