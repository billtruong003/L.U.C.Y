# Roadmap D+ — hoàn tất UX sống + Agent SDK + Bộ nhớ/Context + Dream prune

> **Viết 2026-06-13.** Tiếp nối [ROADMAP-NEXT.md](ROADMAP-NEXT.md). Chủ nhân chốt: CHƯA qua Phase E ngay,
> mà (1) đóng nốt các "nice-to-have" còn lại của Phase D + đề xuất, (2) làm UI/UX MỚI cho thinking,
> (3) switch sang Claude Agent SDK cho code sạch, (4) đưa memory/context (E) vào kế hoạch, (5) thêm 1
> feature mới: **rút gọn node mỗi lần dream** — node phải là điểm THẬT trên hệ thống, không phải đốm trang trí.
> Đã xong hôm nay (ngoài roadmap): queue chat web, chat hiện vô Tasks, fix nginx SSE "fail fetch".

---

## ✅ TRẠNG THÁI THỰC THI (cập nhật 2026-06-13, đã rehost + live)
- **Section A — Thinking UI mới**: ✅ DONE (timeline 💭/🔧/✅, tool-card collapse, badge model, live status, avatar pulse; server emit tool_use/tool_result). Verified + live qua nginx.
- **Section C lớp 1 — Dream prune**: ✅ DONE (auto-xoá pref retired quá grace 30d + dedup file trùng topic; pinned miễn; snapshot backup). Test PASS, deployed. *Chưa chạy dream trên vault thật (Bill chốt khoan chạy).*
- **Section B — Agent SDK**: Hub streamClaude ✅ · dream-brain ✅ · **runner ClaudeRunner+salvage ✅** (E2E test PASS, cwd=workspace an toàn, deployed autopilot+worker). ⏸️ **Bridge Telegram**: HELD — chờ Bill chạy thử card/sprint thật xác nhận runner OK rồi mới đổi. Cron giữ `claude -p`.
- **Section C lớp 2 — node→resource**: ⏳ defer sau E.
- **Track 4b — cron lọc nội dung mỗi tối**: 📋 PLAN (Bill chốt) — chưa build.
- Phụ: queue chat, chat→Tasks, nginx SSE fix: ✅ DONE.

---

## TRẠNG THÁI PHASE D (audit 2026-06-13)
- **D1 SSE streaming** — ✅ xong (`/api/chat/stream` + `chatStream` reader).
- **D2 Composer footer** — 🟡 model picker xong; THIẾU persona selector, context-ring, gateway status ngay khung chat.
- **D3 Card thinking/tool/approval** — 🟡 chỉ có toggle "💭 xem suy nghĩ" text thô; THIẾU timeline/step, tool-call card, approval allow/deny.
- **D4 Rate-guard panel** — ✅ render ở Dashboard (`/api/llm/guard`); UI còn text thô, chưa proactive.
- **D5 Mobile responsive** — 🟡 có `sm:` cơ bản; thiếu `md:`, kanban swipe, test cảm ứng.

---

## TRACK 1 — Hoàn tất Phase D (nice-to-have + đề xuất)

### D3★ — UI/UX MỚI cho Thinking (ưu tiên cao, chủ nhân nêu trực tiếp)
Hiện: thinking là 1 khối text vàng thô, toggle ẩn/hiện. Đề xuất nâng cấp:
- **Thinking timeline**: tách thinking thành các "bước" (theo đoạn / theo tool boundary), mỗi bước 1 dòng tiêu đề + chi tiết collapse. Mặc định gập, click mở mượt (transition).
- **Phân biệt loại block**: 💭 thinking (vàng) · 🔧 tool-call (xanh) · ✅ final (trắng) — màu + icon riêng, không trộn 1 cục.
- **Agent/model badge**: hiện avatar + model đang nghĩ ("Claude Opus · 💭 đang suy nghĩ…"), đếm thời gian.
- **Live trạng thái**: trong lúc stream hiện "đang nghĩ → đang gọi tool X → đang trả lời" thay vì chỉ "⏳ …".
- Kỹ thuật: thêm event type vào SSE (`tool_use`/`tool_result`), Chat.tsx render component `<ThinkingTimeline>` + `<ToolCallCard>`.

### D3b — Tool-call card + Approval (allow/deny/always)
- Stream tool invocation lên UI: tên tool + tham số + kết quả (collapse).
- Approval inline khi cần: nút Allow / Deny / Always (thay gate thô ở Board). Map với `permission` của Agent SDK (xem Track 2).

### D4b — Rate-guard panel "đẹp + proactive"
- Progress bar / vòng quota thay text; cảnh báo nổi lên ngay trong Chat khi provider đang bị limit (không bắt vào Dashboard mới thấy).

### D5b — Mobile polish
- Thêm `md:` breakpoint (tablet 768px), kanban swipe mượt, test cảm ứng các tab nặng (Board, Dashboard, Galaxy).

### D2b — Composer đầy đủ (đề xuất)
- Persona selector (đang chỉ có ở Board) + context-ring (token đã dùng/giới hạn phiên) + chấm trạng thái gateway ngay khung chat.

---

## TRACK 2 — Switch sang Claude Agent SDK (kéo H3 lên, "dễ + clean")
**Mục tiêu:** bỏ `spawn(claude, args)` + tự parse NDJSON → dùng SDK in-process (`@anthropic-ai/claude-agent-sdk` cho TS, `claude-agent-sdk` cho Python).

**SDK hỗ trợ đủ (đã xác minh):** `resume`(session) · streaming + thinking delta (`includePartialMessages`) · `allowedTools` + `permissionMode:'bypassPermissions'` · `systemPrompt`/append · `additionalDirectories` (=`--add-dir` vault) · `model`. Latency giảm (~300-500ms spawn → in-process).

**Call-sites cần refactor (audit 2026-06-13):**
| Nơi | File | Độ khó | Giữ gì |
|--|--|--|--|
| Hub server | `hub/server/src/index.ts` (`runClaude`, `streamClaude`) | DỄ (cùng TS) | session per chat, stream thinking, vault |
| Agent-Machine runner | `agent-machine/src/runner.ts` (`ClaudeRunner.run`, salvage) | VỪA | session cache per stage, prompt-cache parity, salvage fallback, allowedTools |
| Dream consolidate | `agent-machine/src/agent-brain-dream.ts` (`spawnClaude`) | DỄ | haiku 1-shot |
| Bridge Telegram | `bridge/lucy_bridge.py` (`run_claude`, `run_claude_stream`) | VỪA→KHÓ (Python) | session per chat_id, thinking, vault, persona overlay |
| Cron | `cron_brief.sh`, `cron_tech.sh` | DỄ | đổi `claude -p` → node/py runner gọi SDK (hoặc giữ tạm) |
| LaneRunner | `agent-machine/src/lane-runner.ts` | KHÔNG đụng | đã dùng HTTP coordinator, không spawn |

**Thứ tự đề xuất:** Hub (rủi ro thấp, validate SDK) → ClaudeRunner (lõi) → Dream → Bridge (Python) → Cron. Mỗi bước smoke + giữ đường cũ tới khi xác nhận.
**Rủi ro phải test kỹ:** session resume, vault `--add-dir`, thinking stream, salvage. Giữ subprocess làm fallback 1 vòng.

---

## TRACK 3 — Memory & Context sâu (Phase E, đưa vào kế hoạch — làm sau D)
- **E1 Context compressor** ⭐ — `should_compress` khi prompt ≥ 0.5×ctx → giữ head + tail, summarize giữa bằng model rẻ. (Lưu ý: Agent SDK/Claude có compaction beta — cân nhắc dùng sẵn.)
- **E2 Session lineage + bookends** trên FTS5 — parent_session_id + 3 đầu/3 cuối + dedupe.
- **E3 Đo prompt-cache thật** — log `cache_read_input_tokens`.
- **E4 Trajectory compressor** — nén phiên cực dài (ưu tiên thấp).

---

## TRACK 4 — Dream prune node: node = điểm THẬT, không trang trí (feature MỚI)
**Vấn đề (chủ nhân nêu):** galaxy có nhiều node dư thừa; node chỉ sáng cho đẹp, click không dẫn tới điểm thật.

**Hiện trạng (audit):**
- Dream (`agent-machine/src/dream.ts`) gộp signal→preference, CÓ dedup cơ bản (cùng topic+dấu → push evidence) nhưng KHÔNG merge/prune node trùng ý; pref `expired/stale` chỉ đổi status, KHÔNG xoá file → node vẫn còn.
- Node trong galaxy (`brain.ts buildGraph`) = file vault thật, click mở được file. NHƯNG signal/preference chỉ có `topic` slug + `evidenced_by` (text ID), KHÔNG link tới resource thật (card/issue/PR/file source).
- 26 preference + 61 signal đang chờ → dễ trùng.

**Kế hoạch (2 lớp, theo ROI):**
1. **PRUNE mỗi dream** (làm trước):
   - Trong `dream.ts`: trước khi graduate pref mới, fuzzy-match topic/principle với pref đang có → merge thay vì tạo mới.
   - Auto-xoá (không chỉ đổi status) pref `expired`/`stale` quá N ngày (vd 30d), trừ `pinned`.
   - Thêm endpoint `/brain/prune` + nút trên tab Memory để chạy tay.
   - → Galaxy sạch, node sống thay vì nhiễu.
2. **LINK node → resource thật** (làm sau):
   - Mở rộng frontmatter pref: `related_files`, `related_card`, `related_issue/pr`.
   - Dream map `evidenced_by` (signal→card) → resource gốc → ghi vào pref.
   - `brain.ts` tạo link thật tới resource; `Galaxy.tsx` click node → panel hiện danh sách resource liên quan, mở được.
   - → Node thành "điểm vào" thật tới code/issue/card, không chỉ glow.

**KHÔNG đụng** `Brain/preferences/` và `Brain/active.md` bằng tay — chỉ sửa qua logic dream (máy quản).

### Track 4b — Cron LỌC NỘI DUNG mỗi tối (Bill chốt 2026-06-13) ⭐
**Vấn đề:** dream thuần đếm, không hiểu nghĩa → tin xàm (topic test, principle generic, lỗi env/transient) vẫn graduate thành node.
**Giải pháp:** cron mỗi tối (vd 2-3h sáng) chạy 1 lượt **claude + skill/tool** đọc `Brain/inbox/*.md`, JUDGE chất lượng từng signal:
- Loại: topic test (`default/*`, slug placeholder), principle quá ngắn/generic, lỗi môi trường/transient/chuyện-1-lần (theo blacklist HOUSE_SKILL/Hermes).
- Hành động: move signal rác → `Brain/inbox/rejected/` + ghi lý do vào `Brain/log/`. GIỮ NGUYÊN lớp đánh giá deterministic (threshold/trust-weight/evidence/confidence) — chỉ thêm gate semantic ở THƯỢNG NGUỒN.
- Sau lọc → chạy dream (graduate/dedup/prune) trên data đã sạch.
**ROI:** Bill khỏi lo tin xàm; node galaxy chỉ còn thứ thật. Theo đúng "công thức prompt cronjob chuẩn" (hỏi hướng + nguồn cụ thể trước khi lên). Tận dụng skill-loader (M3) + Agent SDK (Track 2).
**Trạng thái:** PLAN — chưa build. Làm cùng/sau Phase E.

---

## THỨ TỰ TỔNG ĐỀ XUẤT
**D3★ thinking UI → D3b/D4b/D5b/D2b (đóng nốt D) → Track 2 Agent SDK (Hub trước) → Track 4 dream-prune (lớp 1) → Track 3 memory/context (E1) → Track 4 lớp 2 (link node) → E2-E4.**
Lý do: thinking UI thấy-được ngay (chủ nhân nêu trực tiếp); SDK làm nền code sạch trước khi đụng sâu vào memory; dream-prune lớp 1 rẻ + dọn galaxy liền; memory/context là lõi chống tràn.
Mỗi track: hỏi chốt hướng → code từng phần → smoke → báo. Việc gửi ra ngoài (Discord/Telegram) phải hỏi chủ nhân trước.
