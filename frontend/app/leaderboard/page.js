'use client';

import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar';
import { api, getStoredUser, API_URL } from '../../lib/api';

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

function currentMonthLabel() {
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const user = typeof window !== 'undefined' ? getStoredUser() : null;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError('');
    try {
      const res = await api.leaderboard({});
      setData(res);
    } catch (err) {
      setError(
        err.message.includes('constituency_id is required')
          ? "We don't know your ward yet — add a PIN code or pick a constituency from your profile to see your local leaderboard."
          : err.message
      );
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-navy mb-1">🏆 Top Watchdogs</h1>
      <p className="text-sm text-gray-500 mb-4">
        Ranked by issues raised, posts supported, and comments this month — recalculated live,
        so the badge always belongs to whoever's actually earning it right now.
      </p>

      {error && (
        <div className="card text-center py-6">
          <p className="text-gray-500">{error}</p>
        </div>
      )}

      {!error && !data && <p className="text-gray-500">Loading…</p>}

      {data && (
        <>
          <div className="card mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-navy">
                {data.constituency.name}, {data.constituency.district}
              </p>
              <p className="text-xs text-gray-500">{currentMonthLabel()}</p>
            </div>
            {data.my_rank && (
              <span className="badge bg-navy text-white">You're #{data.my_rank} this month</span>
            )}
          </div>

          {data.leaderboard.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500">No activity yet this month in your ward.</p>
              <p className="text-sm text-gray-400 mt-1">Raise an issue or support one to take #1.</p>
            </div>
          )}

          <div className="space-y-2">
            {data.leaderboard.map((row) => (
              <div
                key={row.id}
                className={`card flex items-center gap-3 ${
                  user && row.id === user.id ? 'ring-2 ring-navy' : ''
                }`}
              >
                <div className="w-7 text-center font-bold text-gray-400">#{row.rank}</div>
                <Avatar name={row.name} size="sm" src={absoluteAvatarUrl(row.avatar_url)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {row.name}
                    {user && row.id === user.id && <span className="text-navy"> (you)</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {row.issues_posted} issues · {row.votes_cast} supports · {row.comments_made} comments
                  </p>
                </div>
                {row.badge && (
                  <div className="text-center shrink-0">
                    <div className="text-xl">{row.badge.icon}</div>
                    <div className="text-[10px] text-gray-500 whitespace-nowrap">{row.badge.name}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
