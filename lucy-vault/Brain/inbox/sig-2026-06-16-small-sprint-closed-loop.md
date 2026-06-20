---
kind: brain-signal
topic: lucy/sprint-workflow
signal: positive
principle: Chia SPRINT NHỎ + quy trình khép kín (1 sprint/lần → verify → push GitHub → sprint sau). KHÔNG chạy sprint to (đốt token + Claude timeout + không đi đến đâu). Học gì mới PHẢI ghi vào não ngay.
created_at: 2026-06-16T01:05:00+07:00
agent: lucy
---

Bill chốt 2026-06-16 cho dự án Stylized Shader Kit (và mọi build lớn):
- **Sprint NHỎ + vòng lặp khép kín**: 1 sprint = 1 đơn vị nhỏ → làm → verify → push GitHub → mới tới sprint sau, cùng 1 quy trình. Sprint to = đốt token + timeout + vô hiệu.
- **Mỗi PACK = 1 repo GitHub riêng** (folder + repo). Push lên để Bill check vài ngày khi đi làm.
- **GitHub access**: token ở `~/.git-credentials` (git push sẵn); remote owner `billtruong003`. Lucy có TOÀN QUYỀN truy cập repos của Bill để THAM KHẢO cách Bill làm. KHÔNG echo token.
- **Học → ghi não NGAY**: mọi case ngộ / kỹ thuật mới khi research/đọc src → ghi memory ([[unity-shader-version-gotchas]]).
- **Token reset ~mỗi 5h** → nếu sắp out, SET CRON trước để chạy lúc token hồi (đừng cố chạy khi sắp cạn).

**Why:** Bill làm dev solo, cần tiến độ chỉnh chu + tinh gọn, không mất kiểm soát/đốt token vô ích.
**How to apply:** Mọi dự án build → vạch sprint nhỏ trong spec → runner chạy 1 sprint/lần (cron khi cần token-window) → push → notify → next. Liên quan [[sig-2026-06-16-autobuild-must-confirm]] (vẫn phải Bill confirm trước khi khởi cron build).
