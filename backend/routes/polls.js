const express = require('express');
const db = require('../db');
const { authRequired, requireVerified } = require('../middleware/auth');

const router = express.Router();

// --- Polls ---
router.post('/polls', authRequired, requireVerified, (req, res) => {
  const { title, options, scope, constituency_id } = req.body;
  if (!title || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'title and at least 2 options are required' });
  }
  const info = db
    .prepare(
      'INSERT INTO polls (title, options, scope, constituency_id, created_by) VALUES (?, ?, ?, ?, ?)'
    )
    .run(title, JSON.stringify(options), scope || 'national', constituency_id || null, req.user.id);
  res.status(201).json({ poll_id: info.lastInsertRowid });
});

router.get('/polls', (req, res) => {
  const { scope, constituency_id } = req.query;
  let query = 'SELECT * FROM polls WHERE 1=1';
  const params = [];
  if (scope) {
    query += ' AND scope = ?';
    params.push(scope);
  }
  if (constituency_id) {
    query += ' AND constituency_id = ?';
    params.push(constituency_id);
  }
  query += ' ORDER BY created_at DESC';
  const polls = db.prepare(query).all(...params);
  const withResults = polls.map((p) => ({ ...p, options: JSON.parse(p.options), results: pollResults(p.id) }));
  res.json({ polls: withResults });
});

router.post('/polls/:id/vote', authRequired, requireVerified, (req, res) => {
  const { option_index } = req.body;
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  const options = JSON.parse(poll.options);
  if (option_index == null || option_index < 0 || option_index >= options.length) {
    return res.status(400).json({ error: 'Invalid option_index' });
  }
  try {
    db.prepare('INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)').run(
      poll.id,
      req.user.id,
      option_index
    );
  } catch (e) {
    return res.status(409).json({ error: 'You already voted on this poll' });
  }
  res.json({ results: pollResults(poll.id) });
});

function pollResults(pollId) {
  return db
    .prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index')
    .all(pollId);
}

// --- Petitions ---
router.post('/petitions', authRequired, requireVerified, (req, res) => {
  const { title, description, target_signatures, scope, constituency_id } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  const info = db
    .prepare(
      `INSERT INTO petitions (title, description, target_signatures, scope, constituency_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      description,
      target_signatures || 10000,
      scope || 'national',
      constituency_id || null,
      req.user.id
    );
  res.status(201).json({ petition_id: info.lastInsertRowid });
});

router.get('/petitions', (req, res) => {
  const petitions = db.prepare('SELECT * FROM petitions ORDER BY created_at DESC').all();
  const withCounts = petitions.map((p) => ({
    ...p,
    signature_count: db
      .prepare('SELECT COUNT(*) as c FROM petition_signatures WHERE petition_id = ?')
      .get(p.id).c,
  }));
  res.json({ petitions: withCounts });
});

router.post('/petitions/:id/sign', authRequired, requireVerified, (req, res) => {
  const petition = db.prepare('SELECT * FROM petitions WHERE id = ?').get(req.params.id);
  if (!petition) return res.status(404).json({ error: 'Petition not found' });
  try {
    db.prepare('INSERT INTO petition_signatures (petition_id, user_id) VALUES (?, ?)').run(
      petition.id,
      req.user.id
    );
  } catch (e) {
    return res.status(409).json({ error: 'You already signed this petition' });
  }
  const count = db
    .prepare('SELECT COUNT(*) as c FROM petition_signatures WHERE petition_id = ?')
    .get(petition.id).c;

  if (count >= petition.target_signatures) {
    // In production: trigger notification to the MP's office / MyGov integration.
    console.log(`[PETITION] "${petition.title}" reached its target of ${petition.target_signatures} signatures.`);
  }
  res.json({ signature_count: count, target_reached: count >= petition.target_signatures });
});

module.exports = router;
