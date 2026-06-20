---
title: Context-memory cho Lucy — nén hội thoại tuyến tính + summary xuyên phiên
created: 2026-06-19
status: proposal (chờ chủ nhân duyệt)
author: lucy
---

# Vấn đề
Harness Claude Code tự nén/cắt context khi chat dài → mất nhiều info (đường dẫn, quyết định, mạch việc).
Cách nén của harness là "1 cục giữa chừng", không hiểu cấu trúc việc → cắt ngu, mất neo.

# Insight cốt lõi (chủ nhân nêu)
Tách 2 thứ KHÁC BẢN CHẤT, đừng nén chung:
- **PROSE** (lời qua lại, diễn giải) — nén thoải mái, mất chữ không sao.
- **REFS / content-check** (đường dẫn, link, file, commit, lệnh) — **BẤT BIẾN, KHÔNG nén, KHÔNG bịa**.
  Đây là cái để verify lại và khôi phục thao tác. Mất REF = mất tất cả.

# Format đơn vị nhớ đề xuất — "interaction record"
1 record / 1 cặp lượt (chủ nhân hỏi → Lucy làm). Token rẻ, search độc lập:

```
seq | ts | session_id
ASK   : <chủ nhân yêu cầu — rút gọn 1-2 câu, giữ nguyên ý>
DID   : <Lucy đã làm gì — action + kết quả, verb+object, bỏ filler>
REFS  : [ {type: file|dir|link|cmd|commit, value, note?} ]   ← giữ 100%, không nén
STATUS: done | partial | blocked
OPEN  : <câu hỏi/quyết định treo, null nếu không>
```

Quy tắc tối ưu:
1. Nén = rút gọn ASK/DID, **REFS giữ nguyên tuyệt đối**.
2. ASK/DID viết "verb + object", bỏ chữ thừa → rẻ token.
3. 1 record atomic → search/recall được riêng lẻ.

# Hai tầng (đúng ý chủ nhân)

## Tầng A — trong phiên: nén TUYẾN TÍNH theo segment (thay harness "cắt ngu")
- Chia hội thoại thành **SEGMENT** theo chủ đề/task (không cắt giữa 1 việc).
- Segment hiện tại: giữ raw records.
- Segment cũ: thay bằng **1 segment-digest** = gộp (mục tiêu + STATUS + union REFS).
- => context giảm tuyến tính mà KHÔNG mất neo. Đây là "cắt ra nhiều phiên tuyến tính".

## Tầng B — xuyên phiên: compact on /new + Jina search
- Bắt lệnh `/new` → đóng phiên → gộp toàn bộ records phiên thành **1 session-summary**:
  mục tiêu phiên · đã làm (bullet) · REFS tổng · OPEN còn lại.
- Ghi summary thành **note .md** (frontmatter `type: episodic-summary`) trong vault.
- Phiên mới: recall qua `/recall` như bình thường → tự thấy "hôm trước đã làm X, file Y".

# Hiện trạng hạ tầng (đã đọc code 2026-06-19) — phần lớn ĐÃ CÓ
File: `agent-machine/src/recall.ts` + `coordinator.ts` + `bridge/lucy_bridge.py`. DB: `lucy-vault/.index/memory.db`.
- ✅ Bảng `turns(id, ts, source, chat_id, role, content, session_id)` + `turns_fts` (FTS5). **Cột `session_id` đã có sẵn.**
- ✅ `recordTurn({source, chatId, role, content, sessionId, ts})` — bridge+hub fire-and-forget.
- ✅ retention 90 ngày, flag `LUCY_EPISODIC`.
- ✅ recall lai FTS5 + vector (Jina v5-omni-nano 768) + RRF, đã gộp episodic.
- ✅ `note` table có vector + bi-temporal `valid_to` + relation.

# ⭐ PHÁT HIỆN LỚN (2026-06-19): bridge ĐÃ CÓ cơ chế nén — "CC" — đúng nửa đường
Trong `lucy_bridge.py` đã tồn tại pipeline context-compression cho claude-path:
- **CC-1** `claude_hist_append` + `should_compress`: buffer rolling per chat_id, đếm turn+token, có ngưỡng auto-rollover (flag `LUCY_AUTO_COMPRESS`).
- **CC-2** `_compress_conversation` + `_summarize_transcript`: khi vượt ngưỡng → tóm tắt buffer bằng **lane model rẻ** (fallback sonnet) → bỏ `--resume` cũ → **seed** summary vào prompt đầu phiên claude mới → reset buffer. Báo chủ nhân "🗜️ em gói gọn lại".
- `/new` = `_clear_claude_hist`: **xoá HẲN buffer + counter + seed**.

→ Tức là Tầng B (compact + sang phiên mới) ĐÃ chạy. Nhưng nó **hở đúng 3 chỗ** gây "mất trí nhớ" như chủ nhân than:

## 3 lỗ hổng của CC hiện tại (đây là việc thật cần vá)
1. **Summary CC-2 chỉ sống in-memory** (`e["seed"]`, file `~/.lucy-...json`) — KHÔNG ghi vào `memory.db`/vault note → **không Jina embed, không recall xuyên phiên**, mất khi restart.
2. **`/new` xoá sạch KHÔNG tóm tắt trước** → cố tình /new để đổi chủ đề = phiên đó **bốc hơi hoàn toàn**.
3. **Không rolling/kế thừa**: mỗi lần CC-2 tóm tắt chỉ lấy buffer hiện tại, **KHÔNG gộp seed cũ** → mạch nhiều phiên không nối được.

# ⭐ Yêu cầu chủ nhân (2026-06-19) — ROLLING COMPACT
"Nhớ xuyên phiên: khi sang phiên mới phải compact **summary phiên TRƯỚC + nội dung phiên HIỆN TẠI** thành một ký ức liên tục rồi mới mở phiên mới. Sẽ hao một ít khi nén — chấp nhận — miễn phần ký ức mới được LƯU lại."
→ Dịch sang kỹ thuật: tại MỌI điểm đóng phiên (`/new` thủ công + CC-2 auto-rollover), làm 3 việc:
  (a) `summary_mới = compact( seed_cũ  ⊕  buffer_phiên_hiện_tại )`  ← rolling, REFS giữ 100%.
  (b) **persist** `summary_mới` thành note `.md` trong vault → autoindex Jina embed → recall thấy.
  (c) seed phiên mới = `summary_mới` (kế thừa liền mạch).

# Gap cần làm (3 mắt xích thiếu)
1. **turns đang lưu RAW text, chưa structured.** → nâng `recordTurn` nhận thêm `ask/did/refs/status/open`
   (lưu JSON trong content hoặc thêm cột). KHÔNG phá schema cũ.
2. **turns CHƯA embed Jina** (chỉ FTS5). → KHÔNG cần build embed riêng cho turns:
   ghi session-summary thành **note .md** → pipeline note có sẵn tự embed Jina. Tái dùng, rẻ.
3. **Chưa có cơ chế đóng phiên + summary-on-/new.** → bridge/hub bắt `/new` → gọi endpoint mới
   `/session-close` ở coordinator → đọc turns theo `session_id` → 1 lần gọi LLM rẻ summarize →
   ghi note `Brain/episodes/<date>-<slug>.md` → autoindex embed.

# Lộ trình đề xuất — ĐẢO LẠI sau khi thấy CC-2 (tái dùng, không xây mới)
- **CM-1 ✅ DONE (2026-06-19):** endpoint `POST /session-summary` ở coordinator → nhận
  `{chat_id, session_id, summary, refs[]}` → ghi note `Brain/episodes/<date>-<chatid>-<sid>.md`
  (frontmatter `type: episodic-summary`, body = summary + khối REFS nguyên văn) → reindex Jina/FTS bắt ngay.
  Áp `redact.ts` cho cả summary + REFS. KHÔNG đụng bridge runtime. Flag `LUCY_SESSION_SUMMARY` (mặc định OFF).
  - File: `agent-machine/src/session-summary.ts` (writeSessionSummary + flag), endpoint trong `coordinator.ts` (khối brain).
  - Thêm `Brain/episodes` vào `INDEX_DIRS` (recall.ts) — nếu thiếu thì note ghi ra mà Jina KHÔNG nhặt = "ghi mà mất".
  - Test: `npm run smoke:session-summary` → 13/13 PASS (redact, REFS nguyên văn, reindex→recall thấy lại, không-sid không đè).
  - ⚠️ Kích hoạt cần REBUILD/RESTART coordinator + đặt `LUCY_SESSION_SUMMARY=1` (flag-off nên restart vẫn an toàn).
- **CM-2 ✅ DONE-code (2026-06-19) — vá 3 lỗ CC, flag-off, CHỜ chủ nhân restart bridge để áp:**
  - File: `bridge/lucy_bridge.py`. Flag `LUCY_SESSION_SUMMARY` (mặc định `0` → bridge chạy Y HỆT hiện tại).
  - `_summarize_transcript(buffer, seed_prev="")` nhận seed phiên trước → prompt gộp rolling (a) + ép **trích REFS nguyên văn, không bịa**.
  - `_extract_refs(buffer, seed)` mới: regex lấy path/link **chỉ từ transcript THẬT** (không bịa) → list `{type,value}` cap 30.
  - `_persist_session_summary()` mới: POST `/session-summary` (fire-and-forget, gated flag) → note `Brain/episodes/` (b).
  - `_compress_conversation` (auto-rollover): rolling `seed_cũ ⊕ buffer` + persist (giữ sid TRƯỚC khi pop) → seed mới = summary (c).
  - Handler `/new`: TRƯỚC khi xoá → summarize rolling + persist (lỗ #2); flag off → xoá thẳng như cũ.
  - Test: `python3 bridge/smoke_cm2_session_summary.py` → **15/15 PASS** (extract nguyên văn/không bịa; OFF không persist+không rolling; ON persist summary+refs+rolling; buffer rỗng không note rác). Regression `smoke_context_compress.py` → **28/28 PASS**.
  - ⚠️ Kích hoạt: đặt `LUCY_SESSION_SUMMARY=1` ở CẢ bridge env LẪN coordinator env (note chỉ ghi khi coordinator cũng bật) → `pm2 restart lucy-bridge` (+ restart coordinator nếu chưa bật flag).
- **CM-3 (tuỳ chọn):** turns structured ask/did/refs (proposal gốc) — chỉ làm nếu summary-note chưa đủ neo.
- **CM-4 (tuỳ chọn):** recall ưu tiên/boost hit có REFS; tầng A segment-digest in-session.

Ghi chú: CM-1 trước CM-2 vì CM-1 dựng "nơi để đổ" an toàn (không đụng live); CM-2 chỉ là nối bridge vào.
ASK/DID/REFS structured (proposal gốc) **sinh bởi LLM lúc compact** (CM-2), không phải lúc ghi raw turn —
nên không cần đổi schema `turns` ở bước đầu (đỡ rủi ro migrate trên DB live).

# Nguyên tắc an toàn
- REFS không bao giờ bịa — chỉ ghi path/link đã thật sự thao tác.
- Secret redaction đã có (redact.ts) — áp cho summary trước khi ghi note.
- Mọi thứ flag-gated, dry-run trước khi bật APPLY (theo nếp Phase 3/4).
