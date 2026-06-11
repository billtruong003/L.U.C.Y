# VISION 2026 — Radiant Knowledge Network

> **Master vision doc cho hệ sinh thái Bill: Lucy ↔ Học Phòng ↔ radiant-bot/Aki.**
> Viết 2026-06-06 sau khi audit toàn bộ 3 repo (L.U.C.Y, radiant-bot, radiant-bot-backup).
> Đọc file này để hiểu **đang xây cái gì, đang thiếu cái gì, và thứ tự làm**. Mỗi session sau
> mở doc này TRƯỚC khi quyết định Lát mới.

> ⚠️ Khác `HANDOFF.md` của L.U.C.Y (state hiện tại). Đây là **tầm nhìn dài hạn** — chốt ý định,
> chưa chốt code. Quyết định phải khớp ngược lên đây nếu lệch.

---

## TL;DR — 1 đoạn

Hệ sinh thái Bill đang là **3 đảo rời**: radiant-bot (Discord community + Aki text-only),
L.U.C.Y (personal AI trên Telegram, multi-agent `claude -p` qua `/fan` `/orch` `/auto`, hub web),
và arena-server (PvP game). **Đảo thứ 4 sẽ thêm: "Học Phòng"** — public learning portal kiểu
**codelearn.io + HackerRank**: 10 bài/ngày, courses do agent viết, exercise code/English có judge,
community-custom courses, SEO max. **Lucy là trung tâm điều phối** — `claude -p` agent fleet
operates **qua kênh Discord** như message bus, output đẩy ra portal. **Aki được nâng cấp** từ
chatbot text → **agent có tool-use** (gọi store, post Discord, dispatch claude, publish article).
**Tribulation** đổi từ phép cộng cấp 1 → **code/English exercise thực** để member tiến bộ thật.
**Harness `claude -p`** được hardening: queue, retry, cost ledger, structured logging.

---

## Mục lục

1. [Tầm nhìn 3 chân](#1-tầm-nhìn-3-chân)
2. [Tổng quan hiện trạng (audit 2026-06-06)](#2-tổng-quan-hiện-trạng-audit-2026-06-06)
3. [Gap analysis — đang thiếu cái gì](#3-gap-analysis--đang-thiếu-cái-gì)
4. [Kiến trúc đích](#4-kiến-trúc-đích)
5. [Workstream — phases ship](#5-workstream--phases-ship)
6. [Aki upgrade spec](#6-aki-upgrade-spec)
7. [Tribulation rework spec](#7-tribulation-rework-spec)
8. [Multi-agent Discord protocol](#8-multi-agent-discord-protocol)
9. [`claude -p` harness hardening](#9-claude--p-harness-hardening)
10. [Học Phòng portal — architecture chi tiết](#10-học-phòng-portal--architecture-chi-tiết)
11. [Open decisions — cần Bill chốt](#11-open-decisions--cần-bill-chốt)
12. [Reference index](#12-reference-index)

---

## 0. Vision benchmark — nhắm cụ thể

**Long-term vision Bill chốt 2026-06-06:** Học Phòng nhắm trở thành như **[refactoring.guru](https://refactoring.guru)** + **[w3schools](https://w3schools.com)** — nguồn traffic tutorial code khổng lồ, được dev tìm vào hằng ngày.

| Yếu tố | refactoring.guru | w3schools | Học Phòng target |
|---|---|---|---|
| Content | Design patterns + refactoring catalog | Tutorial mọi ngôn ngữ | Code tutorial + AI/Agent + English |
| In-browser code runner | ❌ | ✅ "Try it Yourself" inline | ✅ **Phải có v1** (WS-K-lite) |
| Visual content | ✅ Illustrations đẹp | ⚠️ Đơn giản | ✅ AI-gen cover + infographic + screenshot |
| SEO long-tail | ✅ Top design pattern keywords | ✅ Top mọi tutorial keyword | ✅ 30+ bài/ngày → long-tail dominance |
| Courses | ❌ | ✅ Cert paid | ✅ Course system + community-custom |
| Community contrib | ❌ | ❌ | ✅ (differentiator) |

**Implication kiến trúc:** WS-K (in-browser compiler) **không còn là Phase 16.0 future** — phải có **v1 inline-code-runner** ở Phase 15.2 song song WS-E + WS-G. Tách thành 2 sub:
- **WS-K-lite** (Phase 15.2 **must-have**): Code block trong MDX có nút "Run" → POST sandbox → display stdout. Như w3schools "Try It Yourself". Không cần terminal/IDE đầy đủ.
- **WS-K-full** (Phase 16.0 later): Full Monaco editor + xterm.js terminal + persistent workspace per user.

---

## 1. Tầm nhìn 3 chân

```
                           ┌──────────────────────────────────┐
                           │   L.U.C.Y — ORCHESTRATOR (não)   │
                           │   • Telegram personal control    │
                           │   • claude -p agent fleet        │
                           │   • Hub web (chat/tasks/projects)│
                           │   • /fan /orch /auto multi-agent │
                           └──────────────┬───────────────────┘
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                │                         │                         │
                ▼                         ▼                         ▼
   ┌────────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
   │ radiant-bot (Discord)  │  │  HỌC PHÒNG (Portal)  │  │ arena (PvP game)     │
   │ — Aki community face   │  │ — Public learning    │  │ — game side, đang    │
   │ — Agent message bus    │  │ — codelearn.io clone │  │   D.1/D.2 scaffold   │
   │ — Tribulation: code/EN │  │ — 10 bài/ngày auto   │  │ (tách phạm vi —       │
   │ — `/api/agent/*` HMAC  │  │ — Code judge sandbox │  │  không trong vision   │
   │                        │  │ — Community courses  │  │  này, giữ riêng)      │
   └────────────────────────┘  └──────────────────────┘  └──────────────────────┘
              ▲                            ▲
              │  Discord channels = bus    │  HTTP/HMAC + git content
              └────────────────────────────┘
```

**Chân 1 — L.U.C.Y (orchestrator)**: chỗ Bill ra lệnh + nơi `claude -p` chạy ngầm. Mở rộng từ
"personal AI cá nhân" → "agent factory" — không chỉ Telegram chat mà còn **dispatch agent qua
Discord channels** để Aki + radiant-bot phối hợp.

**Chân 2 — Học Phòng (public output)**: nơi **content do agent viết ra được xuất bản công khai**.
Không chỉ blog tĩnh — là **platform học tập**: articles (academic + news), courses (built-in +
community-custom), exercises (code + English với judge), profile/progress, SEO tối ưu.
**Đây là chân mới — chưa tồn tại**.

**Chân 3 — radiant-bot/Aki (community face)**: nơi member tương tác. Aki được nâng cấp từ
"chatbot text" → "agent có tool-use" (gọi store, post channel, dispatch claude, publish article).
Tribulation cũ (math cộng) đổi sang **code/English exercise** kết nối với judge của Học Phòng.
Discord channels trở thành **agent message bus**.

(arena-server giữ scope riêng — không nằm trong vision này.)

---

## 2. Tổng quan hiện trạng (audit 2026-06-06)

### 2.1. radiant-bot — Phase 14.10 (production VPS Vietnix)

| Vùng | State | Note |
|---|---|---|
| Discord bot core (26 slash) | ✅ Production | discord.js v14, TS strict, 484 unit/456 smoke tests |
| Custom WAL+Snapshot store | ✅ Production | ~100MB RAM cho 10k user, 500k xp_logs |
| Aki AI (`/ask` Grok 4.1F) | ✅ Production | Text-only, no tool-use, ~$0.05-0.50/day |
| LLM router (5 tasks) | ✅ Production | Groq primary + Gemini fallback chain |
| Akira / Meifeng NPCs | ✅ Production | Persona override, shared ask-runner |
| Tribulation system | ⚠️ Hoạt động — đơn giản | Math/reaction hardcoded, level-scaled |
| `POST /api/contribute` HMAC | ✅ Production | Phase 12 Lát 9, doc submission |
| `POST /api/arena/result` HMAC | ✅ Production | Phase 13 callback |
| `POST /api/agent/*` | ❌ **Không tồn tại** | Planned in HANDOFF Tier B, chưa build |
| Tool-use cho Aki | ❌ Không có | Aki chỉ generate text |
| `/aki-memory wipe` | ⚠️ Stub | Toggle works, wipe chưa impl |

### 2.2. L.U.C.Y — Production validated 2026-06-03

| Vùng | State | Note |
|---|---|---|
| `lucy_bridge.py` Telegram ↔ `claude -p` | ✅ Live VPS | DIRECT, đã bỏ Hermes, đã ship `/fan` `/orch` `/auto` |
| Persona "em/chủ nhân" anti-hallucinate | ✅ Validated | Test crypto BTC/ETH/BNB/XRP/USDT, báo đúng SOL không có |
| `!o`/`!opus` model switch | ✅ Live | sonnet default, opus on demand |
| `/fan` multi-lane parallel | ✅ Live | ThreadPoolExecutor, max 4 lanes |
| `/orch` plan → sub-agents → synthesis | ✅ Live | Auto plan, song song, gộp |
| `/auto` autonomous loop until STATUS:DONE | ✅ Live | Cap 8 vòng an toàn |
| Hub web (Express + Vite/React/TS) | ✅ Live | Chat/Tasks/Projects/Brain-viz/Aki/Logs/Schedule/Settings |
| 2FA Telegram-approve + TOTP | ✅ Live | 2026-06-03 commit |
| Hub `/api/aki/*` → POST radiant-bot `/api/agent/*` HMAC | ⚠️ One-side built | Hub side ký HMAC; **radiant-bot side endpoint chưa có** → 404 |
| Reverse SSH tunnel local↔VPS | 📋 Spec'd | Chưa setup |
| Cron 2×/ngày research → Discord Aki | 📋 P2 planned | Chưa build |
| Voice (TTS anime girl) | ❌ **Bỏ scope** | 2GB VPS không cài MeloTTS — dropped |
| `claude -p` cost ledger | ❌ Không có | Chưa structured logging |
| Discord-driven agent dispatch | ❌ Không có | Hiện chỉ Telegram-driven |

### 2.3. Học Phòng (portal) — Chưa tồn tại

- 0% code. Chỉ là ý tưởng trong message của Bill 2026-06-06.
- Phải scaffold từ đầu.

### 2.4. arena (out of vision scope)

- arena-server: Lát D.1 scaffold + D.2 DuelRoom shipped. Lát D.3+ pending.
- arena-unity: docs only, Unity project ở `d:\Projects\ArenaPK\` ngoài monorepo.
- **Giữ riêng** — không gộp vào vision này để khỏi loãng.

---

## 3. Gap analysis — đang thiếu cái gì

### 3.1. Critical (block toàn bộ vision)

| # | Gap | Tại sao block | Owner |
|---|---|---|---|
| C1 | **`POST /api/agent/*` không tồn tại trong radiant-bot** | Hub Lucy đã ký HMAC POST nhưng bot không có endpoint → 404. Đây là **seam chính** giữa Lucy ↔ Aki. Mọi flow "Lucy dispatch → Aki làm" đều phụ thuộc | radiant-bot |
| C2 | **Aki không có tool-use** | Aki chỉ generate text. Không thể tự post channel, query store, hay execute action. Mọi "Aki làm việc tự động" đều cần human-in-loop hoặc agent ngoài | radiant-bot/aki |
| C3 | **Không có agent message bus qua Discord channels** | Vision của Bill: agent operate qua kênh Discord. Hiện không có channel nào dành riêng cho agent coordination, không có message format chuẩn, không có router | radiant-bot + Lucy |
| C4 | **Học Phòng portal = 0%** | Không có repo, không có domain, không có content store, không có UI | New |
| C5 | **Không có code execution sandbox** | Tribulation rework + Học Phòng exercises đều cần judge. Hiện zero infrastructure | New |

### 3.2. High (block specific feature)

| # | Gap | Block | Owner |
|---|---|---|---|
| H1 | Aki persona prompt 1500 dòng — cứng, không tự sync với SPEC | Aki không up-to-date khi cảnh giới/quest đổi → bị "ngu" theo | radiant-bot/aki |
| H2 | Không có cost ledger + structured log cho `claude -p` | Không đo được agent fleet đang đốt bao nhiêu rate-limit/$$$ | Lucy bridge |
| H3 | Tribulation chỉ có math + reaction | Không cải thiện skill member. Phải có code + English | radiant-bot/leveling |
| H4 | LLM router chưa có task `'aki-agent'` hoặc `'education-eval'` | Aki tool-use + judge English đều cần | radiant-bot/llm |
| H5 | Hub web chưa render được long-form article (markdown lib có nhưng UI Chat-centric) | Không reuse được cho Học Phòng portal | Lucy hub |
| H6 | Không có queue / backpressure cho `claude -p` workers | Bill kể đã từng cháy 4M tok/$1.1 — chưa có safe guard cho fleet | Lucy bridge |

### 3.3. Medium

| # | Gap | Impact |
|---|---|---|
| M1 | Persona / SOUL.md của Lucy chưa optimize cho multi-agent dispatch (chỉ tối ưu Telegram chat) | Sẽ phải fork persona riêng cho `content-writer-agent`, `exercise-creator-agent`, etc. |
| M2 | Không có versioning cho generated content | 10 bài/ngày — không có cách rollback bài sai/spam |
| M3 | radiant-bot store schema chưa có `UserProgress` entity | Tracking education progress (articles read, exercises done) phải thêm |
| M4 | Không có SEO infrastructure (sitemap, schema.org, OG image gen) | Học Phòng SEO max là yêu cầu nhưng chưa có nền |
| M5 | Không có community course schema (course CRUD, enrollment, completion) | T1 yêu cầu community-custom courses |

---

## 4. Kiến trúc đích

### 4.1. System diagram (target end-state)

```
                            ┌───────────────────────────────────────────┐
                            │  📱 BILL (Telegram, browser, Discord)     │
                            └───┬─────────────────────┬─────────────────┘
                                │                     │
                                │ control             │ public access
                                ▼                     ▼
   ┌──────────────────────────────────┐    ┌──────────────────────────────┐
   │  L.U.C.Y ORCHESTRATOR (VPS)      │    │  HỌC PHÒNG PORTAL (public)   │
   │                                  │    │                               │
   │  lucy_bridge.py (Telegram bot)   │    │  ┌─────────────────────────┐ │
   │     ├─ /fan parallel             │    │  │ apps/web-marketing      │ │
   │     ├─ /orch plan→sub→synth      │    │  │   (Astro SSG)           │ │
   │     ├─ /auto loop                │    │  │ — articles, courses     │ │
   │     └─ claude -p dispatcher      │    │  │   intro, news (SEO max) │ │
   │                                  │    │  └─────────────────────────┘ │
   │  hub/ (Express + Vite/React)     │    │  ┌─────────────────────────┐ │
   │     ├─ Chat / Tasks / Projects   │    │  │ apps/web-app (Next.js)  │ │
   │     ├─ Aki tab (HMAC POST)       │    │  │ — /learn /exercise      │ │
   │     ├─ Brain-viz                 │    │  │   /terminal /profile    │ │
   │     └─ Logs / Cost / Settings    │    │  │   (auth, interactive)   │ │
   │                                  │    │  └─────────────────────────┘ │
   │  AGENT FLEET (claude -p workers) │    │  ┌─────────────────────────┐ │
   │     ├─ content-writer            │    │  │ apps/api (Hono/Node)    │ │
   │     ├─ exercise-creator          │    │  │ — REST: content,        │ │
   │     ├─ news-curator              │    │  │   progress, judge, auth │ │
   │     ├─ seo-optimizer             │    │  └─────────────────────────┘ │
   │     ├─ editor (review/polish)    │    │  ┌─────────────────────────┐ │
   │     └─ publisher (push portal)   │    │  │ apps/sandbox (Docker)   │ │
   │                                  │    │  │ — code judge: Python,   │ │
   │  cost-ledger.jsonl (new)         │    │  │   JS, Go, Rust, etc.    │ │
   │  agent-state.db (queue)          │    │  └─────────────────────────┘ │
   │                                  │    │  ┌─────────────────────────┐ │
   └────────┬──────────────┬──────────┘    │  │ packages/content (MDX)  │ │
            │              │               │  │ — articles, courses in  │ │
            │ /api/agent/* │               │  │   git, frontmatter spec │ │
            │ (HMAC)       │               │  └─────────────────────────┘ │
            ▼              │ HTTP+HMAC     │  ┌─────────────────────────┐ │
   ┌──────────────────────┐│               │  │ data/portal.db (SQLite) │ │
   │ radiant-bot          ││◄──────────────┤  │ — user, progress,       │ │
   │                      ││               │  │   enrollment, custom    │ │
   │  Discord client      ││               │  │   courses               │ │
   │   ├─ Aki AGENT mode  ││               │  └─────────────────────────┘ │
   │   ├─ Akira / Meifeng ││               │                               │
   │   └─ Tribulation v2  ││               └──────────────────────────────┘
   │      (math/code/EN)  ││                              ▲
   │                      ││                              │ publish article
   │  Custom WAL store    ││                              │ (HMAC POST)
   │   ├─ user, xp        ││ Discord agent              │
   │   ├─ UserProgress(★) ││ message bus                  │
   │   └─ Aki agent log   ││                              │
   │                      ││  #agent-content-queue        │
   │  HTTP server         ││  #agent-exercise-queue       │
   │   ├─ /health         ││  #agent-coordination         │
   │   ├─ /api/contribute ││  #agent-error-log            │
   │   ├─ /api/arena/*    ││                              │
   │   └─ /api/agent/* (★)││                              │
   └──────────────────────┘└──────────────────────────────┘
   ★ = mới, phải xây
```

### 4.2. Nguyên tắc kiến trúc

1. **Lucy là orchestrator, không phải executor**. Lucy không chạy code education, không host portal — Lucy **dispatch agent + route message**. Portal có infrastructure riêng.
2. **Discord channels = message bus công khai cho fleet**. Mỗi agent message dạng structured (JSON in code block). Aki vai trò **router + executor cho lệnh từ bus**.
3. **`claude -p` luôn là worker thật**. Không có "trung gian quyết hộ" — đúng triết lý Lucy hiện tại. Lucy persona (Hermes/Mistral/Grok) chỉ là **dispatcher**, không answer chính việc.
4. **Học Phòng monorepo split theo concern** — marketing (SSG SEO max), app (SSR auth interactive), api (single source REST), sandbox (isolated judge), content (MDX git-tracked). **Mỗi cái deploy riêng được** để scale theo nhu cầu.
5. **Custom WAL store của bot vẫn dùng riêng cho Discord state** (user/xp/quest). **Portal có SQLite riêng** cho user-state public. Đừng trộn — concern khác, scale khác.
6. **Content = MDX trong git, không phải DB**. 10 bài/ngày = commit ngày, build static. Versioning miễn phí qua git. Rollback = revert.
7. **Mọi cross-system call ký HMAC SHA-256** giống `/api/contribute`. Một secret per direction (Lucy→Bot, Bot→Portal, Portal→Bot). Đừng share.

### 4.3. Repo layout (target)

```
c:/Users/Admin/Downloads/BillService/    (hoặc rename → projects/)
├── radiant-bot/             ← Discord bot + Aki agent + tribulation v2
├── L.U.C.Y/                 ← orchestrator + agent fleet + hub
│   ├── docs/VISION_2026.md  ← (file này)
│   ├── bridge/lucy_bridge.py
│   ├── hub/                 ← web cockpit (Bill only)
│   ├── agents/              ← (NEW) SKILL.md per agent (writer, editor, judge, …)
│   ├── workspaces/          ← (NEW) per-task workspace cho claude -p
│   └── cost-ledger.jsonl    ← (NEW) structured cost log
├── lucy-portal/             ← (NEW) Học Phòng monorepo
│   ├── apps/
│   │   ├── web-marketing/   ← Astro (public, SEO max)
│   │   ├── web-app/         ← Next.js (auth, interactive)
│   │   ├── api/             ← Hono/Node (REST + HMAC)
│   │   └── sandbox/         ← Docker judge runner
│   ├── packages/
│   │   ├── content/         ← MDX articles + courses
│   │   ├── ui/              ← shared React components
│   │   └── sdk/             ← API client (typed)
│   ├── data/                ← gitignored, runtime DB
│   ├── turbo.json           ← Turborepo
│   └── pnpm-workspace.yaml
├── arena-server/  (giữ riêng — không touch vision này)
└── arena-unity/   (giữ riêng)
```

**Tách `lucy-portal/` riêng repo** thay vì nhét vào L.U.C.Y vì:
- Portal có **public exposure** (deploy site công khai), L.U.C.Y có **private secret** (PAT, Telegram token, OAuth)
- CI/CD khác nhau (portal cần Lighthouse/SEO tests, Lucy cần secret-scan)
- Open-source portion: portal có thể public source về sau, Lucy không
- Tốc độ clone + build: 2 repo độc lập build song song nhanh hơn

---

## 5. Workstream — phases ship

Mỗi workstream **độc lập đến mức tối đa**, dependencies rõ. Estimate là gross effort cho 1 dev có Claude Code support.

### WS-A — `POST /api/agent/*` trong radiant-bot (unblock C1)
**Deliverable:** HTTP endpoints + HMAC verify + action dispatcher trong radiant-bot.
**Endpoints:**
- `POST /api/agent/post-message` — Aki gửi text/embed vào channel chỉ định
- `POST /api/agent/create-thread` — tạo thread trong channel
- `POST /api/agent/grant-xp` — admin-equivalent, có gate
- `POST /api/agent/dispatch-tribulation` — trigger tribulation cho user
- `POST /api/agent/query-user` — read-only query user state
- `POST /api/agent/publish-article-link` — Aki announce bài mới của portal
**Auth:** HMAC SHA-256 reuse pattern của [`/api/contribute`](../../radiant-bot/src/utils/health.ts) với secret `AGENT_HMAC_SECRET` riêng.
**Allowlist actions:** whitelist channel IDs, capped rate (100 req/min total), per-action quota.
**Files touched:** `radiant-bot/src/utils/health.ts`, new `radiant-bot/src/modules/agent-api/` (router + handlers).
**Est:** 1-2 ngày. **Dep:** none. **Tests:** unit + smoke (HMAC verify + dispatch).

### WS-B — Aki agent mode (tool-use) (unblock C2)
**Deliverable:** Aki có thể gọi tools (function-calling) thay vì chỉ generate text.
**Approach:** Migrate Aki từ xAI Grok (no function-calling tại thời điểm impl) sang Groq Llama 3.3 70B với tool-use API, hoặc giữ Grok cho `/ask` casual + thêm route `aki-agent` dùng Groq cho action.
**Tool set v1:**
- `discord_post(channel_id, content)` — wrap `/api/agent/post-message`
- `discord_thread(channel_id, title, content)`
- `store_query(collection, filter)` — read-only
- `store_append_log(collection, entry)` — chỉ collection an toàn
- `claude_dispatch(task, model)` — gọi `claude -p` qua Lucy bridge
- `judge_run(language, code, tests)` — chạy code judge
- `portal_publish(payload)` — push article lên portal
**Safety:** mỗi tool call log vào `aki_tool_log` collection. Per-tool rate-limit. Approval gate cho risky tool (judge_run khi user-supplied code, claude_dispatch khi budget gần cap).
**Files:** new `radiant-bot/src/modules/aki/agent-runner.ts`, mở rộng `llm/types.ts` thêm `'aki-agent'` task.
**Est:** 3-5 ngày. **Dep:** WS-A. **Tests:** unit per tool + smoke E2E.

### WS-C — Multi-agent Discord protocol (unblock C3)
**Deliverable:** Channel set + message format + Aki router cho agent coordination.
**Channels create:**
- `#agent-content-queue` — drafts từ content-writer-agent
- `#agent-exercise-queue` — proposed exercises từ exercise-creator
- `#agent-coordination` — meta-dispatch + status
- `#agent-error-log` — failures + retries (auto-tag elder cho intervention)
**Message format:** xem [§8](#8-multi-agent-discord-protocol) chi tiết.
**Router:** Aki listens `MessageCreate` trên 4 channel trên → parse `agent-message` JSON → dispatch to next pipeline step (writer → editor → SEO → publisher).
**Files:** new `radiant-bot/src/modules/agent-bus/` (router + parser + dispatcher), config thêm channel IDs.
**Est:** 2-3 ngày. **Dep:** WS-A, WS-B.

### WS-D — `claude -p` harness hardening (unblock H2, H6)
**Deliverable:** cost ledger + queue + retry + structured log cho Lucy bridge.
**Changes:**
- `lucy_bridge.py`: add cost ledger append after every `run_claude()` — write `cost-ledger.jsonl` với fields `{task_id, session_id, model, input_tokens, output_tokens, cost_usd, duration_ms, ts}`
- Add global semaphore (max 3 concurrent Claude lanes, configurable env `LUCY_MAX_LANES`)
- Add exponential backoff retry on 429/500 (3 attempts max)
- Add per-task workspace isolation: `LUCY_WORKDIR/<task_id>/` thay vì cùng 1 cwd
- Add **Discord-driven input mode**: monitor channel polled, treat message như Telegram input
**Files:** `L.U.C.Y/bridge/lucy_bridge.py`, new `L.U.C.Y/bridge/discord_driver.py`, new `L.U.C.Y/agents/` folder structure.
**Est:** 2-3 ngày. **Dep:** none (independent của radiant-bot, but coordinates với WS-C).

### WS-E — Học Phòng monorepo scaffold (unblock C4)
**Deliverable:** Turborepo + 4 apps + 3 packages, hello-world deploy-able.
**Stack chốt:**
- Build: `turborepo` + `pnpm` workspaces
- `apps/web-marketing`: **Astro 5** + Tailwind + MDX integration + sitemap-integration + schema.org JSON-LD helper
- `apps/web-app`: **Next.js 15 App Router** + Tailwind + Auth.js (email magic link v1) + tRPC client cho api
- `apps/api`: **Hono** (lighter than Express, runs on Node + Bun + edge) + zod + Drizzle ORM cho SQLite
- `apps/sandbox`: **Node + dockerode** spawning per-exec container (image per language)
- `packages/content`: MDX files với frontmatter schema (`title, slug, tags, difficulty, type, author, date, seo`)
- `packages/ui`: shadcn/ui base + Bill brand theme
- `packages/sdk`: typed API client generated từ api app
**Domain plan:** `learn.billthedev.com` cho marketing, `app.learn.billthedev.com` cho app, `api.learn.billthedev.com` cho api. Caddy reverse-proxy trên VPS Vietnix. (Hoặc Cloudflare Pages free cho marketing + VPS cho app/api/sandbox.)
**Est:** 4-6 ngày. **Dep:** none.

### WS-F — Content pipeline 30+ bài/ngày với multi-agent peer-review (unblock T1)
**Deliverable:** Agent fleet sản xuất 30+ bài/ngày, commit vào `packages/content/articles/<date>/`.
**Pipeline 5-stage (bumped từ 4):**
```
cron 06:00 VN
   └─ planner-agent: phân tích trending topics → 30+ proposal (niche distribution: code 12, AI 8, news 6, english 4)
        └─ content-writer × N lanes (semaphore 4 parallel)
             └─ draft MDX với frontmatter
                  └─ STAGE 1: fact-checker (kiểm số liệu, link nguồn)
                       └─ STAGE 2: code-validator (chạy mọi code snippet qua sandbox — bắt buộc cho tutorial)
                            └─ STAGE 3: editor (grammar, flow, polish)
                                 └─ STAGE 4: seo-optimizer (title/meta/OG/internal-link)
                                      └─ STAGE 5: preview render — Aki post embed vào #agent-content-queue với link preview live
                                           └─ Tự động accept sau 30 phút nếu không elder react ❌
                                                └─ publisher: git commit + push portal repo
                                                     └─ portal CI build + deploy (Astro)
                                                          └─ Aki announce link vào #articles
```
**Bilingual:** Mỗi topic chạy 2 lane (VN + EN), 2 bài độc lập (không dịch). → 30 topics × 2 lang = **60 bài/ngày** total.
**Cost estimate:** Groq Llama 3.3 70B free tier 7000 req/day. 60 bài × 5 stages = 300 req + retries → trong quota. Visual gen (cover image) qua Flux Schnell qua Replicate (~$0.003/img) hoặc DALL-E.
**Files:** new `L.U.C.Y/agents/{planner,content-writer,fact-checker,code-validator,editor,seo-optimizer,publisher}.md` (SKILL.md per agent), new `L.U.C.Y/bridge/cron_content_pipeline.sh`.
**Est:** 7-10 ngày (bumped vì 5 stages + bilingual). **Dep:** WS-D, WS-E, WS-G.

### WS-G — Code judge sandbox (unblock C5)
**Deliverable:** `apps/sandbox` service nhận `{language, code, stdin, tests}` → trả `{stdout, stderr, exit_code, time_ms, mem_kb, verdict}`.
**Tech:** Docker container per execution, image per language (python:3.12-slim, node:20-alpine, golang:1.22-alpine, rust:1.79-slim, etc). Resource limits: 1 CPU, 256MB RAM, 10s timeout. seccomp + read-only FS + no-network. Cleanup container after.
**API:** `POST /judge` ↔ `apps/api` ↔ `apps/sandbox` (internal HTTP, không expose public).
**Test bank format:** `{ input: string, expected_output: string | regex, weight: number }[]`.
**Files:** new `lucy-portal/apps/sandbox/` (Node + dockerode), new `apps/api/src/routes/judge.ts`.
**Est:** 3-5 ngày. **Dep:** WS-E.

### WS-H — Tribulation v2 (unblock H3, T2)
**Deliverable:** `/breakthrough` → user picks `math | code | english` → Aki dispatch correct game.
**Flows:**
- `math`: keep current (legacy fallback)
- `code`: Aki LLM generates problem từ template "Câu hỏi cảnh giới {rank}, độ khó {difficulty}, ngôn ngữ {user_preferred_lang}" → user replies in thread với code block → judge_run tool → result embed
- `english`: Aki LLM generates vocab/grammar question + 4 options → user picks button → answer judged by template
- User preference: `user.tribulation_preference: 'math' | 'code' | 'english' | 'random'` persist trong store
**UI:** `/breakthrough` → ephemeral select menu lần đầu chọn loại (lưu preference) → cron summon tribulation respects preference
**Files:** `radiant-bot/src/modules/events/tribulation.ts`, new `games/code-challenge.ts`, `games/english-quiz.ts`, mở rộng entity `User` thêm `tribulation_preference`.
**Est:** 4-6 ngày. **Dep:** WS-B (Aki tool judge_run), WS-G (sandbox), WS-A (api).

### WS-I — Course system + community-custom (unblock T1 codelearn part)
**Deliverable:** Course CRUD + enrollment + completion tracking + community contribution gated.
**Schema:**
- `courses` table: `{slug, title, description, author_id, is_official, modules[], created_at}`
- `lessons` table: `{course_slug, module_idx, lesson_idx, mdx_path, exercise_id?}`
- `enrollments` table: `{user_id, course_slug, progress_pct, started_at, completed_at?}`
- `exercises` table: `{slug, type:'code'|'english'|'math', problem_mdx, test_bank, difficulty}`
**Built-in courses:** seed 3-5 official courses từ agent fleet (run /orch "lên lộ trình 1 course X")
**Community contribute:** `/contribute-course` slash command → submit course proposal → elder review (sync với `/contribute-doc` flow) → publish
**Files:** `lucy-portal/apps/api/src/routes/courses.ts`, schema DB + migrations, `web-app` course pages.
**Est:** 6-8 ngày. **Dep:** WS-E, WS-G.

### WS-J — SEO infrastructure (unblock T1 SEO max requirement)
**Deliverable:** Sitemap auto + JSON-LD Article schema + OG image gen + internal-link graph + Robots.txt.
**Items:**
- `apps/web-marketing` Astro integration `@astrojs/sitemap` + customize cho daily article freshness
- Add JSON-LD `Article` + `BreadcrumbList` + `Course` schemas per page (via Astro layout)
- OG image generation: Satori or `@vercel/og` to render dynamic OG per article (title + author + theme bg)
- Internal-link graph: SEO agent reads existing articles → suggests inbound links → commit changes
- Robots.txt + canonical URL + meta description per article (validated frontmatter)
- Google Search Console + Bing Webmaster setup script
**Files:** Astro configs, new `packages/seo` helper, agent skill `seo-optimizer.md`.
**Est:** 3-4 ngày. **Dep:** WS-E.

### WS-K-lite — Inline code runner trong articles (w3schools style) ⭐ MUST-HAVE v1
**Deliverable:** MDX component `<CodeRunner language="python">...</CodeRunner>` → render code box + nút Run → POST `/api/judge/run-snippet` → display stdout/stderr inline.
**UX:** Như "Try it Yourself" của w3schools. KHÔNG cần terminal, KHÔNG cần editor đầy đủ. Text area + syntax highlight (Prism/Shiki) + 1 button + output panel.
**Backend reuse:** WS-G sandbox (Docker container) đã có — chỉ thêm `/run-snippet` endpoint (no test bank, just exec + capture).
**Languages v1:** Python, JS/Node, Go, Rust, Bash. (Add more in iterations.)
**Files:** `lucy-portal/apps/web-marketing/src/components/CodeRunner.astro`, `apps/web-app/src/components/CodeRunner.tsx`, `apps/api/src/routes/run-snippet.ts`.
**Est:** 2-3 ngày. **Dep:** WS-E, WS-G.

### WS-K-full — Full IDE + persistent terminal (Phase 16.0 polish)
**Deliverable:** `/app/terminal` route với Monaco editor + xterm.js + PTY backend + persistent user workspace + multi-file project tree.
**Options:**
1. **WebContainer (StackBlitz)** — Node.js trong browser (WASM), no backend cho JS/TS, free SDK
2. **Monaco + xterm.js + PTY** — full control, backend (WebSocket PTY) cho mọi language qua sandbox
**Recommendation:** Hybrid — WebContainer cho JS/TS (instant, no backend), PTY+sandbox cho Python/Go/Rust.
**Files:** `web-app/src/app/terminal/page.tsx`, `apps/api/src/routes/pty-ws.ts`, workspace persistence layer.
**Est:** 5-7 ngày. **Dep:** WS-E, WS-G, WS-K-lite. **Phase:** 16.0 sau v1 stable.

### 5.x — Phase ordering (đề xuất — updated 2026-06-06 sau Bill clarify)

```
Phase 15.0 (foundation):       WS-A + WS-D + WS-E    [3 song song, ~1 tuần]
                                                       (start parallel — A blocks B, E blocks F, D infrastructure)
Phase 15.1 (agent capable):    WS-B + WS-C            [B sau A, C sau B+webhook setup, ~1.5 tuần]
Phase 15.2 (portal + runner):  WS-G + WS-K-lite       [G sau E, K-lite sau G, ~1 tuần]
Phase 15.3 (content live):     WS-F + WS-J            [F cần B+C+E+G ready, ~1.5 tuần]
Phase 15.4 (tribulation v2):   WS-H                   [sau B+G, ~1 tuần]
Phase 15.5 (course system):    WS-I                   [sau E+G, ~1.5 tuần]
Phase 16.0 (full IDE polish):  WS-K-full              [polish, sau v1 stable]
```

**Total Phase 15:** ~7-8 tuần với 1 dev + Claude Code (bumped chút vì WS-F lên 5-stage + bilingual).

**🎯 Recommendation Bill đi tiếp — Phase 15.0 start NGAY với WS-A + WS-D + WS-E song song:**

Lý do start cả 3 song song (không lockstep):
- **WS-A (`/api/agent/*` endpoints trong bot)** — 1-2 ngày, blocker cho WS-B/WS-C. Bot side, làm trong radiant-bot branch
- **WS-D (Lucy harness hardening)** — 2-3 ngày, cost ledger + queue + Discord driver. Lucy side, làm trong L.U.C.Y branch
- **WS-E (portal scaffold)** — 4-6 ngày, scaffold + deploy hello-world. Repo mới `lucy-portal/`, không đụng 2 cái trên

Sau 1 tuần Phase 15.0 xong → có **3 đảo đã liên kết**: bot endpoint sẵn, harness vững, portal placeholder up → bắt đầu WS-B agent capable.

---

## 6. Aki upgrade spec

### 6.1. Current vs Target

| Aspect | Current (Phase 14.10) | Target (Phase 15.1 WS-B) |
|---|---|---|
| Model | xAI Grok 4.1F Reasoning ($0.20/$0.50 per 1M) | Groq Llama 3.3 70B + tool-use (free tier) for agent actions; xAI Grok vẫn cho `/ask` casual |
| Capability | Text-only | Text + tool-use (function-calling) |
| State | Stateless per call | Per-call state + agent log + tool log |
| Trigger | `/ask` slash only | `/ask` + auto-listen agent-channel + scheduled task |
| Safety | Rate-limit + budget cap | + per-tool rate-limit + approval gate cho risky tools + audit log |
| Persona | 1500-line static `persona.ts` | Hot-swappable persona (agent mode vs chat mode) + sync với SPEC qua build script |

### 6.2. Tool set v1

```ts
// radiant-bot/src/modules/aki/agent-tools.ts
export const AKI_TOOLS = [
  {
    name: 'discord_post',
    description: 'Gửi text/embed message vào Discord channel cho phép',
    parameters: { channel_id, content, embed_json? },
    rate_limit: '60/min',
    requires_approval: false,
  },
  {
    name: 'discord_thread',
    description: 'Tạo thread mới trong channel + post message đầu',
    parameters: { channel_id, title, content },
    rate_limit: '10/min',
  },
  {
    name: 'store_query',
    description: 'Read-only query vào custom store',
    parameters: { collection: 'users'|'xp_logs'|'quests'|..., filter_jq },
    rate_limit: '120/min',
  },
  {
    name: 'store_append_log',
    description: 'Append vào safe log collection',
    parameters: { collection: 'aki_action_log'|'agent_event_log', entry },
    rate_limit: '60/min',
  },
  {
    name: 'claude_dispatch',
    description: 'Dispatch task tới claude -p worker qua Lucy bridge',
    parameters: { task, model: 'sonnet'|'opus', timeout_s },
    rate_limit: '5/hour',
    requires_approval: true,  // risk: cost burn
    approval_gate: 'budget_remaining > $0.50',
  },
  {
    name: 'judge_run',
    description: 'Submit code to judge sandbox',
    parameters: { language, code, test_bank_id },
    rate_limit: '30/min',
    requires_approval: 'if_user_supplied_code',
  },
  {
    name: 'portal_publish',
    description: 'Publish article/exercise tới portal via HMAC',
    parameters: { kind: 'article'|'exercise', payload },
    rate_limit: '20/hour',
    requires_approval: true,  // public-facing
  },
];
```

### 6.3. Safety architecture

```
User-triggered tool call → Aki LLM picks tool → 
    ↓
1. Schema validate (zod) — params đúng kiểu
2. Rate-limit check (per-user + global)
3. Allowlist check (channel ID, action type)
4. Approval gate (if required) — emit `#agent-coordination` "approval needed", wait for elder reaction or timeout
5. Execute action
6. Log to `aki_tool_log` (always — successful + failed)
7. Return result to LLM for next iteration
```

### 6.4. Persona auto-sync

Vấn đề H1: persona 1500 dòng cứng, không sync khi SPEC đổi. **Solution:**
- Build script `scripts/build-aki-persona.ts` reads SPEC sections (cảnh giới, XP rules, command list, công pháp catalog) → templates ra `persona.generated.ts`
- `persona.ts` import từ generated + thêm hand-written rules
- CI hook: change SPEC → rebuild persona → commit

---

## 7. Tribulation rework spec

### 7.1. Mode selection

```
┌─ /breakthrough (level ≥ 10, ≥1 pill) ─┐
│                                        │
│  First time: ephemeral select menu     │
│   • 📐 Math (legacy)                   │
│   • 💻 Code challenge (new)            │
│   • 🅰️  English quiz (new)             │
│   • 🎲 Random                          │
│                                        │
│  Save user.tribulation_preference       │
│                                        │
│  Subsequent: dispatch theo preference   │
└────────────────────────────────────────┘
```

### 7.2. Code challenge flow

```
1. Aki LLM generate problem qua route `'tribulation-code'`:
   - input: { user_level, rank, lang_pref?, recent_topics_avoided[] }
   - output: { title, statement_mdx, starter_code, test_bank_id, time_limit_s }
2. Post embed vào #tribulation + create thread "Thử thách của {member}"
3. User reply trong thread với code block ```{lang} ... ```
4. Aki extract code → call judge_run tool → wait result
5. Verdict embed: PASS (+500 XP) / FAIL (-100 XP) + show failed test case
6. Narration via `narration` task (Llama 3.3 70B)
```

**Difficulty mapping:**
- Lv 10-19 (Trúc Cơ): simple fizzbuzz, reverse string, count vowels
- Lv 20-34 (Kim Đan): array sum, two-pointer, basic recursion
- Lv 35-49 (Nguyên Anh): hashmap, sliding window, BFS/DFS easy
- Lv 50+: DP basic, graph algo, design problems

### 7.3. English quiz flow

```
1. Aki LLM generate question qua route `'tribulation-english'`:
   - input: { user_level, rank, focus: 'vocab'|'grammar'|'reading' (round-robin) }
   - output: { question, options[4], correct_idx, explanation }
2. Post embed với 4 buttons
3. User clicks → check correct_idx → verdict
4. Explanation shown regardless (learning value)
```

### 7.4. Schema additions

```ts
// radiant-bot/src/db/types.ts
interface User {
  // ... existing fields ...
  tribulation_preference: 'math' | 'code' | 'english' | 'random' | null;
  tribulation_history_summary: {
    code_attempts: number, code_passes: number,
    english_attempts: number, english_passes: number,
    math_attempts: number, math_passes: number,
  } | null;  // null = chưa bao giờ qua tribulation
}

// new entity
interface CodeChallengeAttempt {
  id: ulid;
  discord_id: string;
  level_at_attempt: number;
  problem_slug: string;
  language: string;
  code_submitted: string;  // capped 8KB
  verdict: 'pass' | 'fail' | 'timeout' | 'error';
  judge_result_summary: string;  // first failed test or "all passed"
  duration_ms: number;
  created_at: number;
}
```

---

## 8. Multi-agent Discord protocol

### 8.1. Channel spec

| Channel | Type | Purpose | Permissions |
|---|---|---|---|
| `#agent-content-queue` | Forum (or text) | Drafts từ content-writer-agent, editor pick up | Aki + agents read+write; member read-only |
| `#agent-exercise-queue` | Text | Proposed exercises chờ review | Aki + elders read+write |
| `#agent-coordination` | Text | Meta-dispatch + approval requests + heartbeat | Aki + Bill read+write |
| `#agent-error-log` | Text | Failures + retries + escalation | Aki write; elders read + react |
| `#agent-archive` | Text | Đã ship articles + exercises (Aki announce link) | Bot write; member read |

### 8.2. Message format

Mỗi agent message dạng:

````markdown
**[content-writer-1] draft v1 — task 01K...**

```json:agent-message
{
  "agent_id": "content-writer-1",
  "task_id": "01K9X...",
  "pipeline_stage": "draft",
  "next_stage": "editor",
  "topic": "5 SaaS Trends 2026",
  "target_niche": ["tech", "saas"],
  "word_count": 850,
  "artifact_path": "drafts/01K9X-draft.mdx",
  "metadata": { "seo_keywords": [...], "internal_links_suggested": [...] }
}
```

(Optional preview text)
````

**Router (Aki) listens** `MessageCreate` → parse code block `agent-message` → if `next_stage` set, look up agent for that stage from `agent_registry.json` → dispatch `claude_dispatch` tool with the artifact path + next-stage SKILL.md.

### 8.3. Pipeline registry

```json
// radiant-bot/src/config/agent-pipelines.json
{
  "content_pipeline": [
    { "stage": "draft", "agent": "content-writer", "channel": "agent-content-queue" },
    { "stage": "editor", "agent": "editor", "channel": "agent-content-queue" },
    { "stage": "seo", "agent": "seo-optimizer", "channel": "agent-content-queue" },
    { "stage": "publish", "agent": "publisher", "channel": "agent-content-queue" }
  ],
  "exercise_pipeline": [
    { "stage": "draft", "agent": "exercise-creator", "channel": "agent-exercise-queue" },
    { "stage": "test_validate", "agent": "judge-validator", "channel": "agent-exercise-queue" },
    { "stage": "publish", "agent": "publisher", "channel": "agent-exercise-queue" }
  ]
}
```

### 8.4. Error / retry policy

- Agent timeout (claude -p > timeout_s) → Aki post `#agent-error-log` với task_id + stage + last log → auto-retry once với same model → if fail again, escalate (ping elder)
- Agent output không parse được → post error log + revert to previous stage
- Discord rate-limit → backoff + retry, không drop

---

## 9. `claude -p` harness hardening

### 9.1. Issues hiện tại

Reading `L.U.C.Y/bridge/lucy_bridge.py`:

| Issue | Location | Severity |
|---|---|---|
| Timeout 900s nhưng không retry | `run_claude()` line 152-165 | High |
| Không có cost ledger | (none) | High |
| `/fan` cap 4 workers — chưa configurable | `fan_out()` line 179 | Medium |
| `/orch` plan agent hardcode `'sonnet'` | `orch_run()` line 235 | Low |
| Workdir cùng cho mọi task → file clash | `WORKDIR = ~/lucy-workspace` | Medium |
| Session_id giữ per chat_id; multi-agent fleet không có namespace | `_load()/_save()` line 44-55 | High |
| Persona file (`PERSONA = ~/lucy/bridge/persona.md`) — single, không swap per agent | line 29 | High (block agent fleet) |
| Không Discord-driven input | (none) | High (block WS-C) |

### 9.2. Refactor plan

```python
# L.U.C.Y/bridge/lucy_bridge.py (target)

# 1. Add global semaphore + retry
LANE_SEMAPHORE = threading.Semaphore(int(os.environ.get("LUCY_MAX_LANES", "3")))

def run_claude_with_retry(prompt, session_id, model, persona_path, workdir, max_retry=3):
    with LANE_SEMAPHORE:
        for attempt in range(max_retry):
            try:
                return _run_claude_once(prompt, session_id, model, persona_path, workdir)
            except RateLimitError:
                backoff = 2 ** attempt
                time.sleep(backoff)
            except TransientError:
                time.sleep(1)
        raise MaxRetryError()

# 2. Cost ledger
LEDGER_PATH = os.path.expanduser("~/.lucy/cost-ledger.jsonl")
def _append_ledger(entry):
    os.makedirs(os.path.dirname(LEDGER_PATH), exist_ok=True)
    with open(LEDGER_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

# 3. Per-task workspace
def _make_workspace(task_id):
    ws = os.path.expanduser(f"~/.lucy/workspaces/{task_id}")
    os.makedirs(ws, exist_ok=True)
    return ws

# 4. Per-agent persona swap
def _resolve_persona(agent_id):
    candidates = [
        f"~/lucy/agents/{agent_id}/SKILL.md",
        f"~/lucy/bridge/persona.md",  # fallback
    ]
    for c in candidates:
        if os.path.exists(os.path.expanduser(c)):
            return os.path.expanduser(c)
    return None

# 5. Discord driver — runs alongside Telegram loop
# L.U.C.Y/bridge/discord_driver.py — polls Discord channels via webhook,
#   parses agent-message JSON, dispatches run_claude_with_retry()
```

### 9.3. Cost ledger schema

```jsonl
{"ts": 1780678800, "task_id": "01K9X...", "agent_id": "content-writer-1", "session_id": "...", "model": "claude-sonnet-4-5", "input_tokens": 12450, "output_tokens": 3210, "cost_usd": 0.0487, "duration_ms": 18234, "status": "success"}
{"ts": 1780678820, "task_id": "01K9Y...", "agent_id": "editor", "session_id": "...", "model": "claude-sonnet-4-5", "input_tokens": 8200, "output_tokens": 1450, "cost_usd": 0.0289, "duration_ms": 9123, "status": "success"}
```

Hub `/Cost` tab reads ledger → aggregate per agent/day/model.

---

## 10. Học Phòng portal — architecture chi tiết

### 10.1. App boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ apps/web-marketing  (Astro 5 SSG)                                │
│ ──────────────────────────────────────                           │
│ Routes:                                                          │
│   /                       Landing (hero, latest articles)        │
│   /articles               Article index (paginated, filtered)    │
│   /articles/[slug]        Article detail (MDX from packages)     │
│   /courses                Course catalog                         │
│   /courses/[slug]         Course intro                           │
│   /news                   News feed                              │
│   /tags/[tag]             Tag pages                              │
│   /sitemap.xml            Auto                                   │
│ Build: incremental, 1 article = 1 page, ~30s for 100 articles    │
│ Deploy: Cloudflare Pages (free) OR VPS Caddy static              │
└─────────────────────────────────────────────────────────────────┘
                            │ user clicks "Học" / "Login"
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ apps/web-app  (Next.js 15 App Router)                            │
│ ──────────────────────────────────────                           │
│ Auth (Auth.js):                                                  │
│   email magic link v1 → Discord OAuth v2                         │
│ Routes (authed):                                                 │
│   /app                    Dashboard                              │
│   /app/learn              Enrolled courses                       │
│   /app/learn/[slug]       Course player                          │
│   /app/exercise/[slug]    Exercise + judge UI                    │
│   /app/terminal           Embedded code terminal (WS-K)          │
│   /app/profile            Progress, badges, history              │
│   /app/contribute         Submit article/course                  │
│ Talks to: apps/api via tRPC + typed sdk package                  │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP REST + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ apps/api  (Hono + Drizzle ORM + SQLite)                          │
│ ──────────────────────────────────────                           │
│ Endpoints:                                                       │
│   GET  /api/content/articles      List + filter                  │
│   GET  /api/content/articles/:slug                               │
│   POST /api/auth/*                Auth.js                        │
│   GET  /api/courses               List                           │
│   POST /api/courses               (auth) Create custom           │
│   POST /api/enroll                                               │
│   GET  /api/progress              User progress                  │
│   POST /api/judge                 Submit code → forwards sandbox │
│   POST /api/agent/inbound         HMAC from radiant-bot          │
│   POST /api/publish               HMAC from Lucy publisher       │
│   WS   /api/pty                   Terminal session (WS-K)        │
│ DB: SQLite + Drizzle migrations                                  │
│ Tables: users, accounts, courses, lessons, exercises,            │
│         enrollments, submissions, articles_meta                  │
└─────────────────────────────────────────────────────────────────┘
                            │ internal HTTP (no public expose)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ apps/sandbox  (Node + dockerode)                                 │
│ ──────────────────────────────────────                           │
│ POST /run { language, code, stdin, test_bank }                   │
│   → spawn container (python:3.12-slim / node:20-alpine / …)      │
│   → 1 CPU, 256MB, 10s timeout, seccomp, no-net, read-only FS     │
│   → return { stdout, stderr, exit_code, time_ms, mem_kb,         │
│              verdict, failed_test? }                             │
│ Pool of N pre-warmed containers (config) → ~200ms cold start     │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2. Content storage — git-tracked MDX

```
packages/content/
├── articles/
│   ├── 2026-06-07-saas-trends-2026.mdx       ← 1 file = 1 article
│   ├── 2026-06-07-ai-news-roundup.mdx
│   └── …
├── courses/
│   ├── intro-to-python/
│   │   ├── course.json                        ← metadata
│   │   ├── 01-hello-world.mdx
│   │   ├── 02-variables.mdx
│   │   └── exercises/
│   │       ├── 01-fizzbuzz.json               ← test bank
│   │       └── 02-reverse.json
│   └── english-foundation/
│       ├── course.json
│       └── …
└── frontmatter-schema.zod.ts                  ← validation
```

**Frontmatter spec** (mỗi article):
```yaml
---
title: "5 SaaS Trends Định Hình 2026"
slug: "saas-trends-2026"
description: "Phân tích 5 xu hướng …"   # meta description SEO
date: 2026-06-07
author: "agent:content-writer-1"        # human authors use real name
type: "academic" | "news" | "tutorial"
tags: ["saas", "trends", "2026"]
difficulty: 1 | 2 | 3 | 4 | 5
seo:
  keywords: ["saas trends 2026", "…"]
  canonical: "https://learn.billthedev.com/articles/saas-trends-2026"
  og_image: "auto"                       # render via Satori
generated_by:
  task_id: "01K9X..."
  agent_chain: ["content-writer-1", "editor", "seo-optimizer"]
  reviewed_by: "human"  | null           # null = pure agent (mark cẩn thận)
---
```

### 10.3. SEO playbook

| Item | Tool / Method |
|---|---|
| Sitemap | `@astrojs/sitemap` auto |
| JSON-LD Article schema | Astro layout component |
| Internal linking | seo-optimizer agent gợi ý + apply |
| OG image gen | Satori at build time per article |
| Canonical URL | Frontmatter + Astro middleware |
| Robots.txt | `apps/web-marketing/public/robots.txt` + per-env override |
| Search Console verify | Meta tag in layout |
| Lighthouse score | CI gate (≥95 required to deploy) |
| Programmatic SEO | Tag pages, author pages, "best of <topic>" auto-generated |
| RSS feed | `/rss.xml` Astro endpoint |

---

## 11. Open decisions — cần Bill chốt

| # | Decision | Options | Bill chốt |
|---|---|---|---|
| OD1 | Domain Học Phòng | `learn.billthedev.com` / `radiant-code` / `coderadiant` / khác | ⏸️ **Defer** — placeholder `radiant-code` hoặc `coderadiant`, Bill mua/host sau khi v1 ready |
| OD2 | Ngôn ngữ public site | VN-only / EN-only / VN-primary + EN translation / bilingual auto | ✅ **Bilingual** (VN + EN), dropdown switcher như Vercel docs. 2 bản viết độc lập (không dịch máy) |
| OD3 | Target niches v1 | Code/AI/SaaS/data-sci/finance/edu — pick top 3-5 | ✅ **4 core**: Code & Programming + AI/LLM/Agent + Tech News & SaaS Trends + English for Tech. **Yêu cầu thêm:** nhiều niche con + tin tức cập nhật liên tục + **visual content** (image/screenshot/infographic) |
| OD4 | Auth method | Email / Discord OAuth / Google OAuth / multi | ✅ **Multi-provider extensible**: Discord + Google + GitHub + email magic. Account abstraction trong DB cho phép thêm provider sau (Twitter, Apple). Auth.js handle |
| OD5 | Community course gate | Open (anyone) / application + elder review / curated only | ? |
| OD6 | Monetization v1 | Free / ads / subscription / freemium / skip | Skip v1 |
| OD7 | Sandbox tech | Docker self-host / Judge0 API / WebContainer | Docker (privacy + control) |
| OD8 | Marketing host | Cloudflare Pages free / VPS Caddy | CF Pages (free + CDN) |
| OD9 | App + API host | VPS Vietnix Caddy / Fly.io / Railway | VPS (1 box ai cũng quản) |
| OD10 | DB | SQLite (start) / Postgres (scale) | SQLite v1 |
| OD11 | Cron giờ content pipeline | 06:00 VN / 22:00 VN / khác | ? |
| OD12 | Số articles/day | 10 / 30+ | ✅ **30+/day** (~210/tuần). Bill: "10 ít quá, multi-agent là phải 30+" |
| OD13 | Review gate | Auto / human queue / multi-agent peer / tiered | ✅ **Multi-agent peer-review BẮT BUỘC** + preview. Tutorial luôn agent review. Pipeline: writer → fact-checker → code-validator (tutorial) → editor → SEO → preview render → publish. 5 stages thay vì 4 |
| OD14 | Tribulation cap | Vẫn 24h cooldown server-wide / per-user-only / removed cooldown khi opt-in code | per-user opt-in |
| OD15 | Aki model strategy | Unify / Split-brain / Multi-brain | ✅ **Split-brain**: Grok 4.1F giữ `/ask` casual, thêm Groq Llama 3.3 70B + tool-use cho agent mode |
| OD17 | Multi-agent UX trên Discord | Aki impersonate / webhook-per-agent / separate bot / hybrid | ✅ **Webhook user per agent** — mỗi agent (content-writer, editor, seo-optimizer) có Discord webhook riêng với avatar + tên |
| OD18 | Visual content trong articles | Text-only / agent gen ảnh / mix | ✅ **Mix**: bài có screenshot + infographic, agent gen OG image (Satori) + cover image (DALL-E/Flux) |
| OD19 | Số niche topics cuối | 4 chính / 4 + nhiều con / theo trend | ✅ **4 trụ chính + nhánh con expand theo trending**: news-curator agent suggest niche con khi rea trending topic |
| OD16 | Lucy → portal publish channel | Direct git push / API POST / hybrid | API POST + HMAC (no git access from agents) |

---

## 12. Reference index

### radiant-bot
- [`radiant-bot/CLAUDE.md`](../../radiant-bot/CLAUDE.md) — project rules + tech stack lockfile
- [`radiant-bot/HANDOFF.md`](../../radiant-bot/HANDOFF.md) — Phase 12.6 / 13 state
- [`radiant-bot/SPEC.md`](../../radiant-bot/SPEC.md) — full architecture spec
- [`radiant-bot/PROGRESS.md`](../../radiant-bot/PROGRESS.md) — full phase log Phase 0-12.6
- [`radiant-bot/src/utils/health.ts`](../../radiant-bot/src/utils/health.ts) — HTTP server + HMAC pattern
- [`radiant-bot/src/modules/aki/persona.ts`](../../radiant-bot/src/modules/aki/persona.ts) — 1500-line Aki persona
- [`radiant-bot/src/modules/llm/router.ts`](../../radiant-bot/src/modules/llm/router.ts) — LLM task routing
- [`radiant-bot/src/modules/events/tribulation.ts`](../../radiant-bot/src/modules/events/tribulation.ts) — current tribulation orchestrator
- [`radiant-bot/src/modules/events/games/math-puzzle.ts`](../../radiant-bot/src/modules/events/games/math-puzzle.ts) — math problem gen

### L.U.C.Y
- [`L.U.C.Y/README.md`](../README.md) — overview
- [`L.U.C.Y/HANDOFF.md`](../HANDOFF.md) — 2026-06-03 state
- [`L.U.C.Y/docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- [`L.U.C.Y/docs/BRIDGE_CLAUDE_CODE.md`](BRIDGE_CLAUDE_CODE.md) — `!c` design (legacy — `lucy_bridge.py` đã bypass Hermes)
- [`L.U.C.Y/docs/FEATURES.md`](FEATURES.md) — master feature list
- [`L.U.C.Y/docs/MONEY_PLAYBOOK.md`](MONEY_PLAYBOOK.md) — 3 kênh tiền (I1-I5)
- [`L.U.C.Y/docs/LOCAL_HUB.md`](LOCAL_HUB.md) — hub design
- [`L.U.C.Y/bridge/lucy_bridge.py`](../bridge/lucy_bridge.py) — production Telegram ↔ claude -p
- [`L.U.C.Y/hub/`](../hub/) — web cockpit (Express + Vite/React)

### Diff với existing docs
- **MONEY_PLAYBOOK.md I3 (Content Drafter)**: vision này upgrade từ "draft + manual publish" → **full pipeline 10 bài/ngày tự công khai**. Cần sync ngược lại I3 status sang `core` nếu Bill OK.
- **FEATURES.md §20 (Code/docs/content orchestration)**: vision này dùng Kanban worker lanes (đã `core` trong FEATURES) làm engine. **Khớp**.
- **HANDOFF.md "Future direction" Tier B item 4**: `POST /api/contribute` ready, `/api/agent/*` planned. Vision này commits to **WS-A unblock C1** trong Phase 15.0.

---

## Phụ lục — Quick reference

### A. Estimate tổng

| Phase | Workstreams | Effort | Khi nào nên ship |
|---|---|---|---|
| Phase 15.0 (foundation) | WS-A + WS-D | 1 tuần | NGAY — unblock mọi thứ |
| Phase 15.1 (agent capable) | WS-B + WS-C | 1.5 tuần | Sau 15.0 |
| Phase 15.2 (portal scaffold) | WS-E + WS-G | 1 tuần | Parallel 15.1 OK |
| Phase 15.3 (content live) | WS-F + WS-J | 1.5 tuần | Sau 15.0 + 15.2 |
| Phase 15.4 (tribulation v2) | WS-H | 1 tuần | Sau 15.1 + 15.2 |
| Phase 15.5 (course system) | WS-I | 1.5 tuần | Sau 15.2 |
| Phase 16.0 (in-browser IDE) | WS-K | 1 tuần | Sau v1 stable |

**Total Phase 15:** ~7 tuần với 1 dev + Claude Code (sonnet default, opus cho khó).

### B. First commit checklist

Khi bắt đầu Phase 15.0:

- [ ] Tạo issue/milestone trong radiant-bot: "Phase 15.0 — Foundation"
- [ ] Branch `phase-15.0-agent-foundation` trong radiant-bot
- [ ] Branch `harness-hardening` trong L.U.C.Y
- [ ] Update `radiant-bot/HANDOFF.md` Section "Pending" → reference VISION_2026.md WS-A
- [ ] Update `L.U.C.Y/HANDOFF.md` Section "PENDING" → reference VISION_2026.md WS-D
- [ ] Update `MEMORY.md` (Claude auto memory) ghi vision is locked

### C. Vision check trước mỗi PR

> Trước khi merge bất kỳ PR nào liên quan agent / portal / tribulation, Bill (hoặc reviewer) tự hỏi:
>
> 1. PR này thuộc workstream nào trong [§5](#5-workstream--phases-ship)?
> 2. Có pass success criteria của workstream đó không?
> 3. Có break giả thuyết kiến trúc trong [§4](#4-kiến-trúc-đích) không?
> 4. Có cần update VISION_2026.md không?
>
> Nếu trả lời "không biết" cho câu nào → STOP, đọc lại doc.

---

_Doc generated 2026-06-06 sau full audit 3 repo. Maintainer: Bill Truong. Lifeline: cập nhật mỗi khi workstream ship hoặc decision lock._
