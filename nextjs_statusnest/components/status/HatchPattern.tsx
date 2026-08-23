import { STATUS_COLORS } from './palette';

/**
 * Diagonal hatch used on every "unavailable" mark so red is never the only
 * cue. Include once per <svg> with a unique id and fill with url(#id).
 */
export default function HatchPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={STATUS_COLORS.offline} />
        <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />
      </pattern>
    </defs>
  );
}
