'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const STATUSES = ['pending', 'under_review', 'action_taken', 'rejected'];

export default function OfficialDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError('');
    try {
      const res = await api.officialDashboard();
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  }

  async function respond(issueId, status) {
    try {
      await api.respondToIssue(issueId, status, messages[issueId] || '');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;

  const { official, issues, analytics } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-1">
        {official.designation.replace('_', ' ')} Dashboard
      </h1>
      <p className="text-sm text-gray-500 mb-4">Level: {official.level}</p>

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Stat label="Issues tagged to you" value={analytics.total_tagged} />
        <Stat label="Pending response" value={analytics.by_response_status.pending || 0} />
        <Stat label="Action taken" value={analytics.by_response_status.action_taken || 0} />
      </div>

      <div className="space-y-3">
        {issues.map((issue) => (
          <div key={issue.id} className="card">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <h3 className="font-semibold text-navy">{issue.title}</h3>
              <span className="badge status-pending">▲ {issue.vote_count} votes</span>
            </div>
            <p className="text-sm mt-1">{issue.description}</p>

            <div className="flex flex-wrap gap-2 mt-3">
              <input
                className="input flex-1 min-w-[200px]"
                placeholder="Response message (visible on public timeline)"
                value={messages[issue.id] || ''}
                onChange={(e) => setMessages((m) => ({ ...m, [issue.id]: e.target.value }))}
              />
              {STATUSES.map((s) => (
                <button key={s} onClick={() => respond(issue.id, s)} className="btn-secondary text-xs">
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        ))}
        {issues.length === 0 && <p className="text-gray-500">No issues tagged to your level yet.</p>}
      </div>
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
