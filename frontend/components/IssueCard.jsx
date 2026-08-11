import Link from 'next/link';
import { CATEGORIES } from '../lib/api';

export default function IssueCard({ issue }) {
  const categoryLabel = CATEGORIES.find((c) => c.value === issue.category)?.label || issue.category;

  return (
    <Link href={`/issues/${issue.id}`} className="card block hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-navy">{issue.title}</h3>
        <span className={`badge badge-${issue.escalation_level}`}>{issue.escalation_level}</span>
      </div>
      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{issue.description}</p>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
        <span>{categoryLabel}</span>
        <span>•</span>
        <span>{issue.scope}</span>
        <span>•</span>
        <span className={`badge status-${issue.response_status}`}>{issue.response_status.replace('_', ' ')}</span>
        <span className="ml-auto font-semibold text-navy">▲ {issue.vote_count} votes</span>
      </div>
    </Link>
  );
}
