interface IconProps {
  color?: string;
  size?: number;
}

/** Shared stroke geometry so every icon reads as one set. */
function Svg({
  color = 'currentColor',
  size = 14,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 3.9 1.9 18.4A1.8 1.8 0 0 0 3.5 21h17a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17.2h.01" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5 3.8 6v6.2c0 4.7 3.4 8.2 8.2 9.3 4.8-1.1 8.2-4.6 8.2-9.3V6Z" />
      <path d="M8.6 12.2l2.3 2.4 4.5-4.9" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 8-2.5 8h17S18 15 18 8.5Z" />
      <path d="M13.7 20.5a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}

export function PullRequestIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 4.5v9" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="7.5" cy="4.5" r="2.5" />
      <path d="M16.5 19.5v-9a4 4 0 0 0-4-4h-2" />
      <circle cx="16.5" cy="19.5" r="2.5" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}
