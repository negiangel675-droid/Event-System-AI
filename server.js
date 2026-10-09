require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const q = require('./db');
const { registerFlow, saveRegistrationCalendar, cancelRegistrationFlow } = require('./service');
const { askAgent } = require('./agent');
const cal = require('./calendar');

const app = express();
app.use(express.json({limit:'32kb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next();});
app.use(express.static('public'));

// ---- Simple auth: students log in with Student ID, admin with password ----
q.db.exec('CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user TEXT NOT NULL, expires INTEGER NOT NULL)');
const sessions = { set(token, user) { q.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, JSON.stringify(user), Date.now()+86400000); }, get(token) { const s=q.db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(token || '',Date.now()); return s ? JSON.parse(s.user) : null; } };
app.post('/api/login', (req, res) => {
  const { role, studentId, password } = req.body;
  if (!['student','admin'].includes(role)) return res.status(400).json({error:'Choose a valid role'});
  let user;
  if (role === 'admin') {
    if (password !== (process.env.ADMIN_PASSWORD || 'admin123')) return res.status(401).json({ error: 'Wrong admin password' });
    user = { role: 'admin', name: 'Admin' };
  } else {
    const s = q.getStudent((studentId || '').trim().toUpperCase());
    if (!s) return res.status(401).json({ error: 'Student ID not found' });
    user = { role: 'student', studentId: s.student_id, name: s.name };
  }
  const token = crypto.randomUUID(); sessions.set(token, user);
  res.json({ token, user });
});
const auth = (req, res, next) => {
  const u = sessions.get(req.headers['x-token']);
  if (!u) return res.status(401).json({ error: 'Please log in' });
  req.user = u; next();
};
const adminOnly = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
const studentOnly = (req, res, next) => req.user.role === 'student' ? next() : res.status(403).json({ error: 'Students only' });

// ---- Validation ----
function validEvent(b) {
  const need = ['name', 'date', 'time', 'venue'];
  for (const k of need) if (!b[k] || !String(b[k]).trim()) return `${k} is required`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return 'Date must be YYYY-MM-DD';
  if (!/^\d{2}:\d{2}$/.test(b.time)) return 'Time must be HH:MM';
  if (!Number.isInteger(Number(b.max_capacity)) || Number(b.max_capacity) < 1 || Number(b.max_capacity) > 100000) return 'Capacity must be a positive number';
  if (Number(b.time.slice(0,2)) > 23 || Number(b.time.slice(3)) > 59 || Number.isNaN(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0,10) !== b.date) return 'Enter a valid date and time';
  if (String(b.name).length > 150 || String(b.venue).length > 200 || String(b.description || '').length > 5000) return 'Event details are too long';
  return null;
}

// ---- Events (CRUD) ----
app.post('/api/logout', auth, (req,res) => { q.db.prepare('DELETE FROM sessions WHERE token=?').run(req.headers['x-token']); res.json({ok:true}); });
app.get('/api/me', auth, (req,res) => res.json(req.user));
app.get('/api/integrations', auth, (req,res) => res.json({ai:!!process.env.GEMINI_API_KEY, calendar:require('fs').existsSync('google-token.json'), oauth:!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}));
app.post('/api/calendar/status', auth, adminOnly, async (req,res,next) => {
  try { res.json(await cal.checkConnection()); } catch (e) { next(e); }
});
app.delete('/api/my-registrations/:id', auth, studentOnly, async (req,res) => { const row=q.db.prepare('SELECT * FROM registrations WHERE registration_id=? AND student_id=?').get(req.params.id,req.user.studentId); if(!row) return res.status(404).json({error:'Registration not found'}); try { res.json(await cancelRegistrationFlow(row.registration_id)); } catch { res.status(502).json({error:'Google Calendar cancellation failed. Refresh the connection and retry Cancel.'}); } });
app.get('/api/events', auth, (req, res) => {
  const list = q.allEvents();
  if (req.user.role === 'student') list.forEach(e => e.is_registered = q.isRegistered(req.user.studentId, e.event_id));
  res.json(list);
});
app.get('/api/events/:id', auth, (req, res) => { const e = q.getEvent(req.params.id); e ? res.json(e) : res.status(404).json({ error: 'Not found' }); });
app.post('/api/events', auth, adminOnly, (req, res) => {
  const err = validEvent(req.body); if (err) return res.status(400).json({ error: err });
  res.json({ event_id: q.createEvent(req.body) });
});
app.put('/api/events/:id', auth, adminOnly, (req, res) => {
  const err = validEvent(req.body); if (err) return res.status(400).json({ error: err });
  const existing=q.getEvent(req.params.id);
  if (existing && Number(req.body.max_capacity) < existing.registered) return res.status(400).json({error:'Capacity cannot be below confirmed registrations'});
  q.updateEvent(req.params.id, req.body) ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/events/:id', auth, adminOnly, (req, res) =>
  q.deleteEvent(req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' }));

// ---- Registrations ----
app.post('/api/events/:id/register', auth, studentOnly, async (req, res) => {
  const ev = q.getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  const r = await registerFlow(q.getStudent(req.user.studentId), ev);
  r.ok ? res.json(r) : res.status(400).json(r);
});
app.get('/api/my-registrations', auth, studentOnly, (req, res) => res.json(q.studentRegistrations(req.user.studentId)));
app.post('/api/my-registrations/:id/calendar', auth, studentOnly, async (req,res) => {
  const registration = q.db.prepare("SELECT * FROM registrations WHERE registration_id=? AND student_id=? AND status='Confirmed'").get(req.params.id, req.user.studentId);
  if (!registration) return res.status(404).json({ error: 'Confirmed registration not found' });
  try { res.json(await saveRegistrationCalendar(registration)); }
  catch (e) { res.status(502).json({ error: 'Calendar save failed. Ask your organiser to check the Google Calendar connection, then retry.' }); }
});
app.get('/api/events/:id/participants', auth, adminOnly, (req, res) => res.json(q.participants(req.params.id)));
app.delete('/api/registrations/:id', auth, adminOnly, async (req, res) => { try { const result=await cancelRegistrationFlow(Number(req.params.id)); res.status(result.ok?200:404).json(result); } catch { res.status(502).json({error:'Google Calendar cancellation failed. Refresh the connection and retry Cancel.'}); } });
app.get('/api/stats', auth, adminOnly, (req, res) => res.json(q.stats()));

// ---- AI agent ----
app.post('/api/agent', auth, async (req, res) => {
  try {
    if (typeof req.body.message !== 'string' || !req.body.message.trim() || req.body.message.length > 2000 || (req.body.history && !Array.isArray(req.body.history))) return res.status(400).json({error:'Enter a message up to 2,000 characters'});
    if (!process.env.GEMINI_API_KEY) return res.json(await require('./demo-agent').askDemo(req.body.message,req.user));
    res.json({ mode:'gemini', reply: await askAgent(req.body.message, req.body.history || [], req.user) });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ---- Google OAuth (one-time connect by the organiser) ----
q.db.exec('CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
app.post('/api/calendar/connect', auth, adminOnly, (req,res)=>{
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({error:'Set Google OAuth credentials in .env and restart first.'});
  const state=crypto.randomBytes(24).toString('hex');
  q.db.prepare('DELETE FROM oauth_states WHERE expires<?').run(Date.now());
  q.db.prepare('INSERT INTO oauth_states VALUES (?,?)').run(state,Date.now()+600000);
  res.setHeader('Set-Cookie',`gather-oauth=${state}; HttpOnly; SameSite=Lax; Path=/auth/google/callback; Max-Age=600`);
  res.json({url:cal.authUrl(state)});
});
app.get('/auth/google', (req,res)=>res.redirect('/'));
app.get('/auth/google/callback', async (req, res) => {
  const state=typeof req.query.state==='string'?req.query.state:'';
  const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('gather-oauth='))?.slice(13);
  const valid=q.db.prepare('SELECT state FROM oauth_states WHERE state=? AND expires>?').get(state,Date.now());
  if(!valid || cookie!==state) return res.status(400).send('Invalid or expired OAuth request. Connect again from Integrations.');
  q.db.prepare('DELETE FROM oauth_states WHERE state=?').run(state);
  res.setHeader('Set-Cookie','gather-oauth=; HttpOnly; SameSite=Lax; Path=/auth/google/callback; Max-Age=0');
  if(typeof req.query.code!=='string') return res.status(400).send('Google connection was not approved. Try again from Integrations.');
  try { await cal.saveToken(req.query.code); res.redirect('/?calendar=connected'); }
  catch (e) { res.status(500).send('OAuth failed. Check your server credentials and try again.'); }
});
app.use((err,req,res,next)=>{ console.error(err.message); res.status(err.status||500).json({error:err.status===400?'Invalid request body':'Unable to complete the request'}); });

app.listen(process.env.PORT || 3000, () => console.log('Running on http://localhost:' + (process.env.PORT || 3000)));
