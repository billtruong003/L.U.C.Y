---
name: abf-per-task-report
description: "⭐ auto-build-free cần báo Telegram sau MỖI task xong, giống auto-build gốc — hiện tại chỉ báo cuối sprint"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d9843b7-bb2e-44d4-a41f-8960493c84ab
---

Bill feedback 2026-06-18: auto-build-free KHÔNG báo Telegram sau từng task, chỉ báo cuối sprint → thiếu visibility.

**Rule:** Mỗi lần auto-build-free xong 1 task (sau `run_mimo`/`run_claude`/`run_lane` DONE), phải gọi `tg()` với summary ngắn:
```
✅ [YTM-N] <task title> — done (model, chars/tokens)
```

**Why:** auto-build gốc (Sonnet) báo per-task → chủ nhân biết tiến độ realtime; ABF bỏ sót → cảm giác build chạy "lặng lẽ" dù process alive.

**How to apply:** Khi sửa/viết mới auto-build-free, thêm `tg()` call ngay sau block execute xong 1 task, trước khi sang task tiếp theo. Pattern:
```python
# sau khi execute xong
tg(f"✅ [{task['id']}] {task.get('title','')[:60]}\n→ {executor} · {chars}c · iter {i+1}/{total}")
```

Lần này KHÔNG hủy build để sửa; fix sẽ vào sprint code kế tiếp.

**Linked:** [[abf-autobuild-free]]
