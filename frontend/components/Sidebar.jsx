'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, CATEGORIES } from '../lib/api';

const NEXT_THRESHOLD = { ward: 1000, city: 10000, state: 50000, national: null };
const LEVEL_LABEL = { ward: 'Locality', city: 'City', state: 'State', national: 'Country' };

export default function Sidebar() {
  const [trending, setTrending] = useState(null);
  const [latest, setLatest] = useState(null);
  const [closeToEscalation, setCloseToEscalation] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [trendingRes, latestRes] = await Promise.all([
        api.listIssues({ status: 'active', sort: 'votes', limit: 5 }),
        api.listIssues({ status: 'active', sort: 'recent', limit: 5 }),
      ]);
      setTrending(trendingRes.issues);
      setLatest(latestRes.issues);

      const watchable = trendingRes.issues
        .filter((i) => NEXT_THRESHOLD[i.escalation_level])
        .map((i) => ({ ...i, needed: NEXT_THRESHOLD[i.escalation_level] - i.vote_count }))
        .filter((i) => i.needed > 0 && i.needed <= 50)
        .sort((a, b) => a.needed - b.needed)
        .slice(0, 3);
      setCloseToEscalation(watchable);
    } catch {
      setTrending([]);
      setLatest([]);
      setCloseToEscalation([]);
    }
  }

  return (
    <aside className="space-y-4 w-full lg:w-72 shrink-0">
      <Widget title="🔥 Trending Now" items={trending} emptyText="Nothing trending yet.">
        {(issue) => (
          <MiniRow key={issue.id} issue={issue} metric={`${issue.vote_count} 👍`} />
        )}
      </Widget>

      {closeToEscalation?.length > 0 && (
        <Widget title="📈 About to Escalate" items={closeToEscalation} emptyText="">
          {(issue) => (
            <MiniRow
              key={issue.id}
              issue={issue}
              metric={`${issue.needed} more → ${LEVEL_LABEL[NEXT_LEVEL_AFTER(issue.escalation_level)] || ''}`}
            />
          )}
        </Widget>
      )}

      <Widget title="🕐 Latest Activity" items={latest} emptyText="No recent posts.">
        {(issue) => <MiniRow key={issue.id} issue={issue} metric="new" />}
      </Widget>
    </aside>
  );
}

function NEXT_LEVEL_AFTER(level) {
  const order = ['ward', 'city', 'state', 'national'];
  return order[order.indexOf(level) + 1];
}

function Widget({ title, items, emptyText, children }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-sm text-navy mb-3">{title}</h3>
      {items === null && <p className="text-xs text-gray-400">Loading…</p>}
      {items?.length === 0 && emptyText && <p className="text-xs text-gray-400">{emptyText}</p>}
      <div className="space-y-2.5">{items?.map(children)}</div>
    </div>
  );
}

function MiniRow({ issue, metric }) {
  const categoryLabel = CATEGORIES.find((c) => c.value === issue.category)?.label || issue.category;
  return (
    <Link href={`/issues/${issue.id}`} className="flex items-start gap-2 group">
      <span className={`badge badge-${issue.escalation_level} mt-0.5 shrink-0`}>{issue.escalation_level[0].toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 group-hover:text-navy truncate">{issue.title}</p>
        <p className="text-xs text-gray-400">{categoryLabel} · {metric}</p>
      </div>
    </Link>
  );
}
