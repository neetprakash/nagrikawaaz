const express = require('express');
const db = require('../db');
const { authRequired, requireVerified } = require('../middleware/auth');
const { pushToUser, areConnected } = require('../ws');

const router = express.Router();

const USER_PUBLIC = `id, name, phone, avatar_url, role, verified, constituency_id`;

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    avatar_url: u.avatar_url,
    role: u.role,
    verified: !!u.verified,
    constituency_id: u.constituency_id,
  };
}

function getConnectionState(userId, otherId) {
  if (!otherId || userId === otherId) return { state: 'self' };
  if (areConnected(userId, otherId)) return { state: 'connected' };
  const out = db
    .prepare(
      `SELECT id, status FROM connection_requests
       WHERE requester_id = ? AND addressee_id = ?
       LIMIT 1`
    )
    .get(userId, otherId);
  if (out?.status === 'pending') return { state: 'outgoing_pending', request_id: out.id };
  if (out?.status === 'declined') return { state: 'outgoing_declined', request_id: out.id };
  const incoming = db
    .prepare(
      `SELECT id, status FROM connection_requests
       WHERE requester_id = ? AND addressee_id = ?
       LIMIT 1`
    )
    .get(otherId, userId);
  if (incoming?.status === 'pending') return { state: 'incoming_pending', request_id: incoming.id };
  if (incoming?.status === 'declined') return { state: 'incoming_declined', request_id: incoming.id };
  return { state: 'none' };
}

// Global search — verified citizens only, name prefix match, excludes self.
// Public: anyone signed-in can search anyone in the directory. Verified-only
// is the gate on the *result set* (social.js: search) so the directory can't
// be used to enumerate unverified-bot accounts.
router.get('/search', authRequired, (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 1) return res.json({ results: [] });
  const pattern = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT ${USER_PUBLIC} FROM users
       WHERE verified = 1
         AND id != ?
         AND (name LIKE ? OR phone LIKE ?)
       ORDER BY name ASC
       LIMIT 12`
    )
    .all(req.user.id, pattern, pattern);
  const results = rows.map((u) => ({
    ...publicUser(u),
    connection: getConnectionState(req.user.id, u.id),
  }));
  res.json({ results });
});

// Send a connection request to user_id
router.post('/connect', authRequired, (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  if (user_id === req.user.id) return res.status(400).json({ error: "Can't connect with yourself" });
  const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(user_id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const existing = db
    .prepare(
      `SELECT * FROM connection_requests
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)
       LIMIT 1`
    )
    .get(req.user.id, user_id, user_id, req.user.id);

  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already connected' });
    if (existing.status === 'pending') return res.status(409).json({ error: 'A request already exists' });
    // Declined — flip back to pending in the same direction
    db.prepare(
      `UPDATE connection_requests SET status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(existing.id);
    return res.json({ message: 'Request re-sent.', request_id: existing.id, recipient: target });
  }

  const info = db
    .prepare(
      `INSERT INTO connection_requests (requester_id, addressee_id, status)
       VALUES (?, ?, 'pending')`
    )
    .run(req.user.id, user_id);

  // Notify the addressee over the WebSocket if they're connected.
  pushToUser(user_id, {
    type: 'connection_request',
    request: {
      id: info.lastInsertRowid,
      from: publicUser({ id: req.user.id, name: req.user.name, avatar_url: req.user.avatar_url }),
    },
  });

  res.status(201).json({ message: 'Request sent.', request_id: info.lastInsertRowid, recipient: target });
});

// Accept / decline — only the addressee.
function setRequestStatus(req, res, newStatus) {
  const { request_id } = req.body;
  if (!request_id) return res.status(400).json({ error: 'request_id is required' });
  const row = db.prepare('SELECT * FROM connection_requests WHERE id = ?').get(request_id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (row.addressee_id !== req.user.id) return res.status(403).json({ error: 'Not your request to answer' });
  if (row.status !== 'pending') return res.status(409).json({ error: `Request already ${row.status}` });

  db.prepare(
    `UPDATE connection_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(newStatus, request_id);

  if (newStatus === 'accepted') {
    pushToUser(row.requester_id, {
      type: 'connection_accepted',
      by: publicUser({ id: req.user.id, name: req.user.name, avatar_url: req.user.avatar_url }),
    });
  }

  res.json({ message: `Request ${newStatus}.` });
}

router.post('/accept', authRequired, (req, res) => setRequestStatus(req, res, 'accepted'));
router.post('/decline', authRequired, (req, res) => setRequestStatus(req, res, 'declined'));

// In-bound pending requests the caller needs to act on.
router.get('/pending', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT cr.id as request_id, cr.created_at,
              u.id, u.name, u.phone, u.avatar_url, u.role, u.verified, u.constituency_id
       FROM connection_requests cr
       JOIN users u ON u.id = cr.requester_id
       WHERE cr.addressee_id = ? AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`
    )
    .all(req.user.id);
  res.json({ requests: rows.map((r) => ({ request_id: r.request_id, sent_at: r.created_at, user: publicUser(r) })) });
});

// Out-bound pending requests the caller has sent (so the UI can show "Requested").
router.get('/outgoing', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT cr.id as request_id, cr.created_at, cr.status,
              u.id, u.name, u.phone, u.avatar_url, u.role, u.verified, u.constituency_id
       FROM connection_requests cr
       JOIN users u ON u.id = cr.addressee_id
       WHERE cr.requester_id = ? AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`
    )
    .all(req.user.id);
  res.json({
    requests: rows.map((r) => ({
      request_id: r.request_id,
      sent_at: r.created_at,
      status: r.status,
      user: publicUser(r),
    })),
  });
});

// Accepted connections — the directory the profile page shows.
router.get('/connections', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.phone, u.avatar_url, u.role, u.verified, u.constituency_id,
              cr.created_at as connected_at
       FROM connection_requests cr
       JOIN users u ON u.id = CASE
         WHEN cr.requester_id = ? THEN cr.addressee_id
         ELSE cr.requester_id
       END
       WHERE cr.status = 'accepted'
         AND (cr.requester_id = ? OR cr.addressee_id = ?)
       ORDER BY u.name ASC`
    )
    .all(req.user.id, req.user.id, req.user.id);
  res.json({ connections: rows.map((r) => ({ ...publicUser(r), connected_at: r.connected_at })) });
});

// Inbox summaries — one row per conversation the caller is part of.
router.get('/threads', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, u.id as other_id, u.name as other_name, u.phone as other_phone,
              u.avatar_url as other_avatar_url, u.role as other_role, u.verified as other_verified,
              u.constituency_id as other_constituency_id
       FROM messages m
       JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
       WHERE m.sender_id = ? OR m.recipient_id = ?
       ORDER BY m.created_at DESC`
    )
    .all(req.user.id, req.user.id, req.user.id);

  const seen = new Set();
  const threads = [];
  for (const r of rows) {
    if (seen.has(r.other_id)) continue;
    seen.add(r.other_id);
    const unread = db
      .prepare(
        `SELECT COUNT(*) as c FROM messages
         WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`
      )
      .get(r.other_id, req.user.id).c;
    threads.push({
      other_user: {
        id: r.other_id,
        name: r.other_name,
        phone: r.other_phone,
        avatar_url: r.other_avatar_url,
        role: r.other_role,
        verified: !!r.other_verified,
        constituency_id: r.other_constituency_id,
      },
      last_message: {
        id: r.id,
        body: r.body,
        sender_id: r.sender_id,
        recipient_id: r.recipient_id,
        created_at: r.created_at,
        read_at: r.read_at,
      },
      unread_count: unread,
    });
  }
  res.json({ threads });
});

// Full thread with one other user.
router.get('/messages', authRequired, requireVerified, (req, res) => {
  const otherId = Number(req.query.with);
  if (!otherId) return res.status(400).json({ error: 'with (user_id) is required' });
  if (!areConnected(req.user.id, otherId)) {
    return res.status(403).json({ error: 'You can only view messages with connected users' });
  }
  const messages = db
    .prepare(
      `SELECT id, sender_id, recipient_id, body, read_at, created_at
       FROM messages
       WHERE (sender_id = ? AND recipient_id = ?)
          OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC`
    )
    .all(req.user.id, otherId, otherId, req.user.id);

  // Mark inbound messages read on the recipient's first read.
  db.prepare(
    `UPDATE messages SET read_at = CURRENT_TIMESTAMP
     WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL`
  ).run(req.user.id, otherId);

  res.json({ messages });
});

// Aggregated activity feed for the bell-icon dropdown on the nav bar. Combines
// incoming connection requests, acceptances, new posts by the caller's
// connections, and new posts in the caller's constituency from non-connected
// citizens (so the feed doubles as a local discovery surface). Read/unread state
// is tracked client-side in localStorage for the MVP — we don't need a
// notifications table for that yet.
router.get('/notifications', authRequired, (req, res) => {
  const SINCE_DAYS = 7;
  const SINCE = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const me = req.user.id;

  const connectionIds = db
    .prepare(
      `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as other
       FROM connection_requests
       WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`
    )
    .all(me, me, me)
    .map((r) => r.other);

  const items = [];

  // 1. Pending incoming connection requests
  const pendingRows = db
    .prepare(
      `SELECT cr.id as request_id, cr.created_at,
              u.id, u.name, u.phone, u.avatar_url, u.role, u.verified, u.constituency_id
       FROM connection_requests cr
       JOIN users u ON u.id = cr.requester_id
       WHERE cr.addressee_id = ? AND cr.status = 'pending'`
    )
    .all(me);
  for (const r of pendingRows) {
    items.push({
      id: `cr-${r.request_id}`,
      type: 'connection_request',
      actor: publicUser(r),
      verb: 'requested to connect with you',
      target_type: 'user',
      target_id: r.id,
      target_url: `/inbox/${r.id}`,
      context_title: null,
      created_at: r.created_at,
    });
  }

  // 2. Recent acceptances (someone accepted my request)
  if (connectionIds.length > 0) {
    const acceptedRows = db
      .prepare(
        `SELECT cr.id, cr.updated_at as created_at,
                u.id, u.name, u.phone, u.avatar_url, u.role, u.verified, u.constituency_id
         FROM connection_requests cr
         JOIN users u ON u.id = cr.addressee_id
         WHERE cr.requester_id = ? AND cr.status = 'accepted' AND cr.updated_at >= ?
         ORDER BY cr.updated_at DESC
         LIMIT 25`
      )
      .all(me, SINCE);
    for (const r of acceptedRows) {
      items.push({
        id: `accepted-${r.id}`,
        type: 'connection_accepted',
        actor: publicUser(r),
        verb: 'accepted your connection request',
        target_type: 'user',
        target_id: r.id,
        target_url: `/inbox/${r.id}`,
        context_title: null,
        created_at: r.created_at,
      });
    }
  }

  // 3. New issues by connections
  if (connectionIds.length > 0) {
    const placeholders = connectionIds.map(() => '?').join(',');
    const issueRows = db
      .prepare(
        `SELECT issues.id, issues.title, issues.created_at,
                users.id as uid, users.name, users.phone, users.avatar_url,
                users.role, users.verified, users.constituency_id
         FROM issues
         JOIN users ON users.id = issues.user_id
         WHERE issues.user_id IN (${placeholders}) AND issues.created_at >= ?
         ORDER BY issues.created_at DESC LIMIT 25`
      )
      .all(...connectionIds, SINCE);
    for (const i of issueRows) {
      items.push({
        id: `issue-${i.id}`,
        type: 'new_issue',
        actor: publicUser({ id: i.uid, name: i.name, phone: i.phone, avatar_url: i.avatar_url, role: i.role, verified: i.verified, constituency_id: i.constituency_id }),
        verb: 'raised a new issue',
        target_type: 'issue',
        target_id: i.id,
        target_url: `/issues/${i.id}`,
        context_title: i.title,
        created_at: i.created_at,
      });
    }

    // 4. New comments by connections on any issue
    const commentRows = db
      .prepare(
        `SELECT c.id, c.issue_id, c.created_at, c.body,
                i.title as issue_title,
                users.id as uid, users.name, users.phone, users.avatar_url,
                users.role, users.verified, users.constituency_id
         FROM comments c
         JOIN users ON users.id = c.user_id
         JOIN issues i ON i.id = c.issue_id
         WHERE c.user_id IN (${placeholders}) AND c.created_at >= ?
         ORDER BY c.created_at DESC LIMIT 25`
      )
      .all(...connectionIds, SINCE);
    for (const c of commentRows) {
      items.push({
        id: `comment-${c.id}`,
        type: 'new_comment',
        actor: publicUser({ id: c.uid, name: c.name, phone: c.phone, avatar_url: c.avatar_url, role: c.role, verified: c.verified, constituency_id: c.constituency_id }),
        verb: 'commented on',
        target_type: 'issue',
        target_id: c.issue_id,
        target_url: `/issues/${c.issue_id}`,
        context_title: c.issue_title,
        created_at: c.created_at,
      });
    }

    // 5. New polls by connections
    const pollRows = db
      .prepare(
        `SELECT p.id, p.title, p.created_at,
                users.id as uid, users.name, users.phone, users.avatar_url,
                users.role, users.verified, users.constituency_id
         FROM polls p
         JOIN users ON users.id = p.created_by
         WHERE p.created_by IN (${placeholders}) AND p.created_at >= ?
         ORDER BY p.created_at DESC LIMIT 25`
      )
      .all(...connectionIds, SINCE);
    for (const p of pollRows) {
      items.push({
        id: `poll-${p.id}`,
        type: 'new_poll',
        actor: publicUser({ id: p.uid, name: p.name, phone: p.phone, avatar_url: p.avatar_url, role: p.role, verified: p.verified, constituency_id: p.constituency_id }),
        verb: 'posted a poll',
        target_type: 'poll',
        target_id: p.id,
        target_url: `/polls`,
        context_title: p.title,
        created_at: p.created_at,
      });
    }
  }

  // 6. New posts in the caller's constituency by users they're NOT connected to.
  // This is the "someone in your ward posted" surface — local discovery without
  // the People page search.
  if (req.user.constituency_id) {
    const exclude = connectionIds.length > 0
      ? `AND issues.user_id NOT IN (${connectionIds.map(() => '?').join(',')})`
      : '';
    const params = [req.user.constituency_id, SINCE, me];
    if (connectionIds.length > 0) params.push(...connectionIds);

    const localRows = db
      .prepare(
        `SELECT issues.id, issues.title, issues.created_at,
                users.id as uid, users.name, users.phone, users.avatar_url,
                users.role, users.verified, users.constituency_id
         FROM issues
         JOIN users ON users.id = issues.user_id
         WHERE issues.constituency_id = ?
           AND issues.created_at >= ?
           AND issues.user_id != ?
           ${exclude}
         ORDER BY issues.created_at DESC LIMIT 25`
      )
      .all(...params);
    for (const i of localRows) {
      items.push({
        id: `local-${i.id}`,
        type: 'local_post',
        actor: publicUser({ id: i.uid, name: i.name, phone: i.phone, avatar_url: i.avatar_url, role: i.role, verified: i.verified, constituency_id: i.constituency_id }),
        verb: 'posted in your constituency',
        target_type: 'issue',
        target_id: i.id,
        target_url: `/issues/${i.id}`,
        context_title: i.title,
        created_at: i.created_at,
      });
    }
  }

  // Sort newest first and cap at 50
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const capped = items.slice(0, 50);

  res.json({ notifications: capped });
});


router.post('/messages', authRequired, requireVerified, (req, res) => {
  const { to, body } = req.body;
  if (!to || !body || !body.trim()) {
    return res.status(400).json({ error: 'to and body are required' });
  }
  if (to === req.user.id) return res.status(400).json({ error: "Can't message yourself" });
  if (!areConnected(req.user.id, to)) {
    return res.status(403).json({ error: 'You can only message connected users' });
  }

  const info = db
    .prepare(
      `INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)`
    )
    .run(req.user.id, to, body.trim());

  const row = db
    .prepare(
      `SELECT id, sender_id, recipient_id, body, read_at, created_at
       FROM messages WHERE id = ?`
    )
    .get(info.lastInsertRowid);

  // Push to all live sockets of the recipient + the sender (so multiple tabs
  // on the sender side stay in sync).
  pushToUser(to, { type: 'message', message: row });
  pushToUser(req.user.id, { type: 'message', message: row });

  res.status(201).json({ message: row });
});

module.exports = router;
