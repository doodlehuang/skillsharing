// SkillLoop — 换技：时间信用制技能互换平台
// 单个 Cloudflare Worker：同源 API + 静态 SPA 资源 + D1。

const SESSION_TTL_DAYS = 30;
const MAX_TEACH = 8;
const MAX_LEARN = 8;
const MAX_EXCHANGES_OPEN = 30;
const CATEGORIES = ['音乐', '编程', '设计', '语言', '摄影', '手作', '其他'];
const LEVELS = ['入门', '进阶', '精通'];
const FORMATS = ['online', 'offline', 'both'];
const SIGNUP_BONUS = 3;

const enc = new TextEncoder();

/* ------------------------------------------------------------------ */
/* 基础工具                                                             */
/* ------------------------------------------------------------------ */

export const uid = (n = 12) =>
  crypto.randomUUID().replace(/-/g, '').slice(0, n);

const nowISO = () => new Date().toISOString();

// D1 batch() 返回 [{ results }]，统一取行数组
const r = (res) => (res && res.results) || [];

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function fail(code, message, status = 400) {
  return json({ error: code, message }, status);
}

class HttpError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

async function readBody(request) {
  const limit = 16 * 1024;
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new HttpError('UNSUPPORTED_MEDIA_TYPE', '请使用 JSON 请求', 415);
  const reader = request.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError('BODY_TOO_LARGE', '请求内容过长', 413); }
      chunks.push(value);
    }
  }
  let parsed;
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    parsed = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  } catch { throw new HttpError('INVALID_JSON', 'JSON 格式不正确'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError('INVALID_JSON', '请求必须是 JSON object');
  return parsed;
}

function str(value, max) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new HttpError('INVALID_INPUT', '字段类型不正确');
  if (value.length > max) throw new HttpError('INVALID_INPUT', '字段内容过长');
  return value.trim();
}

function normalizeSkill(value) {
  return str(value, 40).toLowerCase().replace(/\s+/g, '');
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function pbkdf2(password, salt, iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$100000$${toHex(salt)}$${toHex(hash)}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]) || 100000;
  const hash = await pbkdf2(password, fromHex(parts[2]), iterations);
  return crypto.subtle.timingSafeEqual(hash, fromHex(parts[3]));
}

function sessionToken(request, env) {
  const name = env.isDemo ? '__Host-sl_demo_session' : '__Host-sl_session';
  const value = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}

async function tokenDigest(token) { return toHex(await crypto.subtle.digest('SHA-256', enc.encode(token))); }
function sessionCookie(env, token, maxAge = SESSION_TTL_DAYS * 86400) {
  return `${env.isDemo ? '__Host-sl_demo_session' : '__Host-sl_session'}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}
async function getSessionUser(request, env) {
  const token = sessionToken(request, env); if (!token) return null;
  return env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.is_demo=?')
    .bind(await tokenDigest(token), nowISO(), Number(env.isDemo)).first();
}
async function revokeSession(request, env) {
  const token = sessionToken(request, env);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await tokenDigest(token)).run();
}
async function createSession(env, userId, request) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const created = new Date();
  const statements = [];
  const old = sessionToken(request, env);
  if (old) statements.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await tokenDigest(old)));
  statements.push(env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(created.toISOString()));
  statements.push(env.DB.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)')
    .bind(await tokenDigest(token), userId, created.toISOString(), new Date(created.getTime()+SESSION_TTL_DAYS*86400000).toISOString()));
  await env.DB.batch(statements); return token;
}

async function throttle(env, key, limit, seconds) {
  const now = Math.floor(Date.now()/1000); const window = Math.floor(now/seconds)*seconds;
  const digest = await tokenDigest(key);
  const result = await env.DB.prepare(`INSERT INTO auth_throttle(key,window_start,attempts) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END, window_start=excluded.window_start
    RETURNING attempts`).bind(digest,window).first();
  await env.DB.prepare('DELETE FROM auth_throttle WHERE window_start<?').bind(now-3600).run();
  if (result.attempts > limit) { const error=new HttpError('RATE_LIMITED', '请求过于频繁，请稍后再试', 429); error.retryAfter=window+seconds-now; throw error; }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    city: row.city,
    headline: row.headline,
    bio: row.bio,
    isDemo: !!row.is_demo,
    createdAt: row.created_at,
  };
}

function selfUser(row) {
  return { ...publicUser(row), email: row.email };
}

function slimUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, avatar: row.avatar };
}

function teachView(row) {
  return {
    id: row.id,
    skill: row.skill,
    category: row.category,
    level: row.level,
    blurb: row.blurb,
    format: row.format,
  };
}

function learnView(row) {
  return { id: row.id, skill: row.skill, category: row.category, note: row.note };
}

async function getStats(env, userId) {
  const [balanceRow, teaching, learning, reviews, pending, active] = await env.DB.batch([
    env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS v FROM ledger WHERE user_id = ?').bind(userId),
    env.DB.prepare(
      "SELECT COALESCE(SUM(duration_hours), 0) AS v FROM exchanges WHERE status = 'completed' AND partner_id = ?"
    ).bind(userId),
    env.DB.prepare(
      "SELECT COALESCE(SUM(duration_hours), 0) AS v FROM exchanges WHERE status = 'completed' AND requester_id = ?"
    ).bind(userId),
    env.DB.prepare('SELECT COUNT(*) AS c, AVG(rating) AS r FROM reviews WHERE target_id = ?').bind(userId),
    env.DB.prepare("SELECT COUNT(*) AS c FROM exchanges WHERE partner_id = ? AND status = 'pending'").bind(userId),
    env.DB.prepare(
      "SELECT COUNT(*) AS c FROM exchanges WHERE status = 'accepted' AND (requester_id = ? OR partner_id = ?)"
    ).bind(userId, userId),
  ]);

  const rv = r(reviews)[0] || { c: 0, r: null };
  return {
    balance: r(balanceRow)[0]?.v || 0,
    teachingHours: r(teaching)[0]?.v || 0,
    learningHours: r(learning)[0]?.v || 0,
    rating: rv.r ? Math.round(rv.r * 10) / 10 : null,
    reviewCount: rv.c || 0,
    pendingIncoming: r(pending)[0]?.c || 0,
    active: r(active)[0]?.c || 0,
  };
}

async function demoUserList(env) {
  const rows = await env.DB.prepare(
    'SELECT id, name, avatar, city, headline FROM users WHERE is_demo = 1 ORDER BY rowid'
  ).all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    city: r.city,
    headline: r.headline,
  }));
}

/* ------------------------------------------------------------------ */
/* 匹配                                                                 */
/* ------------------------------------------------------------------ */

function buildPeople(me, users, teaches, learns, ratings) {
  const myTeachNorm = new Set(me.teach.map((t) => normalizeSkill(t.skill)));
  const myLearnNorm = new Map(me.learn.map((l) => [normalizeSkill(l.skill), l.skill]));
  const myCategories = new Set([...me.teach, ...me.learn].map((s) => s.category).filter(Boolean));

  return users
    .filter((u) => u.id !== me.user.id)
    .map((u) => {
      const theirTeach = teaches.filter((t) => t.user_id === u.id).map(teachView);
      const theirLearn = learns.filter((l) => l.user_id === u.id).map(learnView);
      const ratingInfo = ratings[u.id] || { rating: null, count: 0 };

      const teachesWhatIWant = theirTeach
        .filter((t) => myLearnNorm.has(normalizeSkill(t.skill)))
        .map((t) => t.skill);
      const wantsWhatITeach = theirLearn
        .filter((l) => myTeachNorm.has(normalizeSkill(l.skill)))
        .map((l) => l.skill);

      let score = 0;
      let reason = '';
      if (teachesWhatIWant.length && wantsWhatITeach.length) {
        score += 55;
        reason = `TA 能教你${teachesWhatIWant[0]}，也想跟你学${wantsWhatITeach[0]}`;
      } else if (teachesWhatIWant.length) {
        score += 25;
        reason = `TA 能教你${teachesWhatIWant[0]}`;
      } else if (wantsWhatITeach.length) {
        score += 15;
        reason = `TA 想学${wantsWhatITeach[0]}`;
      }

      if (ratingInfo.rating) score += Math.min(ratingInfo.rating * 2, 10);

      const shared = new Set(
        [...theirTeach, ...theirLearn].map((s) => s.category).filter((c) => myCategories.has(c))
      );
      score += Math.min(shared.size * 3, 9);

      if (u.bio) score += 2;
      if (u.headline) score += 1;

      return {
        ...publicUser(u),
        teach: theirTeach,
        learn: theirLearn,
        rating: ratingInfo.rating,
        reviewCount: ratingInfo.count,
        mutual: { teachesWhatIWant, wantsWhatITeach },
        score: Math.min(Math.round(score), 100),
        reason,
      };
    });
}

async function loadPeopleData(env, me) {
  const [usersRes, teachRes, learnRes, ratingRes] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM users WHERE is_demo = ? ORDER BY created_at LIMIT 200').bind(Number(env.isDemo)),
    env.DB.prepare('SELECT * FROM teach_skills ORDER BY created_at'),
    env.DB.prepare('SELECT * FROM learn_wants ORDER BY created_at'),
    env.DB.prepare('SELECT target_id, COUNT(*) AS c, AVG(rating) AS r FROM reviews GROUP BY target_id'),
  ]);
  const ratings = {};
  for (const row of r(ratingRes)) {
    ratings[row.target_id] = { rating: Math.round(row.r * 10) / 10, count: row.c };
  }
  return buildPeople(me, r(usersRes), r(teachRes), r(learnRes), ratings);
}

async function loadMe(env, userRow) {
  const [teachRes, learnRes] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM teach_skills WHERE user_id = ? ORDER BY created_at').bind(userRow.id),
    env.DB.prepare('SELECT * FROM learn_wants WHERE user_id = ? ORDER BY created_at').bind(userRow.id),
  ]);
  return {
    user: userRow,
    teach: r(teachRes).map(teachView),
    learn: r(learnRes).map(learnView),
  };
}

/* ------------------------------------------------------------------ */
/* 交换序列化                                                           */
/* ------------------------------------------------------------------ */

const OPEN_STATUSES = ['pending', 'accepted'];

function exchangeView(row, userMap, myReviews, meId) {
  const role = row.requester_id === meId ? 'requester' : 'partner';
  const myReviewed = role === 'requester' ? !!row.requester_reviewed : !!row.partner_reviewed;
  const theirReviewed = role === 'requester' ? !!row.partner_reviewed : !!row.requester_reviewed;
  const myReview = myReviews.get(row.id) || null;
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    teachSkill: row.teach_skill,
    giveSkill: row.give_skill,
    durationHours: row.duration_hours,
    proposedAt: row.proposed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requester: slimUser(userMap[row.requester_id]),
    partner: slimUser(userMap[row.partner_id]),
    role,
    reviewed: myReviewed,
    theirReviewed,
    myReview: myReview ? { rating: myReview.rating, body: myReview.body } : null,
    canReview: row.status === 'completed' && !myReviewed,
  };
}

async function loadExchangeContext(env, meId, rows) {
  const ids = new Set();
  for (const r of rows) {
    ids.add(r.requester_id);
    ids.add(r.partner_id);
  }
  const userMap = {};
  const myReviews = new Map();
  if (ids.size) {
    const placeholders = [...ids].map(() => '?').join(',');
    const [usersRes, reviewRes] = await env.DB.batch([
      env.DB.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).bind(...ids),
      env.DB.prepare('SELECT * FROM reviews WHERE author_id = ?').bind(meId),
    ]);
    for (const u of r(usersRes)) userMap[u.id] = u;
    for (const rv of r(reviewRes)) myReviews.set(rv.exchange_id, rv);
  }
  return { userMap, myReviews };
}

/* ------------------------------------------------------------------ */
/* 处理器                                                               */
/* ------------------------------------------------------------------ */

async function handleRegister(request, env) {
  const body = env.body;
  const email = str(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const name = str(body.name, 24) || email.split('@')[0].slice(0, 24);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('INVALID_EMAIL', '请输入有效的邮箱地址');
  if (password.length < 15 || password.length > 128) return fail('WEAK_PASSWORD', '密码需要 15–128 个字符');
  if (!name) return fail('INVALID_NAME', '请填写昵称');

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) return fail('EMAIL_TAKEN', '这个邮箱已经注册过，直接登录吧', 409);

  const id = uid();
  const ts = nowISO();
  const passwordHash = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, avatar, city, headline, bio, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
    ).bind(id, email, passwordHash, name, '🌱', '', '', '', ts),
    env.DB.prepare(
      "INSERT INTO ledger (id, user_id, exchange_id, delta, reason, created_at) VALUES (?, ?, NULL, ?, 'bonus', ?)"
    ).bind(uid(), id, SIGNUP_BONUS, ts),
  ]);

  const token = await createSession(env, id, request);
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json(
    { user: selfUser(row), bonus: SIGNUP_BONUS },
    200,
    { 'set-cookie': sessionCookie(env, token) }
  );
}

async function handleLogin(request, env) {
  const body = env.body;
  const email = str(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  await throttle(env, 'login:email:' + email, 10, 600);
  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').bind(email).first();
  if (!(await verifyPassword(password, row?.password_hash || 'pbkdf2$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000')) || !row) {
    return fail('BAD_CREDENTIALS', '邮箱或密码不正确', 401);
  }
  const token = await createSession(env, row.id, request);
  return json({ user: selfUser(row) }, 200, { 'set-cookie': sessionCookie(env, token) });
}

async function handleDemoLogin(request, env) {
  const body = env.body;
  let row = null;
  if (body.userId) {
    row = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND is_demo = 1').bind(str(body.userId, 40)).first();
  }
  if (body.userId && !row) return fail('NOT_FOUND', '没有这个示例身份', 404);
  if (!row) row = await env.DB.prepare('SELECT * FROM users WHERE is_demo = 1 ORDER BY rowid LIMIT 1').first();
  if (!row) return fail('NOT_SEEDED', '演示数据还没有准备好', 503);
  const token = await createSession(env, row.id, request);
  return json({ user: selfUser(row) }, 200, { 'set-cookie': sessionCookie(env, token) });
}

async function handleDemoSwitch(request, env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  if (!me.is_demo) return fail('FORBIDDEN', '只有演示身份可以切换', 403);
  const body = env.body;
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND is_demo = 1')
    .bind(str(body.userId, 40))
    .first();
  if (!row) return fail('NOT_FOUND', '没有这个演示账号', 404);
  const token = await createSession(env, row.id, request);
  return json({ user: selfUser(row) }, 200, { 'set-cookie': sessionCookie(env, token) });
}

async function handleLogout(request, env) {
  await revokeSession(request, env);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(env, '', 0) });
}

async function handleMe(env, request, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const meData = await loadMe(env, me);
  const stats = await getStats(env, me.id);
  const demoUsers = me.is_demo ? await demoUserList(env) : [];
  return json({
    user: selfUser(me),
    teach: meData.teach,
    learn: meData.learn,
    stats,
    demoUsers,
  });
}

async function handleUpdateProfile(request, env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const body = env.body;
  const fields = [];
  const values = [];
  const mapping = [
    ['name', 24],
    ['avatar', 8],
    ['city', 20],
    ['headline', 40],
    ['bio', 300],
  ];
  for (const [key, max] of mapping) {
    if (key in body) {
      const value = str(body[key], max);
      if (key === 'name' && !value) return fail('INVALID_NAME', '昵称不能为空');
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (!fields.length) return json({ user: selfUser(me) });
  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, me.id)
    .run();
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first();
  return json({ user: selfUser(row) });
}

async function handleAddTeach(request, env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const body = env.body;
  const skill = str(body.skill, 24);
  if (!skill) return fail('INVALID_SKILL', '请填写技能名称');
  const category = CATEGORIES.includes(body.category) ? body.category : '其他';
  const level = LEVELS.includes(body.level) ? body.level : '入门';
  const format = FORMATS.includes(body.format) ? body.format : 'both';
  const blurb = str(body.blurb, 160);

  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM teach_skills WHERE user_id = ?').bind(me.id).first();
  if (count.c >= MAX_TEACH) return fail('LIMIT_REACHED', `最多发布 ${MAX_TEACH} 个技能`, 409);

  const all = await env.DB.prepare('SELECT skill FROM teach_skills WHERE user_id = ?').bind(me.id).all();
  if (all.results.some((r) => normalizeSkill(r.skill) === normalizeSkill(skill))) {
    return fail('DUPLICATE_SKILL', '这个技能已经发布过了', 409);
  }

  const id = uid();
  await env.DB.prepare(
    'INSERT INTO teach_skills (id, user_id, skill, category, level, blurb, format, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, me.id, skill, category, level, blurb, format, nowISO())
    .run();
  return json({ teach: { id, skill, category, level, blurb, format } });
}

async function handleDeleteTeach(env, me, skillId) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const row = await env.DB.prepare('SELECT id FROM teach_skills WHERE id = ? AND user_id = ?')
    .bind(skillId, me.id)
    .first();
  if (!row) return fail('NOT_FOUND', '找不到这个技能', 404);
  await env.DB.prepare('DELETE FROM teach_skills WHERE id = ?').bind(skillId).run();
  return json({ ok: true });
}

async function handleAddLearn(request, env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const body = env.body;
  const skill = str(body.skill, 24);
  if (!skill) return fail('INVALID_SKILL', '请填写想学的技能');
  const category = CATEGORIES.includes(body.category) ? body.category : '其他';
  const note = str(body.note, 120);

  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM learn_wants WHERE user_id = ?').bind(me.id).first();
  if (count.c >= MAX_LEARN) return fail('LIMIT_REACHED', `最多发布 ${MAX_LEARN} 个想学的技能`, 409);

  const all = await env.DB.prepare('SELECT skill FROM learn_wants WHERE user_id = ?').bind(me.id).all();
  if (all.results.some((r) => normalizeSkill(r.skill) === normalizeSkill(skill))) {
    return fail('DUPLICATE_SKILL', '这个技能已经在想学列表里了', 409);
  }

  const id = uid();
  await env.DB.prepare(
    'INSERT INTO learn_wants (id, user_id, skill, category, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, me.id, skill, category, note, nowISO())
    .run();
  return json({ learn: { id, skill, category, note } });
}

async function handleDeleteLearn(env, me, skillId) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const row = await env.DB.prepare('SELECT id FROM learn_wants WHERE id = ? AND user_id = ?')
    .bind(skillId, me.id)
    .first();
  if (!row) return fail('NOT_FOUND', '找不到这个技能', 404);
  await env.DB.prepare('DELETE FROM learn_wants WHERE id = ?').bind(skillId).run();
  return json({ ok: true });
}

async function handleDiscover(env, url, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const q = str(url.searchParams.get('q') || '', 40).toLowerCase();
  const category = url.searchParams.get('category') || '';

  const meData = await loadMe(env, me);
  let people = await loadPeopleData(env, meData);

  if (category && category !== '全部') {
    people = people.filter((p) => [...p.teach, ...p.learn].some((s) => s.category === category));
  }
  if (q) {
    people = people.filter((p) => {
      const hay = [p.name, p.headline, p.city, ...p.teach.map((t) => t.skill), ...p.learn.map((l) => l.skill)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  people.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hans-CN'));

  const [userCount, skillCount, exCount, hoursSum] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE is_demo=?').bind(Number(env.isDemo)),
    env.DB.prepare('SELECT COUNT(DISTINCT LOWER(t.skill)) AS c FROM teach_skills t JOIN users u ON u.id=t.user_id WHERE u.is_demo=?').bind(Number(env.isDemo)),
    env.DB.prepare('SELECT COUNT(*) AS c FROM exchanges e JOIN users u ON u.id=e.requester_id WHERE u.is_demo=?').bind(Number(env.isDemo)),
    env.DB.prepare("SELECT COALESCE(SUM(e.duration_hours),0) AS c FROM exchanges e JOIN users u ON u.id=e.requester_id WHERE e.status='completed' AND u.is_demo=?").bind(Number(env.isDemo)),
  ]);

  return json({
    people,
    categories: CATEGORIES,
    stats: {
      users: r(userCount)[0]?.c || 0,
      skills: r(skillCount)[0]?.c || 0,
      exchanges: r(exCount)[0]?.c || 0,
      hours: r(hoursSum)[0]?.c || 0,
    },
  });
}

async function handleMatches(env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const meData = await loadMe(env, me);
  const people = await loadPeopleData(env, meData);
  const isPerfect = (p) => p.mutual.teachesWhatIWant.length > 0 && p.mutual.wantsWhatITeach.length > 0;
  return json({
    perfect: people.filter(isPerfect).sort((a, b) => b.score - a.score),
    half: people.filter((p) => !isPerfect(p) && p.reason).sort((a, b) => b.score - a.score),
  });
}

async function balanceOf(env, userId) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS v FROM ledger WHERE user_id = ?')
    .bind(userId)
    .first();
  return row?.v || 0;
}

async function handleCreateExchange(request, env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const body = env.body;
  const partnerId = str(body.partnerId, 40);
  if (!partnerId) return fail('INVALID_PARTNER', '缺少对方账号');
  if (partnerId === me.id) return fail('SELF_EXCHANGE', '不能和自己交换');

  const partner = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(partnerId).first();
  if (partner && !!partner.is_demo !== env.isDemo) return fail('NOT_FOUND', '找不到这位成员', 404);
  if (!partner) return fail('NOT_FOUND', '找不到这位成员', 404);

  const teachSkillInput = str(body.teachSkill, 24);
  const partnerTeach = await env.DB.prepare('SELECT * FROM teach_skills WHERE user_id = ?').bind(partnerId).all();
  const matchedTeach = (partnerTeach.results || []).find(
    (t) => normalizeSkill(t.skill) === normalizeSkill(teachSkillInput)
  );
  if (!matchedTeach) return fail('INVALID_SKILL', 'TA 还没有发布这个技能', 400);

  const giveSkillInput = str(body.giveSkill, 24);
  let giveSkill = '';
  if (giveSkillInput) {
    const myTeach = await env.DB.prepare('SELECT skill FROM teach_skills WHERE user_id = ?').bind(me.id).all();
    const mine = (myTeach.results || []).find((t) => normalizeSkill(t.skill) === normalizeSkill(giveSkillInput));
    if (!mine) return fail('INVALID_SKILL', '你还没有发布这个技能，无法用它交换', 400);
    giveSkill = mine.skill;
  }

  const durationHours = body.durationHours;
  if (![1,2].includes(durationHours)) return fail('INVALID_DURATION', '时长只能为 1 或 2 小时');

  let proposedAt = nowISO();
  if (body.proposedAt) {
    const date = new Date(String(body.proposedAt));
    if (Number.isNaN(date.getTime())) return fail('INVALID_TIME', '时间格式不正确');
    proposedAt = date.toISOString();
  }

  const message = str(body.message, 500);
  const mode = giveSkill ? 'swap' : 'credit';

  if (mode === 'credit') {
    const balance = await balanceOf(env, me.id);
    if (balance < durationHours) {
      return fail('INSUFFICIENT_CREDITS', `学时不足：你还有 ${balance} 学时，这次需要 ${durationHours} 学时`, 409);
    }
  }

  const id = uid();
  const ts = nowISO();
  const statements = [
    env.DB.prepare(
      `INSERT INTO exchanges
        (id, requester_id, partner_id, teach_skill, give_skill, mode, message, duration_hours, proposed_at, status,
         requester_reviewed, partner_reviewed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, ?)`
    ).bind(id, me.id, partnerId, matchedTeach.skill, giveSkill, mode, message, durationHours, proposedAt, ts, ts),
  ];
  if (message) {
    statements.push(
      env.DB.prepare('INSERT INTO messages (id, exchange_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(
        uid(),
        id,
        me.id,
        message,
        ts
      )
    );
  }
  await env.DB.batch(statements);

  const row = await env.DB.prepare('SELECT * FROM exchanges WHERE id = ?').bind(id).first();
  const ctx = await loadExchangeContext(env, me.id, [row]);
  return json({ exchange: exchangeView(row, ctx.userMap, ctx.myReviews, me.id) });
}

async function handleListExchanges(env, url, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const filter = url.searchParams.get('filter') || 'all';
  const rows = await env.DB.prepare(
    'SELECT * FROM exchanges WHERE requester_id = ? OR partner_id = ? ORDER BY updated_at DESC LIMIT 100'
  )
    .bind(me.id, me.id)
    .all();

  let list = rows.results || [];
  if (filter === 'incoming') list = list.filter((r) => r.partner_id === me.id && r.status === 'pending');
  else if (filter === 'outgoing') list = list.filter((r) => r.requester_id === me.id && r.status === 'pending');
  else if (filter === 'active') list = list.filter((r) => OPEN_STATUSES.includes(r.status));
  else if (filter === 'done') list = list.filter((r) => !OPEN_STATUSES.includes(r.status));

  const ctx = await loadExchangeContext(env, me.id, list);
  const views = list.map((r) => exchangeView(r, ctx.userMap, ctx.myReviews, me.id));

  const lastMsgs = {};
  if (views.length) {
    const placeholders = views.map(() => '?').join(',');
    const msgRes = await env.DB.prepare(
      `SELECT * FROM messages WHERE exchange_id IN (${placeholders}) ORDER BY created_at`
    )
      .bind(...views.map((v) => v.id))
      .all();
    for (const m of msgRes.results || []) {
      lastMsgs[m.exchange_id] = { body: m.body, createdAt: m.created_at, senderId: m.sender_id };
    }
  }

  const allRows = rows.results || [];
  const counts = {
    all: allRows.length,
    incoming: allRows.filter((r) => r.partner_id === me.id && r.status === 'pending').length,
    active: allRows.filter((r) => OPEN_STATUSES.includes(r.status)).length,
    done: allRows.filter((r) => !OPEN_STATUSES.includes(r.status)).length,
  };

  return json({
    exchanges: views.map((v) => ({ ...v, lastMessage: lastMsgs[v.id] || null })),
    counts,
  });
}

async function loadExchangeForMember(env, me, id) {
  const row = await env.DB.prepare('SELECT * FROM exchanges WHERE id = ?').bind(id).first();
  if (!row) return { error: fail('NOT_FOUND', '找不到这次交换', 404) };
  if (row.requester_id !== me.id && row.partner_id !== me.id) {
    return { error: fail('FORBIDDEN', '你没有权限查看这次交换', 403) };
  }
  return { row };
}

async function handleExchangeDetail(env, me, id) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const found = await loadExchangeForMember(env, me, id);
  if (found.error) return found.error;
  const { row } = found;

  const [msgRes, reviewRes] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM messages WHERE exchange_id = ? ORDER BY created_at').bind(id),
    env.DB.prepare('SELECT * FROM reviews WHERE exchange_id = ? ORDER BY created_at').bind(id),
  ]);
  const ctx = await loadExchangeContext(env, me.id, [row]);
  const view = exchangeView(row, ctx.userMap, ctx.myReviews, me.id);
  const isRequester = row.requester_id === me.id;

  return json({
    exchange: { ...view, message: row.message },
    messages: r(msgRes).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
    })),
    reviews: r(reviewRes).map((rv) => ({
      authorId: rv.author_id,
      targetId: rv.target_id,
      rating: rv.rating,
      body: rv.body,
      createdAt: rv.created_at,
    })),
    permissions: {
      canAccept: !isRequester && row.status === 'pending',
      canDecline: !isRequester && row.status === 'pending',
      canCancel: OPEN_STATUSES.includes(row.status),
      canComplete: row.status === 'accepted' && (row.mode === 'swap' || isRequester),
      canChat: OPEN_STATUSES.includes(row.status),
      canReview: row.status === 'completed' && !view.reviewed,
    },
  });
}

async function transitionExchange(env, me, id, action) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const found = await loadExchangeForMember(env, me, id);
  if (found.error) return found.error;
  const row = found.row;
  const isRequester = row.requester_id === me.id;
  const ts = nowISO();

  let next; let reason; let owner; let delta;
  if (action === 'accept' || action === 'decline') {
    if (isRequester) return fail('FORBIDDEN', '只能由对方处理', 403);
    if (row.status !== 'pending') return fail('INVALID_STATE', '这次交换已经处理过了', 409);
    next = action === 'accept' ? 'accepted' : 'declined';
    if (action === 'accept' && row.mode === 'credit') { reason='escrow'; owner=row.requester_id; delta=-row.duration_hours; }
  } else if (action === 'cancel') {
    if (!OPEN_STATUSES.includes(row.status)) return fail('INVALID_STATE', '这次交换已经结束了', 409);
    next='cancelled';
    if (row.mode === 'credit' && row.status === 'accepted') { reason='refund'; owner=row.requester_id; delta=row.duration_hours; }
  } else if (action === 'complete') {
    if (row.mode === 'credit' && !isRequester) return fail('FORBIDDEN', '由支付学时的学习方确认完成', 403);
    if (row.status !== 'accepted') return fail('INVALID_STATE', '只有进行中的交换才能完成', 409);
    next='completed';
    if (row.mode === 'credit') { reason='earn'; owner=row.partner_id; delta=row.duration_hours; }
  } else return fail('BAD_ACTION', '未知操作');
  const statements = [env.DB.prepare(`UPDATE exchanges SET status=?, updated_at=? WHERE id=? AND status=?
    AND (requester_id=? OR partner_id=?)
    AND (? != 'escrow' OR (SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id=exchanges.requester_id)>=duration_hours)`)
    .bind(next,ts,id,row.status,me.id,me.id,reason || '')];
  if (reason) statements.push(env.DB.prepare(`INSERT INTO ledger(id,user_id,exchange_id,delta,reason,created_at)
    SELECT ?,?,?,?,?,? WHERE changes()=1`).bind(uid(),owner,id,delta,reason,ts));
  const results = await env.DB.batch(statements);
  if (!results[0].meta.changes) return fail('CONFLICT', '交换状态或可用学时已变化，请刷新后重试', 409);

  return handleExchangeDetail(env, me, id);
}

async function handleSendMessage(request, env, me, id) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const found = await loadExchangeForMember(env, me, id);
  if (found.error) return found.error;
  const row = found.row;
  if (!OPEN_STATUSES.includes(row.status)) return fail('INVALID_STATE', '这次交换已经结束，无法继续留言', 409);
  const body = env.body;
  const text = str(body.body, 500);
  if (!text) return fail('EMPTY_MESSAGE', '消息不能为空');

  const messageId = uid();
  const ts = nowISO();
  const results = await env.DB.batch([
    env.DB.prepare("INSERT INTO messages (id, exchange_id, sender_id, body, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM exchanges WHERE id=? AND status IN ('pending','accepted'))").bind(
      messageId,
      id,
      me.id,
      text,
      ts, id
    ),
    env.DB.prepare('UPDATE exchanges SET updated_at = ? WHERE id = ? AND changes()=1').bind(ts, id),
  ]);
  if (!results[0].meta.changes) return fail('INVALID_STATE', '这次交换已经结束', 409);
  return json({ message: { id: messageId, senderId: me.id, body: text, createdAt: ts } });
}

async function handleReview(request, env, me, id) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const found = await loadExchangeForMember(env, me, id);
  if (found.error) return found.error;
  const row = found.row;
  if (row.status !== 'completed') return fail('INVALID_STATE', '交换完成后才能评价', 409);

  const isRequester = row.requester_id === me.id;
  if (isRequester ? row.requester_reviewed : row.partner_reviewed) {
    return fail('ALREADY_REVIEWED', '你已经评价过这次交换了', 409);
  }

  const body = env.body;
  const rating = body.rating;
  if (!(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return fail('INVALID_RATING', '请选择 1 到 5 星');
  const text = str(body.body, 300);
  const targetId = isRequester ? row.partner_id : row.requester_id;

  const ts = nowISO();
  const reviewId = uid();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO reviews (id, exchange_id, author_id, target_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(reviewId, id, me.id, targetId, rating, text, ts),
    env.DB.prepare(
      `UPDATE exchanges SET ${isRequester ? 'requester_reviewed' : 'partner_reviewed'} = 1, updated_at = ? WHERE id = ?`
    ).bind(ts, id),
  ]);
  return json({ review: { id: reviewId, authorId: me.id, targetId, rating, body: text, createdAt: ts } });
}

async function handlePublicUser(env, id) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user || !!user.is_demo !== env.isDemo) return fail('NOT_FOUND', '没有找到这位成员', 404);
  const [teachRes, learnRes, reviewRes] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM teach_skills WHERE user_id = ? ORDER BY created_at').bind(id),
    env.DB.prepare('SELECT * FROM learn_wants WHERE user_id = ? ORDER BY created_at').bind(id),
    env.DB.prepare(
      'SELECT r.*, u.name AS author_name, u.avatar AS author_avatar FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.target_id = ? ORDER BY r.created_at DESC LIMIT 20'
    ).bind(id),
  ]);
  const stats = await getStats(env, id);
  return json({
    user: publicUser(user),
    teach: r(teachRes).map(teachView),
    learn: r(learnRes).map(learnView),
    reviews: r(reviewRes).map((rv) => ({
      rating: rv.rating,
      body: rv.body,
      createdAt: rv.created_at,
      author: { id: rv.author_id, name: rv.author_name, avatar: rv.author_avatar },
    })),
    stats: {
      rating: stats.rating,
      reviewCount: stats.reviewCount,
      teachingHours: stats.teachingHours,
      learningHours: stats.learningHours,
    },
  });
}

const LEDGER_TITLES = {
  bonus: '注册赠送学时',
  escrow: '冻结学时（等待完成）',
  refund: '交换取消，退还学时',
  earn: '教学收入',
};

async function handleLedger(env, me) {
  if (!me) return fail('UNAUTHORIZED', '请先登录', 401);
  const [rows, balance] = await env.DB.batch([
    env.DB.prepare(
      `SELECT l.*, e.teach_skill, e.duration_hours FROM ledger l
       LEFT JOIN exchanges e ON e.id = l.exchange_id
       WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 50`
    ).bind(me.id),
    env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS v FROM ledger WHERE user_id = ?').bind(me.id),
  ]);
  return json({
    balance: r(balance)[0]?.v || 0,
    entries: r(rows).map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      createdAt: r.created_at,
      exchangeId: r.exchange_id,
      title: LEDGER_TITLES[r.reason] || r.reason,
      detail: r.teach_skill ? `技能：${r.teach_skill}，${r.duration_hours} 小时` : '',
    })),
  });
}

async function handleSkills(env) {
  const rows = await env.DB.prepare(
    'SELECT t.skill, t.category, COUNT(*) AS c FROM teach_skills t JOIN users u ON u.id=t.user_id WHERE u.is_demo=? GROUP BY LOWER(t.skill) ORDER BY c DESC LIMIT 24'
  ).bind(Number(env.isDemo)).all();
  return json({
    categories: CATEGORIES,
    popular: (rows.results || []).map((r) => ({ skill: r.skill, category: r.category, count: r.c })),
  });
}

/* ------------------------------------------------------------------ */
/* 路由                                                                 */
/* ------------------------------------------------------------------ */

async function handleApi(request, env, url) {
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/api/health' && method === 'GET') return json({ok:true,service:'skillloop',time:nowISO()});
  if (!['GET','HEAD','OPTIONS'].includes(method)) {
    if (request.headers.get('x-skillloop-request') !== '1') return fail('CSRF', '请求来源不正确', 403);
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if ((origin && origin !== url.origin) || (site && !['same-origin','none'].includes(site))) return fail('CSRF', '请求来源不正确', 403);
    env.body = await readBody(request);
    const strings = {email:120,password:16384,name:24,avatar:8,city:20,headline:40,bio:300,skill:24,category:20,level:20,format:20,blurb:160,note:120,partnerId:40,userId:40,teachSkill:24,giveSkill:24,proposedAt:40,message:500,body:path.endsWith('/reviews') ? 300 : 500};
    for (const [key,max] of Object.entries(strings)) if (key in env.body) str(env.body[key],max);
    for (const [key,allowed] of [['category',CATEGORIES],['level',LEVELS],['format',FORMATS]])
      if (key in env.body && !allowed.includes(env.body[key])) throw new HttpError('INVALID_INPUT','字段值不正确');
  }
  const ip = request.headers.get('cf-connecting-ip');
  if (path === '/api/auth/register' && method === 'POST' && !env.isDemo) {
    if (ip) await throttle(env,'register:ip:'+ip,10,3600);
    return handleRegister(request,env);
  }
  if (path === '/api/auth/login' && method === 'POST' && !env.isDemo) {
    if (ip) await throttle(env,'login:ip:'+ip,30,600);
    return handleLogin(request,env);
  }
  if (path === '/api/auth/demo' && method === 'POST' && env.isDemo) {
    if (ip) await throttle(env,'demo:ip:'+ip,30,600);
    return handleDemoLogin(request,env);
  }
  if (path === '/api/demo-users' && method === 'GET' && env.isDemo) return json({users:await demoUserList(env)});
  if (['/api/auth/demo','/api/auth/demo-switch','/api/demo-users','/api/seed'].includes(path) && !env.isDemo) return fail('NOT_FOUND','接口不存在',404);
  const me = await getSessionUser(request, env);
  if (path === '/api/auth/logout' && method === 'POST') return handleLogout(request,env);
  if (!me) return fail('UNAUTHORIZED','请先登录',401);
  if (path === '/api/auth/demo-switch' && method === 'POST' && env.isDemo) return handleDemoSwitch(request,env,me);

  if (path === '/api/me' && method === 'GET') return handleMe(env, request, me);
  if (path === '/api/me' && method === 'PATCH') return handleUpdateProfile(request, env, me);

  if (path === '/api/me/teach' && method === 'POST') return handleAddTeach(request, env, me);
  const teachDel = path.match(/^\/api\/me\/teach\/([A-Za-z0-9]+)$/);
  if (teachDel && method === 'DELETE') return handleDeleteTeach(env, me, teachDel[1]);

  if (path === '/api/me/learn' && method === 'POST') return handleAddLearn(request, env, me);
  const learnDel = path.match(/^\/api\/me\/learn\/([A-Za-z0-9]+)$/);
  if (learnDel && method === 'DELETE') return handleDeleteLearn(env, me, learnDel[1]);

  if (path === '/api/discover' && method === 'GET') return handleDiscover(env, url, me);
  if (path === '/api/matches' && method === 'GET') return handleMatches(env, me);
  if (path === '/api/skills' && method === 'GET') return handleSkills(env);
  if (path === '/api/ledger' && method === 'GET') return handleLedger(env, me);

  if (path === '/api/exchanges' && method === 'GET') return handleListExchanges(env, url, me);
  if (path === '/api/exchanges' && method === 'POST') return handleCreateExchange(request, env, me);

  const exMatch = path.match(/^\/api\/exchanges\/([A-Za-z0-9]+)(?:\/(accept|decline|cancel|complete|messages|reviews))?$/);
  if (exMatch) {
    const [, id, action] = exMatch;
    if (!action && method === 'GET') return handleExchangeDetail(env, me, id);
    if (action && method === 'POST') {
      if (action === 'messages') return handleSendMessage(request, env, me, id);
      if (action === 'reviews') return handleReview(request, env, me, id);
      return transitionExchange(env, me, id, action);
    }
  }

  const userMatch = path.match(/^\/api\/users\/([A-Za-z0-9]+)$/);
  if (userMatch && method === 'GET') return handlePublicUser(env, userMatch[1]);



  return fail('NOT_FOUND', '接口不存在', 404);
}

const securityHeaders = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'",
  'x-content-type-options':'nosniff', 'x-frame-options':'DENY', 'referrer-policy':'no-referrer',
};
export default {
  async fetch(request, bindings) {
    const url = new URL(request.url); let response;
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const isDemo = url.pathname === '/api/demo' || url.pathname.startsWith('/api/demo/');
      if (isDemo) url.pathname = '/api' + url.pathname.slice('/api/demo'.length);
      const env = { DB: isDemo ? bindings.DEMO_DB : bindings.DB, isDemo };
      try { response = await handleApi(request,env,url); }
      catch(error) {
        if (error instanceof HttpError) {
          response=fail(error.code,error.message,error.status);
          if (error.status===429) response.headers.set('retry-after',String(error.retryAfter));
        } else if (String(error.message).includes('UNIQUE constraint failed: users.email')) response=fail('EMAIL_TAKEN','这个邮箱已经注册过',409);
        else if (String(error.message).includes('UNIQUE constraint failed: reviews.exchange_id')) response=fail('ALREADY_REVIEWED','你已经评价过这次交换了',409);
        else { console.error(JSON.stringify({event:'api_error',path:url.pathname})); response=fail('INTERNAL','服务器开小差了，请稍后再试',500); }
      }
    } else {
      response = await bindings.ASSETS.fetch(request);
    }
    const headers=new Headers(response.headers);
    for (const [key,value] of Object.entries(securityHeaders)) headers.set(key,value);
    if (url.protocol==='https:') headers.set('strict-transport-security','max-age=31536000');
    if (!url.pathname.startsWith('/api')) headers.set('cache-control','no-cache');
    return new Response(response.body,{status:response.status,headers});
  },
};
