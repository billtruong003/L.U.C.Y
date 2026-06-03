# Lucy — Local Hub (web command center, tầng NẶNG)

> **Chốt 2026-06-03.** Kiến trúc 2 tầng theo sức máy: **VPS = tầng nhẹ** (research/comms/Aki),
> **LOCAL = tầng nặng** (code nhiều project + **web hub** này). Hub = cổng web bảo mật cao Bill vào
> để **ra lệnh cho Claude** + nhìn toàn cảnh. Build **lên trên Hermes dashboard** (cho cắm plugin tab +
> custom auth + backend route) → không code web từ số 0.

---

## 0. Một câu

Máy local chạy `hermes dashboard` (mở rộng bằng plugin). Bill vào qua **URL ổn định** (tunnel) — tìm
được kể cả khi IP đổi (VPS làm registry / tunnel). Đăng nhập **2 lớp (QR qua điện thoại)**. Bên trong:
**Chat · Running tasks · Projects (board + source tree) · Brain-viz sci-fi**. Lệnh ở đây → **Claude Code local** thực thi.

```
📱 Bill ──HTTPS──► [tunnel/IP] ──► LOCAL: hermes dashboard (+plugin hub)
                                      │  ra lệnh → Claude Code local (code nặng, repos)
                                      │  REST: chat/sessions/cron/kanban
   VPS (always-on) ◄── registry/tunnel: giữ URL hub, Lucy trả lời "hub ở đâu" qua Telegram
```

## 1. Sections (field) trong hub

| Section | Nội dung | Nguồn / độ khó | Phase |
|---|---|---|---|
| **Chat** | Hội thoại Lucy + ra lệnh, `!c` delegate Claude | Hermes dashboard Chat tab có sẵn (PTY/WS) — dễ | H1 |
| **Running tasks / Agents** | Task đang chạy live: delegate_task, cron, Kanban lanes (prompt, trạng thái, kill) | REST `/api/sessions` + `/agents` + Kanban — vừa | H2 |
| **Projects** | Mỗi project: **board** Kanban + info + **source tree** (code xem được, ảnh = node) | custom plugin tab — vừa | H2 |
| **Research / Money** | Render đẹp `research/<date>.md` + `TREND.md` (vàng/crypto/CK) — đọc brief ngày, so xu hướng | custom tab đọc file markdown — dễ-vừa | H2 |
| **Delegate console** | Bắn `!c <task>` từ hub, xem output Claude Code live + file markdown nó tạo (như luồng cat.moe) | REST + stream stdout — vừa | H2 |
| **Logs** | Xem agent/gateway/error/cron log, filter + live tail (xem §1b) | Hermes Logs tab/`/api/logs` có sẵn — dễ | H1 |
| **Cost / Usage** | Token + chi phí: grok ($) + Claude (rate-limit quota) — canh budget $10/năm + né cháy quota | Hermes Analytics `/api/analytics` — dễ | H2 |
| **Memory** | Xem/sửa `MEMORY.md` + `USER.md` (Lucy biết gì về Bill) | Hermes Memory API — dễ | H2 |
| **Artifacts / Files** | Kho output: research, blog/doc Claude tạo, file upload (cat.moe…) | custom tab + file API — vừa | H2 |
| **Brain-viz** | Cục năng lượng + dây nối LLM chạy khi active (Iron Man) | three.js + telemetry stream | H3 ⭐ QUAN TRỌNG, KHÔNG drop |

## 1b. Logging — log lủng thế nào

Hermes sẵn có: `~/.hermes/logs/{agent,gateway,errors}.log` + session trajectories `~/.hermes/sessions/*.json`.
Lucy bổ sung **structured log** để hub đọc + canh tiền/quota:

| Log | Ghi gì | Dùng để |
|---|---|---|
| **activity** | mỗi tương tác Telegram / cron run / delegate: timestamp · ai · prompt tóm tắt · kết quả | dòng thời gian "Lucy làm gì hôm nay" |
| **delegate/claude** | mỗi `!c`/delegate: prompt · `session_id` Claude · cost_usd · duration · file output | truy vết việc nặng + chi phí Claude |
| **research** | mỗi brief ngày: date · nguồn · model · cost · path file | nhật ký research, so ngày qua ngày |
| **cost** | gộp theo ngày: token+$ grok · quota Claude đã dùng | canh **$10/năm** + né cháy rate-limit |
| **errors** | lỗi API/tool kèm context (như 400 out-of-extra-usage đã gặp) | debug |

Nguyên tắc: **1 dòng = 1 sự kiện, có timestamp + level + component** (gateway/agent/cron/delegate). Hub tab **Logs**
= filter theo component/level + live tail; tab **Cost** đọc từ log cost. Prune log cũ (xem [VPS_CLEANUP.md](VPS_CLEANUP.md) §4).
Cách rẻ để có structured log: **shell hook `post_tool_call` / `on_session_end`** của Hermes ghi 1 dòng JSON vào `~/.hermes/logs/lucy-activity.jsonl`.

### Source tree (trong Projects) — visualize, KHÔNG show hết
- Cây file/folder của project (tree), click để xem.
- **Code:** xem được nội dung (Bill muốn nhìn code).
- **Cục nặng (ảnh/binary):** chỉ là **node/icon** trên cây, không render nội dung.
- Mục đích: nhìn cho dễ, không phải IDE. Chỉ "visualize sources như tree".

## 2. Bảo mật (cao — vì hub điều khiển Claude trên máy Bill)

Hub này **ra lệnh chạy code trên máy local** + lộ ra mạng → bề mặt nguy hiểm. Bắt buộc:

| Lớp | Cách | Ghi chú |
|---|---|---|
| **2FA qua điện thoại** | ✅ **CHỐT — Telegram-approve:** login → Lucy gửi nút "Duyệt?" vào Telegram Bill → bấm mới vào. Tái dùng kênh sẵn, đúng "qua đth", không cần authenticator app. | locked |
| Cổng OAuth | Hermes dashboard auto-gate khi `--host` non-loopback; cắm custom `DashboardAuthProvider` | có sẵn cơ chế |
| Kênh mã hóa | **Tunnel HTTPS** (Cloudflare Tunnel / Tailscale) thay vì IP thô | NAT traversal + TLS |
| Allowlist | chỉ thiết bị/identity của Bill | |
| Audit | dashboard logs + auth log | |

> ⚠️ KHÔNG mở `--insecure` ra mạng. KHÔNG để IP thô không TLS.

## 3. Vào hub qua VPS — ✅ CHỐT: reverse SSH tunnel (self-hosted, repo thống nhất)

Local mở **SSH ngược** lên VPS (IP cố định) → VPS forward về hub local:
```bash
# trên local, giữ sống bằng autossh (script trong repo):
autossh -M 0 -N -R 0.0.0.0:8443:localhost:<HUB_PORT> root@<VPS_IP>
# VPS sshd cần: GatewayPorts yes ; nginx terminate TLS 8443 → hub
```
- Bill vào bằng **IP cố định của VPS** (đúng "ip thô" Bill thấy ok — nhưng IP *VPS*, không phải local hay đổi).
- IP local đổi / sau NAT → **không sao** (local chủ động nối ra).
- **Không SaaS ngoài** (bỏ Cloudflare/Tailscale) → chỉ SSH + script `autossh` **nằm trong repo** → đúng **repo thống nhất**.
- TLS HTTPS terminate ở VPS (nginx). Cổng vẫn nằm sau 2FA (§2).
- *(Phương án thô hơn: hub đăng ký IP local lên VPS, Bill hỏi Lucy "hub ở đâu" — kém bền, cần port-forward. Bỏ.)*

## 4. Build lên trên Hermes dashboard (vì sao không từ số 0)

Hermes dashboard ([web-dashboard.md](../hermes-agent/website/docs/user-guide/features/web-dashboard.md)) cho:
- **Plugin tab riêng** → thêm Projects / Brain-viz / Running-tasks.
- **Custom `DashboardAuthProvider`** → cắm 2FA (Telegram-approve / TOTP).
- **Backend route riêng** (FastAPI) → API cho source-tree, registry, kanban.
- **Theme riêng** → skin sci-fi.
- Sẵn có: Chat tab, Sessions, Cron, Skills, MCP, analytics.

→ Frontend custom (React + three.js) nhúng làm **plugin tab**; backend = Hermes REST + route thêm. Tái dùng ~70%.

✅ **CHỐT — build kiểu plugin.** Thiết kế **modular/sạch để sau share lên community Hermes** (không hardcode riêng Bill).
Plugin + script tunnel + bridge **đều sống trong `lucy/`** (đúng **repo thống nhất**) — folder dự kiến `lucy/dashboard/` (hub plugin) + `lucy/bridge/` (tunnel/registry).

## 5. Phases (đừng làm 1 phát)

| Phase | Làm gì | Ghi chú |
|---|---|---|
| **H1** | `hermes dashboard --host` qua **reverse SSH tunnel** + **2FA Telegram-approve** + Chat tab | hub tối thiểu: vào an toàn, ra lệnh Claude |
| **H2** | Tab **Running tasks** + **Projects** (board + source tree) | dùng REST + custom route |
| **H3** | **Brain-viz** sci-fi (three.js + telemetry stream) | ⭐ Bill nhấn QUAN TRỌNG — làm cuối nhưng **bắt buộc có, không drop** |

> Đây là **tầng LOCAL**, độc lập với VPS. Không chặn build VPS (research/comms/Aki). Làm song song / sau.

## 6. Decisions — ✅ ĐÃ CHỐT (2026-06-03)
- [x] **2FA = Telegram-approve** (Lucy gửi nút Duyệt → bấm trên đth).
- [x] **Vào hub = reverse SSH tunnel local→VPS** (vào bằng IP cố định VPS; self-hosted; script trong repo).
- [x] **Brain-viz = phase H3 (cuối)** nhưng ⭐ **QUAN TRỌNG, không drop**.
- [x] **Build kiểu plugin** trên Hermes dashboard; modular để **share community** sau; sống trong `lucy/`.

## 7. Tham chiếu
- Mở rộng [FEATURES §6](FEATURES.md) (dashboard + brain-viz). Kiến trúc não: [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md).
- Dashboard gốc: [../hermes-agent/website/docs/user-guide/features/web-dashboard.md](../hermes-agent/website/docs/user-guide/features/web-dashboard.md) + [extending-the-dashboard.md](../hermes-agent/website/docs/user-guide/features/extending-the-dashboard.md).
