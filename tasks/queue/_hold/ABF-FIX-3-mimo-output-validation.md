# ABF-FIX-3: Validate mimo output thực sự có code

**Priority:** HIGH  
**File:** `/root/lucy/auto-build-free.py` → `run_mimo()`

## Vấn đề
`run_mimo` log "DONE (45 chars)" → output quá ngắn, có thể chỉ là "OK" / "Done" không phải code thật.
Hiện tại: `if not answer or "NEEDS_CLAUDE" in answer → escalate` — nhưng "Done" (4 chars) pass qua!

## Fix cần làm
Thêm heuristic check sau khi mimo trả về:

```python
MIN_CODE_CHARS = 100  # output < 100 chars cho code task → suspect

def _is_real_output(answer, task):
    if not answer: return False
    if len(answer) < MIN_CODE_CHARS and task.get("tier") == "code-free":
        return False  # quá ngắn cho code task
    if answer.strip().lower() in ("done", "ok", "yes", "no", "completed", "✅"):
        return False  # chỉ là ack, không có code
    return True
```

Nếu `_is_real_output` = False → escalate Sonnet thay vì accept.

## Edge case thêm
- mimo trả markdown code block nhưng không write file → cần check file thực sự được tạo
- Thêm log warning: `"mimo output suspect (N chars) → escalate"`

## Acceptance
- Task có code thật được write ra file
- Không accept "OK" / "Done" ngắn như là thành công
