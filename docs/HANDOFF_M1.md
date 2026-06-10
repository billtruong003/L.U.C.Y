# HANDOFF — 2026-06-10 (M1 đang dở, M2 đã architect)

> Đọc cái này khi quay lại. Mục tiêu Lucy + plan tổng: [NORTH_STAR.md](NORTH_STAR.md).

## TL;DR
- ✅ **M1 (trí nhớ) — MÓNG XONG + proven.** Lucy đọc được "bộ não" (`lucy-vault/`), biết Bill + dự án.
- 🔨 **M1 còn 4 mảnh** để hoàn chỉnh → spec đầy đủ ở [M1_MEMORY_SPEC.md](M1_MEMORY_SPEC.md).
- 📐 **M2 (MCP) — đã architect, chưa build** → [MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md).

## ✅ Đã xong M1 (foundation)
- `lucy-vault/` — bộ não markdown, seed sẵn: `Context/USER.md` (Bill), `Context/LUCY-IDENTITY.md`, `Projects/{LUCY,radiant-bot}.md`, `MEMORY.md` (index), `_brain.yaml` (ngưỡng dream), `Brain/active.md`, `README.md`. Mở bằng **Obsidian** (trỏ vault vào đây).
- `agent-machine/src/runner.ts` — wired `--add-dir $LUCY_VAULT` + HOUSE_SKILL dặn agent đọc vault / ghi `Brain/inbox/`. Typecheck sạch.
- **Proof:** `claude -p` từ `hub/` (không chứa vault) đọc đúng `Context/USER.md` qua `--add-dir` → biết "Bill thích FOCUS, kỵ dàn trải". $0.02.

### ⚙️ 1 việc để M1 LIVE trong engine
Set env cho worker (pm2/shell): `LUCY_VAULT=c:/Users/Admin/Downloads/BillService/LUCY/lucy-vault`
→ từ đó mọi card tự đọc vault. (Nếu chạy máy khác: trỏ path tới `lucy-vault` của repo đó.)

## 🔨 Hoàn thiện M1 — 4 mảnh (xem [M1_MEMORY_SPEC.md](M1_MEMORY_SPEC.md) có schema + thuật toán đầy đủ)
1. **FTS5 recall** → new `agent-machine/src/recall.ts` (`better-sqlite3`, `remove_diacritics 2` cho VN). `lucy_search`/`lucy_recent`.
2. **Write-back hook** → `engine.submit` ghi signal vào `Brain/inbox/sig-*.md`.
3. **Dream** → new `agent-machine/src/dream.ts` (port `open-second-brain/src/core/brain/dream.ts`, Wilson confidence, ngưỡng 2). Regen `active.md`.
4. **"Bộ não" UI tab** (hub) — duyệt vault + ô search.

→ Xong 4 mảnh = M1 đầy đủ → sang **M2**.

## 📐 M2 (MCP) — sẵn sàng build
Kiến trúc đã chốt ([MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md)): **gateway MetaMCP + claude -p tool-search native + per-task scope.** Unity pick = **CoplayDev/unity-mcp**. Build order: gateway→core→dev→Unity→web→comms→personal.

## 🗂 Bản đồ docs
| Doc | Nội dung |
|---|---|
| **NORTH_STAR.md** ⭐ | Viễn cảnh + plan 6 milestone + UI/UX — đọc đầu tiên |
| **M1_MEMORY_SPEC.md** | Spec build nốt M1 (schema FTS5 + dream) |
| **MCP_ARCHITECTURE.md** | Kiến trúc M2 (MCP overkill + lớp quản) |
| LUCY_ULTIMATE_INFRA.md | Thiết kế 7 lớp tổng |
| STEAL_FROM_HERMES.md | Findings code-level từ Hermes |
| COST_MODEL / MODEL_COMPARISON / FREE_API_PROVIDERS | Token/model/provider |
| ROADMAP_TO_PEAK.md | Business track (DEFER) |

## 🔗 Repo tham chiếu (clone local ở `BillService/`, không trong LUCY repo)
`hermes-agent` · `OmniRoute` · `basic-memory` · `open-second-brain` · `last30days-skill` · `awesome-finance-skills`.
Ở máy khác clone lại nếu cần (URL trong các doc). M1 chỉ cần LUCY repo + spec.

## 🌐 OmniRoute (Sprint 1, chạy local — KHÔNG cần cho M1)
Live `localhost:20128`, 7 provider free đã cắm (key trong vault AES-256 của OmniRoute, không trong git). = lane model-rẻ cho sau. Bật lại: `cd BillService/OmniRoute && npm run dev`. **Lưu ý:** key đang ở chat log — cân nhắc rotate (Groq/Gemini/OpenRouter regen tức thì).

## ▶️ Việc kế khi quay lại
Bắt đầu **Mảnh 1 (FTS5 recall)** trong M1_MEMORY_SPEC, hoặc nếu hứng game thì cắm thử **Unity MCP** (M2). Khuyến nghị: xong M1 trước cho chắc móng.
