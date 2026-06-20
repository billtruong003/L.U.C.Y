---
kind: brain-signal
topic: lucy/sprint-execution
signal: positive
principle: Khi chủ nhân kêu "lên sprint và chạy", LUÔN dùng đường auto-build (thả task spec vào queue cho pipeline tự chạy), KHÔNG BAO GIỜ chạy task trực tiếp trong phiên — chạy task dài sẽ bị timeout.
created_at: 2026-06-19T12:35:09Z
agent: lucy
---

Chủ nhân (2026-06-19): "Nếu t đã kêu m lên sprint và chạy thì quy trình luôn là auto-build, không bao giờ được chạy task vì m chạy lâu là bị timeout."

**Why:** Sprint = nhiều bước/việc dài. Nếu Lucy tự execute inline trong phiên (bridge/SDK) thì process bị timeout giữa chừng → mất việc. Pipeline auto-build (auto-task / auto-build / auto-build-free, pm2) sinh ra để chạy dài, có state file, tự báo cáo từng task.

**How to apply:** Hễ chủ nhân nói "lên sprint / chạy sprint / build cái này" → soạn task spec rồi đẩy vào queue auto-build phù hợp (lucy-autotask / lucy-autobuild / lucy-autobuild-free), KHÔNG tự cày inline. Liên quan [[auto-task-engine]] [[abf-autobuild-free]] [[cron-shader-sprint]] [[report-every-task]].
