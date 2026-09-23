export interface NavItem<T extends string> {
  id: T;
  label: string;
  /** Rendered as a pill next to the label. Zero and undefined both hide it. */
  count?: number;
}

export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  label = 'Sections',
}: {
  items: readonly NavItem<T>[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  return (
    <nav className="nav" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={item.id === value ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count ? <span className="nav-count">{item.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}
