'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function PollsPage() {
  const [polls, setPolls] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.listPolls();
      setPolls(res.polls);
    } catch (err) {
      setError(err.message);
    }
  }

  async function vote(pollId, idx) {
    try {
      await api.votePoll(pollId, idx);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-4">Polls</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="space-y-4">
        {polls.map((poll) => {
          const total = poll.results.reduce((s, r) => s + r.count, 0) || 1;
          return (
            <div key={poll.id} className="card">
              <h3 className="font-semibold text-navy mb-1">{poll.title}</h3>
              <p className="text-xs text-gray-500 mb-3">{poll.scope}</p>
              <div className="space-y-2">
                {poll.options.map((opt, idx) => {
                  const count = poll.results.find((r) => r.option_index === idx)?.count || 0;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <button
                      key={idx}
                      onClick={() => vote(poll.id, idx)}
                      className="w-full text-left border rounded-lg p-2 hover:bg-gray-50"
                    >
                      <div className="flex justify-between text-sm mb-1">
                        <span>{opt}</span>
                        <span className="text-gray-500">{count} votes ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {polls.length === 0 && <p className="text-gray-500">No polls yet.</p>}
      </div>
    </div>
  );
}
