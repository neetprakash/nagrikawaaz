const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authRequired, requireVerified, optionalAuth } = require('../middleware/auth');
const { evaluateEscalation } = require('../utils/escalation');

const router = express.Router();

const CATEGORIES = [
  'aqi',
  'education',
  'roads',
  'electricity_water',
  'governance_corruption',
  'health',
  'law_order',
];
const SCOPES = ['ward', 'district', 'state', 'national'];

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const REPORT_THRESHOLD = 5; // reports needed before a post is auto-flagged for moderator review

// Create an issue -> live immediately (Instagram/Facebook style). Community reports,
// not pre-publish moderation, are what can pull a post down — see POST /:id/report.
router.post('/', authRequired, requireVerified, (req, res) => {
  const { title, description, category, scope, since_when, affected_group, anonymous } = req.body;

  if (!title || !description || !category || !scope) {
    return res.status(400).json({ error: 'title, description, category, scope are required' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (!SCOPES.includes(scope)) {
    return res.status(400).json({ error: `scope must be one of: ${SCOPES.join(', ')}` });
  }

  const info = db
    .prepare(
      `INSERT INTO issues
       (user_id, title, description, category, scope, constituency_id, anonymous, since_when, affected_group, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    )
    .run(
      req.user.id,
      title,
      description,
      category,
      scope,
      req.user.constituency_id || null,
      anonymous ? 1 : 0,
      since_when || null,
      affected_group || null
    );

  res.status(201).json({
    message: 'Posted! Your issue is live on the platform now.',
    issue_id: info.lastInsertRowid,
  });
});

// Report/flag a post as spam or abusive. One report per user per issue. Crossing the
// threshold pulls it from the public feed and drops it into the moderator review queue —
// community-driven moderation instead of pre-publish gatekeeping.
router.post('/:id/report', authRequired, requireVerified, (req, res) => {
  const { reason } = req.body;
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  if (issue.user_id === req.user.id) {
    return res.status(400).json({ error: "You can't report your own post" });
  }

  try {
    db.prepare('INSERT INTO reports (issue_id, user_id, reason) VALUES (?, ?, ?)').run(
      issue.id,
      req.user.id,
      reason || null
    );
  } catch (e) {
    return res.status(409).json({ error: 'You already reported this post' });
  }

  db.prepare('UPDATE issues SET report_count = report_count + 1 WHERE id = ?').run(issue.id);
  const updated = db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id);

  let flagged = false;
  if (updated.report_count >= REPORT_THRESHOLD && updated.status === 'active') {
    db.prepare("UPDATE issues SET status = 'under_review' WHERE id = ?").run(issue.id);
    flagged = true;
  }

  res.json({
    message: flagged
      ? 'Report received. This post has been flagged enough times to be pulled for moderator review.'
      : 'Report received. Thank you for helping keep the platform clean.',
    report_count: updated.report_count,
    flagged,
  });
});

// Upload evidence for an issue (must be the issue's author)
router.post('/:id/evidence', authRequired, upload.single('file'), (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  if (issue.user_id !== req.user.id) return res.status(403).json({ error: 'Not your issue' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileUrl = `/uploads/${req.file.filename}`;
  db.prepare('INSERT INTO evidence (issue_id, file_url, file_type) VALUES (?, ?, ?)').run(
    issue.id,
    fileUrl,
    req.file.mimetype
  );
  res.status(201).json({ file_url: fileUrl });
});

const LIST_SELECT = `
  SELECT issues.*,
         users.name as author_name,
         users.avatar_url as author_avatar_url,
         constituencies.name as constituency_name,
         constituencies.district as district,
         constituencies.state as state,
         constituencies.mp_name as mp_name,
         (SELECT COUNT(*) FROM comments WHERE comments.issue_id = issues.id) as comment_count,
         (SELECT COUNT(*) FROM evidence WHERE evidence.issue_id = issues.id) as evidence_count
  FROM issues
  JOIN users ON users.id = issues.user_id
  LEFT JOIN constituencies ON constituencies.id = issues.constituency_id
`;

// A logged-in citizen's own submissions, regardless of moderation status —
// so "why isn't my issue showing?" always has a self-serve answer.
router.get('/mine', authRequired, (req, res) => {
  const issues = db
    .prepare(`${LIST_SELECT} WHERE issues.user_id = ? ORDER BY issues.created_at DESC`)
    .all(req.user.id);
  res.json({ issues: issues.map((i) => withAuthorPrivacy(i, req.user)) });
});

// List issues with filters. sort: recent | votes. feed=foryou blends the caller's own
// constituency with high-support issues so a logged-in citizen's default feed isn't empty
// just because their local area is quiet yet.
router.get('/', optionalAuth, (req, res) => {
  const { scope, category, constituency_id, state, status = 'active', sort = 'recent', feed, limit } = req.query;

  let query = `${LIST_SELECT} WHERE issues.status = ?`;
  const params = [status];

  if (scope) {
    query += ' AND issues.scope = ?';
    params.push(scope);
  }
  if (category) {
    query += ' AND issues.category = ?';
    params.push(category);
  }
  if (constituency_id) {
    query += ' AND issues.constituency_id = ?';
    params.push(constituency_id);
  }
  if (state) {
    query += ' AND constituencies.state = ?';
    params.push(state);
  }

  if (feed === 'foryou' && req.user?.constituency_id) {
    query += ' AND (issues.constituency_id = ? OR issues.vote_count >= 3)';
    params.push(req.user.constituency_id);
  }

  query += sort === 'votes' ? ' ORDER BY issues.vote_count DESC' : ' ORDER BY issues.created_at DESC';
  if (limit) {
    query += ' LIMIT ?';
    params.push(Number(limit));
  }

  const issues = db.prepare(query).all(...params);
  const userVotedIds = req.user
    ? new Set(
        db
          .prepare('SELECT issue_id FROM votes WHERE user_id = ?')
          .all(req.user.id)
          .map((v) => v.issue_id)
      )
    : new Set();
  const userReportedIds = req.user
    ? new Set(
        db
          .prepare('SELECT issue_id FROM reports WHERE user_id = ?')
          .all(req.user.id)
          .map((r) => r.issue_id)
      )
    : new Set();

  res.json({
    issues: issues.map((i) => ({
      ...withAuthorPrivacy(i, req.user),
      has_voted: userVotedIds.has(i.id),
      has_reported: userReportedIds.has(i.id),
    })),
  });
});

router.get('/:id', optionalAuth, (req, res) => {
  const issue = db.prepare(`${LIST_SELECT} WHERE issues.id = ?`).get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  const evidence = db.prepare('SELECT * FROM evidence WHERE issue_id = ?').all(issue.id);
  const comments = db
    .prepare(
      `SELECT comments.*, users.name as author_name, users.avatar_url as author_avatar_url
       FROM comments
       JOIN users ON users.id = comments.user_id
       WHERE issue_id = ? ORDER BY comments.created_at ASC`
    )
    .all(issue.id);
  const responses = db
    .prepare(
      `SELECT official_responses.*, officials.designation, officials.level
       FROM official_responses
       JOIN officials ON officials.id = official_responses.official_id
       WHERE issue_id = ? ORDER BY official_responses.created_at ASC`
    )
    .all(issue.id);
  const escalations = db
    .prepare('SELECT * FROM escalation_log WHERE issue_id = ? ORDER BY notified_at ASC')
    .all(issue.id);

  const hasVoted = req.user
    ? !!db.prepare('SELECT 1 FROM votes WHERE issue_id = ? AND user_id = ?').get(issue.id, req.user.id)
    : false;
  const hasReported = req.user
    ? !!db.prepare('SELECT 1 FROM reports WHERE issue_id = ? AND user_id = ?').get(issue.id, req.user.id)
    : false;

  res.json({
    issue: { ...withAuthorPrivacy(issue, req.user), has_voted: hasVoted, has_reported: hasReported },
    evidence,
    comments,
    responses,
    escalations,
  });
});

// Vote on an issue — one verified user, one vote, geo-restricted to their constituency
// for ward/district scope issues (state/national open to all verified users).
router.post('/:id/vote', authRequired, requireVerified, (req, res) => {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  if (issue.status !== 'active') {
    return res.status(400).json({ error: 'This issue is not currently open for voting' });
  }

  if (['ward', 'district'].includes(issue.scope)) {
    if (!req.user.constituency_id || req.user.constituency_id !== issue.constituency_id) {
      return res.status(403).json({ error: 'Only users from the affected area can vote on this issue' });
    }
  }

  try {
    db.prepare('INSERT INTO votes (issue_id, user_id) VALUES (?, ?)').run(issue.id, req.user.id);
  } catch (e) {
    return res.status(409).json({ error: 'You have already voted on this issue' });
  }

  db.prepare('UPDATE issues SET vote_count = vote_count + 1 WHERE id = ?').run(issue.id);
  const newLevel = evaluateEscalation(issue.id);
  const updated = db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id);

  res.json({ vote_count: updated.vote_count, escalation_level: newLevel });
});

router.post('/:id/comments', authRequired, requireVerified, (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  db.prepare('INSERT INTO comments (issue_id, user_id, body) VALUES (?, ?, ?)').run(
    issue.id,
    req.user.id,
    body
  );
  res.status(201).json({ message: 'Comment added' });
});

function withAuthorPrivacy(issue, requestingUser) {
  if (issue.anonymous && (!requestingUser || requestingUser.id !== issue.user_id)) {
    const { user_id, author_name, author_avatar_url, ...rest } = issue;
    return { ...rest, author_name: 'Anonymous', author_avatar_url: null };
  }
  return issue;
}

module.exports = router;
