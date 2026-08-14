'use client';

export default function BadgeGrid({ earned = [], locked = [] }) {
  return (
    <div>
      {earned.length === 0 && locked.length === 0 && (
        <p className="text-sm text-gray-400">No badges yet — raise an issue or support one to start earning them.</p>
      )}

      {earned.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {earned.map((b) => (
            <div key={b.id} className="border border-gray-200 rounded-lg p-2.5 text-center bg-white">
              <div className="text-2xl">{b.icon}</div>
              <div className="text-xs font-semibold text-navy mt-1">{b.name}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{b.desc}</div>
            </div>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-400 mb-2">Not yet earned</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {locked.map((b) => (
              <div key={b.id} className="border border-dashed border-gray-200 rounded-lg p-2.5 text-center opacity-50">
                <div className="text-2xl grayscale">{b.icon}</div>
                <div className="text-xs font-semibold text-gray-500 mt-1">{b.name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{b.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
