# Sparks frontend

React, TypeScript, and Vite interface for discovering hackathons and managing participant, organizer, and assigned-judge workflows.

## Run locally

Prerequisites: Node.js 20 or newer and npm (or pnpm).

```powershell
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Start the backend separately; see [`../backend/README.md`](../backend/README.md).

To start the fixture-seeded self-hosted stack with Docker Compose, run `docker compose up --build` from `backend/`; the frontend and API are both included.

## Current workflows

- Participants can discover events, register, create or join teams, submit and edit projects before the deadline, vote for other projects, review published results and feedback, and print participation certificates.
- Organizers can manage an organization profile, publish events, review registrations, configure a scoring rubric, assign judges, review and normalize scores, publish results, issue certificates, and archive events.
- Assigned judges sign in with their account and submit rubric scores and comments from the judge review section of their workspace.
- The directory includes sample events for exploration. They are not backed by the server; registrations for them remain browser-local and do not reach an organizer.

Authentication and event persistence require the backend. If the API is unavailable, browser-local data can still appear during the session, but it is not synchronized with the server. Account passwords are hashed by the backend and sessions use signed bearer tokens.

## Configuration and deployment

Set `VITE_API_BASE_URL` to the public HTTPS origin of the backend at build time, for example `https://api.example.org`. Configure the backend's `CORS_ORIGINS` to include the exact frontend origin. Build with `npm run build` and serve the generated `dist/` directory from a static web server or container. For a complete self-host setup, persistent database, secrets, reverse proxy/TLS, migrations, backups, and health checks, see the backend README.

This project is licensed under the MIT License; see [`../backend/LICENSE`](../backend/LICENSE).

## Known limitations

This is an early self-hosted MVP. Email confirmation and password recovery, configurable team-size and voting policies, publicly verifiable certificates, event templates, and a dedicated judge-only interface are not included. See the backend README for the current data model and deployment caveats.

## Checks

```powershell
npm run typecheck
npm run build
```