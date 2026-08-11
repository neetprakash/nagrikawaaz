/**
 * Simulates N verified citizens voting on a given issue, so you can watch the
 * escalation ladder (100 -> ward, 1,000 -> city, 10,000 -> state, 50,000 -> national)
 * trigger without manually registering hundreds of real accounts through the OTP flow.
 *
 * This talks directly to the DB (not the API) purely for speed — it still goes through
 * the exact same `evaluateEscalation` logic the live vote endpoint uses, so the result
 * is a faithful test of the real mechanism, not a shortcut around it.
 *
 * Usage:
 *   node scripts/simulate-votes.js <issue_id> <vote_count>
 *   node scripts/simulate-votes.js 1 150      # push issue #1 past the ward->city threshold
 */
const db = require('../db');
const { evaluateEscalation } = require('../utils/escalation');

const [, , issueIdArg, countArg] = process.argv;
const issueId = Number(issueIdArg);
const count = Number(countArg);

if (!issueId || !count) {
  console.error('Usage: node scripts/simulate-votes.js <issue_id> <vote_count>');
  process.exit(1);
}

const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
if (!issue) {
  console.error(`No issue with id ${issueId}`);
  process.exit(1);
}

console.log(`Simulating ${count} votes on issue #${issueId} — "${issue.title}"`);
console.log(`Starting vote_count: ${issue.vote_count}, escalation_level: ${issue.escalation_level}`);

const insertUser = db.prepare(
  `INSERT INTO users (name, phone, voter_id, pincode, constituency_id, role, verified)
   VALUES (?, ?, ?, ?, ?, 'citizen', 1)`
);
const insertVote = db.prepare('INSERT INTO votes (issue_id, user_id) VALUES (?, ?)');
const bumpVoteCount = db.prepare('UPDATE issues SET vote_count = vote_count + 1 WHERE id = ?');

const run = db.transaction((n) => {
  for (let i = 0; i < n; i++) {
    const suffix = `${Date.now()}${i}`.slice(-9); // stay within a plausible phone length
    const info = insertUser.run(
      `Simulated Voter ${suffix}`,
      `9${suffix}`,
      `SIM${suffix}`,
      null,
      issue.constituency_id || null // same constituency as the issue so ward/district votes count
    );
    insertVote.run(issueId, info.lastInsertRowid);
    bumpVoteCount.run(issueId);
  }
});

run(count);

// Re-check thresholds once at the end (evaluateEscalation reads current vote_count itself).
const newLevel = evaluateEscalation(issueId);
const updated = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);

console.log(`Done. vote_count: ${updated.vote_count}, escalation_level: ${newLevel}`);
console.log('Check GET /api/issues/:id for the full escalation_log timeline.');
