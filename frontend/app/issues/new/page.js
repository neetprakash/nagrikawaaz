'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, CATEGORIES, SCOPES } from '../../../lib/api';

const SCOPE_ICONS = {
  ward: '🏘️',
  district: '🏙️',
  state: '🗺️',
  national: '🇮🇳',
};

function Dropdown({ value, onChange, options, renderRow, renderButton }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full input flex items-center gap-2 text-left ${
          open ? 'ring-2 ring-navy/40' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {renderButton ? renderButton(selected) : selected?.label || '—'}
        <span className="ml-auto text-gray-400">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2 ${
                  o.value === value ? 'bg-navy/5' : ''
                }`}
              >
                {renderRow ? renderRow(o, o.value === value) : o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NewIssuePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'roads',
    scope: 'ward',
    since_when: '',
    affected_group: '',
    anonymous: false,
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.createIssue(form);
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await api.uploadEvidence(res.issue_id, fd);
      }
      setSuccess(res);
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      if (err.message.includes('verification required')) {
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
      <h1 className="text-xl font-bold text-navy mb-1">Raise an Issue</h1>
      <p className="text-sm text-gray-600 mb-4">
        You must be a verified, logged-in citizen. Your post goes live immediately — other
        citizens can report it if it's spam or abusive, which is what sends it for review, not a
        moderator pre-approving every post.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <Field label="Issue category">
          <Dropdown
            value={form.category}
            onChange={(v) => update('category', v)}
            options={CATEGORIES}
            renderButton={(c) => (
              <>
                <span>{c?.icon || '✨'}</span>
                <span>{c?.label || '—'}</span>
              </>
            )}
            renderRow={(c, active) => (
              <>
                <span>{c.icon}</span>
                <span className={active ? 'font-semibold' : ''}>{c.label}</span>
                {active && <span className="ml-auto text-navy">✓</span>}
              </>
            )}
          />
        </Field>

        <Field label="Location scope">
          <Dropdown
            value={form.scope}
            onChange={(v) => update('scope', v)}
            options={SCOPES}
            renderButton={(s) => (
              <>
                <span>{SCOPE_ICONS[s?.value] || '🌐'}</span>
                <span>{s?.label || '—'}</span>
              </>
            )}
            renderRow={(s, active) => (
              <>
                <span>{SCOPE_ICONS[s.value] || '🌐'}</span>
                <span className={active ? 'font-semibold' : ''}>{s.label}</span>
                {active && <span className="ml-auto text-navy">✓</span>}
              </>
            )}
          />
        </Field>

        <Field label="Title">
          <input className="input" required value={form.title} onChange={(e) => update('title', e.target.value)} />
        </Field>

        <Field label="What is the problem?">
          <textarea
            className="input"
            required
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </Field>

        <Field label="Since when?">
          <input className="input" value={form.since_when} onChange={(e) => update('since_when', e.target.value)} />
        </Field>

        <Field label="Who is affected?">
          <input className="input" value={form.affected_group} onChange={(e) => update('affected_group', e.target.value)} />
        </Field>

        <Field label="Evidence (photos / documents, optional — multiple allowed)">
          <input
            type="file"
            className="input"
            multiple
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
              {files.map((f, i) => (
                <li key={i}>📎 {f.name}</li>
              ))}
            </ul>
          )}
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.anonymous}
            onChange={(e) => update('anonymous', e.target.checked)}
          />
          Post anonymously (your identity stays verified internally, just hidden publicly)
        </label>

        {error === 'unverified' ? (
          <p className="text-red-600 text-sm">
            You need to add a Voter ID to get verified before posting.{' '}
            <Link href="/profile" className="underline font-medium">Complete verification →</Link>
          </p>
        ) : (
          error && <p className="text-red-600 text-sm">{error}</p>
        )}
        {success && (
          <p className="text-sm bg-green-50 text-green-800 rounded-lg p-3">
            {success.message} Taking you to your feed…
          </p>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Posting…' : 'Post to your feed'}
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
