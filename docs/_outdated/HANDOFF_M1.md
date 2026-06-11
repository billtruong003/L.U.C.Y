# HANDOFF — 2026-06-10 (M1 đang dở, M2 đã architect)

> Đọc cái này khi quay lại. Mục tiêu Lucy + plan tổng: [NORTH_STAR.md](NORTH_STAR.md).

## TL;DR
- ✅ **M1 (trí nhớ) — MÓNG XONG + proven.** Lucy đọc được "bộ não" (`lucy-vault/`), biết Bill + dự án.
- ✅ **M1 — 4 mảnh ĐÃ BUILD + test (2026-06-10).** recall(FTS5) · write-back · dream · "Bộ não" UI. Chi tiết §"Đã build".
- 📐 **M2 (MCP) — đã architect, chưa build** → [MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md).
- ✅ **M1.5 "tinh hà tri thức" — ĐÃ BUILD L1–L3** (graph trí nhớ 3D, hành tinh=note, đường sao=wikilink THẬT, recall pulse, born-anim, click→note). Tab Neural → toggle 🌌 Tinh hà. Design+defer L4/L5: [NEURAL_GALAXY.md](NEURAL_GALAXY.md).
- 📈 **Hướng kế (đề xuất, Hermes-grounded):** đẩy memory lên "peak" (A1 evidence-loop trước) + làm UI não đẹp hơn → [MEMORY_PEAK.md](MEMORY_PEAK.md).

## ✅ Đã xong M1 (foundation)
- `lucy-vault/` — bộ não markdown, seed sẵn: `Context/USER.md` (Bill), `Context/LUCY-IDENTITY.md`, `Projects/{LUCY,radiant-bot}.md`, `MEMORY.md` (index), `_brain.yaml` (ngưỡng dream), `Brain/active.md`, `README.md`. Mở bằng **Obsidian** (trỏ vault vào đây).
- `agent-machine/src/runner.ts` — wired `--add-dir $LUCY_VAULT` + HOUSE_SKILL dặn agent đọc vault / ghi `Brain/inbox/`. Typecheck sạch.
- **Proof:** `claude -p` từ `hub/` (không chứa vault) đọc đúng `Context/USER.md` qua `--add-dir` → biết "Bill thích FOCUS, kỵ dàn trải". $0.02.

### ⚙️ 1 việc để M1 LIVE trong engine
Set env cho worker (pm2/shell): `LUCY_VAULT=c:/Users/Admin/Downloads/BillService/LUCY/lucy-vault`
→ từ đó mọi card tự đọc vault. (Nếu chạy máy khác: trỏ path tới `lucy-vault` của repo đó.)

## ✅ Đã build M1 — 4 mảnh (2026-06-10, typecheck + e2e sạch). Spec gốc: [M1_MEMORY_SPEC.md](M1_MEMORY_SPEC.md)
1. ✅ **FTS5 recall** → `agent-machine/src/recall.ts` (+ `vault.ts` parser, `better-sqlite3`, `remove_diacritics 2`). `Recall.search/recent/reindex`. CLI: `npm run reindex` · `npm run recall -- "q"`. *(Test: "focus"→"FOCUS", relaxed-OR OK.)*
2. ✅ **Write-back hook** → `signal.ts` + gắn `engine.submit` (rework) & `engine.reject` (feedback Bill) → ghi `Brain/inbox/sig-*.md`. Guard `LUCY_VAULT` (test không bẩn).
3. ✅ **Dream** → `dream.ts` (port Wilson confidence + graduate/contradiction/rebuttal/auto-retire, snapshot+atomic, **idempotent no-op**). CLI `npm run dream`. *(Test: 2 signal → 1 pref unconfirmed → regen active.md.)*
4. ✅ **"Bộ não" UI tab** → `coordinator.ts` routes `/recall`+`/brain/*` → hub proxy `/api/brain/*` → React `hub/web/src/components/Memory.tsx` (tab "Bộ não", 🧠). Recall + duyệt vault + render md + nút Reindex/Dream. *(e2e qua hub OK.)*
   - **Wiring:** `runner.ts` prepend `Brain/active.md` vào system prompt (strip timestamp → giữ cache parity). `coordinator-main.ts` mở recall + warm index khi có `LUCY_VAULT`.

### ⚙️ Để M1 LIVE: set `LUCY_VAULT` cho **coordinator** (não routes) + **worker** (claude -p đọc vault). Chưa set → brain routes trả `configured:false` (graceful).
→ M1 đầy đủ. Tiếp: **M2 (MCP)** theo NORTH_STAR, HOẶC nhánh **M1.5 [NEURAL_GALAXY.md](NEURAL_GALAXY.md)** (Bill thích).

## 📐 M2 (MCP) — sẵn sàng build
Kiến trúc đã chốt ([MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md)): **gateway MetaMCP + claude -p tool-search native + per-task scope.** Unity pick = **CoplayDev/unity-mcp**. Build order: gateway→core→dev→Unity→web→comms→personal.

## 🗂 Bản đồ docs
| Doc | Nội dung |
|---|---|
| **NORTH_STAR.md** ⭐ | Viễn cảnh + plan 6 milestone + UI/UX — đọc đầu tiên |
| **M1_MEMORY_SPEC.md** | Spec build nốt M1 (schema FTS5 + dream) |
| **MCP_ARCHITECTURE.md** | Kiến trúc M2 (MCP overkill + lớp quản) |
| **NEURAL_GALAXY.md** 💡 | M1.5 — tinh hà tri thức (graph trí nhớ sống, nở theo thời gian) |
| LUCY_ULTIMATE_INFRA.md | Thiết kế 7 lớp tổng |
| STEAL_FROM_HERMES.md | Findings code-level từ Hermes |
| COST_MODEL / MODEL_COMPARISON / FREE_API_PROVIDERS | Token/model/provider |
| ROADMAP_TO_PEAK.md | Business track (DEFER) |

## 🔗 Repo tham chiếu (đã là git submodules trong `references/`)
6 repo: hermes-agent · basic-memory · open-second-brain · OmniRoute · last30days-skill · awesome-finance-skills.
**Máy mới / sau khi pull:** `git submodule update --init --depth 1` để kéo source về (không thì thư mục rỗng).
Map file→việc: [references/README.md](../references/README.md).

## 🌐 OmniRoute (Sprint 1, chạy local — KHÔNG cần cho M1)
Live `localhost:20128`, 7 provider free đã cắm (key trong vault AES-256 của OmniRoute, không trong git). = lane model-rẻ cho sau. Bật lại: `cd BillService/OmniRoute && npm run dev`. **Lưu ý:** key đang ở chat log — cân nhắc rotate (Groq/Gemini/OpenRouter regen tức thì).

## ▶️ Việc kế khi quay lại
Bắt đầu **Mảnh 1 (FTS5 recall)** trong M1_MEMORY_SPEC, hoặc nếu hứng game thì cắm thử **Unity MCP** (M2). Khuyến nghị: xong M1 trước cho chắc móng.
