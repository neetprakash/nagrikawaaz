'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, CATEGORIES, SCOPES } from '../../../lib/api';

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
  const [file, setFile] = useState(null);
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
      if (file) {
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
          <select className="input" value={form.category} onChange={(e) => update('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Location scope">
          <select className="input" value={form.scope} onChange={(e) => update('scope', e.target.value)}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
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

        <Field label="Evidence (photo/document, optional)">
          <input type="file" className="input" onChange={(e) => setFile(e.target.files[0])} />
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
