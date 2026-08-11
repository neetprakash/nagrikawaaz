# Nagrik Awaaz — Citizen ↔ MP Accountability Platform (MVP)

A working MVP for the platform described in the brief: verified citizens raise issues, vote them
up an escalation ladder (ward → city → state → national), and tagged officials respond on a
public timeline.

This has been built and smoke-tested end-to-end (registration → OTP login → issue creation →
moderation → voting → auto-escalation → official response → polls → petitions all verified
against the running API).

---

## 1. What's real vs. stubbed in this MVP

Everything in the **user flow, data model, voting/escalation logic, and role-based access** is
fully implemented and working. Two external integrations are deliberately stubbed because they
require approvals/contracts that no amount of code can substitute for:

| Feature | This MVP | Production |
|---|---|---|
| Phone verification | Real OTP flow, `DEMO_MODE=true` returns the OTP in the API response instead of sending SMS | Wire `routes/auth.js` `/otp/send` to MSG91 / Twilio / AWS SNS (all have free tiers) |
| Identity (KYC) | Voter ID (EPIC) number captured at registration; a moderator/admin reviews documents to flip `verified=1`. See `otp/verify` — currently auto-verifies if a Voter ID string was supplied, as a demo shortcut | **Aadhaar e-KYC requires becoming a UIDAI-licensed AUA/KYC User Agency**, or going through an approved intermediary (DigiLocker, Setu, Signzy, NSDL e-Gov). This is a legal/business registration process, not an engineering task — budget for it separately. Voter ID + manual document review (as built here) is a legitimate interim path used by several civic platforms. |
| Official accounts | Seeded manually (`seed.js`); an `approved` flag on the `officials` table gates dashboard access | Verify via official government email domain (e.g. `@sansad.nic.in`, `@nic.in`) or signed document upload + admin approval |
| PRS India / Lok Sabha data | Not integrated | PRS India has a public site but no open API at time of writing — you'd need to scrape (check their ToS) or request a data partnership. Election Commission constituency data is publicly downloadable and should replace the 3 hardcoded demo constituencies in `seed.js`. |
| File storage | Local disk (`backend/uploads/`) | Move to S3 / Cloudflare R2 (both have free tiers) before deploying anywhere with ephemeral disk (Render, Railway, etc.) |

**Do not launch to real users with `DEMO_MODE=true`** — it exposes OTPs in the API response,
which is only for local development.

---

## 2. Architecture

```
civic-platform/
├── backend/          Express API + SQLite (better-sqlite3)
│   ├── db.js          Schema (auto-created on boot)
│   ├── server.js       Entry point
│   ├── seed.js          Demo constituencies + moderator/official test accounts
│   ├── routes/
│   │   ├── auth.js        Register, OTP send/verify, /me
│   │   ├── issues.js       Create/list/vote/comment/evidence
│   │   ├── moderation.js    Approve/reject queue
│   │   ├── officials.js     Official dashboard, respond, public constituency profile
│   │   └── polls.js         Polls + petitions
│   ├── middleware/auth.js  JWT auth + role/verification guards
│   └── utils/escalation.js  Vote-threshold escalation logic
└── frontend/         Next.js 14 (App Router) + Tailwind
    └── app/            One route per screen: /, /register, /login, /dashboard,
                         /issues/new, /issues/[id], /moderation, /officials, /polls, /petitions
```

**Why SQLite for the MVP:** zero setup cost, free, and the schema (see `db.js`) maps directly
onto PostgreSQL — `better-sqlite3` queries are plain SQL, so migrating to Postgres later is a
matter of swapping the driver and running the same `CREATE TABLE` statements (a few types like
`TEXT` timestamps would move to native `TIMESTAMP`). Recommended path: **Supabase or Neon free
tier** for a hosted Postgres once you have real users, plus **Redis (Upstash free tier)** for
session/rate-limit caching as load grows.

---

## 3. Running it locally

Requires Node.js 18+.

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run seed     # creates 3 demo constituencies + a demo moderator (9990000001) and official (9990000002)
npm start        # runs on http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev       # runs on http://localhost:3000
```

Open `http://localhost:3000`. To try every role:
1. **Citizen:** Register with any 10-digit phone + pincode `226001` (maps to the seeded Lucknow
   constituency) + any Voter ID string → login via OTP (shown on screen in demo mode) → raise an
   issue → it needs moderator approval before it appears in `/dashboard`.
2. **Moderator:** Login with phone `9990000001` → go to `/moderation` → approve the issue.
3. **Vote:** Back in `/dashboard`, open the approved issue and vote. Votes auto-escalate at 100 /
   1,000 / 10,000 / 50,000 (visible instantly in this demo since you're the only voter — the
   thresholds are unchanged from the spec, just slow to hit with one account).
4. **Official:** Login with phone `9990000002` (seeded as Lucknow Ward Officer) → `/officials` →
   respond to the issue → status + message appear on the issue's public timeline.
5. **Polls/Petitions:** `/polls` and `/petitions` work for any verified logged-in citizen.

---

## 4. Data model highlights

- **One-vote enforcement:** `UNIQUE(issue_id, user_id)` at the DB level, not just app logic.
- **Geo-restricted voting:** ward/district-scope issues only accept votes from users whose
  `constituency_id` matches the issue's (state/national issues are open to all verified users) —
  see `routes/issues.js` → `POST /:id/vote`.
- **Escalation is automatic and logged:** every vote re-evaluates thresholds
  (`utils/escalation.js`); crossing one inserts an `escalation_log` row and (in production) would
  fire a notification to the next tier's officials — currently a `console.log` stub, clearly
  marked in the code.
- **Anonymous posting:** the `anonymous` flag hides `user_id`/author from public API responses
  while the row is still tied to a verified user internally — moderators/admins can still trace
  abuse if needed.

---

## 5. Legal & compliance notes (India-specific — read before going live)

This is guidance, not legal advice — have a lawyer review before launch.

- **DPDP Act 2023:** you'll be a "Data Fiduciary" processing personal data (phone, Voter ID,
  location) — you need a clear consent flow, a published privacy policy, data minimization
  (don't store more than you need), and a working "delete my account & data" flow. Add a
  `DELETE /api/auth/me` endpoint and a frontend settings page before public launch — not yet
  built in this MVP.
- **IT Act 2000 (esp. Section 79, intermediary liability):** as a platform hosting user-generated
  content, appoint a Grievance Officer and publish a takedown/grievance process — the
  moderation queue in this MVP is the technical half of that requirement, not the legal half.
- **Structuring:** a Section 8 (non-profit) company or a public-benefit-oriented private entity
  both work; the choice affects fundraising and tax treatment more than the product itself.
- **Government official impersonation:** verifying "Government Official" badges (official
  email domain / signed ID document + manual admin approval) is load-bearing for trust — don't
  auto-approve this role in production the way `seed.js` does for the demo account.

---

## 6. Suggested next milestones (post-MVP)

1. Real SMS OTP gateway + rate limiting on `/otp/send` (prevent OTP-bombing abuse).
2. Move moderator "approve Voter ID" from the demo auto-verify rule to an actual document-review
   queue (photo upload + moderator UI).
3. Postgres migration + Redis caching for the vote-count hot path.
4. Notification delivery (email/SMS/webhook) for real escalation events, not just `console.log`.
5. Vidhan Sabha (state assembly) layer, PRS India data partnership, ECI constituency dataset
   import to replace the 3 demo constituencies.
6. Rate-limit and abuse-report tooling for comments (basic spam/misinfo flagging for moderators).
