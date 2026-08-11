'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '../../components/Avatar';
import { api, getStoredUser, setStoredUser, setToken } from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [constituencies, setConstituencies] = useState([]);
  const [form, setForm] = useState({ name: '', pincode: '', voter_id: '', constituency_id: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError('');
    try {
      const res = await api.me();
      setData(res);
      setForm({
        name: res.user.name || '',
        pincode: res.user.pincode || '',
        voter_id: res.user.voter_id || '',
        constituency_id: res.user.constituency_id || '',
      });
      const consRes = await api.listConstituencies();
      setConstituencies(consRes.constituencies);
      try {
        const connRes = await api.connections();
        setConnections(connRes.connections || []);
      } catch {
        // ignore — connections list is a nice-to-have on the profile page
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = { name: form.name, pincode: form.pincode, voter_id: form.voter_id };
      // Only send constituency_id if the person explicitly picked one from the dropdown
      // (manual override path — otherwise let the backend re-derive it from the PIN code).
      if (form.constituency_id) payload.constituency_id = Number(form.constituency_id);

      const res = await api.updateProfile(payload);
      setToken(res.token);
      setStoredUser(res.user);
      setSuccess(
        res.user.verified
          ? "Saved! You're verified — you can now support posts, comment, and raise issues."
          : 'Saved.'
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <p className="text-gray-500 max-w-xl mx-auto">{error || 'Loading…'}</p>;

  const { user, constituency, stats } = data;
  const currentAvatar = avatarPreview || absoluteAvatarUrl(user.avatar_url);

  function onPickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setError('');
    setSuccess('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar(e) {
    e.preventDefault();
    if (!avatarFile) return;
    setAvatarBusy(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('avatar', avatarFile);
      const res = await api.uploadAvatar(fd);
      setToken(res.token);
      setStoredUser(res.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      setSuccess('Profile picture updated.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.deleteAvatar();
      setStoredUser(res.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      setSuccess('Profile picture removed.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="card flex items-center gap-4">
        <Avatar name={user.name} size="lg" src={currentAvatar} />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.phone} · {user.role}</p>
        </div>
        {user.verified ? (
          <span className="badge bg-green-100 text-green-800">✅ Verified</span>
        ) : (
          <span className="badge bg-yellow-100 text-yellow-800">⚠️ Not verified</span>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Profile picture</h2>
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" src={currentAvatar} />
          <div className="flex-1 text-sm text-gray-600">
            {user.avatar_url
              ? 'Your current profile picture is shown across the app.'
              : 'No picture set — your initials are shown by default.'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-secondary cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
            {avatarFile ? 'Choose different image' : 'Choose image'}
          </label>
          {avatarFile && (
            <button
              type="button"
              className="btn-primary"
              disabled={avatarBusy}
              onClick={uploadAvatar}
            >
              {avatarBusy ? 'Uploading…' : 'Upload'}
            </button>
          )}
          {user.avatar_url && !avatarFile && (
            <button
              type="button"
              className="btn-secondary"
              disabled={avatarBusy}
              onClick={removeAvatar}
            >
              {avatarBusy ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">PNG or JPG, up to 5 MB.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Issues posted" value={stats.issues_posted} />
        <Stat label="Posts supported" value={stats.votes_cast} />
        <Stat label="Comments" value={stats.comments_made} />
      </div>

      {connections.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Your connections</h2>
            <a href="/people" className="text-xs text-navy hover:underline">
              See all
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {connections.slice(0, 12).map((c) => (
              <a
                key={c.id}
                href={`/inbox/${c.id}`}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-2 -m-2"
              >
                <Avatar name={c.name} src={absoluteAvatarUrl(c.avatar_url)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.role}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-2">Your location</h2>
        {constituency ? (
          <p className="text-sm text-gray-700">
            <b>{constituency.name}</b>, {constituency.district}, {constituency.state}
            {constituency.mp_name && <> · MP: {constituency.mp_name} ({constituency.mp_party})</>}
          </p>
        ) : (
          <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-2">
            No constituency detected from your PIN code yet. This demo only seeds 3
            constituencies (PIN prefixes 226 / 110 / 560) — pick one manually below, or enter a
            matching PIN code.
          </p>
        )}
      </div>

      <form onSubmit={save} className="card space-y-3">
        <h2 className="font-semibold">Edit profile</h2>

        <Field label="Full name">
          <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </Field>

        <Field label="PIN code">
          <input className="input" value={form.pincode} onChange={(e) => update('pincode', e.target.value)} />
        </Field>

        <Field label={`Voter ID (EPIC number)${user.verified ? '' : ' — required to get verified'}`}>
          <input className="input" value={form.voter_id} onChange={(e) => update('voter_id', e.target.value)} />
        </Field>

        <Field label="Or pick your constituency manually (overrides PIN code match)">
          <select
            className="input"
            value={form.constituency_id}
            onChange={(e) => update('constituency_id', e.target.value)}
          >
            <option value="">— No manual override —</option>
            {constituencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.district}, {c.state}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-sm bg-green-50 text-green-800 rounded-lg p-2">{success}</p>}

        <button className="btn-primary w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card text-center">
      <div className="text-2xl font-bold text-navy">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
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
