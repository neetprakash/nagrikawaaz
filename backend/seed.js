const db = require('./db');

const constituencies = [
  { name: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', mp_name: 'Rajnath Singh', mp_party: 'BJP', pincode_prefix: '226' },
  { name: 'North East Delhi', district: 'North East Delhi', state: 'Delhi', mp_name: 'Kanhaiya Kumar', mp_party: 'INC', pincode_prefix: '110' },
  { name: 'Bengaluru South', district: 'Bengaluru Urban', state: 'Karnataka', mp_name: 'Tejasvi Surya', mp_party: 'BJP', pincode_prefix: '560' },
];

const insertConstituency = db.prepare(
  `INSERT INTO constituencies (name, district, state, mp_name, mp_party, pincode_prefix) VALUES (?, ?, ?, ?, ?, ?)`
);

const countRow = db.prepare('SELECT COUNT(*) as c FROM constituencies').get();
if (countRow.c === 0) {
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertConstituency.run(r.name, r.district, r.state, r.mp_name, r.mp_party, r.pincode_prefix);
  });
  insertMany(constituencies);
  console.log(`Seeded ${constituencies.length} constituencies.`);
} else {
  console.log('Constituencies already seeded, skipping.');
}

// Demo moderator account (phone-only, pre-verified) so you can test the moderation queue
const modPhone = '9990000001';
let mod = db.prepare('SELECT * FROM users WHERE phone = ?').get(modPhone);
if (!mod) {
  const info = db
    .prepare(
      `INSERT INTO users (name, phone, role, verified) VALUES (?, ?, 'moderator', 1)`
    )
    .run('Demo Moderator', modPhone);
  console.log(`Seeded moderator user id=${info.lastInsertRowid} phone=${modPhone}`);
} else {
  console.log('Moderator already exists, skipping.');
}

// Demo official (Ward Officer for Lucknow) — needs an official record too
const officialPhone = '9990000002';
let officialUser = db.prepare('SELECT * FROM users WHERE phone = ?').get(officialPhone);
const lucknow = db.prepare("SELECT * FROM constituencies WHERE name = 'Lucknow'").get();
if (!officialUser) {
  const info = db
    .prepare(
      `INSERT INTO users (name, phone, role, verified, constituency_id) VALUES (?, ?, 'official', 1, ?)`
    )
    .run('Demo Ward Officer', officialPhone, lucknow ? lucknow.id : null);
  officialUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  console.log(`Seeded official user id=${officialUser.id} phone=${officialPhone}`);
}
const existingOfficial = db.prepare('SELECT * FROM officials WHERE user_id = ?').get(officialUser.id);
if (!existingOfficial) {
  db.prepare(
    `INSERT INTO officials (user_id, designation, level, constituency_id, approved) VALUES (?, 'ward_officer', 'ward', ?, 1)`
  ).run(officialUser.id, lucknow ? lucknow.id : null);
  console.log('Seeded official profile (approved).');
}

console.log('\nDemo login flow (DEMO_MODE=true):');
console.log('  1. POST /api/auth/otp/send { "phone": "9990000001" }  -> returns otp in response');
console.log('  2. POST /api/auth/otp/verify { "phone": "9990000001", "code": "<otp>" } -> returns JWT');
console.log('Use the moderator/official phones above, or register a new citizen via /api/auth/register first.');
