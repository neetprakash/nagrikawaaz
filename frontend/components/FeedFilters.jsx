'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '../lib/api';

const SCOPE_TABS = [
  { value: '', label: 'All', icon: '🌐' },
  { value: 'ward', label: 'Locality', icon: '🏘️' },
  { value: 'district', label: 'District', icon: '🏙️' },
  { value: 'state', label: 'State', icon: '🗺️' },
  { value: 'national', label: 'Country', icon: '🇮🇳' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Newest', icon: '🆕' },
  { value: 'votes', label: 'Most supported', icon: '👍' },
];

function findCategory(value) {
  return CATEGORIES.find((c) => c.value === value);
}

function activeCount(scope, category, sort, hideSort) {
  let n = 0;
  if (scope) n++;
  if (category) n++;
  if (!hideSort && sort && sort !== 'recent') n++;
  return n;
}

export default function FeedFilters({ scope, setScope, category, setCategory, sort, setSort, hideSort }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = activeCount(scope, category, sort, hideSort);
  const activeCategory = findCategory(category);
  const activeScope = SCOPE_TABS.find((s) => s.value === (scope || '')) || SCOPE_TABS[0];

  return (
    <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur pb-3 pt-1" ref={ref}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
            open || count > 0
              ? 'bg-navy text-white border-navy'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <span aria-hidden>🎛️</span>
          <span>Filters</span>
          {count > 0 && (
            <span
              className={`text-[10px] rounded-full w-4 h-4 flex items-center justify-center ${
                open ? 'bg-white/20 text-white' : 'bg-navy text-white'
              }`}
              style={open ? {} : { background: 'white', color: 'rgb(15, 23, 42)' }}
            >
              {count}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="mt-2 bg-white rounded-xl border border-gray-200 shadow-lg p-3 space-y-4"
        >
          <Section
            title="Scope"
            hint="Where the issue is tagged"
          >
            <div className="grid grid-cols-5 gap-1.5">
              {SCOPE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setScope(tab.value)}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium border transition ${
                    (scope || '') === tab.value
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg leading-none">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Category"
            hint="What the issue is about"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <CategoryButton
                active={!category}
                onClick={() => setCategory('')}
                icon="✨"
                label="All"
              />
              {CATEGORIES.map((c) => (
                <CategoryButton
                  key={c.value}
                  active={category === c.value}
                  onClick={() => setCategory(c.value)}
                  icon={c.icon}
                  label={c.label}
                />
              ))}
            </div>
          </Section>

          {!hideSort && (
            <Section
              title="Sort"
              hint="How the feed is ordered"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSort(o.value)}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      (sort || 'recent') === o.value
                        ? 'bg-navy text-white border-navy'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{o.icon}</span>
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <div className="flex items-center justify-between pt-1 border-t">
            <p className="text-xs text-gray-500">
              {activeScope.label}
              {activeCategory ? ` · ${activeCategory.label}` : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                setScope('');
                setCategory('');
                if (!hideSort) setSort('recent');
              }}
              className="text-xs text-navy hover:underline"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function CategoryButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition text-left ${
        active
          ? 'bg-navy text-white border-navy'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}