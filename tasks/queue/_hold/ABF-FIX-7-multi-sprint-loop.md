# ABF-FIX-7: Multi-sprint loop — tự chạy nhiều sprint đến hết task

**Priority:** MEDIUM  
**File:** `/root/lucy/auto-build-free.py`

## Vấn đề
`run_sprint()` chạy 1 sprint rồi kết thúc process. auto-build gốc có loop: chạy sprint → check còn task → chạy tiếp. ABF không có → phải manual restart nhiều lần cho project lớn (YTM-1→19 = 3-4 sprint).

## Fix cần làm
Trong `main()`, wrap `run_sprint()` trong loop:

```python
sprint_num = 0
while sprint_num < MAX_ITERS:
    sprint_num += 1
    log(f"=== SPRINT {sprint_num} ===")
    
    still_pending = await run_sprint(sprint_num=sprint_num)
    
    if not still_pending:
        log("Không còn task pending → dừng loop")
        tg(f"🎉 Auto-Build-Free HOÀN THÀNH: {sprint_num} sprint, tất cả task done!")
        break
    
    if os.path.exists(STOP_FILE):
        break
    
    # Check token window (tương tự auto-build gốc)
    # brief pause giữa sprint
    await asyncio.sleep(5)
```

`run_sprint()` cần return `True` nếu vẫn còn task trong MASTER-SPEC chưa done.

## Acceptance
- Start 1 lần → tự chạy đến hết 19 YTM tasks (nhiều sprint)
- Dừng khi hết task hoặc `MAX_ITERS` sprint
- STOP file vẫn hoạt động để dừng giữa chừng
