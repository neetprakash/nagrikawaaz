'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getStoredUser } from '../../lib/api';
import PostComposer from '../../components/PostComposer';
import FeedFilters from '../../components/FeedFilters';
import Sidebar from '../../components/Sidebar';
import IssueFeedCard from '../../components/IssueFeedCard';
import PollFeedCard from '../../components/PollFeedCard';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [scope, setScope] = useState('');
  const [category, setCategory] = useState('');
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, category]);

  async function load() {
    setError('');
    try {
      // Unified timeline — all active posts sorted by most recent.
      const issueParams = { status: 'active', sort: 'recent' };
      if (scope) issueParams.scope = scope;
      if (category) issueParams.category = category;

      const pollParams = {};
      if (scope) pollParams.scope = scope;

      const [issuesRes, pollsRes] = await Promise.all([
        api.listIssues(issueParams),
        api.listPolls(pollParams),
      ]);

      const items = [
        ...issuesRes.issues.map((i) => ({ type: 'issue', data: i, created_at: i.created_at })),
        ...pollsRes.polls.map((p) => ({ type: 'poll', data: p, created_at: p.created_at })),
      ];

      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setFeed(items);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 w-full max-w-xl mx-auto lg:mx-0">
        {user && !user.verified && (
          <div className="card bg-yellow-50 border-yellow-200 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-yellow-800">
              ⚠️ Your account isn't verified yet — you can browse, but you'll need to add a Voter
              ID to support posts, comment, or post an issue.
            </p>
            <Link href="/profile" className="btn-primary text-sm whitespace-nowrap">Complete verification</Link>
          </div>
        )}

        <div className="mb-4">
          <PostComposer user={user} />
        </div>

        <FeedFilters
          scope={scope}
          setScope={setScope}
          category={category}
          setCategory={setCategory}
          sort="recent"
          setSort={() => {}}
          hideSort
        />

        {error && <p className="text-red-600 mb-3">{error}</p>}
        {feed === null && !error && <p className="text-gray-500 text-center py-8">Loading your feed…</p>}
        {feed?.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-gray-500">Nothing here yet for this filter.</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to raise an issue or start a poll.</p>
          </div>
        )}

        <div className="space-y-4">
          {feed?.map((item) =>
            item.type === 'issue' ? (
              <IssueFeedCard
                key={`issue-${item.data.id}`}
                issue={item.data}
                onDeleted={(id) =>
                  setFeed((f) =>
                    f ? f.filter((it) => !(it.type === 'issue' && it.data.id === id)) : f
                  )
                }
              />
            ) : (
              <PollFeedCard key={`poll-${item.data.id}`} poll={item.data} />
            )
          )}
        </div>
      </div>

      <Sidebar />
    </div>
  );
}
