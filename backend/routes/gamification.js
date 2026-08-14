const express = require('express');
const db = require('../db');
const { authRequired, optionalAuth } = require('../middleware/auth');
const { getStreakForUser, badgeForRank, getMilestoneBadges } = require('../utils/gamification');

const router = express.Router();

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Your own civic streak — consecutive weeks with at least one qualifying action
// (raised an issue, supported/voted, or commented).
router.get('/streak', authRequired, (req, res) => {
  res.json(getStreakForUser(req.user.id));
});

// Your own badges: lifetime milestones (kept once earned) + your current
// leaderboard rank badge for this month, if you're on the board.
router.get('/badges/me', authRequired, (req, res) => {
  const milestones = getMilestoneBadges(req.user.id);
  let rankBadge = null;

  if (req.user.constituency_id) {
    const board = buildLeaderboard(req.user.constituency_id, currentMonth());
    const entry = board.find((r) => r.id === req.user.id);
    if (entry) rankBadge = { ...badgeForRank(entry.rank), rank: entry.rank };
  }

  res.json({ ...milestones, rank_badge: rankBadge });
});

// "Top Watchdogs This Ward, This Month" — ranked by issues raised (weighted
// highest) + posts supported + comments, all within the given month. Badges
// are recomputed live from the current standings, never stored, so they
// genuinely transfer to whoever holds that rank right now.
router.get('/leaderboard', optionalAuth, (req, res) => {
  const month = req.query.month || currentMonth();
  const constituencyId = req.query.constituency_id
    ? Number(req.query.constituency_id)
    : req.user?.constituency_id;

  if (!constituencyId) {
    return res.status(400).json({
      error: 'constituency_id is required (or log in with a constituency set on your profile)',
    });
  }

  const constituency = db.prepare('SELECT * FROM constituencies WHERE id = ?').get(constituencyId);
  if (!constituency) return res.status(404).json({ error: 'Constituency not found' });

  const leaderboard = buildLeaderboard(constituencyId, month);
  const myRank = req.user ? leaderboard.find((r) => r.id === req.user.id)?.rank || null : null;

  res.json({ month, constituency, leaderboard, my_rank: myRank });
});

function buildLeaderboard(constituencyId, month) {
  const users = db
    .prepare("SELECT id, name, avatar_url FROM users WHERE constituency_id = ? AND role = 'citizen'")
    .all(constituencyId);

  const scored = users
    .map((u) => {
      const issues_posted = db
        .prepare("SELECT COUNT(*) c FROM issues WHERE user_id = ? AND strftime('%Y-%m', created_at) = ?")
        .get(u.id, month).c;
      const votes_cast = db
        .prepare("SELECT COUNT(*) c FROM votes WHERE user_id = ? AND strftime('%Y-%m', created_at) = ?")
        .get(u.id, month).c;
      const comments_made = db
        .prepare("SELECT COUNT(*) c FROM comments WHERE user_id = ? AND strftime('%Y-%m', created_at) = ?")
        .get(u.id, month).c;
      const score = issues_posted * 3 + votes_cast * 1 + comments_made * 1;
      return { id: u.id, name: u.name, avatar_url: u.avatar_url || null, issues_posted, votes_cast, comments_made, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return scored.map((r, idx) => ({ ...r, rank: idx + 1, badge: badgeForRank(idx + 1) }));
}

module.exports = router;
