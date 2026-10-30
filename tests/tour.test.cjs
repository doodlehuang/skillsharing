'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../public/tour.js');

const CTX = {
  authed: false,
  userId: 'u1',
  userName: '周予安',
  routeName: 'discover',
  routePath: '/discover',
  exchangeId: 'ex1',
  partnerId: 'u2',
  partnerName: '林小满',
  requesterId: 'u1',
  requesterName: '周予安',
};

const IDS = [
  'enter',
  'discover',
  'propose',
  'to-partner',
  'accept',
  'chat',
  'to-self',
  'complete',
  'review',
  'ledger-nav',
  'ledger',
];

test('module exports the pure tour contract', async () => {
  const tour = await load();
  assert.equal(tour.TOUR_STORAGE_KEY, 'skillloop.tour.v1');
  assert.equal(typeof tour.createTour, 'function');
  assert.equal(typeof tour.tourSteps, 'function');
  assert.equal(typeof tour.parseTourState, 'function');
  assert.equal(typeof tour.serializeTourState, 'function');
  assert.equal(typeof tour.matchesWait, 'function');
  assert.equal(tour.TOUR_STEP_COUNT, 11);
});

test('tour has 11 steps in the fixed order', async () => {
  const { tourSteps } = await load();
  const steps = tourSteps(CTX);
  assert.equal(steps.length, 11);
  assert.deepEqual(
    steps.map((step) => step.id),
    IDS,
  );
});

test('every step text is one or two short lines (<= 30 chars)', async () => {
  const { tourSteps } = await load();
  for (const step of tourSteps(CTX)) {
    assert.equal(typeof step.text, 'string', `${step.id} text is a string`);
    assert.ok(step.text.length > 0, `${step.id} text is not empty`);
    assert.ok(step.text.length <= 30, `${step.id} text is ${step.text.length} chars: ${step.text}`);
  }
});

test('each step is addressable and falls back somewhere sane', async () => {
  const { tourSteps } = await load();
  const steps = tourSteps(CTX);
  assert.equal(new Set(steps.map((step) => step.id)).size, 11);
  for (const step of steps) {
    assert.ok(Array.isArray(step.targets) && step.targets.length > 0, `${step.id} has targets`);
    for (const selector of step.targets) assert.equal(typeof selector, 'string');
    assert.equal(typeof step.fallbackPath, 'string', `${step.id} has a fallbackPath`);
    assert.match(step.fallbackPath, /^\//, `${step.id} fallbackPath starts with /`);
  }
  assert.equal(steps[0].fallbackPath, '/demo');
  assert.equal(steps[1].fallbackPath, '/discover');
  assert.equal(steps[2].fallbackPath, '/exchanges/ex1');
  assert.equal(steps[3].fallbackPath, '/exchanges/ex1');
  assert.equal(steps[9].fallbackPath, '/me');
  assert.equal(steps[10].fallbackPath, '/me');
});

test('exchange steps degrade to the exchange list without an id', async () => {
  const { tourSteps } = await load();
  const steps = tourSteps({ authed: true, userId: 'u1' });
  assert.equal(steps[2].fallbackPath, '/exchanges');
  assert.equal(steps[4].fallbackPath, '/exchanges');
  assert.deepEqual(steps[3].targets, ['[data-menu-toggle]']);
  assert.deepEqual(steps[6].targets, ['[data-menu-toggle]']);
});

test('every step has a canonical navigation path', async () => {
  const { tourSteps, stepPath } = await load();
  const steps = tourSteps(CTX);
  assert.deepEqual(steps.map((step) => step.path), [
    '/',
    '/discover',
    '/discover',
    '/exchanges/ex1',
    '/exchanges/ex1',
    '/exchanges/ex1',
    '/exchanges/ex1',
    '/exchanges/ex1',
    '/exchanges/ex1',
    '/me',
    '/me',
  ]);
  assert.deepEqual(
    steps.map((step) => stepPath(step)),
    ['/', '/discover', '/discover', '/exchanges/ex1', '/exchanges/ex1', '/exchanges/ex1', '/exchanges/ex1', '/exchanges/ex1', '/exchanges/ex1', '/me', '/me'],
  );
  // No exchange id in context: the exchange steps point at the list.
  const list = tourSteps({ authed: true });
  assert.equal(stepPath(list[3]), '/exchanges');
  assert.equal(stepPath(list[8]), '/exchanges');
  // Legacy steps without `path` still resolve through fallbackPath.
  assert.equal(stepPath({ id: 'legacy', fallbackPath: '/fallback/' }), '/fallback');
});

test('normalizeRoutePath normalizes trailing slashes and empties', async () => {
  const { normalizeRoutePath } = await load();
  assert.equal(normalizeRoutePath('/me'), '/me');
  assert.equal(normalizeRoutePath('/me/'), '/me');
  assert.equal(normalizeRoutePath('/me//'), '/me');
  assert.equal(normalizeRoutePath(''), '/');
  assert.equal(normalizeRoutePath(null), '/');
  assert.equal(normalizeRoutePath('me'), '/me');
});

test('auto-navigation targets a step page only when needed and once per visit', async () => {
  const { tourSteps, shouldAutoNavigate, stepNavKey } = await load();
  const steps = tourSteps(CTX);
  const propose = steps[2];
  assert.equal(shouldAutoNavigate(propose, { authed: true, routePath: '/exchanges' }), true);
  assert.equal(shouldAutoNavigate(propose, { authed: true, routePath: '/discover' }), false);
  assert.equal(shouldAutoNavigate(propose, { authed: true, routePath: '/discover/' }), false);
  // One-shot: the same step visit never navigates twice.
  assert.equal(shouldAutoNavigate(propose, { authed: true, routePath: '/exchanges' }, stepNavKey(propose)), false);
  // A different step on the same path is a new visit and navigates again.
  const review = steps[8];
  assert.equal(shouldAutoNavigate(review, { authed: true, routePath: '/exchanges' }), true);
  // Exchange-detail steps match the exact exchange route.
  const chat = steps[5];
  assert.equal(shouldAutoNavigate(chat, { authed: true, routePath: '/exchanges/ex1' }), false);
  assert.equal(shouldAutoNavigate(chat, { authed: true, routePath: '/discover' }), true);
  // Ledger steps land on /me.
  assert.equal(shouldAutoNavigate(steps[10], { authed: true, routePath: '/exchanges/ex1' }), true);
  assert.equal(shouldAutoNavigate(steps[10], { authed: true, routePath: '/me' }), false);
});

test('guests are never auto-navigated to authed-only routes', async () => {
  const { tourSteps, shouldAutoNavigate } = await load();
  const guest = { authed: false, routePath: '/login' };
  const steps = tourSteps(guest);
  assert.equal(shouldAutoNavigate(steps[1], guest), false); // discover
  assert.equal(shouldAutoNavigate(steps[2], guest), false); // propose
  assert.equal(shouldAutoNavigate(steps[5], guest), false); // chat
  assert.equal(shouldAutoNavigate(steps[9], guest), false); // ledger-nav
  assert.equal(shouldAutoNavigate(steps[10], guest), false); // ledger
  // The enter step keeps '/', which is guest-safe.
  assert.equal(shouldAutoNavigate(steps[0], guest), true);
  assert.equal(shouldAutoNavigate(steps[0], { authed: false, routePath: '/' }), false);
});

test('去这一页 is hidden when it would be a no-op or unsafe for a guest', async () => {
  const { tourSteps, fallbackButtonVisible } = await load();
  const authed = { authed: true };
  const steps = tourSteps({ ...CTX, authed: true });
  // On the step's own page the button would do nothing (the reported bug).
  assert.equal(fallbackButtonVisible(steps[2], { ...authed, routePath: '/discover' }), false);
  assert.equal(fallbackButtonVisible(steps[10], { ...authed, routePath: '/me' }), false);
  assert.equal(fallbackButtonVisible(steps[5], { ...authed, routePath: '/exchanges/ex1' }), false);
  // Off the step's page it is shown.
  assert.equal(fallbackButtonVisible(steps[2], { ...authed, routePath: '/exchanges' }), true);
  assert.equal(fallbackButtonVisible(steps[10], { ...authed, routePath: '/discover' }), true);
  // Guests must not be pointed at authed-only routes, but '/' stays allowed.
  const guest = { authed: false, routePath: '/login' };
  const guestSteps = tourSteps(guest);
  assert.equal(fallbackButtonVisible(guestSteps[1], guest), false);
  assert.equal(fallbackButtonVisible(guestSteps[10], guest), false);
  assert.equal(fallbackButtonVisible(guestSteps[0], guest), true);
});

test('identity steps interpolate the stored names', async () => {
  const { tourSteps } = await load();
  const steps = tourSteps(CTX);
  assert.match(steps[3].text, /林小满/);
  assert.match(steps[3].text, /切到/);
  assert.match(steps[6].text, /周予安/);
  assert.match(steps[6].text, /切回/);
  assert.deepEqual(steps[3].targets, ['[data-demo-switch="u2"]', '[data-menu-toggle]']);
  assert.deepEqual(steps[6].targets, ['[data-demo-switch="u1"]', '[data-menu-toggle]']);

  const anonymous = tourSteps({ authed: true });
  assert.equal(anonymous[3].text, '请求已发出。点右上角头像，切到对方身份。');
  assert.equal(anonymous[6].text, '切回你自己的身份，完成这次交换。');
});

test('selector ids are sanitized before interpolating', async () => {
  const { tourSteps } = await load();
  const steps = tourSteps({ authed: true, partnerId: 'u2"] , body', requesterId: 'u1' });
  assert.deepEqual(steps[3].targets, ['[data-menu-toggle]']);
});

test('enter is skipped for an authed visitor', async () => {
  const { tourSteps, applicableSteps } = await load();
  const authed = applicableSteps({ authed: true, userId: 'u1' });
  assert.equal(authed.length, 10);
  assert.ok(!authed.some((step) => step.id === 'enter'));
  assert.equal(authed[0].id, 'discover');

  const guest = applicableSteps({ authed: false });
  assert.equal(guest.length, 11);
  assert.equal(guest[0].id, 'enter');
  assert.equal(tourSteps({ authed: false })[0].when({ authed: false }), true);
  assert.equal(tourSteps({ authed: false })[0].when({ authed: true }), false);
});

test('serialize/parse round-trips the persisted state', async () => {
  const { parseTourState, serializeTourState } = await load();
  const state = {
    v: 1,
    active: true,
    step: 4,
    done: false,
    ctx: { exchangeId: 'ex1', partnerId: 'u2', partnerName: '林小满', requesterId: 'u1', requesterName: '周予安' },
    currentIdentityId: 'u2',
  };
  const raw = serializeTourState(state);
  assert.equal(typeof raw, 'string');
  assert.deepEqual(parseTourState(raw), state);
  assert.deepEqual(parseTourState(serializeTourState(parseTourState(raw))), state);
});

test('malformed state degrades to a clean, clamped state', async () => {
  const { parseTourState, serializeTourState } = await load();
  const clean = { v: 1, active: false, step: 0, done: false, ctx: { exchangeId: null, partnerId: null, partnerName: null, requesterId: null, requesterName: null }, currentIdentityId: null };

  assert.deepEqual(parseTourState(''), clean);
  assert.deepEqual(parseTourState(null), clean);
  assert.deepEqual(parseTourState('not json'), clean);
  assert.deepEqual(parseTourState('[]'), clean);
  assert.deepEqual(parseTourState('{"v":2,"active":true}'), clean);
  assert.deepEqual(parseTourState('{"active":true}'), clean);

  const clamped = parseTourState('{"v":1,"active":true,"step":99,"done":false,"ctx":{"partnerId":12,"partnerName":"  "},"currentIdentityId":7}');
  assert.equal(clamped.step, 10);
  assert.equal(clamped.active, true);
  assert.equal(clamped.ctx.partnerId, null);
  assert.equal(clamped.ctx.partnerName, null);
  assert.equal(clamped.currentIdentityId, null);

  assert.equal(parseTourState('{"v":1,"step":-3}').step, 0);
  assert.equal(parseTourState('{"v":1,"step":"nope"}').step, 0);
  assert.equal(parseTourState('{"v":1,"active":"yes"}').active, false);

  // 完成 is the only state that flips done, and it always deactivates.
  const finished = parseTourState('{"v":1,"active":true,"done":true,"step":10}');
  assert.equal(finished.active, false);
  assert.equal(finished.done, true);

  assert.equal(serializeTourState(null), serializeTourState(parseTourState(null)));
});

test('matchesWait understands exchange creation', async () => {
  const { matchesWait } = await load();
  assert.equal(matchesWait({ type: 'exchange-created' }, { exchangeId: 'ex1' }, {}), true);
  assert.equal(matchesWait({ type: 'exchange-created' }, {}, {}), false);
  assert.equal(matchesWait({ type: 'exchange-created' }, null, {}), false);
});

test('matchesWait understands identity switches', async () => {
  const { matchesWait } = await load();
  // Partner id known: only that identity satisfies the wait.
  assert.equal(matchesWait({ type: 'identity-switched', to: 'partner' }, { userId: 'u2' }, { partnerId: 'u2' }), true);
  assert.equal(matchesWait({ type: 'identity-switched', to: 'partner' }, { userId: 'u9' }, { partnerId: 'u2' }), false);
  // Partner id unknown: any identity change from the recorded baseline counts.
  assert.equal(matchesWait({ type: 'identity-switched', to: 'partner' }, { userId: 'u9' }, {}, 'u1'), true);
  assert.equal(matchesWait({ type: 'identity-switched', to: 'partner' }, { userId: 'u1' }, {}, 'u1'), false);
  assert.equal(matchesWait({ type: 'identity-switched', to: 'partner' }, { userId: 'u9' }, {}), false);
  // Requester wait mirrors it.
  assert.equal(matchesWait({ type: 'identity-switched', to: 'requester' }, { userId: 'u1' }, { requesterId: 'u1' }), true);
  assert.equal(matchesWait({ type: 'identity-switched', to: 'requester' }, { userId: 'u2' }, { requesterId: 'u1' }), false);
  assert.equal(matchesWait({ type: 'identity-switched' }, { userId: 'u3' }, {}), true);
  assert.equal(matchesWait({ type: 'identity-switched' }, {}, {}), false);
});

test('matchesWait understands exchange status, chat and review events', async () => {
  const { matchesWait } = await load();
  const ctx = { exchangeId: 'ex1' };
  assert.equal(matchesWait({ type: 'exchange-status', status: 'accepted' }, { exchangeId: 'ex1', status: 'accepted' }, ctx), true);
  assert.equal(matchesWait({ type: 'exchange-status', status: 'completed' }, { exchangeId: 'ex1', status: 'accepted' }, ctx), false);
  assert.equal(matchesWait({ type: 'exchange-status', status: 'accepted' }, { exchangeId: 'ex2', status: 'accepted' }, ctx), false);
  assert.equal(matchesWait({ type: 'exchange-status', status: 'accepted' }, { status: 'accepted' }, ctx), true);

  assert.equal(matchesWait({ type: 'message-sent' }, { exchangeId: 'ex1' }, ctx), true);
  assert.equal(matchesWait({ type: 'message-sent' }, { exchangeId: 'ex2' }, ctx), false);
  assert.equal(matchesWait({ type: 'review-submitted' }, { exchangeId: 'ex1' }, ctx), true);
  assert.equal(matchesWait({ type: 'review-submitted' }, {}, ctx), true);
  assert.equal(matchesWait({ type: 'propose-opened' }, {}, ctx), true);
});

test('matchesWait understands route steps', async () => {
  const { matchesWait } = await load();
  const wait = { type: 'route', path: '/me', names: ['profile'] };
  assert.equal(matchesWait(wait, {}, { routePath: '/me', routeName: 'profile' }), true);
  assert.equal(matchesWait(wait, {}, { routePath: '/discover', routeName: 'discover' }), false);
  assert.equal(matchesWait(wait, {}, { routeName: 'profile' }), true);
  assert.equal(matchesWait(wait, {}, {}), false);
});

test('matchesWait ignores unknown or absent waits', async () => {
  const { matchesWait } = await load();
  assert.equal(matchesWait(null, {}, {}), false);
  assert.equal(matchesWait({}, {}, {}), false);
  assert.equal(matchesWait({ type: 'mystery' }, {}, {}), false);
  assert.equal(matchesWait({ type: 'exchange-status' }, {}, {}), false);
});

test('notification type gate: a wrong event never advances a wait', async () => {
  const { matchesWait, notificationMatchesWait } = await load();
  // The raw matcher is type-blind on purpose (propose-opened carries no detail);
  // the gate is what stops an identity switch from advancing the discover step.
  assert.equal(matchesWait({ type: 'propose-opened' }, { userId: 'u1' }, {}), true);
  assert.equal(notificationMatchesWait({ type: 'propose-opened' }, 'identity-switched', { userId: 'u1' }, {}), false);
  assert.equal(notificationMatchesWait({ type: 'propose-opened' }, 'propose-opened', {}, {}), true);
  // ...and a propose-opened notification must not advance an identity wait.
  assert.equal(notificationMatchesWait({ type: 'identity-switched', to: 'partner' }, 'propose-opened', { userId: 'u2' }, { partnerId: 'u2' }), false);
  assert.equal(notificationMatchesWait({ type: 'identity-switched', to: 'partner' }, 'identity-switched', { userId: 'u2' }, { partnerId: 'u2' }), true);
});

test('notification gate: exchange-updated only satisfies its own exchange status', async () => {
  const { notificationMatchesWait } = await load();
  const wait = { type: 'exchange-status', status: 'accepted' };
  assert.equal(notificationMatchesWait(wait, 'exchange-updated', { exchangeId: 'ex1', status: 'accepted' }, { exchangeId: 'ex1' }), true);
  assert.equal(notificationMatchesWait(wait, 'exchange-updated', { exchangeId: 'ex2', status: 'accepted' }, { exchangeId: 'ex1' }), false);
  assert.equal(notificationMatchesWait(wait, 'identity-switched', { exchangeId: 'ex1', status: 'accepted' }, { exchangeId: 'ex1' }), false);
  assert.equal(notificationMatchesWait(wait, 'exchange-updated', { exchangeId: 'ex1', status: 'completed' }, { exchangeId: 'ex1' }), false);
});

test('notification gate: message, review and exchange-created still advance', async () => {
  const { notificationMatchesWait } = await load();
  assert.equal(notificationMatchesWait({ type: 'message-sent' }, 'message-sent', { exchangeId: 'ex1' }, { exchangeId: 'ex1' }), true);
  assert.equal(notificationMatchesWait({ type: 'review-submitted' }, 'review-submitted', { exchangeId: 'ex1' }, { exchangeId: 'ex1' }), true);
  assert.equal(notificationMatchesWait({ type: 'review-submitted' }, 'message-sent', { exchangeId: 'ex1' }, { exchangeId: 'ex1' }), false);
  assert.equal(notificationMatchesWait({ type: 'exchange-created' }, 'exchange-created', { exchangeId: 'ex1' }, {}), true);
  assert.equal(notificationMatchesWait({ type: 'exchange-created' }, 'identity-switched', { exchangeId: 'ex1' }, {}), false);
  // Route waits are refresh-driven, never notification-driven.
  assert.equal(notificationMatchesWait({ type: 'route', path: '/me', names: ['profile'] }, 'exchange-updated', {}, { routeName: 'profile' }), false);
});

/* ---------------- start() first-visit semantics (localStorage only, no DOM) ---------------- */

const STORAGE_KEY = 'skillloop.tour.v1';

function installStorage(raw) {
  const store = new Map();
  if (typeof raw === 'string') store.set(STORAGE_KEY, raw);
  globalThis.localStorage = {
    getItem: (name) => (store.has(name) ? store.get(name) : null),
    setItem: (name, value) => store.set(name, String(value)),
    removeItem: (name) => store.delete(name),
  };
  return {
    read() {
      const value = store.get(STORAGE_KEY);
      return typeof value === 'string' ? JSON.parse(value) : null;
    },
    raw() {
      return store.has(STORAGE_KEY) ? store.get(STORAGE_KEY) : null;
    },
    restore() {
      Reflect.deleteProperty(globalThis, 'localStorage');
    },
  };
}

const finishedState = JSON.stringify({
  v: 1,
  active: false,
  step: 10,
  done: true,
  ctx: { exchangeId: 'ex1', partnerId: 'u2', partnerName: '林小满', requesterId: 'u1', requesterName: '周予安' },
  currentIdentityId: 'u1',
});

test('start() auto-opens on a first-ever visit at step 0 for a guest', async () => {
  const { createTour } = await load();
  const storage = installStorage(null);
  try {
    const tour = createTour({ getContext: () => ({ authed: false, routeName: 'login', routePath: '/demo' }), navigate: () => {} });
    tour.start();
    assert.equal(tour.isActive(), true);
    const saved = storage.read();
    assert.equal(saved.active, true);
    assert.equal(saved.done, false);
    assert.equal(saved.step, 0);
    assert.equal(saved.ctx.partnerId, null);
  } finally {
    storage.restore();
  }
});

test('start() auto-opens on a first-ever visit at the first applicable step when authed', async () => {
  const { createTour } = await load();
  const storage = installStorage(null);
  try {
    const tour = createTour({ getContext: () => ({ authed: true, userId: 'u1', routeName: 'discover', routePath: '/discover' }), navigate: () => {} });
    tour.start();
    assert.equal(tour.isActive(), true);
    const saved = storage.read();
    assert.equal(saved.active, true);
    assert.equal(saved.step, 1);
    assert.equal(saved.currentIdentityId, 'u1');
  } finally {
    storage.restore();
  }
});

test('start() resumes a stored active tour instead of restarting it', async () => {
  const { createTour } = await load();
  const stored = JSON.stringify({
    v: 1,
    active: true,
    step: 4,
    done: false,
    ctx: { exchangeId: 'ex1', partnerId: 'u2', partnerName: '林小满', requesterId: 'u1', requesterName: '周予安' },
    currentIdentityId: 'u2',
  });
  const storage = installStorage(stored);
  try {
    const tour = createTour({ getContext: () => ({ authed: true, userId: 'u2', routeName: 'exchangeDetail', routePath: '/exchanges/ex1' }), navigate: () => {} });
    tour.start();
    assert.equal(tour.isActive(), true);
    const saved = storage.read();
    assert.equal(saved.step, 4);
    assert.equal(saved.ctx.exchangeId, 'ex1');
    assert.equal(saved.ctx.partnerId, 'u2');
  } finally {
    storage.restore();
  }
});

test('start() does not auto-open after 跳过 (stored active=false)', async () => {
  const { createTour } = await load();
  const stored = JSON.stringify({ v: 1, active: false, step: 2, done: false, ctx: {}, currentIdentityId: 'u1' });
  const storage = installStorage(stored);
  try {
    const tour = createTour({ getContext: () => ({ authed: true, userId: 'u1', routeName: 'discover', routePath: '/discover' }), navigate: () => {} });
    tour.start();
    assert.equal(tour.isActive(), false);
    const saved = storage.read();
    assert.equal(saved.active, false);
    assert.equal(saved.step, 2);

    // reset() stays the explicit restart path.
    tour.reset();
    assert.equal(tour.isActive(), true);
    assert.equal(storage.read().active, true);
    assert.equal(storage.read().step, 1);
  } finally {
    storage.restore();
  }
});

test('start() does not auto-open after 完成 (stored done=true)', async () => {
  const { createTour } = await load();
  const storage = installStorage(finishedState);
  try {
    const tour = createTour({ getContext: () => ({ authed: true, userId: 'u1', routeName: 'profile', routePath: '/me' }), navigate: () => {} });
    tour.start();
    assert.equal(tour.isActive(), false);
    const saved = storage.read();
    assert.equal(saved.active, false);
    assert.equal(saved.done, true);
    assert.equal(saved.step, 10);
  } finally {
    storage.restore();
  }
});

test('start() ignores a malformed stored payload (pill only, no auto-open)', async () => {
  const { createTour } = await load();
  const storage = installStorage('{not-json');
  try {
    const tour = createTour({ getContext: () => ({ authed: false, routeName: 'login', routePath: '/demo' }), navigate: () => {} });
    tour.start();
    assert.equal(tour.isActive(), false);
    assert.equal(storage.raw(), '{not-json');
  } finally {
    storage.restore();
  }
});
