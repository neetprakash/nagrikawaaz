'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '../../components/Avatar';
import { api, getStoredUser, API_URL } from '../../lib/api';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

export default function PeoplePage() {
  const router = useRouter();
  const [tab, setTab] = useState('discover');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.searchUsers(query.trim());
        if (!cancelled) setResults(res.results || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  async function loadRequests() {
    try {
      const res = await api.pendingRequests();
      setRequests(res.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function send(userId) {
    try {
      await api.connect(userId);
      setResults((rs) =>
        rs.map((r) =>
          r.id === userId ? { ...r, connection: { state: 'outgoing_pending' } } : r
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function accept(requestId) {
    try {
      await api.acceptRequest(requestId);
      setRequests((rs) => rs.filter((r) => r.request_id !== requestId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function decline(requestId) {
    try {
      await api.declineRequest(requestId);
      setRequests((rs) => rs.filter((r) => r.request_id !== requestId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-navy">People</h1>

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === 'discover'} onClick={() => setTab('discover')}>
          Discover
        </TabBtn>
        <TabBtn active={tab === 'requests'} onClick={() => setTab('requests')}>
          Requests {requests.length > 0 && `(${requests.length})`}
        </TabBtn>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {tab === 'discover' && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Search verified citizens by name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {busy && <p className="text-sm text-gray-500">Searching…</p>}
          {!busy && query.trim() && results.length === 0 && (
            <p className="text-sm text-gray-500">No verified citizens match.</p>
          )}
          {results.map((r) => (
            <div key={r.id} className="card flex items-center gap-3">
              <Avatar name={r.name} src={absoluteAvatarUrl(r.avatar_url)} />
              <div className="flex-1 min-w-0">
                <Link href={`/profile?u=${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <p className="text-xs text-gray-500">
                  {r.role}
                  {r.verified ? ' · ✅ verified' : ''}
                </p>
              </div>
              <Action user={r} onConnect={send} />
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <p className="text-sm text-gray-500">
              No pending requests. When someone wants to connect with you, it'll show up here.
            </p>
          )}
          {requests.map((r) => (
            <div key={r.request_id} className="card flex items-center gap-3">
              <Avatar name={r.user.name} src={absoluteAvatarUrl(r.user.avatar_url)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{r.user.name}</p>
                <p className="text-xs text-gray-500">{r.user.role}</p>
              </div>
              <button className="btn-secondary" onClick={() => decline(r.request_id)}>
                Decline
              </button>
              <button className="btn-primary" onClick={() => accept(r.request_id)}>
                Accept
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active
          ? 'border-navy text-navy'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function Action({ user, onConnect }) {
  const state = user.connection?.state;
  if (state === 'connected') {
    return (
      <Link href={`/inbox/${user.id}`} className="btn-primary text-sm py-1 px-3">
        Message
      </Link>
    );
  }
  if (state === 'outgoing_pending') {
    return <span className="text-sm text-gray-500">Requested</span>;
  }
  if (state === 'incoming_pending') {
    return null; // would be visible on Requests tab already
  }
  return (
    <button onClick={() => onConnect(user.id)} className="btn-secondary text-sm py-1 px-3">
      Connect
    </button>
  );
}