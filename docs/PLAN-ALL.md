# Lucy — TOÀN BỘ PHASE (single source, cập nhật 2026-06-13)

> 📕 **CANONICAL SPEC ĐỂ BUILD: MASTER-SPEC.md** (version thống nhất toàn bộ core feature + 2 chỉnh của Bill). File này = tra cứu trạng thái phase.
> ⭐ NORTH-STAR: **Lucy = Jarvis** — MỘT thực thể thống nhất, mạnh toàn diện, KHÔNG phân mảnh thành tab/session rời.
> Mọi phase hỏi: "cái này làm Lucy THỐNG NHẤT hơn hay phân mảnh thêm?". Bức tranh đầy đủ: 📖 VISION-JARVIS.md
> Phase N — Jarvis UI (hội thoại trung tâm + view orbit theo ngữ cảnh, ẩn cơ chế agent/model) — xem VISION-JARVIS.md.


> Gom mọi phase cho dễ tra. ✅ done · 🟡 dở · ⏳ defer · 📋 plan · ⭐ ưu tiên.
> Chi tiết: ROADMAP-NEXT.md · ROADMAP-D-PLUS.md · PHASE-E-OVERVIEW.md.

## ĐÃ XONG (nền, trước phiên này)
- **A** Multi-model chat + auto-route + thinking ✅
- **B(cũ)** Rate-guard / cred-pool / quota / quality-first ✅
- **C(cũ)** Prompt-cache parity / aux-client / curator / FTS5 trần ✅
- **Đường A** Claude chat streaming qua Telegram ✅

## PHIÊN NÀY (2026-06-13) — ✅ tất cả live + rehost
- **Section A** Thinking UI mới: timeline 💭/🔧/✅, tool-card collapse, badge model, live status ✅
- **Dream prune lớp 1**: auto-xoá pref retired >30d + dedup trùng topic (pinned miễn, snapshot backup) ✅
- **Agent SDK (Đường B)**: Hub chat ✅ · dream-brain ✅ · runner autopilot ✅ · **bridge Telegram ✅** (chỉ cron giữ claude -p)
- **E3** Badge cache% + context tok mỗi lượt chat ✅
- Phụ: queue chat web ✅ · chat hiện vô Tasks ✅ · fix nginx SSE "fail fetch" ✅ · fix bridge cắt tin dài ✅

## PHASE D — UX SỐNG (Hub thấy + bấm được)
- D1 SSE streaming ✅ · D2 composer (model picker ✅; persona/context-ring/gateway 🟡) · D3 thinking ✅ (Section A)
- D4 rate-guard panel ✅ (chart đẹp 🟡) · D5 mobile 🟡 (thiếu md:/swipe)
- **D6 — Giữ status khi OUT web** ✅ DONE: server vốn LƯU câu trả lời vào chat.json kể cả khi client ngắt giữa chừng (streamClaude chạy hết bất kể `closed`). Client giờ: (1) sync lịch sử khi tab FOCUS lại (out web → vào lại thấy câu đã chạy xong), (2) SSE đứt → báo nhẹ "kết nối gián đoạn, đang đồng bộ" rồi tự sync, KHÔNG lỗi đỏ. Việc vẫn thấy ở Tasks như cũ.
- **D7 — Auto-route giữ persona + context** ✅ DONE + verified: chọn (b) — phiên ĐÃ CÓ context (chat.sessionId) → auto KHÔNG hạ xuống lane (giữ trên claude có --resume), chỉ route lane cho câu MỚI/độc lập. Route event báo "giữ mạch phiên đang có". (Lane explicit do user tự chọn vẫn giữ.)

## PHASE E — CONTEXT & TRÍ NHỚ SÂU ✅ HOÀN TẤT (xem PHASE-E-OVERVIEW.md)
- **E1** Context compressor ⭐: ✅ covered — Claude CLI/Agent SDK tự auto-compaction phiên dài (không cần build, không toggle).
- **E2** Recall mạch lạc ✅ DONE: hit session-note (type=daily) đính khung **bookend [goal]/[done]/[pending]** thay mảnh 14 chữ → recall trả "việc gì/xong gì/treo gì". Test PASS, deployed. (Lưu ý: "parent_session lineage" kiểu Hermes KHÔNG hợp card-model độc lập của Lucy — session-note ĐÃ là bookend sẵn; đây là phần giá trị thật.)
- **E3** Đo prompt-cache + badge cache%/ctx ✅ DONE.
- **E4** Trajectory compressor ⏳ defer (auto-compact đã đủ).

## TRACK trí nhớ-galaxy
- Dream prune lớp 1 ✅ · lớp 2 (node→card/file thật) ⏳ defer sau E
- **Track 4b — cron lọc nội dung mỗi tối** 📋⭐ (Bill chốt): claude+skill đọc inbox judge & loại tin xàm (topic test, principle generic, lỗi env/transient) → inbox/rejected/ + log, rồi dream. Giữ lớp đánh giá deterministic, thêm gate nghĩa thượng nguồn.

## PHASE J — CHAT ĐA-PHIÊN (Hermes webUI style) 📋⭐ (Bill định hướng) — xem ROADMAP-MULTIAGENT-PERSONA.md
Hiện Hub chat = 1 phiên global (1 chat.json). Muốn: nhiều cuộc trò chuyện lưu riêng (như ChatGPT).
- J1 server: chat.json đơn → chats/<id>.json (title + sessionId + messages); API list/new/switch/rename/delete
- J2 client: sidebar danh sách hội thoại + ＋mới; mỗi convo sessionId riêng → context KHÔNG lẫn (hợp auto-route + D6)

## PHASE K — PERSONA THẬT + MULTI-AGENT 🧠📋⭐ (Bill định hướng) — chiến lược lớn nhất
Biến persona từ "trang trí" (chỉ systemPrompt+model+tool+flavor) → sức mạnh thật.
- K1 Persona đa lĩnh vực: thêm marketing, UI/UX, finance, copywriter, research... (không chỉ dev); mỗi persona = systemPrompt chuyên + skill + brain riêng + model phù hợp
- K2 **Expert-consultation routing**: Lucy phiên chính cần lĩnh vực khác → spawn sub-agent mang persona+skill+brain lĩnh vực đó, tổng hợp & cấp lại (tăng độ tin cậy — multi-agent thật, tận dụng Agent SDK vừa migrate)
- K3 **Per-agent brain VISUAL**: brain agent ĐÃ CÓ (`Brain/agents/*.md`: builder/eng/reviewer) nhưng galaxy CHƯA vẽ (thiếu trong GRAPH_DIRS) → thêm zone "agents" + view riêng mỗi agent. (quick win)
- K4 (optional) Persona registry/UI: tạo/sửa persona+skill+brain từ Hub thay file tay

## PHASE L — UNIFIED CONTEXT (Hermes parity) ⭐⭐ (Bill chỉ ra gốc rễ) — 📖 DETAIL: PHASE-L-UNIFIED-CONTEXT.md
Gốc rễ "auto-route sang model rẻ là hỏng": Claude giữ session server-side, còn lane (API free) STATELESS → caller chỉ gửi prompt, KHÔNG persona/history → mất mạch. D7 chỉ băng dán. Hạ tầng lane ĐÃ nhận messages[] đầy đủ — thiếu caller dựng đúng.
- L1 conversation store harness-owned (nền: Phase J)
- L2 ⭐ provider-agnostic request builder: mọi model nhận CÙNG history+persona → đổi model không đứt mạch
- L3 compressor (=E1) áp cho lane (giữ dưới trần ctx mỗi model)
- L4 model catalog scrape (OpenRouter /models + provider khác) → biết model nào ở nền tảng nào + ctx/giá/free → routing informed + UI "con nào ở đâu"
- L5 prompt-cache nơi hỗ trợ (optional, tối ưu chi phí)
→ Kết quả: auto-route THẬT liền mạch, NÂNG CẤP/bỏ băng-dán D7. Đặt sau J, TRƯỚC K.

## PHASE M — TOOL HARNESS CHO MỌI MODEL (lane "biết dùng máy" như Hermes) ⭐⭐ (Bill chỉ ra) — 📖 PHASE-M-UNIVERSAL-TOOLS.md
Gốc: lane CHAT (`chat-lane.ts`) = text thuần KHÔNG tool → auto-route sang model rẻ là bị tước file/bash/web → "ngu", fail. lane-runner CÓ loop+file+bash nhưng chỉ ở pipeline card + THIẾU web. Hermes cấp tool harness thống nhất cho mọi model → free model khôn (web fetch/research/task dài).
- M1 bộ tool dùng chung provider-agnostic: file/bash (có sẵn) + **web_fetch + web_search (MỚI — đang thiếu)**
- M2 ⭐ agentic loop thống nhất (nhấc từ lane-runner) — model rẻ tool-call → exec → lặp
- M3 nối vào MỌI path: chat/auto-route + sub-agent (K) + pipeline card
- M4 capability-aware: chỉ route task-cần-tool tới model tool-capable (cờ từ catalog L4)
→ Kết quả: model free = agent THẬT (web/research/file/bash, không đứt) ngang Hermes. Đi CẶP với L (L=context, M=tool).

## PHASE F/G/H — nền dài hạn (chưa đụng) — 📖 DETAIL ĐẦY ĐỦ: PHASE-FGH-DETAIL.md
- **F** Sức khỏe code: F1 dọn 5 smoke đỏ · F2 CI gate (tsc+smoke mỗi push, chặn merge) · F3 tách engine.ts → core/dispatch/triage · F4 gói types chung (1 nguồn catalog model) · F5 integration test e2e
- **G** Scale: G1 batch+checkpoint (resume) · G2 MCP/plugin (cắm tool ngoài qua SDK) · G3 multi-platform gateway (TG/Discord/WhatsApp 1 khung) · G4 cred-pool cross-process · G5 curator-at-scale
- **H** Orchestrator: H1 stream auto/orch · H2 offload sub-agent → free-lane · H3 Agent SDK ✅ (đã làm phiên này)
> Mỗi mục F/G/H giải thích "hoạt động như nào · đụng file gì · xong khi nào" trong PHASE-FGH-DETAIL.md.

## THỨ TỰ ĐỀ XUẤT TIẾP (cập nhật 2026-06-13 — D/E/B/D6/D7 đã xong)
1. **K3 — Visual brain từng agent** (quick win, data đã có, trả lời "sao không thấy")
2. **Phase J — Chat đa-phiên** (UX win + nền conversation store cho L)
3. **Phase L + M — Hermes parity cho model rẻ** ⭐⭐ (đi cặp): L = nối mạch context mọi model (builder+catalog+compressor, bỏ băng-dán D7) · M = cấp tool harness (file/bash/**web_fetch/web_search**) + agentic loop cho lane ở mọi path → free model = agent KHÔN + LIỀN MẠCH như Hermes
4. **Phase K — Persona thật + Expert-consultation** (cần L+M: sub-agent expert có context + tool)
5. Rải sau: Track 4b cron lọc tin xàm (trình hướng trước) · D polish · Dream lớp 2 · F (CI/test) · G/H.
6. **BEYOND HERMES (kho ý tưởng vượt Hermes)** 📖 BEYOND-HERMES-IDEAS.md — routing tự học/self-review · watchlist+alert thị trường · galaxy node=điểm thật + truy vấn visual · proactive watcher · multi-agent panel/debate · cost-aware routing. Làm sau parity L+M + K.

> Lý do: K3 rẻ trả lời ngay → J nền nhiều-phiên → **L+M = gốc Hermes parity (context + tool cho mọi model)** → K multi-agent (cần L+M) → polish/infra cuối.
