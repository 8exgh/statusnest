'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DomainList from '@/components/DomainList';
import AddDomainForm from '@/components/AddDomainForm';
import { DomainMonitor } from '@/types';

export default function Dashboard() {
  const router = useRouter();
  const [domains, setDomains] = useState<DomainMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null until loaded; true when the user has no phone number for offline alerts
  const [phoneMissing, setPhoneMissing] = useState<boolean | null>(null);

  const fetchContact = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/contact', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      setPhoneMissing(!data.contact?.phoneNumber);
    } catch (err) {
      console.error('Contact fetch error:', err);
    }
  };

  const fetchDomains = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/domains/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch domains');
      }

      const data = await response.json();
      setDomains(data.domains);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
    fetchContact();
    
    const interval = setInterval(fetchDomains, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleToggleDomain = async (domainId: string, active: boolean) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/domains/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ domainId, active })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle domain');
      }

      // Refresh domains list
      await fetchDomains();
    } catch (err) {
      console.error('Toggle error:', err);
      setError('Failed to toggle domain status');
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/auth/logout', { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      localStorage.removeItem('token');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Domain Status Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {phoneMissing && (
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-yellow-800">
              <strong>Add your phone number</strong> so StatusNest can call and text you the moment a site goes offline.
              Until then offline alerts go out by email only.
            </p>
            <Link
              href="/profile"
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
            >
              Set up alerts
            </Link>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Monitored Domains</h2>
          <DomainList domains={domains} onToggle={handleToggleDomain} />
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Add New Domain</h3>
            <AddDomainForm onDomainAdded={fetchDomains} />
          </div>
        </div>
      </div>
    </div>
  );
}