const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// A logged-in official's dashboard: issues tagged to their level + constituency
router.get('/dashboard', authRequired, requireRole('official'), (req, res) => {
  const official = db
    .prepare('SELECT * FROM officials WHERE user_id = ? AND approved = 1')
    .get(req.user.id);
  if (!official) {
    return res.status(403).json({ error: 'No approved official profile for this account yet' });
  }

  const issues = db
    .prepare(
      `SELECT * FROM issues
       WHERE status = 'approved'
       AND escalation_level = ?
       AND (constituency_id = ? OR ? IS NULL)
       ORDER BY vote_count DESC`
    )
    .all(official.level, official.constituency_id, official.constituency_id);

  const analytics = {
    total_tagged: issues.length,
    by_category: groupCount(issues, 'category'),
    by_response_status: groupCount(issues, 'response_status'),
    top_by_votes: issues.slice(0, 5).map((i) => ({ id: i.id, title: i.title, votes: i.vote_count })),
  };

  res.json({ official, issues, analytics });
});

// Official responds to / updates status of an issue
router.post('/issues/:id/respond', authRequired, requireRole('official'), (req, res) => {
  const { status, message } = req.body;
  const valid = ['pending', 'under_review', 'action_taken', 'rejected'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  const official = db
    .prepare('SELECT * FROM officials WHERE user_id = ? AND approved = 1')
    .get(req.user.id);
  if (!official) return res.status(403).json({ error: 'No approved official profile' });

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  db.prepare(
    'INSERT INTO official_responses (issue_id, official_id, status, message) VALUES (?, ?, ?, ?)'
  ).run(issue.id, official.id, status, message || null);

  db.prepare('UPDATE issues SET response_status = ? WHERE id = ?').run(status, issue.id);

  res.json({ message: 'Response recorded and added to the public timeline.' });
});

// Public: list all constituencies, used by the profile page's manual picker when a
// PIN code doesn't match any seeded constituency.
router.get('/constituencies', (req, res) => {
  const constituencies = db.prepare('SELECT * FROM constituencies ORDER BY state, name').all();
  res.json({ constituencies });
});

// Public: MP / constituency profile
router.get('/constituency/:id', (req, res) => {
  const constituency = db.prepare('SELECT * FROM constituencies WHERE id = ?').get(req.params.id);
  if (!constituency) return res.status(404).json({ error: 'Constituency not found' });

  const topIssues = db
    .prepare(
      `SELECT * FROM issues WHERE constituency_id = ? AND status = 'approved'
       ORDER BY vote_count DESC LIMIT 10`
    )
    .all(constituency.id);

  res.json({ constituency, top_issues: topIssues });
});

function groupCount(rows, field) {
  return rows.reduce((acc, r) => {
    acc[r[field]] = (acc[r[field]] || 0) + 1;
    return acc;
  }, {});
}

module.exports = router;
