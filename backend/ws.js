const url = require('url');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

const userSockets = new Map(); // userId -> Set<WebSocket>

function pushToUser(userId, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const json = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(json);
  }
}

function areConnected(userId, otherId) {
  if (!userId || !otherId) return false;
  const row = db
    .prepare(
      `SELECT 1 FROM connection_requests
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?)
              OR (requester_id = ? AND addressee_id = ?))
       LIMIT 1`
    )
    .get(userId, otherId, otherId, userId);
  return !!row;
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const { query } = url.parse(req.url, true);
    const token = query.token;
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      ws.close(4401, 'Unauthorized');
      return;
    }
    const userId = payload.id;

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(ws);

    ws.send(JSON.stringify({ type: 'hello', user_id: userId }));

    ws.on('close', () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) userSockets.delete(userId);
      }
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg?.type === 'send' && msg.to && msg.body) {
        const body = String(msg.body).trim();
        if (!body) return;
        if (msg.to === userId) return; // can't message yourself
        if (!areConnected(userId, msg.to)) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not connected' }));
          return;
        }
        const info = db
          .prepare(`INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)`)
          .run(userId, msg.to, body);
        const row = db
          .prepare(
            `SELECT id, sender_id, recipient_id, body, read_at, created_at FROM messages WHERE id = ?`
          )
          .get(info.lastInsertRowid);
        pushToUser(msg.to, { type: 'message', message: row });
        pushToUser(userId, { type: 'message', message: row });
      }
    });
  });

  return wss;
}

module.exports = { attachWebSocket, pushToUser, areConnected };
