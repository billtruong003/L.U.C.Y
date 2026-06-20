---
title: Module hóa Lucy → sản phẩm self-host (bản TUI nhẹ) — PROPOSAL
status: proposal
created: 2026-06-17
owner: Bill
agent: lucy
tags: [lucy, product, self-host, distribution, tui]
sources: [deep-research-2026-06-17, codebase-audit-2026-06-17]
---

# Module hóa Lucy → sản phẩm tải về được

> Tổng hợp từ 2 luồng: **deep-research landscape** (Open WebUI/LibreChat/Khoj/Hermes/Jan/AnythingLLM…) + **audit codebase Lucy**. Hướng Bill chốt: bản phân phối = **TUI/terminal siêu nhẹ kiểu Hermes**, copy folder tách khỏi lucy gốc.

---

## 0. TL;DR — khuyến nghị 1 phút

1. **Khả thi, nhưng có 1 rào cản sống còn phải quyết trước mọi thứ:** Lucy chạy Claude qua **OAuth subscription** — mà Anthropic đã **chính thức cấm** dùng OAuth token (Free/Pro/Max) trong *bất kỳ tool bên thứ ba nào, kể cả Agent SDK*. Bản phát hành cho người lạ **bắt buộc** chuyển sang **user tự nhập API key** (bring-your-own-key) hoặc model rẻ/local. Đây là quyết định kiến trúc gốc, không né được.
2. **Hình hài đúng:** một **CLI/TUI cài bằng 1 lệnh** (kiểu Hermes — React/Ink, MIT; hoặc OpenClaw CLI-first) — KHÔNG bê cả web hub + pm2 + nginx nặng đi phát hành. Hub là bản "pro/cloud" để sau.
3. **License đề xuất:** **MIT** (adoption rộng, hợp solo indie) — trừ khi muốn chống bị cloud provider xài chùa thì cân nhắc **AGPL/FSL**.
4. **Kiếm tiền realistic cho solo:** open-source free + **cloud-hosted tier trả phí** ("charge only for cloud costs" — mô hình Postiz, solo dev đạt ~$14.2K MRR). Marketing quan trọng ngang code.
5. **Công sức:** lõi (agent-machine/hub) đã khá sạch & env-driven; nặng nhất là **tách vault cá nhân + làm template + đóng gói + đổi đường Claude**. Ước lượng MVP "Lucy-lite" CLI: gọn nếu cắt hub.

---

## 1. Landscape — học gì từ các sản phẩm đã thành công

| Sản phẩm | Hình hài phân phối | License | Sao GitHub | Điểm đáng học |
|---|---|---|---|---|
| **Open WebUI** | Docker 1 lệnh | BSD-3 + branding-clause (≤50 user free) | ~139K | Docker-first, RBAC sẵn; license "bảo hộ thương hiệu" |
| **AnythingLLM** | **Desktop app no-docker** + Docker | MIT | ~60K | "true no-setup desktop install", BYO 30+ provider, LanceDB nhúng |
| **LibreChat** | Docker Compose (5 service) + 1-click Railway | MIT | ~36K | Multi-provider, auth đa dạng, BYOK rõ ràng |
| **Khoj** | pip + docker-compose + cloud | AGPL-3.0 | ~35K | Freemium: self-host free + cloud trả phí + enterprise |
| **Jan.ai** | Desktop app | MIT | (5.3M downloads) | Local-first, chạy offline, cực dễ cài |
| **Leon** | `git clone` + npm/pnpm, localhost | MIT | ~17K | TS/Node thuần, lâu đời, privacy-first |
| **Hermes Agent** | **Terminal CLI (React/Ink)** | MIT | — | ⭐ Đúng hướng Bill: TUI nhẹ + skill tự cải thiện + nhiều backend |
| **OpenClaw** | **CLI-first**, đa kênh | MIT | — | 24 kênh nhắn tin + 500+ plugin cộng đồng |
| **Vellum** | macOS app + Telegram/Slack | MIT | — | **Credential isolation** chạy process riêng (bài học bảo mật) |

**3 quy luật chung 2026:** (a) sản phẩm nào cũng có **skills/plugin modular**; (b) **local-first** lên ngôi; (c) **BYO-API-key** là chuẩn — không sản phẩm nào "tặng" token.

---

## 2. ⚠️ Rào cản sống còn: Claude OAuth subscription bị cấm

Đây là phần quan trọng nhất, research xác nhận từ 2 nguồn độc lập (vụ "OpenClaw ban" + cập nhật điều khoản Anthropic 02/2026):

- Anthropic **thu hồi** khả năng app bên thứ ba auth bằng OAuth token của Claude.ai (Free/Pro/Max). Trích: *"Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service — including the Agent SDK — is not permitted."*
- Chỉ **Claude Code** + **Claude.ai** chính thức được dùng OAuth subscription.
- Lý do: kinh tế (subscription rẻ hơn API → bị "lách giá"), hạ tầng, bảo vệ doanh thu API.
- **Hệ quả cho Lucy:** Lucy hiện gắn Claude qua subscription/OAuth (đường OmniRoute + Agent SDK). **Không thể** phát hành cho người khác dùng chung kiểu đó — vi phạm ToS + sẽ bị chặn.

**→ Bản phát hành PHẢI một trong:**
- (A) **User tự nhập Anthropic API key** (trả per-token) — thẳng thắn, đúng luật, giống PyGPT/LibreChat.
- (B) **Model-agnostic**: để user chọn provider rẻ (OpenRouter/Groq/Gemini/DeepSeek) hoặc **local (Ollama)** — Lucy đã có sẵn `llm-lane` 8 provider OpenAI-compatible → tận dụng được ngay.
- Khuyến nghị: làm **(B) làm mặc định, (A) tùy chọn** — Lucy-lite chạy ngon với model rẻ/local, ai muốn Claude xịn thì cắm API key.

---

## 3. Lucy đang ở đâu (từ audit codebase)

**Đã sạch / tái dùng tốt:** orchestrator (`coordinator/worker/autopilot`), memory engine (FTS5+vector+consolidate), `llm-lane` (8 provider), 18 persona JSON generic, hub UI data-driven, MCP harness — đều **env-driven, không hardcode tên Bill/IP**.

**Phải gỡ/tách trước khi phát hành:**
- **Vault ~95% dữ liệu cá nhân** (USER.md, money-ideas, fitcity, shader…) → cần **template vault rỗng**.
- 🔴 **Secret bị commit** (`tech_harness.py`/`vn_trending.py` hardcode token Telegram, git-tracked) → bản phát hành KHÔNG được mang theo (đã thống nhất: tách folder mới lo).
- IP `14.225.255.73` + path `/root/lucy` còn rải ở bridge/harness → externalize.
- Cron cá nhân (brief/shader/trend/vn/fitcity/aki) → để optional plugin, tắt mặc định.
- **Không có Docker/installer** + lệ thuộc pm2/nginx/systemd thủ công → rào cản đóng gói lớn nhất.
- Default nguy hiểm (`'123'`/`'lucytok'`/`'devtoken'`) → phải bắt buộc set.

---

## 4. Con đường module hóa — bản "Lucy-lite" TUI

Bám đúng hướng Bill: **terminal-first, siêu nhẹ, copy folder tách**. Học Hermes (React/Ink CLI) + OpenClaw (CLI-first).

**Kiến trúc bản phát hành (cắt gọn từ Lucy hiện tại):**
- Giữ: orchestrator core + memory engine + `llm-lane` (model-agnostic) + persona generic + skill/tool harness.
- **Bỏ khỏi bản lite:** web hub React, nginx, các cron cá nhân, vault data Bill, đường Claude-OAuth.
- Thêm: **TUI (Ink/textual)** làm mặt người dùng thay Telegram/hub; **`lucy init`** wizard hỏi API key + tạo vault template; đóng gói **1 lệnh** (`npx`/`pipx`/Docker).
- Telegram thành **kênh tùy chọn** (user tự cắm bot token), không bắt buộc.

**Phân tầng công sức:**
- **DỄ:** externalize IP/path còn sót; `.env.example` đầy đủ; bỏ default mật khẩu nguy hiểm; tách config.
- **TRUNG BÌNH:** template vault rỗng + `lucy init` wizard; `INDEX_DIRS` linh hoạt; persona thành template; cron → plugin opt-in; viết TUI tối giản; Dockerfile + compose.
- **KHÓ:** đổi lõi từ Claude-OAuth → **BYO API key / model-agnostic làm mặc định** (tận dụng llm-lane); (nếu muốn) multi-tenant/multi-user — *KHÔNG cần cho bản lite, để bản cloud sau*.

---

## 5. License & phân phối

- **MIT** — khuyến nghị mặc định: adoption nhanh nhất, hợp solo indie, dễ kéo contributor. (Open WebUI, LibreChat, Khoj-trừ-AGPL, Hermes, Jan, AnythingLLM… đa số MIT.)
- **AGPL-3.0** — nếu sợ cloud provider lớn bê đi bán: chống "SaaS loophole", nhưng doanh nghiệp né (Google cấm AGPL nội bộ) → giảm adoption.
- **FSL (Functional Source License)** — trung dung: độc quyền 2 năm rồi tự mở MIT/Apache; hợp nếu định làm cloud tier riêng.
- Phân phối: **GitHub + Docker Hub + (npm/pip)**, niêm yết **Awesome-Selfhosted / Open Alternative / Awesome OSS** (Postiz nói đây là nguồn backlink + user lớn).

---

## 6. Kiếm tiền cho solo indie (thực tế)

Mô hình **Postiz** (1 dev, ~$14.2K MRR) là khuôn tốt nhất:
- Open-source **free self-host** → "charge only for cloud costs, never force developers to pay".
- **Cloud-hosted tier** trả phí cho ai lười tự cài (Lucy chạy sẵn + bao Claude/model).
- Phụ: GitHub Sponsors, support/setup trả phí, **template/skill marketplace** (Lucy có sẵn skill-engine → bán skill/persona là hướng tự nhiên).
- ⚠️ **Marketing ngang code:** launch thường xuyên (Reddit r/selfhosted, DEV, X, LinkedIn), SEO, tìm niche (Postiz bùng nhờ nhắm dân n8n).

---

## 7. Rủi ro & sai lầm thường gặp

- **Gánh nặng bảo trì/support** — solo dev dễ kiệt sức khi user tăng (Khoj/Leon đều xin contributor). → mở Discord, để cộng đồng gánh.
- **Phụ thuộc Claude** — đã nói ở mục 2; đừng để sản phẩm chết nếu Anthropic siết tiếp → model-agnostic là bảo hiểm.
- **Cạnh tranh khốc liệt** — Open WebUI 139K sao. Lucy KHÔNG nên đấu trực diện "chat UI"; **điểm khác biệt của Lucy = agent cá nhân chủ động 24/7 + memory vault + persona + auto-task/auto-build** → định vị "personal autonomous assistant", không phải "thêm 1 ChatGPT clone".
- **Lộ secret khi mở mã** — phải scrub git history + tách vault trước khi public (đừng quên dù đã tách folder).
- **License sai** — AGPL có thể giết adoption; chọn sớm, khó đổi sau.

---

## 8. Lộ trình đề xuất (phân pha, mỗi pha 1 sprint)

- **P0 — Spike khả thi:** dựng nhánh `lucy-lite`, copy core (không hub/vault), thử chạy chỉ bằng `llm-lane` + 1 model rẻ/API key → chứng minh "Lucy chạy không cần Claude-OAuth". *Quyết định go/no-go ở đây.*
- **P1 — Tách & template:** vault template rỗng + `lucy init` wizard + externalize config + bỏ default nguy hiểm.
- **P2 — TUI:** mặt terminal (Ink) thay Telegram/hub; chat + xem memory + chạy auto-task ngay trong terminal.
- **P3 — Đóng gói:** Dockerfile + compose + script cài 1 lệnh + README; niêm yết Awesome-lists.
- **P4 — (tùy chọn) Cloud tier:** bản hosted trả phí + multi-user, khi có người dùng thật.

---

## 9. Khuyến nghị của em (Lucy)

Làm **P0 trước** — nó trả lời câu hỏi sống còn (Lucy có sống được không nếu bỏ Claude-OAuth, chạy model rẻ/API key). Nếu P0 ổn, hướng **TUI Lucy-lite MIT, model-agnostic, cài 1 lệnh** là khả thi và đúng chất Bill. Định vị **"trợ lý AI cá nhân chủ động, tự động hoá đời sống tech"** — khác biệt với đám chat-clone. Kiếm tiền kiểu Postiz (free self-host + cloud tier).

> Đây là proposal chiến lược — chưa viết code. Khi Bill chốt hướng, em cho auto-task/auto-build (Sonnet) bắt tay từ **P0 spike**.
