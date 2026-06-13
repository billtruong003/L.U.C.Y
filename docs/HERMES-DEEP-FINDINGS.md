# Hermes — nghiên cứu sâu (vòng 2) + Web UI

> **Viết 2026-06-13.** Vòng 1 = [STEAL_FROM_HERMES.md](STEAL_FROM_HERMES.md) (skill-loop, FTS5, cache parity,
> cron, sub-agent — phần engine/learning). Vòng 2 này theo ý chủ nhân: Hermes còn **bắt được thinking**,
> **cắm được nhiều model** (opencode...), **đổi model/persona cho CHAT** — đúng mấy thứ Lucy đang THIẾU ở
> tầng giao tiếp (bridge), không phải tầng engine. Cộng nghiên cứu **hermes-webui** (nesquena/hermes-webui).

---

## A. Mấy thứ Hermes làm sâu hơn ta tưởng (chủ nhân nói đúng)

### A1. Cắm nhiều model qua "Provider Profile" (declarative)
Hermes `providers/base.py`: 1 class `ProviderProfile` **khai báo TẤT CẢ về 1 provider ở một chỗ** —
auth, endpoint, quirk request-time (vd Kimi bỏ temperature, OpenCode Zen WAF chặn UA mặc định → cần
`hermes-cli/<ver>` UA). Transport đọc profile thay vì nhận "20+ boolean flag". Thêm provider = thêm 1
profile, KHÔNG sửa core.
- **Lucy hiện:** `llm-lane.ts` có `PROVIDERS` map (openrouter/groq/gemini/cerebras/mistral/opencode-zen/zai)
  + `MODEL_CATALOG` — NHƯNG chỉ dùng cho **executor card** (lane rẻ). **Bridge chat** (`lucy_bridge.py`)
  HARDCODE `claude -p --model sonnet|opus` → **chat KHÔNG cắm được opencode/deepseek/model khác**.
- **Gap:** chủ nhân muốn "cắm opencode vào" cho CHAT → cần tách model-chat khỏi việc khoá cứng claude.

### A2. Đổi model / persona cho CHAT lúc chạy (`/model`, profile)
Hermes: `/model <name>` đổi model ngay, không restart; **profile = persona** (mỗi profile có config riêng:
provider + model + endpoint tuỳ chọn như Ollama/LMStudio), clone từ profile đang active, đổi mượt 0 downtime.
- **Lucy hiện:** bridge chỉ 1 `persona.md` cố định + model sonnet/opus. KHÔNG có lệnh đổi model/persona
  giữa chừng cho chat. (agent-machine CÓ nhiều persona JSON nhưng đó là cho CARD, không phải chat Telegram.)
- **Gap:** chủ nhân muốn "đổi model chat / đổi persona chat" → bridge cần: (1) lệnh `/model`, `/persona`,
  (2) map chat_id → {model, persona} giữ qua phiên, (3) route sang llm-lane khi model ≠ claude.

### A3. Bắt "thinking" (reasoning block) — Hermes làm rất kỹ
`agent/think_scrubber.py`: **state-machine suppress tag `<think>` theo từng delta stream** (vì regex per-delta
phá state → leak reasoning ra user). Giữ lại tag chẻ đôi ở ranh giới delta tới khi delta sau resolve. WebUI
hiển thị reasoning trong **card vàng** tách biệt chat thường (Claude extended thinking, o3 reasoning tokens).
- **Lucy hiện:** `runner.ts parseClaude` chỉ lấy `result`, bỏ qua thinking. Bridge không stream, không bắt.
- **Gap:** muốn "thấy Lucy suy nghĩ" → cần (1) bật thinking ở claude -p / provider, (2) tách block thinking
  khỏi reply, (3) hiển thị riêng (Telegram: gửi như 1 đoạn "💭 em đang nghĩ…" hoặc Hub: card riêng).

---

## B. hermes-webui (nesquena/hermes-webui) — kiến trúc & ý đáng học

**Là gì:** web UI self-host cho Hermes Agent, **gần parity với CLI**, chạy in-browser, vào qua SSH tunnel/
Tailscale. KHÔNG thay agent — nó NÓI CHUYỆN với agent (đọc state/config trực tiếp, trigger run qua gateway).

**Stack (đáng chú ý — rất nhẹ):**
- FE: **Vanilla JS, KHÔNG framework, KHÔNG build step**. CSS theme system. Prism.js (highlight). Web Speech API (voice).
- BE: **Python stdlib HTTP server**, import thẳng module Hermes. Multi-provider (OpenAI/Anthropic/Google/DeepSeek/OpenRouter...).
- State ở `~/.hermes/webui/`. Docker optional (single/multi-container).
- ~7.150 pytest / ~700 file test. 190+ contributor.

**Layout 3 cột:** sessions (trái) · chat (giữa) · workspace (phải). Composer footer luôn hiện: model · profile ·
workspace · context-ring (token dạng vòng tròn).

**Tính năng đáng lấy cho Hub Lucy:**
- **Thinking/reasoning card vàng** — tách reasoning khỏi reply (A3).
- **Tool-call card** inline (expand/collapse, "expand all") + **subagent** icon riêng + viền thụt lề.
- **Approval card**: lệnh nguy hiểm bắt allow/deny/session/always (HITL đẹp — ta đang làm gate thô hơn).
- **Profile dropdown** ở composer = đổi model/persona ngay (A2) + gateway status indicator.
- **Workspace panel**: cây thư mục + preview + sửa file inline + git branch + dirty count.
- **Session**: rename/archive/duplicate/pin/tag màu + token-cost mỗi hội thoại + export/import JSON.
- **Streaming qua SSE** (ta đang request-response 1 phát; SSE cho cảm giác sống).
- **Mobile**: hamburger sidebar, touch ≥44px — Hub ta nên test mobile.

**Setup ref:** `python3 bootstrap.py` / `./start.sh` / `./ctl.sh start|status|logs|stop` / Docker `:8787`.
Env: `HERMES_WEBUI_PORT/HOST/STATE_DIR/PASSWORD`, `HERMES_HOME`. Health: `GET /health`.

**Khác biệt triết lý so với Hub Lucy:** webui = **vanilla JS, no-build, bám sát state agent**. Hub Lucy =
React + vite (đẹp, nhưng nặng hơn, phải build). Bài học: webui ưu tiên **parity + tốc độ phát triển** hơn
khung xịn. Không cần đổi stack — nhưng học cách **composer footer (model/profile/context) + card thinking/tool/approval**.

---

## C. Việc Lucy nên làm (xếp ưu tiên — CHỜ chủ nhân chốt, chưa làm)

1. **Multi-model CHAT cho bridge** (chủ nhân ưu tiên: "cắm opencode"). Tách model-chat khỏi claude cứng:
   bridge route → `llm-lane.ts` khi model ≠ claude. Lệnh `/model <key>` (dùng MODEL_CATALOG sẵn có).
   ⚠️ Lưu ý: claude -p (não, có tool+vault) ≠ lane (chat thuần, không tool sâu) — cần rõ "model nào làm được gì".
2. **Đổi persona chat** (`/persona <id>`) — map chat_id → persona, swap `--append-system-prompt-file`.
3. **Thinking capture** — bật + tách + hiển thị (Telegram đoạn 💭 / Hub card vàng).
4. **Provider Profile hoá** llm-lane (declarative như Hermes) — gom quirk (UA, omit-temp, retry) về 1 chỗ → cắm provider mới dễ.
5. **Hub mượn UI:** composer footer (model/profile/context-ring) + thinking/tool/approval card + SSE streaming.

> **Note neo:** vòng 1 (engine/learning) phần lớn đã làm (C1–C4: brain per-agent, win/miss, dream, verify-gate,
> triage, token-guard). Vòng 2 (tầng GIAO TIẾP: multi-model chat, persona chat, thinking, UI parity) còn TRỐNG —
> đây là "chất liệu cần học thêm" chủ nhân nói. Prompt-cache parity (STEAL #1) vẫn nợ.
