---
name: token-guard-default-trap
description: "Bug \"Claude hết token tụt lane\" thật ra do DEFAULT token-guard 500K/1M + pm2 không nạp env ecosystem"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b0b4297-a77a-4744-9bf6-108829691c4d
---

⭐ 2026-06-19 ROOT CAUSE (Bill khổ sở fix hoài không ra): banner "⚠️ Claude hết token, chạy lane (token-guard chạm hard-limit)" trên Telegram KHÔNG phải Claude/OAuth/Agent SDK hết — mà do:

1. `src/token-guard.ts` có `DEFAULT_SOFT/HARD` = **500K/1M** (mức smoke-test, KHÔNG phải 40M/150M như mọi người tưởng). Constructor: `Number(process.env[AM_DAY_TOKEN_SOFT]) || DEFAULT`.
2. Coordinator pm2 `lucy-coordinator` chạy **KHÔNG có env `AM_DAY_TOKEN_*`** → rơi về DEFAULT 500K/1M. Ngày đốt ~20M → vượt hard 1M → `hard:true` VĨNH VIỄN → bridge `_token_guard_hard()` (lucy_bridge.py:640,1270) thấy true → tụt lane TRƯỚC khi gọi Claude.
3. Sửa `ecosystem.config.cjs` (800M/1500M) là VÔ DỤNG: `pm2 restart` KHÔNG nạp env từ ecosystem (gotcha đã biết [[pm2-live-services-not-ecosystem]]).

**FIX:** nâng DEFAULT trong token-guard.ts → 800M/1.5B (nguồn chuẩn trong code, không lệ thuộc pm2 truyền env) + `pm2 restart lucy-coordinator` trần. VERIFY bằng số THẬT: `curl -H "x-worker-token:$AM_TOKEN" 127.0.0.1:8780/token-guard` → phải thấy softLimit/hardLimit đúng + `hard:false`. ĐỪNG tin lane model "đã load" — luôn query endpoint.

**Why:** lane model (mimo) đoán bừa "đã 800M" mà không verify, còn test lạc đề (`claude -p`, OmniRoute) trong khi bridge dùng Agent SDK. Bài học: token-guard = [[token-guard-single-source]], verify nguồn duy nhất qua /token-guard.

**How to apply:** mọi nghi vấn "Lucy tụt lane / hết token" → curl /token-guard xem used vs hardLimit TRƯỚC, đừng nghĩ Claude. Cũng từng có bug ép executor ở engine-dispatch.ts (isExecutor đè modelOverride) đã sửa.

Phụ: `lucy-vps-worker` tự spawn coordinator-main.ts từ `.worker/repos/Lucy/agent-machine` clone (ôm env cũ) → đẻ zombie chồng cổng 8780, dọn định kỳ bằng kill orphan (chừa pid giữ :8780).
