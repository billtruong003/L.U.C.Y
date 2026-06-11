# Research — Hermes (Nous) · OmniRoute · Token-Opt · Future Agent Arch

> **Viết 2026-06-09** sau khi Bill yêu cầu nghiên cứu kĩ Hermes (NousResearch/hermesatlas),
> OmniRoute, + 2 repo skill, để áp dụng vào LUCY. Neo vào: [VISION_2026.md](VISION_2026.md) ·
> [REMOTE_CONTROL.md](REMOTE_CONTROL.md).
>
> ⚠️ **Lưu ý quan trọng:** "Hermes" ở đây = **Hermes Agent của Nous Research** (framework agent
> open-source, MIT) — **KHÁC** con "Hermes persona/middleware" mà LUCY đã bỏ (Mistral/Grok dispatcher).
> Đừng lẫn. Con này không phải bỏ — đáng học.

---

## 0. TL;DR — 1 đoạn + verdict

**Hermes Agent (Nous) gần như = đúng cái VISION_2026 của LUCY, nhưng đã build xong & chín hơn.**
Nó có: gateway đa nền (Telegram/Discord/Slack/WhatsApp/Signal), 6 terminal backend (local/Docker/SSH/
Singularity/Modal/Daytona), 40+ tool + MCP, cron scheduler, **vòng học kỹ năng tự cải thiện**
(self-improving skill loop), FTS5 session search + LLM summarize, user-modeling xuyên phiên. MIT.
→ **Đáng tiền ở chỗ:** nó là **bản tham chiếu kiến trúc** cho chính LUCY — đọc code nó để khỏi tự
phát minh lại bánh xe, **không phải** để thay LUCY (LUCY chạy `claude -p` bản quyền + tích hợp riêng
radiant-bot/portal, Hermes là framework chung).

**OmniRoute = trúng PHÓC 2 yêu cầu của Bill cùng lúc:** (1) "cắm API inject từ nhiều đầu nguồn trên
dashboard — multiagent proxy key", và (2) "optimize token". Nó là **local AI gateway** gom **177
provider** về 1 endpoint OpenAI-compatible, fallback 4 tầng, key vault mã hoá AES-256, multi-account
round-robin, **+ nén prompt 15–95% (avg 89%)** built-in. MIT, Next.js dashboard. → **Không phải build
từ 0** — fork/deploy OmniRoute làm "API layer" cho LUCY là đường tắt lớn.

**Verdict:** Steal kiến trúc Hermes (skill loop + gateway + memory), **deploy OmniRoute làm proxy
layer** thay vì tự viết, và nâng memory LUCY lên chuẩn 2026 (mem0/Letta-style + agentskills.io).

---

## 1. Hermes Agent (Nous Research) — đáng tiền chỗ nào

**Repo:** [github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) · MIT · Python 83% / TS 13%.
**Self-description:** *"the only agent with a built-in learning loop — creates skills from experience,
improves them during use, nudges itself to persist knowledge, searches its own past conversations,
builds a deepening model of who you are across sessions."*

### 1.1. Cái đáng học (steal vào LUCY)

| # | Tính năng Hermes | LUCY hiện có? | Hành động |
|---|---|---|---|
| S1 | **Skill learning loop** — agent tự tạo skill từ kinh nghiệm, tự cải thiện khi dùng, tự nudge để lưu | ❌ (LUCY có `agents/SKILL.md` tĩnh, người viết) | ⭐ **Cao nhất.** Cho agent fleet tự sinh + refine SKILL.md → đỡ Bill viết tay 7 persona |
| S2 | **Gateway abstraction** — 1 bộ slash-command chạy chung CLI + mọi nền nhắn tin, không branch theo nền | ⚠️ LUCY tách Telegram bridge vs hub vs (tương lai) Discord driver | Gom về 1 abstraction → REMOTE_CONTROL T4 "mặt tiền đa thiết bị" rẻ hơn |
| S3 | **Cross-session memory** — FTS5 search hội thoại cũ + LLM summarize + user model bền (Honcho-compatible) | ❌ LUCY session_id per chat, không search lịch sử | ⭐ Nâng `bridge` thêm FTS5 SQLite + `/insights` |
| S4 | **6 terminal backends** (local/Docker/SSH/Singularity/**Modal serverless**/Daytona) | ⚠️ LUCY = local + VPS worker | Modal/Daytona = "môi trường ngủ khi idle, thức khi cần" → hợp ý "worker nặng" của Bill |
| S5 | **Cron scheduler giao kết quả ra mọi nền** | 📋 LUCY P2 "cron 2×/ngày research → Discord Aki" chưa build | Hermes có sẵn pattern → copy |
| S6 | **Trajectory gen + compression cho training** | ❌ | Để dành — research-oriented, chưa cần |

### 1.2. Cái KHÔNG nên đổi sang

- **Đừng thay `claude -p` bằng Hermes core.** Triết lý LUCY (§4.2 VISION) là `claude -p` luôn là
  worker thật, bản quyền Claude Code (Opus/Sonnet), tích hợp sâu Telegram-approve/2FA/hub. Hermes là
  framework model-agnostic (200+ provider) — dùng nó làm **khung tham chiếu**, không nuốt trọn.
- **Đừng port toàn bộ sang Python framework của nó** — LUCY hub là Express/React/TS đã chạy. Lấy *ý
  tưởng* (skill loop, memory schema), không lấy *codebase*.

### 1.3. Hermes Atlas — mỏ vàng để đào tiếp
[hermesatlas.com](https://hermesatlas.com/) (source: `ksimback/hermes-ecosystem`) = **catalog
cộng đồng** 100+ tool/skill/plugin, 12 category, lọc chất lượng + security-review, update hằng tuần.
**Giá trị:** đào nhanh **memory providers** (mem0, GBrain, Hindsight, Mnemosyne), multi-agent
frameworks, deployment pattern — thay vì search GitHub mò. → Dùng Atlas làm "shopping list" cho
từng workstream LUCY.

---

## 2. OmniRoute — câu trả lời cho "multiagent proxy key dashboard" + token-opt

**Repo:** [github.com/diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute) · MIT · 5.9K★ ·
100% TS · Next.js 16 + React 19 + better-sqlite3 · 4690+ test.
**Một câu:** *local AI gateway* gom **177 provider** → **1 endpoint OpenAI-compatible**, "never phones home".

### 2.1. Vì sao đây ĐÚNG cái Bill muốn

Bill yêu cầu: *"cơ chế cắm API inject từ nhiều đầu nguồn API trên dashboard — sức mạnh của multiagent
proxy key."* OmniRoute đã có **nguyên xi**:

| Yêu cầu Bill | OmniRoute đáp ứng |
|---|---|
| Cắm nhiều nguồn API | **177 provider** (11 free-forever, 50+ free-tier, sub: Claude Code/Codex/Copilot/Cursor) |
| Dashboard quản key | Next.js dashboard + **AES-256-GCM** key vault, OAuth2 PKCE auto-refresh 8 provider |
| "Proxy key" multiagent | **Multi-account round-robin** (rải tải nhiều key), scoped API key per endpoint, cooldown per-key |
| Inject/route thông minh | **14 routing strategy** + Auto-Combo Engine (score 9 factor: health/quota/cost/latency/success…) |
| Bền khi 1 nguồn chết | **Fallback 4 tầng:** subscription → key → cheap → free; 3 circuit-breaker domain |
| Tiết kiệm tiền | Cost-aware routing, gom **~1.9B free token/tháng**, ước tiết kiệm $150–300/mo |

### 2.2. Token optimization built-in (trả lời luôn ý "optimize token")

OmniRoute có **compression pipeline** sẵn:
- **RTK** (tập trung output lệnh shell/build/git) → tiết kiệm **60–90%**
- **Caveman** (summarize văn bản chung) → ~30% mình nó
- **Stacked** (RTK+Caveman) → **78–95%** trên prompt hỗn hợp, **avg 89%** trên session nhiều tool
- **Bảo vệ:** code block / URL / JSON **không bị nén** (giữ chính xác)

> 📌 "kmen" Bill nhắc — mình hiểu là **Caveman-style compression** (nói cộc lốc kiểu người tiền sử để
> ít token). Nếu Bill ý khác (1 lib tên khác) thì ới, mình đào tiếp.

### 2.3. Cách áp vào LUCY (2 phương án)

**PA-A — Deploy OmniRoute nguyên con làm "API layer" của LUCY (khuyến nghị):**
```
LUCY agent fleet (claude -p / aki / content-writer …)
        │  gọi qua 1 endpoint OpenAI-compatible
        ▼
   OmniRoute (self-host trên VPS, ~/.omniroute, port 20128)
        │  route 4-tầng + nén RTK+Caveman + key vault
        ▼
   177 provider (Groq free, Gemini free, Claude, NVIDIA NIM, Cerebras…)
```
- **Lợi:** khỏi build dashboard key-management từ 0 (đỡ cả tháng), có sẵn nén token, fallback,
  multi-account. Hub LUCY chỉ cần **iframe/nhúng** dashboard OmniRoute hoặc gọi API quản nó.
- **Hợp triết lý "in-house, tận dụng lib open-source"** của [REMOTE_CONTROL.md](REMOTE_CONTROL.md) §1.
- **Caveat:** `claude -p` (Claude Code CLI) dùng auth Anthropic riêng — OmniRoute route được phần
  **API key** (Groq/Gemini cho Aki, content pipeline), còn `claude -p` worker giữ đường riêng. Tức
  OmniRoute lo **mảng API-key providers**, không thay Claude Code subscription lane.

**PA-B — Chỉ lấy module nén + ý tưởng routing, tự viết nhẹ trong hub.** Chỉ làm nếu PA-A nặng quá
2GB VPS. Khả năng cao PA-A ổn (SQLite + Node, nhẹ).

**→ Việc nên làm:** clone OmniRoute, chạy thử local, đo RAM trên box 2GB, quyết PA-A vs PA-B.

---

## 3. Token optimization — bức tranh đầy đủ 2026

Ngoài RTK/Caveman của OmniRoute, các lib đáng cắm:

| Tool | Cơ chế | Hiệu quả | Khi nào dùng cho LUCY |
|---|---|---|---|
| **LLMLingua-2** (Microsoft) | small-LM tính perplexity, bỏ token "đoán được" | tới **20×**, mất ~1.5 điểm acc; v2 nhanh 3–6× | Nén **prompt dài cố định** (persona 1500 dòng Aki, context tài liệu) trước khi gửi |
| **LongLLMLingua** | nén **question-aware** cho long-context | +21% perf, ÷4 token (NaturalQuestions) | RAG / khi Aki đọc nhiều bài để trả lời |
| **RTK + Caveman** (OmniRoute) | summarize output tool/shell | 60–95% | Tự động qua OmniRoute, không cần code |
| **mem0 token-efficient algo** (4/2026) | single-pass hierarchical extract + multi-signal retrieve | ~6.9k token/retrieval (LoCoMo) | Khi thêm memory layer (§5) |

**Chiến lược token cho LUCY (xếp ưu tiên):**
1. **Bật nén qua OmniRoute** (PA-A) → ăn ngay 60–90% cho agent fleet chạy tool nhiều.
2. **LLMLingua-2 hoá persona/SPEC tĩnh** (Aki 1500 dòng → nén) — đây là token lặp lại mỗi call, ROI cao.
3. **`--resume`/session cache** — *commit `75d12ae` incoming đã làm* ("agent KHỎI quét lại project").
4. **code=opus / check=sonnet split** — *commit `aa732c3` incoming đã làm* (chống lặp đốt token).
   → 2 cái này nằm trong 6 commit đang chờ pull (xem §6).

---

## 4. Skill repos — pattern tái dùng

- **[last30days-skill](https://github.com/mvanhorn/last30days-skill)** — research engine search đa nền
  (Reddit/X/YT/HN/Polymarket/GitHub), score theo *engagement thật* không SEO. **Pattern đáng lấy cho
  LUCY:** (a) BYO-keys (user tự cắm key), (b) entity-resolve trước khi search (đỡ call thừa), (c) xuất
  **HTML artifact self-contained** để share. → Hợp WS-F content pipeline + cron research Aki của VISION.
- **[awesome-finance-skills](https://github.com/rkiding/awesome-finance-skills)** (Apache-2.0) — 8 skill
  `alphaear-*` (news/stock/sentiment FinBERT/Kronos predictor/reporter). **Quan trọng hơn nội dung:** cả
  2 repo đều theo **chuẩn `agentskills.io`** — cùng chuẩn Hermes dùng cho skill. → LUCY nên **chuẩn hoá
  `agents/*/SKILL.md` theo agentskills.io** để skill từ cả ecosystem cắm thẳng vào.

---

## 5. Future agent architecture — nên tích hợp gì vào LUCY

Memory 2026 đã thành **first-class component** (có benchmark riêng, ecosystem riêng):

| Lớp | Lựa chọn | Vai trò trong LUCY |
|---|---|---|
| **User/preference memory** | **mem0** (21 framework, chuyên personalization) hoặc **Honcho** (như Hermes dùng) | Lucy nhớ Bill xuyên phiên: thói quen, dự án đang chạy, "chủ nhân" persona sâu hơn |
| **Self-editing agent memory** | **Letta (MemGPT)** — OS-style, agent tự quyết nhớ gì, paging in/out context | Cho agent fleet tự quản context dài (content pipeline 60 bài/ngày) |
| **Relational/temporal** | **Zep** — temporal knowledge graph | Theo dõi entity tiến hoá (member progress, quest state) — hợp UserProgress của VISION |
| **Procedural (skill)** | **agentskills.io SKILL.md** — kinh nghiệm "làm sao cho tốt" | = skill loop của Hermes (§1.1 S1) |

**Pattern multi-agent 2026 (xác nhận hướng LUCY đúng):**
- **Supervisor pattern** (1 main agent giữ plan, subagent bounded, mỗi cái context+budget riêng) = mặc
  định production 2026 → đúng `/orch` của LUCY.
- **Fan-out** parallel dispatch = đúng `/fan` của LUCY.
- **Dynamic workflows** (agent tự viết script orchestration rồi spawn fleet) = hướng tiến hoá của `/auto`.
→ **LUCY không lệch hướng.** Cái thiếu so với 2026 SOTA là **memory layer** (§5) + **skill loop** (§1.1).

---

## 6. Worker plans — note lại (Bill nhắc "note các dự định sắp làm worker")

Tổng hợp dự định worker rải trong các doc + memory:

1. **Coordinator↔Worker dispatch** ([REMOTE_CONTROL.md](REMOTE_CONTROL.md) §6, T3): worker local **quay
   ra** giữ WebSocket tới VPS (pattern Inngest Connect) → nhận job → chạy `claude -p` toàn quyền →
   stream về. State (queue/jobs/cost) ở VPS = nguồn sự thật. **Đã LIVE bản đầu:** pm2 `lucy-coordinator`
   + `lucy-vps-worker` (cap 2) trên VPS local-only [[agent-machine-vps-deploy]].
2. **Heavy worker local** (GPU, Unity dev) qua TLS subdomain — bước kế của agent-machine deploy.
3. **`claude -p` harness hardening** ([VISION_2026.md](VISION_2026.md) §9, WS-D): semaphore max-lane,
   retry backoff 429/500, per-task workspace isolation, **cost-ledger.jsonl**, Discord-driven input.
4. **Multi-worker = cắm thêm là native** (REMOTE_CONTROL §6) — worker registry ở VPS.

**Áp dụng research vào worker plans:**
- **OmniRoute đứng TRƯỚC worker** làm API gateway → mọi worker gọi chung 1 endpoint, fallback+nén tự động,
  cost-ledger lấy số từ OmniRoute thay vì tự parse (nó đã track per-token).
- **Hermes backend Modal/Daytona** (§1.1 S4) = mẫu cho "heavy worker ngủ-thức theo nhu cầu" — rẻ hơn
  giữ VPS chạy 24/7.
- **mem0/Letta** cho worker nhớ context project xuyên job → đỡ quét lại (cộng hưởng commit `75d12ae`).

---

## 7. Khuyến nghị — thứ tự làm (đề xuất)

```
Lát 1 (nhanh, ROI cao):  Clone+chạy OmniRoute local, đo RAM, quyết PA-A. Bật nén RTK+Caveman cho fleet.
Lát 2:                   Pull 6 commit chờ (đã có session-cache + opus/sonnet split — token-opt sẵn). [§ pull]
Lát 3:                   Chuẩn hoá agents/*/SKILL.md theo agentskills.io (mở cửa ecosystem skill).
Lát 4:                   Thêm memory layer: mem0 cho Lucy↔Bill, FTS5 session-search (copy Hermes).
Lát 5:                   Skill learning loop (Hermes S1) — agent tự refine SKILL.md.
Lát 6:                   OmniRoute thành API gateway chính thức trước worker fleet (cost-ledger lấy từ nó).
```

**3 thứ "đáng tiền" nhất rút ra:**
1. **OmniRoute** — đừng build proxy-key dashboard từ 0, fork con này. (tiết kiệm ~1 tháng + có nén token)
2. **Hermes skill-loop + memory** — chuẩn 2026 LUCY đang thiếu, copy ý tưởng (không copy code).
3. **agentskills.io chuẩn hoá** — để skill cả ecosystem (finance, research, …) cắm thẳng vào LUCY.

---

## 8. Sources

**Repos:** [hermesatlas.com](https://hermesatlas.com/) · [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) ·
[diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute) · [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) ·
[rkiding/awesome-finance-skills](https://github.com/rkiding/awesome-finance-skills)

**Token-opt:** [Morph — 8 compression techniques](https://www.morphllm.com/prompt-compression) ·
[LLMLingua 2026](https://tokenmix.ai/blog/llmlingua-prompt-compression-2026) ·
[LongLLMLingua paper](https://arxiv.org/pdf/2310.06839) · [Caveman/token-efficiency](https://trend.hulryung.com/en/posts/2026-04-06-0600-caveman-llm-token-efficiency-compression-fewer-tokens-inference-optimization/)

**Memory/arch:** [State of AI Agent Memory 2026 (mem0)](https://mem0.ai/blog/state-of-ai-agent-memory-2026) ·
[Mem0 vs Letta](https://vectorize.io/articles/mem0-vs-letta) · [Agent memory systems 2026](https://hermesos.cloud/blog/ai-agent-memory-systems) ·
[Multi-agent orchestration 5 patterns](https://www.digitalapplied.com/blog/multi-agent-orchestration-5-patterns-that-work) ·
[Claude Code subagents 2026](https://www.developersdigest.tech/blog/claude-code-agent-teams-subagents-2026)
