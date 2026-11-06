'use client';

import { useCallback, useEffect, useState } from 'react';

interface Preference { enabled: boolean; nextDueAt: string | null }

export default function WeeklyEmailPreference() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/email-preferences', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!response.ok) throw new Error('Could not load weekly email preferences. Please try again.');
      setPreference((await response.json()).weeklySummary);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load preferences.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    if (!preference) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/email-preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ enabled: !preference.enabled })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save weekly email preferences.');
      setPreference(data.weeklySummary); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save preferences.'); }
    finally { setBusy(false); }
  }

  return <section className="bg-white rounded-lg shadow p-6 mb-6" aria-labelledby="weekly-email-title" aria-busy={busy}>
    <div className="flex items-center justify-between gap-6">
      <div>
        <h2 id="weekly-email-title" className="text-xl font-semibold text-gray-800">Weekly status emails</h2>
        <p id="weekly-email-description" className="mt-2 text-sm text-gray-600">Get your websites’ online percentages and outage summary every seven days at your account email.</p>
      </div>
      <button type="button" role="switch" aria-label="Weekly status emails" aria-checked={preference?.enabled ?? false}
        aria-describedby="weekly-email-description" disabled={busy || !preference} onClick={toggle}
        className={`shrink-0 min-w-20 rounded-full px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 ${preference?.enabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
        {busy ? preference ? 'Saving…' : 'Loading…' : preference?.enabled ? 'On' : 'Off'}
      </button>
    </div>
    <p className="mt-3 text-sm text-gray-500">Turning off weekly emails keeps your monitoring and immediate outage alerts active.</p>
    {preference?.enabled && preference.nextDueAt && <p className="mt-2 text-sm text-gray-600">Next report: {new Date(preference.nextDueAt).toLocaleString()}.</p>}
    <div aria-live="polite">
      {saved && !error && <p className="mt-3 text-sm text-green-700">{preference?.enabled ? 'Weekly emails are on. Your next report will arrive in one week.' : 'Weekly emails are off.'}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} {!preference && <button type="button" onClick={load} className="underline">Retry</button>}</p>}
    </div>
  </section>;
}
