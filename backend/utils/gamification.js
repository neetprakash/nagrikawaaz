const db = require('../db');

// --- Streak calculation -----------------------------------------------------
// A "civic streak" counts consecutive weeks in which a user did at least one
// qualifying action: raised an issue, voted (supported a post), or commented.
// We key weeks by the ISO Monday of that week (as a date string) rather than
// ISO week numbers — it sidesteps year-boundary edge cases and adjacency is
// just "exactly 7 days apart", which is simple and correct.

function mondayOf(date) {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function weekKey(dateStr) {
  const iso = dateStr.includes('T') || dateStr.includes('Z') ? dateStr : `${dateStr}Z`;
  return mondayOf(new Date(iso)).toISOString().slice(0, 10);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function computeStreaks(sortedWeekKeysDesc) {
  if (sortedWeekKeysDesc.length === 0) return { current: 0, longest: 0, active_weeks: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedWeekKeysDesc.length; i++) {
    const diff = (new Date(sortedWeekKeysDesc[i - 1]) - new Date(sortedWeekKeysDesc[i])) / WEEK_MS;
    if (diff === 1) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);

  // Current streak only counts if the most recent active week is this week or
  // last week — otherwise the streak has already lapsed and shows as 0, not
  // whatever it was before it broke.
  let current = 0;
  const thisWeekKey = mondayOf(new Date()).toISOString().slice(0, 10);
  const gapFromNow = (new Date(thisWeekKey) - new Date(sortedWeekKeysDesc[0])) / WEEK_MS;
  if (gapFromNow <= 1) {
    current = 1;
    for (let i = 1; i < sortedWeekKeysDesc.length; i++) {
      const diff = (new Date(sortedWeekKeysDesc[i - 1]) - new Date(sortedWeekKeysDesc[i])) / WEEK_MS;
      if (diff === 1) current++;
      else break;
    }
  }

  return { current, longest, active_weeks: sortedWeekKeysDesc.length };
}

function getStreakForUser(userId) {
  const rows = db
    .prepare(
      `SELECT created_at FROM votes WHERE user_id = ?
       UNION ALL SELECT created_at FROM issues WHERE user_id = ?
       UNION ALL SELECT created_at FROM comments WHERE user_id = ?`
    )
    .all(userId, userId, userId);

  const weeks = [...new Set(rows.map((r) => weekKey(r.created_at)))].sort().reverse();
  const { current, longest, active_weeks } = computeStreaks(weeks);
  return { current_streak_weeks: current, longest_streak_weeks: longest, active_weeks };
}

// --- Leaderboard rank badges --------------------------------------------------
// These are intentionally *not* stored anywhere — they're recomputed from the
// live leaderboard query every time, so the badge genuinely transfers to
// whoever holds that rank this month. No stale "still shows as champion after
// falling to #8" bugs possible, because there's no persisted state to go stale.
const RANK_BADGES = [
  { name: 'Mohalla Champion', icon: '🏆', tier: 'gold' },
  { name: 'Civic Sentinel', icon: '🥈', tier: 'silver' },
  { name: 'Watchdog Elite', icon: '🥉', tier: 'bronze' },
];

function badgeForRank(rank) {
  if (rank >= 1 && rank <= 3) return RANK_BADGES[rank - 1];
  if (rank <= 10) return { name: 'Rising Watchdog', icon: '🎖️', tier: 'active' };
  return null;
}

// --- Lifetime milestone badges ------------------------------------------------
// Unlike rank badges, these are earned once and kept — they reward sustained
// participation rather than this month's ranking. Also computed live from
// existing tables; nothing new to persist or keep in sync.
function getMilestoneBadges(userId) {
  const issues_posted = db.prepare('SELECT COUNT(*) c FROM issues WHERE user_id = ?').get(userId).c;
  const votes_cast = db.prepare('SELECT COUNT(*) c FROM votes WHERE user_id = ?').get(userId).c;
  const comments_made = db.prepare('SELECT COUNT(*) c FROM comments WHERE user_id = ?').get(userId).c;
  const escalated = db
    .prepare(
      "SELECT COUNT(*) c FROM issues WHERE user_id = ? AND escalation_level IN ('city','state','national')"
    )
    .get(userId).c;
  const { current_streak_weeks, longest_streak_weeks } = getStreakForUser(userId);

  const catalogue = [
    { id: 'first_alarm', name: 'First Alarm', icon: '🚨', desc: 'Raised your first issue', earned: issues_posted >= 1 },
    { id: 'trailblazer', name: 'Trailblazer', icon: '🧭', desc: 'Raised 10+ issues', earned: issues_posted >= 10 },
    { id: 'power_voter', name: 'Power Voter', icon: '⚡', desc: 'Supported 25+ posts', earned: votes_cast >= 25 },
    { id: 'town_crier', name: 'Town Crier', icon: '📣', desc: 'Left 20+ comments', earned: comments_made >= 20 },
    { id: 'escalation_starter', name: 'Escalation Starter', icon: '🚀', desc: 'An issue you raised broke out of your ward', earned: escalated >= 1 },
    { id: 'streak_keeper', name: 'Streak Keeper', icon: '🔥', desc: '4-week civic streak', earned: longest_streak_weeks >= 4 },
    { id: 'marathoner', name: 'Civic Marathoner', icon: '🏅', desc: '12-week civic streak', earned: longest_streak_weeks >= 12 },
  ];

  return {
    earned: catalogue.filter((b) => b.earned),
    locked: catalogue.filter((b) => !b.earned),
    stats: { issues_posted, votes_cast, comments_made, escalated, current_streak_weeks, longest_streak_weeks },
  };
}

module.exports = { getStreakForUser, badgeForRank, getMilestoneBadges, weekKey };
