import { STATUS_COLORS } from './palette';

type SwatchKind = 'online' | 'offline' | 'blocked' | 'none' | 'series';

function Swatch({ kind, id }: { kind: SwatchKind; id: string }) {
  const hatchId = `${id}-legend-hatch`;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {kind === 'offline' && (
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={STATUS_COLORS.offline} />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />
          </pattern>
        </defs>
      )}
      {kind === 'blocked' && (
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="5" height="5">
            <rect width="5" height="5" fill={STATUS_COLORS.blocked} />
            <circle cx="2.5" cy="2.5" r="1.15" fill="#ffffff" fillOpacity="0.75" />
          </pattern>
        </defs>
      )}
      {kind === 'series' ? (
        <line x1="1" y1="7" x2="13" y2="7" stroke={STATUS_COLORS.series} strokeWidth="2" strokeLinecap="round" />
      ) : (
        <rect
          x="1"
          y="1"
          width="12"
          height="12"
          rx="2"
          fill={
            kind === 'online'
              ? STATUS_COLORS.online
              : kind === 'offline' || kind === 'blocked'
                ? `url(#${hatchId})`
                : STATUS_COLORS.none
          }
        />
      )}
    </svg>
  );
}

export interface LegendItem {
  kind: SwatchKind;
  label: string;
}

export default function ChartLegend({ items, id }: { items: LegendItem[]; id: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch kind={item.kind} id={`${id}-${item.kind}`} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
