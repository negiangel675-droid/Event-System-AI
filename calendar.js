// Google Calendar API integration (OAuth2). Secrets come from .env, never from frontend.
const { google } = require('googleapis');
const fs = require('fs');
const TOKEN_FILE = 'google-token.json';

function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback');
}
const authUrl = state => oauthClient().generateAuthUrl({
  state, access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/calendar.events'] });
async function saveToken(code) {
  const { tokens } = await oauthClient().getToken(code);
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens));
}
async function checkConnection() {
  if (!fs.existsSync(TOKEN_FILE)) return { connected: false, message: 'Connect your Google Calendar to enable invitations.' };
  try {
    const auth = oauthClient();
    auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
    auth.on('tokens', tokens => fs.writeFileSync(TOKEN_FILE,
      JSON.stringify({ ...auth.credentials, ...tokens }), { mode: 0o600 }));
    await google.calendar({ version: 'v3', auth }).events.list(
      { calendarId: 'primary', maxResults: 1, fields: 'kind' },
      { timeout: 10000, retry: false });
    return { connected: true, message: 'Google Calendar connection verified. New registrations will create calendar invitations.' };
  } catch (e) {
    const reason = e.response?.data?.error?.errors?.[0]?.reason;
    const status = e.response?.status || e.code;
    const message = reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED'
      ? 'Enable Google Calendar API in your Google Cloud project, then refresh status.'
      : status === 401 || e.response?.data?.error === 'invalid_grant'
        ? 'Google authorization expired or was revoked. Reconnect Google Calendar.'
        : status === 403
          ? 'Google Calendar access denied. Enable the Calendar API and reconnect with Calendar permission.'
          : 'Unable to verify Google Calendar. Check your internet connection and try again; reconnect if the problem continues.';
    return { connected: false, message };
  }
}
async function addToCalendar(student, event) {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error('Google Calendar not connected (visit /auth/google once)');
  const auth = oauthClient();
  auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE)));
  const start = new Date(`${event.date}T${event.time}:00+05:30`);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const res = await google.calendar({ version: 'v3', auth }).events.insert({
    calendarId: 'primary', sendUpdates: 'all',
    requestBody: {
      summary: event.name, location: event.venue, description: event.description,
      start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
      attendees: [{ email: student.email, displayName: student.name }],
    },
  });
  return res.data.htmlLink;
}
async function removeFromCalendar(link) {
  const url = new URL(link);
  if (!['www.google.com', 'calendar.google.com'].includes(url.hostname)) throw new Error('Invalid saved calendar link');
  const eid = url.searchParams.get('eid');
  if (!eid) throw new Error('Saved calendar event ID is missing');
  const [eventId, calendarId] = Buffer.from(eid, 'base64url').toString('utf8').split(' ');
  if (!eventId || !calendarId) throw new Error('Invalid saved calendar event ID');
  const auth = oauthClient();
  auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
  try {
    await google.calendar({ version: 'v3', auth }).events.delete(
      { calendarId, eventId, sendUpdates: 'all' }, { timeout: 10000, retry: false });
  } catch (e) {
    if (![404, 410].includes(e.response?.status || e.code)) throw e;
  }
}
module.exports = { authUrl, saveToken, addToCalendar, checkConnection, removeFromCalendar };
