'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Contact {
  email: string;
  phoneNumber: string | null;
  notificationEmail: string | null;
}

interface Alerting {
  configured: boolean;
  severity: string;
  channels: string[];
  fallbackChannel: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [alerting, setAlerting] = useState<Alerting | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const fetchContact = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const response = await fetch('/api/contact', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load your profile');
      }
      const data = await response.json();
      setContact(data.contact);
      setAlerting(data.alerting ?? null);
      setPhoneNumber(data.contact.phoneNumber ?? '');
      setNotificationEmail(data.contact.notificationEmail ?? '');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/contact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ phoneNumber, notificationEmail })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }
      setContact(data.contact);
      setPhoneNumber(data.contact.phoneNumber ?? '');
      setNotificationEmail(data.contact.notificationEmail ?? '');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
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

  const phoneMissing = !contact?.phoneNumber;
  const alertEmail = contact?.notificationEmail || contact?.email;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
            <nav className="mt-2 flex gap-4 text-sm">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-500">
                ← Back to dashboard
              </Link>
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">When a website goes offline</h2>
          <p className="text-sm text-gray-600">
            As soon as one of your domains stops responding, StatusNest raises a highest-priority alert
            through AlertTray: you get a <strong>phone call</strong> and an <strong>SMS</strong> at the
            number below. Without a phone number the alert is sent by <strong>email</strong> instead.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Calls and texts come from AlertTray&apos;s number, +1 587-809-5774 — save it as a contact so
            alerts can get through Do Not Disturb.
          </p>
          {alerting && !alerting.configured && (
            <div className="mt-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
              Offline alerts are not configured on this server yet (no AlertTray API key). Your details
              are saved and will be used as soon as it is.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact details</h2>

          {phoneMissing && (
            <div className="mb-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
              No phone number yet — add one so we can call and text you when a site goes offline.
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="accountEmail" className="block text-sm font-medium text-gray-700">
                Account email
              </label>
              <input
                id="accountEmail"
                type="email"
                value={contact?.email ?? ''}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-md sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Used to sign in, and for alerts unless you set a different address below.</p>
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                Phone number (for calls &amp; SMS)
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                placeholder="+14155552671"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={saving}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                International format with country code. Leave blank to receive email alerts only.
              </p>
            </div>

            <div>
              <label htmlFor="notificationEmail" className="block text-sm font-medium text-gray-700">
                Alert email (optional)
              </label>
              <input
                id="notificationEmail"
                name="notificationEmail"
                type="email"
                autoComplete="email"
                placeholder={contact?.email}
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                disabled={saving}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Offline alerts are emailed to <span className="font-mono">{alertEmail}</span>.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {saved && !error && (
            <div className="mt-4 rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">Saved.</p>
            </div>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
