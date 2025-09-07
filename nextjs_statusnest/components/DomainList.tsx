'use client';

import { useState } from 'react';
import { DomainMonitor } from '@/types';

interface DomainListProps {
  domains: DomainMonitor[];
  onToggle?: (domainId: string, active: boolean) => void;
}

export default function DomainList({ domains, onToggle }: DomainListProps) {
  const [toggling, setToggling] = useState<string | null>(null);
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

  const handleToggle = async (domainId: string, currentActive: boolean) => {
    if (!onToggle) return;
    
    setToggling(domainId);
    try {
      await onToggle(domainId, !currentActive);
    } finally {
      setToggling(null);
    }
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
          className={`bg-white rounded-lg shadow p-6 border ${
            domain.active ? 'border-gray-200' : 'border-gray-300 opacity-60'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {domain.domain}
                </h3>
                <button
                  onClick={() => handleToggle(domain.id, domain.active)}
                  disabled={toggling === domain.id}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    domain.active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${toggling === domain.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {toggling === domain.id
                    ? '...'
                    : domain.active
                    ? 'Active'
                    : 'Inactive'}
                </button>
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {domain.active ? (
                  <>
                    <p>Last checked: {formatDate(domain.lastCheckedAt)}</p>
                    <p>Next check: {formatDate(domain.nextCheckAt)}</p>
                    {domain.responseCode && (
                      <p>Response code: {domain.responseCode}</p>
                    )}
                    {domain.responseTimeMs && (
                      <p>Response time: {domain.responseTimeMs}ms</p>
                    )}
                  </>
                ) : (
                  <p className="italic">Monitoring paused</p>
                )}
              </div>
            </div>
            <div className="ml-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  domain.active
                    ? getStatusColor(domain.status)
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {domain.active ? domain.status.toUpperCase() : 'PAUSED'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}