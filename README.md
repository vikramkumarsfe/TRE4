# TRE Tracker

A private preparation workspace for BPSC TRE 4, Class 11–12 Computer Science. Scores and readiness signals are personal tracking metrics; the starter topic lists are editable examples, not a verified official syllabus. The app does not predict selection or encode an official cutoff or exam date.

## Local setup

Requirements: Node.js 22+, npm, MongoDB, and a QStash account for analyzer jobs.

```bash
cp .env.example .env
docker compose up --build
```

On PowerShell, copy `.env.example` to `.env` with `Copy-Item .env.example .env`. Set `MONGODB_URI` to your MongoDB URI and set `AUTH_SECRET` to a cryptographically random value of at least 32 characters before running the app. Generate one with `openssl rand -base64 48` or a password manager. Add Gemini and QStash credentials to enable analysis. Docker Compose starts the app and MongoDB; QStash calls the app's signed analyzer worker route after an upload. The worker sends the PDF directly to Gemini for visual analysis, so no local OCR software is needed. The deployed app URL must be public HTTPS so QStash can reach it. Analyzer uploads remain in private app storage while queued or running; the app can run directly on Windows or in the included Docker/Coolify stack. A Vercel deployment needs a separate worker and shared object storage before this analyzer can run there.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string. Never expose it through a `NEXT_PUBLIC_` variable. |
| `AUTH_SECRET` | Yes | Signs seven-day HTTP-only session cookies. Use a unique random secret in each environment. |
| `NEXT_PUBLIC_APP_URL` | Deployment | Canonical HTTPS app URL, for example `https://prep.example.com`. |
| `GEMINI_API_KEY` | Analyzer | Server-only Gemini API key used by the analyzer worker. Never expose it through a `NEXT_PUBLIC_` variable. |
| `GEMINI_MODEL` | Optional | Gemini model for answer analysis and resource search; defaults to `gemini-3.8-flash`. |
| `QSTASH_URL` | Analyzer | Regional QStash API URL; defaults to `https://qstash.upstash.io`. |
| `QSTASH_TOKEN` | Analyzer | Server-only QStash publish token. |
| `QSTASH_CURRENT_SIGNING_KEY` | Analyzer | Verifies signed QStash worker and failure-callback requests. |
| `QSTASH_NEXT_SIGNING_KEY` | Analyzer | Supports safe signing-key rotation. |
| `ANALYZER_WORKER_URL` | Analyzer | Public HTTPS app base URL QStash calls for worker and failure routes. |

## Features

- Account signup/login with bcrypt password hashing, signed HTTP-only sessions, and account-scoped data queries.
- Exam profile, daily planner, separately recorded actual study sessions, editable CS/GS syllabus topics, mock tests, mistakes, revision tasks, and weekly goals.
- Mock score trend and dashboard progress from saved records. Merit score excludes qualifying language marks and applies each test's configured penalty only to incorrect answers.
- Mock PDF analyzer for scanned answer sheets, optional answer-key grading, topic weakness summaries, linked YouTube/blog recommendations, and saving confirmed wrong answers to the mistake notebook.
- CSV download from each tracker and complete JSON backup download/restore from Settings.
- Asia/Kolkata date display and a MongoDB health endpoint at `/api/health`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## VPS / Coolify deployment

1. Push this repository to your Git host and deploy the Compose stack. The app container exposes the analyzer worker route; no separate worker process or Redis service is needed.
2. In Coolify, set `MONGODB_URI`, a new random `AUTH_SECRET` (32+ characters), `GEMINI_API_KEY`, all three QStash credentials, `ANALYZER_WORKER_URL`, and `NEXT_PUBLIC_APP_URL` to the final public HTTPS app URL. `QSTASH_URL` defaults to the EU endpoint; use the matching regional URL for your QStash token/signing keys. Do not commit `.env` files.
3. Keep the `analyzer_uploads` volume mounted at `/app/uploads/analyzer`. QStash sends only job identifiers and paths, so the worker route must run in the same single app container that can read this volume. Use object storage before scaling app replicas or deploying the worker separately.
4. Deploy. The app container has a health check at `/api/health`. Configure the app domain in Coolify and enable HTTPS so QStash can deliver signed requests.
5. For self-hosted MongoDB, use authenticated credentials and a private network. The Compose example provisions a named `mongo_data` volume; set a strong MongoDB root user/password and use those credentials in `MONGODB_URI` before using it beyond local development.
6. Back up MongoDB on a schedule using `mongodump` (store backups outside the container and test restores). The Settings page exports/imports an individual account's tracker data; it is not a replacement for database-level backups.

`docker-compose.yml` is a local/self-hosting starting point. When using it, set `MONGODB_URI` to `mongodb://<MONGO_INITDB_ROOT_USERNAME>:<MONGO_INITDB_ROOT_PASSWORD>@mongo:27017/tre_tracker?authSource=admin` (URL encode special characters in credentials). MongoDB is on the private Compose network and has no public port. Use a managed database URI instead when Coolify provides MongoDB separately.

## Mock PDF analyzer

The analyzer accepts an attempted answer-sheet PDF up to 20 MB and an optional answer-key PDF. The worker uploads the PDFs to Gemini Files API and Gemini visually analyzes their text, diagrams, and marked options. Gemini returns structured question analysis and uses Google Search grounding to find current study resources. Confirmed incorrect answers can be copied into the existing Mistake Notebook. Verify selected/correct answers in the report because visual marks can still be misread. The worker requests deletion of Gemini's temporary PDF files after analysis; if deletion fails, Gemini automatically deletes them within 48 hours.

Analyzer reports are stored in the user's MongoDB data. PDF bytes stay in private app storage while a QStash message is queued or running, then the signed worker route deletes the local copies. QStash stores only job paths and IDs. The PDFs are sent to Google Gemini for analysis and Google Search grounding. The worker endpoint checks QStash signatures, claims jobs idempotently, and QStash retries failed deliveries and calls a failure callback after retries are exhausted. The job route has a 15-minute timeout; longer jobs need to be split into smaller stages.

## Data and security notes

The MongoDB collections are `users`, `examprofiles`, `studytasks`, `studysessions`, `syllabustopics`, `mocktests`, `questionmistakes`, `revisiontasks`, `weeklygoals`, and `analyzerruns`. Data records carry an owning user id, and CRUD routes check the signed session and owner id on the server. Keep backups and environment secrets protected. The lightweight in-process auth rate limiter is suitable only for a single app process; use an external shared limiter (such as Redis at the reverse proxy) when running multiple replicas.
