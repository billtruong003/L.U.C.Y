---
name: build-hub-in-autotask
description: ⭐ Mọi auto-build tool (Sonnet/free-lane/claude) PHẢI hiện status trong tab Auto-Task Hub để Bill theo dõi
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d9843b7-bb2e-44d4-a41f-8960493c84ab
---

Bill yêu cầu 2026-06-18: tất cả build pipeline tools phải nằm trong tab Auto-Task (Hub) — không tạo tab riêng.

**Rule:** Khi implement hoặc thêm bất kỳ auto-build tool mới nào (auto-build Sonnet, auto-build-free mimo+Sonnet, lane executor, hay tool tương lai), PHẢI:
1. Thêm `/api/<toolname>/status` endpoint vào hub server
2. Thêm `BuildStatusCard` hoặc tương đương vào `AutoTask.tsx` (Build Pipeline section đầu tab)
3. Auto-refresh 5-10s để Bill thấy realtime

**Why:** Bill cần 1 nơi duy nhất để theo dõi tất cả build jobs — không nhảy qua nhiều tab hay log file.

**How to apply:**
- Tab Auto-Task = "Build Pipeline HQ" — section trên = status cards, section dưới = project grid
- Pattern hiện tại: `BuildStatusCard` component + `/api/autobuild-free/status` (đọc log + pgrep PID)
- Coordinator restart sau khi thêm endpoint để pick up route mới (hoặc deploy hub)

**Linked:** [[abf-autobuild-free]], [[auto-task-hub]]
