'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '../../components/Avatar';
import { api, getStoredUser, API_URL } from '../../lib/api';
import { timeAgo } from '../../lib/time';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

const TYPE_ICON = {
  connection_request: '🤝',
  connection_accepted: '✅',
  new_issue: '📣',
  new_comment: '💬',
  new_poll: '📊',
  local_post: '📍',
};

function readNotifIds() {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem('civic_notif_read_ids') || '[]'));
  } catch {
    return new Set();
  }
}

function saveReadIds(set) {
  if (typeof window === 'undefined') return;
  // Cap at 200 most recent to keep localStorage tidy
  const arr = Array.from(set).slice(-200);
  window.localStorage.setItem('civic_notif_read_ids', JSON.stringify(arr));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [readIds, setReadIds] = useState(() => new Set());

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    setReadIds(readNotifIds());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError('');
    try {
      const res = await api.notifications();
      const list = res.notifications || [];
      setItems(list);
      // Mark everything we just received as read (matches the bell badge clearing on open).
      const next = new Set(readNotifIds());
      for (const n of list) next.add(n.id);
      saveReadIds(next);
      setReadIds(next);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="text-red-600 max-w-2xl mx-auto">{error}</p>;
  if (items === null) return <p className="text-gray-500 max-w-2xl mx-auto">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-navy">Notifications</h1>
      <p className="text-sm text-gray-500">
        Activity from citizens you're connected with, plus new posts in your constituency.
      </p>

      {items.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-500">No notifications yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Connect with other citizens from the search bar, and you'll see their activity here.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const isUnread = !readIds.has(n.id);
          const actorName = n.actor?.name || 'Someone';
          return (
            <li key={n.id}>
              <Link
                href={n.target_url}
                className={`card flex items-start gap-3 hover:shadow-md transition ${
                  isUnread ? 'border-l-4 border-navy' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  <Avatar name={actorName} src={absoluteAvatarUrl(n.actor?.avatar_url)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="mr-1">{TYPE_ICON[n.type] || '🔔'}</span>
                    <b>{actorName}</b> {n.verb}
                    {n.context_title && (
                      <>
                        {' '}
                        <span className="italic text-gray-700">"{n.context_title}"</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
