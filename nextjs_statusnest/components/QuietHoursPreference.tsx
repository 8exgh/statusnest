'use client';

import { useCallback, useEffect, useState } from 'react';
import { MAX_QUIET_HOURS_RANGES, parseQuietHours, type QuietHoursRange, type QuietHoursSettings } from '@/lib/alerts/quiet-hours';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const newRange = (): QuietHoursRange => ({ days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '07:00' });
const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50';

export default function QuietHoursPreference({ alertEmail }: { alertEmail?: string }) {
  const [settings, setSettings] = useState<QuietHoursSettings | null>(null);
  const [timeZones, setTimeZones] = useState<string[]>(['UTC']);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/alert-preferences', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, cache: 'no-store'
      });
      if (!response.ok) throw new Error('Could not load quiet hours. Please try again.');
      const preference: QuietHoursSettings = (await response.json()).quietHours;
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      // Suggest the browser's timezone only before the first schedule is created.
      if (!preference.enabled && !preference.ranges.length && preference.timeZone === 'UTC') {
        preference.timeZone = localTimeZone;
      }
      const available = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
      setTimeZones([...new Set(['UTC', localTimeZone, preference.timeZone, ...available])].sort());
      setSettings(preference);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load quiet hours.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function change(next: QuietHoursSettings) {
    setSettings(next); setSaved(false); setError('');
  }

  function changeRange(index: number, next: QuietHoursRange) {
    if (settings) change({ ...settings, ranges: settings.ranges.map((range, i) => i === index ? next : range) });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const valid = parseQuietHours(settings);
      const response = await fetch('/api/alert-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(valid)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save quiet hours.');
      setSettings(data.quietHours); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save quiet hours.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-lg bg-white p-6 shadow" aria-labelledby="quiet-hours-title" aria-busy={busy}>
    <h2 id="quiet-hours-title" className="text-xl font-semibold text-gray-800">Quiet hours</h2>
    <p id="quiet-hours-description" className="mt-2 text-sm text-gray-600">
      Choose when to receive outage alerts by email only. Calls and SMS pause during these times for all your websites.
      Outside quiet hours, your usual alert settings apply.
    </p>
    <p className="mt-2 text-sm text-gray-600">
      Emails go to {alertEmail ? <span className="break-all font-medium">{alertEmail}</span> : 'your alert email or account email'}.
      {' '}Monitoring continues, and quiet hours alerts are not called or texted later.
    </p>
    {!settings && busy && <p className="mt-4 text-sm text-gray-500" role="status">Loading quiet hours…</p>}
    {settings && <form onSubmit={save} className="mt-5">
      <fieldset disabled={busy}>
        <legend className="sr-only">Quiet hours settings</legend>
        <label className="flex items-center gap-3 text-sm font-medium text-gray-900">
          <input type="checkbox" checked={settings.enabled} aria-describedby="quiet-hours-description"
            onChange={event => change({ ...settings, enabled: event.target.checked,
              ranges: event.target.checked && !settings.ranges.length ? [newRange()] : settings.ranges })}
            className="h-4 w-4 accent-blue-600" />
          Enable quiet hours
        </label>
        <div className="mt-4">
          <label htmlFor="quiet-hours-timezone" className="text-sm font-medium text-gray-700">Timezone</label>
          <input id="quiet-hours-timezone" list="quiet-hours-timezones" value={settings.timeZone} required maxLength={100}
            onChange={event => change({ ...settings, timeZone: event.target.value })} className={inputClass}
            aria-describedby="quiet-hours-timezone-help" />
          <datalist id="quiet-hours-timezones">{timeZones.map(zone => <option key={zone} value={zone} />)}</datalist>
          <p id="quiet-hours-timezone-help" className="mt-1 text-xs text-gray-500">All ranges use this timezone and follow its daylight saving changes. Example: America/Edmonton.</p>
        </div>
        <div className="mt-4 space-y-4">
          {settings.ranges.map((range, index) => <fieldset key={index} className="rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-800">Time range {index + 1}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-3">
              {DAYS.map((day, dayIndex) => <label key={day} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={range.days.includes(dayIndex)} className="h-4 w-4 accent-blue-600"
                  onChange={event => changeRange(index, { ...range, days: event.target.checked
                    ? [...range.days, dayIndex].sort((a, b) => a - b) : range.days.filter(value => value !== dayIndex) })} />
                {day}
              </label>)}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`quiet-start-${index}`} className="text-sm font-medium text-gray-700">Start time</label>
                <input id={`quiet-start-${index}`} type="time" step={60} required value={range.start} className={inputClass}
                  onChange={event => changeRange(index, { ...range, start: event.target.value })} />
              </div>
              <div>
                <label htmlFor={`quiet-end-${index}`} className="text-sm font-medium text-gray-700">End time</label>
                <input id={`quiet-end-${index}`} type="time" step={60} required value={range.end} className={inputClass}
                  onChange={event => changeRange(index, { ...range, end: event.target.value })} />
              </div>
            </div>
            {range.start > range.end && <p className="mt-2 text-xs text-gray-500">Ends the following day. Selected days are the days this range starts.</p>}
            <button type="button" className="mt-3 text-sm text-red-700 underline hover:text-red-800"
              aria-label={`Remove time range ${index + 1}`} onClick={() => {
                const ranges = settings.ranges.filter((_, i) => i !== index);
                change({ ...settings, ranges, enabled: settings.enabled && ranges.length > 0 });
              }}>Remove range</button>
          </fieldset>)}
        </div>
        <button type="button" disabled={settings.ranges.length >= MAX_QUIET_HOURS_RANGES}
          onClick={() => change({ ...settings, ranges: [...settings.ranges, newRange()] })}
          className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Add time range
        </button>
        <p className="mt-3 text-xs text-gray-500">Ranges repeat weekly. Overlapping ranges are combined. Save to apply your changes.</p>
        <button type="submit" className="mt-5 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400">
          {busy ? 'Saving…' : 'Save quiet hours'}
        </button>
      </fieldset>
    </form>}
    <div aria-live="polite">
      {saved && !error && <p className="mt-3 text-sm text-green-700">{settings?.enabled
        ? 'Quiet hours saved. Outage alerts will use email only during these times.'
        : 'Quiet hours are off. Your usual alert settings apply at all times.'}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}{' '}
        {!settings && <button type="button" onClick={load} className="underline">Retry</button>}
      </p>}
    </div>
  </section>;
}
