# STEM Fusion Challenge: Think, Build, Prove

Event site for ~1000 first-year students: registration, teams (1–4), topic claiming (200 topics + validated custom topics),
three timed PDF-report phases, evaluation results with reasons, leaderboard, admin and jury dashboards.

## Stack
Next.js 15 (App Router) · Postgres (Neon) · Vercel Blob (private files) · login with register number + date of birth, then email OTP (Resend or SMTP).

## Timeline (India time, editable in Admin → Settings)
| Phase | Subject | Opens | Closes |
|---|---|---|---|
| 1 | Mathematics | 17 Nov 2026 | 20 Nov 2026 09:00 |
| 2 | Chemistry | 20 Nov 2026 09:00 | 23 Nov 2026 09:00 |
| 3 | Physics | 23 Nov 2026 09:00 | 25 Nov 2026 09:00 |
| Jury | Physical model | TBD (set in Settings) | |

Phases open and close automatically from these timestamps; uploads outside the window are rejected by the server.

## Environment variables
See `.env.example`. Required: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAILS`, `BLOB_READ_WRITE_TOKEN`, and one email provider
(`RESEND_API_KEY` + `MAIL_FROM`, or `SMTP_URL`). The database schema and the 200 topics are created automatically on first request.

## First-time setup
1. Create the Neon Postgres database and a Blob store in Vercel (Storage tab) and connect them to the project.
2. Set the environment variables, deploy.
3. Log in at `/login?as=staff` with an email in `ADMIN_EMAILS`.
4. Admin → Settings → import the roster CSV (register number, student name, DOB, department). DOB is stored only as a keyed hash. On first login each student links their own email, verified by a code.
5. Share the site link with students.

## Evaluation workflow
After a phase closes: Admin → Evaluation → download the ZIP batches + manifest → evaluate against the rubric
(`lib/rubrics.ts`) → import the results JSON (scores + a reason per criterion). Results appear on team dashboards and the leaderboard immediately.
Admins can override any score; leaders can request one re-evaluation.

## Security
Roster-only registration · email OTP (hashed, 10-min expiry, 5 attempts, rate-limited) · HttpOnly/Secure/SameSite session cookie ·
server-side authorisation on every page and route · atomic topic claims · file type sniffing, size limits, private storage and authenticated downloads ·
Origin checks on uploads · CSP and security headers · CSV formula-injection protection · audit log of admin actions.
