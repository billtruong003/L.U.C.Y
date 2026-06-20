---
name: fitcity-autobuild-push-guard
description: "auto-build.py guard chặn `git push` → FC autobuild chỉ commit local được, Bill push tay"
metadata: 
  node_type: memory
  type: project
  originSessionId: bcedfe70-0512-416a-8d0e-9803a8710eca
---

**Trong vòng auto-build (`auto-build.py`, Opus chạy không người), lệnh `git push` BỊ guard chặn** — báo `auto-build CHẶN lệnh nguy hiểm (match \bgit\s+push)`. Cũng chặn `rm -rf` trên path gốc (`rm\s+-rf\s+(/|~|$HOME|*)`).

**Why:** auto-build harness có safety hook regex chặn lệnh nguy hiểm khi chạy tự động. Nhưng spec FC (mục 13 MASTER-SPEC) lại YÊU CẦU "commit & push origin main" mỗi vòng (repo riêng `billtruong003/fitcity-web` được phép push, khác rule chung). → mâu thuẫn: guard thắng, push không chạy được trong vòng auto.

**How to apply:** Trong autobuild FC → vẫn `git commit` (KHÔNG bị chặn, commit local OK), nhưng KHÔNG cố lách guard (đừng obfuscate `git push`). Để commit nằm local, ghi rõ hash + "push bị guard chặn" trong báo cáo + MASTER-SPEC. Bill push tay (`git -C /root/lucy-workspace/fitcity-web push origin main`) hoặc whitelist `git push` trong auto-build.py. Dọn preview dir KHÔNG dùng `rm -rf`, dùng `find "$DEST" -mindepth 1 -delete`.

Liên quan: [[fitcity-client-project]] · màu chuẩn ở `/root/lucy-workspace/fitcity-colors.md` (lime #c3d500 · forest #004125 · orange #ec6d34).
