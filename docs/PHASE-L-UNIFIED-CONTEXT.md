# Phase L — Unified Context (Hermes parity): mọi model NỐI LIỀN mạch, kể cả auto-route

> Bill chỉ ra (2026-06-13): model free/API không giữ context/không cache/không lịch sử, không có catalog đầy đủ →
> harness chưa bằng Hermes. Đây là phân tích GỐC RỄ + thiết kế để vá đúng chỗ.

## 1. VÌ SAO ĐANG VỠ (root cause)

**Hai mô hình trí nhớ khác nhau — đang đối xử lệch:**
- **Claude (subscription qua SDK/CLI):** Anthropic giữ session server-side (`session_id` + `--resume`). Context + prompt-cache nằm Ở PHÍA HỌ → Lucy chỉ gửi tin MỚI. → có continuity "miễn phí".
- **Lane (OpenRouter/Groq/Gemini... API):** API **STATELESS theo thiết kế** — provider KHÔNG nhớ gì giữa các call. Muốn có context phải **TỰ gửi lại toàn bộ lịch sử** mỗi lần.

**Lỗi thực tế trong code Lucy:** caller (hub `/api/chat/stream`, bridge `run_lane`) gọi `/chat-lane` chỉ với `messages:[{role:user, content:prompt}]` — **KHÔNG system (persona), KHÔNG history**. → lane mất sạch persona + ngữ cảnh. Đây chính là "auto route sang model rẻ là hỏng session".
> May: lớp lane (`llm-lane.ts` / `/chat-lane`) ĐÃ nhận `messages[]` đầy đủ (có cả role `system`). **Hạ tầng đủ — chỉ thiếu caller dựng đúng request.** Vá ở caller, không phải rớt lại lane.

**D7 (vừa làm) chỉ là BĂNG DÁN:** né không route sang lane khi đang có phiên. Chưa giải gốc — gốc là lane phải MANG được context.

**Phân biệt 2 thứ Bill gộp:**
- *Continuity* (nối mạch) = **gửi lại lịch sử** → chạy MỌI model, kể cả free. ← cái cần.
- *Prompt cache* = chỉ làm việc gửi lại RẺ hơn, là tính năng của provider (Anthropic có `cache_control`; free thường không). Không có cache vẫn nối mạch được, chỉ tốn token hơn.

**Catalog:** `MODEL_CATALOG` đang HARDCODE tay → không biết hết model nào ở provider nào, capability/giá. Routing thiếu thông tin. (OpenRouter có `/api/v1/models` liệt kê sẵn TOÀN BỘ model + provider + giá + context — scrape được.)

## 2. NGUYÊN TẮC HERMES (làm sao bằng được)
> **HARNESS sở hữu hội thoại, KHÔNG phụ thuộc session của provider.**
> Context là "của mình" → model NÀO cũng nhận y như nhau → đổi model giữa chừng không đứt mạch.

## 3. THIẾT KẾ (4 lớp)

### L1 — Conversation store (nguồn sự thật, harness-owned)
- Mỗi hội thoại = list message ĐẦY ĐỦ (đã có `chat.json`; Phase J tách đa-phiên `chats/<id>.json`).
- Lưu kèm: `session_id` Claude (để resume khi route về Claude), model mỗi turn (audit).

### L2 — Provider-agnostic request builder ⭐ (trái tim)
Một hàm `buildMessages(history, persona)` → request đúng cho từng đích:
- **Claude SDK:** `system`/append = persona; resume `session_id` (rẻ) HOẶC nhồi history nếu cần đồng bộ.
- **Lane/API:** `messages = [{role:'system', content: persona}, ...history, {user: prompt}]` — GỬI LẠI toàn bộ. (lớp lane đã nhận sẵn → chỉ cần caller dựng.)
- **Khi route đổi model:** dù Claude→lane hay lane→Claude, đều dựng từ CÙNG history → liền mạch. Khi về Claude lần đầu sau lane: nhồi history vào để Claude bắt kịp (session mới).

### L3 — Context compressor (= E1) áp cho MỌI model
- Trước khi gửi: nếu history dài → giữ head (persona+goal) + tail (gần đây) + summarize giữa bằng model rẻ. Giữ dưới trần ctx của model đích (mỗi model trần khác nhau → đọc từ catalog L4).
- Claude tự auto-compact (đã có); lane KHÔNG có → đây là chỗ E1 thực sự cần cho lane.

### L4 — Model catalog/discovery (scrape) 
- Pull `OpenRouter /api/v1/models` (+ provider khác) → registry: model × provider/nền-tảng × context-window × giá × free? × capability (tool/vision).
- Dùng để: (a) routing biết model nào hợp + trần ctx để nén đúng, (b) UI Hub hiện "con nào ở đâu" (đúng ý Bill "chia mỗi con nằm nền tảng nào"), (c) tự cập nhật thay vì hardcode.

### L5 — Prompt caching nơi hỗ trợ (tối ưu chi phí, optional)
- Provider hỗ trợ (Anthropic-compat) → đặt `cache_control` trên prefix ổn định (persona + history cũ). Free → bỏ qua (vẫn nối mạch, chỉ full cost).

## 4. KẾT QUẢ
- **Auto-route THẬT SỰ liền mạch:** route theo task (rẻ/mạnh/tool) mà persona + ngữ cảnh KHÔNG mất → bỏ băng-dán D7, cho phép hạ lane giữa phiên an toàn.
- Bằng Hermes ở điểm cốt lõi: harness-owned context + provider-agnostic dispatch + catalog đầy đủ.

## 5. QUAN HỆ PHASE KHÁC
- Cần **Phase J** (conversation store đa-phiên) làm nền L1.
- Dùng lại **E1** (compressor) cho L3.
- **NÂNG CẤP D7**: sau L, không cần né lane nữa.
- Hợp **Phase K** (expert-consultation): sub-agent expert cũng nhận context qua cùng builder.

## 6. THỨ TỰ ĐỀ XUẤT (chèn vào roadmap)
J (conversation store) → **L2 builder + L1** (nối mạch mọi model) → L4 catalog scrape → L3 compressor cho lane → L5 cache. Đặt NGAY SAU J, TRƯỚC K (vì K cần context liền mạch).
