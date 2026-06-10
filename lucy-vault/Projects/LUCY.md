---
title: LUCY — dự án
type: project
tags: [project, lucy]
permalink: project-lucy
---

# LUCY (orchestrator)

## Quan sát
- [kiến-trúc] 3 phần: `bridge/` Python (Telegram → claude -p; `/fan` `/orch` `/auto`) + `agent-machine/` TS (card→pipeline engine) + `hub/` web (React/Vite, dark theme cyan) #kiến-trúc
- [engine] agent-machine: card chạy qua stage, mỗi stage = 1 persona × `claude -p`; có budget cap, loop-breaker (rework N lần → hỏi người), depth-breaker, delegate→child-card, `--resume` session cache, opus/sonnet split #engine
- [store] file-based: `cards.json`, `channels.jsonl`, `ledger.jsonl` — chưa SQLite #store
- [deploy] pm2 coordinator + worker live trên VPS (local-only); worker quay ra coordinator (NAT-friendly) #deploy
- [gateway] OmniRoute (`BillService/OmniRoute`) live, 7 provider free (Groq/Gemini/Cerebras/OpenRouter/Mistral/Zai/OpenCode-Zen) = lane model-rẻ; `claude -p` KHÔNG qua đây #gateway
- [hiện-tại] đang xây **M1 = trí nhớ (vault này)** — móng cho mọi năng lực sau #roadmap (xem docs/NORTH_STAR.md)

## Liên hệ
- thuộc_về [[user-bill]]
- liên_hệ [[project-radiant-bot]]
