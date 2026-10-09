# Demonstration and Viva Guide

## Suggested 8-minute presentation

1. **Problem (45 sec):** Explain fragmented manual event registration and the need for reliable capacity/attendance information.
2. **Student workspace (90 sec):** Sign in as S001. Show overview, event cards, categories and venue/name search. Join an available upcoming event, then open My schedule and download its calendar file.
3. **Business rules (60 sec):** Show a registered event cannot be booked twice. Cancel the seat and register again. Explain the retained unique record.
4. **Admin workspace (90 sec):** Sign out; sign in as administrator. Create a future event, edit its capacity, show the participant list and export CSV. Explain the live registration chart.
5. **Actual AI (90 sec):** With Gemini configured, ask “Which AI workshops are happening this month?”, “Am I registered for AI Workshop?”, “How many students have registered for AI Workshop?” and “Register me for Advanced AI Workshop”. Show server tool-call logs and corresponding database/UI changes. If you use the local fallback, explicitly call it rule-based demo mode.
6. **Google API (60 sec):** Connect an organiser Google account from Integrations, register for an event, open the returned Google Calendar link and demonstrate the created event. Use real test email addresses for invitation delivery.
7. **Architecture and tests (45 sec):** Show the report architecture and run npm test. Explain that an external Calendar failure does not lose a saved registration.

## Common viva questions

**Why is this an agent rather than a text chatbot?**
Gemini selects functions with arguments. Backend tools query real tables or execute registration; results are returned to the LLM. The deterministic fallback is not an LLM agent.

**How are duplicates prevented?**
The registrations table has a UNIQUE(student_id,event_id) constraint plus application checks. Cancelled records are reactivated on rebooking.

**What if Google is unavailable?**
Registration persists first. Calendar errors are separately returned. An .ics file can be downloaded without any Google connection.

**Who can manage events?**
The authenticated role is stored server-side and administrative endpoints use role guards. Students cannot create/edit/delete events or cancel another student's registration.

**Why SQLite?**
It provides relational persistence, constraints and simple local deployment for a single-process academic application. Larger multi-instance deployments need stronger concurrency handling and likely a server database.

**Does the demo meet every requirement without credentials?**
Frontend/backend/database and local tool workflows work without credentials. The LLM and actual Google API requirements need valid Gemini credentials and a successfully authorised Google account; an .ics download alone is not Google API integration.

## Before evaluation

- Configure and validate Gemini and Google Calendar, including quotas and OAuth test users.
- Use upcoming events and real consented test email addresses for calendar delivery.
- Run API/browser tests and prepare screenshots.
- Read docs/PROJECT_REPORT.md and personalise institutional/student details for submission.
- Keep .env, tokens and databases out of slides, screenshots and repositories.
