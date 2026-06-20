---
id: CL-INVFIX
title: Áp fix CL-INV — auto-task queue thường lên tab Auto-Task hub
status: done
date: 2026-06-21
---

# CL-INVFIX — Auto-task lên hub (/api/auto-task/status + status card)

## Tóm tắt
Áp đúng "Đề xuất fix tối thiểu" của CL-INV: thêm 1 endpoint backend + 1 status card
frontend để nhánh auto-task **queue thường** (pm2 `lucy-autotask`) hiện trên tab Auto-Task.
Không sửa `auto-task.py`, không đụng nhánh ATH `/api/autotask/projects`.

## Thay đổi (file:line)

### 1. Backend — `hub/server/src/index.ts:1211-1227`
Thêm `GET /api/auto-task/status` ngay sau `/api/autobuild-free/status`:
- Có `authed(req)` guard (401 nếu chưa auth) như các endpoint khác.
- Tái dùng `buildToolStatus('auto-task.log')` — hàm này pgrep `logFile.replace('.log','.py')`
  = `auto-task.py`, tự khớp process `lucy-autotask` đang chạy (không cần auto-task.py POST gì).
- Bổ sung count `queue/doing/done/failed` từ `LUCY_REPO/tasks/<sub>` (đếm file `.md`),
  fallback 0 nếu thư mục thiếu.

### 2. Frontend — `hub/web/src/components/AutoTask.tsx`
- `:215` mở rộng union `fetchBuildStatus(tool: ... | 'auto-task')`.
- `:222` mở rộng union prop `tool` của `BuildStatusCard` thêm `'auto-task'`.
- `:334-339` thêm card thứ 3 trong grid Build Hub:
  ```tsx
  <BuildStatusCard title="Auto-Task" icon="🤖" tool="auto-task"
                   model="queue loop · Sonnet/lane" />
  ```
  → card fetch `/api/auto-task/status`, hiện ● RUNNING / ○ idle + currentTask + log tail
  như 2 card autobuild/autobuild-free.

## Verify
- `cd hub/server && npx tsc --noEmit` → **EXIT 0** ✅
- `cd hub/web && npx tsc --noEmit` → **EXIT 0** ✅ (sau khi mở rộng cả 2 union type;
  lần đầu fail vì `fetchBuildStatus` còn union hẹp — đã sửa).
- Commit local trên `main` (KHÔNG push).

## Cần làm SAU khi deploy (chủ nhân/Lucy)
```bash
bash hub/deploy.sh        # build lại web + server
pm2 restart lucy-hub      # KHÔNG restart lucy-bridge
# verify endpoint (cần cookie phiên đăng nhập hub):
curl -s -H "cookie: <session>" http://127.0.0.1:8800/api/auto-task/status | jq
# kỳ vọng: { running, lastTs, logTail, currentTask, queue, doing, done, failed }
```

## Ràng buộc đã giữ
- KHÔNG sửa `auto-task.py`. KHÔNG đụng `/api/autotask/projects` (nhánh ATH).
- KHÔNG restart lucy-hub / lucy-bridge. KHÔNG git push. Commit local.
