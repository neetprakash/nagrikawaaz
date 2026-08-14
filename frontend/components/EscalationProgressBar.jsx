'use client';

import { nextEscalationInfo, LEVEL_LABEL } from '../lib/escalation';

export default function EscalationProgressBar({ escalationLevel, voteCount, compact = false }) {
  const info = nextEscalationInfo(escalationLevel, voteCount);

  if (!info) {
    return (
      <div className={compact ? 'text-xs text-gray-500' : 'text-sm text-gray-500'}>
        🏁 Already at the highest tier — {LEVEL_LABEL.national} level.
      </div>
    );
  }

  const urgent = info.needed <= 20;

  return (
    <div>
      <div className={`flex justify-between ${compact ? 'text-xs' : 'text-sm'} mb-1`}>
        <span className={urgent ? 'font-semibold text-orange-600' : 'text-gray-600'}>
          {urgent ? '🔥 ' : ''}Only <b>{info.needed}</b> more to reach {LEVEL_LABEL[info.nextLevel]} level!
        </span>
        <span className="text-gray-400">{info.pct}%</span>
      </div>
      <div className={`bg-gray-100 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className={`h-full rounded-full transition-all ${urgent ? 'bg-orange-500' : 'bg-navy'}`}
          style={{ width: `${info.pct}%` }}
        />
      </div>
    </div>
  );
}
