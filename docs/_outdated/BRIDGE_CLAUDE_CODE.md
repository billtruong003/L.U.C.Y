# Lucy — Kiến trúc Não: thân grok + `!c` triệu hồi Claude Code

> **Chốt 2026-06-03.** Lucy = **thân Hermes (model rẻ, always-on)** + **não Claude Code (gọi khi cần)**.
> Không có "AI trung gian quyết hộ" — **Bill** quyết khi nào dùng Claude bằng command `!c`.
> Nguồn khám phá: [`../hermes-agent/`](../hermes-agent/). Giá: search 6/2026 (xem cuối).

---

## 0. Một câu

```
Telegram ─► HERMES (THÂN: grok-4.1-fast-reasoning, xAI thẳng, always-on)
   ├─ tám · cron research · voice · thao tác máy routine     → grok tự xử (~$10/năm)
   └─ Bill gõ  !c <task>  → claude -p "<task>" --output-format json
                                 → CLAUDE CODE (NÃO thật: model+tool+OAuth riêng) → trả kết quả
```

- **Thân** = grok 4.1 fast reasoning: rẻ ($0.20/$0.50 per 1M, cached $0.05/M), đủ khôn (frontier-adjacent).
- **Não** = Claude Code, chỉ bật khi `!c` → việc code agentic / suy luận sâu.
- Hai mặt phẳng auth **tách biệt**: grok dùng xAI API key; Claude Code dùng OAuth riêng (`~/.claude`).

---

## 1. Vì sao tiered (thân rẻ + não gọi) > dùng Claude mọi lượt

| Loại việc | grok 4.1 fast | Claude Code | Khác biệt |
|---|---|---|---|
| Tám, nhắc nhở, tóm tắt research, dispatch, máy routine | đủ tốt | hơn chút | **nhỏ** |
| Code agentic (đọc/sửa/chạy/debug repo, PR) | yếu | vượt trội | **lớn** |
| Suy luận sâu nhiều bước | khá | rõ hơn | vừa–lớn |

→ ~80-90% việc hằng ngày: grok đủ. Claude thắng rõ ở **coding + deep-reasoning** — đúng lúc gõ `!c`.
Dùng-Claude-mọi-lượt chỉ tốt hơn tí ở việc dễ nhưng **đốt rate-limit subscription + chậm mọi tin**.

**"Tốn" của Claude là rate-limit, không phải $.** Claude Max = flat; nhưng bắn mọi tin/cron vào Claude
→ cháy quota 5h/tuần → Lucy đơ tới lúc reset. Tiered bảo vệ quota: Claude chỉ chạy khi Bill gọi.

---

## 2. Vì sao "không đụng tầng link" — đã giản lược nhờ provider=xai (native, non-anthropic)

Lo gốc: nếu Hermes route model qua **native Anthropic**, nó đọc `~/.claude/.credentials.json` của
Claude Code ([anthropic_adapter.py:1102-1143](../hermes-agent/agent/anthropic_adapter.py#L1102)) → cướp
OAuth → `400 out of extra usage`. Cơ chế: `_is_native_anthropic = provider=="anthropic"`
([agent_init.py:607](../hermes-agent/agent/agent_init.py#L607)).

**Cách chặt nhất (đang dùng, đã validate 2026-06-03):** đặt **`provider: xai`** (native, đọc `XAI_API_KEY`).
Bất kỳ provider ≠ "anthropic" ⇒ `_is_native_anthropic=False` → `resolve_anthropic_token()` **không bao giờ**
chạy → Hermes **không bao giờ** đọc `~/.claude`. Landmine biến mất, không cần "luật cách ly dummy-key" bản cũ.
Còn 1 việc: **ghim auxiliary về `main`** (đừng `auto`) để vision/compress không lén rơi xuống native Anthropic.
> ⚠️ Đừng dùng `provider: custom` — nó KHÔNG đọc `OPENAI_API_KEY` (tự điền "not-needed" → xAI 400). Dùng `xai`.

> Claude Code khi bị Hermes spawn `claude -p` thì tự đọc OAuth của nó; Hermes scrub env nên không lẫn key.

---

## 3. `!c` hoạt động thế nào (gần như 0 code)

- Persona Lucy + 1 luật: "khi message bắt đầu bằng `!c`, dùng skill [claude-code](../hermes-agent/skills/autonomous-ai-agents/claude-code/SKILL.md) chạy phần còn lại."
- grok 4.1 fast thừa sức nhận diện `!c` và shell sang Claude — không cần shim/app riêng.
- Lệnh chuẩn (print mode, sạch nhất):
```
terminal(command="claude -p '<task>' --output-format json --allowedTools 'Read,Edit,Bash' \
                 --max-turns 10 --max-budget-usd 1.0", workdir="<repo>", timeout=180)
```
  `--output-format json` → parse `result` + `session_id`. `--max-turns/--max-budget-usd` chặn cháy.
  `-p` bỏ mọi dialog → hợp automation. Multi-turn lặp → tmux (SKILL.md §Mode 2), P sau mới cần.

---

## 4. Caveat
- **Trễ:** mỗi `!c` = 1 lần `claude -p` (vài giây→1-2 phút). Bump `agent.gateway_timeout` của Hermes.
- **Cron + Claude:** cron auto-deny dangerous-command; muốn Claude chạy lệnh trong cron phải set
  `approvals.cron_mode: approve` — chỉ bật cho job tin được.
- **Output truncate** ~50KB ở terminal Hermes → việc to ghi file rồi đọc lại.

## 5. Verify (trên VPS)
- [ ] `hermes gateway status` → body sống (grok).
- [ ] `claude auth status` → não có OAuth riêng.
- [ ] Gửi `!c echo hi` qua Telegram → trả về JSON từ `claude -p`.
- [ ] `config.yaml` provider=xai + auxiliary ghim `main` (không `auto`) + key = `XAI_API_KEY` + KHÔNG có ANTHROPIC_* trong .env.
- [ ] grep log Hermes: 0 request tới `api.anthropic.com`.

## 6. Bị loại (ghi để khỏi quay lại)
- ❌ grok làm middleman *quyết hộ* khi nào gọi Claude — Bill không muốn AI khác quyết. Thay bằng `!c`.
- ❌ Shim "Claude là model mọi lượt" — đốt quota, chậm. Chỉ hợp nếu usage rất nhẹ.
- ❌ OmniRoute — chỉ để route Claude-OAuth, giờ thừa. Đã bỏ.

## 7. Nối kế hoạch
- Là động cơ **I4 Remote Dev Hand** ([MONEY_PLAYBOOK.md](MONEY_PLAYBOOK.md)).
- Phase: sau **P1** (Hermes+Telegram chạy) + cài `claude` CLI trên VPS.
- Refs: [../hermes/config.yaml](../hermes/config.yaml) · [../hermes/README.md](../hermes/README.md).

---
*Giá:* [pricepertoken grok-4.1-fast](https://pricepertoken.com/pricing-page/model/xai-grok-4.1-fast) · [grok pricing 5/2026](https://the-rogue-marketing.github.io/grok-xai-api-pricing-may-2026/) · *Gemini free siết:* [apiyi 4/2026](https://help.apiyi.com/en/google-gemini-api-free-tier-changes-april-2026-guide-en.html).
