// Database layer (SQLite) - tables: students, events, registrations
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || 'events.db');
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS students(
  student_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, course TEXT);
CREATE TABLE IF NOT EXISTS events(
  event_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
  date TEXT NOT NULL, time TEXT NOT NULL, venue TEXT, max_capacity INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS registrations(
  registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(student_id),
  event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'Confirmed', calendar_link TEXT,
  UNIQUE(student_id, event_id));
`);

// ---- Sample data (dates are relative to today so "this month" queries work) ----
if (db.prepare('SELECT COUNT(*) c FROM students').get().c === 0) {
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const s = db.prepare('INSERT INTO students VALUES (?,?,?,?)');
  [['S001','Rahul Sharma','rahul@example.com','BBA'],['S002','Priya Verma','priya@example.com','B.Com'],
   ['S003','Aman Gupta','aman@example.com','BBA'],['S004','Neha Singh','neha@example.com','B.Com']]
    .forEach(r => s.run(...r));
  const e = db.prepare('INSERT INTO events(name,description,date,time,venue,max_capacity) VALUES (?,?,?,?,?,?)');
  [['AI Workshop','Hands-on intro to AI tools for business.',day(2),'10:00','Seminar Hall A',50],
   ['Business Analytics Workshop','Excel & Power BI for decision making.',day(5),'14:00','Computer Lab 2',30],
   ['Generative AI for Marketing Seminar','Using LLMs for campaigns and content.',day(9),'11:00','Auditorium',100],
   ['Startup Pitch Day','Pitch your idea to industry mentors.',day(15),'15:00','Conference Room',40],
   ['Financial Literacy Seminar','Investing and personal finance basics.',day(22),'12:00','Seminar Hall B',60],
   ['Advanced AI Workshop','Building AI agents with APIs.',day(35),'10:00','Computer Lab 1',25]]
    .forEach(r => e.run(...r));
  db.prepare("INSERT INTO registrations(student_id,event_id) VALUES ('S002',1),('S003',1),('S001',2)").run();
}

// ---- Queries / business logic (shared by REST API and the AI agent) ----
const COUNT = `(SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.event_id AND r.status='Confirmed')`;
module.exports = {
  db,
  allEvents: () => db.prepare(`SELECT e.*, ${COUNT} AS registered FROM events e ORDER BY date,time`).all(),
  getEvent: id => db.prepare(`SELECT e.*, ${COUNT} AS registered FROM events e WHERE event_id=?`).get(id),
  findEvents(keyword, month) {
    let sql = `SELECT e.*, ${COUNT} AS registered FROM events e WHERE 1=1`; const p = [];
    if (keyword) { sql += ' AND (name LIKE ? OR description LIKE ?)'; p.push(`%${keyword}%`, `%${keyword}%`); }
    if (month) { sql += ' AND substr(date,1,7)=?'; p.push(month); }
    return db.prepare(sql + ' ORDER BY date,time').all(...p);
  },
  findEventByName: name => db.prepare(`SELECT e.*, ${COUNT} AS registered FROM events e WHERE name LIKE ? ORDER BY date LIMIT 1`).get(`%${name}%`),
  createEvent: v => db.prepare('INSERT INTO events(name,description,date,time,venue,max_capacity) VALUES (?,?,?,?,?,?)')
    .run(v.name, v.description || '', v.date, v.time, v.venue, v.max_capacity).lastInsertRowid,
  updateEvent: (id, v) => db.prepare('UPDATE events SET name=?,description=?,date=?,time=?,venue=?,max_capacity=? WHERE event_id=?')
    .run(v.name, v.description || '', v.date, v.time, v.venue, v.max_capacity, id).changes,
  deleteEvent: id => db.prepare('DELETE FROM events WHERE event_id=?').run(id).changes,
  getStudent: id => db.prepare('SELECT * FROM students WHERE student_id=?').get(id),
  register(studentId, eventId) {
    const ev = module.exports.getEvent(eventId);
    if (!ev) return { ok: false, error: 'Event not found' };
    const dup = db.prepare('SELECT * FROM registrations WHERE student_id=? AND event_id=?').get(studentId, eventId);
    if (dup && dup.status === 'Confirmed') return { ok: false, error: 'You are already registered for this event' };   // duplicate prevention
    if (ev.registered >= ev.max_capacity) return { ok: false, error: 'Event is full' };
    if (new Date(ev.date + 'T' + ev.time + ':00+05:30') < new Date()) return { ok: false, error: 'This event has already started' };
    if (dup) { db.prepare("UPDATE registrations SET status='Confirmed', calendar_link=NULL, registration_date=CURRENT_TIMESTAMP WHERE registration_id=?").run(dup.registration_id); return { ok: true, id: dup.registration_id }; }
    const id = db.prepare('INSERT INTO registrations(student_id,event_id) VALUES (?,?)').run(studentId, eventId).lastInsertRowid;
    return { ok: true, id };
  },
  setCalendarLink: (id, link) => db.prepare('UPDATE registrations SET calendar_link=? WHERE registration_id=?').run(link, id),
  isRegistered: (sid, eid) => !!db.prepare("SELECT 1 FROM registrations WHERE student_id=? AND event_id=? AND status='Confirmed'").get(sid, eid),
  studentRegistrations: sid => db.prepare(`SELECT r.*, e.name, e.date, e.time, e.venue FROM registrations r
    JOIN events e USING(event_id) WHERE r.student_id=? ORDER BY e.date`).all(sid),
  participants: eid => db.prepare(`SELECT r.registration_id, s.student_id, s.name, s.email, s.course, r.registration_date, r.status
    FROM registrations r JOIN students s USING(student_id) WHERE r.event_id=?`).all(eid),
  cancelRegistration: id => db.prepare("UPDATE registrations SET status='Cancelled' WHERE registration_id=?").run(id).changes,
  stats: () => ({
    events: db.prepare('SELECT COUNT(*) c FROM events').get().c,
    students: db.prepare('SELECT COUNT(*) c FROM students').get().c,
    registrations: db.prepare("SELECT COUNT(*) c FROM registrations WHERE status='Confirmed'").get().c,
  }),
};
