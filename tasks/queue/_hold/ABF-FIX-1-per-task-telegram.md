# ABF-FIX-1: Per-task Telegram báo cáo sau mỗi task xong

**Priority:** HIGH  
**File:** `/root/lucy/auto-build-free.py`

## Vấn đề
`auto-build-free.py` chỉ gọi `tg()` ở cuối sprint (REPORT phase). Không báo per-task → mất visibility realtime.

## Fix cần làm
Trong `run_sprint()`, sau khi `_execute_task_free(task, ...)` return `result`, thêm:

```python
# sau dòng: state["results"].append(...)
executor = result.get("executor", "?")
done_str = "✅" if result.get("done") else "❌"
esc_str = " (escalated→Sonnet)" if result.get("escalate") else ""
tg(f"{done_str} [{task.get('id')}] {task.get('title','')[:60]}\n"
   f"→ {executor}{esc_str} · {len(result.get('output','') or result.get('trace',''))}c · task {i+1}/{total_n}")
```

## Acceptance
- Mỗi task xong → 1 tin Telegram ngắn với id, done/fail, executor, chars
- Telegram không flood (1 tin/task, không spam)
