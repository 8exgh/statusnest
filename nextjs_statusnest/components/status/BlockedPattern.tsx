import { STATUS_COLORS } from './palette';

/**
 * Dotted fill for "couldn't verify" marks, so the state is distinguishable
 * from the solid green (online), the 45° hatch (unavailable) and the flat pale
 * grey (no check) without relying on colour. Include once per <svg> with a
 * unique id and fill with url(#id).
 */
export default function BlockedPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5">
        <rect width="5" height="5" fill={STATUS_COLORS.blocked} />
        <circle cx="2.5" cy="2.5" r="1.15" fill="#ffffff" fillOpacity="0.75" />
      </pattern>
    </defs>
  );
}
