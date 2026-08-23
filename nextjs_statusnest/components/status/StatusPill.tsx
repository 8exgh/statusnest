import type { PublicMonitorStatus } from '@/types';
import { STATUS_COLORS } from './palette';

interface StatusPillProps {
  status: PublicMonitorStatus;
  /** Override the label (defaults to Online / Unavailable / Not checked yet). */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STYLES: Record<PublicMonitorStatus, { bg: string; border: string; icon: string; color: string; label: string }> = {
  online: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '✓', color: STATUS_COLORS.online, label: 'Online' },
  offline: { bg: 'bg-red-50', border: 'border-red-200', icon: '✕', color: STATUS_COLORS.offline, label: 'Unavailable' },
  unknown: { bg: 'bg-gray-100', border: 'border-gray-200', icon: '○', color: STATUS_COLORS.text, label: 'Not checked yet' },
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-5 py-2.5 text-xl gap-2.5 font-semibold',
};

/** Status badge: icon + label + tinted background, so colour is never the only cue. */
export default function StatusPill({ status, label, size = 'md' }: StatusPillProps) {
  const style = STYLES[status] ?? STYLES.unknown;
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium text-gray-900 ${style.bg} ${style.border} ${SIZES[size]}`}
    >
      <span aria-hidden="true" style={{ color: style.color }} className="font-bold leading-none">
        {style.icon}
      </span>
      <span>{label ?? style.label}</span>
    </span>
  );
}
