---
name: pt-telegram-token-parity
description: PT bridge token-guard parity DONE code-only; token Telegram chỉ cộng vào guard chung SAU khi Bill restart lucy-bridge
metadata: 
  node_type: memory
  type: project
  originSessionId: 42f33835-bf0c-476d-aa97-1359d8a8a4df
---

Item 10 PT (MASTER-SPEC) DONE 2026-06-15: `bridge/lucy_bridge.py` giờ report token mỗi lượt vào token-guard CHUNG (`POST /token-guard/add`, coordinator NGUỒN DUY NHẤT) + counter cục bộ theo ngày + lệnh `/token`. inTok parity hub (input+cache_read+cache_creation). Flag `LUCY_TOKEN_REPORT` (mặc định BẬT). Memory đã parity sẵn từ trước (recall+episodic+vault add-dir).

**Why:** Bill: "chat từ hub có gì telegram phải có cái đó" — tránh quên context + đo token đủ.

**How to apply:** Code-only, KHÔNG restart lucy-bridge (409 shared bot token = việc Bill). Vậy nên token tiêu từ Telegram **chưa cộng vào guard** cho tới khi Bill restart bridge — nếu kiểm `/token-guard` thấy used không nhúc nhích từ Telegram thì đó là lý do, không phải bug. Smoke: `python3 bridge/smoke_token_parity.py` (18/18). Liên quan [[lucy-bridge-replaces-hermes]] · token-guard [[lucy-memory-phase0-recall-prefetch]].
