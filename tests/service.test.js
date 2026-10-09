const { test } = require('node:test');
const assert = require('node:assert/strict');
let row, failRemoval, removed;
const calendarPath = require.resolve('../calendar');
const dbPath = require.resolve('../db');
require.cache[calendarPath] = { id: calendarPath, filename: calendarPath, loaded: true, exports: {
  removeFromCalendar: async link => { removed.push(link); if (failRemoval) throw new Error('offline'); },
  addToCalendar: async () => 'https://calendar.google.com/saved'
} };
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  db: { prepare: () => ({ get: () => row && ({ ...row }) }) },
  cancelRegistration: () => { row.status = 'Cancelled'; },
  setCalendarLink: (id, link) => { row.calendar_link = link; }
} };
const { cancelRegistrationFlow } = require('../service');
test('cancellation removes saved invite, clears link and is repeatable', async () => {
  row = { registration_id: 1, status: 'Confirmed', calendar_link: 'saved-link' };
  removed = []; failRemoval = false;
  assert.equal((await cancelRegistrationFlow(1)).calendar.removed, true);
  assert.deepEqual(removed, ['saved-link']);
  assert.equal(row.status, 'Cancelled'); assert.equal(row.calendar_link, null);
  await cancelRegistrationFlow(1); assert.equal(removed.length, 1);
});
test('failed Google deletion keeps booking and link for retry', async () => {
  row = { registration_id: 1, status: 'Confirmed', calendar_link: 'saved-link' };
  removed = []; failRemoval = true;
  await assert.rejects(cancelRegistrationFlow(1), /offline/);
  assert.equal(row.status, 'Confirmed'); assert.equal(row.calendar_link, 'saved-link');
});
test('already cancelled booking can clean up its remaining invite', async () => {
  row = { registration_id: 1, status: 'Cancelled', calendar_link: 'saved-link' };
  removed = []; failRemoval = false;
  await cancelRegistrationFlow(1); assert.equal(row.calendar_link, null);
  assert.deepEqual(removed, ['saved-link']);
});
