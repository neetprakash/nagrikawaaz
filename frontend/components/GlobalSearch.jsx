'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';
import { api, API_URL } from '../lib/api';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.searchUsers(query.trim());
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
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
  }, []);

  async function connect(userId) {
    try {
      await api.connect(userId);
      setResults((rs) =>
        rs.map((r) =>
          r.id === userId ? { ...r, connection: { state: 'outgoing_pending' } } : r
        )
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function accept(requestId, userId) {
    try {
      await api.acceptRequest(requestId);
      setResults((rs) =>
        rs.map((r) =>
          r.id === userId ? { ...r, connection: { state: 'connected' } } : r
        )
      );
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search people…"
        className="w-full bg-white/10 text-white placeholder-white/60 border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
        aria-label="Search people"
      />
      {open && query.trim() && (
        <div className="absolute left-0 right-0 mt-1 bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          {busy && <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>}
          {!busy && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">No verified citizens match.</p>
          )}
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <Avatar
                name={r.name}
                src={absoluteAvatarUrl(r.avatar_url)}
              />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile?u=${r.id}`}
                  onClick={() => setOpen(false)}
                  className="font-medium text-sm hover:underline block truncate"
                >
                  {r.name}
                </Link>
                <p className="text-xs text-gray-500 truncate">
                  {r.role}
                  {r.verified ? ' · ✅ verified' : ''}
                </p>
              </div>
              <ConnectionAction user={r} onConnect={connect} onAccept={accept} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionAction({ user, onConnect, onAccept }) {
  const state = user.connection?.state;
  if (state === 'connected') {
    return (
      <Link
        href={`/inbox/${user.id}`}
        className="text-xs bg-indiagreen/10 text-indiagreen px-2 py-1 rounded-lg font-medium hover:bg-indiagreen/20"
      >
        Message
      </Link>
    );
  }
  if (state === 'outgoing_pending' || state === 'outgoing_declined') {
    return (
      <span className="text-xs text-gray-500 px-2 py-1">Requested</span>
    );
  }
  if (state === 'incoming_pending') {
    return (
      <button
        onClick={() => onAccept(user.connection.request_id, user.id)}
        className="text-xs btn-primary py-1 px-2"
      >
        Accept
      </button>
    );
  }
  if (state === 'self') return null;
  return (
    <button
      onClick={() => onConnect(user.id)}
      className="text-xs btn-secondary py-1 px-2"
    >
      Connect
    </button>
  );
}