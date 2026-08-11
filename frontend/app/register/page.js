'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', pincode: '', voter_id: '' });
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
      const res = await api.register(form);
      setSuccess(res);
      setTimeout(() => router.push(`/login?phone=${encodeURIComponent(form.phone)}`), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto card">
      <h1 className="text-xl font-bold text-navy mb-1">Get Verified</h1>
      <p className="text-sm text-gray-600 mb-4">
        Your Voter ID is reviewed by a moderator before you can vote or raise issues — this keeps
        the platform free of bots and fake accounts. Full Aadhaar-based e-KYC is planned for a
        licensed production launch (see README).
      </p>

      <form onSubmit={submit} className="space-y-3">
        <Field label="Full name">
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </Field>
        <Field label="Phone number">
          <input
            className="input"
            required
            pattern="[0-9]{10}"
            placeholder="10-digit mobile number"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </Field>
        <Field label="PIN code (auto-detects your constituency)">
          <input className="input" required value={form.pincode} onChange={(e) => update('pincode', e.target.value)} />
        </Field>
        <Field label="Voter ID (EPIC number) — required to support posts, comment, or raise issues">
          <input className="input" value={form.voter_id} onChange={(e) => update('voter_id', e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">
            You can skip this and add it later from your profile, but your account stays
            read-only until you do.
          </p>
        </Field>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && (
          <div className="text-sm bg-green-50 text-green-800 rounded-lg p-3">
            {success.message}
            {success.constituency && (
              <div className="mt-1">Detected constituency: <b>{success.constituency.name}</b></div>
            )}
            {success.constituency_warning && (
              <div className="mt-1 text-yellow-700">{success.constituency_warning}</div>
            )}
            <div className="mt-1">Redirecting you to login…</div>
          </div>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Submitting…' : 'Register'}
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
