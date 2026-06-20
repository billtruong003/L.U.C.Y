# ABF-FIX-2: Hub tab + API status cho auto-build-free

**Priority:** MEDIUM  
**Files:** coordinator routes, hub web src

## Vấn đề
Hub chỉ có tab `🏗️ Auto-build` cho auto-build gốc. ABF không có tab riêng → không thấy sprint đang chạy task nào.

## Fix cần làm

### 1. Coordinator: endpoint `/api/autobuild-free/status`
Đọc state từ `auto-build-free-plan.json` + tail 20 dòng log → trả JSON:
```json
{ "running": true, "current_task": "YTM-3", "done": 2, "total": 6, "last_log": "..." }
```

### 2. auto-build-free.py: write state file realtime
Ghi `/root/lucy/auto-build-free-state.json` sau mỗi task:
```json
{ "sprint": 1, "task": "YTM-3", "done": 2, "total": 6, "ts": "..." }
```

### 3. Hub web: tab `🆓 ABF` (tương tự tab Auto-build)
- Poll `/api/autobuild-free/status` mỗi 5s
- Show: task hiện tại, progress bar, log tail

## Acceptance
- Vào Hub thấy tab ABF với tiến độ realtime
- Không cần reload tay
