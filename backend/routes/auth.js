const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { authRequired, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => cb(null, `avatar-${uuid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

function buildAbsoluteUrl(req, fileUrl) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('http')) return fileUrl;
  return `${req.protocol}://${req.get('host')}${fileUrl}`;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function findConstituencyByPincode(pincode) {
  if (!pincode) return null;
  const prefix = pincode.slice(0, 3);
  return db
    .prepare('SELECT * FROM constituencies WHERE pincode_prefix = ?')
    .get(prefix);
}

// Step 1: register basic profile (not yet identity-verified)
router.post('/register', (req, res) => {
  const { name, phone, pincode, voter_id } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }
  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ error: 'Phone already registered. Please login.' });
  }

  const constituency = findConstituencyByPincode(pincode);

  const info = db
    .prepare(
      `INSERT INTO users (name, phone, voter_id, pincode, constituency_id, role, verified)
       VALUES (?, ?, ?, ?, ?, 'citizen', 0)`
    )
    .run(name, phone, voter_id || null, pincode || null, constituency ? constituency.id : null);

  res.status(201).json({
    message: 'Registered. Please verify your phone via OTP to activate your account.',
    user_id: info.lastInsertRowid,
    constituency: constituency || null,
    note: voter_id
      ? 'Voter ID recorded — full "verified" status is granted after moderator document review.'
      : 'No Voter ID provided — you can add it later from your profile. Identity verification is required to vote or raise issues.',
    constituency_warning: constituency
      ? null
      : 'No constituency matched this PIN code (this demo only seeds 3 constituencies). You can pick one manually from your profile page.',
  });
});

// Step 2: send OTP (DEMO_MODE returns the code directly instead of sending SMS)
router.post('/otp/send', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return res.status(404).json({ error: 'No account with this phone. Register first.' });

  const code = generateOtp();
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(
    phone,
    code,
    expires
  );

  // TODO(production): call SMS gateway (MSG91 / Twilio / AWS SNS) here instead.
  if (DEMO_MODE) {
    return res.json({ message: 'OTP generated (DEMO_MODE — no real SMS sent)', otp: code, expires_at: expires });
  }
  console.log(`[SMS STUB] OTP for ${phone}: ${code}`);
  res.json({ message: 'OTP sent to your phone.' });
});

// Step 3: verify OTP -> issue JWT
router.post('/otp/verify', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'phone and code are required' });

  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE phone = ? AND code = ? AND consumed = 0
       ORDER BY id DESC LIMIT 1`
    )
    .get(phone, code);

  if (!row) return res.status(401).json({ error: 'Invalid OTP' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: 'OTP expired. Request a new one.' });
  }

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id);

  // Phone verification confirms the account is real; voter_id / document review
  // (done by a moderator) is what flips full "verified" (able to vote/raise issues).
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const autoVerify = !!user.voter_id; // simplistic demo rule; production = moderator review
  if (autoVerify && !user.verified) {
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);
  }
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);

  const token = jwt.sign(
    {
      id: updated.id,
      phone: updated.phone,
      role: updated.role,
      constituency_id: updated.constituency_id,
      verified: !!updated.verified,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: sanitize(updated) });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const constituency = user.constituency_id
    ? db.prepare('SELECT * FROM constituencies WHERE id = ?').get(user.constituency_id)
    : null;

  const stats = {
    issues_posted: db.prepare('SELECT COUNT(*) as c FROM issues WHERE user_id = ?').get(user.id).c,
    votes_cast: db.prepare('SELECT COUNT(*) as c FROM votes WHERE user_id = ?').get(user.id).c,
    comments_made: db.prepare('SELECT COUNT(*) as c FROM comments WHERE user_id = ?').get(user.id).c,
  };

  res.json({ user: sanitize(user), constituency, stats });
});

// Update profile after registration — this is what actually lets an account become
// "verified" (by adding a Voter ID) or get tied to a constituency (by adding/fixing a
// PIN code, or picking one directly if no PIN match exists yet). Re-issues the JWT since
// verified/constituency_id are embedded in the token payload.
router.patch('/me', authRequired, (req, res) => {
  const { name, pincode, voter_id, constituency_id } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let newConstituencyId = user.constituency_id;
  if (constituency_id !== undefined) {
    // Manual override — used when no PIN code prefix matches a seeded constituency.
    const exists = constituency_id
      ? db.prepare('SELECT 1 FROM constituencies WHERE id = ?').get(constituency_id)
      : true;
    if (!exists) return res.status(400).json({ error: 'Invalid constituency_id' });
    newConstituencyId = constituency_id || null;
  } else if (pincode !== undefined && pincode !== user.pincode) {
    const match = findConstituencyByPincode(pincode);
    if (match) newConstituencyId = match.id;
  }

  const newVoterId = voter_id !== undefined ? voter_id || null : user.voter_id;
  const newPincode = pincode !== undefined ? pincode || null : user.pincode;
  const newName = name || user.name;
  const newVerified = user.verified || (!!newVoterId ? 1 : 0); // demo rule, see otp/verify note above

  db.prepare(
    'UPDATE users SET name = ?, pincode = ?, voter_id = ?, constituency_id = ?, verified = ? WHERE id = ?'
  ).run(newName, newPincode, newVoterId, newConstituencyId, newVerified, user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = jwt.sign(
    {
      id: updated.id,
      phone: updated.phone,
      role: updated.role,
      constituency_id: updated.constituency_id,
      verified: !!updated.verified,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const constituency = updated.constituency_id
    ? db.prepare('SELECT * FROM constituencies WHERE id = ?').get(updated.constituency_id)
    : null;

  res.json({ message: 'Profile updated.', token, user: sanitize(updated), constituency });
});

// Upload / replace the current user's profile picture. Stores the file in
// backend/uploads/ (already served at /uploads/* by server.js) and persists
// the public URL on the users row.
router.post('/me/avatar', authRequired, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'avatar file is required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Remove the previous uploaded file (best effort — old rows may have used
  // a different path, or the file may already be gone; that's fine).
  if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, '..', user.avatar_url.replace(/^\//, ''));
    fs.unlink(oldPath, () => {});
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(fileUrl, user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = jwt.sign(
    {
      id: updated.id,
      phone: updated.phone,
      role: updated.role,
      constituency_id: updated.constituency_id,
      verified: !!updated.verified,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Profile picture updated.',
    token,
    user: sanitize(updated),
    avatar_url: buildAbsoluteUrl(req, fileUrl),
  });
});

// Remove the current user's profile picture (revert to initials avatar).
router.delete('/me/avatar', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, '..', user.avatar_url.replace(/^\//, ''));
    fs.unlink(oldPath, () => {});
  }
  db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ message: 'Profile picture removed.', user: sanitize(updated) });
});

function sanitize(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

module.exports = router;
