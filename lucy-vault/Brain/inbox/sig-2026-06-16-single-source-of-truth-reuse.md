---
kind: brain-signal
topic: lucy/source-of-truth-reuse
signal: negative
principle: Có hệ thống sẵn (vd token-guard) thì MỌI path liên quan PHẢI report/đọc vào ĐÚNG nguồn đó (single source of truth) — TÁI DÙNG, đừng code mới song song hay để path bỏ sót không đếm.
created_at: 2026-06-16T09:40:00+07:00
agent: lucy
---

Bill chốt 2026-06-16: "vd t cho chạy auto task nó hoàn toàn k chạy vào vụ token của dashboard luôn mặc dù ta có cái đó để tính mà — phải có 1 source of truth để code thì tận dụng lại chứ k phải cứ chăm chăm code mới."

**Vấn đề cụ thể:** token-guard (coordinator `/token-guard/add`, Dashboard đọc) = NGUỒN ĐẾM TOKEN DUY NHẤT. Nhưng nhiều path tốn token KHÔNG report vào nó:
- `auto-build.py` (đo cost qua SDK nhưng KHÔNG POST /token-guard/add).
- Prompt Architect hub call (callLLM trả usage nhưng hub KHÔNG report).
- (cần rà: cron claude -p, lane-chat hub, persona-chat...).
→ Dashboard token = thiếu/sai vì path bỏ sót.

**Why:** Bill cần 1 con số token ĐÚNG + đỡ phí công code trùng. Đếm phân mảnh = vô dụng.

**How to apply:**
1. TRƯỚC khi build feature đụng token/cost/memory/state → HỎI "đã có hệ thống nào làm cái này chưa?" → TÁI DÙNG (token-guard, recall, episodic, store...), đừng dựng song song.
2. MỌI path gọi LLM (SDK/claude -p/callLLM/lane) PHẢI report usage → `POST coordinator /token-guard/add {inTok,outTok}` (nguồn duy nhất). Bao gồm: auto-build, PA-hub, cron, lane chat.
3. Nguyên tắc chung: ưu tiên TÁI DÙNG infra sẵn > code mới. Liên quan [[pt-telegram-token-parity]] (đã làm cho bridge) + [[sig-2026-06-16-autobuild-must-confirm]].
