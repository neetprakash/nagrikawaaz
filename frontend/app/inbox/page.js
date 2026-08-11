'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '../../components/Avatar';
import { api, getStoredUser, API_URL } from '../../lib/api';
import { timeAgo } from '../../lib/time';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('ws')) return url;
  return `${API_URL}${url}`;
}

export default function InboxPage() {
  const router = useRouter();
  const [threads, setThreads] = useState(null);
  const [error, setError] = useState('');

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
      const res = await api.threads();
      setThreads(res.threads || []);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="text-red-600 max-w-xl mx-auto">{error}</p>;
  if (threads === null) return <p className="text-gray-500 max-w-xl mx-auto">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-navy">Inbox</h1>
      {threads.length === 0 && (
        <p className="text-gray-500">
          No conversations yet. Use the search bar at the top to find people and connect.
        </p>
      )}
      {threads.map((t) => (
        <Link
          key={t.other_user.id}
          href={`/inbox/${t.other_user.id}`}
          className="card flex items-center gap-3 hover:shadow-md transition"
        >
          <Avatar name={t.other_user.name} src={absoluteAvatarUrl(t.other_user.avatar_url)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{t.other_user.name}</span>
              {t.unread_count > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {t.unread_count}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">
              {t.last_message.sender_id === t.other_user.id ? '' : 'You: '}
              {t.last_message.body}
            </p>
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {timeAgo(t.last_message.created_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}