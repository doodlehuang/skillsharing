// SkillLoop — 换技 SPA
// 原生 ES Module，无构建步骤。所有用户内容经 esc() 转义后插入。

import { createTour } from './tour.js';

/* ------------------------------------------------------------------ */
/* 工具                                                                 */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const appEl = $('#app');
const DEMO_MODE = location.pathname === '/demo' || location.pathname.startsWith('/demo/');
const pagePath = path => DEMO_MODE && !(path === '/demo' || path.startsWith('/demo/') || path.startsWith('/demo?')) ? '/demo' + (path === '/' ? '' : path) : path;
function scopeHtml(html) {
  const content = DEMO_MODE ? html.replace(/href="\/(?!demo(?:[\/"?#]))/g, 'href="/demo/') : html;
  return content.replace('href="/demo/" data-production-home', 'href="/" data-production-home');
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);

const ICONS = {
  swap: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  arrow: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  spark: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  compass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  inbox: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v5h16v-5M4 13l2.5-7h11L20 13"/><path d="M4 13h4l1 2h6l1-2h4"/></svg>',
  user: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  coin: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5h3.8a1.9 1.9 0 0 1 0 3.8H9.5"/></svg>',
  chat: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5h15v10h-9l-4 3v-3h-2z"/></svg>',
  info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/></svg>',
  caret: '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg>',
  logout: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5H6v14h8M10 12h9M16 8.5l3.5 3.5L16 15.5"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
  pin: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  music: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  code: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/></svg>',
  design: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
  language: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z"/></svg>',
  camera: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.2-2h7.6L17 8h3v10H4z"/><circle cx="12" cy="13" r="3"/></svg>',
  hand: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V6a2 2 0 1 1 4 0v6M12 12V5a2 2 0 1 1 4 0v8M16 13V8.5a2 2 0 1 1 4 0V15c0 3.5-2.5 6-6 6h-1.5c-2 0-3.4-.8-4.6-2.3L4 14.4a2 2 0 0 1 3-2.6L9 14"/></svg>',
  dots: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
  all: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
};

const CATEGORY_ICONS = {
  '全部': 'all', '音乐': 'music', '编程': 'code', '设计': 'design',
  '语言': 'language', '摄影': 'camera', '手作': 'hand', '其他': 'dots',
};

const BRAND_SVG = `<svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="10" fill="#173b2e"/><g fill="none" stroke="#d6f25b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18a8 8 0 0 1 13.7-5.7"/><path d="M24 8.5v5.2h-5.2"/><path d="M26 18a8 8 0 0 1-13.7 5.7"/><path d="M12 27.5v-5.2h5.2"/></g></svg>`;

const STATUS_META = {
  pending: { label: '待回复', cls: 'pending' },
  accepted: { label: '进行中', cls: 'accepted' },
  completed: { label: '已完成', cls: 'completed' },
  declined: { label: '已婉拒', cls: 'declined' },
  cancelled: { label: '已取消', cls: 'cancelled' },
};

const FORMAT_LABEL = { online: '线上', offline: '线下', both: '线上线下均可' };
const FORMAT_SHORT = { online: '线上', offline: '线下', both: '线上 / 线下' };

// 统一按北京时间展示，避免演示数据在不同时区机器上漂移
const TZ = 'Asia/Shanghai';
function partsOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const out = {};
  for (const { type, value } of fmt.formatToParts(d)) out[type] = value;
  return { month: Number(out.month), day: Number(out.day), hour: out.hour === '24' ? '00' : out.hour, minute: out.minute };
}
function fmtDate(iso, withTime = true) {
  const p = partsOf(iso);
  if (!p) return '—';
  return withTime ? `${p.month} 月 ${p.day} 日 ${p.hour}:${p.minute}` : `${p.month} 月 ${p.day} 日`;
}
// datetime-local 输入值（北京时间）→ ISO
function localInputToISO(value) {
  if (!value) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 天前`;
  return fmtDate(iso, false);
}

function starRow(rating, count) {
  const full = Math.round(rating || 0);
  const stars = Array.from({ length: 5 }, (_, i) => `<span class="${i < full ? '' : 'off'}">★</span>`).join('');
  return `<span class="stars" role="img" aria-label="评分 ${rating || 0}">${stars}</span>${
    count != null ? `<span class="rate-num">${rating ? rating.toFixed(1) : '—'}</span><span class="rate-count">${count} 份评价</span>` : ''
  }`;
}

function ratingBreakdown(reviews) {
  const counts = [0, 0, 0, 0, 0];
  for (const review of reviews) {
    const index = Math.min(5, Math.max(1, Math.round(review.rating))) - 1;
    counts[index] += 1;
  }
  const total = reviews.length || 1;
  return counts
    .map((n, i) => ({ stars: i + 1, n, pct: Math.round((n / total) * 100) }))
    .reverse();
}

function toast(message, type = 'info') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'error' ? ICONS.info : type === 'success' ? ICONS.check : ICONS.spark;
  el.innerHTML = `${icon}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 260);
  }, type === 'error' ? 4200 : 2600);
}

/* ------------------------------------------------------------------ */
/* API 客户端                                                           */
/* ------------------------------------------------------------------ */

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  if (DEMO_MODE && !path.startsWith('/api/demo/')) path = '/api/demo' + path.slice(4);
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: method !== 'GET' ? { 'content-type': 'application/json', 'x-skillloop-request': '1' } : {},
    body: method !== 'GET' ? JSON.stringify(body || {}) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new ApiError(data?.error || 'ERROR', data?.message || '请求失败，请重试', res.status);
    throw err;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* 状态                                                                 */
/* ------------------------------------------------------------------ */

const state = {
  me: null, // { user, teach, learn, stats, demoUsers }
  booted: false,
  // 每次切换示例身份 +1；迟到的旧身份响应据此丢弃
  identityEpoch: 0,
};

// T3 导览接入点：tour 由 tour.js 注入，为 null 时所有调用都是空操作
let tour = null;
const notifyTour = (type, detail) => tour?.notify?.(type, detail);

const isAuthed = () => !!state.me;

async function refreshMe() {
  const epoch = state.identityEpoch;
  try {
    const me = await api('/api/me');
    if (epoch === state.identityEpoch) state.me = me;
  } catch (e) {
    if (e.status === 401) {
      if (epoch === state.identityEpoch) state.me = null;
    } else throw e;
  }
  return state.me;
}

/* ------------------------------------------------------------------ */
/* 路由                                                                 */
/* ------------------------------------------------------------------ */

const routes = [
  [/^\/$/, 'home'],
  [/^\/login$/, 'login'],
  [/^\/discover$/, 'discover'],
  [/^\/matches$/, 'matches'],
  [/^\/exchanges$/, 'exchanges'],
  [/^\/exchanges\/([A-Za-z0-9]+)$/, 'exchangeDetail', ['id']],
  [/^\/me$/, 'profile'],
  [/^\/u\/([A-Za-z0-9]+)$/, 'publicProfile', ['id']],
];

function currentRoute() {
  const raw = DEMO_MODE ? location.pathname.slice(5) : location.pathname;
  const path = raw.replace(/\/+$/, '') || '/';
  for (const [re, name, keys] of routes) {
    const m = path.match(re);
    if (m) {
      const params = {};
      (keys || []).forEach((k, i) => (params[k] = m[i + 1]));
      return { name, params, path };
    }
  }
  return { name: 'notfound', params: {}, path };
}

function navigate(path, { replace = false } = {}) {
  const target = new URL(path, location.origin);
  if (target.origin !== location.origin) path = '/discover';
  else path = target.pathname + target.search + target.hash;
  path = pagePath(path);
  if (path === location.pathname + location.search) {
    render();
    return;
  }
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  render();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) {
    render();
    return;
  }
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  closeMenu();
  navigate(link.getAttribute('href'));
});

window.addEventListener('popstate', () => {
  closeMenu();
  render();
});

/* ------------------------------------------------------------------ */
/* 渲染框架                                                             */
/* ------------------------------------------------------------------ */

let renderSeq = 0;

async function render() {
  const seq = ++renderSeq;
  const route = currentRoute();
  closeMenu();

  for (const h of [...document.querySelectorAll('dialog.modal')]) h.close();

  // 未登录时，受保护页面直接进入登录页
  if (!isAuthed() && ['discover', 'matches', 'exchanges', 'exchangeDetail', 'profile', 'publicProfile'].includes(route.name)) {
    navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
    return;
  }

  // 已登录时首页就是名录，不再把整个视图嵌进另一个路由
  if (route.name === 'home' && isAuthed()) {
    navigate('/discover', { replace: true });
    return;
  }

  const headerHtml = (DEMO_MODE ? '<div class="notice warn" role="status">公开示例环境：其他访客可以查看这里的内容，请勿填写私人信息。 <a href="/" data-production-home>返回正式站点</a></div>' : '') + (route.name === 'login' ? '' : renderHeader(route));
  appEl.innerHTML = scopeHtml(`${headerHtml}<main class="page" id="main" tabindex="-1"><div class="shell"><div class="page-loading" role="status"><span class="sr-only">正在加载</span><div class="skeleton" style="width:42%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:58%"></div></div></div></main>${renderFooter()}`);

  let html = '';
  try {
    html = await VIEWS[route.name](route.params);
  } catch (err) {
    if (err.status === 401) {
      state.me = null;
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
      return;
    }
    console.error(err);
    html = `<main class="page"><div class="shell">${errorState(err.message || '页面加载失败')}</div></main>`;
  }
  if (seq !== renderSeq) return;

  appEl.innerHTML = scopeHtml(`${headerHtml}${html}${renderFooter()}${renderMobileNav(route)}`);
  const mainEl = appEl.querySelector('main');
  if (mainEl) {
    mainEl.id = 'main';
    mainEl.setAttribute('tabindex', '-1');
  }
  ((route.afterRender) || (() => {}))();
  const after = VIEW_AFTER[route.name];
  if (after) after(route.params);
  tour?.refresh?.();
}

const VIEWS = {};
const VIEW_AFTER = {};

function errorState(message) {
  return `<div class="empty"><span class="empty-icon">${ICONS.info}</span><h3>这一步没有加载出来</h3><p>${esc(message)}</p><div class="action-bar" style="margin-top:2px"><button class="btn btn-ghost" type="button" data-retry>重试</button><a class="btn btn-ghost" href="/" data-link>回到首页</a></div></div>`;
}

/* ------------------------------------------------------------------ */
/* 布局片段                                                             */
/* ------------------------------------------------------------------ */

function renderHeader(route) {
  const me = state.me;
  const active = (names) => (names.includes(route.name) ? ' active' : '');
  const pending = me?.stats?.pendingIncoming || 0;

  const cur = (names) => (names.includes(route.name) ? ' aria-current="page"' : '');
  const nav = me
    ? `<nav class="site-nav" aria-label="主导航">
        <a class="nav-link${active(['discover'])}"${cur(['discover'])} href="/discover" data-link>名录</a>
        <a class="nav-link${active(['matches'])}"${cur(['matches'])} href="/matches" data-link>匹配</a>
        <a class="nav-link${active(['exchanges', 'exchangeDetail'])}"${cur(['exchanges', 'exchangeDetail'])} href="/exchanges" data-link>交换${
          pending ? `<span class="nav-badge">${pending}</span>` : ''
        }</a>
        <a class="nav-link${active(['profile'])}"${cur(['profile'])} href="/me" data-link data-tour="nav-me">我的</a>
      </nav>`
    : `<nav class="site-nav" aria-label="主导航">
        <a class="nav-link" href="/#how" data-link>怎么换</a>
      </nav>`;

  const right = me
    ? `<a class="credit" href="/me#ledger" data-link title="学时余额"><b>${me.stats.balance}</b><span>学时</span></a>
       <div class="menu-wrap">
         <button class="menu-trigger" type="button" data-menu-toggle aria-expanded="false" aria-controls="account-menu" aria-label="账号菜单">
           <span class="avatar sm">${esc(me.user.avatar)}</span>
           <span class="menu-name">${esc(me.user.name)}</span>
           ${ICONS.caret}
         </button>
       </div>`
    : `<a class="btn btn-sm btn-ghost" href="/login" data-link>登录</a>
       <a class="btn btn-sm btn-primary" href="/login?mode=register" data-link>创建账号</a>`;

  return `<header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="${me ? '/discover' : '/'}" data-link aria-label="SkillLoop 首页">${BRAND_SVG}<span class="brand-name">SkillLoop 换技</span></a>
      ${nav}
      <div class="header-right">${right}</div>
    </div>
  </header>`;
}

function renderFooter() {
  return `<footer class="site-footer">
    <div class="shell footer-inner">
      <span>SkillLoop 换技</span>
      <span>用学时交换技能</span>
      <span class="fnote"><span>${DEMO_MODE ? '示例环境' : '技能交换社区'}</span><span>© 2026</span></span>
    </div>
  </footer>`;
}

function renderMobileNav(route) {
  if (!isAuthed()) return '';
  const act = (n) => (route.name === n ? ' active' : '');
  const pending = state.me?.stats?.pendingIncoming || 0;
  return `<nav class="mobile-nav" aria-label="移动导航">
    <a href="/discover" data-link${act('discover').includes('active') ? ' aria-current="page"' : ''} class="${act('discover').trim()}">${ICONS.compass}<span>名录</span></a>
    <a href="/matches" data-link${act('matches').includes('active') ? ' aria-current="page"' : ''} class="${act('matches').trim()}">${ICONS.swap}<span>匹配</span></a>
    <a href="/exchanges" data-link${(act('exchanges') + act('exchangeDetail')).includes('active') ? ' aria-current="page"' : ''} class="${act('exchanges').trim() || act('exchangeDetail').trim()}">${ICONS.inbox}<span>交换</span>${pending ? `<span class="dot"></span>` : ''}</a>
    <a href="/me" data-link data-tour="nav-me"${act('profile').includes('active') ? ' aria-current="page"' : ''} class="${act('profile').trim()}">${ICONS.user}<span>我的</span></a>
  </nav>`;
}

// 就地更新页头统计（学时余额 / 交换待办角标），不重建 header
function syncHeaderStats() {
  const me = state.me;
  if (!me) return;
  const pending = me.stats?.pendingIncoming || 0;
  for (const el of document.querySelectorAll('.credit b')) el.textContent = String(me.stats?.balance ?? 0);

  const isExchangesHref = (a) => {
    const href = (a.getAttribute('href') || '').replace(/\/+$/, '');
    return href === '/exchanges' || href.endsWith('/exchanges');
  };

  for (const link of document.querySelectorAll('.site-nav a[href]')) {
    if (!isExchangesHref(link)) continue;
    let badge = link.querySelector('.nav-badge');
    if (pending) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        link.appendChild(badge);
      }
      badge.textContent = String(pending);
    } else if (badge) {
      badge.remove();
    }
  }

  for (const link of document.querySelectorAll('.mobile-nav a[href]')) {
    if (!isExchangesHref(link)) continue;
    let dot = link.querySelector('.dot');
    if (pending) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'dot';
        link.appendChild(dot);
      }
    } else if (dot) {
      dot.remove();
    }
  }
}

let menuClosing = false; // 移除焦点面板会同步触发 wrap 的 focusout，用它防止 closeMenu 重入

function closeMenu({ restoreFocus = false } = {}) {
  if (menuClosing) return;
  menuClosing = true;
  try {
    const trigger = document.querySelector('[data-menu-toggle][aria-expanded="true"]') || document.querySelector('[data-menu-toggle]');
    for (const panel of [...document.querySelectorAll('.menu-panel')]) {
      if (!panel.isConnected) continue;
      // 先把焦点移回触发按钮：删除包含 activeElement 的节点会触发 focusout 重入
      if (restoreFocus || panel.contains(document.activeElement)) trigger?.focus();
      panel.remove();
    }
    for (const el of document.querySelectorAll('[data-menu-toggle]')) el.setAttribute('aria-expanded', 'false');
  } finally {
    menuClosing = false;
  }
  tour?.refresh?.();
}

function toggleMenu(btn) {
  const existing = document.querySelector('.menu-panel');
  if (existing) {
    closeMenu();
    return;
  }
  const me = state.me;
  if (!me) return;
  const demos = me.demoUsers || [];
  const wrap = btn.closest('.menu-wrap');
  const panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.id = 'account-menu';
  panel.innerHTML = `
    <a class="menu-item" href="/me" data-link>${ICONS.user}<span>我的档案</span></a>
    <a class="menu-item" href="/me#ledger" data-link>${ICONS.coin}<span>学时存折</span><span class="meta">${me.stats.balance} 学时</span></a>
    ${
      demos.length
        ? `<div class="menu-sep"></div><div class="menu-label lab">示例身份</div>
           ${demos
             .map(
               (d) => `<button class="menu-item${d.id === me.user.id ? ' is-current' : ''}" data-demo-switch="${esc(d.id)}">
                 <span class="avatar sm">${esc(d.avatar)}</span>
                 <span>${esc(d.name)}</span>
                 <span class="meta">${d.id === me.user.id ? '当前' : esc(d.city)}</span>
               </button>`
             )
             .join('')}`
        : ''
    }
    <div class="menu-sep"></div>
    <button class="menu-item" data-logout>${ICONS.logout}<span>退出登录</span></button>`;
  panel.innerHTML = scopeHtml(panel.innerHTML);
  wrap.appendChild(panel);
  btn.setAttribute('aria-expanded', 'true');
  panel.querySelector('a, button')?.focus();

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });
  if (!wrap.dataset.focusBound) {
    wrap.dataset.focusBound = '1';
    wrap.addEventListener('focusout', (e) => {
      if (wrap.contains(e.relatedTarget)) return;
      // focusout 可能在移除面板的过程中同步触发：延后一拍并复查状态，避免重入 closeMenu
      queueMicrotask(() => {
        if (menuClosing) return;
        const panel = wrap.querySelector('.menu-panel');
        if (!panel) return;
        if (wrap.contains(document.activeElement)) return;
        closeMenu();
      });
    });
  }
  panel.querySelector('[data-logout]').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.me = null;
    closeMenu();
    toast('已退出登录');
    navigate('/');
  });
  for (const b of panel.querySelectorAll('[data-demo-switch]')) {
    b.addEventListener('click', () => {
      switchDemoIdentity(b.dataset.demoSwitch, { mode: 'switch', button: b });
    });
  }
  tour?.refresh?.();
}

document.addEventListener('click', (e) => {
  const toggle = e.target.closest('[data-menu-toggle]');
  if (toggle) {
    e.preventDefault();
    toggleMenu(toggle);
    return;
  }
  if (!e.target.closest('.menu-panel')) closeMenu();
});

/* ------------------------------------------------------------------ */
/* 通用组件                                                             */
/* ------------------------------------------------------------------ */

function personCard(p) {
  const perfect = p.mutual?.teachesWhatIWant?.length && p.mutual?.wantsWhatITeach?.length;
  const teachChips = p.teach
    .map((t) => `<span class="chip chip-teach"><span class="skill-name">${esc(t.skill)}</span>${t.level ? `<span class="chip-hint">${esc(t.level)}</span>` : ''}</span>`)
    .join('');
  const learnChips = p.learn
    .map((l) => `<span class="chip chip-learn"><span class="skill-name">${esc(l.skill)}</span></span>`)
    .join('');
  const formats = [...new Set(p.teach.map((t) => t.format).filter(Boolean))].map((f) => FORMAT_SHORT[f] || '线上').join(' / ') || '待定';
  const level = p.teach[0]?.level || '—';
  const place = p.reviewCount
    ? `<span>★ ${p.rating ? p.rating.toFixed(1) : '—'}</span><span>${p.reviewCount} 份评价</span>`
    : '<span>新成员</span>';

  return `<article class="record${perfect ? ' is-mutual' : ''}">
    <div class="record-head">
      <span class="avatar">${esc(p.avatar)}</span>
      <div class="record-id">
        <h3 class="record-name"><a href="/u/${esc(p.id)}" data-link>${esc(p.name)}</a>${perfect ? '<span class="stamp stamp-acid">双向可换</span>' : ''}</h3>
        <div class="record-place">${place}</div>
        ${p.headline ? `<p class="record-headline">${esc(p.headline)}</p>` : ''}
      </div>
      <div class="record-score"><b>${esc(p.score)}</b><span>匹配</span></div>
    </div>
    <dl class="record-fields">
      <div class="record-field"><dt>城市</dt><dd>${p.city ? esc(p.city) : '未填写'}</dd></div>
      <div class="record-field"><dt>授课</dt><dd>${esc(formats)}</dd></div>
      <div class="record-field"><dt>最高水平</dt><dd>${esc(level)}</dd></div>
    </dl>
    <div class="record-skills">
      <div class="skill-line"><span class="skill-label t">能教</span><div class="chip-row">${teachChips || '<span class="faint">还没有发布</span>'}</div></div>
      <div class="skill-line"><span class="skill-label l">想学</span><div class="chip-row">${learnChips || '<span class="faint">还没有发布</span>'}</div></div>
    </div>
    ${p.reason ? `<div class="record-reason">${ICONS.spark}<span>${esc(p.reason)}</span></div>` : ''}
    <div class="record-actions">
      <button class="btn btn-sm btn-primary" data-propose="${esc(p.id)}">发起交换</button>
    </div>
  </article>`;
}

function emptyState(icon, title, desc, cta) {
  return `<div class="empty"><span class="empty-icon">${ICONS[icon] || ICONS.info}</span><h3>${esc(title)}</h3><p>${esc(desc)}</p>${cta || ''}</div>`;
}

/* ------------------------------------------------------------------ */
/* 视图：首页                                                           */
/* ------------------------------------------------------------------ */

VIEWS.home = async () => {
  document.title = 'SkillLoop 换技';

  let stats = { users: 6, skills: 13, exchanges: 7, hours: 24 };
  let demos = [];
  try {
    demos = (await api('/api/demo/demo-users')).users || [];
  } catch {
    /* 种子未就绪时忽略 */
  }

  const demoButtons = demos
    .slice(0, 6)
    .map(
      (d) => `<button class="demo-btn" data-quick-demo="${esc(d.id)}">
        <span class="avatar">${esc(d.avatar)}</span>
        <span>${esc(d.name)}</span>
        <span class="city">${esc(d.city)}</span>
      </button>`
    )
    .join('');

  return `<main class="landing">
    <section class="hero">
      <div class="shell hero-grid">
        <div>
          <div class="hero-labels"><span class="lab">时间信用</span><span class="lab">技能互换</span></div>
          <h1 class="hero-statement">把会的东西，<br />换成<em>想学的事</em>。</h1>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" data-quick-demo="" data-tour="demo-enter">用示例身份进入 ${ICONS.arrow}</button>
            <a class="btn btn-lg btn-ghost" href="/login?mode=register" data-link>${DEMO_MODE ? '切换示例身份' : '创建账号'}</a>
          </div>
          <div class="hero-facts">
            <div class="fact"><span class="lab">起点</span><b>3 学时</b></div>
            <div class="fact"><span class="lab">互换</span><b>各教一小时</b></div>
            <div class="fact"><span class="lab">结算</span><b>完成后互评</b></div>
          </div>
        </div>
        <div class="sheet-stage">
          <div class="swap-sheet" aria-label="交换示例">
            <div class="sheet-head"><span class="lab">交换示例</span><span class="stamp stamp-faint">第 0087 号</span></div>
            <div class="sheet-body">
              <div class="sheet-row"><span class="role">教</span><span class="avatar sm">🌿</span><div class="who"><b>林知夏</b><span>界面设计</span></div><span class="sk">进阶</span></div>
              <div class="sheet-link"><i></i><span>各 1 小时</span></div>
              <div class="sheet-row"><span class="role">教</span><span class="avatar sm">🗣️</span><div class="who"><b>白露</b><span>英语口语</span></div><span class="sk">精通</span></div>
            </div>
            <div class="sheet-foot"><span class="lab">学时变化</span><b>0</b></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="how">
      <div class="shell">
        <div class="section-head"><h2 class="section-title">怎么换</h2><span class="section-count">四步</span></div>
        <div class="steps">
          <div class="step"><span class="step-no">01</span><h3>写下能教的</h3><p>乐器、编程、做饭、修图，都可以。写清能教到哪里，别人就知道该不该找你。</p></div>
          <div class="step"><span class="step-no">02</span><h3>写下想学的</h3><p>想学什么、为什么想学。系统会把它和别人的「能教」做比对。</p></div>
          <div class="step"><span class="step-no">03</span><h3>找到可以交换的人</h3><p>你教 TA 想学的，TA 教你想要的，双方各出一小时，学时不变。</p></div>
          <div class="step"><span class="step-no">04</span><h3>约时间、完成、互评</h3><p>站内约时间，上完课标记完成。教出去的一小时，会变成请别人教你的学时。</p></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell">
        <div class="stat-line">
          <span><b>${stats.users}</b>位成员</span>
          <span><b>${stats.skills}</b>门在教技能</span>
          <span><b>${stats.exchanges}</b>次交换</span>
          <span><b>${stats.hours}</b>小时已传授</span>
        </div>
        <div class="demo-strip">
          <div class="t">先用示例档案看看</div>
          <div class="demo-btns">${demoButtons}</div>
        </div>
      </div>
    </section>
  </main>`;
};

VIEW_AFTER.home = () => {
  for (const btn of document.querySelectorAll('[data-quick-demo]')) {
    btn.addEventListener('click', () => quickDemoLogin(btn.dataset.quickDemo || '', btn));
  }
};

async function quickDemoLogin(userId, button = null) {
  if (!DEMO_MODE) {
    try {
      await api('/api/demo/auth/demo', { method: 'POST', body: userId ? { userId } : {} });
      location.assign('/demo/discover');
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }
  await switchDemoIdentity(userId, { mode: 'enter', button });
}

let identitySwitchLock = false; // 切换进行中时忽略重复点击

// 示例身份切换：账户菜单用 mode='switch'，落地页 / 示例登录列表用 mode='enter'。
// 先作废旧身份（identityEpoch / renderSeq）再请求，迟到的旧身份响应会被丢弃。
async function switchDemoIdentity(userId, { mode = 'switch', button = null } = {}) {
  if (identitySwitchLock) return;
  identitySwitchLock = true;
  const clicked = button instanceof HTMLElement ? button : null;
  if (clicked) {
    clicked.disabled = true;
    clicked.setAttribute('aria-busy', 'true');
  }
  const previousMe = state.me;
  try {
    state.identityEpoch += 1;
    renderSeq += 1;
    state.me = null;

    const enterDemo = () => api('/api/auth/demo', { method: 'POST', body: userId ? { userId } : {} });
    if (mode === 'switch') {
      try {
        await api('/api/auth/demo-switch', { method: 'POST', body: { userId } });
      } catch (err) {
        // session 失效时 demo-switch 会 401：退回到直接以示例身份进入
        if (!(err instanceof ApiError) || err.status !== 401) throw err;
        await enterDemo();
      }
    } else {
      await enterDemo();
    }

    let me = await refreshMe();
    if (!me) {
      await enterDemo();
      me = await refreshMe();
    }
    if (!me) throw new ApiError('UNAUTHORIZED', '身份切换失败，请重试', 401);

    closeMenu();
    toast(`已切换为 ${me.user.name}`, 'success');
    notifyTour('identity-switched', { userId: me.user.id, userName: me.user.name });
    window.scrollTo({ top: 0 });

    const route = currentRoute();
    if (route.name === 'exchangeDetail') {
      // 新身份未必是这次交换的参与者：探测成功就停在原页，403/404 回交换列表
      try {
        await api(`/api/exchanges/${encodeURIComponent(route.params.id)}`);
        await render();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) navigate('/exchanges', { replace: true });
        else throw err;
      }
    } else if (route.name === 'login' || route.name === 'home') {
      navigate('/discover', { replace: true });
    } else {
      await render();
    }
  } catch (err) {
    if (err instanceof ApiError) {
      toast(err.message, 'error');
    } else {
      console.error(err);
    }
    // state.me 在请求前已清空；切换失败时用旧身份恢复界面，避免看起来像被登出
    if (!state.me) {
      try {
        const restored = await refreshMe();
        if (!restored && previousMe) state.me = previousMe;
      } catch (refreshErr) {
        console.error(refreshErr);
        if (previousMe) state.me = previousMe;
      }
    }
    if (!(err instanceof ApiError)) {
      // 身份可能已在服务端切换成功：界面仍要跟上
      try {
        await render();
      } catch (renderErr) {
        console.error(renderErr);
      }
    }
  } finally {
    if (clicked) {
      clicked.disabled = false;
      clicked.removeAttribute('aria-busy');
    }
    closeMenu();
    tour?.refresh?.();
    identitySwitchLock = false;
  }
}

/* ------------------------------------------------------------------ */
/* 视图：登录                                                           */
/* ------------------------------------------------------------------ */

VIEWS.login = async () => {
  document.title = '登录｜SkillLoop 换技';
  const params = new URLSearchParams(location.search);
  if (DEMO_MODE) {
    const demos = (await api('/api/demo-users')).users;
    return `<main class="landing"><div class="shell auth-wrap"><div class="auth-side"><h1>选择示例身份</h1></div><div class="auth-card"><div class="demo-list">${demos.map(d => `<button class="demo-row" data-demo="${esc(d.id)}"><span class="avatar sm">${esc(d.avatar)}</span><span class="nm">${esc(d.name)}</span><span class="meta">${esc(d.city)}</span><span class="go">${ICONS.arrow}</span></button>`).join('')}</div></div></div></main>`;
  }
  const mode = params.get('mode') === 'register' ? 'register' : 'login';
  const next = params.get('next') || '/discover';

  if (isAuthed()) {
    navigate(next, { replace: true });
    return '';
  }

  return `<main class="landing"><div class="shell auth-wrap">
    <div class="auth-side">
      <a class="brand auth-brand" href="/" data-link>${BRAND_SVG}<span class="brand-name">SkillLoop 换技</span></a>
      <h1>你会的，<br />正好是别人<br />想学的。</h1>
    </div>
    <div class="auth-card">
      <div class="auth-tabs">
        <button class="auth-tab${mode === 'login' ? ' active' : ''}" data-auth-tab="login">登录</button>
        <button class="auth-tab${mode === 'register' ? ' active' : ''}" data-auth-tab="register">创建账号</button>
      </div>
      <form class="auth-form" id="auth-form" novalidate>
        <div class="field" data-register-only style="display:${mode === 'register' ? 'flex' : 'none'}">
          <label class="label" for="f-name">昵称</label>
          <input class="input" id="f-name" name="name" placeholder="别人怎么称呼你" autocomplete="nickname" maxlength="24" />
        </div>
        <div class="field">
          <label class="label" for="f-email">邮箱</label>
          <input class="input" id="f-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required />
        </div>
        <div class="field">
          <label class="label" for="f-password">密码<span class="hint">注册需要 15–128 个字符</span></label>
          <input class="input" id="f-password" name="password" type="password" placeholder="注册需要 15–128 个字符" autocomplete="current-password" required />
        </div>
        <div class="form-error" id="auth-error" role="alert"></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit" id="auth-submit">${mode === 'register' ? '创建账号' : '登录'}</button>
      </form>
      <a class="btn btn-ghost" href="/demo/login">查看示例环境</a>
    </div>
  </div></main>`;
};

VIEW_AFTER.login = () => {
  if (DEMO_MODE) { for (const b of document.querySelectorAll('[data-demo]')) b.addEventListener('click', () => quickDemoLogin(b.dataset.demo, b)); return; }
  let mode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';
  const form = $('#auth-form');
  const errEl = $('#auth-error');

  const setMode = (next) => {
    mode = next;
    for (const tab of document.querySelectorAll('[data-auth-tab]')) tab.classList.toggle('active', tab.dataset.authTab === next);
    for (const el of document.querySelectorAll('[data-register-only]')) {
      el.style.display = next === 'register' ? (el.tagName === 'P' ? 'block' : 'flex') : 'none';
    }
    $('#auth-submit').textContent = next === 'register' ? '创建账号' : '登录';
    form.password.autocomplete = next === 'register' ? 'new-password' : 'current-password';
    errEl.textContent = '';
  };

  for (const tab of document.querySelectorAll('[data-auth-tab]')) {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const btn = $('#auth-submit');
    btn.disabled = true;
    try {
      const email = form.email.value.trim();
      const password = form.password.value;
      const name = form.name ? form.name.value.trim() : '';
      if (mode === 'register') {
        await api('/api/auth/register', { method: 'POST', body: { email, password, name } });
      } else {
        await api('/api/auth/login', { method: 'POST', body: { email, password } });
      }
      await refreshMe();
      toast(mode === 'register' ? '账号创建好了，账户里有 3 学时' : `欢迎回来，${state.me.user.name}`, 'success');
      const next = new URLSearchParams(location.search).get('next') || (mode === 'register' ? '/me' : '/discover');
      navigate(next, { replace: true });
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  for (const b of document.querySelectorAll('[data-demo]')) {
    b.addEventListener('click', () => quickDemoLogin(b.dataset.demo, b));
  }
};

/* ------------------------------------------------------------------ */
/* 视图：发现                                                           */
/* ------------------------------------------------------------------ */

VIEWS.discover = async () => {
  document.title = '名录｜SkillLoop 换技';
  const q = new URLSearchParams(location.search).get('q') || '';
  const category = new URLSearchParams(location.search).get('category') || '';
  const data = await api(`/api/discover?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);
  const me = state.me;
  const perfect = data.people.filter((p) => p.mutual.teachesWhatIWant.length && p.mutual.wantsWhatITeach.length);
  // 一个人只出现一次：双向可换的已经在上面列过，不再重复整张卡
  const others = data.people.filter((p) => !perfect.includes(p));

  const mySkillHint =
    me.teach.length === 0 && me.learn.length === 0
      ? `<div class="notice warn">${ICONS.info}<span>你还没有发布技能。先写下一条「我能教」和一条「我想学」，匹配才有依据。<a href="/me" data-link style="text-decoration:underline">去档案填写</a></span></div>`
      : '';

  const cats = [['全部', ''], ...data.categories.map((c) => [c, c])];
  const indexRow = cats
    .map(([label, value]) => {
      const on = value === category || (!value && !category);
      return `<button class="index-cell${on ? ' active' : ''}" data-cat="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
    })
    .join('');

  return `<main class="page"><div class="shell">
    <div class="page-head">
      <h1 class="page-title">名录</h1>
      <div class="head-stats">
        <div class="head-stat"><b>${data.stats.users}</b><span>位成员</span></div>
        <div class="head-stat"><b>${data.stats.skills}</b><span>门技能</span></div>
        <div class="head-stat"><b>${data.stats.exchanges}</b><span>次交换</span></div>
      </div>
    </div>
    ${mySkillHint}
    <div class="toolbar">
      <div class="search-bar">
        <label class="search-input-wrap" style="display:flex">
          ${ICONS.search}
          <input class="input" id="discover-q" type="search" placeholder="搜技能、名字或城市" value="${esc(q)}" aria-label="搜索成员或技能" />
        </label>
      </div>
      <div class="index-grid" role="group" aria-label="按分类浏览">${indexRow}</div>
    </div>

    ${
      perfect.length
        ? `<section class="section">
            <div class="section-head">
              <h2 class="section-title">双向可换<span class="section-count">${perfect.length}</span></h2>
              <a class="section-link" href="/matches" data-link>看全部匹配</a>
            </div>
            <div class="matcher">${perfect.map((p) => personCard(p)).join('')}</div>
          </section>`
        : ''
    }

    ${
      data.people.length
        ? others.length
          ? `<section class="section">
              <div class="section-head">
                <h2 class="section-title">${perfect.length ? '其他成员' : '全部成员'}<span class="section-count">${others.length}</span></h2>
                ${category ? `<a class="section-link" href="/discover" data-link>清空分类</a>` : ''}
              </div>
              <div class="matcher">${others.map((p) => personCard(p)).join('')}</div>
            </section>`
          : ''
        : `<section class="section">${emptyState('search', '没有找到符合条件的人', '换个关键词，或者清空分类看看。', `<button class="btn btn-ghost" type="button" data-cat="">清空筛选</button>`)}</section>`
    }
  </div></main>`;
};

VIEW_AFTER.discover = () => {
  const input = $('#discover-q');
  let timer = null;
  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const url = new URL(location.href);
        if (input.value.trim()) url.searchParams.set('q', input.value.trim());
        else url.searchParams.delete('q');
        history.replaceState({}, '', url);
        render();
        const next = $('#discover-q');
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      }, 260);
    });
  }
  for (const pill of document.querySelectorAll('[data-cat]')) {
    pill.addEventListener('click', () => {
      const url = new URL(location.href);
      if (!pill.dataset.cat) url.searchParams.delete('category');
      else url.searchParams.set('category', pill.dataset.cat);
      history.pushState({}, '', url);
      render();
    });
  }
  bindProposeButtons();
};

/* ------------------------------------------------------------------ */
/* 视图：匹配                                                           */
/* ------------------------------------------------------------------ */

VIEWS.matches = async () => {
  document.title = '匹配｜SkillLoop 换技';
  const epoch = state.identityEpoch;
  const [data, meData] = await Promise.all([api('/api/matches'), api('/api/me')]);
  if (epoch === state.identityEpoch) state.me = meData;
  const me = state.me || meData;

  const myTeach = me.teach.map((t) => t.skill);
  const myLearn = me.learn.map((l) => l.skill);

  return `<main class="page"><div class="shell">
    <div class="page-head">
      <h1 class="page-title">匹配</h1>
      <div class="head-stats">
        <div class="head-stat"><b>${data.perfect.length}</b><span>双向可换</span></div>
        <div class="head-stat"><b>${data.half.length}</b><span>单向可换</span></div>
      </div>
    </div>

    <section class="panel" style="padding:16px 18px">
      <div class="panel-title">
        <h2>我的技能</h2>
        <a class="section-link" href="/me" data-link>去档案修改</a>
      </div>
      <div class="my-skills">
        <div class="my-skill-line">
          <span class="lab">我能教</span>
          <div class="chip-row">${myTeach.map((s) => `<span class="chip chip-teach">${esc(s)}</span>`).join('') || `<a class="section-link" href="/me" data-link>去发布</a>`}</div>
        </div>
        <div class="my-skill-line">
          <span class="lab">我想学</span>
          <div class="chip-row">${myLearn.map((s) => `<span class="chip chip-learn">${esc(s)}</span>`).join('') || `<a class="section-link" href="/me" data-link>去发布</a>`}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">双向可换<span class="section-count">${data.perfect.length}</span></h2></div>
      <div class="matcher">
        ${
          data.perfect.length
            ? data.perfect.map((p) => personCard(p)).join('')
            : emptyState('swap', '暂时没有双向匹配', '多写几条想学的技能，或者去名录里主动发起一次交换。', `<a class="btn btn-ghost" href="/discover" data-link>去看名录</a>`)
        }
      </div>
    </section>

    ${
      data.half.length
        ? `<section class="section">
            <div class="section-head"><h2 class="section-title">单向可换<span class="section-count">${data.half.length}</span></h2></div>
            <div class="matcher">${data.half.map((p) => personCard(p)).join('')}</div>
          </section>`
        : ''
    }
  </div></main>`;
};

VIEW_AFTER.matches = () => bindProposeButtons();

/* ------------------------------------------------------------------ */
/* 视图：交换列表                                                       */
/* ------------------------------------------------------------------ */

VIEWS.exchanges = async () => {
  document.title = '交换｜SkillLoop 换技';
  const filter = new URLSearchParams(location.search).get('filter') || 'all';
  const data = await api(`/api/exchanges?filter=${encodeURIComponent(filter)}`);
  const counts = data.counts || {};
  const tabs = [
    ['all', '全部', counts.all],
    ['incoming', '待你回复', counts.incoming],
    ['active', '进行中', counts.active],
    ['done', '已完成', counts.done],
  ];

  return `<main class="page"><div class="shell">
    <div class="page-head">
      <h1 class="page-title">交换</h1>
      <div class="head-stats">
        <div class="head-stat"><b>${counts.incoming ?? 0}</b><span>待你回复</span></div>
        <div class="head-stat"><b>${counts.active ?? 0}</b><span>进行中</span></div>
      </div>
    </div>
    <div class="segmented" role="group" aria-label="按状态筛选">
      ${tabs
        .map(
          ([key, label, n]) => `<button type="button" aria-pressed="${filter === key}" class="${filter === key ? 'active' : ''}" data-filter="${key}">${label}<span class="n">${n ?? 0}</span></button>`
        )
        .join('')}
    </div>
    <ul class="exchange-list">
      ${
        data.exchanges.length
          ? data.exchanges.map((ex) => exchangeRow(ex)).join('')
          : emptyState(
              'inbox',
              '这里还没有交换',
              filter === 'incoming' ? '暂时没有需要你处理的请求。去名录里看看谁能教你。' : '找一位技能对得上的人，开口问一句，交换就开始了。',
              `<a class="btn btn-primary" href="/discover" data-link>去看名录</a>`
            )
      }
    </ul>
  </div></main>`;
};

function exchangeRow(ex) {
  const other = ex.role === 'requester' ? ex.partner : ex.requester;
  const me = state.me.user;
  const status = STATUS_META[ex.status] || STATUS_META.pending;
  const attention = ex.role === 'partner' && ex.status === 'pending';
  const statusLabel = ex.status === 'pending' ? (ex.role === 'partner' ? '待你回复' : '等对方回复') : status.label;
  const modeText = ex.mode === 'swap' ? '互教互换' : '学时支付';
  return `<li>
    <a class="exchange-row${attention ? ' attention' : ''}" href="/exchanges/${esc(ex.id)}" data-link>
      <div class="ex-status">
        <span class="stamp stamp-${status.cls}">${statusLabel}</span>
      </div>
      <div class="ex-main">
        <div class="ex-title">
          <span class="skill">${esc(ex.teachSkill)}</span>
          <span class="stamp stamp-faint">${ex.role === 'requester' ? '你发起' : '对方发起'}</span>
        </div>
        <div class="ex-people">
          <span class="avatar sm">${esc(me.avatar)}</span>
          <span class="avatar sm">${esc(other.avatar)}</span>
          <span>${ex.role === 'requester' ? `你向 ${esc(ex.partner.name)} 发起` : `${esc(ex.requester.name)} 向你发起`}</span>
        </div>
        <div class="ex-facts">
          <span class="ex-fact"><span>方式</span><b>${modeText}</b></span>
          <span class="ex-fact"><span>时长</span><b>${ex.durationHours} 小时</b></span>
          <span class="ex-fact"><span>约定</span><b>${esc(fmtDate(ex.proposedAt))}</b></span>
        </div>
      </div>
      <div class="ex-side">
        <span class="ex-time">${esc(fmtDate(ex.updatedAt || ex.createdAt))}</span>
        ${ex.lastMessage ? `<span class="ex-last">${esc(ex.lastMessage.body)}</span>` : ''}
      </div>
    </a>
  </li>`;
}

VIEW_AFTER.exchanges = () => {
  for (const tab of document.querySelectorAll('[data-filter]')) {
    tab.addEventListener('click', () => {
      const url = new URL(location.href);
      if (tab.dataset.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', tab.dataset.filter);
      history.pushState({}, '', url);
      render();
    });
  }
};

/* ------------------------------------------------------------------ */
/* 视图：交换详情                                                       */
/* ------------------------------------------------------------------ */

// 一条消息气泡：mine 用当前身份的头像与「你」，其余用 sender
function chatBubbleHtml(message, { mine = true, sender = null } = {}) {
  const who = mine ? state.me.user : sender;
  return `<div class="msg${mine ? ' mine' : ''}">
        <span class="avatar sm">${esc(who.avatar)}</span>
        <div>
          <div class="msg-bubble">${esc(message.body)}</div>
          <div class="msg-meta"><span class="who">${mine ? '你' : esc(sender.name)}</span><span>${esc(relTime(message.createdAt))}</span></div>
        </div>
      </div>`;
}

VIEWS.exchangeDetail = async ({ id }) => {
  const data = await api(`/api/exchanges/${encodeURIComponent(id)}`);
  document.title = `${data.exchange.teachSkill} 交换｜SkillLoop 换技`;
  return exchangeDetailPageHtml(data, id);
};

// 交换详情左栏（状态 / 交换关系 / 进度 / 操作）。初次渲染与就地更新共用同一份标记
function detailMainHtml(data, id) {
  const ex = data.exchange;
  const p = data.permissions;
  const teacher = ex.partner;
  const learner = ex.requester;
  const status = STATUS_META[ex.status] || STATUS_META.pending;

  const stopLabel = ex.status === 'declined' ? '已婉拒' : ex.status === 'cancelled' ? '已取消' : '';
  const accepted = ex.status === 'accepted' || ex.status === 'completed';
  const completed = ex.status === 'completed';
  const steps = stopLabel
    ? [
        { label: '发起', state: 'done', date: fmtDate(ex.createdAt, false) },
        { label: stopLabel, state: 'done', date: fmtDate(ex.updatedAt, false) },
      ]
    : [
        { label: '发起', state: 'done', date: fmtDate(ex.createdAt, false) },
        { label: '接受', state: accepted ? 'done' : 'current', date: accepted ? (completed ? '已接受' : fmtDate(ex.updatedAt, false)) : '等待回复' },
        { label: '完成', state: completed ? 'done' : accepted ? 'current' : 'future', date: completed ? fmtDate(ex.updatedAt, false) : '待完成' },
      ];
  const timeline = `<div class="timeline">${steps
    .map((step) => `<div class="tl ${step.state}"><b>${step.label}</b><time>${esc(step.date)}</time></div>`)
    .join('')}</div>`;

  const statusNotice =
    ex.status === 'pending'
      ? ex.role === 'partner'
        ? `<div class="notice">${ICONS.info}<span>${esc(ex.requester.name)} 想请你教「${esc(ex.teachSkill)}」。接受后就可以约时间。</span></div>`
        : `<div class="notice">${ICONS.info}<span>请求已发出，等 ${esc(ex.partner.name)} 回复。可以先在消息里补充你的想法。</span></div>`
      : ex.status === 'accepted'
      ? `<div class="notice">${ICONS.info}<span>约在 ${esc(fmtDate(ex.proposedAt))}。上完课，${ex.mode === 'credit' ? '由学习方确认完成后结算' : '任意一方可标记完成'}${
          ex.mode === 'credit' ? '学时' : '互换'
        }。</span></div>`
      : ex.status === 'completed'
      ? `<div class="notice">${ICONS.check}<span>${
          ex.mode === 'credit' ? `已结算 ${ex.durationHours} 学时给 ${esc(teacher.name)}` : '双方各教一小时，学时不变'
        }。留一条评价，给对方也给后来的人一个参考。</span></div>`
      : ex.status === 'declined'
      ? `<div class="notice warn">${ICONS.info}<span>${esc(teacher.name)} 婉拒了这次请求。可以去名录里找别人。</span></div>`
      : `<div class="notice warn">${ICONS.info}<span>这次交换已取消。</span></div>`;

  // 发起留言如果已经是消息线程的第一条，就不在正文里重复一遍
  const requestNote = ex.message && !data.messages.some((m) => m.body === ex.message) ? ex.message : '';

  const actions = [];
  if (p.canAccept) actions.push(`<button class="btn btn-primary" data-action="accept">接受请求</button>`);
  if (p.canDecline) actions.push(`<button class="btn btn-ghost" data-action="decline">婉拒</button>`);
  if (p.canComplete) actions.push(`<button class="btn btn-acid" data-action="complete">标记完成</button>`);
  if (p.canCancel) actions.push(`<button class="btn btn-danger btn-sm" data-action="cancel">取消交换</button>`);

  return `<section class="panel detail-main">
        <div class="detail-stamps">
          <span class="stamp stamp-${status.cls}">${ex.status === 'pending' ? (ex.role === 'partner' ? '待你回复' : '等对方回复') : status.label}</span>
          <span class="stamp">${ex.mode === 'swap' ? '互教互换' : '学时支付'}</span>
          <span class="stamp">${ex.durationHours} 小时</span>
          <span class="stamp stamp-faint">${ex.role === 'requester' ? '我发起' : '对方发起'}</span>
        </div>
        <h1 class="detail-title">${esc(ex.teachSkill)}${ex.giveSkill ? ` 与 ${esc(ex.giveSkill)}` : ''}</h1>

        <div class="swap-diagram">
          <div class="sd-side">
            <span class="avatar">${esc(teacher.avatar)}</span>
            <span class="nm">${esc(teacher.name)}</span>
            <span class="role">教</span>
            <span class="sk">${esc(ex.teachSkill)}</span>
          </div>
          <div class="sd-arrow">${ICONS.swap}<span class="lbl">${ex.durationHours}h</span></div>
          <div class="sd-side">
            <span class="avatar">${esc(learner.avatar)}</span>
            <span class="nm">${esc(learner.name)}</span>
            <span class="role">${ex.giveSkill ? '回教' : '付'}</span>
            <span class="sk">${ex.giveSkill ? esc(ex.giveSkill) : `${ex.durationHours} 学时`}</span>
          </div>
        </div>

        <dl class="meta-grid">
          <div class="meta-cell"><dt>约定时间</dt><dd>${esc(fmtDate(ex.proposedAt))}</dd></div>
          <div class="meta-cell"><dt>时长</dt><dd>${ex.durationHours} 小时</dd></div>
          <div class="meta-cell"><dt>结算</dt><dd>${ex.mode === 'swap' ? '各教一小时，学时不变' : `发起方支付 ${ex.durationHours} 学时`}</dd></div>
          <div class="meta-cell"><dt>发起时间</dt><dd>${esc(fmtDate(ex.createdAt))}</dd></div>
        </dl>

        ${statusNotice}

        ${
          requestNote
            ? `<div class="panel-title" style="margin-top:18px"><h2>发起留言</h2></div>
               <p style="font-size:13px;color:var(--ink-soft)">${esc(requestNote)}</p>`
            : ''
        }

        <div class="panel-title" style="margin-top:18px"><h2>进度</h2></div>
        ${timeline}

        ${actions.length ? `<div class="action-bar">${actions.join('')}</div>` : ''}

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-sm btn-ghost" href="/u/${esc(teacher.id)}" data-link>${esc(teacher.name)} 的档案</a>
          <a class="btn btn-sm btn-ghost" href="/u/${esc(learner.id)}" data-link>${esc(learner.name)} 的档案</a>
        </div>
      </section>`;
}

// 互评区域（没有内容时返回空字符串）
function reviewsSectionHtml(data) {
  const ex = data.exchange;
  const meId = state.me.user.id;
  const other = ex.role === 'requester' ? ex.partner : ex.requester;

  const reviewsHtml =
    data.reviews.length || ex.status === 'completed'
      ? `<div class="review-block">
          <div class="panel-title"><h2>互评</h2><span class="lab">${data.reviews.length} 条</span></div>
          ${
            ex.status === 'completed' && !ex.reviewed
              ? `<form class="review-form" id="review-form">
                  <div class="label">给 ${esc(other.name)} 打分<span class="hint" id="rating-value">未选择</span></div>
                  <div class="rating-input" id="rating-input" role="radiogroup" aria-label="给 ${esc(other.name)} 打分">
                    ${[1, 2, 3, 4, 5]
                      .map((n) => `<button type="button" role="radio" aria-checked="false" tabindex="${n === 1 ? '0' : '-1'}" data-star="${n}" aria-label="${n} 星">★</button>`)
                      .join('')}
                  </div>
                  <label class="label" for="review-body">评价内容<span class="hint">选填</span></label>
                  <textarea class="textarea" id="review-body" maxlength="300" placeholder="哪里讲得好，哪里可以更细" style="min-height:70px"></textarea>
                  <button class="btn btn-primary btn-sm" type="submit" style="align-self:flex-start">提交评价</button>
                </form>`
              : ''
          }
          ${data.reviews
            .map((r) => {
              const author = r.authorId === meId ? state.me.user : other;
              const target = r.authorId === meId ? other : state.me.user;
              return `<div class="review-item">
                <div class="review-head">
                  <span class="avatar sm">${esc(author.avatar)}</span>
                  <b>${esc(author.name)}</b>
                  <span>评价了 ${esc(target.name)}</span>
                  ${starRow(r.rating)}
                  <time>${esc(relTime(r.createdAt))}</time>
                </div>
                ${r.body ? `<p class="review-body">${esc(r.body)}</p>` : ''}
              </div>`;
            })
            .join('')}
          ${!data.reviews.length && !(ex.status === 'completed' && !ex.reviewed) ? `<p class="faint" style="font-size:12px">还没有评价。</p>` : ''}
        </div>`
      : '';

  return reviewsHtml ? `<section class="panel detail-reviews">${reviewsHtml}</section>` : '';
}

// 聊天底部：进行中显示输入框，交换结束后显示只读提示。两者共用相同 id，便于就地切换
function chatComposeHtml() {
  return `<form class="chat-compose" id="chat-form">
                <input class="input" id="chat-input" placeholder="写下你想说的" maxlength="500" autocomplete="off" aria-label="消息内容" />
                <button class="btn btn-primary" type="submit">发送</button>
              </form>`;
}

function chatClosedHtml() {
  return `<div class="chat-closed">交换已结束，消息保留</div>`;
}

// 整页详情标记；交互后走 applyExchangeDetail() 只替换局部，不重新渲染整页
function exchangeDetailPageHtml(data, id) {
  const ex = data.exchange;
  const p = data.permissions;
  const meId = state.me.user.id;
  const other = ex.role === 'requester' ? ex.partner : ex.requester;
  const msgs = data.messages
    .map((m) => chatBubbleHtml(m, { mine: m.senderId === meId, sender: m.senderId === meId ? state.me.user : other }))
    .join('');

  return `<main class="page"><div class="shell">
    <nav class="breadcrumb"><a href="/exchanges" data-link>${ICONS.back}交换</a></nav>
    <div class="detail-grid">
      ${detailMainHtml(data, id)}

      <aside class="panel chat-panel">
        <div class="chat-head">
          <span class="avatar sm">${esc(other.avatar)}</span>
          <div class="chat-title">与 ${esc(other.name)} 的消息</div>
          <span class="lab">仅双方可见</span>
        </div>
        <div class="chat-scroll" id="chat-scroll">
          ${msgs || `<p class="faint" style="padding:20px 4px;font-size:12.5px">还没有消息。先说你想学什么。</p>`}
        </div>
        ${p.canChat ? chatComposeHtml() : chatClosedHtml()}
      </aside>

      ${reviewsSectionHtml(data)}
    </div>
  </div></main>`;
}

// 就地更新详情页：只替换左栏、互评区和聊天底部；不重渲染、不出骨架屏、不跳滚动
async function applyExchangeDetail(data, id) {
  const route = currentRoute();
  const main = $('.detail-main');
  if (route.name !== 'exchangeDetail' || route.params.id !== id || !main) return false;

  const scrollY = window.scrollY;
  const p = data.permissions;

  main.outerHTML = detailMainHtml(data, id);

  const reviewsHtml = reviewsSectionHtml(data);
  const reviews = $('.detail-reviews');
  if (reviewsHtml) {
    if (reviews) reviews.outerHTML = reviewsHtml;
    else $('.detail-grid')?.insertAdjacentHTML('beforeend', reviewsHtml);
  } else if (reviews) {
    reviews.remove();
  }

  // 结束后不能再发消息：输入框换成只读提示；若仍可聊天则恢复输入框（id 不变）
  if (!p.canChat) {
    const chatForm = $('#chat-form');
    if (chatForm) chatForm.outerHTML = chatClosedHtml();
  } else if (!document.getElementById('chat-form')) {
    const closed = document.querySelector('.chat-panel .chat-closed');
    if (closed) {
      closed.outerHTML = chatComposeHtml();
      bindChatForm(id);
    }
  }

  bindExchangeActions(id);
  bindReviewForm(id, data);
  window.scrollTo({ top: scrollY });
  tour?.refresh?.();
  return true;
}

function bindChatForm(id) {
  const chatForm = $('#chat-form');
  if (!chatForm) return;
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const send = chatForm.querySelector('button[type="submit"]');
    const body = input.value.trim();
    if (!body) return;
    send.disabled = true;
    send.setAttribute('aria-busy', 'true');
    try {
      const res = await api(`/api/exchanges/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { body } });
      if (res?.message) {
        // 就地追加：不重渲染，保住滚动位置、焦点和聊天表单节点
        const scroll = $('#chat-scroll');
        if (scroll) {
          scroll.querySelector('p.faint')?.remove();
          scroll.insertAdjacentHTML('beforeend', chatBubbleHtml(res.message, { mine: true }));
          scroll.scrollTop = scroll.scrollHeight;
        }
        input.value = '';
        input.focus();
        notifyTour('message-sent', { exchangeId: id });
        send.disabled = false;
        send.removeAttribute('aria-busy');
      } else {
        // 服务端没有回消息体时才退回整页刷新
        await render();
      }
    } catch (err) {
      toast(err.message, 'error');
      send.disabled = false;
      send.removeAttribute('aria-busy');
    }
  });
}

function bindExchangeActions(id) {
  for (const btn of document.querySelectorAll('.detail-main [data-action]')) {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const labels = { accept: '接受', decline: '婉拒', cancel: '取消', complete: '标记完成' };
      const statuses = { accept: 'accepted', decline: 'declined', cancel: 'cancelled', complete: 'completed' };
      if (action === 'cancel' || action === 'decline') {
        const ok = confirm(`确定要${labels[action]}这次交换吗？`);
        if (!ok) return;
      }
      if (action === 'complete') {
        const ok = confirm('确认已经完成这次交换？完成后不能撤回。');
        if (!ok) return;
      }
      btn.disabled = true;
      try {
        const data = await api(`/api/exchanges/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
        notifyTour('exchange-updated', { exchangeId: id, status: statuses[action] });
        await refreshMe();
        syncHeaderStats();
        await applyExchangeDetail(data, id);
        const done = { accept: '已接受，去和对方约时间吧', decline: '已婉拒这次请求', cancel: '交换已取消', complete: '交换完成，记得互评' };
        toast(done[action], 'success');
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  }
}

function bindReviewForm(id, data = null) {
  let rating = 0;
  const ratingGroup = $('#rating-input');
  const ratingValue = $('#rating-value');
  const ratingBtns = [...document.querySelectorAll('[data-star]')];
  const paint = (value) => ratingBtns.forEach((x, i) => x.classList.toggle('on', i < value));
  const setRating = (value, { focus = false } = {}) => {
    rating = value;
    ratingBtns.forEach((x, i) => {
      x.setAttribute('aria-checked', String(i + 1 === value));
      x.tabIndex = i + 1 === value || (value === 0 && i === 0) ? 0 : -1;
    });
    paint(value);
    if (ratingValue) ratingValue.textContent = value ? `已选 ${value} 星` : '未选择';
    if (focus) ratingBtns[value - 1]?.focus();
  };
  ratingBtns.forEach((b, i) => {
    b.addEventListener('click', () => setRating(i + 1));
    b.addEventListener('mouseenter', () => paint(i + 1));
  });
  ratingGroup?.addEventListener('mouseleave', () => paint(rating));
  ratingGroup?.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, rating + keys[e.key]));
    setRating(next, { focus: true });
  });

  const reviewForm = $('#review-form');
  if (!reviewForm) return;
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!rating) {
      toast('请先选择星级', 'error');
      return;
    }
    try {
      await api(`/api/exchanges/${encodeURIComponent(id)}/reviews`, {
        method: 'POST',
        body: { rating, body: $('#review-body').value },
      });
      notifyTour('review-submitted', { exchangeId: id });
      const data = await api(`/api/exchanges/${encodeURIComponent(id)}`);
      await refreshMe();
      syncHeaderStats();
      await applyExchangeDetail(data, id);
      toast('评价已提交', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

VIEW_AFTER.exchangeDetail = ({ id }) => {
  const scroll = $('#chat-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  bindChatForm(id);
  bindExchangeActions(id);
  bindReviewForm(id);
};

/* ------------------------------------------------------------------ */
/* 视图：我的资料                                                       */
/* ------------------------------------------------------------------ */

VIEWS.profile = async () => {
  document.title = '我的档案｜SkillLoop 换技';
  const epoch = state.identityEpoch;
  const [meData, ledger] = await Promise.all([api('/api/me'), api('/api/ledger')]);
  if (epoch === state.identityEpoch) state.me = meData;
  const { user, teach, learn, stats } = meData;
  const categories = ['音乐', '编程', '设计', '语言', '摄影', '手作', '其他'];

  const ledgerRows = ledger.entries
    .map(
      (e) => `<div class="passbook-row">
        <div class="k">
          <b>${e.exchangeId ? `<a href="/exchanges/${esc(e.exchangeId)}" data-link>${esc(e.title)}</a>` : esc(e.title)}</b>
          ${e.detail ? `<span>${esc(e.detail)}</span>` : ''}
        </div>
        <span class="amt ${e.delta >= 0 ? 'pos' : 'neg'}">${e.delta >= 0 ? '+' : ''}${e.delta}</span>
        <span class="date">${esc(fmtDate(e.createdAt, false))}</span>
      </div>`
    )
    .join('');

  return `<main class="page"><div class="shell">
    <div class="page-head">
      <h1 class="page-title">我的档案</h1>
      <a class="btn btn-ghost btn-sm" href="/u/${esc(user.id)}" data-link>看成员档案 ${ICONS.arrow}</a>
    </div>

    <div class="profile-grid">
      <section class="profile-card">
        <div class="profile-id">
          <span class="avatar xl">${esc(user.avatar)}</span>
          <div style="flex:1;min-width:0">
            <h2 class="profile-name">${esc(user.name)}</h2>
            <p class="profile-headline">${esc(user.headline || '还没写一句话介绍')}</p>
          </div>
        </div>
        <p class="profile-bio">${esc(user.bio || '写点自我介绍，让别人知道你为什么想换技能。')}</p>
        <div class="profile-meta">
          <div class="item"><span>城市</span><b>${user.city ? esc(user.city) : '未填写'}</b></div>
          <div class="item"><span>邮箱</span><b>${esc(user.email)}</b></div>
          <div class="item"><span>评分</span><b>${stats.reviewCount ? `${stats.rating.toFixed(1)} 分` : '暂无'}</b></div>
          <div class="item"><span>评价数</span><b>${stats.reviewCount} 份</b></div>
        </div>
        <div class="profile-stats">
          <div><div class="v">${stats.balance}</div><div class="k">学时余额</div></div>
          <div><div class="v">${stats.teachingHours}</div><div class="k">已教出小时</div></div>
          <div><div class="v">${stats.learningHours}</div><div class="k">已学到小时</div></div>
        </div>

        <hr class="rule" style="margin:18px 0 16px" />
        <div class="panel-title"><h2>编辑档案</h2></div>
        <form id="profile-form">
          <div class="field-row">
            <div class="field"><label class="label" for="pf-name">昵称</label><input class="input" id="pf-name" name="name" value="${esc(user.name)}" maxlength="24" /></div>
            <div class="field"><label class="label" for="pf-avatar">头像字符</label><input class="input" id="pf-avatar" name="avatar" value="${esc(user.avatar)}" maxlength="8" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label class="label" for="pf-city">城市</label><input class="input" id="pf-city" name="city" value="${esc(user.city)}" maxlength="20" placeholder="上海" /></div>
            <div class="field"><label class="label" for="pf-headline">一句话介绍</label><input class="input" id="pf-headline" name="headline" value="${esc(user.headline)}" maxlength="40" placeholder="白天写代码，晚上弹琴" /></div>
          </div>
          <div class="field"><label class="label" for="pf-bio">简介<span class="hint">300 字以内</span></label><textarea class="textarea" id="pf-bio" name="bio" maxlength="300">${esc(user.bio)}</textarea></div>
          <button class="btn btn-primary" type="submit">保存资料</button>
        </form>
      </section>

      <div>
        <section class="passbook" id="ledger">
          <div class="passbook-head">
            <div class="passbook-title">学时存折</div>
            <div class="passbook-balance"><b>${ledger.balance}</b><span>学时可用</span></div>
          </div>
          ${ledgerRows || '<p class="faint" style="padding:16px 18px;font-size:12.5px">还没有记录。</p>'}
          <div class="passbook-foot">
            <span>注册时 3 学时，互换不流动</span>
            <span>${ledger.entries.length} 笔记录</span>
          </div>
        </section>

        <section class="skill-block" style="margin-top:14px">
          <div class="skill-block-head">
            <h2 class="skill-block-title"><span class="stamp stamp-forest">能教</span>我能教</h2>
            <span class="lab">${teach.length} / 8</span>
          </div>
          ${teach
            .map(
              (t) => `<div class="skill-item">
                <div class="skill-item-main">
                  <div class="skill-item-title">${esc(t.skill)}<span class="stamp stamp-faint">${esc(t.category)}</span><span class="stamp stamp-faint">${esc(t.level)}</span><span class="stamp stamp-faint">${esc(FORMAT_LABEL[t.format] || '线上')}</span></div>
                  ${t.blurb ? `<p class="skill-item-desc">${esc(t.blurb)}</p>` : ''}
                </div>
                <button class="icon-btn" data-del-teach="${esc(t.id)}" aria-label="删除 ${esc(t.skill)}">${ICONS.trash}</button>
              </div>`
            )
            .join('') || '<p class="faint" style="font-size:12.5px;padding:4px 0">还没有发布技能。乐器、编程、做饭、修图，都可以教。</p>'}
          ${
            teach.length < 8
              ? `<form class="add-form" id="teach-form">
                  <div class="field-row">
                    <div class="field"><label class="label" for="t-skill">技能名称</label><input class="input" id="t-skill" name="skill" maxlength="24" placeholder="例如：吉他" required /></div>
                    <div class="field"><label class="label" for="t-cat">分类</label><select class="select" id="t-cat" name="category">${categories.map((c) => `<option>${c}</option>`).join('')}</select></div>
                  </div>
                  <div class="field-row">
                    <div class="field"><label class="label" for="t-level">最高水平</label><select class="select" id="t-level" name="level"><option>入门</option><option>进阶</option><option>精通</option></select></div>
                    <div class="field"><label class="label" for="t-format">授课形式</label><select class="select" id="t-format" name="format"><option value="both">线上线下均可</option><option value="online">线上</option><option value="offline">线下</option></select></div>
                  </div>
                  <div class="field"><label class="label" for="t-blurb">怎么教</label><input class="input" id="t-blurb" name="blurb" maxlength="160" placeholder="从零基础到能弹唱一首歌" /></div>
                  <button class="btn btn-sm btn-primary" type="submit">${ICONS.plus}发布技能</button>
                </form>`
              : ''
          }
        </section>

        <section class="skill-block">
          <div class="skill-block-head">
            <h2 class="skill-block-title"><span class="stamp stamp-clay">想学</span>我想学</h2>
            <span class="lab">${learn.length} / 8</span>
          </div>
          ${learn
            .map(
              (l) => `<div class="skill-item">
                <div class="skill-item-main">
                  <div class="skill-item-title">${esc(l.skill)}<span class="stamp stamp-faint">${esc(l.category)}</span></div>
                  ${l.note ? `<p class="skill-item-desc">${esc(l.note)}</p>` : ''}
                </div>
                <button class="icon-btn" data-del-learn="${esc(l.id)}" aria-label="删除 ${esc(l.skill)}">${ICONS.trash}</button>
              </div>`
            )
            .join('') || '<p class="faint" style="font-size:12.5px;padding:4px 0">写下想学的技能，系统才能帮你找人。</p>'}
          ${
            learn.length < 8
              ? `<form class="add-form" id="learn-form">
                  <div class="field-row">
                    <div class="field"><label class="label" for="l-skill">想学的技能</label><input class="input" id="l-skill" name="skill" maxlength="24" placeholder="例如：英语口语" required /></div>
                    <div class="field"><label class="label" for="l-cat">分类</label><select class="select" id="l-cat" name="category">${categories.map((c) => `<option>${c}</option>`).join('')}</select></div>
                  </div>
                  <div class="field"><label class="label" for="l-note">为什么想学</label><input class="input" id="l-note" name="note" maxlength="120" placeholder="能聊完 20 分钟不卡壳" /></div>
                  <button class="btn btn-sm btn-primary" type="submit">${ICONS.plus}加入想学</button>
                </form>`
              : ''
          }
        </section>
      </div>
    </div>
  </div></main>`;
};

VIEW_AFTER.profile = () => {
  const form = $('#profile-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api('/api/me', { method: 'PATCH', body: Object.fromEntries(fd.entries()) });
      await refreshMe();
      toast('资料已保存', 'success');
      await render();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#teach-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api('/api/me/teach', {
        method: 'POST',
        body: { skill: f.skill.value, category: f.category.value, level: f.level.value, format: f.format.value, blurb: f.blurb.value },
      });
      await refreshMe();
      toast('技能已发布', 'success');
      await render();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#learn-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api('/api/me/learn', { method: 'POST', body: { skill: f.skill.value, category: f.category.value, note: f.note.value } });
      await refreshMe();
      toast('已加入想学列表', 'success');
      await render();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  for (const b of document.querySelectorAll('[data-del-teach]')) {
    b.addEventListener('click', async () => {
      if (!confirm('删除这个技能？相关匹配会随之更新。')) return;
      try {
        await api(`/api/me/teach/${b.dataset.delTeach}`, { method: 'DELETE' });
        await refreshMe();
        await render();
        toast('已删除', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
  for (const b of document.querySelectorAll('[data-del-learn]')) {
    b.addEventListener('click', async () => {
      if (!confirm('删除这条想学的技能？相关匹配会随之更新。')) return;
      try {
        await api(`/api/me/learn/${b.dataset.delLearn}`, { method: 'DELETE' });
        await refreshMe();
        await render();
        toast('已删除', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  if (location.hash === '#ledger') $('#ledger')?.scrollIntoView({ behavior: 'smooth' });
};

/* ------------------------------------------------------------------ */
/* 视图：他人主页                                                       */
/* ------------------------------------------------------------------ */

VIEWS.publicProfile = async ({ id }) => {
  if (state.me && id === state.me.user.id) {
    navigate('/me', { replace: true });
    return '';
  }
  const data = await api(`/api/users/${encodeURIComponent(id)}`);
  const u = data.user;
  document.title = `${u.name}｜SkillLoop 换技`;
  const meData = state.me;
  const perfect =
    meData &&
    data.teach.some((t) => meData.learn.some((l) => l.skill.toLowerCase() === t.skill.toLowerCase())) &&
    data.learn.some((l) => meData.teach.some((t) => t.skill.toLowerCase() === l.skill.toLowerCase()));

  const bars = data.reviews.length
    ? `<div class="rating-summary">
        <div class="rating-big">
          <b>${data.stats.rating ? data.stats.rating.toFixed(1) : '—'}</b>
          <div class="stars">${Array.from({ length: 5 }, (_, i) => `<span class="${i < Math.round(data.stats.rating || 0) ? '' : 'off'}">★</span>`).join('')}</div>
          <span>${data.stats.reviewCount} 份评价</span>
        </div>
        <div class="bars">
          ${ratingBreakdown(data.reviews)
            .map(
              (row) => `<div class="bar-row"><b>${row.stars}</b><span class="track"><i style="width:${row.pct}%"></i></span><span class="num">${row.n}</span></div>`
            )
            .join('')}
        </div>
      </div>`
    : '';

  return `<main class="page"><div class="shell">
    <nav class="breadcrumb"><a href="/discover" data-link>${ICONS.back}名录</a></nav>
    <div class="profile-grid">
      <section class="profile-card">
        <div class="profile-id">
          <span class="avatar xl">${esc(u.avatar)}</span>
          <div>
            <h1 class="profile-name">${esc(u.name)}</h1>
            <p class="profile-headline">${esc(u.headline || '还没有写一句话介绍')}</p>
          </div>
        </div>
        <p class="profile-bio">${esc(u.bio || 'TA 还没有写自我介绍。')}</p>
        <div class="profile-meta">
          <div class="item"><span>城市</span><b>${u.city ? esc(u.city) : '未填写'}</b></div>
          <div class="item"><span>评分</span><b>${data.stats.reviewCount ? `${data.stats.rating.toFixed(1)} 分` : '暂无'}</b></div>
          <div class="item"><span>评价数</span><b>${data.stats.reviewCount} 份</b></div>
        </div>
        ${
          data.stats.teachingHours || data.stats.learningHours || data.stats.reviewCount
            ? `<div class="profile-stats">
                 <div><div class="v">${data.stats.teachingHours}</div><div class="k">已教出小时</div></div>
                 <div><div class="v">${data.stats.learningHours}</div><div class="k">已学到小时</div></div>
                 <div><div class="v">${data.stats.reviewCount}</div><div class="k">份评价</div></div>
               </div>`
            : `<p class="faint" style="margin-top:12px;font-size:12px">还没有完成的交换。</p>`
        }
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          ${perfect ? '<span class="stamp stamp-acid">双向可换</span>' : ''}
          <button class="btn btn-primary btn-block" data-propose="${esc(u.id)}">发起交换 ${ICONS.arrow}</button>
        </div>
      </section>

      <div>
        <section class="skill-block">
          <div class="skill-block-head"><h2 class="skill-block-title"><span class="stamp stamp-forest">能教</span>TA 能教</h2><span class="lab">${data.teach.length} 项</span></div>
          ${
            data.teach
              .map(
                (t) => `<div class="skill-item">
                  <div class="skill-item-main">
                    <div class="skill-item-title">${esc(t.skill)}<span class="stamp stamp-faint">${esc(t.category)}</span><span class="stamp stamp-faint">${esc(t.level)}</span><span class="stamp stamp-faint">${esc(FORMAT_LABEL[t.format] || '线上')}</span></div>
                    ${t.blurb ? `<p class="skill-item-desc">${esc(t.blurb)}</p>` : ''}
                  </div>
                </div>`
              )
              .join('') || '<p class="faint" style="font-size:12.5px">还没有发布。</p>'
          }
        </section>

        <section class="skill-block">
          <div class="skill-block-head"><h2 class="skill-block-title"><span class="stamp stamp-clay">想学</span>TA 想学</h2><span class="lab">${data.learn.length} 项</span></div>
          ${
            data.learn
              .map(
                (l) => `<div class="skill-item">
                  <div class="skill-item-main">
                    <div class="skill-item-title">${esc(l.skill)}<span class="stamp stamp-faint">${esc(l.category)}</span></div>
                    ${l.note ? `<p class="skill-item-desc">${esc(l.note)}</p>` : ''}
                  </div>
                </div>`
              )
              .join('') || '<p class="faint" style="font-size:12.5px">还没有发布。</p>'
          }
        </section>

        <section class="skill-block">
          <div class="skill-block-head"><h2 class="skill-block-title">收到的评价</h2><span class="lab">${data.stats.reviewCount} 份</span></div>
          ${bars}
          ${data.reviews
            .map(
              (r) => `<div class="review-item">
                <div class="review-head"><span class="avatar sm">${esc(r.author.avatar)}</span><b>${esc(r.author.name)}</b>${starRow(r.rating)}<time>${esc(relTime(r.createdAt))}</time></div>
                ${r.body ? `<p class="review-body">${esc(r.body)}</p>` : ''}
              </div>`
            )
            .join('') || '<p class="faint" style="font-size:12.5px">还没有评价。</p>'}
        </section>
      </div>
    </div>
  </div></main>`;
};

VIEW_AFTER.publicProfile = () => bindProposeButtons();

/* ------------------------------------------------------------------ */
/* 视图：404                                                            */
/* ------------------------------------------------------------------ */

VIEWS.notfound = async () => {
  document.title = '页面不存在｜SkillLoop 换技';
  return `<main class="page"><div class="shell" style="padding-top:40px">
    ${emptyState('compass', '这个页面不存在', '地址可能打错了，或者链接已经过期。', `<a class="btn btn-primary" href="${isAuthed() ? '/discover' : '/'}" data-link>${isAuthed() ? '回到名录' : '回到首页'}</a>`)}
  </div></main>`;
};

/* ------------------------------------------------------------------ */
/* 发起互换对话框                                                       */
/* ------------------------------------------------------------------ */

async function openProposeDialog(personId) {
  if (!isAuthed()) {
    navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
    return;
  }
  let data;
  try {
    data = await api(`/api/users/${encodeURIComponent(personId)}`);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  const me = state.me;
  const person = data.user;
  const teacherSkills = data.teach;
  if (!teacherSkills.length) {
    toast(`${person.name} 还没有发布可教的技能`, 'error');
    return;
  }

  // 预选：我能教 TA 想学的 + TA 能教我想要的
  const myLearnNorm = new Set(me.learn.map((l) => l.skill.toLowerCase().trim()));
  const myTeachNorm = new Set(me.teach.map((t) => t.skill.toLowerCase().trim()));
  const preferredTeach = teacherSkills.find((t) => myLearnNorm.has(t.skill.toLowerCase().trim())) || teacherSkills[0];
  const preferredGive = me.teach.find((t) => data.learn.some((l) => l.skill.toLowerCase().trim() === t.skill.toLowerCase().trim()));

  const balance = me.stats.balance;
  // 默认「明天 20:00（北京时间）」
  const bjNow = new Date(Date.now() + 8 * 3600 * 1000);
  bjNow.setUTCDate(bjNow.getUTCDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  const dtLocal = `${bjNow.getUTCFullYear()}-${pad(bjNow.getUTCMonth() + 1)}-${pad(bjNow.getUTCDate())}T20:00`;

  const root = $('#dialog-root');
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <form method="dialog" id="propose-form">
      <div class="modal-head">
        <div>
          <h2 class="modal-title" id="propose-title">发起交换</h2>
          <div class="detail-stamps" style="margin-top:7px">
            <span class="stamp stamp-faint">对方</span>
            <span class="stamp">${esc(person.name)}</span>
            <span class="stamp">${esc(preferredTeach.skill)}</span>
          </div>
        </div>
        <button class="modal-close" value="cancel" formnovalidate aria-label="关闭">${ICONS.close}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="label" for="p-teach">想学 TA 的</label>
          <select class="select" id="p-teach" name="teachSkill" required>
            ${teacherSkills.map((t) => `<option value="${esc(t.skill)}" ${t.skill === preferredTeach.skill ? 'selected' : ''}>${esc(t.skill)}（${esc(t.level)}）</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label">我拿什么换<span class="hint">余额 ${balance} 学时</span></label>
          <div class="radio-cards">
            ${
              me.teach.length
                ? me.teach
                    .map(
                      (t) => `<label class="radio-card">
                        <input type="radio" name="give" value="${esc(t.skill)}" ${preferredGive && preferredGive.skill === t.skill ? 'checked' : ''} />
                        <div class="rc-title">回教「${esc(t.skill)}」</div>
                        <div class="rc-desc">双方各教一小时，学时不变</div>
                      </label>`
                    )
                    .join('')
                : ''
            }
            <label class="radio-card">
              <input type="radio" name="give" value="" ${!preferredGive ? 'checked' : ''} />
              <div class="rc-title">用学时</div>
              <div class="rc-desc">从余额中支付，不用回教技能</div>
            </label>
          </div>
          ${!me.teach.length ? `<p class="faint" style="font-size:12px;margin-top:6px">你还没有发布技能，只能用学时。<a href="/me" data-link style="text-decoration:underline">去发布</a></p>` : ''}
        </div>
        <div class="field-row">
          <div class="field">
            <label class="label" for="p-duration">时长</label>
            <select class="select" id="p-duration" name="durationHours">
              <option value="1" selected>1 小时</option>
              <option value="2">2 小时</option>
            </select>
          </div>
          <div class="field">
            <label class="label" for="p-time">期望时间</label>
            <input class="input" id="p-time" name="proposedAt" type="datetime-local" value="${dtLocal}" />
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="label" for="p-message">留言<span class="hint">选填</span></label>
          <textarea class="textarea" id="p-message" name="message" maxlength="500" placeholder="说说你想学什么、方便的时间">想跟你学${esc(preferredTeach.skill)}。${preferredGive ? `我可以回教「${esc(preferredGive.skill)}」。` : '我用学时可不可以？'}</textarea>
        </div>
        <div class="form-error" id="p-error" role="alert" style="margin-top:8px"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" value="cancel" formnovalidate>取消</button>
        <button class="btn btn-primary" type="submit" value="submit" id="p-submit">发送请求</button>
      </div>
    </form>`;

  dlg.innerHTML = scopeHtml(dlg.innerHTML);
  root.appendChild(dlg);
  let proposalSubmitted = false;
  dlg.addEventListener('close', () => {
    if (!proposalSubmitted) notifyTour('propose-closed', { submitted: false });
    dlg.remove();
    tour?.refresh?.();
  });
  dlg.setAttribute('aria-labelledby', 'propose-title');
  dlg.showModal();
  notifyTour('propose-opened');
  tour?.refresh?.();

  const form = dlg.querySelector('#propose-form');
  const duration = dlg.querySelector('#p-duration');
  const submit = dlg.querySelector('#p-submit');
  const errEl = dlg.querySelector('#p-error');

  const sync = () => {
    const give = form.querySelector('input[name="give"]:checked')?.value || '';
    const hours = Number(duration.value);
    if (!give && balance < hours) {
      submit.disabled = true;
      errEl.textContent = `学时不够：余额 ${balance} 学时，这次需要 ${hours} 学时。可以改用互教互换，或者先去教一节课。`;
    } else {
      submit.disabled = false;
      errEl.textContent = '';
    }
  };
  for (const input of form.querySelectorAll('input[name="give"]')) input.addEventListener('change', sync);
  duration.addEventListener('change', sync);
  sync();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancel') {
      dlg.close();
      return;
    }
    submit.disabled = true;
    errEl.textContent = '';
    try {
      const requester = state.me.user;
      const fd = new FormData(form);
      const proposedAt = localInputToISO(fd.get('proposedAt'));
      const res = await api('/api/exchanges', {
        method: 'POST',
        body: {
          partnerId: person.id,
          teachSkill: fd.get('teachSkill'),
          giveSkill: fd.get('give') || '',
          durationHours: Number(fd.get('durationHours')),
          proposedAt,
          message: fd.get('message') || '',
        },
      });
      proposalSubmitted = true;
      notifyTour('exchange-created', {
        exchangeId: res.exchange.id,
        partnerId: person.id,
        partnerName: person.name,
        requesterId: requester.id,
        requesterName: requester.name,
      });
      dlg.close();
      await refreshMe();
      toast('请求已发送，等对方回复', 'success');
      navigate(`/exchanges/${res.exchange.id}`);
    } catch (err) {
      errEl.textContent = err.message;
      submit.disabled = false;
    }
  });
}

function bindProposeButtons() {
  for (const btn of document.querySelectorAll('[data-propose]')) {
    btn.addEventListener('click', () => openProposeDialog(btn.dataset.propose));
  }
}

/* ------------------------------------------------------------------ */
/* 启动                                                                 */
/* ------------------------------------------------------------------ */

async function boot() {
  document.title = 'SkillLoop 换技';
  // 导览只在示例环境启用；其余环境 tour 保持 null，所有调用都是空操作
  tour = DEMO_MODE
    ? createTour({
        getContext: () => ({
          authed: isAuthed(),
          userId: state.me?.user?.id ?? null,
          userName: state.me?.user?.name ?? null,
          routeName: currentRoute().name,
          routePath: currentRoute().path,
        }),
        navigate: (p) => navigate(p),
        // 导览的兜底动作：自动打开第一张名片上的「发起交换」对话框
        openPropose: () => {
          if (!DEMO_MODE || !isAuthed()) return false;
          if (document.querySelector('dialog.modal[open]')) return false;
          const btn = document.querySelector('[data-propose]');
          if (!btn) return false;
          openProposeDialog(btn.dataset.propose);
          return true;
        },
        // 导览翻页前关闭已打开的对话框；不做任何导航
        closeDialogs: () => {
          for (const dlg of [...document.querySelectorAll('dialog.modal[open]')]) dlg.close();
        },
      })
    : null;
  // Fragment links do not reliably move focus to <main>; the skip link must.
  document.querySelector('.skip-link')?.addEventListener('click', (e) => {
    const main = document.getElementById('main');
    if (!main) return;
    e.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
  try {
    await refreshMe();
  } catch (err) {
    console.error(err);
  }
  await render();
  tour?.start?.();
}

boot();
