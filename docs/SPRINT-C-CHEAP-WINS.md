# Đợt C — Cheap Wins: cache parity + recall + aux router + curator (thiết kế)

> **Viết 2026-06-13.** Mục tiêu: mấy món CÔNG SỨC THẤP nhưng LỜI LỚN — tiết kiệm token + recall xuyên phiên.
> Neo: [HERMES-GAP-MATRIX.md](HERMES-GAP-MATRIX.md) tầng 4+5+2.5 · [STEAL_FROM_HERMES.md](STEAL_FROM_HERMES.md).

## Mục tiêu Đợt C (4 card)

- **C1. Prompt-cache parity** — giữ prefix system-prompt byte-identical → trúng prefix cache (~25% rẻ). NỢ từ trước, C1/C4 vừa làm hỏng.
- **C2. FTS5 session recall** — tra "việc này làm chưa?" 0-token xuyên phiên.
- **C3. Auxiliary client router** — side-task (distill/salvage/summarize) tự lấy model rẻ nhất sẵn có (1 chỗ).
- **C4. Curator não-nghề** — lifecycle dọn Brain/agents/ (stale→archive), không phình.

---

## C1 — Prompt-cache parity ⭐ ROI cao nhất, rẻ

**Vấn đề (nợ + tự gây):** Anthropic prefix-cache chỉ trúng khi đầu prompt BYTE-IDENTICAL giữa các lần. Hermes ghi nhận
**~26% giảm chi phí** chỉ nhờ kỷ luật này. NHƯNG `buildSystemPrompt` (runner.ts) hiện nối:
`readActiveDigest() + readAgentBrain(persona.id) + loadSkillBlock(card) + persona.systemPrompt + HOUSE_SKILL + OUTCOME_CONTRACT`
→ `readActiveDigest` (active.md đổi theo dream) + `readAgentBrain` (đổi mỗi khi học/đúc kết) nằm Ở ĐẦU → **prefix đổi xoành xoạch = cache MISS mỗi stage.**

**Thiết kế:**
- **Đảo thứ tự:** phần TĨNH lên đầu (cache được): `HOUSE_SKILL + OUTCOME_CONTRACT + persona.systemPrompt` (ổn định) →
  rồi mới phần ĐỘNG ở cuối: `loadSkillBlock + readAgentBrain + readActiveDigest`. Prefix tĩnh dài → cache trúng phần lớn.
- **Tách cache breakpoint:** nếu dùng Anthropic cache_control → đặt mốc cache SAU khối tĩnh, trước khối động.
- **Khử timestamp/volatile:** đã strip "Cập nhật:" trong active.md — rà thêm mọi chỗ chèn ngày/giờ/đếm vào prefix.
- **Đo:** log `cache_read_input_tokens` từ response claude -p trước/sau → chứng minh % cache tăng.

**DoD:** cùng persona chạy 2 stage → `cache_read_input_tokens` > 0 và tăng rõ so với trước; smoke so byte prefix tĩnh giữa 2 lần build.

## C2 — FTS5 session recall

**Thiết kế (crib `hermes_state.py` + `session_search_tool.py`):**
- `better-sqlite3` đã có → thêm bảng FTS5 (unicode + trigram cho tiếng Việt) index: card title/brief/reports + session-note.
- 1 tool `recall(query)` 3 mode: DISCOVERY (FTS5 → top-N + snippet ±N + bookends 3 đầu/3 cuối), SCROLL (±window quanh 1 id), BROWSE (gần đây).
- Lucy/agent gọi trước khi làm: "đã làm task tương tự chưa?" → 0 token LLM, chỉ SQL.

**DoD:** index vài card cũ → `recall("multi-model chat")` trả đúng card + snippet; tiếng Việt có dấu tìm được (trigram). Smoke SQL thuần.

## C3 — Auxiliary client router

**Vấn đề:** distill hardcode 'haiku', salvage 'sonnet' — không tận dụng free lane sẵn, không 1 chỗ quản.

**Thiết kế (crib `auxiliary_client.py`):**
- 1 hàm `auxModel(task: 'classify'|'summarize'|'distill'|'extract')` → trả model key tốt-nhất-sẵn-có theo bảng benchmark §4 + rate-guard (B1) + quota (B3).
- Side-task ưu tiên FREE (gemini-flash/groq) thay vì đốt claude haiku; chỉ rớt về claude khi free guard hết.
- Nối Đợt A/B: dùng chung MODEL_CATALOG + rate-guard + quota.

**DoD:** distill/salvage gọi qua `auxModel` → log dùng free model khi sẵn; free nghẽn → rớt claude haiku an toàn.

## C4 — Curator não-nghề (lifecycle)

**Vấn đề:** `Brain/agents/<id>.md` chỉ tích + đúc kết (C4 cũ); chưa có dọn bài CŨ/không-còn-đúng.

**Thiết kế (crib `curator.py` — pure, no-LLM):**
- Mỗi rule có ngày (đã có nhãn `[... · YYYY-MM-DD]`). Lifecycle theo thời gian + tần suất trúng:
  active → stale (lâu không liên quan) → archived (chuyển `Brain/agents/_archive/<id>.md`, KHÔNG xoá).
- Chạy trong dream-cli (đã nối consolidate ở C4 cũ) — thêm bước curate, no-LLM, rẻ.
- Giữ rule "đúc kết" (class-level) lâu hơn rule thô.

**DoD:** rule cũ quá ngưỡng ngày → chuyển _archive; brain active gọn lại; archive vẫn đọc được (không mất). Smoke deterministic.

---

## Thứ tự + rủi ro
1. **C1 trước** (lời lớn nhất, đang lỗ vì C1/C4 cũ) → 2. C3 (rẻ, bổ trợ A/B) → 3. C2 (FTS5) → 4. C4 (curator).
- **Rủi ro C1:** đảo thứ tự prompt có thể đổi nhẹ hành vi agent (digest xuống cuối) — test smoke + theo dõi rework rate.
  Đừng hy sinh chất lượng để lấy cache: nếu digest ở cuối làm agent bỏ qua → cân lại (có thể nhắc lại ngắn ở cuối).
- **Rủi ro C2:** trigram tiếng Việt cần cấu hình tokenizer đúng — test có dấu.
- **Đo:** C1 = % cache_read tăng + $/card giảm; C2 = số lần "giải lại việc cũ" giảm; C3 = $ side-task giảm; C4 = size brain ổn định.

> Sau A+B+C: Lucy = đa model chat + router thông minh + free chạy bền + token rẻ hẳn + nhớ xuyên phiên.
> Còn lại Đợt D (UI/scale: Hub composer+SSE, batch+checkpoint, context compressor) — để sau cùng.
