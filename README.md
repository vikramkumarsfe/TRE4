# TRE Tracker

A private preparation workspace for BPSC TRE 4, Class 11–12 Computer Science. Scores and readiness signals are personal tracking metrics; the starter topic lists are editable examples, not a verified official syllabus. The app does not predict selection or encode an official cutoff or exam date.

## Local setup

Requirements: Node.js 22+, npm, and a MongoDB instance (local or managed).

```bash
cp .env.example .env.local
npm install
npm run dev
```

On PowerShell, copy `.env.example` to `.env.local` with `Copy-Item .env.example .env.local`. Set `MONGODB_URI` to your MongoDB URI and set `AUTH_SECRET` to a cryptographically random value of at least 32 characters before running the app. Generate one with `openssl rand -base64 48` or a password manager. Open `http://localhost:3000`, create an account, then set your exam profile and targets.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string. Never expose it through a `NEXT_PUBLIC_` variable. |
| `AUTH_SECRET` | Yes | Signs seven-day HTTP-only session cookies. Use a unique random secret in each environment. |
| `NEXT_PUBLIC_APP_URL` | Deployment | Canonical HTTPS app URL, for example `https://prep.example.com`. |

## Features

- Account signup/login with bcrypt password hashing, signed HTTP-only sessions, and account-scoped data queries.
- Exam profile, daily planner, separately recorded actual study sessions, editable CS/GS syllabus topics, mock tests, mistakes, revision tasks, and weekly goals.
- Mock score trend and dashboard progress from saved records. Merit score excludes qualifying language marks and applies each test's configured penalty only to incorrect answers.
- CSV download from each tracker and complete JSON backup download/restore from Settings.
- Asia/Kolkata date display and a MongoDB health endpoint at `/api/health`.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

## VPS / Coolify deployment

1. Push this repository to your Git host and create a Coolify application from the repository using its `Dockerfile` (port `3000`).
2. In Coolify, set `MONGODB_URI` to a reachable MongoDB service/managed database URI, `AUTH_SECRET` to a new random secret of 32+ characters, and `NEXT_PUBLIC_APP_URL` to the final `https://` URL. Do not commit `.env` files.
3. Deploy. The container exposes port 3000 and includes a health check at `/api/health`. Configure the app domain in Coolify and enable its Let's Encrypt HTTPS certificate. Ensure proxy headers are forwarded normally.
4. For self-hosted MongoDB, use authenticated credentials and a private network. The Compose example provisions a named `mongo_data` volume; set a strong MongoDB root user/password and use those credentials in `MONGODB_URI` before using it beyond local development.
5. Back up MongoDB on a schedule using `mongodump` (store backups outside the container and test restores). The Settings page exports/imports an individual account's tracker data; it is not a replacement for database-level backups.

`docker-compose.yml` is a local/self-hosting starting point. When using it, set `MONGODB_URI` to `mongodb://<MONGO_INITDB_ROOT_USERNAME>:<MONGO_INITDB_ROOT_PASSWORD>@mongo:27017/tre_tracker?authSource=admin` (URL encode special characters in credentials). MongoDB is on the private Compose network and has no public port. Use a managed database URI instead when Coolify provides MongoDB separately.

## Data and security notes

The MongoDB collections are `users`, `examprofiles`, `studytasks`, `studysessions`, `syllabustopics`, `mocktests`, `questionmistakes`, `revisiontasks`, and `weeklygoals`. Data records carry an owning user id, and CRUD routes check the signed session and owner id on the server. Keep backups and environment secrets protected. The lightweight in-process auth rate limiter is suitable only for a single app process; use an external shared limiter (such as Redis at the reverse proxy) when running multiple replicas.
