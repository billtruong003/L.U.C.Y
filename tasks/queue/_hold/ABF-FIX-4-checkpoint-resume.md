# ABF-FIX-4: Checkpoint & resume — không mất state khi process die

**Priority:** MEDIUM  
**File:** `/root/lucy/auto-build-free.py`

## Vấn đề
Nếu process die giữa sprint (crash, VPS reboot, signal), toàn bộ state mất. Phải chạy lại từ đầu → Sonnet plan lại, execute lại tasks đã xong → tốn token + thời gian.

## Fix cần làm

### State file realtime
Sau mỗi task done, ghi vào `/root/lucy/auto-build-free-state.json`:
```json
{
  "sprint": 1,
  "plan": [...],        // toàn bộ plan từ Sonnet
  "done_ids": ["YTM-1", "YTM-2"],
  "results": [...],
  "escalation_count": 0,
  "ts": "2026-06-18T11:00:00"
}
```

### Resume logic khi start
Nếu state file tồn tại và `ts` < 2h trước → hỏi resume hay fresh:
```
⏮️ Tìm thấy state cũ (YTM sprint, 2/6 done). Resume? [y/N]
```
Hoặc auto-resume nếu có flag `--resume`.

### Skip done tasks
Khi resume: load `done_ids` → skip tasks đã có trong list.

## Acceptance
- Process die ở task 4/6 → restart với `--resume` → chạy tiếp từ task 5
- Không plan lại từ Sonnet nếu plan còn mới (< 2h)
