# SkillLoop 换技

> 把会的东西，换成想学的事。

时间信用制的技能互换平台：每个人同时发布「我能教」和「我想学」，系统做双向比对，撮合两个人互相教学。教出去的小时变成学时，用来请别人教你。

---

## 直接看什么

1. 按「本地开发」启动后打开站点 → 点「看看示例」，进入 **林知夏** 的视角，无需注册。
2. **名录**：顶部是「可以互换」——你们各自能教对方想学的东西。林知夏 ↔ 陈屿（她学摄影，他学吉他）、林知夏 ↔ 白露（她学口语，白露学界面设计）。
3. **交换**：已有 1 条待处理请求、1 段进行中的交换、1 段已完成。
4. 右上角头像 → **示例身份**（6 个成员），换到对方视角就能看到「接受 / 婉拒」按钮——整个双边流程可以一个人走完。
5. **我的档案**：技能管理、学时存折（每一笔冻结 / 退还 / 收入都可查）。
6. **`/demo` 有引导式导览**：一次走完「匹配 → 发起 → 接受 → 消息 → 完成 → 互评」，途中切换示例身份，导览会跟到新身份继续。

## 产品闭环

| 环节 | 实现 |
| --- | --- |
| 身份 | 邮箱注册（账户初始 3 学时）/ 密码登录 / 示例身份进入 / 示例身份切换 |
| 技能档案 | 「我能教」：技能、分类、能教到的水平、授课形式、教学说明；「我想学」：技能、分类、理由 |
| 匹配 | 双向比对 + 可解释打分：双向可换 55 分、单向 25/15 分，再叠加评分、分类交集、资料完整度；每张卡片写明「为什么推荐 TA」 |
| 发起交换 | 选择想学的技能、拿什么换（自己的技能 = 互教互换，或直接付学时）、时长、期望时间、留言 |
| 协商 | 站内消息线程（仅双方可见）、待处理 / 进行中 / 已完成分段 |
| 结算 | 学时账本：注册 +3、接受时冻结、取消退还、完成时教学方入账；互教互换不流动学时 |
| 评价 | 完成后双向互评（1–5 星 + 文字），一人一次，可回看历史评价 |
| 治理 | 参与者权限校验（非参与方 403）、状态机校验、输入长度上限、全程 HTML 转义 |

## 技术实现

- **单个 Cloudflare Worker**（[`src/index.js`](./src/index.js)，无第三方依赖）同时承载 API 与静态资源；SPA 深链接回落到 `index.html`。
- **Cloudflare D1 是唯一数据源**（[`migrations/0001_init.sql`](./migrations/0001_init.sql)），session、技能、交换、消息、评价、ledger 全部落库。生产使用 `DB`，sandbox 使用独立的 `DEMO_DB`。
- 余额 = `SUM(ledger.delta)`，**没有可被直接改写的余额字段**；冻结 / 退还 / 收入都只能通过领域动作写入。
- 密码 PBKDF2-SHA256（10 万次；为控制 CPU 成本保留的 work factor）、随机盐；session 使用独立的 `__Host-` Cookie，带 Secure、HttpOnly、SameSite=Lax；D1 只存 token 的 SHA-256 digest。
- 前端是**零构建**的原生 ES Module SPA（[`public/app.js`](./public/app.js)、[`public/app.css`](./public/app.css)）：History API 路由、无框架、无 CDN 依赖、所有用户内容经转义。
- 数据模型与接口契约以 [`migrations/0001_init.sql`](./migrations/0001_init.sql) 的 schema 和 [`src/index.js`](./src/index.js) 的领域函数为准；验收标准即 `npm test` 中的 focused checks。

## 本地开发

```sh
npm install
npx wrangler d1 migrations apply skillloop-db --local   # 建表
npm run db:migrate:demo:local                              # sandbox 建表
npm run seed                                             # 只向本地 DEMO_DB 写入合成数据
npm run dev                                              # http://localhost:8787，示例入口 /demo
```

## 部署

```sh
npx wrangler d1 migrations apply skillloop-db --remote
npx wrangler d1 migrations apply DEMO_DB --remote
npm run deploy
npm run seed -- --remote  # 仅在确认要初始化远端 sandbox 时执行
```

部署前必须先创建独立的 `skillloop-demo-db` 并填写 `DEMO_DB.database_id`，再对两个 binding 执行 migration。不能将两个 binding 指向同一个 database。

`0002_security.sql` 会撤销旧 session，用户需要重新登录。migration 会拒绝重复 ledger posting、负余额或真实账户与旧 demo 的混合交换；失败时先核查数据，不自动改账。旧 demo records 保留但不会进入生产查询。sandbox 使用新的合成 seed，不复制生产消息。

seed CLI 固定写入 `DEMO_DB`；已有用户时不重复初始化。HTTP seed API 已删除。

## 边界与后续

首版聚焦「匹配 → 交换 → 结算 → 评价」的完整闭环，刻意不做：真实支付、视频通话、原生 App、地图、公开社交信息流、复杂推荐模型。demo 仅通过 `/api/demo/auth/demo` 和示例身份切换进入；sandbox 不提供注册和密码登录。它是共享的公开体验环境，请勿输入私人信息。

真实成员档案及技能 API 要求生产登录。credit 模式由 requester 确认完成；swap 模式任一参与方均可完成。状态与 ledger posting 在同一 transaction 中写入，防止重复结算。

新注册密码为 15–128 个字符；已有密码仍可登录。登录限制为每邮箱 10 次／10 分钟、每 IP 30 次／10 分钟；注册限制为每 IP 10 次／小时。所有 mutation 要求 `x-skillloop-request: 1` 和 JSON object，body 上限 16 KiB，并校验 Origin 与 Fetch Metadata。

本版不提供邮箱验证、密码找回或 MFA；保留注册赠送 3 学时，因此邮箱归属和多账户领取 bonus 的风险仍然存在。PBKDF2 的 100,000 次低于当前业界通行的口令哈希迭代建议。

运行 focused checks：`npm test`。

## 许可证

本项目使用 GPL-3.0，详见 [LICENSE](./LICENSE)。
