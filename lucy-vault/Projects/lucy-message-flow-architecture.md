# Lucy — Bức tranh flow xử lý tin nhắn (message → answer) + kiến trúc chuẩn

> Tài liệu thiết kế. Vẽ flow THẬT hiện tại của bridge/coordinator + verify yếu điểm cách chủ nhân mô tả + kiến trúc standard.
> Nguồn đọc: `bridge/lucy_bridge.py`, `agent-machine/src/coordinator.ts`, `session-summary.ts` (2026-06-19).

## 1. Pipeline thật hiện tại — 8 trạm

```
[1 INGRESS]   Telegram update → lucy_bridge.py (getUpdates qua WARP proxy)
   │
[2 ROUTE]     /new /stop /token /lane... ; chọn claude-path vs lane-path
   │
[3 RECALL]    recall_prefetch(text) → POST coordinator /recall {q, limit:5}
   │          → hybrid FTS5 + vector (Jina v5-omni-nano 768) + episodic turns
   │          → trả khối "🧠 Trí nhớ liên quan"
   │
[4 ASSEMBLE]  prompt = persona + 🧠memory + seed(summary phiên trước) + buffer + tin nhắn
   │
[5 REASON]    Claude Agent SDK in-process (tool fs/web/bash) → suy nghĩ + hành động
   │
[6 RESPOND]   stream answer về Telegram
   │
[7 PERSIST]   report_tokens() vào token-guard ; POST /episodic ghi turn (async fire-forget)
   │          ; claude_hist_append() đẩy vào buffer + cộng counter
   │
[8 COMPACT]   should_compress? → _summarize_transcript(buffer, seed_cũ)
              → writeSessionSummary() append JSONL Brain/episodes/sessions-<chat>.jsonl
              → mở "phiên" mới seed = summary (rolling-compact)
```

Trạm 3 + 8 chính là 2 lớp trí nhớ: **recall (đọc vào)** và **session summary (ghi ra, xuyên phiên)**.

## 2. So với flow chủ nhân mô tả

Chủ nhân vẽ: `tin nhắn → AI tra vault → vault+xuyên phiên+context → đọc rồi suy nghĩ → trả lời → compact khi vượt ngưỡng`.

Khớp về tinh thần. 3 chỗ cần chỉnh nhận thức:

- **"AI tra vault"** — hiện KHÔNG dùng 1 LLM-call để tra. Tra bằng retrieval RẺ (FTS5 + vector). Đây là cái ĐÚNG chuẩn. Nếu đổi sang "AI quyết tra gì mỗi lượt" = thêm 1 lượt model/turn → chậm + đốt token. Chỉ nên agentic-retrieval khi câu hỏi mơ hồ.
- **"compact"** chủ nhân nói thực ra là **2 thứ khác nhau** bị gộp:
  - (a) **Context window của model trong 1 phiên** — đây mới là cái cần ngưỡng `window − 25k`.
  - (b) **Cache phiên JSONL xuyên phiên** — lưu trữ, KHÔNG liên quan window, không cần ngưỡng token.
- **"nhồi vault + xuyên phiên + context vào mỗi prompt"** MÂU THUẪN với "compact muộn": càng nhồi nhiều mỗi lượt → window đầy nhanh → compact sớm. Phải budget từng lớp, không nhồi tất.

## 3. Yếu điểm — verify từ code thật

### ⚠️ BUG GỐC: occupancy đếm trùng cache → "chưa gì đã compact"
- `lucy_bridge.py:88` `COMPRESS_TOKEN_MAX = 120000` ; `:214` nén khi `turns≥40 HOẶC tokens≥120000`.
- `:201` `e["tokens"] += LAST_TURN_TOK`, mà `LAST_TURN_TOK` (`:395-397`) = input + output + **cache_read + cache_creation** của MỖI lượt.
- SDK cache TOÀN prompt → mỗi lượt `cache_read` ≈ kích thước context hiện tại (vài chục k). **Cộng dồn cache qua các lượt = đếm trùng cực mạnh.**
- Hệ quả: context THẬT mới ~30k mà sau 4 lượt "tokens" đã >120k → rollover. Đúng triệu chứng "chưa gì đã compact".

**Fix chuẩn:** occupancy KHÔNG cộng dồn cache. Lấy chiếm-dụng-window ≈ **token prompt của LƯỢT GẦN NHẤT** (`cache_read + cache_creation + input + output` của lượt cuối — xấp xỉ tổng prompt đang nằm trong window), so với ngưỡng động.

### ⚠️ Ngưỡng tĩnh, không theo window model
- 120k là số cứng. Chuẩn: `threshold = windowOf(LAST_MODEL) − 25_000`.
- Lưu ý số thật: **Claude Opus context = 200k** (không phải 256k). → compact ở ~175k. Nếu bật 1M beta thì 975k. Map theo `LAST_MODEL`.

### ⚠️ Recall mỗi lượt vô điều kiện + không lọc score
- `:1356` `recall_prefetch(text)` chạy mọi turn. Không gate, không ngưỡng similarity → nhồi cả hit lạc đề (xem ngay mấy dòng "🧠 Trí nhớ liên quan" lạc đề ở đầu phiên này = minh chứng sống).
- Chuẩn: **gate** (chỉ recall khi đổi chủ đề / câu cần ngữ cảnh) + **score-filter** (bỏ hit dưới ngưỡng) + **dedupe** với cái đã có trong buffer/seed.

## 4. Kiến trúc chuẩn (standard) — 5 lớp trí nhớ

- **L1 Working memory** — tin nhắn hiện tại + buffer N lượt gần (cửa sổ trượt). Luôn có.
- **L2 Retrieval** — hybrid search vault (semantic + lexical) + rerank (Jina reranker chưa khai), **gated + score-filtered**.
- **L3 Long-term** — episodic (turns memory.db), semantic facts (USER.md / claude-memory), session summary JSONL.
- **L4 Context assembler** — **budget-aware**: chia ngân sách token cho từng lớp (persona / memory / seed / hội thoại), ưu tiên + cắt + dedupe; đặt memory đúng chỗ (ổn định → system, tươi → user).
- **L5 Compaction** — trigger theo **occupancy thật vs window − headroom**; summarize → seed phiên mới + persist JSONL.

Nguyên tắc xương sống: **occupancy đo đúng, budget từng lớp, retrieval có cổng** — đủ 3 cái này thì hết "compact sớm" lẫn "nhồi nhiễu".

## 5. Fix ưu tiên (theo thứ tự)

1. `lucy_bridge.py:201` — occupancy = token lượt gần nhất, KHÔNG cộng dồn cache.
2. `:214` + `:88` — ngưỡng động `windowOf(LAST_MODEL) − 25k` thay 120k cứng.
3. `:1356` recall — thêm gate + score-filter + dedupe.
4. (L4) context budgeting khi assemble prompt — chống nhồi.
