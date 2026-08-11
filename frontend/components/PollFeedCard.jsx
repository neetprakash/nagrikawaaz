'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import { api, getStoredUser } from '../lib/api';
import { timeAgo } from '../lib/time';

const SCOPE_LABEL = { ward: 'Locality', district: 'District', state: 'State', national: 'Country' };

export default function PollFeedCard({ poll: initial }) {
  const [poll, setPoll] = useState(initial);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState('');

  const total = poll.results.reduce((s, r) => s + r.count, 0) || 0;

  async function vote(idx) {
    if (voted) return;
    try {
      const res = await api.votePoll(poll.id, idx);
      setPoll((p) => ({ ...p, results: res.results }));
      setVoted(true);
    } catch (err) {
      if (!getStoredUser()) setError('Login to vote in this poll');
      else setError(err.message);
    }
  }

  return (
    <article className="card border-l-4 border-l-indigo-400">
      <div className="flex items-start gap-3">
        <Avatar name="Poll" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">📊 Community Poll</span>
            <span className="badge bg-indigo-100 text-indigo-700">{SCOPE_LABEL[poll.scope]}</span>
          </div>
          <div className="text-xs text-gray-500">{timeAgo(poll.created_at)}</div>
        </div>
      </div>

      <h3 className="font-semibold text-navy mt-3">{poll.title}</h3>

      <div className="space-y-2 mt-3">
        {poll.options.map((opt, idx) => {
          const count = poll.results.find((r) => r.option_index === idx)?.count || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <button
              key={idx}
              onClick={() => vote(idx)}
              className="w-full text-left border rounded-lg p-2 hover:bg-gray-50 relative overflow-hidden"
            >
              <div
                className="absolute inset-y-0 left-0 bg-indigo-100"
                style={{ width: `${pct}%`, transition: 'width .3s' }}
              />
              <div className="relative flex justify-between text-sm">
                <span>{opt}</span>
                <span className="text-gray-500">{count} · {pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-gray-400 mt-2">{total} vote{total !== 1 ? 's' : ''}</p>
    </article>
  );
}
