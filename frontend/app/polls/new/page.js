'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, SCOPES, getStoredUser } from '../../../lib/api';

const SCOPE_ICONS = {
  ward: '🏘️',
  district: '🏙️',
  state: '🗺️',
  national: '🇮🇳',
};

const MAX_OPTIONS = 6;

export default function NewPollPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('ward');
  const [options, setOptions] = useState(['', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  function updateOption(idx, value) {
    setOptions((opts) => opts.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    setOptions((opts) => (opts.length >= MAX_OPTIONS ? opts : [...opts, '']));
  }

  function removeOption(idx) {
    setOptions((opts) => (opts.length <= 2 ? opts : opts.filter((_, i) => i !== idx)));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const trimmed = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim()) {
      setError('Please give your poll a title.');
      return;
    }
    if (trimmed.length < 2) {
      setError('A poll needs at least 2 options.');
      return;
    }
    setLoading(true);
    try {
      await api.createPoll({
        title: title.trim(),
        options: trimmed,
        scope,
        constituency_id: user?.constituency_id || null,
      });
      router.push('/polls');
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('verification')) {
        setError('unverified');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto card">
      <h1 className="text-xl font-bold text-navy mb-1">Create a Poll</h1>
      <p className="text-sm text-gray-600 mb-4">
        Pose a question to other verified citizens in your area. You must be verified to publish a poll.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <Field label="Title">
          <input
            className="input"
            required
            placeholder="e.g. Should the market road be widened?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Location scope">
          <select
            className="input"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {SCOPE_ICONS[s.value] || '🌐'} {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Options (${options.length}/${MAX_OPTIONS})`}>
          <ul className="space-y-2">
            {options.map((opt, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  required
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="text-xs text-red-600 hover:underline px-2"
                    title="Remove option"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 text-sm text-navy hover:underline"
            >
              + Add option
            </button>
          )}
        </Field>

        {error === 'unverified' ? (
          <p className="text-red-600 text-sm">
            You need to add a Voter ID to get verified before creating a poll.{' '}
            <Link href="/profile" className="underline font-medium">Complete verification →</Link>
          </p>
        ) : (
          error && <p className="text-red-600 text-sm">{error}</p>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Publishing…' : 'Publish poll'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
