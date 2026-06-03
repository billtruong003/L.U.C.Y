# lucy/hermes — Hermes profile (BODY của Lucy)

**Chốt 2026-06-03.** Hermes là **cái thân** always-on của Lucy. Model = grok rẻ. Não thật =
Claude Code, triệu hồi bằng `!c`. Chi tiết kiến trúc: [../docs/BRIDGE_CLAUDE_CODE.md](../docs/BRIDGE_CLAUDE_CODE.md).

## Model: grok-4.1-fast-reasoning (xAI thẳng)

| | |
|---|---|
| Body model | **`grok-4-1-fast-reasoning`** qua xAI API (OpenAI-compatible) — id dấu gạch ngang, [docs.x.ai](https://docs.x.ai/developers/models/grok-4-1-fast-reasoning) |
| Giá | $0.20/M in · $0.50/M out · cached $0.05/M · context 2M — "frontier-adjacent rẻ nhất" (5/2026) |
| Mục tiêu chi phí | ~**$10/năm** ở mức cá nhân (bật prompt caching + cron batch) |
| Cách wire | `config.yaml`: `provider: xai` (native), `base_url: https://api.x.ai/v1`. `.env`: `XAI_API_KEY=<xAI key>`. **Đã validate 2026-06-03.** |

Vì sao grok 4.1 fast (không phải grok-4.3 cũ): 4.3 mắc; 4.1-fast vừa rẻ vừa đủ khôn làm body +
dispatch. groq/Mistral yếu hơn; Gemini free đã bị siết (4/2026: Pro paywall, prepaid bắt buộc).

## Đã BỎ OmniRoute (2026-06-03)

OmniRoute (Docker, port 20128) sinh ra **chỉ** để giữ Claude-OAuth và forward cho Hermes —
né lỗi `400 out of extra usage` khi dùng Claude Max OAuth làm model bot. **Giờ không cần nữa:**
Claude không còn là model của Hermes; nó vào bằng `claude -p` subprocess (auth riêng). Nên:

- Gỡ container `omniroute`, free RAM trên VPS 2GB.
- `provider: xai` ⇒ `_is_native_anthropic=False` ⇒ Hermes **không bao giờ** đọc `~/.claude`
  ⇒ **landmine credential biến mất** (xem BRIDGE doc §isolation, đã giản lược).

## Não = Claude Code (qua `!c`)

- Body (grok) lo: tám, cron research, voice, thao tác máy routine, và **nhận `!c` → shell sang Claude**.
- Việc code agentic / suy luận sâu → `!c <task>` → Hermes chạy `claude -p "<task>" --output-format json`
  → Claude Code làm (OAuth + tool của chính nó) → trả kết quả. Bill chủ động gọi ⇒ không phí quota.
- Skill chính chủ có sẵn: [../hermes-agent/skills/autonomous-ai-agents/claude-code/SKILL.md](../hermes-agent/skills/autonomous-ai-agents/claude-code/SKILL.md).

## Kiểm tra nhanh (trên VPS)

```bash
# body sống chưa
hermes gateway status
# claude (não) có auth riêng chưa
claude auth status
# test brain bridge
claude -p 'echo hi' --max-turns 1 --output-format json
```

## Refs
- Kiến trúc não/cầu nối: [../docs/BRIDGE_CLAUDE_CODE.md](../docs/BRIDGE_CLAUDE_CODE.md)
- Web dashboard (IP + login + prompt): [../hermes-agent/website/docs/user-guide/features/web-dashboard.md](../hermes-agent/website/docs/user-guide/features/web-dashboard.md)
- Config mẫu thật: [../hermes-agent/cli-config.yaml.example](../hermes-agent/cli-config.yaml.example)
