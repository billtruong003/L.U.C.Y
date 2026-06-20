---
id: at5-verify-output
title: Phân tích & đề xuất tối ưu task queue Lucy-autotask
date: 2026-06-17
---

# Phân tích auto-task.py — load_queue + triage

## Tổng quan kiến trúc

File `/root/lucy/auto-task.py` hiện triển khai đầy đủ AT-1→AT-5:
- `load_queue()` (L154-164): đọc `tasks/queue/*.md`, parse frontmatter, sort theo `(priority, id)`.
- `triage()` (L317-371): phân tầng `lane|claude|reject` qua lane model call (`/chat-lane-agentic`, `maxTurns=4`).
- `run_lane()` (L260-315): executor model rẻ + escalate nếu `NEEDS_CLAUDE`.
- `run_claude()` (L196-257): executor Sonnet (in-process SDK).
- `main()` (L373-458): chỉ xử lý **1 task/run** (L412: `task = tasks[0]`).

---

## Đề xuất 1 — Pre-screening heuristic TRƯỚC khi gọi lane triage (giảm token triage)

**Vấn đề:** Hiện tại MỌI task có `tier=auto` đều kéo một lần gọi `/chat-lane-agentic` (L347-352) để quyết định tier. Với task rõ ràng (đọc file, tóm tắt, research nhẹ), đây là chi phí token không cần thiết.

**Đề xuất:** Thêm bước heuristic regex nhanh **trước** `_coord_post` trong `triage()` (sau L329, trước L347):

```python
_LANE_HINTS  = [r"đọc file", r"tóm tắt", r"format", r"research nhẹ", r"soạn nháp", r"dọn vault"]
_CLAUDE_HINTS = [r"sửa bug", r"refactor", r"deploy", r"code phức tạp", r"đa bước"]
_REJECT_HINTS = [r"git push", r"rm -rf", r"xóa toàn bộ", r"shutdown", r"drop table"]

def _fast_tier(task):
    body = (task.get("title","") + " " + task.get("body","")).lower()
    for p in _REJECT_HINTS:
        if re.search(p, body): return "reject"
    claude_score = sum(1 for p in _CLAUDE_HINTS if re.search(p, body))
    lane_score   = sum(1 for p in _LANE_HINTS  if re.search(p, body))
    if lane_score >= 2 and claude_score == 0: return "lane"
    if claude_score >= 1: return "claude"
    return None  # ambiguous → gọi lane model
```

Nếu `_fast_tier()` trả kết quả rõ → skip lần gọi lane model, trả ngay `{"tier": ..., "plan": [], "risk": "low"}`.

**Lợi ích:** ~60-70% task routine thoát khỏi vòng lặp API, giảm latency triage từ ~5s xuống <1ms.

---

## Đề xuất 2 — Lưu kết quả triage vào task file (tránh re-triage khi restart)

**Vấn đề:** Khi pm2 crash hoặc `auto-task.py` bị kill giữa chừng (task đang ở `doing/`), lần chạy tiếp theo KHÔNG nhặt lại task trong `doing/` (chỉ scan `queue/`, L156-163). Nếu thủ công move lại vào `queue/`, triage sẽ gọi lane model một lần nữa — tốn token cho task đã từng được phân tích.

**Đề xuất:** Sau khi `triage()` thành công, append kết quả vào frontmatter task file:

```python
# Trong triage(), sau dòng 367 (sau log triage):
_append_triage_to_file(task, result)  # ghi tier/risk/plan vào file

def _append_triage_to_file(task, tri):
    try:
        with open(task["path"], "r+", encoding="utf-8") as f:
            content = f.read()
            # Insert trước closing --- của frontmatter
            content = re.sub(
                r"^(---\s*\n)(.*?)(\n---\s*\n)",
                lambda m: m.group(1) + m.group(2)
                    + f"\ntriage_tier: {tri.get('tier','')}"
                    + f"\ntriage_risk: {tri.get('risk','')}"
                    + m.group(3),
                content, count=1, flags=re.DOTALL
            )
            f.seek(0); f.write(content); f.truncate()
    except Exception: pass
```

Sau đó `_parse_frontmatter()` (L123-152) tự đọc được `triage_tier` → `triage()` bỏ qua gọi lane model (tương tự logic `tier != "auto"` ở L323-327).

**Lợi ích:** Tái sử dụng triage khi retry, giảm token + giảm nguy cơ triage khác nhau mỗi run.

---

## Đề xuất 3 — Bug: `executor` label sai khi lane escalate (L442)

**Vấn đề:** Đây là một bug thực tế trong code hiện tại (L442):

```python
executor = "claude" if tier == "claude" or result.get("escalate") else "lane"
```

Khi `tier == "lane"` và lane escalate, đoạn code ở L433-435:
```python
if result.get("escalate"):
    result = await run_claude(task, plan, lane_trace=result.get("trace"))
```

Biến `result` bị **ghi đè** bởi output của `run_claude`. `run_claude` trả về `{"done": ..., "output": ..., "usage": ...}` — KHÔNG có key `"escalate"`. Vì vậy L442: `result.get("escalate")` luôn là `None/False` khi đã escalate → `executor = "lane"` thay vì `"claude"`.

**Fix đề xuất:** Track escalation bằng biến riêng (thêm sau L431):

```python
if tier == "lane":
    result = run_lane(task, plan)
    escalated = result.get("escalate", False)      # lưu trước khi overwrite
    if escalated:
        log(f"[{task['id']}] lane escalate → claude executor")
        result = await run_claude(task, plan, lane_trace=result.get("trace"))
elif tier == "claude":
    escalated = False
    result = await run_claude(task, plan)
else:
    escalated = False
    result = {"done": False, "error": f"tier không hợp lệ: {tier}"}

executor = "claude" if tier == "claude" or escalated else "lane"  # L442 thay thế
```

**Lợi ích:** Label đúng trong log + Telegram report, giúp phân tích chi phí token theo executor chính xác.

---

## Ghi chú kiến trúc

- `main()` L412 chỉ xử lý `tasks[0]` → sprint loop (AT-7) là blocker để queue tự drain. Khi AT-7 thêm vào, `load_queue()` nên filter out file đang trong `doing/` để tránh race condition nếu nhiều instance chạy song song.
- `load_queue()` L163 sort theo `(priority, id)` — với 2 task cùng priority, thứ tự phụ thuộc tên file (alphabetical). Cân nhắc thêm frontmatter `created_at: ISO` để sort ổn định hơn khi AT-7 thêm sprint loop.

---

*Phân tích bởi Lucy executor — 2026-06-17*
