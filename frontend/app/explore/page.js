'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api, CATEGORIES, getStoredUser } from '../../lib/api';
import IssueFeedCard from '../../components/IssueFeedCard';

export default function ExplorePage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState(null);
  const [stories, setStories] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(), 300); // debounce typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  async function search() {
    if (!query.trim() && !category) {
      setResults(null);
      return;
    }
    setError('');
    try {
      const params = { status: 'active', sort: 'votes' };
      if (query.trim()) params.search = query.trim();
      if (category) params.category = category;
      const res = await api.listIssues(params);
      setResults(res.issues);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadStories() {
    try {
      const params = { status: 'active', response_status: 'action_taken', sort: 'votes', limit: 10 };
      if (getStoredUser()) {
        try {
          const me = await api.me();
          if (me.constituency?.state) params.exclude_state = me.constituency.state; // prioritize ideas from elsewhere
        } catch {
          // not fatal — just shows stories from all states instead of excluding the user's own
        }
      }
      const res = await api.listIssues(params);
      setStories(res.issues);
    } catch {
      setStories([]);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-navy mb-1">🔎 Explore</h1>
      <p className="text-sm text-gray-500 mb-4">
        Search every public issue on the platform, or browse how other places solved problems
        like yours.
      </p>

      <div className="card mb-4">
        <input
          autoFocus
          className="input"
          placeholder="Search issues by keyword — e.g. streetlights, garbage, water supply…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap mt-3">
          <button
            onClick={() => setCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              category === '' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                category === c.value ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      {results !== null ? (
        <div>
          <h2 className="font-semibold text-sm text-gray-500 mb-2">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-4">
            {results.map((issue) => (
              <IssueFeedCard key={issue.id} issue={issue} />
            ))}
            {results.length === 0 && <p className="text-gray-500 text-center py-8">No matching issues found.</p>}
          </div>
        </div>
      ) : (
        <div>
          <h2 className="font-semibold text-navy mb-1">✅ Success Stories</h2>
          <p className="text-sm text-gray-500 mb-3">
            Issues that got resolved elsewhere — see how they did it, and take the idea back to
            your own ward.
          </p>
          {stories === null && <p className="text-gray-500">Loading…</p>}
          {stories?.length === 0 && <p className="text-gray-500">No resolved success stories yet — check back soon.</p>}
          <div className="space-y-4">
            {stories?.map((issue) => (
              <IssueFeedCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
