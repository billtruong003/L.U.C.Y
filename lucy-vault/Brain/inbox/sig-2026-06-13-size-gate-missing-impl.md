---
kind: brain-signal
id: sig-2026-06-13-size-gate-missing-impl
created_at: 2026-06-13T00:00:00.000Z
topic: agent-machine/missing-impl-before-test
signal: negative
agent: lucy
principle: Bước engineer PHẢI tạo implementation trước khi bước tester chạy — nếu không có file gì thì tester chỉ confirm "không có gì" rồi trả rework ngay
evidenced_by: []
---

Card C3 size-gate: lane agent (ds-v4-flash-free) hết 40 turn không tạo được bất kỳ file nào.
Tester (bước kế) phải viết test từ đầu, chạy và confirm toàn bộ 8/9 cases fail vì thiếu implementation.

**Why:** Lane rẻ (flash-free 40 turn) không đủ capacity để đọc codebase + thiết kế + code + verify trong 1 pass.

**How to apply:** Card phức tạp như size-gate (cần đọc engine.ts, thiết kế API, viết module mới, wire vào engine, tsc check) → dùng persona đủ mạnh (sonnet/opus) hoặc chia nhỏ subtask trước khi assign lane.
