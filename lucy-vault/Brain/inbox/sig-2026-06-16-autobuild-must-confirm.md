---
kind: brain-signal
topic: lucy/autobuild-consent
signal: negative
principle: TUYỆT ĐỐI không chạy auto-build (pm2 lucy-autobuild / auto-build.py) — dù Bill yêu cầu hay Lucy tự thấy nên — khi CHƯA hỏi và được Bill CONFIRM rõ ràng. Phải hỏi trước mỗi lần.
created_at: 2026-06-16T01:00:00+07:00
agent: lucy
---

Bill chốt 2026-06-16: "bất cứ khi nào t yêu cầu chạy auto build hay m có ý định chạy, m PHẢI HỎI và được t confirm mới được chạy."

**Why:** Bill KHÔNG thể dừng auto-build giữa chừng (chạy nền độc lập session, đốt token mạnh). Mất kiểm soát = nguy hiểm + tốn token.

**How to apply:** Trước khi `pm2 start/restart lucy-autobuild` hoặc spawn agent build nền dài → DỪNG, hỏi Bill "chạy auto-build không?" + nêu sẽ làm gì + ước token, chờ Bill OK. KHÔNG tự suy diễn "Bill chắc muốn". Áp cho cả việc tự ý nối cụm/loop. Liên quan [[sig-2026-06-16-bridge-stop-and-anti-spam]] (Bill cần kiểm soát dừng) + [[report-every-task]].


**BỔ SUNG 2026-06-16:** mọi build NHIỀU BƯỚC (kể cả dự án repo RIÊNG như shader kit) PHẢI chạy qua `auto-build.py` (pm2 lucy-autobuild, SDK in-process, độc lập session). TUYỆT ĐỐI KHÔNG tự chế runner `claude -p`/setsid — bị giết khi Bill nhắn tin (process con của phiên bridge) + thiếu guard/cost-tracking = SAI CÁCH. Wire task vào MASTER-SPEC Phần V + AUTOBUILD_FOCUS.