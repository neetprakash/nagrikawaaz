const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Posts land here only after being community-flagged past the report threshold
// (see POST /api/issues/:id/report) — this is review of reported content, not
// pre-publish approval. Everything is live the moment a citizen posts it.
router.get('/queue', authRequired, requireRole('moderator', 'admin'), (req, res) => {
  const issues = db
    .prepare(
      `SELECT issues.*, users.name as author_name FROM issues
       JOIN users ON users.id = issues.user_id
       WHERE issues.status = 'under_review' ORDER BY issues.report_count DESC, issues.created_at ASC`
    )
    .all();

  const withReasons = issues.map((issue) => {
    const reports = db
      .prepare(
        `SELECT reports.reason, users.name as reporter_name FROM reports
         JOIN users ON users.id = reports.user_id
         WHERE reports.issue_id = ? ORDER BY reports.created_at DESC LIMIT 5`
      )
      .all(issue.id);
    return { ...issue, recent_reports: reports };
  });

  res.json({ issues: withReasons });
});

// Reinstate a reported post that turns out to be legitimate.
router.post('/:id/approve', authRequired, requireRole('moderator', 'admin'), (req, res) => {
  const result = db
    .prepare("UPDATE issues SET status = 'active', report_count = 0 WHERE id = ? AND status = 'under_review'")
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Issue not found or already actioned' });
  res.json({ message: 'Post reinstated and visible again.' });
});

// Confirm the reports were valid — remove the post permanently.
router.post('/:id/reject', authRequired, requireRole('moderator', 'admin'), (req, res) => {
  const { reason } = req.body;
  const result = db
    .prepare("UPDATE issues SET status = 'removed' WHERE id = ? AND status = 'under_review'")
    .run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Issue not found or already actioned' });
  if (reason) {
    db.prepare(
      'INSERT INTO comments (issue_id, user_id, body) VALUES (?, ?, ?)'
    ).run(req.params.id, req.user.id, `[Moderator removal reason] ${reason}`);
  }
  res.json({ message: 'Post removed.' });
});

module.exports = router;
