'use client';

const TABS = [
  { value: 'foryou', label: 'For You', icon: '🏠' },
  { value: 'trending', label: 'Trending', icon: '🔥' },
  { value: 'latest', label: 'Latest', icon: '🕐' },
];

export default function FeedTabs({ mode, setMode }) {
  return (
    <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-4">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setMode(tab.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
            mode === tab.value ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
