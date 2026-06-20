---
name: token-guard-single-source
description: token-guard coordinator = NGUỒN DUY NHẤT đếm token/ngày; mọi path report qua reportTok/report_tok + flag LUCY_TOKEN_REPORT
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e18f4bb-2d4f-4711-9846-ef8c006b6893
---

**LIMIT 2026-06-17 (Bill chốt):** soft `AM_DAY_TOKEN_SOFT=40M` (đèn cảnh báo "biết đốt bao nhiêu") · hard `AM_DAY_TOKEN_HARD=150M` (hiếm chạm, KHÔNG chặn gắt). Set runtime qua `POST coordinator /config {tokenSoft,tokenHard}` (engine.setLimits) + persist trong `ecosystem.config.cjs` LIM. Default cũ 500k/1M = phi thực tế → banner "⛔ DỪNG ngáo" cả ngày dù việc vẫn chạy. ⚠️ "Token/ngày 0 / Chi phí hôm nay $0" trên Dashboard = đọc **agent-machine /metrics** (chỉ worker anime, hôm nay 0) — KHÁC token-guard 47M (auto-build/hub/bridge gom B1) → nhìn mâu thuẫn; muốn hết "ngáo" phải cho widget đọc token-guard `used` + gắn nhãn scope (chưa làm, cần 1 build hub nhỏ).

B1 (DONE 2026-06-16): MỌI đường tiêu token cộng vào token-guard CHUNG qua `POST coordinator /token-guard/add {inTok,outTok}` (NGUỒN DUY NHẤT — đừng đếm song song). `inTok` LUÔN gồm cache (input+cache_read+cache_creation) parity hub `index.ts:208`/bridge.

Điểm report (flag `LUCY_TOKEN_REPORT` mặc định BẬT, fire-and-forget, lỗi→bỏ qua):
- **hub** `reportTok()` (index.ts): claude-path usage event · lane agentic · lane chat thuần · /api/prompts/run.
- **agent-machine**: `chatLane` trả `usage:{inTok,outTok}` · `runPromptArchitect` trả `usage` (từ callLLM prompt/completion_tokens).
- **auto-build.py** `report_tok(m.usage)` sau ResultMessage (urllib).
- **cron claude -p**: helper chung `bridge/report_tok.py "$RES"` (đọc usage từ `--output-format json`) ở cron_brief/vn/tech/trend.
- **bridge** (PT): `_report_tok` đã có sẵn. Xem [[pt-telegram-token-parity]].

Live-verify recipe: hub password env = `LUCY_HUB_PASSWORD` (KHÔNG phải PASSWORD); login `POST /login {password}` → cookie → chạy lane → check `GET /token-guard` `.status.used` tăng. Hard-limit vượt (vd used 5.6M > 1M) chỉ PAUSE autopilot engine, hub chat vẫn chạy.

Coordinator creds cho script ngoài hub: env `AM_COORD_URL`/`AM_TOKEN`, fallback đọc `hub/server/.env` (token thật 48-ký-tự).
