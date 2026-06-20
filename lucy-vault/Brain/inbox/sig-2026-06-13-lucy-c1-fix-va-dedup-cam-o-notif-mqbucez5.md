---
kind: brain-signal
id: sig-2026-06-13-lucy-c1-fix-va-dedup-cam-o-notif-mqbucez5
created_at: 2026-06-13T04:14:06.545Z
topic: Lucy/c1-fix-va-dedup-cam-o-notify-ts
signal: negative
agent: engine
principle: "notify.ts hoàn toàn KHÔNG có dedup (Set/Map đều absent) — bước trước khai sai; smoke CASE1/3 xác nhận: mỗi call đều fire, không suppress. Engineer phải add Map<string,number> ở module-level trong notify.ts, suppress khi same key+same retryAfterMs, fire+log khi retryAfterMs đổi."
scope: tester
evidenced_by: [card_mqbrzabg19]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: notify.ts hoàn toàn KHÔNG có dedup (Set/Map đều absent) — bước trước khai sai; smoke CASE1/3 xác nhận: mỗi call đều fire, không suppress. Engineer phải add Map<string,number> ở module-level trong notify.ts, suppress khi same key+same retryAfterMs, fire+log khi retryAfterMs đổi.
