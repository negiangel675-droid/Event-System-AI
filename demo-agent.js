// Explicit deterministic demo mode; real LLM function calling lives in agent.js.
const q = require('./db');
const { registerFlow } = require('./service');
async function askDemo(message, user) {
  const text=message.toLowerCase();
  const events=q.allEvents();
  const match=events.find(e=>text.includes(e.name.toLowerCase())) || events.filter(e=>e.name.toLowerCase().split(' ').filter(w=>w.length>2).some(w=>text.includes(w))).sort((a,b)=>b.name.toLowerCase().split(' ').filter(w=>text.includes(w)).length-a.name.toLowerCase().split(' ').filter(w=>text.includes(w)).length)[0];
  let reply, action='search_events';
  if (/\b(register me|sign me up|book me|enroll me)\b/.test(text)) {
    action='register_me';
    if(user.role!=='student') reply='Sign in as a student to register for an event.';
    else if(!match) reply='Please include the full event name, for example: Register me for the AI Workshop.';
    else { const r=await registerFlow(q.getStudent(user.studentId),match); reply=r.ok?`You are registered for ${match.name} on ${match.date} at ${match.time}. ${r.calendar.ok?'Google Calendar synced.':'Calendar was not synced. Your registration is saved; you can download a calendar file from My schedule.'}`:r.error; }
  } else if (/my (schedule|registrations)|am i registered/.test(text)) {
    action='check_my_registration';
    if(user.role!=='student') reply='Personal registrations are available for student accounts.';
    else { const rows=q.studentRegistrations(user.studentId).filter(r=>r.status==='Confirmed'); reply=match?`${match.name}: ${q.isRegistered(user.studentId,match.event_id)?'you are registered':'you are not registered'}.`:rows.map(r=>`${r.name} · ${r.date} · ${r.time}`).join('\n')||'No registrations yet. Explore events to get started.'; }
  } else if (/how many|count|total/.test(text)) { action='count_registrations'; reply=match?`${match.name} has ${match.registered} confirmed registrations out of ${match.max_capacity} seats.`:`There are ${q.stats().registrations} confirmed registrations across ${events.length} events.`; }
  else { let list=events.filter(e=>new Date(e.date+'T'+e.time+':00+05:30')>new Date()); if (/this month/.test(text)) list=list.filter(e=>e.date.slice(0,7)===new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}).slice(0,7)); const keyword=['analytics','marketing','startup','financial','ai','workshop','seminar'].find(k=>new RegExp('\\b'+k+'\\b').test(text)); if(keyword) list=list.filter(e=>(e.name+' '+e.description).toLowerCase().includes(keyword)); reply=list.map(e=>`${e.name} · ${e.date} at ${e.time} · ${e.max_capacity-e.registered} seats available`).join('\n') || 'No matching upcoming events. Try “Show all events”.'; }
  return {reply,mode:'demo',action};
}
module.exports={askDemo};
