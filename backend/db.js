const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'civic.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS constituencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  mp_name TEXT,
  mp_party TEXT,
  pincode_prefix TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  voter_id TEXT,
  pincode TEXT,
  constituency_id INTEGER,
  role TEXT NOT NULL DEFAULT 'citizen', -- citizen | official | moderator | admin
  verified INTEGER NOT NULL DEFAULT 0,  -- identity verified (voter id / doc reviewed)
  password_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (constituency_id) REFERENCES constituencies(id)
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS officials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  designation TEXT NOT NULL, -- ward_officer | city_official | district_admin | mla | mp
  level TEXT NOT NULL,       -- ward | city | district | state | national
  constituency_id INTEGER,
  verified_doc_url TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (constituency_id) REFERENCES constituencies(id)
);

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- aqi | education | roads | electricity_water | governance_corruption | health | law_order
  scope TEXT NOT NULL,    -- ward | district | state | national
  constituency_id INTEGER,
  anonymous INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active | under_review | removed
  report_count INTEGER NOT NULL DEFAULT 0,
  response_status TEXT NOT NULL DEFAULT 'pending', -- pending | under_review | action_taken | rejected
  escalation_level TEXT NOT NULL DEFAULT 'ward', -- ward | city | state | national
  since_when TEXT,
  affected_group TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (constituency_id) REFERENCES constituencies(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(issue_id, user_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(issue_id, user_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS official_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  official_id INTEGER NOT NULL,
  status TEXT NOT NULL, -- pending | under_review | action_taken | rejected
  message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  FOREIGN KEY (official_id) REFERENCES officials(id)
);

CREATE TABLE IF NOT EXISTS escalation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  level TEXT NOT NULL,
  vote_count_at_escalation INTEGER NOT NULL,
  notified_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  options TEXT NOT NULL, -- JSON array of strings
  scope TEXT NOT NULL,
  constituency_id INTEGER,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  UNIQUE(poll_id, user_id),
  FOREIGN KEY (poll_id) REFERENCES polls(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS petitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_signatures INTEGER NOT NULL DEFAULT 10000,
  scope TEXT NOT NULL,
  constituency_id INTEGER,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS petition_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  petition_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  UNIQUE(petition_id, user_id),
  FOREIGN KEY (petition_id) REFERENCES petitions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS connection_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL,
  addressee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (addressee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(sender_id, recipient_id, created_at);
`);

module.exports = db;

// --- Lightweight migration for DBs created before the community-report model ---
// (safe to run repeatedly; SQLite has no "ADD COLUMN IF NOT EXISTS", so we probe first)
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
if (!columnExists('issues', 'report_count')) {
  db.exec('ALTER TABLE issues ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0');
}
if (!columnExists('users', 'avatar_url')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
}
// Older rows may still carry the pre-launch 'pending_moderation'/'approved'/'rejected' values —
// fold them into the new active/under_review/removed model so old dev databases keep working.
db.prepare(
  "UPDATE issues SET status = 'active' WHERE status = 'approved' OR status = 'pending_moderation'"
).run();
db.prepare("UPDATE issues SET status = 'removed' WHERE status = 'rejected'").run();
