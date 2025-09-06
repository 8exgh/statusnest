'use client';

import { DomainMonitor } from '@/types';

interface DomainListProps {
  domains: DomainMonitor[];
}

export default function DomainList({ domains }: DomainListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  if (domains.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No domains registered yet. Add your first domain below.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {domains.map((domain) => (
        <div
          key={domain.id}
          className="bg-white rounded-lg shadow p-6 border border-gray-200"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {domain.domain}
              </h3>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>Last checked: {formatDate(domain.lastCheckedAt)}</p>
                <p>Next check: {formatDate(domain.nextCheckAt)}</p>
                {domain.responseCode && (
                  <p>Response code: {domain.responseCode}</p>
                )}
                {domain.responseTimeMs && (
                  <p>Response time: {domain.responseTimeMs}ms</p>
                )}
              </div>
            </div>
            <div className="ml-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  domain.status
                )}`}
              >
                {domain.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}