# Lucy Bridge — Telegram ↔ Claude Code trực tiếp (KHÔNG Hermes)

Bỏ Hermes. Bridge mỏng nối thẳng Telegram vào `claude -p` (Claude Code = brain thật trên VPS).
Hết dispatcher ngu, hết token-burn framework, hết config hell. Chi phí = subscription Claude.

```
Telegram (chủ nhân) ──► lucy_bridge.py ──► claude -p (brain + tool + memory + web) ──► trả về Telegram
                          (giữ phiên --resume, persona qua --append-system-prompt-file)
System cron 7h ──► cron_brief.sh ──► claude -p → báo cáo thị trường → Telegram
```

## Cần trước
- `claude` CLI đã cài + `claude login` (subscription) trên VPS. Kiểm: `claude -p "hi" --output-format json`.
- Python3 + `pip install requests telegramify-markdown`.
- Telegram bot token + user id của chủ nhân.

## Dựng (trên VPS)
```bash
cd ~/lucy/bridge
cp .env.example .env && nano .env        # điền TELEGRAM_BOT_TOKEN + LUCY_ALLOWED_USER_ID
pip install requests telegramify-markdown
# chạy thử:
set -a; . ./.env; set +a
python3 lucy_bridge.py                    # nhắn bot trên Telegram → Lucy trả lời
# always-on:
pm2 start lucy_bridge.py --name lucy-bridge --interpreter python3 \
  --cwd ~/lucy/bridge --env-from-file .env || \
  ( set -a; . ./.env; set +a; pm2 start "python3 lucy_bridge.py" --name lucy-bridge ) ; pm2 save
```
> Chưa biết user id? Chạy bridge, nhắn bot, gõ `/id` — nó in `user_id`. Dán vào `.env` rồi restart.

## Lệnh trong chat
| Lệnh | Tác dụng |
|---|---|
| (nhắn thường) | chat với Lucy — mặc định **Sonnet** (nhanh) |
| `!o <task>` | dùng **Opus** cho việc khó/sâu |
| `/fan` + mỗi dòng 1 task | **multi-agent song song** — nhiều task độc lập, mỗi lane 1 Claude agent |
| `/orch <mục tiêu>` | **orchestrator** — 1 agent lập plan → nhiều sub-agent song song → 1 agent tổng hợp (hiện rõ từng bước) |
| `/auto <mục tiêu>` | **autonomous** — chạy lặp tới khi Claude báo XONG (cap 8 vòng). Thêm "opus" đầu goal để dùng Opus |
| `/new` | quên ngữ cảnh, phiên mới |
| `/info` | xem engine/model/quyền/workdir |
| `/id` | xem chat_id / user_id |

Việc lớn 1 mục tiêu nhiều phần → cứ nhắn thường, Lucy tự dùng **subagent song song** (CLAUDE.md đã nudge).

## Daily brief (cron)
```bash
chmod +x ~/lucy/bridge/cron_brief.sh
crontab -e        # thêm dòng:
0 7 * * * /root/lucy/bridge/cron_brief.sh
```
→ 7h sáng: claude làm báo cáo thị trường (crypto/vàng/CK/macro) → gửi tóm tắt + file .md vào Telegram. **Deterministic** (cron gọi script, không qua model điều phối → không chế lệnh lung tung).

## 🌙 Dream đêm (cron — não tự học mỗi tối)
```bash
chmod +x ~/lucy/bridge/cron_dream.sh
crontab -e        # thêm dòng:
0 2 * * * /root/lucy/bridge/cron_dream.sh >> /root/lucy-workspace/dream-cron.log 2>&1
```
→ 2h sáng: gộp `Brain/inbox` signal → preference → `active.md` + dọn signal quá hạn + reindex recall. **0 token** (thuần deterministic). Có học được gì mới → Lucy nhắn Telegram "🌙 Dream đêm — em vừa gộp trí nhớ"; đêm nào không có gì → im lặng.

## 🔐 Bảo mật (đọc kỹ)
- `--permission-mode bypassPermissions` = claude chạy mọi tool KHÔNG hỏi (cần cho autonomous). → **Cửa duy nhất là allowlist `LUCY_ALLOWED_USER_ID`** (chỉ chủ nhân). Ai gửi sai id bị từ chối.
- Bot token + user id chỉ trong `.env` (gitignored). Không commit.
- claude dùng OAuth riêng (`~/.claude`) — KHÔNG dính Anthropic-bill kiểu Hermes.

## So với Hermes (vì sao bỏ)
| | Hermes body | Bridge này |
|---|---|---|
| Brain | mistral/grok yếu → hallucinate, chế lệnh ma | **Claude trực tiếp** (mạnh, bám persona) |
| Token | framework re-send context → cháy (190M/ngày) | claude tự quản context, không re-send thừa |
| Phức tạp | config hell, 33 tool, provider lằng nhằng | ~120 dòng |
