'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export default function UnsubscribeWeekly({ userId, token }: { userId: string; token: string }) {
  const [status, setStatus] = useState<'saving' | 'done' | 'error'>('saving');
  const [error, setError] = useState('');
  const unsubscribe = useCallback(async () => {
    setStatus('saving');
    try {
      const response = await fetch('/api/weekly-summary-unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }), credentials: 'omit', referrerPolicy: 'no-referrer'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not unsubscribe. Please try again.');
      setStatus('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unsubscribe. Please try again.');
      setStatus('error');
    }
  }, [userId, token]);

  // Clicking the signed email link is the user's action; no sign-in or second click.
  // A plain HTTP GET by a link checker does not change the preference.
  useEffect(() => { void unsubscribe(); }, [unsubscribe]);

  return <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div className="max-w-lg w-full bg-white rounded-lg shadow p-8" aria-live="polite">
      <h1 className="text-2xl font-bold text-gray-900">{status === 'done' ? 'You’re unsubscribed' : status === 'saving' ? 'Updating your weekly emails…' : 'We couldn’t unsubscribe you'}</h1>
      {status === 'done' && <p className="mt-4 text-gray-600">Weekly status emails are turned off. You can turn them back on in your Profile. Your website monitoring and outage alerts stay active.</p>}
      {status === 'error' && <><p className="mt-4 text-red-700">{error}</p><button onClick={unsubscribe} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Try again</button></>}
      <Link href="/profile" className="mt-6 inline-block text-blue-600 hover:text-blue-500">Manage email preferences</Link>
    </div>
  </main>;
}
