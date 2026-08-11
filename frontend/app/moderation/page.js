'use client';

import { useEffect, useState } from 'react';
import { api, CATEGORIES } from '../../lib/api';

export default function ModerationPage() {
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.moderationQueue();
      setIssues(res.issues);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id) {
    await api.approveIssue(id);
    load();
  }

  async function reject(id) {
    const reason = window.prompt('Reason for removal (visible to the author):');
    await api.rejectIssue(id, reason || undefined);
    load();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-navy mb-1">Reported Posts</h1>
      <p className="text-sm text-gray-500 mb-4">
        Everything here was flagged by 5+ citizens and automatically pulled from the public feed
        for review. Posts are never pre-approved — this is the only moderation checkpoint.
      </p>
      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && issues.length === 0 && <p className="text-gray-500">Nothing reported. Queue is clean.</p>}

      <div className="space-y-3">
        {issues.map((issue) => (
          <div key={issue.id} className="card">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-navy">{issue.title}</h3>
                <p className="text-xs text-gray-500">
                  {CATEGORIES.find((c) => c.value === issue.category)?.label} · {issue.scope} · by{' '}
                  {issue.author_name} · <span className="text-red-600 font-medium">{issue.report_count} reports</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve(issue.id)} className="btn-primary">Reinstate</button>
                <button onClick={() => reject(issue.id)} className="btn-secondary">Remove</button>
              </div>
            </div>
            <p className="text-sm mt-2">{issue.description}</p>

            {issue.recent_reports?.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-gray-500 mb-1">Recent report reasons:</p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {issue.recent_reports.map((r, idx) => (
                    <li key={idx}>
                      <b>{r.reporter_name}:</b> {r.reason || '(no reason given)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
