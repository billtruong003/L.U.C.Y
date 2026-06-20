# ABF-FIX-5: Git commit sau mỗi task xong

**Priority:** HIGH  
**File:** `/root/lucy/auto-build-free.py`

## Vấn đề
Hiện tại ABF không có git commit per-task. Bill yêu cầu "commit git mỗi task xong" nhưng code không làm điều này. Tất cả thay đổi tích lũy → commit cuối sprint (hoặc không commit gì cả).

## Fix cần làm
Sau mỗi task `done=True` trong `run_sprint()`:

```python
async def _git_commit_task(task, workspace):
    """Commit thay đổi sau 1 task xong."""
    import subprocess
    tid = task.get("id", "?")
    title = task.get("title", "")[:60]
    try:
        # stage all changes trong workspace
        subprocess.run(["git", "-C", workspace, "add", "-A"], timeout=30, check=False)
        result = subprocess.run(
            ["git", "-C", workspace, "diff", "--cached", "--quiet"],
            timeout=10
        )
        if result.returncode == 0:
            log(f"git commit [{tid}]: không có thay đổi, skip")
            return
        subprocess.run(
            ["git", "-C", workspace, "commit", "-m", f"feat({tid}): {title}"],
            timeout=30, check=True
        )
        log(f"git commit [{tid}]: OK")
    except Exception as e:
        log(f"git commit [{tid}] error: {e}")
```

Gọi sau `_execute_task_free()` return `done=True`.

## Guard
- KHÔNG `git push` (guard đã chặn, Bill push tay)
- Chỉ commit khi `done=True`, bỏ qua khi fail
- Workspace path lấy từ FOCUS env hoặc plan task metadata

## Acceptance
- `git log` trong workspace show 1 commit per YTM task done
- Commit message format: `feat(YTM-N): <title>`
