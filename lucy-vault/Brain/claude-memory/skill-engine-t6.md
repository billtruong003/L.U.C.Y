---
name: skill-engine-t6
description: T6 skill engine — loader keyword progressive-disclosure + self-improve đề xuất dry-run + seed Lucy skill + tab Kỹ năng
metadata: 
  node_type: memory
  type: project
  originSessionId: e1da3c59-7aa5-4eb7-a8f7-53a4ddbf0710
---

T6 (2026-06-15) — Skill engine M3 LIVE.

- **Store**: `/root/lucy/skills/` (170 skill bundled Hermes + INDEX.md). Lucy seed riêng ở `skills/lucy/` (4: deploy-no-bridge, add-coordinator-endpoint, autobuild-phase, rehost) + section LUCY trong INDEX.md.
- **Loader** `agent-machine/src/skill-loader.ts`: parse INDEX (regex `- **name** — desc. · [\`path\`]`), keyword score bỏ-dấu name/desc, MIN_SCORE=3 TOP_N=2 CHAR_CAP=24k → `loadSkillBlock(card)` nối vào `buildSystemPrompt` (runner.ts) đúng layout cache-parity. `LUCY_SKILLS` = override DIR (KHÔNG phải flag bool). `skillsOverview()` = active(INDEX)+proposed(_proposed).
- **Self-improve** `skill-learn.ts`: `proposeSkillFrom(card, {drafter,apply,now,proposedDir})` — drafter model rẻ (auxComplete) inject-được; bóc JSON `{reusable,name,description,tags,steps}`; render SKILL.md `status: proposed` ghi `skills/_proposed/<slug>/` CHỈ khi `LUCY_SKILL_LEARN=1`. **DRY-RUN mặc định. KHÔNG auto-active** — proposed KHÔNG vào INDEX nên loader KHÔNG nạp (đó là cơ chế an toàn). CLI `npm run skill-learn`.
- **B6 (2026-06-16) — WIRED + ENABLED LIVE**: `engine.ts:distill()` (hook card DONE, fire-and-forget) nay gọi `proposeSkillFrom(c)` khi `skillLearnFlagOn()` → tự sinh đề xuất mỗi card xong (gate kép: cờ tắt = 0 token vì drafter mới chạy khi cờ bật; ghi đĩa vẫn tự-gate). Engine chạy TRONG `lucy-coordinator` (coordinator-main `new Engine`, KHÔNG phải worker). `LUCY_SKILL_LEARN=1` đã thêm vào `ecosystem.config.cjs` coordinator env + bật live (restart giữ env qua /proc). Verify live: `/skills` → `learnOn=true`; CLI sinh proposal thật `implement-design-tokens`. LLM key tự load `~/lucy/.env.llm` (llm-lane loadEnvFile default — coordinator KHÔNG cần LLM_ENV_FILE).
- **UI**: coordinator `GET /skills` → hub `GET /api/skills` (auth x-worker-token) → `amSkills()` → `Skills.tsx` tab `skills` nhóm Hệ thống.
- Smoke: smoke-skill 6 + smoke-skill-wire 8 + **smoke-skill-learn 25** (inject fake drafter, không spawn model).
- **DEFER**: M3.2-Jina embedding-match cần `buildSystemPrompt` async → rủi ro hot-path runner LIVE + phá prompt-cache. Keyword đủ dùng.

⚠️ Gotcha gặp khi verify: `ecosystem.config.cjs` fallback `AM_TOKEN='lucytok'` (7 ký tự) — token THẬT 48 ký tự ở `agent-machine/.env` + `hub/server/.env`. Coordinator-main KHÔNG load dotenv, lấy token từ env pm2. Verify /skills phải dùng token 48-ký-tự từ .env với header `x-worker-token` trên port 8780. Có nhiều process `coordinator-main` cũ (8799/8771/8772 = sandbox), pgrep dễ bắt nhầm — coordinator pm2 thật ở 8780. Liên quan [[pm2-live-services-not-ecosystem]].
