// Registration flow: DB -> Google Calendar. Used by both REST API and AI agent.
const q = require('./db');
const { addToCalendar, removeFromCalendar } = require('./calendar');
const calendarSaves = new Map();
async function saveRegistrationCalendar(registration) {
  if (registration.calendar_link) return { ok: true, link: registration.calendar_link, alreadySaved: true };
  if (calendarSaves.has(registration.registration_id)) return calendarSaves.get(registration.registration_id);
  const saving = (async () => {
    const link = await addToCalendar(q.getStudent(registration.student_id), q.getEvent(registration.event_id));
    q.setCalendarLink(registration.registration_id, link);
    return { ok: true, link, alreadySaved: false };
  })();
  calendarSaves.set(registration.registration_id, saving);
  try { return await saving; } finally { calendarSaves.delete(registration.registration_id); }
}
async function registerFlow(student, event) {
  const r = q.register(student.student_id, event.event_id);
  if (!r.ok) return r;
  let calendar;
  try {
    calendar = await saveRegistrationCalendar(q.db.prepare('SELECT * FROM registrations WHERE registration_id=?').get(r.id));
  } catch (e) {            // API failure must not break the registration
    console.error('Calendar error:', e.message);
    calendar = { ok: false, error: e.message };
  }
  return { ok: true, registration_id: r.id, calendar };
}
async function cancelRegistrationFlow(id) {
  // Finish an in-flight save before removing its Google event.
  if (calendarSaves.has(id)) {
    try { await calendarSaves.get(id); } catch {}
  }
  const row = q.db.prepare('SELECT * FROM registrations WHERE registration_id=?').get(id);
  if (!row) return { ok: false };
  if (row.calendar_link) await removeFromCalendar(row.calendar_link);
  q.cancelRegistration(id);
  q.setCalendarLink(id, null);
  return { ok: true, calendar: { ok: true, removed: !!row.calendar_link } };
}
module.exports = { registerFlow, saveRegistrationCalendar, cancelRegistrationFlow };
