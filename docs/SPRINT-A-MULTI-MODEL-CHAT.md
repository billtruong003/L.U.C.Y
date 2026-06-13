# Đợt A — Multi-model CHAT + Smart Routing (thiết kế)

> **Viết 2026-06-13.** Chốt từ chủ nhân: làm tầng GIAO TIẾP — cắm model tự do cho chat (opencode...),
> đổi model/persona giữa phiên, + **smart-routing** (auto mode tự chọn model). Neo:
> [HERMES-GAP-MATRIX.md](HERMES-GAP-MATRIX.md) (tầng 1) · [MODEL-BENCHMARK.md](MODEL-BENCHMARK.md) (chọn model).
> Nguyên tắc giữ: claude -p (não, tool+vault) đi THẲNG Anthropic; lane = chat model rẻ qua llm-lane.

## Mục tiêu Đợt A (4 card)

- **A1. Multi-model chat** — bridge chat chạy được model bất kỳ trong MODEL_CATALOG, không chỉ claude.
- **A2. Đổi model/persona runtime** — lệnh `/model`, `/persona`; nhớ theo chat_id, bền qua phiên.
- **A3. Smart routing (auto mode)** — 1 model-router free đọc task → tự chọn model thực thi (chủ nhân chỉ định con router).
- **A4. Thinking capture** — bắt & hiện reasoning (Telegram đoạn 💭 / Hub card).

---

## A1 — Multi-model chat

**Vấn đề:** `bridge/lucy_bridge.py::run_claude` hardcode `claude -p --model opus|sonnet`. llm-lane.ts có 7 provider
nhưng chỉ executor-card dùng. Chat không chạm tới.

**Thiết kế:**
- Phân loại 2 đường rõ ràng:
  - **claude-path** (mặc định): `claude -p` — có tool thật + vault + web. Dùng khi cần LÀM VIỆC (đọc/sửa file, research).
  - **lane-path** (mới cho chat): gọi `llm-lane` (OpenAI-compat) — chat thuần, KHÔNG tool sâu. Dùng khi chỉ hỏi-đáp/nội dung và muốn model khác (opencode/deepseek/gemini).
- Bridge thêm hàm `run_lane(prompt, model_key, history)` gọi coordinator endpoint mới `/chat-lane` (TS, dùng llm-lane sẵn có) → tránh viết lại provider trong Python.
- ⚠️ Nói rõ với chủ nhân khi đổi sang lane: "model này chat thuần, không sửa file được" (tránh kỳ vọng sai).

**DoD:** gõ `/model ds-v4-flash-free` rồi chat → câu trả lời đến từ DeepSeek (log model thật), không phải claude.

## A2 — Đổi model / persona runtime

**Thiết kế:**
- State per chat_id: `{model_key, persona_id}` lưu file (`~/.lucy/chat-prefs.json`) — bền qua restart bridge.
- Lệnh:
  - `/model <key>` — set model (validate trong MODEL_CATALOG; `claude`/`opus`/`sonnet` = về claude-path).
  - `/model` (không arg) — liệt kê catalog + đánh dấu con đang dùng.
  - `/persona <id>` — swap `--append-system-prompt-file` (claude-path) hoặc system message (lane-path). Persona lấy từ `config/personas/` + persona chat mặc định.
  - `/persona` — liệt kê persona.
- Default vẫn = claude + persona Lucy (không phá hành vi hiện tại).

**DoD:** đổi `/persona reviewer` → giọng/khung đổi; restart bridge → vẫn nhớ; `/model` hiện danh sách.

## A3 — SMART ROUTING (auto mode) ⭐ (chủ nhân thêm)

**Ý chủ nhân:** trong auto mode, dùng 1 model **free nhưng giỏi hiểu context** làm ROUTER — nó đọc task rồi
QUYẾT giao model nào thực thi. Chủ nhân **chỉ định** con router. Quyết định dựa trên benchmark (đã crawl).

**Con router (từ [MODEL-BENCHMARK.md](MODEL-BENCHMARK.md) §3) — ⭐ chủ nhân lean Nemotron/DeepSeek, CHỐT SAU:**
- Mặc định (lean chủ nhân): **`or-nemotron-super`** (1M ctx + agentic reasoning → route đúng hơn dù chậm hơn) hoặc **`ds-v4-flash-free`** (reasoning đa bước).
- Router nhanh khi tải cao: **`groq-gptoss-120b`** (latency thấp).
- Fallback 429: **`gemini-flash`**.
- Đổi qua env `LUCY_ROUTER_MODEL` → không khoá cứng, chủ nhân thử con nào cũng được.
- Lý do chấp nhận router chậm: route SAI (giao nhầm con cùi) đốt token downstream nhiều hơn 1 router-call chậm. Bù bằng cache-quyết-định-theo-loại-task.

**Luồng auto mode:**
```
task → ROUTER (groq-gptoss-120b) đọc: {brief, loại việc, độ to, có cần tool?}
     → trả JSON: {role, model_key, reason, needs_tools}
     → map role→model qua bảng §4 benchmark (router có thể override nếu rõ lý do)
     → nếu needs_tools=true → ép claude-path (chỉ claude có tool thật)
     → else chạy lane model_key
     → log quyết định (model + reason) cho minh bạch
```

**Prompt router (định hướng, KHÔNG bias model):**
- Cho router xem: brief task + bảng role→model (§4) + ghi chú điểm mạnh từng con.
- Bắt trả JSON `{role, model_key, reason, needs_tools, confidence}`.
- Router KHÔNG được chọn model ngoài catalog; thấp confidence → chọn default an toàn.

**Chống số liệu mốc:** router đọc bảng benchmark (file), không hardcode. Bảng tự cập nhật qua cron-crawl (§5 benchmark)
+ live-signal (model hay 429/timeout/bị rework → engine hạ ưu tiên). Nối token-guard + verify-gate sẵn có.

**An toàn/chi phí:** router là 1 call free ngắn (đọc brief, không đọc cả repo) → rẻ. Cache quyết định theo (loại task)
để không route lại mỗi lần. Auto mode mới bật router; chat tay vẫn theo `/model`.

**DoD:** bật auto → log hiện "router chọn devstral-med cho task coding vì SWE-bench cao + needs_tools=false";
task cần sửa file → router ép claude-path; đổi con router bằng env `LUCY_ROUTER_MODEL`.

## A4 — Thinking capture

**Thiết kế:**
- claude-path: claude -p hỗ trợ reasoning → tách block thinking khỏi `result` (state-machine kiểu Hermes
  `think_scrubber` nếu stream; bản non-stream chỉ cần regex tách `<think>...</think>` / field reasoning).
- lane-path: provider trả `reasoning_content` (DeepSeek/GLM...) → tách riêng.
- Hiển thị: Telegram = gửi 1 đoạn `💭 (suy nghĩ) ...` rút gọn TRƯỚC câu trả lời (tuỳ chọn bật/tắt `/think on|off`);
  Hub = card riêng (mượn webui card vàng — để Đợt D nếu Hub).

**DoD:** model có reasoning → chủ nhân thấy đoạn 💭 tách khỏi câu trả lời chính; `/think off` thì ẩn.

---

## Thứ tự làm + rủi ro

1. A1 (nền: lane-path cho chat) → 2. A2 (lệnh đổi) → 3. A3 (router, cần A1) → 4. A4 (thinking).
- **Rủi ro:** lane chat KHÔNG có tool/vault → phải nói rõ, tránh chủ nhân tưởng Lucy "quên" não. Router sai → luôn có
  default an toàn + log lý do để chỉnh. claude-path GIỮ NGUYÊN đường thẳng Anthropic (không route qua proxy).
- **Đốt token:** router free nên rẻ; nhưng auto-mode chạy nhiều → cache quyết định theo loại task.

> Cần chủ nhân chốt: (a) con router mặc định (em đề xuất groq-gptoss-120b — đổi được qua env), (b) Đợt A có gồm A4 thinking
> luôn hay tách ra sau A1-A3.
