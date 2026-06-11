# LUCY — Roadmap to Peak (sprint plan)

> ⚠️ **SUPERSEDED 2026-06-10 — đọc [NORTH_STAR.md](NORTH_STAR.md) thay cho cái này.** Bill đã gác business,
> đổi sang focus hạ tầng Lucy (memory-first). Doc này GIỮ làm tham chiếu cho **business track (defer)** —
> portal/content/tribulation/course để mở lại sau khi M1–M5 của NORTH_STAR xong.

> **Viết 2026-06-09** sau research Hermes/OmniRoute ([RESEARCH_HERMES_OMNIROUTE_2026.md](RESEARCH_HERMES_OMNIROUTE_2026.md))
> + pull toàn hệ sinh thái. Neo: [VISION_2026.md](VISION_2026.md) · [REMOTE_CONTROL.md](REMOTE_CONTROL.md).
> Đây là **thứ tự đi tiếp + ước lượng ngày tới khi Lucy đạt peak**. Mỗi sprint độc lập tối đa, dep rõ.

---

## 0. Snapshot hiện trạng (sau pull 2026-06-09)

| Repo (canonical) | State | Note |
|---|---|---|
| **BillService/LUCY** `75d12ae` | hub W1/W2 UI live, agent-machine session-cache + opus/sonnet split, coordinator+worker pm2 LIVE (local-only) | bản đang dev |
| **BillService/radiant-bot** `e58d47e` | ⭐ **`/api/agent/*` HMAC API VỪA SHIP** (post-message + thread + create-channel) | = **WS-A DONE** |
| BillService/radiant-bot-backup | mirror backup | auto |
| D:/Project/radiant-bot + duel-radiant-arena | **stale 3 tuần** (phase-14.8) | bản cũ — bỏ, dùng BillService/ |
| D:/Project/* (Unity games, trading-bot, AITrain…) | ngoài scope não Lucy | = **target dev của worker** (REMOTE_CONTROL) |

**→ Đổi so với VISION:** blocker **C1 (Lucy↔Aki seam) đã thông phía bot**. Giờ chỉ cần verify hub→bot E2E + cho Aki tool-use. Và research thêm 2 đòn bẩy mới: **OmniRoute** (gateway+token-opt) và **memory/skill-loop**.

---

## 1. Logic ưu tiên (value × unblock ÷ effort)

```
ĐÒN BẨY CAO, RẺ        →  làm trước:  OmniRoute, verify WS-A, harness hardening
UNBLOCK NHIỀU THỨ      →  làm sớm:    Aki tool-use, memory+skill-loop, Discord bus
GIÁ TRỊ LỚN, NẶNG      →  giữa:       Portal + sandbox + content pipeline (cỗ máy tiền)
"WOW" + AN TOÀN CUỐI   →  sau:        remote desktop, course, hardening
```

Nguyên tắc: **đừng đụng portal (nặng) trước khi fleet rẻ + an toàn + có memory**. Đốt token là rủi ro số 1 (Bill từng cháy 4M tok/$1.1) → OmniRoute + harness phải đi đầu.

---

## 2. Sprints (ngày tích luỹ tính từ 2026-06-09)

> Ước lượng cho **1 dev + Claude Code**, nhịp Bill đang ship (W1/W2 vài ngày). Range = thận trọng→nhanh.
> "Ngày X–Y" = ngày làm tích luỹ (working days), không phải lịch.

### 🟢 SPRINT 1 — OmniRoute gateway cho lane API-key + token-opt  ·  Ngày 1–4  ·  **ROI cao nhất**
**Mục tiêu:** Mọi API-call **model-rẻ** (Aki, content fleet, narration, embedding) đi qua 1 endpoint rẻ + nén + fallback.
- Clone + chạy OmniRoute local, đo RAM trên box 2GB → quyết self-host VPS vs box riêng.
- Cắm key (Groq/Gemini/Cerebras free-tier), bật nén RTK+Caveman.
- Trỏ `aki-runner` + content-fleet (Llama/Gemini) qua OmniRoute endpoint.
- **⚠️ KHÔNG trỏ `claude -p` qua OmniRoute.** Verified 2026-06-09: Claude Code bắt buộc model Claude (route sang model free → agent vỡ tool-use/loop); proxy còn làm hỏng subscription OAuth → ép sang API-key đắt. **Giữ `claude -p` đi THẲNG Anthropic (subscription).** Token-opt cho lane Claude = `--resume` session-cache (đã ship) + opus/sonnet split (đã ship) + LLMLingua nén persona tĩnh.
- **Deliverable:** token/call lane-rẻ giảm 60–90% đo được; dashboard key sống. **2 lane tách bạch.**
- **Dep:** none. **Đáp ứng:** "multiagent proxy key" + "optimize token" của Bill — cho fleet content (cỗ máy tiền), không phải cho `claude -p`.

### 🟢 SPRINT 2 — Đóng vòng Lucy↔Aki + Aki tool-use (WS-B)  ·  Ngày 5–10
**Mục tiêu:** Lucy dispatch → Aki tự làm (post Discord, query store) — không cần human mỗi bước.
- Verify hub `/api/aki/*` → bot `/api/agent/*` HMAC chạy E2E (giờ bot đã có endpoint).
- Aki tool-use v1: `discord_post`, `discord_thread`, `store_query`, `claude_dispatch` (model qua OmniRoute → rẻ).
- Safety: per-tool rate-limit + approval gate + `aki_tool_log`.
- **Deliverable:** "Lucy bảo Aki đăng X" chạy tự động.
- **Dep:** S1 (model rẻ). **Unblock:** content pipeline, tribulation v2.

### 🟢 SPRINT 3 — Harness hardening (WS-D) + cost-ledger  ·  Ngày 11–14  ·  **chống cháy token**
**Mục tiêu:** Fleet chạy nhiều mà không đốt rate-limit/$$.
- Semaphore max-lane, retry backoff 429/500, per-task workspace isolation.
- `cost-ledger.jsonl` — lấy số token/cost **từ OmniRoute** (nó đã track) thay vì tự parse.
- Hub tab `/Cost` đọc ledger → aggregate per agent/day.
- **Deliverable:** không bao giờ cháy budget im lặng; thấy được fleet đốt bao nhiêu.
- **Dep:** S1.

### 🟡 SPRINT 4 — Memory layer + skill-loop (research mới)  ·  Ngày 15–21  ·  **nâng lên SOTA 2026**
**Mục tiêu:** Lucy NHỚ Bill + dự án xuyên phiên, agent tự cải thiện skill.
- **mem0** cho Lucy↔Bill (thói quen, dự án đang chạy) — persona "chủ nhân" sâu hơn.
- **FTS5 session search** + LLM summarize (copy Hermes) → `/insights`, agent khỏi quét lại.
- Chuẩn hoá `agents/*/SKILL.md` theo **agentskills.io** → skill ecosystem cắm thẳng.
- **Skill-loop v1** (Hermes S1): agent tự sinh/refine SKILL.md từ kinh nghiệm.
- **Deliverable:** Lucy không "quên"; agent giỏi dần. **Dep:** S1.

### 🟡 SPRINT 5 — Multi-agent Discord bus (WS-C)  ·  Ngày 22–26
**Mục tiêu:** Agent điều phối qua kênh Discord (message bus theo vision).
- Tạo `#agent-content-queue` / `-exercise-queue` / `-coordination` / `-error-log`.
- Aki router: parse `agent-message` JSON → dispatch stage kế (writer→editor→seo→publisher).
- Pipeline registry `agent-pipelines.json`.
- **Deliverable:** pipeline nhiều-stage chạy qua Discord. **Dep:** S2.

### 🟠 SPRINT 6 — Portal scaffold + sandbox + code-runner  ·  Ngày 27–35  ·  **nền money**
**Mục tiêu:** Học Phòng up khung + judge code chạy được.
- WS-E: Turborepo (Astro marketing + Next app + Hono api + Docker sandbox).
- WS-G: code judge sandbox (Docker per-exec, resource-limited).
- WS-K-lite: inline code-runner "Try it Yourself" trong article.
- **Deliverable:** portal hello-world deploy + chạy snippet Python/JS. **Dep:** none (chạy song song S4–S5 nếu đủ sức).

### 🟠 SPRINT 7 — Content pipeline + SEO (WS-F + WS-J)  ·  Ngày 36–46  ·  **cỗ máy traffic**
**Mục tiêu:** 30–60 bài/ngày tự động, SEO max.
- Fleet 5-stage (planner→writer→fact-check→code-validate→editor→seo→publish), bilingual VN+EN.
- SEO infra: sitemap, JSON-LD, OG-image gen, internal-link graph.
- Cost qua OmniRoute free-tier (Groq 7k req/day) → gần như $0.
- **Deliverable:** bài tự xuất bản hằng ngày, Google index. **Dep:** S2,S5,S6.

### 🔵 SPRINT 8 — Remote control core (R0–R2)  ·  Ngày 47–53  ·  **lái agent ở đâu cũng được**
**Mục tiêu:** Bill xem/lái fleet từ mọi thiết bị.
- R0: Headscale overlay + coturn fallback (local quay ra VPS).
- R1: worker local quay-ra hub (đã có pm2 coordinator+worker — chỉ nâng lên overlay).
- R2: xterm.js trong dashboard xem `claude -p` live.
- **Deliverable:** lái agent qua web/đth real-time. **Dep:** S3 (worker vững).

### 🔵 SPRINT 9 — Tribulation v2 + Course system (WS-H + WS-I)  ·  Ngày 54–63
**Mục tiêu:** Member học thật (code/English) + course community.
- `/breakthrough` → math|code|english, Aki gen problem → judge_run.
- Course CRUD + enrollment + community-contribute.
- **Deliverable:** member tiến bộ skill thật. **Dep:** S2,S6.

### 🟣 SPRINT 10 — Remote desktop "wow" + Tauri (R3–R5)  ·  Ngày 64–71
**Mục tiêu:** Điều khiển nguyên desktop Windows (Unity dev) từ xa, trễ thấp.
- R3: Sunshine (Windows, encode GPU) + Moonlight native qua overlay.
- R4: moonlight-web-stream (fork) nhúng dashboard → desktop trong browser/đth.
- R5: app Tauri bọc hub.
- **Deliverable:** code Unity từ điện thoại. **Dep:** S8. **Caveat:** cần GPU local (NVENC/AMF/QSV).

### 🟣 SPRINT 11 — Hardening + security + polish (R6 + WS-K-full)  ·  Ngày 72–77  ·  **khoá cửa**
**Mục tiêu:** An toàn cho hệ toàn-quyền-máy + IDE đầy đủ.
- Headscale ACL, audit log mọi phiên/job, secret hygiene, 2FA gate desktop/worker.
- WS-K-full: Monaco + xterm.js terminal persistent (StackBlitz WebContainer hybrid).
- **Deliverable:** production-grade, không hở cửa. **Dep:** tất cả.

---

## 3. Timeline → Peak

```
Ngày  1 ─────10────────20────────30────────40────────50────────60────────70──77
      │ S1 │  S2  │ S3│   S4    │ S5 │    S6     │     S7     │ S8 │  S9  │S10│S11│
      └OmniR┘ Aki  ledg memory  bus   portal+sbx  content+SEO  remote trib desktop hard
       gateway loop                                (MONEY)      core   course  wow
```

- **~77 ngày làm** (range thận trọng 65 → nhanh 85). Solo + Claude Code, ~5–6 ngày/tuần.
- **≈ 13–15 tuần ≈ 3–3.5 tháng** → **peak rơi vào khoảng giữa tháng 9 / đầu tháng 10 2026.**
- **Mốc tiền sớm:** hết Sprint 7 (~ngày 46, ~giữa tháng 8) portal đã ra bài/ngày + SEO → **bắt đầu có traffic/tiền trước khi tới peak.**
- **Mốc "dùng sướng" sớm:** hết Sprint 3 (~ngày 14) fleet rẻ+an toàn+đo được — đã đáng dùng hằng ngày.

**Cắt ngắn nếu muốn nhanh ra tiền:** S1→S2→S3→S6→S7 (bỏ tạm memory/bus/remote) ≈ **ngày 1–46** ra cỗ máy content. Remote/desktop/course làm sau.

---

## 4. Lucy của chúng ta sẽ đi đến đâu (peak ceiling)

**Peak Lucy = một "agent factory" cá nhân, tự cải thiện, điều khiển từ mọi nơi, tự nuôi mình bằng traffic.**

| Trục | Hôm nay | Peak |
|---|---|---|
| **Điều khiển** | Telegram + web hub (Bill mở máy) | Telegram/web/Moonlight/Tauri — lái cả fleet + **desktop Unity** từ điện thoại, mọi nơi |
| **Trí nhớ** | session per chat, quên | nhớ Bill + mọi dự án xuyên phiên (mem0), search được lịch sử (FTS5) |
| **Agent** | `/fan /orch /auto` worker tay | fleet self-improving (skill-loop), điều phối qua Discord bus, **rẻ 89% token** qua OmniRoute |
| **Đầu ra** | chat trả lời | **30–60 bài/ngày** tự xuất bản, SEO → traffic dev hằng ngày (refactoring.guru-class) |
| **Tiền** | $0, chỉ đốt | portal traffic + course + (về sau) ads/cert → **dòng tiền in-house** |
| **Cộng đồng** | Aki chat text | Aki agent tool-use, tribulation code/English, member tiến bộ thật |
| **Chi phí** | rủi ro cháy token | cost-ledger + fallback free-tier (~1.9B tok/tháng) → gần $0 vận hành |

**Trần thực tế (ceiling):** với 1 người + Claude Code, Lucy có thể trở thành **một studio nội dung + learning platform tự vận hành** mà Bill chỉ cần "ra lệnh từ điện thoại" — não ở VPS, tay ở máy local, đầu ra ở portal công khai. **Giới hạn không phải kỹ thuật mà là:** (1) chi phí infra khi scale traffic thật (cần nâng VPS/relay), (2) chất lượng content phải có editor-gate để không spam, (3) bảo mật cửa toàn-quyền-máy (Sprint 11 bắt buộc trước khi mở rộng).

**Nói gọn:** Lucy đi từ "*personal AI chat*" → "*đế chế agent 1 người vận hành*": tự viết nội dung, tự dạy cộng đồng, tự tối ưu chi phí, và Bill điều khiển toàn bộ từ trong túi quần.

---

## 5. Hướng làm — chốt

1. **Canonical = `BillService/{LUCY, radiant-bot}`.** Bỏ bản D:/Project (stale 3 tuần). D:/Project/* (Unity, trading-bot) = **target dev của worker**, không phải não.
2. **Bắt đầu NGAY Sprint 1 (OmniRoute)** — đòn bẩy lớn nhất, rẻ, đáp đúng 2 yêu cầu Bill vừa nêu.
3. **Đừng nhảy vào portal trước Sprint 6** — fleet phải rẻ+an toàn+nhớ trước.
4. Mỗi sprint xong → cập nhật [VISION_2026.md](VISION_2026.md) §5 phase-ordering cho khớp.
