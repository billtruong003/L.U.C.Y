# lucy/hermes — Hermes profile + OmniRoute routing

Não của Lucy = **Hermes Agent + Claude**, nhưng mọi LLM call đi qua **OmniRoute**
(self-host trên VPS) thay vì gọi thẳng `api.anthropic.com`.

## Tại sao OmniRoute

Gọi Claude trực tiếp bằng token **Claude Max OAuth** + custom system prompt bị
Anthropic tính là *"extra usage"* và chặn (blocker đã ghi trong memory). OmniRoute
đứng giữa: giữ **Claude OAuth connection** và forward request hộ, nên Lucy/Hermes
chỉ cần nói chuyện với một endpoint nội bộ thống nhất (`localhost:20128`) —
đồng thời sau này dễ fail-over sang model rẻ (Gemini/Kimi/…) trong cùng router.

## OmniRoute đang chạy thế nào (VM/Docker version)

| | |
|---|---|
| Bản | OmniRoute **3.8.7** (jmvb stable fork — Claude OAuth working) |
| Chạy | Docker image `diegosouzapw/omniroute:latest`, container `omniroute` |
| Port | `20128` (dashboard + API `/v1/messages`, `/v1/chat/completions`, `/v1/models`) |
| Env | `/opt/omniroute/.env` (JWT/secret + `INITIAL_PASSWORD` để login dashboard) |
| Data | docker volume `omniroute-data` (`/app/data`) |

Lệnh chạy lại nếu cần:
```bash
docker run -d --name omniroute --restart unless-stopped \
  --env-file /opt/omniroute/.env -p 20128:20128 \
  -v omniroute-data:/app/data diegosouzapw/omniroute:latest
```

> Bản fork build-from-source quá nặng cho VPS 2 vCPU / 2 GB (Next.js build OOM/thrash),
> nên đang dùng image dựng sẵn — cùng app, cùng provider Claude OAuth.

## Brain hiện tại: Grok-4.3 (xAI) — KHÔNG phải Claude OAuth

**Quyết định:** Lucy/Hermes chạy trên **`xai/grok-4.3`** qua OmniRoute (xAI API key,
billed-by-API). Đã test agent thật (17 tools + persona 13K token) → **200 OK**, và
gateway Telegram connect OK.

**Vì sao không dùng Claude Max OAuth (`cc/claude-opus-4-8`):** đã login OAuth thành
công (truongbill003@gmail.com, dashboard → Providers → Claude), và request *nhỏ* qua
được. Nhưng request **thật** của Hermes (persona + tools `mcp_*`) bị Anthropic phân
loại metered → `400 "out of extra usage"` (tài khoản hết extra usage). Claude Max
subscription không cấp free cho traffic bot; né cổng tính tiền đó = vi phạm ToS nên
không làm. Chi tiết: [[hermes-claude-max-oauth-extra-usage]].

**Provider trong OmniRoute:** `xai` connection (id `cfce2240…`), defaultModel `grok-4.3`.
Fallback đề xuất: `xai/grok-4.20-0309-reasoning`. Key local: `/opt/omniroute/.xai_key`.

## Routing model trong OmniRoute

OmniRoute route bằng prefix provider: `xai/grok-4.3` → provider `xai`, model `grok-4.3`.
Hermes (provider=anthropic) gửi nguyên model string; OmniRoute convert
anthropic_messages ↔ OpenAI cho xAI.

> Gotcha (từ lần thử Claude): đừng alias `<model>` → `<prefix>/<model>` (vd
> `claude-opus-4-8 → cc/claude-opus-4-8`) — sau khi strip prefix nó loop, gửi
> `prefix/...` thẳng upstream → 404 + cooldown. Hiện không cần alias nào cho Grok.

## Wire vào Hermes (ĐÃ áp dụng cho /root/.hermes — đang chạy Telegram)

1. `config.yaml`: `model.provider=anthropic`, `model.base_url=http://localhost:20128`,
   `model.default=xai/grok-4.3`.
2. `.env`: `ANTHROPIC_BASE_URL=http://localhost:20128` + `ANTHROPIC_API_KEY=<token-bất-kỳ>`.
3. xAI key đã add vào OmniRoute (connection `xai`), không để trong Hermes .env.
4. Khởi động gateway: `hermes gateway run --accept-hooks` (hoặc `hermes gateway install`
   để chạy nền như systemd service).

Backup config gốc: `/root/.hermes/config.yaml.bak-omniroute-20260602`.

## Kiểm tra nhanh

```bash
# inference qua OmniRoute (anthropic-style) -> Grok
curl -s http://localhost:20128/v1/messages \
  -H 'content-type: application/json' -H 'anthropic-version: 2023-06-01' \
  -H 'x-api-key: omniroute-local' \
  -d '{"model":"xai/grok-4.3","max_tokens":16,"messages":[{"role":"user","content":"ping"}]}'

# trạng thái gateway Telegram
hermes gateway status
```
