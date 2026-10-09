# Gather — AI-Powered Campus Event Management

An academic full-stack project with a responsive student/admin interface, persistent SQLite data, a Gemini function-calling agent and Google Calendar OAuth integration.

## Run locally

Requires Node.js 20+ and npm. SQLite uses a native addon; an active LTS Node version is recommended.

```sh
npm install
cp .env.example .env  # only if .env does not exist
npm start
```

Open http://localhost:3000. Students: S001–S004. Default administrator password: admin123; override ADMIN_PASSWORD in .env. Student ID login is **demo identification**, not production authentication. Sessions persist for 24 hours and logout revokes them.

## Features

- Responsive overview, illustrated event cards, category filters and search.
- Student registration, personal schedule, cancellation, rebooking and downloadable .ics calendar invitations.
- Administrator event CRUD, capacity validation, participant management, CSV export and registration chart.
- SQLite foreign keys, unique registrations and persistent sessions.
- Gemini agent tools: search_events, check_my_registration, count_registrations, register_me. Actions use the same business logic as REST routes.
- Clearly labelled rule-based demo assistant when no Gemini key exists; it reads/writes real data but **is not an LLM**.
- Google Calendar invites after registration. A failed calendar call does not discard the registration.
- Admin-only OAuth initiation, expiring state bound to an HttpOnly cookie, and visible integration status.

## Enable the actual Gemini LLM

Set GEMINI_API_KEY in .env using your Google AI Studio key. Optional GEMINI_MODEL defaults to gemini-2.5-flash. Restart the server. The Integrations screen reports configuration, not a successful external API health check. Test a chat request to verify your key/model/quota.

## Enable Google Calendar

1. Create a Google Cloud project, enable Google Calendar API, and configure an OAuth consent screen.
2. Create a Web application OAuth client with redirect URI http://localhost:3000/auth/google/callback. Add your organiser Google account as a test user if your OAuth app is in testing.
3. Put GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in .env; restart.
4. Sign in as administrator → Integrations → Connect Google Calendar. Approve in Google's consent screen.
5. Register a student for an event. A successful response contains a calendar link; failures are reported while keeping the registration.

The organiser's primary calendar receives the event with the student's email as an attendee. Seed accounts use example.com email addresses: replace those with real consented test addresses before demonstrating actual attendee delivery. Google may require reauthorisation for expired/revoked tokens. Calendar status means a token file exists, not that the token is valid. Student and administrator cancellation also deletes the saved Google Calendar invitation. If Google deletion fails, cancellation reports an error and can be retried.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:ui
# Or use an already-installed Google Chrome:
UI_BROWSER_CHANNEL=chrome npm run test:ui
```

API tests use a temporary database and separate port. Browser tests use /tmp/gather-ui-test.db on port 3108 and cover login, search/filter, assistant, schedule downloads, desktop/mobile layout and admin CRUD. UI test screenshots are written to docs/.

## Architecture and submission

Browser → Express REST API → shared service/database → SQLite.
Chat → Gemini → tool execution → shared database/registration service → Google Calendar → assistant result.

See [project report](docs/PROJECT_REPORT.md) and [demonstration/viva guide](docs/DEMO_GUIDE.md). No external connection is claimed as tested without configured credentials. Never commit .env, google-token.json or database files.
