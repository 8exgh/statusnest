/**
 * Reserved status colours for the public status pages. Validated for
 * colour-blind separation (deutan ΔE 8.6) on light and dark surfaces; still
 * never used alone — every mark also carries an icon/label/hatch.
 */
export const STATUS_COLORS = {
  online: '#059669',
  offline: '#dc2626',
  /**
   * "Couldn't verify" — the site served a bot challenge, so we learned nothing.
   * Slate rather than amber on purpose: amber reads as a warning about the
   * site, and every amber tested collided with red for colour-blind readers
   * (deutan ΔE as low as 2.8). Slate passes all six checks against both green
   * and red on light and dark surfaces (normal ΔE 24.4, tritan 28.7), and
   * "no information" is what grey means. Always paired with a dot texture.
   */
  blocked: '#64748b',
  none: '#d1d5db',
  /** Single-series neutral for the response-time line. */
  series: '#2563eb',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  text: '#6b7280',
  textStrong: '#374151',
} as const;
