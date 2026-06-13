# Orchestrator streaming + đỡ tốn token (cách làm)

> **Viết 2026-06-13.** Vấn đề chủ nhân nêu: `claude -p` chạy orchestrator/chat *lâu (spawn CLI) + KHÔNG streaming*
> → UX cấn. Có Nous Portal key (aggregator OpenAI-compat, 265 model). Đây là cách sửa.

## Phát hiện then chốt (test thật)
- Nous key chạy được, endpoint `https://inference-api.nousresearch.com/v1` (OpenAI-compat).
- **Streaming SSE chạy ngon** (`stream:true` → delta content + delta `reasoning` realtime) → UX live khả thi.
- ⚠️ **Account Nous đang $0 credit** → CHỈ model `:free` chạy ngay (Nemotron Ultra 550B free — đã test HTTP 200).
  Claude/Hermes/DeepSeek-pro *qua Nous* trả 404 "requires credits" → cần nạp tại portal.nousresearch.com.

## Vì sao `claude -p` cấn
`claude -p` = spawn CLI subprocess mỗi lượt: (1) khởi động chậm (~giây), (2) `--output-format json` = ĐỢI XONG mới
trả (không token-by-token), (3) đốt token Claude full giá. Orchestrator (`orch_run`/`auto_run`) gọi nó cho MỌI bước
(plan + N sub-agent + synthesis) → nhân chi phí + chậm + im ru tới khi xong.

## Làm cách nào (2 phần)

### Phần 1 — STREAMING (sửa UX "im ru")
- Thêm `callLLMStream(model, messages, onDelta)` vào llm-lane: parse SSE, gọi `onDelta(text, kind)` mỗi chunk
  (kind = 'content' | 'reasoning'). (Hạ tầng đã có — chỉ thêm nhánh `stream:true` + đọc body stream.)
- Bridge: thay vì đợi xong, **edit message Telegram dần** (editMessageText mỗi ~0.8s với text tích luỹ) → chữ chạy
  realtime trên Telegram. (Hub sau này = SSE thật.)
- Bonus: delta `reasoning` → hiện 💭 sống (A4 nâng cấp).

### Phần 2 — ĐỠ TỐN TOKEN (orchestrator dùng model rẻ + claude-via-Nous)
Quan trọng: `claude -p` KHÔNG chỉ là gọi LLM — nó là **vòng lặp agentic CÓ TOOL** (Read/Write/Bash/Web) + vault.
Gọi LLM trần (Nous/SDK) sẽ MẤT tool. Nên tách theo bước:
- **Bước KHÔNG cần tool** (plan, synthesis, chat hỏi-đáp): → lane streaming (Nemotron free / Claude-via-Nous).
  Rẻ hơn nhiều + streaming. Đây là phần lớn token orchestrator đốt phí.
- **Bước CẦN tool** (sub-agent sửa file/chạy lệnh): GIỮ `claude -p`, HOẶC dùng **lane tool-loop có sẵn**
  (`callLLMRaw` + LaneRunner read/write/edit/bash) trỏ vào model rẻ. Lucy ĐÃ có cơ chế này.

→ Kết quả: orchestrator plan+synthesis chạy streaming trên model rẻ/free; chỉ phần đụng-tool mới dùng Claude.
Tiết kiệm lớn + UX sống.

## "Claude SDK cắm thẳng" — làm rõ
Không cần Anthropic SDK riêng: qua Nous (OpenAI-compat) gọi `anthropic/claude-opus-4.8-fast` với `stream:true`
trên HTTP thường = "Claude xịn + streaming + rẻ hơn CLI", *thống nhất với llm-lane*. Điều kiện: nạp credit Nous
(hiện $0). Nếu không nạp → dùng Nemotron Ultra free (chạy ngay, chất lượng dưới Claude một bậc).

## Quyết định cần chủ nhân chọn
- **A. Nạp credit Nous** → orchestrator chạy Claude-via-Nous (chất lượng Claude + streaming + rẻ hơn CLI). Tốt nhất.
- **B. Xài free luôn (chưa nạp)** → orchestrator plan/synthesis chạy Nemotron Ultra free streaming ($0), phần
  đụng-tool vẫn claude -p. Test được ngay, $0.
Em đề xuất router/orchestrator default = `nous-nemotron-free` (đặt `LUCY_ROUTER_MODEL=nous-nemotron-free`) tới khi nạp credit.

## Việc em sẽ code (nếu chủ nhân duyệt)
1. `callLLMStream()` + parse SSE (content + reasoning).
2. Bridge: chat/orch dùng stream → edit Telegram dần (chữ chạy).
3. `orch_run`/`auto_run`: plan+synthesis → lane streaming; sub-agent tool → giữ claude -p (hoặc lane tool-loop).
4. Smoke: parse SSE delta (mock), tách content/reasoning.
