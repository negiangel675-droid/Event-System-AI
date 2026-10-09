// LLM-powered AI agent: Gemini with function calling. The LLM decides which tool to call.
const q = require('./db');
const { registerFlow } = require('./service');

const tools = [{ functionDeclarations: [
  { name: 'search_events', description: 'Search events by keyword and/or month. Use for "which workshops are happening this month".',
    parameters: { type: 'OBJECT', properties: {
      keyword: { type: 'STRING', description: 'e.g. "AI", "analytics"' },
      month: { type: 'STRING', description: 'YYYY-MM' } } } },
  { name: 'check_my_registration', description: 'Check whether the current student is registered for an event.',
    parameters: { type: 'OBJECT', properties: { event_name: { type: 'STRING' } }, required: ['event_name'] } },
  { name: 'count_registrations', description: 'Number of students registered, for one event (event_name) or overall (omit event_name).',
    parameters: { type: 'OBJECT', properties: { event_name: { type: 'STRING' } } } },
  { name: 'register_me', description: 'Register the current student for an event and add it to their Google Calendar.',
    parameters: { type: 'OBJECT', properties: { event_name: { type: 'STRING' } }, required: ['event_name'] } },
]}];

async function runTool(name, args, user) {
  const student = user.role === 'student' ? q.getStudent(user.studentId) : null;
  const ev = () => q.findEventByName(args.event_name);
  switch (name) {
    case 'search_events': return { events: q.findEvents(args.keyword, args.month) };
    case 'count_registrations': {
      if (!args.event_name) return { total_confirmed_registrations: q.stats().registrations };
      const e = ev(); return e ? { event: e.name, registered: e.registered, capacity: e.max_capacity } : { error: 'Event not found' };
    }
    case 'check_my_registration': {
      if (!student) return { error: 'Only students have registrations' };
      const e = ev(); if (!e) return { error: 'Event not found' };
      return { event: e.name, registered: q.isRegistered(student.student_id, e.event_id) };
    }
    case 'register_me': {
      if (!student) return { error: 'Only students can register' };
      const e = ev(); if (!e) return { error: 'Event not found' };
      return { event: e.name, ...(await registerFlow(student, e)) };
    }
    default: return { error: 'Unknown tool' };
  }
}

async function askAgent(message, history, user) {
  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the college Event Assistant. Today is ${today}. User role: ${user.role}` +
    (user.studentId ? ` (student ID ${user.studentId})` : '') +
    `. Always use the tools to get real data; never invent events or numbers. Be concise and friendly.`;
  const contents = [...history.slice(-8).filter(h => h && typeof h.text === 'string').map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: message }] }];

  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Gemini API error');
    const parts = data.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) return parts.map(p => p.text || '').join('').trim() || 'Sorry, I could not answer that.';
    contents.push({ role: 'model', parts });
    const responses = [];
    for (const c of calls) {
      console.log('Agent tool call:', c.functionCall.name, c.functionCall.args);
      responses.push({ functionResponse: { name: c.functionCall.name, response: await runTool(c.functionCall.name, c.functionCall.args || {}, user) } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return 'Sorry, I could not complete that request.';
}
module.exports = { askAgent };
