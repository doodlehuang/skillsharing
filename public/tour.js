/**
 * SkillLoop 换技 — demo-only guided tour (流程向导).
 *
 * Contract (consumed by public/app.js):
 *   createTour({ getContext, navigate }) -> { start, refresh, notify, isActive, reset }
 *   getContext() -> { authed, userId, userName, routeName, routePath }
 *   navigate(path) -> void   // app.js adds the /demo prefix and re-renders
 *
 * The module is deliberately DOM-free at import time (unit-tested under Node).
 * All rendering is lazy, lives OUTSIDE #app, and re-mounts into the open
 * <dialog> when a target sits in the top layer.
 *
 * Integration notes for public/app.js:
 *   const tour = createTour({ getContext, navigate, openPropose, closeDialogs });
 *   // openPropose()/closeDialogs() are optional hooks used by the propose step.
 *   // 上一步/下一步/settle/start auto-navigate to each step's page once per visit;
 *   // plain refresh()/scroll never navigates.
 *   tour.start();   // first-ever visit: opens the card at the first step;
 *                   // later visits resume only a stored active tour, otherwise
 *                   // just mount the always-on pill (跳过/完成 stay dismissed)
 *   tour.refresh(); // after every render / menu toggle (no-op while inactive)
 *   tour.notify(type, detail) with:
 *     'identity-switched' { userId, userName }
 *     'propose-opened'
 *     'propose-closed' { submitted: false }
 *     'exchange-created' { exchangeId, partnerId, partnerName, requesterId, requesterName }
 *     'exchange-updated' { exchangeId, status: 'accepted' | 'completed' }
 *     'message-sent' { exchangeId }
 *     'review-submitted' { exchangeId }
 */

export const TOUR_STORAGE_KEY = 'skillloop.tour.v1';
export const TOUR_STEP_COUNT = 11;

const STORAGE_VERSION = 1;
const NOTIFY_TYPES = [
  'identity-switched',
  'propose-opened',
  'propose-closed',
  'exchange-created',
  'exchange-updated',
  'message-sent',
  'review-submitted',
];
// Which app.js notification is allowed to satisfy each step wait. The waiter
// type is not always the event name (exchange-status listens to exchange-updated).
const WAIT_NOTIFY_TYPES = {
  'identity-switched': 'identity-switched',
  'propose-opened': 'propose-opened',
  'exchange-created': 'exchange-created',
  'exchange-status': 'exchange-updated',
  'message-sent': 'message-sent',
  'review-submitted': 'review-submitted',
};
const CTX_KEYS = ['exchangeId', 'partnerId', 'partnerName', 'requesterId', 'requesterName'];
const RING_PAD = 7;
const CARD_GAP = 12;
const EDGE_MARGIN = 12;

function cleanString(value, max = 120) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

/** Keep only the exchange/identity fields the tour persists. */
export function normalizeTourCtx(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const ctx = {};
  for (const key of CTX_KEYS) ctx[key] = cleanString(source[key]);
  return ctx;
}

/** Ids are interpolated into CSS selectors, so allow only safe characters. */
function selectorId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

/** Pure step model for a given context. Strings/targets are resolved here,
 * which keeps the renderer and the unit test reading the same source. */
export function tourSteps(ctx = {}) {
  const c = normalizeTourCtx(ctx);
  const authed = !!ctx && ctx.authed === true;
  const exchangePath = c.exchangeId ? `/exchanges/${encodeURIComponent(c.exchangeId)}` : '/exchanges';
  const partnerSelector = selectorId(c.partnerId);
  const requesterSelector = selectorId(c.requesterId);
  const partnerTargets = partnerSelector
    ? [`[data-demo-switch="${partnerSelector}"]`, '[data-menu-toggle]']
    : ['[data-menu-toggle]'];
  const requesterTargets = requesterSelector
    ? [`[data-demo-switch="${requesterSelector}"]`, '[data-menu-toggle]']
    : ['[data-menu-toggle]'];
  const toPartnerText = c.partnerName
    ? `请求已发出。点右上角头像，切到「${c.partnerName}」。`
    : '请求已发出。点右上角头像，切到对方身份。';
  const toSelfText = c.requesterName
    ? `切回「${c.requesterName}」，完成这次交换。`
    : '切回你自己的身份，完成这次交换。';

  return [
    {
      id: 'enter',
      text: '先点这里，用示例身份进入。',
      targets: ['[data-tour="demo-enter"]', '[data-demo]'],
      path: '/',
      fallbackPath: '/demo',
      when: (context) => !(context && context.authed),
      wait: { type: 'identity-switched' },
    },
    {
      id: 'discover',
      text: '名录里每人都有能教和想学。点「发起交换」。',
      targets: ['[data-propose]'],
      path: '/discover',
      fallbackPath: '/discover',
      wait: { type: 'propose-opened' },
    },
    {
      id: 'propose',
      text: '默认选项已按匹配预选好，点「发送请求」。',
      targets: ['#p-submit'],
      path: '/discover',
      fallbackPath: exchangePath,
      wait: { type: 'exchange-created' },
    },
    {
      id: 'to-partner',
      text: toPartnerText,
      targets: partnerTargets,
      path: exchangePath,
      fallbackPath: exchangePath,
      wait: { type: 'identity-switched', to: 'partner' },
    },
    {
      id: 'accept',
      text: '现在是对方视角。点「接受请求」。',
      targets: ['[data-action="accept"]'],
      path: exchangePath,
      fallbackPath: exchangePath,
      wait: { type: 'exchange-status', status: 'accepted' },
    },
    {
      id: 'chat',
      text: '回一句约定时间，消息只有你们两人可见。',
      targets: ['#chat-form'],
      path: exchangePath,
      fallbackPath: exchangePath,
      manual: true,
      wait: { type: 'message-sent' },
    },
    {
      id: 'to-self',
      text: toSelfText,
      targets: requesterTargets,
      path: exchangePath,
      fallbackPath: exchangePath,
      wait: { type: 'identity-switched', to: 'requester' },
    },
    {
      id: 'complete',
      text: '上完课点「标记完成」，这次交换就结束。',
      targets: ['[data-action="complete"]'],
      path: exchangePath,
      fallbackPath: exchangePath,
      wait: { type: 'exchange-status', status: 'completed' },
    },
    {
      id: 'review',
      text: '给对方打分，交换才算真正走完。',
      targets: ['#review-form', '.detail-main'],
      path: exchangePath,
      fallbackPath: exchangePath,
      manual: true,
      wait: { type: 'review-submitted' },
    },
    {
      id: 'ledger-nav',
      text: '最后打开「我的」，看学时存折。',
      targets: ['[data-tour="nav-me"]'],
      path: '/me',
      fallbackPath: '/me',
      wait: { type: 'route', path: '/me', names: ['profile'] },
    },
    {
      id: 'ledger',
      text: '每一笔冻结、退还和收入都在这里。',
      targets: ['#ledger'],
      path: '/me',
      fallbackPath: '/me',
      final: true,
    },
  ];
}

function initialTourState() {
  return {
    v: STORAGE_VERSION,
    active: false,
    step: 0,
    done: false,
    ctx: normalizeTourCtx(null),
    currentIdentityId: null,
  };
}

function clampStep(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(TOUR_STEP_COUNT - 1, Math.max(0, Math.trunc(n)));
}

function normalizeTourState(value) {
  const base = initialTourState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  if (Number(value.v) !== STORAGE_VERSION) return base;
  const done = value.done === true;
  return {
    v: STORAGE_VERSION,
    active: done ? false : value.active === true,
    step: clampStep(value.step),
    done,
    ctx: normalizeTourCtx(value.ctx),
    currentIdentityId: cleanString(value.currentIdentityId),
  };
}

/** Defensive read: any malformed payload degrades to a clean state. */
export function parseTourState(raw) {
  if (typeof raw !== 'string') return normalizeTourState(raw);
  const text = raw.trim();
  if (!text) return initialTourState();
  try {
    return normalizeTourState(JSON.parse(text));
  } catch {
    return initialTourState();
  }
}

export function serializeTourState(state) {
  return JSON.stringify(normalizeTourState(state));
}

function sameExchange(ctx, detail) {
  const mine = cleanString(ctx && ctx.exchangeId);
  const theirs = cleanString(detail && detail.exchangeId);
  if (mine && theirs && mine !== theirs) return false;
  return true;
}

/**
 * Does an app.js notification satisfy the wait declared by the current step?
 * `startUserId` is the identity recorded when an identity step was entered; it
 * lets "switch to the partner / yourself" work even when the id is unknown.
 */
export function matchesWait(wait, detail, ctx, startUserId = null) {
  if (!wait || typeof wait !== 'object') return false;
  const type = cleanString(wait.type);
  if (!type) return false;
  const live = ctx && typeof ctx === 'object' && !Array.isArray(ctx) ? ctx : {};
  const d = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {};

  if (type === 'identity-switched') {
    const userId = cleanString(d.userId);
    if (!userId) return false;
    if (wait.to === 'partner') {
      const wanted = cleanString(live.partnerId);
      if (wanted) return userId === wanted;
      return !!startUserId && userId !== startUserId;
    }
    if (wait.to === 'requester') {
      const wanted = cleanString(live.requesterId);
      if (wanted) return userId === wanted;
      return !!startUserId && userId !== startUserId;
    }
    return true;
  }

  if (type === 'exchange-created') return !!cleanString(d.exchangeId);

  if (type === 'exchange-status') {
    const status = cleanString(wait.status);
    if (!status || d.status !== status) return false;
    return sameExchange(live, d);
  }

  if (type === 'propose-opened' || type === 'message-sent' || type === 'review-submitted') {
    return sameExchange(live, d);
  }

  if (type === 'route') {
    const path = cleanString(wait.path);
    const names = Array.isArray(wait.names) ? wait.names : [];
    const routePath = cleanString(live.routePath);
    const routeName = cleanString(live.routeName);
    if (path && routePath && routePath === path) return true;
    return !!routeName && names.includes(routeName);
  }

  return false;
}

/**
 * Gate a waiter behind the notification that can actually satisfy it. The raw
 * matcher is type-blind on purpose (identity switches, propose-opened etc. have
 * no distinguishing detail), so notify() must not hand it the wrong event:
 * e.g. an identity-switched must never advance a propose-opened wait.
 */
export function notificationMatchesWait(wait, type, detail, ctx, startUserId = null) {
  if (!wait || typeof wait !== 'object') return false;
  const eventType = WAIT_NOTIFY_TYPES[wait.type];
  if (!eventType || eventType !== type) return false;
  return matchesWait(wait, detail, ctx, startUserId);
}

/** Steps whose `when` predicate holds for the current context. */
export function applicableSteps(ctx = {}) {
  return tourSteps(ctx).filter((step) => !step.when || step.when(ctx));
}

/** First applicable full-array index at or after `from`. */
export function nextApplicableStep(ctx = {}, from = 0) {
  const steps = tourSteps(ctx);
  const start = clampStep(from);
  for (let i = start; i < steps.length; i += 1) {
    if (!steps[i].when || steps[i].when(ctx)) return i;
  }
  return steps.length - 1;
}

/** Previous applicable full-array index before `from`, or -1. */
export function previousApplicableStep(ctx = {}, from = 0) {
  const steps = tourSteps(ctx);
  for (let i = clampStep(from) - 1; i >= 0; i -= 1) {
    if (!steps[i].when || steps[i].when(ctx)) return i;
  }
  return -1;
}

/** Normalize an SPA route path for comparisons ('/me/' -> '/me', '' -> '/'). */
export function normalizeRoutePath(value) {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  if (!trimmed) return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const stripped = withSlash.replace(/\/+$/, '');
  return stripped || '/';
}

/** Canonical page for a step (fallbackPath is kept for older consumers). */
export function stepPath(step) {
  if (!step || typeof step !== 'object') return '/';
  return normalizeRoutePath(step.path || step.fallbackPath || '/');
}

/** One-shot navigation key: navigating once per step id + path visit. */
export function stepNavKey(step) {
  return step ? `${step.id}|${stepPath(step)}` : '';
}

/** Guests may only be sent to public pages; authed-only routes would bounce to
 * /login (and a repeated 上一步/下一步 could ping-pong). */
function isGuestSafePath(path, ctx) {
  return (ctx && ctx.authed === true) || path === '/';
}

/**
 * Pure navigation decision for a step change: go to the step's page only when
 * it differs from the current route and has not already been navigated to this
 * visit. Plain refresh/scroll never calls this.
 */
export function shouldAutoNavigate(step, ctx = {}, lastVisitKey = null) {
  if (!step) return false;
  const target = stepPath(step);
  if (!isGuestSafePath(target, ctx)) return false;
  if (target === normalizeRoutePath(ctx.routePath)) return false;
  return lastVisitKey !== stepNavKey(step);
}

/** 去这一页 would be a no-op on its own page, and a guest must not be sent to an
 * authed-only route; hide the button in both cases. */
export function fallbackButtonVisible(step, ctx = {}) {
  if (!step) return false;
  const target = stepPath(step);
  if (!isGuestSafePath(target, ctx)) return false;
  return target !== normalizeRoutePath(ctx.routePath);
}

/* ------------------------------------------------------------------ */
/* State machine + DOM renderer (all DOM work is lazy)                  */
/* ------------------------------------------------------------------ */

export function createTour(options = {}) {
  const getContext = typeof options.getContext === 'function' ? options.getContext : () => ({});
  const navigate = typeof options.navigate === 'function' ? options.navigate : () => {};
  // Optional app hooks (T7): open the propose sheet for the first card, and
  // close any open modal when the tour leaves the propose step.
  const openPropose = typeof options.openPropose === 'function' ? options.openPropose : null;
  const closeDialogs = typeof options.closeDialogs === 'function' ? options.closeDialogs : null;

  let memoryRaw = null;

  function readStoredRaw() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(TOUR_STORAGE_KEY);
        if (typeof raw === 'string') return raw;
      }
    } catch {
      /* private mode / disabled storage: fall back to memory */
    }
    return memoryRaw;
  }

  const initialRaw = readStoredRaw();
  // A first-ever visit has nothing stored: start() opens the guide right away.
  // Any stored payload (even a skipped/finished one) means "resume, don't relaunch".
  const hadStoredState = initialRaw != null;
  let firstLaunch = !hadStoredState;
  let state = parseTourState(initialRaw);
  let stepStartUserId = null;
  // Per step-visit bookkeeping: target-driven scroll, one-shot navigation, and
  // the one-shot openPropose() attempt.
  let lastScrolledTarget = null;
  let lastNavigatedVisit = null;
  let proposeOpenedVisit = false;
  // 上一步 onto a route-wait step (ledger-nav) must stay there for this visit;
  // otherwise the app's closeMenu()->refresh()->settle() chain bounces it
  // straight forward to the next step.
  let routeAdvanceSuppressed = false;

  function currentContext() {
    let live = {};
    try {
      live = getContext() || {};
    } catch {
      live = {};
    }
    if (!live || typeof live !== 'object') live = {};
    return {
      authed: live.authed === true,
      userId: cleanString(live.userId),
      userName: cleanString(live.userName),
      routeName: cleanString(live.routeName),
      routePath: cleanString(live.routePath),
      exchangeId: state.ctx.exchangeId,
      partnerId: state.ctx.partnerId,
      partnerName: state.ctx.partnerName,
      requesterId: state.ctx.requesterId,
      requesterName: state.ctx.requesterName,
    };
  }

  function persist() {
    const raw = serializeTourState(state);
    memoryRaw = raw;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(TOUR_STORAGE_KEY, raw);
    } catch {
      /* keep the in-memory copy */
    }
    syncPill();
  }

  function currentStepIndex() {
    return clampStep(state.step);
  }

  function stepsNow() {
    return tourSteps(currentContext());
  }

  function syncBaseline(index, ctx) {
    const step = tourSteps(ctx)[clampStep(index)];
    stepStartUserId = step && step.wait && step.wait.type === 'identity-switched' ? ctx.userId || null : null;
  }

  function closeProposeStep(stepId) {
    if (stepId === 'propose' && closeDialogs) {
      try {
        closeDialogs();
      } catch {
        /* optional hook */
      }
    }
  }

  /** Reset everything that is only valid for one visit of one step. */
  function leaveStep(prevId, nextId) {
    if (prevId === nextId) return;
    lastScrolledTarget = null;
    lastNavigatedVisit = null;
    proposeOpenedVisit = false;
    closeProposeStep(prevId);
  }

  /** Navigate to a step's own page once per step visit; never from refresh/scroll. */
  function autoNavigate(step, ctx) {
    if (!state.active || !step) return false;
    if (!shouldAutoNavigate(step, ctx, lastNavigatedVisit)) return false;
    const path = stepPath(step);
    lastNavigatedVisit = stepNavKey(step);
    try {
      navigate(path);
    } catch {
      return false;
    }
    // The SPA renders asynchronously; re-resolve the card after it repaints.
    scheduleRefresh();
    return true;
  }

  function maybeOpenPropose(step, ctx) {
    if (!openPropose || proposeOpenedVisit || !step || step.id !== 'propose') return;
    if (!ctx || ctx.authed !== true) return;
    if (normalizeRoutePath(ctx.routePath) !== '/discover') return;
    if (document.querySelector('#p-submit')) return;
    // Wait until the discover page is actually painted; the post-navigation
    // refresh retries, but only once per visit.
    if (!document.querySelector('[data-propose]')) return;
    proposeOpenedVisit = true;
    try {
      const result = openPropose();
      if (result && typeof result.then === 'function') result.then(() => scheduleRefresh(), () => {});
    } catch {
      /* optional hook */
    }
    scheduleRefresh();
  }

  /** Move to a step, persist immediately and repaint. */
  function goTo(index, options = {}) {
    const ctx = currentContext();
    const prevId = tourSteps(ctx)[currentStepIndex()]?.id;
    state.step = Math.min(TOUR_STEP_COUNT - 1, Math.max(0, Math.trunc(index)));
    routeAdvanceSuppressed = options.source === 'prev';
    const nextId = tourSteps(ctx)[currentStepIndex()]?.id;
    leaveStep(prevId, nextId);
    syncBaseline(state.step, ctx);
    persist();
    render();
    autoNavigate(tourSteps(ctx)[currentStepIndex()], ctx);
  }

  /** Skips steps whose `when` condition does not hold and route waits that are
   * already satisfied. Bounded so a bad predicate can never loop forever. */
  function settle() {
    const ctx = currentContext();
    const prevId = tourSteps(ctx)[currentStepIndex()]?.id;
    let guard = 0;
    let changed = false;
    while (state.active && guard < TOUR_STEP_COUNT + 2) {
      guard += 1;
      const steps = tourSteps(ctx);
      const step = steps[currentStepIndex()];
      if (!step) break;
      if (step.when && !step.when(ctx)) {
        state.step = nextApplicableStep(ctx, currentStepIndex() + 1);
        syncBaseline(state.step, ctx);
        changed = true;
        continue;
      }
      if (!routeAdvanceSuppressed && step.wait && step.wait.type === 'route' && matchesWait(step.wait, {}, ctx, stepStartUserId)) {
        const next = nextApplicableStep(ctx, currentStepIndex() + 1);
        if (step.final || next <= currentStepIndex()) break;
        state.step = next;
        syncBaseline(state.step, ctx);
        changed = true;
        continue;
      }
      break;
    }
    if (changed) {
      routeAdvanceSuppressed = false;
      const nextId = tourSteps(ctx)[currentStepIndex()]?.id;
      leaveStep(prevId, nextId);
      autoNavigate(tourSteps(ctx)[currentStepIndex()], ctx);
    }
    return ctx;
  }

  function goNext() {
    const ctx = currentContext();
    const steps = tourSteps(ctx);
    const index = currentStepIndex();
    if (index >= steps.length - 1) {
      complete();
      return;
    }
    const next = nextApplicableStep(ctx, index + 1);
    if (next <= index) {
      complete();
      return;
    }
    goTo(next, { source: 'next' });
  }

  function goPrev() {
    const ctx = currentContext();
    const prev = previousApplicableStep(ctx, currentStepIndex());
    if (prev < 0) return;
    goTo(prev, { source: 'prev' });
  }

  function complete() {
    const prevId = tourSteps(currentContext())[currentStepIndex()]?.id;
    state.active = false;
    state.done = true;
    state.step = TOUR_STEP_COUNT - 1;
    state.currentIdentityId = currentContext().userId || state.currentIdentityId;
    persist();
    routeAdvanceSuppressed = false;
    closeProposeStep(prevId);
    teardownRoot();
  }

  function skip() {
    const prevId = tourSteps(currentContext())[currentStepIndex()]?.id;
    state.active = false;
    persist();
    routeAdvanceSuppressed = false;
    closeProposeStep(prevId);
    teardownRoot();
  }

  function start() {
    ensureUi();
    if (firstLaunch) {
      firstLaunch = false;
      // First-ever visit: open the card immediately at the first applicable
      // step (authed visitors skip `enter`). Never reopen after 跳过/完成.
      if (!state.active && !state.done) {
        const ctx = currentContext();
        state.active = true;
        state.currentIdentityId = ctx.userId || state.currentIdentityId;
        state.step = nextApplicableStep(ctx, 0);
        syncBaseline(state.step, ctx);
        settle();
        persist();
        lastScrolledTarget = null;
        render();
        autoNavigate(tourSteps(currentContext())[currentStepIndex()], currentContext());
        return api;
      }
    }
    if (!state.active) {
      syncPill();
      return api;
    }
    const ctx = currentContext();
    state.currentIdentityId = ctx.userId || state.currentIdentityId;
    settle();
    persist();
    render();
    autoNavigate(tourSteps(currentContext())[currentStepIndex()], currentContext());
    return api;
  }

  function refresh() {
    if (typeof document === 'undefined' || !state.active) return api;
    ensureUi();
    const ctx = currentContext();
    state.currentIdentityId = ctx.userId || state.currentIdentityId;
    settle();
    persist();
    render();
    return api;
  }

  function notify(type, detail = {}) {
    if (typeof document === 'undefined' || !state.active) return api;
    if (!NOTIFY_TYPES.includes(type)) return api;
    const ctx = currentContext();

    if (type === 'exchange-created') {
      const d = detail && typeof detail === 'object' ? detail : {};
      state.ctx = normalizeTourCtx({
        exchangeId: d.exchangeId,
        partnerId: d.partnerId,
        partnerName: d.partnerName,
        requesterId: d.requesterId,
        requesterName: d.requesterName,
      });
      persist();
    }

    if (type === 'identity-switched') {
      const d = detail && typeof detail === 'object' ? detail : {};
      state.currentIdentityId = cleanString(d.userId) || state.currentIdentityId;
      persist();
    }

    // Backing out of the propose sheet returns the tour to the selector card.
    if (type === 'propose-closed' && detail && detail.submitted === false && stepsNow()[currentStepIndex()]?.id === 'propose') {
      goPrev();
      return api;
    }

    const step = tourSteps(currentContext())[currentStepIndex()];
    if (step && step.wait && notificationMatchesWait(step.wait, type, detail, currentContext(), stepStartUserId)) {
      goNext();
      return api;
    }

    // Any other notification still means the app chrome moved: keep the card glued.
    render();
    return api;
  }

  function reset() {
    state = initialTourState();
    state.active = true;
    const ctx = currentContext();
    state.currentIdentityId = ctx.userId || null;
    state.step = nextApplicableStep(ctx, 0);
    syncBaseline(state.step, ctx);
    persist();
    ensureUi();
    lastScrolledTarget = null;
    render();
    autoNavigate(tourSteps(currentContext())[currentStepIndex()], currentContext());
    return api;
  }

  const api = {
    start,
    refresh,
    notify,
    isActive: () => state.active,
    reset,
  };

  /* ---------------- lazy DOM ---------------- */

  let ui = null;
  let activeTarget = null;
  let observer = null;
  let positionRaf = 0;
  let refreshRaf = 0;
  const svgNS = 'http://www.w3.org/2000/svg';

  function makeButton(label, className, attr) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.setAttribute(attr, '');
    return button;
  }

  function ensureUi() {
    if (typeof document === 'undefined' || ui || !document.body) return;
    const root = document.createElement('div');
    root.className = 'tour-root';
    root.id = 'tour-root';
    root.hidden = true;

    const ring = document.createElement('div');
    ring.className = 'tour-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.hidden = true;

    const arrow = document.createElementNS(svgNS, 'svg');
    arrow.setAttribute('class', 'tour-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.setAttribute('focusable', 'false');
    const arrowLine = document.createElementNS(svgNS, 'line');
    const arrowHead = document.createElementNS(svgNS, 'polygon');
    arrow.append(arrowLine, arrowHead);
    arrow.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', '流程向导');
    card.hidden = true;

    const meta = document.createElement('div');
    meta.className = 'tour-meta';
    const metaCount = document.createElement('span');
    metaCount.className = 'lab';
    const metaKicker = document.createElement('span');
    metaKicker.className = 'lab tour-kicker';
    metaKicker.textContent = '流程向导';
    meta.append(metaCount, metaKicker);

    const textWrap = document.createElement('div');
    textWrap.className = 'tour-text-wrap';
    textWrap.setAttribute('aria-live', 'polite');
    textWrap.setAttribute('aria-atomic', 'true');
    const text = document.createElement('p');
    text.className = 'tour-text';
    textWrap.append(text);

    const actions = document.createElement('div');
    actions.className = 'tour-actions';
    const prev = makeButton('上一步', 'btn btn-sm btn-ghost', 'data-tour-prev');
    const next = makeButton('下一步', 'btn btn-sm btn-primary', 'data-tour-next');
    const skip = makeButton('跳过', 'btn btn-sm btn-ghost tour-skip', 'data-tour-skip');
    actions.append(prev, next, skip);

    const fallbackRow = document.createElement('div');
    fallbackRow.className = 'tour-fallback';
    fallbackRow.hidden = true;
    const fallbackBtn = makeButton('去这一页', 'btn btn-sm btn-ghost', 'data-tour-fallback');
    fallbackRow.append(fallbackBtn);

    card.append(meta, textWrap, actions, fallbackRow);
    root.append(ring, arrow, card);
    root.addEventListener('click', onUiClick);

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'tour-pill';
    pill.setAttribute('data-tour-pill', '');
    pill.textContent = '流程向导';
    pill.hidden = state.active;
    pill.addEventListener('click', () => reset());
    document.body.appendChild(pill);

    ui = {
      root,
      ring,
      arrow,
      arrowLine,
      arrowHead,
      card,
      metaCount,
      text,
      prev,
      next,
      skip,
      fallbackRow,
      fallbackBtn,
      pill,
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', schedulePosition, { passive: true });
      window.addEventListener('scroll', schedulePosition, { capture: true, passive: true });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('close', scheduleRefresh, true);
    }
    observeApp();
  }

  function syncPill() {
    if (!ui) return;
    const done = state.done === true;
    ui.pill.textContent = done ? '再看一遍' : '流程向导';
    ui.pill.setAttribute('aria-label', done ? '重新打开流程向导' : '打开流程向导');
    // While the tour is running the card itself is the affordance; the pill
    // reappears the moment the tour is skipped or finished.
    ui.pill.hidden = state.active === true;
  }

  function onUiClick(event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-tour-prev], [data-tour-next], [data-tour-skip], [data-tour-fallback]') : null;
    if (!button || !ui || !ui.root.contains(button)) return;
    event.preventDefault();
    if (button.hasAttribute('data-tour-prev')) goPrev();
    else if (button.hasAttribute('data-tour-next')) goNext();
    else if (button.hasAttribute('data-tour-skip')) skip();
    else if (button.hasAttribute('data-tour-fallback')) {
      const ctx = currentContext();
      const step = tourSteps(ctx)[currentStepIndex()];
      if (step && fallbackButtonVisible(step, ctx)) navigate(stepPath(step));
    }
  }

  function openDialogFor(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const dialog = target.closest('dialog.modal');
    return dialog && dialog.isConnected && dialog.open ? dialog : null;
  }

  function mountRoot(target) {
    if (!ui) return;
    const parent = openDialogFor(target) || document.body;
    const inline = parent !== document.body;
    if (inline) ui.root.dataset.inline = 'true';
    else delete ui.root.dataset.inline;
    if (ui.root.parentElement !== parent) parent.appendChild(ui.root);
    ui.root.hidden = false;
  }

  function teardownRoot() {
    lastScrolledTarget = null;
    lastNavigatedVisit = null;
    proposeOpenedVisit = false;
    routeAdvanceSuppressed = false;
    if (!ui) return;
    ui.root.remove();
    ui.root.hidden = true;
    ui.ring.hidden = true;
    ui.card.hidden = true;
    ui.arrow.style.display = 'none';
    delete ui.card.dataset.docked;
    activeTarget = null;
  }

  function observeApp() {
    if (typeof MutationObserver === 'undefined' || observer) return;
    observer = new MutationObserver(() => {
      if (state.active) scheduleRefresh();
    });
    const app = document.getElementById('app');
    const dialogRoot = document.getElementById('dialog-root');
    // Direct children only: a dialog's inner mutations (including our own card)
    // must never feed back into a refresh loop.
    if (app) observer.observe(app, { childList: true });
    if (dialogRoot) observer.observe(dialogRoot, { childList: true });
  }

  function scheduleRefresh() {
    if (refreshRaf || typeof window === 'undefined') return;
    refreshRaf = window.requestAnimationFrame(() => {
      refreshRaf = 0;
      refresh();
    });
  }

  function schedulePosition() {
    if (positionRaf || typeof window === 'undefined') return;
    positionRaf = window.requestAnimationFrame(() => {
      positionRaf = 0;
      reposition();
    });
  }

  /** Scroll/layout-only repaint: no state writes, no step logic. */
  function reposition() {
    if (!state.active || !ui || !ui.root.isConnected) return;
    if (!activeTarget || !activeTarget.isConnected) return;
    const parent = openDialogFor(activeTarget) || document.body;
    if (ui.root.parentElement !== parent) mountRoot(activeTarget);
    positionTarget(activeTarget);
  }

  function findTarget(selectors) {
    if (!Array.isArray(selectors)) return null;
    for (const selector of selectors) {
      if (typeof selector !== 'string' || !selector) continue;
      let el = null;
      try {
        el = document.querySelector(selector);
      } catch {
        continue;
      }
      if (el && el.isConnected && isVisible(el)) return el;
    }
    return null;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function clamp(value, min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.min(hi, Math.max(lo, value));
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function render() {
    if (!ui || typeof document === 'undefined') return;
    if (!state.active) {
      teardownRoot();
      syncPill();
      return;
    }
    const ctx = currentContext();
    const steps = tourSteps(ctx);
    const index = currentStepIndex();
    const step = steps[index];
    if (!step) {
      complete();
      return;
    }

    const applicable = applicableSteps(ctx);
    const position = applicable.findIndex((item) => item.id === step.id);
    ui.metaCount.textContent = `第 ${position >= 0 ? position + 1 : 1} 步 / 共 ${applicable.length} 步`;
    ui.text.textContent = step.text;
    const isLast = step.final === true || !steps.slice(index + 1).some((item) => !item.when || item.when(ctx));
    ui.next.textContent = isLast ? '完成' : '下一步';
    ui.prev.disabled = previousApplicableStep(ctx, index) < 0;

    syncPill();
    const target = findTarget(step.targets);
    activeTarget = target;
    // 去这一页 only when it would actually move to another page (and the page
    // is legal for a guest); otherwise it was the reported no-op button.
    ui.fallbackRow.hidden = !!target || !fallbackButtonVisible(step, ctx);
    ui.root.hidden = false;
    mountRoot(target);
    if (!target) {
      lastScrolledTarget = null;
      ui.ring.hidden = true;
      ui.arrow.style.display = 'none';
      dockCard();
      maybeOpenPropose(step, ctx);
      return;
    }
    ui.ring.hidden = false;
    ui.card.hidden = false;
    delete ui.card.dataset.docked;
    // Target-driven scrolling, independent of the caller: after an action-driven
    // advance the real target often appears only after the app's next render and
    // its refresh(); that refresh must still bring it into view. The same node is
    // never scrolled twice, so manual scrolling is not fought by scroll repaints.
    if (target !== lastScrolledTarget) {
      lastScrolledTarget = target;
      if (shouldScrollIntoView(target)) scrollTargetIntoView(target);
    }
    positionTarget(target);
  }

  function mountBox(parent) {
    if (parent && parent !== document.body) {
      const rect = parent.getBoundingClientRect();
      return {
        left: rect.left + parent.clientLeft,
        top: rect.top + parent.clientTop,
        width: parent.clientWidth,
        height: parent.clientHeight,
        scrollLeft: parent.scrollLeft || 0,
        scrollTop: parent.scrollTop || 0,
      };
    }
    return {
      left: 0,
      top: 0,
      width: typeof window !== 'undefined' ? window.innerWidth : 1024,
      height: typeof window !== 'undefined' ? window.innerHeight : 768,
      scrollLeft: 0,
      scrollTop: 0,
    };
  }

  /** Viewport rect -> mount padding-box rect (dialog mode adds scroll offset). */
  function toMount(rect, box) {
    return {
      left: rect.left - box.left + box.scrollLeft,
      top: rect.top - box.top + box.scrollTop,
      width: rect.width,
      height: rect.height,
    };
  }

  function positionTarget(target) {
    if (!ui || !target) return;
    const parent = ui.root.parentElement || document.body;
    const inline = parent !== document.body;
    const box = mountBox(parent);
    const raw = toMount(target.getBoundingClientRect(), box);
    // Visible slice of the content coordinate space (dialogs can scroll).
    const view = { left: box.scrollLeft, top: box.scrollTop, width: box.width, height: box.height };

    const ringWidth = Math.max(8, Math.min(raw.width + RING_PAD * 2, view.width - 2));
    const ringHeight = Math.max(8, Math.min(raw.height + RING_PAD * 2, view.height - 2));
    const ringLeft = clamp(raw.left - RING_PAD, view.left + 1, Math.max(view.left + 1, view.left + view.width - ringWidth - 1));
    const ringTop = clamp(raw.top - RING_PAD, view.top + 1, Math.max(view.top + 1, view.top + view.height - ringHeight - 1));
    ui.ring.style.left = `${Math.round(ringLeft)}px`;
    ui.ring.style.top = `${Math.round(ringTop)}px`;
    ui.ring.style.width = `${Math.round(ringWidth)}px`;
    ui.ring.style.height = `${Math.round(ringHeight)}px`;
    const ringRect = { left: ringLeft, top: ringTop, width: ringWidth, height: ringHeight };

    ui.card.style.left = '0px';
    ui.card.style.top = '0px';
    const cardWidth = ui.card.offsetWidth || 300;
    const cardHeight = ui.card.offsetHeight || 96;
    const margin = EDGE_MARGIN;
    const minLeft = view.left + margin;
    const minTop = view.top + margin;
    const maxLeft = Math.max(minLeft, view.left + view.width - cardWidth - margin);
    const maxTop = Math.max(minTop, view.top + view.height - cardHeight - margin);
    const rightEdge = view.left + view.width - margin;
    const bottomEdge = view.top + view.height - margin;
    const centerX = ringRect.left + ringRect.width / 2;
    const centerY = ringRect.top + ringRect.height / 2;
    const rightX = ringRect.left + ringRect.width + CARD_GAP;
    const leftX = ringRect.left - CARD_GAP - cardWidth;
    const belowY = ringRect.top + ringRect.height + CARD_GAP;
    const aboveY = ringRect.top - CARD_GAP - cardHeight;

    if (inline) {
      // Modal mode: vertical-only anchoring, so footer controls (取消 /
      // 发送请求) are never covered side-by-side. Prefer above the ring, then
      // below, then the roomier side, always clamped inside the dialog.
      const visibleTop = view.top + margin;
      const visibleBottom = view.top + view.height - margin;
      let inlineTop;
      if (aboveY >= visibleTop) {
        inlineTop = aboveY;
      } else if (belowY + cardHeight <= visibleBottom) {
        inlineTop = belowY;
      } else {
        const roomAbove = ringRect.top - visibleTop;
        const roomBelow = visibleBottom - (ringRect.top + ringRect.height);
        inlineTop = roomAbove >= roomBelow ? Math.max(visibleTop, aboveY) : Math.min(visibleBottom - cardHeight, belowY);
      }
      inlineTop = clamp(inlineTop, visibleTop, Math.max(visibleTop, visibleBottom - cardHeight));
      const inlineLeft = clamp(centerX - cardWidth / 2, minLeft, maxLeft);
      ui.card.style.left = `${Math.round(inlineLeft)}px`;
      ui.card.style.top = `${Math.round(inlineTop)}px`;
      delete ui.card.dataset.docked;
      // The arrow would point across top-layer/border coordinates; omit it.
      ui.arrow.style.display = 'none';
      return;
    }

    let left;
    let top;
    if (rightX + cardWidth <= rightEdge) {
      left = rightX;
      top = clamp(centerY - cardHeight / 2, minTop, maxTop);
    } else if (leftX >= minLeft) {
      left = leftX;
      top = clamp(centerY - cardHeight / 2, minTop, maxTop);
    } else if (belowY + cardHeight <= bottomEdge) {
      left = clamp(centerX - cardWidth / 2, minLeft, maxLeft);
      top = belowY;
    } else if (aboveY >= minTop) {
      left = clamp(centerX - cardWidth / 2, minLeft, maxLeft);
      top = aboveY;
    } else {
      left = clamp(centerX - cardWidth / 2, minLeft, maxLeft);
      top = clamp(centerY - cardHeight / 2, minTop, maxTop);
    }
    left = clamp(left, minLeft, maxLeft);
    top = clamp(top, minTop, maxTop);
    ui.card.style.left = `${Math.round(left)}px`;
    ui.card.style.top = `${Math.round(top)}px`;
    delete ui.card.dataset.docked;
    drawArrow({ left, top, width: cardWidth, height: cardHeight }, ringRect);
  }

  function dockCard() {
    if (!ui) return;
    ui.card.hidden = false;
    ui.card.dataset.docked = 'true';
    const parent = ui.root.parentElement || document.body;
    const box = mountBox(parent);
    ui.card.style.left = '0px';
    ui.card.style.top = '0px';
    const cardWidth = ui.card.offsetWidth || 300;
    const cardHeight = ui.card.offsetHeight || 96;
    const margin = EDGE_MARGIN;
    const mobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches;
    const bottomOffset = parent === document.body ? (mobile ? 86 : 72) : 16;
    const view = { left: box.scrollLeft, top: box.scrollTop, width: box.width, height: box.height };
    const left = clamp(
      view.left + view.width / 2 - cardWidth / 2,
      view.left + margin,
      Math.max(view.left + margin, view.left + view.width - cardWidth - margin),
    );
    const top = clamp(
      view.top + view.height - cardHeight - bottomOffset,
      view.top + margin,
      Math.max(view.top + margin, view.top + view.height - cardHeight - margin),
    );
    ui.card.style.left = `${Math.round(left)}px`;
    ui.card.style.top = `${Math.round(top)}px`;
    ui.arrow.style.display = 'none';
  }

  function pointsOnRect(rect, x, y) {
    return { x: clamp(x, rect.left, rect.left + rect.width), y: clamp(y, rect.top, rect.top + rect.height) };
  }

  function drawArrow(cardRect, ringRect) {
    const cardCenter = { x: cardRect.left + cardRect.width / 2, y: cardRect.top + cardRect.height / 2 };
    const ringCenter = { x: ringRect.left + ringRect.width / 2, y: ringRect.top + ringRect.height / 2 };
    const overlaps =
      cardRect.left < ringRect.left + ringRect.width &&
      cardRect.left + cardRect.width > ringRect.left &&
      cardRect.top < ringRect.top + ringRect.height &&
      cardRect.top + cardRect.height > ringRect.top;
    if (overlaps) {
      ui.arrow.style.display = 'none';
      return;
    }
    const from = pointsOnRect(cardRect, ringCenter.x, ringCenter.y);
    const to = pointsOnRect(ringRect, cardCenter.x, cardCenter.y);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 10) {
      ui.arrow.style.display = 'none';
      return;
    }
    const ux = dx / length;
    const uy = dy / length;
    const headLength = 8;
    const headWidth = 4.5;
    const base = { x: to.x - ux * headLength, y: to.y - uy * headLength };
    const side = { x: -uy, y: ux };
    const p1 = { x: base.x + side.x * headWidth, y: base.y + side.y * headWidth };
    const p2 = { x: base.x - side.x * headWidth, y: base.y - side.y * headWidth };
    ui.arrowLine.setAttribute('x1', String(Math.round(from.x * 10) / 10));
    ui.arrowLine.setAttribute('y1', String(Math.round(from.y * 10) / 10));
    ui.arrowLine.setAttribute('x2', String(Math.round(base.x * 10) / 10));
    ui.arrowLine.setAttribute('y2', String(Math.round(base.y * 10) / 10));
    ui.arrowHead.setAttribute(
      'points',
      `${Math.round(to.x * 10) / 10},${Math.round(to.y * 10) / 10} ${Math.round(p1.x * 10) / 10},${Math.round(p1.y * 10) / 10} ${Math.round(p2.x * 10) / 10},${Math.round(p2.y * 10) / 10}`,
    );
    ui.arrow.style.display = '';
  }

  function shouldScrollIntoView(target) {
    const dialog = openDialogFor(target);
    const box = mountBox(dialog || document.body);
    const rect = toMount(target.getBoundingClientRect(), box);
    const pad = 10;
    const left = box.scrollLeft;
    const top = box.scrollTop;
    return (
      rect.top < top + pad ||
      rect.left < left + pad ||
      rect.top + rect.height > top + box.height - pad ||
      rect.left + rect.width > left + box.width - pad
    );
  }

  function scrollTargetIntoView(target) {
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    try {
      target.scrollIntoView({ block: 'center', inline: 'center', behavior });
    } catch {
      try {
        target.scrollIntoView();
      } catch {
        /* older engines: leave the scroll position alone */
      }
    }
  }

  return api;
}
