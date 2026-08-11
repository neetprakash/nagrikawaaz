'use client';

import { useState } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';
import { api, CATEGORIES, getStoredUser, API_URL } from '../lib/api';
import { timeAgo } from '../lib/time';

const STATUS_ICON = { pending: '⏳', under_review: '👀', action_taken: '🛠', rejected: '❌' };
const SCOPE_LABEL = { ward: 'Locality', district: 'District', state: 'State', national: 'Country' };

function absoluteAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

export default function IssueFeedCard({ issue: initial }) {
  const [issue, setIssue] = useState(initial);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [reported, setReported] = useState(initial.has_reported || false);
  const [showMenu, setShowMenu] = useState(false);

  const categoryLabel = CATEGORIES.find((c) => c.value === issue.category)?.label || issue.category;
  const locationBits = [issue.constituency_name, issue.district, issue.state].filter(
    (v, i, arr) => v && arr.indexOf(v) === i
  );
  const isLong = issue.description?.length > 220;

  async function vote() {
    if (issue.has_voted || voting) return;
    setVoting(true);
    setVoteError('');
    try {
      const res = await api.voteIssue(issue.id);
      setIssue((i) => ({ ...i, vote_count: res.vote_count, escalation_level: res.escalation_level, has_voted: true }));
    } catch (err) {
      if (!getStoredUser()) setVoteError({ text: 'Login to support this issue', href: '/login' });
      else if (err.message.includes('verification required'))
        setVoteError({ text: 'Add your Voter ID to get verified before supporting posts', href: '/profile' });
      else setVoteError({ text: err.message });
    } finally {
      setVoting(false);
    }
  }

  async function report() {
    if (reported) return;
    const reason = window.prompt('Why are you reporting this post? (spam, abuse, misinformation, etc.)');
    if (reason === null) return; // cancelled
    try {
      const res = await api.reportIssue(issue.id, reason);
      setReported(true);
      setVoteError({ text: res.message });
    } catch (err) {
      if (err.message.includes('verification required'))
        setVoteError({ text: 'Add your Voter ID to get verified before reporting posts', href: '/profile' });
      else setVoteError({ text: err.message });
    } finally {
      setShowMenu(false);
    }
  }

  async function toggleComments() {
    setShowComments((s) => !s);
    if (!comments) {
      try {
        const res = await api.getIssue(issue.id);
        setComments(res.comments);
      } catch {
        setComments([]);
      }
    }
  }

  async function postComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await api.commentIssue(issue.id, commentText);
      setCommentText('');
      const res = await api.getIssue(issue.id);
      setComments(res.comments);
      setIssue((i) => ({ ...i, comment_count: (i.comment_count || 0) + 1 }));
    } catch (err) {
      if (err.message.includes('verification required'))
        setVoteError({ text: 'Add your Voter ID to get verified before commenting', href: '/profile' });
      else setVoteError({ text: err.message });
    }
  }

  return (
    <article className="card">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar name={issue.author_name || 'Anonymous'} src={absoluteAvatarUrl(issue.author_avatar_url)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{issue.author_name || 'Anonymous'}</span>
            <span className={`badge badge-${issue.escalation_level}`}>{issue.escalation_level}</span>
          </div>
          <div className="text-xs text-gray-500 truncate">
            {locationBits.length > 0 ? locationBits.join(' · ') : SCOPE_LABEL[issue.scope]} ·{' '}
            {timeAgo(issue.created_at)}
          </div>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600 whitespace-nowrap">
          {categoryLabel}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowMenu((s) => !s)}
            className="text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded-full hover:bg-gray-100"
            aria-label="Post options"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-md text-sm w-40 z-20 overflow-hidden">
              <button
                onClick={report}
                disabled={reported}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600 disabled:text-gray-400"
              >
                {reported ? '✅ Reported' : '🚩 Report post'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <Link href={`/issues/${issue.id}`} className="block mt-3">
        <h3 className="font-semibold text-navy leading-snug">{issue.title}</h3>
        <p className={`text-sm text-gray-700 mt-1 ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
          {issue.description}
        </p>
      </Link>
      {isLong && (
        <button
          className="text-xs text-navy font-medium mt-1"
          onClick={(e) => {
            e.preventDefault();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? 'Show less' : 'See more'}
        </button>
      )}

      {issue.evidence_count > 0 && (
        <Link
          href={`/issues/${issue.id}`}
          className="mt-3 flex items-center gap-1 text-xs text-navy bg-blue-50 rounded-lg px-2 py-1.5 w-fit"
        >
          📎 {issue.evidence_count} evidence file{issue.evidence_count > 1 ? 's' : ''} attached
        </Link>
      )}

      {/* Status strip */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className={`badge status-${issue.response_status}`}>
          {STATUS_ICON[issue.response_status]} {issue.response_status.replace('_', ' ')}
        </span>
      </div>

      {/* Action bar */}
      <div className="mt-3 pt-3 border-t flex items-center gap-1">
        <button
          onClick={vote}
          disabled={voting}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
            issue.has_voted ? 'text-indiagreen bg-green-50' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {issue.has_voted ? '✅ Supported' : '👍 Support'} · {issue.vote_count}
        </button>
        <button
          onClick={toggleComments}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          💬 Comment{issue.comment_count > 0 ? ` · ${issue.comment_count}` : ''}
        </button>
        <Link
          href={`/issues/${issue.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          🔗 Details
        </Link>
      </div>
      {voteError && (
        <p className="text-xs text-red-600 mt-1">
          {voteError.text}
          {voteError.href && (
            <Link href={voteError.href} className="underline font-medium ml-1">
              Fix this →
            </Link>
          )}
        </p>
      )}

      {/* Inline comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {comments === null && <p className="text-xs text-gray-400">Loading comments…</p>}
          {comments?.length === 0 && <p className="text-xs text-gray-400">No comments yet — be the first.</p>}
          {comments?.slice(-4).map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name={c.author_name} size="sm" src={absoluteAvatarUrl(c.author_avatar_url)} />
              <div className="bg-gray-100 rounded-2xl px-3 py-1.5 text-sm flex-1">
                <span className="font-medium">{c.author_name}</span> {c.body}
              </div>
            </div>
          ))}
          <form onSubmit={postComment} className="flex items-center gap-2 pt-1">
            <input
              className="input text-sm py-1.5"
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button className="text-navy font-medium text-sm px-2">Post</button>
          </form>
        </div>
      )}
    </article>
  );
}
