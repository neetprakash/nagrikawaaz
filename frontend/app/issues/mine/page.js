'use client';

import { useEffect, useState } from 'react';
import { api, CATEGORIES } from '../../../lib/api';
import { timeAgo } from '../../../lib/time';

const STATUS_STYLE = {
  active: { label: 'Live', cls: 'bg-green-100 text-green-800' },
  under_review: { label: 'Flagged — under review', cls: 'bg-yellow-100 text-yellow-800' },
  removed: { label: 'Removed by moderator', cls: 'bg-red-100 text-red-800' },
};

export default function MyIssuesPage() {
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError('');
    try {
      const res = await api.myIssues();
      setIssues(res.issues);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-navy mb-1">My Issues</h1>
      <p className="text-sm text-gray-500 mb-4">
        Everything you've posted. Posts go live instantly — if one gets flagged enough by other
        citizens it moves to "under review" here while a moderator takes a look.
      </p>

      {error && <p className="text-red-600">{error === 'Missing or invalid Authorization header' ? 'Please login to see your issues.' : error}</p>}
      {issues === null && !error && <p className="text-gray-500">Loading…</p>}
      {issues?.length === 0 && <p className="text-gray-500">You haven't raised any issues yet.</p>}

      <div className="space-y-3">
        {issues?.map((issue) => {
          const s = STATUS_STYLE[issue.status] || STATUS_STYLE.active;
          return (
            <div key={issue.id} className="card">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <h3 className="font-semibold text-navy">{issue.title}</h3>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {CATEGORIES.find((c) => c.value === issue.category)?.label} · {issue.scope} ·{' '}
                {timeAgo(issue.created_at)}
              </p>
              <p className="text-sm mt-2 text-gray-700">{issue.description}</p>
              {issue.status === 'active' && (
                <p className="text-xs text-gray-500 mt-2">▲ {issue.vote_count} votes · {issue.comment_count} comments</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
