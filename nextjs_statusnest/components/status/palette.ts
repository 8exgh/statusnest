/**
 * Reserved status colours for the public status pages. Validated for
 * colour-blind separation (deutan ΔE 8.6) on light and dark surfaces; still
 * never used alone — every mark also carries an icon/label/hatch.
 */
export const STATUS_COLORS = {
  online: '#059669',
  offline: '#dc2626',
  none: '#d1d5db',
  /** Single-series neutral for the response-time line. */
  series: '#2563eb',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  text: '#6b7280',
  textStrong: '#374151',
} as const;
