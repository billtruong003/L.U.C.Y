# Lucy — HANDOFF (điểm tiếp nối để về nhà làm tiếp)

> Cập nhật 2026-06-03 (chiều). Đọc file này là nối lại được toàn bộ ngữ cảnh. Chi tiết từng phần xem [docs/](docs/).

## TL;DR — đang ở đâu
**Lucy SỐNG end-to-end.** Body chạy trên VPS, chat Telegram, xưng "em/chủ nhân", tự giao việc nặng cho
Claude Code, trả báo cáo trung thực (đã test: báo cáo crypto BTC/ETH/BNB/XRP/USDT — Lucy báo đúng SOL không
có trong data, đánh dấu RSI/MACD là ước tính, không bịa). Body vừa **chuyển sang Mistral free** để cắt tiền.

## Kiến trúc (2 tầng)
```
VPS Vietnix 14.225.255.73 (always-on, NHẸ)        MÁY LOCAL (Windows, NẶNG)
─ Lucy BODY = CẦU NỐI ──────────────────          ─ Local Hub + coding ───────────
 Hermes gateway (Mistral medium free)              Hermes + dashboard plugin lucy-hub
   persona em/chủ nhân, KHÔNG execute               (inject-API + cockpit theme)
   → mọi việc thật: claude -p (dễ=sonnet/khó=opus)  Claude Code làm việc nặng
 + radiant-bot (Aki Discord) chạy chung
```
Luồng: **prompt ⟷ grok/mistral (cầu nối) ⟷ Claude (skill, thực thi) ⟷ response.**

## Trạng thái từng phần
| Phần | Trạng thái |
|---|---|
| VPS — Lucy body | ✅ sống, chat Telegram, dispatch Claude OK. Vừa đổi sang **Mistral medium** (cần chủ nhân xác nhận đã set key + restart). |
| VPS — dọn dẹp | ✅ doc [VPS_CLEANUP.md](docs/VPS_CLEANUP.md) — OmniRoute/Docker thừa (chủ nhân tự chạy audit). |
| Persona (SOUL.md) | ✅ em/chủ nhân + cầu nối-không-execute + dễ→sonnet/khó→opus + chống bịa + ranh giới process + ép claude -p (cấm tự web/bịa/bỏ cuộc). |
| Local — Hermes | ✅ cài native Windows, grok-via-xAI đã validate. |
| Local — Hub plugin | ✅ `lucy-hub` (inject-API theo field + tab + theme cockpit) build + discover. ⚠️ inject-API **401** (dashboard gate) — external app chưa POST được. |
| Local — Hub UI | ❌ chủ nhân chê UI mặc định Hermes xấu → cần **build hub custom riêng** (chưa làm). |

## Cấu hình hiện tại (repo = nguồn chuẩn)
- **Body model:** `provider: custom` · `base_url: https://api.mistral.ai/v1` · `default: mistral-medium-latest`.
  Key Mistral đặt TRÊN BOX: `hermes config set model.api_key <key>` (custom KHÔNG đọc env). Free: console.mistral.ai (Experiment: mọi model, 1B tok/tháng, **2 RPM**).
- **Fallback:** grok `provider: xai` · `grok-4-1-fast-reasoning` · key=`XAI_API_KEY` (.env).
- **Trim chống cháy token:** `reasoning_effort: low` · `compression.threshold: 0.4` · `session_reset: both` · `platform_toolsets.telegram` rút còn 6 tool (trước 33 tool = ~13K token/lượt → từng cháy 4M tok/$1.1).
- Files: [hermes/config.yaml](hermes/config.yaml) · [hermes/SOUL.md](hermes/SOUL.md) · [hermes/.env.example](hermes/.env.example).

## ✅ Đã validate (chạy thật)
- grok-4-1-fast qua provider=xai (local). Mistral medium đang chuyển (cần xác nhận).
- Persona em/chủ nhân + dispatch Claude (sonnet/opus) — qua báo cáo crypto thật.
- Anti-hallucinate: Lucy báo SOL không có data + đánh dấu chỉ báo là ước tính.
- Inject-API ghi/đọc theo field (chỉ kẹt auth 401 cho external).

## 🔴 PENDING / việc tiếp (ưu tiên)
1. **🔐 ROTATE key xAI đã lộ** (paste ở chat + /opt/omniroute/.xai_key). Revoke ở console.x.ai, tạo mới. CHƯA làm.
2. **Xác nhận Mistral chạy ổn trên VPS** (set key + restart + /new). Nếu medium lú → large; chậm → small.
3. **Đo lại token** sau trim (kỳ vọng tụt mạnh so 4M).
4. **Hub UI custom** (bỏ khung Hermes): hướng A = `tab.override:"/"` thay sạch mặt tiền (giữ backend/inject-API); hướng B = SPA riêng. Chốt A/B rồi build.
5. **Fix cửa inject-API 401** (external app POST): tách ingest service riêng / webhook, ngoài gate dashboard.
6. **P2 cron research 1×/ngày** → 2 file (vàng/crypto/CK) → Telegram. **P3** đẩy Aki Discord (cần endpoint `/api/agent/*` radiant-bot — chưa có).
7. **Local Hub H1-H3** (LOCAL_HUB.md): tunnel reverse-SSH + 2FA Telegram-approve → Tasks/Projects/source-tree → brain-viz (⭐ quan trọng, làm cuối).

## ⚠️ Gotchas / bài học (đừng vấp lại)
- `provider: custom` KHÔNG đọc `OPENAI_API_KEY`/env → key đặt `model.api_key`. (xAI thì provider=xai đọc XAI_API_KEY.)
- `hermes dashboard --host` MIGRATE đè config về `anthropic/claude-opus-4-8` → cướp `~/.claude` → 400. Set lại provider sau khi mở dashboard.
- Windows: `.js` MIME=text/plain → dashboard trắng (fix HKCU Content Type). 2 HERMES_HOME (`%LOCALAPPDATA%\hermes` vs `~/.hermes`) → ép HERMES_HOME. (VPS Linux sạch.)
- Token cháy = Hermes nhồi 33 tool + reasoning mỗi lượt → TRIM. Mistral free 2 RPM là nút thắt thật (không phải tiền).
- **Sau khi đổi SOUL/config phải `/new` trong Telegram** — session cũ cache đồ cũ (lý do từng "tao/mày").

## Cheat-sheet
```bash
# VPS deploy/update Lucy
cd ~/lucy && git pull && cp hermes/SOUL.md ~/.hermes/SOUL.md && pm2 restart lucy-hermes
# đổi/kiểm model
export HERMES_HOME=~/.hermes
hermes config set model.api_key <mistral-key>
hermes chat -q "ban la model gi?"
# local dashboard (test hub)
hermes dashboard --host 127.0.0.1 --port 9119 --tui   # http://127.0.0.1:9119, Ctrl+F5
```

## Bản đồ docs
[README.md](README.md) · não [docs/BRIDGE_CLAUDE_CODE.md](docs/BRIDGE_CLAUDE_CODE.md) · tiền [docs/MONEY_PLAYBOOK.md](docs/MONEY_PLAYBOOK.md) ·
features [docs/FEATURES.md](docs/FEATURES.md) · host [docs/DEPLOY.md](docs/DEPLOY.md) · dọn VPS [docs/VPS_CLEANUP.md](docs/VPS_CLEANUP.md) ·
hub [docs/LOCAL_HUB.md](docs/LOCAL_HUB.md) · plugin [dashboard/README.md](dashboard/README.md) · P1 [docs/P1_RUNBOOK.md](docs/P1_RUNBOOK.md).

## Repo
github.com/billtruong003/L.U.C.Y (branch main). VPS clone ở `~/lucy`. Local ở `d:\Projects\ArenaPK\lucy`.
hermes-agent/ = source upstream tham chiếu (gitignored).
