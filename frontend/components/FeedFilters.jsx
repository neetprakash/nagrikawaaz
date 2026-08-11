'use client';

import { CATEGORIES } from '../lib/api';

const SCOPE_TABS = [
  { value: '', label: 'All' },
  { value: 'ward', label: 'Locality' },
  { value: 'district', label: 'District' },
  { value: 'state', label: 'State' },
  { value: 'national', label: 'Country' },
];

export default function FeedFilters({ scope, setScope, category, setCategory, sort, setSort, hideSort }) {
  return (
    <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur pb-3 pt-1">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setScope(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              scope === tab.value
                ? 'bg-navy text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <select className="input w-auto text-sm py-1.5" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {!hideSort && (
          <select className="input w-auto text-sm py-1.5" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Newest</option>
            <option value="votes">Most supported</option>
          </select>
        )}
      </div>
    </div>
  );
}
