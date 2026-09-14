interface IconProps {
  size?: number;
}

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function CansIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...common} aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="4" />
      <path d="M5 8h14M9 12.5h6" />
    </svg>
  );
}

export function ScanIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...common} aria-hidden="true">
      <path d="M3.5 8.5V6a2.5 2.5 0 0 1 2.5-2.5h2.5M15.5 3.5H18A2.5 2.5 0 0 1 20.5 6v2.5M20.5 15.5V18a2.5 2.5 0 0 1-2.5 2.5h-2.5M8.5 20.5H6A2.5 2.5 0 0 1 3.5 18v-2.5" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

export function PillIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...common} aria-hidden="true">
      <rect x="3.2" y="8.5" width="17.6" height="7" rx="3.5" transform="rotate(-40 12 12)" />
      <path d="M9.6 9.1l5.1 6.1" />
    </svg>
  );
}

export function PawIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...common} aria-hidden="true">
      <ellipse cx="7" cy="9" rx="2" ry="2.6" />
      <ellipse cx="12" cy="7" rx="2" ry="2.7" />
      <ellipse cx="17" cy="9" rx="2" ry="2.6" />
      <path d="M12 12.2c2.6 0 4.8 2 4.8 4.3 0 1.8-1.4 2.9-3 2.9-.8 0-1.3-.3-1.8-.3s-1 .3-1.8.3c-1.6 0-3-1.1-3-2.9 0-2.3 2.2-4.3 4.8-4.3z" />
    </svg>
  );
}

export function GearIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...common} aria-hidden="true">
      <path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9" />
      <circle cx="15" cy="7.5" r="2.2" />
      <circle cx="9" cy="16.5" r="2.2" />
    </svg>
  );
}
