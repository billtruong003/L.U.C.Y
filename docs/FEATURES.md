# Lucy — Features (master list)

> Mục tiêu file: **bắt trọn mọi tính năng muốn có để không miss.** Mỗi mục có trạng thái:
> `core` (lõi P1-3) · `idea` (muốn, chưa lịch) · `later` (về sau, cần bàn riêng).
> Cập nhật mỗi khi nảy ý mới.

---

## 1. Bộ não & runtime

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 1.1 | Hermes Agent always-on trên VPS Ubuntu | core | self-improving, memory, subagent |
| 1.2 | **Thân = grok-4.1-fast-reasoning** (xAI thẳng, ~$10/năm) · **Não = Claude Code** qua `!c` | core | chốt 2026-06-03, bỏ OmniRoute. Xem [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md) |
| 1.3 | Persistent memory qua nhiều phiên | core | có sẵn trong Hermes |
| 1.4 | Tự tạo / cải thiện skill từ kinh nghiệm | idea | tính năng Hermes, để mở |

## 2. Kênh giao tiếp

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 2.1 | **Telegram personal** — chat + ra lệnh + thao tác máy + **voice** | core | line riêng Bill, full service |
| 2.2 | Discord — **chỉ text của Aki** (báo cáo), KHÔNG voice | core | Discord voice đã bỏ khỏi scope |
| 2.3 | Discord text — báo cáo gated Trưởng Lão + Tiên Nhân (qua Aki/control API) | core | |
| 2.4 | Voice memo Telegram → auto-transcribe | core | Hermes có sẵn |
| 2.5 | Zalo bridge (nhắn ngược qua Zalo) | later | Hermes KHÔNG có sẵn → custom (Zalo OA / n8n node) |

## 3. 🎙️ Voice — **CHỈ Telegram** (chi tiết ở VOICE.md)

> Voice là **async voice note** trên Telegram, không phải live call. Discord KHÔNG có voice.

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 3.1 | **Nghe** — Bill gửi voice note Telegram → transcribe | core | Hermes có sẵn transcribe |
| 3.2 | **Voice reply** (TTS → voice note Telegram) | core | **Bắt đầu: Edge TTS FREE built-in của Hermes** (toolset `tts`, no-GPU, no-key). Nâng cấp giọng riêng: MeloTTS-Vietnamese / VieNeu-TTS clone. (FEATURES cũ ghi MeloTTS làm base — sửa: Edge TTS có sẵn, đơn giản hơn.) Xem VOICE.md |
| 3.3 | Lucy có 1 giọng nhân vật riêng nhất quán | core | clone/chọn 1 giọng cố định |
| 3.4 | Cảm xúc / nhấn nhá theo nội dung | later | tùy engine |
| ~~3.x~~ | ~~Discord voice / wake word / VAD / realtime~~ | **bỏ** | Discord chỉ text Aki |

## 4. Research kiếm tiền (skills)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 4.1 | Cron 2 lần/ngày (giờ chưa chốt) | core | |
| 4.2 | 6 tracks: crypto core · new coins/narratives · alpha · gold · macro · content/data trends | core | |
| 4.3 | Output: `research/YYYY-MM-DD.md` + `TREND.md` (so ngày qua ngày) | core | |
| 4.4 | Báo cáo + đề xuất đầu tư → Discord (Trưởng Lão + Tiên Nhân) | core | |
| 4.5 | Skills cộng đồng: awesome-finance-skills, last30days-skill | idea | vet trước khi tin |
| 4.6 | MiroFish (mô phỏng bầy đàn dự đoán) | later | app riêng, nặng |
| 4.7 | Watchlist coin + loại vàng (XAU/SJC) | core (chưa chốt) | cần Bill chốt |

## 5. Điều khiển radiant-bot từ xa

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 5.1 | Control API `/api/agent/*` + HMAC trong radiant-bot | core | mở rộng từ `/api/contribute` |
| 5.2 | Ra lệnh từ Telegram → Aki làm việc trong Discord | core | whitelist hành động + khóa Telegram user ID |
| 5.3 | Lucy đẩy báo cáo → Aki phát (một giọng text duy nhất) | core | |

## 6. Web dashboard

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 6.0 | **Hermes admin dashboard built-in** — `hermes dashboard --host 0.0.0.0`: web qua IP + **OAuth login** + tab **Chat (nhập prompt)** + **Cron** (nhắc nhở ra Telegram/Discord) + quản config/keys/sessions/skills/MCP | core (có sẵn) | ⚠️ public IP **bắt buộc** HTTPS+firewall+OAuth, KHÔNG `--insecure`. Cài `hermes-agent[web,pty]`. Doc: [web-dashboard.md](../hermes-agent/website/docs/user-guide/features/web-dashboard.md) |
| 6.0b | Nhắc nhở "project dang dở" → cron job đọc tasks/git/Notion(MCP) → ping đa nền tảng | idea | cần nguồn sự thật project (file/GitHub/Notion) |
| 6.0c | **Local Hub** — cổng web tầng-nặng (bảo mật 2FA QR, sections Chat/Running-tasks/Projects+source-tree, ra lệnh Claude) | idea | **spec riêng:** [LOCAL_HUB.md](LOCAL_HUB.md). Build trên Hermes dashboard plugin |
| 6.1 | (brain-viz riêng) Cục năng lượng giữa + dây nối tới từng LLM — **thuộc Local Hub phase H3** | idea | three.js/canvas; xem [LOCAL_HUB.md](LOCAL_HUB.md) |
| 6.2 | Dòng năng lượng chạy khi LLM đó active | idea | **cần telemetry live** (phần khó) |
| 6.3 | Telemetry: Hermes + LLM router bắn event qua WebSocket/SSE | idea | làm TRƯỚC viz |
| 6.4 | Web dashboard host billthedev / VPS | idea | |

## 7. Money spectrum (định hướng — đọc kỹ)

| Mức | Trạng thái | |
|---|---|---|
| AI hỗ trợ quyết định (research/alpha) | core | ✅ lõi, bắt đầu ở đây |
| AI làm content → ra tiền | idea | ✅ hợp Bill |
| AI tự trade tiền thật | later | ⚠️ rủi ro cao, read-only trước, cần bàn riêng |
| AI tự kiếm tiền hoàn toàn | — | ❌ phần lớn là hype |

---

# Phần B — Tính năng theo nhu cầu người dùng (backlog để build thêm)

> Nghĩ theo "Bill cần gì ở 1 personal AI luôn-bật". Neo vào năng lực Hermes thật (cron, memory, MCP,
> skills, tts/stt, vision, webhook, dashboard, session-search, delegation) + `!c` Claude. Status như trên.

## 8. Chủ động (proactive — Lucy tự mở lời, không chỉ chờ hỏi)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 8.1 | **Brief sáng** — chào + lịch hôm nay + thị trường (watchlist) + việc dang dở | core | cron job buổi sáng → Telegram |
| 8.2 | Cảnh báo theo điều kiện (giá coin/vàng vượt ngưỡng, tin nóng) | idea | cần data feed + cron check |
| 8.3 | Nhắc việc dang dở (đọc tasks/git/Notion → ping đa nền tảng) | idea | xem §6.0b — cần nguồn sự thật project |
| 8.4 | Check-in khi Bill im lâu / task bị treo | idea | |
| 8.5 | Tóm tắt cuối ngày (làm gì, còn gì, mai gì) | idea | cron tối |

## 9. Trí nhớ & cá nhân hóa (Lucy "biết" Bill)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 9.1 | Memory bền `MEMORY.md` + `USER.md` | core | Hermes built-in |
| 9.2 | Học preferences / lịch / giọng văn của Bill | core | qua USER.md + nudge |
| 9.3 | Nhớ watchlist, project đang chạy, quyết định cũ | core | |
| 9.4 | Honcho — user-modeling sâu xuyên phiên | idea | cần `honcho-ai` |
| 9.5 | Persona Lucy nhất quán (anime girl sắc sảo, mê data) | core | system prompt |

## 10. Quản lý task & project

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 10.1 | Bắt TODO từ chat ("nhắc tôi…") → lưu + nhắc đúng giờ | core | cron + memory |
| 10.2 | Theo dõi việc dang dở across repo (Arena/Lucy/radiant-bot) | idea | đọc git status / tasks folder |
| 10.3 | Follow-up tự động việc quá hạn | idea | |
| 10.4 | Liên kết GitHub issues / Notion | idea | qua MCP (§14) |

## 11. Second brain (lưu & truy hồi)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 11.1 | Lưu ý tưởng nhanh (kiểu Bill dump md) → kho note | core | |
| 11.2 | Search hội thoại cũ (FTS5 + summarize) | core | Hermes session-search có sẵn |
| 11.3 | Tóm tắt link/bài/PDF/doc Bill gửi | core | web_extract + đọc file |
| 11.4 | Tổ chức research output (`research/*.md` + `TREND.md`) | core | xem §4 |

## 12. Trợ lý giao tiếp

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 12.1 | Draft tin nhắn / email / comment | core | |
| 12.2 | Dịch VN↔EN (Bill song ngữ) | core | |
| 12.3 | Tóm tắt thread/chat dài | core | |
| 12.4 | Soạn nội dung theo giọng Bill | idea | cần học style |

## 13. Coding / dev qua `!c` (chi tiết — xem [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md))

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 13.1 | Remote dev hand: fix bug/feature → PR (I4) | core | `!c` → claude -p |
| 13.2 | Code review / PR review / security review | core | claude `/review` `/security-review` |
| 13.3 | Hỏi-đáp codebase, debug từ xa | core | |
| 13.4 | Worktree song song nhiều task | later | claude `-w` / tmux |

## 14. Tích hợp ngoài (MCP + webhook)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 14.1 | MCP: Gmail (đọc/rep), Calendar, Notion, GitHub | idea | cắm MCP server, OAuth từng cái |
| 14.2 | Webhook: event ngoài (CI, GitHub, alert giá) → Lucy phản ứng | idea | Hermes webhook subscription |
| 14.3 | API server (gọi Lucy từ script/app khác) | idea | `API_SERVER_ENABLED` |

## 15. Đa phương tiện

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 15.1 | Đọc ảnh: chart, screenshot lỗi, ảnh chụp | idea | vision — cần model multimodal (grok fast có thể không nhận ảnh → thêm key gemini/openrouter) |
| 15.2 | Gen ảnh cho content | later | cần FAL_KEY |
| 15.3 | Đọc PDF / doc Bill gửi | core | |
| 15.4 | Voice in/out (xem §3) | core | Edge TTS + faster-whisper |

## 16. An ninh & kiểm soát chi phí

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 16.1 | Allowlist chỉ Bill (Telegram user ID) | core | QUAN TRỌNG |
| 16.2 | Approval gate lệnh nguy hiểm (cron auto-deny) | core | `approvals` |
| 16.3 | Budget/quota cap (grok $ + Claude rate-limit) | core | caching + max-budget cho `!c` |
| 16.4 | Audit log (dashboard logs + analytics chi phí) | core | |
| 16.5 | Kỷ luật secret: chỉ VPS, không paste, key sàn read-only | core | đã có ở README |

## 17. Tài chính chi tiết (mở rộng §4)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 17.1 | Watchlist coin + vàng (XAU/SJC) theo dõi | core | chưa chốt danh sách |
| 17.2 | Alert theo điều kiện (giá / RSI / tin) | idea | cần data + cron |
| 17.3 | Portfolio note (read-only, KHÔNG tự trade) | later | money spectrum §7 |
| 17.4 | Nhắc risk management / nhật ký lệnh | idea | |
| 17.5 | Backtest đơn giản | later | |

## 18. Reliability / ops

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 18.1 | pm2 always-on + auto-restart | core | như radiant-bot |
| 18.2 | Health heartbeat / báo khi lỗi | idea | |
| 18.3 | Fallback model (grok lỗi → dự phòng rẻ khác) | idea | Hermes fallback chain |
| 18.4 | Backup memory/config/research định kỳ | idea | cron |

## 19. Thao tác web & máy như người (browser / computer-use / YouTube)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 19.1 | **Browser automation built-in** — điều khiển web: navigate/click/type/screenshot/scrape | **core (có sẵn)** | toolset `browser` ([tools/browser_tool.py](../hermes-agent/tools/browser_tool.py)): **local headless Chromium, no-GPU, chạy trên VPS không màn hình**. Dùng accessibility-tree → không cần vision |
| 19.2 | Anti-detect browser (camofox) / CDP điều khiển Chrome thật | idea | [browser_camofox.py](../hermes-agent/tools/browser_camofox.py), [browser_cdp_tool.py](../hermes-agent/tools/browser_cdp_tool.py); atlas: agent-browser-mcp, Vessel |
| 19.3 | **Computer-use GUI như người** (chuột/bàn phím/screenshot cả desktop) | later | skill `macos-computer-use` **CHỈ macOS**. Lucy chạy **Linux VPS** → phải thêm Xvfb+pyautogui, HOẶC đi đường browser (19.1) cho web app |
| 19.4 | **YouTube đọc/repurpose** — transcript/search/channel/playlist → tóm tắt/thread/blog | core (có sẵn) | skill `youtube-content` + atlas `youtube-skills`. **Chỉ ĐỌC** |
| 19.5 | **YouTube upload/update video** (title/desc/thumbnail) | idea — **phải build** | KHÔNG có skill sẵn. Cách: (a) **YouTube Data API v3** (OAuth) viết thành skill/MCP; hoặc (b) browser/computer-use lái **YouTube Studio** UI như người (fragile) |
| 19.6 | Tạo/sửa video (ComfyUI workflow, gen) | later | skill `comfyui` — nặng, cần GPU |
| 19.7 | Đăng social tự động (X/Twitter) | idea | skill `social-media/xurl`; atlas `hermes-tweet` (Xquik) |

## 20. Code/docs/content liên tục nhiều project (orchestration — grok điều phối → Claude làm)

> Mô hình: **grok = dispatcher** (board, routing, lifecycle — rẻ, always-on) · **Claude Code = worker** (code thật).
> grok KHÔNG quyết nội dung → vẫn đúng "không AI trung gian". Phase nâng cao (sau P1-3).

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 20.1 | **Kanban worker lanes** — board task → lane (profile grok HOẶC Claude Code worker) → chạy **song song nhiều project**, mỗi task workspace riêng → reviewer gate → optional PR | core (có sẵn) | [kanban-worker-lanes.md](../hermes-agent/website/docs/user-guide/features/kanban-worker-lanes.md). Mix lane: grok cho việc rẻ, Claude cho code khó |
| 20.2 | `subagent-driven-development` + `delegate_task` (subagent song song, review 2 tầng) | core | |
| 20.3 | Skill code: `test-driven-development`, `systematic-debugging`, `plan`/`writing-plans`, `requesting-code-review`, `spike`, debuggers | core | bundled `software-development/` |
| 20.4 | Skill docs/report: `research-paper-writing`, `notion`/`obsidian`, `nano-pdf`, `powerpoint`, `architecture-diagram`/`excalidraw` | core | |
| 20.5 | Skill content/blog: `humanizer`, `avoid-ai-writing` (gột mùi AI), `baoyu-article-illustrator`/`baoyu-infographic`, `blogwatcher` | core/idea | |
| 20.6 | `codegraph` (knowledge-graph repo → giảm token đọc code), `tokscale` (đếm token đa agent) | idea | Atlas — vet trước |
| ⚠️ | **Caveat "chạy liên tục":** mỗi Claude lane ăn **rate-limit Max (cửa 5h/tuần)**. Chạy 24/7 nhiều lane sẽ **chạm trần** → Kanban **queue** giúp không vỡ (task chờ, không fail). Throttle số lane Claude + grok lo phần rẻ + monitor cost | — | throughput chặn bởi quota Claude, không vô hạn |

---

## To-decide (chưa chốt)
- Schedule 2 lần/ngày (giờ VN).
- Watchlist coin + loại vàng.
- ~~Voice TTS engine~~ → **CHỐT: free no-GPU, base MeloTTS family self-host CPU (EN/JA + `nmcuong/MeloTTS-Vietnamese` cho VN).** Còn lại: nghe thử + chọn speaker/giọng Lucy; cân nhắc VieNeu-TTS nếu muốn clone giọng cute riêng.
- Model provider chính cho Hermes.
- VPS: Vietnix `14.225.255.73` chung được (không cần GPU nhờ fallback CPU).
