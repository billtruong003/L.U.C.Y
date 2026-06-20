---
kind: brain-signal
topic: lucy/rehost-restart-ownership
signal: negative
principle: KHÔNG tự chạy pm2 restart/rehost VPS — chuẩn bị commit+push rồi để chủ nhân tự pull + restart bên mình
created_at: 2026-06-13T00:00:00Z
agent: lucy
---

Trong phiên 12-13/6, chủ nhân chặn lệnh `pm2 restart` của em **nhiều lần** — kể cả sau khi nói "rehost cho anh". Cuối cùng chốt: "push mới nhất lên để t pull về local dev tiếp".

**Why:** Chủ nhân muốn tự chủ bước host/restart (pull về local hoặc tự restart VPS), không để Lucy tự ý đụng tiến trình chung đang chạy. Việc phá-huỷ/đụng hệ chung (restart coordinator/hub/worker/autopilot) là việc chủ nhân tự quyết.

**How to apply:**
- Làm tới bước commit + push là DỪNG. Báo "đã push, sẵn sàng pull/rehost" rồi chờ.
- KHÔNG gọi `pm2 restart` trừ khi chủ nhân nói thẳng "chạy restart đi" ngay lúc đó (không suy diễn từ "rehost" chung chung).
- Verify (tsc/build/smoke) + push thì cứ chủ động; restart thì để chủ nhân.
- Liên hệ [[secret-handling-no-chat-no-echo]] · [[pref-lucy-owner-interaction-protocol]].
