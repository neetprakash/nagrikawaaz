'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, CATEGORIES } from '../../../lib/api';
import EvidenceCarousel from '../../../components/EvidenceCarousel';
import EscalationProgressBar from '../../../components/EscalationProgressBar';

const STATUS_ICON = {
  pending: '⏳',
  under_review: '👀',
  action_taken: '🛠',
  rejected: '❌',
};

export default function IssueDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [voteMsg, setVoteMsg] = useState('');
  const [comment, setComment] = useState('');
  const [reported, setReported] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    try {
      const res = await api.getIssue(id);
      setData(res);
      setReported(res.issue.has_reported || false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function report() {
    if (reported) return;
    const reason = window.prompt('Why are you reporting this post? (spam, abuse, misinformation, etc.)');
    if (reason === null) return;
    try {
      const res = await api.reportIssue(id, reason);
      setReported(true);
      setVoteMsg(res.message);
    } catch (err) {
      setVoteMsg(err.message);
    }
  }

  async function vote() {
    setVoteMsg('');
    try {
      const res = await api.voteIssue(id);
      setVoteMsg(`Support counted! Total: ${res.vote_count} (escalation level: ${res.escalation_level})`);
      setData((d) => ({
        ...d,
        issue: { ...d.issue, vote_count: res.vote_count, escalation_level: res.escalation_level, has_voted: true },
      }));
    } catch (err) {
      setVoteMsg(err.message);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.commentIssue(id, comment);
      setComment('');
      load();
    } catch (err) {
      setVoteMsg(err.message);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;

  const { issue, evidence, comments, responses, escalations } = data;
  const categoryLabel = CATEGORIES.find((c) => c.value === issue.category)?.label || issue.category;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="card">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-navy">{issue.title}</h1>
          <div className="flex items-center gap-2">
            <span className={`badge badge-${issue.escalation_level}`}>{issue.escalation_level} level</span>
            <button onClick={report} disabled={reported} className="text-xs text-red-500 hover:underline disabled:text-gray-400">
              {reported ? '✅ Reported' : '🚩 Report'}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {categoryLabel} · {issue.scope} · by {issue.author_name || 'Anonymous'} ·{' '}
          {new Date(issue.created_at).toLocaleDateString('en-IN')}
          {(issue.constituency_name || issue.district || issue.state) && (
            <> · {[issue.constituency_name, issue.district, issue.state].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ')}</>
          )}
        </p>
        <p className="mt-3 whitespace-pre-wrap">{issue.description}</p>
        {issue.since_when && (
          <p className="text-sm text-gray-500 mt-2">Since: {issue.since_when}</p>
        )}
        {issue.affected_group && (
          <p className="text-sm text-gray-500">Affects: {issue.affected_group}</p>
        )}

        {evidence?.length > 0 && <EvidenceCarousel items={evidence} />}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={vote} disabled={issue.has_voted} className="btn-primary disabled:opacity-60">
            {issue.has_voted ? '✅ Supported' : '👍 Support'} ({issue.vote_count})
          </button>
          <span className={`badge status-${issue.response_status}`}>
            {STATUS_ICON[issue.response_status]} {issue.response_status.replace('_', ' ')}
          </span>
        </div>
        {voteMsg && <p className="text-sm text-gray-600 mt-2">{voteMsg}</p>}

        <div className="mt-4 pt-4 border-t">
          <EscalationProgressBar escalationLevel={issue.escalation_level} voteCount={issue.vote_count} />
        </div>
      </div>

      {escalations?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-2">Escalation timeline</h2>
          <ul className="text-sm space-y-1">
            {escalations.map((e) => (
              <li key={e.id}>
                Reached <b>{e.level}</b> level at {e.vote_count_at_escalation} votes —{' '}
                {new Date(e.notified_at).toLocaleString('en-IN')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-2">Official responses</h2>
        {responses?.length === 0 && <p className="text-sm text-gray-500">No official response yet.</p>}
        <ul className="space-y-3">
          {responses?.map((r) => (
            <li key={r.id} className="border-l-4 border-navy pl-3">
              <div className="text-sm font-medium">
                {STATUS_ICON[r.status]} {r.status.replace('_', ' ')} — {r.designation.replace('_', ' ')} ({r.level})
              </div>
              {r.message && <p className="text-sm text-gray-600">{r.message}</p>}
              <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('en-IN')}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Discussion</h2>
        <ul className="space-y-2 mb-3">
          {comments?.map((c) => (
            <li key={c.id} className="text-sm">
              <b>{c.author_name}:</b> {c.body}
            </li>
          ))}
          {comments?.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
        </ul>
        <form onSubmit={submitComment} className="flex gap-2">
          <input
            className="input"
            placeholder="Add a comment (requires login)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button className="btn-secondary">Post</button>
        </form>
      </div>
    </div>
  );
}
