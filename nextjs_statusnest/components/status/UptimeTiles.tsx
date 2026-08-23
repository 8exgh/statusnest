import type { UptimeSummary } from '@/lib/public-monitors/queries';
import UptimeTile from './UptimeTile';

export default function UptimeTiles({ uptime }: { uptime: UptimeSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UptimeTile label="Last 24 hours" window={uptime.last24h} />
      <UptimeTile label="Last 7 days" window={uptime.last7d} />
      <UptimeTile label="Last 30 days" window={uptime.last30d} />
      <UptimeTile label="Last 90 days" window={uptime.last90d} />
    </div>
  );
}
