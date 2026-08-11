const db = require('../db');

// Vote thresholds -> escalation level. Ordered ascending.
const THRESHOLDS = [
  { votes: 100, level: 'ward', notify: 'Ward Officer' },
  { votes: 1000, level: 'city', notify: 'City Authority' },
  { votes: 10000, level: 'state', notify: 'State Department' },
  { votes: 50000, level: 'national', notify: 'National Attention Desk' },
];

const LEVEL_ORDER = ['ward', 'city', 'state', 'national'];

/**
 * Given an issue's current vote count, determine the highest escalation
 * level reached, log any newly-crossed thresholds, and update the issue.
 * In production, "notify" would fire an email/SMS/webhook to the relevant
 * official's queue instead of just logging.
 */
function evaluateEscalation(issueId) {
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
  if (!issue) return null;

  let newLevel = issue.escalation_level;
  const currentIdx = LEVEL_ORDER.indexOf(issue.escalation_level);

  for (const t of THRESHOLDS) {
    const idx = LEVEL_ORDER.indexOf(t.level);
    if (issue.vote_count >= t.votes && idx > LEVEL_ORDER.indexOf(newLevel)) {
      newLevel = t.level;
    }
  }

  if (LEVEL_ORDER.indexOf(newLevel) > currentIdx) {
    db.prepare('UPDATE issues SET escalation_level = ? WHERE id = ?').run(newLevel, issueId);
    db.prepare(
      'INSERT INTO escalation_log (issue_id, level, vote_count_at_escalation) VALUES (?, ?, ?)'
    ).run(issueId, newLevel, issue.vote_count);

    // Stub notification — replace with real email/SMS/webhook integration.
    console.log(
      `[ESCALATION] Issue #${issueId} "${issue.title}" reached ${issue.vote_count} votes -> ${newLevel} level. Notify: relevant ${newLevel} officials.`
    );
  }

  return newLevel;
}

module.exports = { evaluateEscalation, THRESHOLDS, LEVEL_ORDER };
