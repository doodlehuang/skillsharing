import { uid, hashPassword, json } from '../src/index.js';
const DEMO_PASSWORD = 'demo1234';
const SEED_USERS = [
  {
    key: 'lin',
    email: 'lin@skillloop.app',
    name: '林知夏',
    avatar: '🌿',
    city: '上海',
    headline: '白天写代码，晚上弹琴',
    bio: '产品设计师，学吉他 3 年。想找能一起练口语的人。',
    teach: [
      ['吉他', '音乐', '进阶', '从零基础到能完整弹唱一首歌，先学和弦再学节奏', 'both'],
      ['界面设计', '设计', '进阶', '带你走一遍从需求到高保真原型，含一次作业点评', 'online'],
    ],
    learn: [
      ['英语口语', '语言', '能聊完 20 分钟不卡壳'],
      ['摄影', '摄影', '想学会用手动模式拍夜景'],
    ],
  },
  {
    key: 'chen',
    email: 'chen@skillloop.app',
    name: '陈屿',
    avatar: '📷',
    city: '杭州',
    headline: '把光线讲明白的摄影课',
    bio: '自由摄影师 6 年，跑过 40 个城市。想找人教我剪视频。',
    teach: [
      ['摄影', '摄影', '精通', '夜景和逆光人像，带一次外拍实拍', 'offline'],
      ['照片调色', '摄影', '进阶', '一次课建立自己的调色预设', 'online'],
    ],
    learn: [
      ['视频剪辑', '设计', '能把旅行素材剪成 3 分钟短片'],
      ['吉他', '音乐', '旅行路上能随手弹两首'],
    ],
  },
  {
    key: 'su',
    email: 'su@skillloop.app',
    name: '苏茉',
    avatar: '🎹',
    city: '成都',
    headline: '钢琴十级，也在重新学说话',
    bio: '音乐老师。带过 120 个学生，最擅长让成年人不怕开始。',
    teach: [
      ['钢琴', '音乐', '精通', '零基础也能 4 周弹出第一首曲子，含指法纠正', 'both'],
      ['乐理', '音乐', '进阶', '把五线谱和和弦一次讲通', 'online'],
    ],
    learn: [
      ['Python', '编程', '能自己爬数据做图表'],
      ['界面设计', '设计', '想给自己做一页作品集'],
    ],
  },
  {
    key: 'he',
    email: 'he@skillloop.app',
    name: '何一舟',
    avatar: '🧑‍💻',
    city: '深圳',
    headline: '写 Python，也写诗',
    bio: '后端工程师 5 年。想学吉他，用来在年会上不尴尬。',
    teach: [
      ['Python', '编程', '精通', '从装环境到写出一个能跑的小工具，实战为主', 'online'],
      ['数据分析', '编程', '进阶', 'pandas + 可视化，带你的真实数据来做', 'online'],
    ],
    learn: [
      ['吉他', '音乐', '能弹唱《晴天》'],
      ['摄影', '摄影', '旅行照片不再是游客照'],
    ],
  },
  {
    key: 'qiao',
    email: 'qiao@skillloop.app',
    name: '乔安',
    avatar: '🧶',
    city: '北京',
    headline: '手作、咖啡、和一点耐心',
    bio: '咖啡师 + 手作老师。相信手比脑子先学会。',
    teach: [
      ['手冲咖啡', '手作', '进阶', '从磨豆到注水，一次课喝懂三种豆子', 'offline'],
      ['钩针编织', '手作', '进阶', '一个下午织出第一只小包', 'both'],
    ],
    learn: [
      ['Python', '编程', '想做一个小记账工具'],
      ['界面设计', '设计', '给自己的小品牌做视觉'],
    ],
  },
  {
    key: 'bai',
    email: 'bai@skillloop.app',
    name: '白露',
    avatar: '🗣️',
    city: '南京',
    headline: '前口语考官，现在只教聊天',
    bio: '英语老师 8 年。想学剪视频，把自己的课录下来。',
    teach: [
      ['英语口语', '语言', '精通', '模拟真实场景对话，纠音 + 表达替换', 'online'],
      ['学术英语写作', '语言', '进阶', '一次课讲透议论文的论证结构', 'online'],
    ],
    learn: [
      ['视频剪辑', '设计', '能把长课程剪成切片'],
      ['界面设计', '设计', '想自己给课程做一套视觉'],
    ],
  },
];

// 演示数据以北京时间（UTC+8）为准生成"明天 20:00"这类时间
function tomorrowAt(hour) {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() + 1);
  now.setUTCHours(hour, 0, 0, 0);
  return new Date(now.getTime() - 8 * 3600 * 1000).toISOString();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export async function seedInner(env) {
  const existing = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  if (existing.c > 0) {
    return json({ ok: true, seeded: false, users: existing.c });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const statements = [];
  const byKey = {};

  SEED_USERS.forEach((u, i) => {
    const id = uid();
    byKey[u.key] = {
      id,
      teach: u.teach.map(([skill, category, level, blurb, format]) => ({ skill, category, level, blurb, format, id: uid() })),
      learn: u.learn.map(([skill, category, note]) => ({ skill, category, note, id: uid() })),
    };
    const createdAt = daysAgo(40 - i * 5);
    statements.push(
      env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, name, avatar, city, headline, bio, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
      ).bind(id, u.email, passwordHash, u.name, u.avatar, u.city, u.headline, u.bio, createdAt),
      env.DB.prepare(
        "INSERT INTO ledger (id, user_id, exchange_id, delta, reason, created_at) VALUES (?, ?, NULL, 3, 'bonus', ?)"
      ).bind(uid(), id, createdAt)
    );
    for (const t of byKey[u.key].teach) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO teach_skills (id, user_id, skill, category, level, blurb, format, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(t.id, id, t.skill, t.category, t.level, t.blurb, t.format, createdAt)
      );
    }
    for (const l of byKey[u.key].learn) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO learn_wants (id, user_id, skill, category, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(l.id, id, l.skill, l.category, l.note, createdAt)
      );
    }
  });

  const exchange = (opts) => {
    const id = uid();
    const ts = opts.createdAt;
    statements.push(
      env.DB.prepare(
        `INSERT INTO exchanges
          (id, requester_id, partner_id, teach_skill, give_skill, mode, message, duration_hours, proposed_at, status,
           requester_reviewed, partner_reviewed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        byKey[opts.requester].id,
        byKey[opts.partner].id,
        opts.teachSkill,
        opts.giveSkill || '',
        opts.giveSkill ? 'swap' : 'credit',
        opts.message || '',
        opts.hours || 1,
        opts.proposedAt,
        opts.status,
        opts.requesterReviewed ? 1 : 0,
        opts.partnerReviewed ? 1 : 0,
        ts,
        opts.updatedAt || ts
      )
    );
    if (opts.message) {
      statements.push(
        env.DB.prepare('INSERT INTO messages (id, exchange_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(
          uid(),
          id,
          byKey[opts.requester].id,
          opts.message,
          ts
        )
      );
    }
    (opts.reviews || []).forEach((rv, idx) => {
      statements.push(
        env.DB.prepare(
          'INSERT INTO reviews (id, exchange_id, author_id, target_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          uid(),
          id,
          byKey[rv.author].id,
          byKey[rv.target].id,
          rv.rating,
          rv.body,
          new Date(new Date(ts).getTime() + (idx + 1) * 3600 * 1000).toISOString()
        )
      );
    });
    return id;
  };

  const message = (exId, sender, body, ts) => {
    statements.push(
      env.DB.prepare('INSERT INTO messages (id, exchange_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(
        uid(),
        exId,
        byKey[sender].id,
        body,
        ts
      )
    );
  };

  // A. 陈屿 → 林知夏：待处理请求（credit）
  exchange({
    requester: 'chen',
    partner: 'lin',
    teachSkill: '吉他',
    hours: 1,
    proposedAt: tomorrowAt(20),
    status: 'pending',
    message: '看到你在学吉他，我可以从和弦手型开始带一次？这周三晚 8 点线上？',
    createdAt: daysAgo(0.2),
  });

  // B. 林知夏 → 白露：已接受，正在协商
  const exB = exchange({
    requester: 'lin',
    partner: 'bai',
    teachSkill: '英语口语',
    giveSkill: '界面设计',
    hours: 1,
    proposedAt: tomorrowAt(20),
    status: 'accepted',
    message: '想练口语，我可以用界面设计跟你换～',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(0.6),
  });
  message(exB, 'lin', '周三晚上我可以，线上语音？', daysAgo(1.2));
  message(exB, 'bai', '好，我发会议链接。你先准备一个最近想聊的话题。', daysAgo(1.1));
  message(exB, 'lin', '收到，我准备一下最近做的一个项目。', daysAgo(0.6));

  // C. 何一舟 → 苏茉：已完成，互评
  exchange({
    requester: 'he',
    partner: 'su',
    teachSkill: '钢琴',
    giveSkill: 'Python',
    hours: 2,
    proposedAt: daysAgo(9),
    status: 'completed',
    requesterReviewed: true,
    partnerReviewed: true,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(8),
    reviews: [
      { author: 'su', target: 'he', rating: 5, body: '讲得非常耐心，第一节就带我跑通了环境。' },
      { author: 'he', target: 'su', rating: 5, body: '老师纠正指法很细，成年人学琴也可以很轻松。' },
    ],
  });

  // D. 苏茉 → 何一舟：已完成，反向互换
  exchange({
    requester: 'su',
    partner: 'he',
    teachSkill: 'Python',
    giveSkill: '钢琴',
    hours: 1,
    proposedAt: daysAgo(6),
    status: 'completed',
    requesterReviewed: true,
    partnerReviewed: true,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(5),
    reviews: [
      { author: 'he', target: 'su', rating: 5, body: '苏茉上手很快，第二次课就写出了小工具。' },
      { author: 'su', target: 'he', rating: 4, body: '讲解清晰，就是节奏有点快，建议下次留点练习时间。' },
    ],
  });

  // E. 乔安 → 白露：已拒绝
  exchange({
    requester: 'qiao',
    partner: 'bai',
    teachSkill: '英语口语',
    hours: 1,
    proposedAt: daysAgo(3),
    status: 'declined',
    message: '想请一节课，用学时换。',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(3.5),
  });

  // F. 林知夏 → 陈屿：我发起的待回复
  exchange({
    requester: 'lin',
    partner: 'chen',
    teachSkill: '摄影',
    giveSkill: '吉他',
    hours: 1,
    proposedAt: tomorrowAt(19),
    status: 'pending',
    message: '想跟你学夜拍！我可以教你吉他或者界面设计换～',
    createdAt: daysAgo(1),
  });

  // G. 林知夏 → 苏茉：已完成（credit 结算）
  const exG = exchange({
    requester: 'lin',
    partner: 'su',
    teachSkill: '钢琴',
    hours: 1,
    proposedAt: daysAgo(12),
    status: 'completed',
    requesterReviewed: true,
    partnerReviewed: true,
    message: '想学钢琴很久了，用学时请教一节。',
    createdAt: daysAgo(16),
    updatedAt: daysAgo(11),
    reviews: [
      { author: 'lin', target: 'su', rating: 5, body: '零基础也完全跟得上，老师会拆成很小的一步一步。' },
      { author: 'su', target: 'lin', rating: 5, body: '学生很专注，课后自己练了两小时。' },
    ],
  });
  statements.push(
    env.DB.prepare(
      "INSERT INTO ledger (id, user_id, exchange_id, delta, reason, created_at) VALUES (?, ?, ?, -1, 'escrow', ?)"
    ).bind(uid(), byKey.lin.id, exG, daysAgo(15)),
    env.DB.prepare(
      "INSERT INTO ledger (id, user_id, exchange_id, delta, reason, created_at) VALUES (?, ?, ?, 1, 'earn', ?)"
    ).bind(uid(), byKey.su.id, exG, daysAgo(11))
  );

  // D1 单次 batch 有语句上限，分段提交
  for (let i = 0; i < statements.length; i += 25) {
    await env.DB.batch(statements.slice(i, i + 25));
  }

  return json({ ok: true, seeded: true, users: SEED_USERS.length, exchanges: 7 });
}

