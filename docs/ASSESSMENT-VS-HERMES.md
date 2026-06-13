# Đánh giá Lucy (sau A+B+C) vs Hermes — UI/UX · Core · Clean-code · Structure

> **Viết 2026-06-13.** Sau khi xong Đợt A+B+C. Chấm 4 chiều, so Hermes, + nice-to-have xếp ưu tiên.
> Số liệu thật: Lucy agent-machine 92 file TS (~9.660 LOC, 37 smoke), engine.ts 834 LOC; Hub 31 file (~5.093 LOC);
> bridge 563 LOC Python. Hermes: cli.py ~621KB, run_agent.py ~236KB, hermes_state.py ~197KB, ~7.150 test.
> Thang điểm 1-10 (Hermes = chuẩn ngành đã chiến trận).

---

## 1. STRUCTURE / Kiến trúc — Lucy 8 · Hermes 7

**Lucy mạnh hơn ở modularity:** 92 module nhỏ-tập-trung (trung bình ~100 LOC/file trừ test), tách sạch tầng:
engine (điều phối) · runner (thực thi) · coordinator (HTTP) · worker · llm-lane (provider) · chat-lane (chat+route) ·
rate-guard/cred-pool/quota (resilience) · agent-brain/dream/distill (learning). 3 process tách (coordinator/worker/bridge)
→ scale + crash-isolation tốt.

**Hermes mạnh hơn ở breadth + maturity:** 30+ subsystem (gateway đa nền, cron, batch, acp, plugins, providers declarative).
NHƯNG nhiều file MONOLITH khổng lồ (cli.py 621KB = khó đọc/sửa). Lucy KHÔNG có file nào > 834 LOC → dễ onboard hơn.

**Nice-to-have:** (a) tách `engine.ts` (834 LOC, đang phình) → engine-core + engine-dispatch + engine-triage. (b) gói
`types` dùng chung — hiện bridge Python lặp lại hiểu-biết về MODEL_CATALOG (TS) → 1 nguồn sự thật (gen JSON từ TS).
(c) API-contract doc giữa hub↔coordinator↔bridge (giờ ngầm định).

## 2. CLEAN CODE — Lucy 8 · Hermes 7

**Lucy mạnh:** strict TS (HOUSE_SKILL cấm `any`), 37 smoke/feature (mỗi cơ chế có smoke riêng), kỷ luật fire-and-forget
(learning/notify hỏng KHÔNG gãy card), guardrail dày (token-guard, size-gate, loop-breaker, depth-breaker, lease,
rate-guard, atomic-write). Comment giải-thích-TẠI-SAO (đúng chuẩn). Inject-able runner trong test (no real-LLM).

**Hermes mạnh:** ~7.150 test (gấp ~190× Lucy về số), đã chiến trận production, edge-case phủ kỹ (think_scrubber per-delta,
credits schema-version gating...). NHƯNG file giant + 20+ boolean-flag (chính họ thừa nhận → đẻ ProviderProfile để dọn).

**Nợ Lucy (nice-to-have):** (a) 5 smoke đỏ = NỢ TEST CŨ (error-stats, remote EADDRINUSE, verify-gate-loop stuck-vs-loop,
conc flaky-timing) — dọn cho sạch CI. (b) smoke hiện thiên unit; thiếu integration thật (coordinator↔worker↔bridge e2e
có key). (c) `readBody(): Promise<any>` ở coordinator — nên type. (d) chưa có lint/CI gate tự động (chạy smoke tay).

## 3. CORE / Lõi — Lucy 7.5 · Hermes 9

**Lucy NAY có (sau A+B+C):** multi-model chat + smart-routing + thinking · rate-guard cross-process + credential-pool +
quota-tracking · quality-first mode · não-nghề per-agent (win/miss + dream đúc kết + curator) · verify-gate chống
false-done · triage tự-chữa-kẹt · token-guard · FTS5 recall (recall.ts) · prompt-cache parity. → ~80% pattern cốt lõi Hermes.

**Hermes VẪN hơn:** (a) context compressor (giữ head+tail, summarize giữa) — phiên dài Lucy sẽ tràn ctx. (b) batch-runner
multiprocessing + checkpoint/resume — chạy hàng loạt task. (c) curator-at-scale (umbrella merge, usage telemetry). (d)
prompt-caching đã tinh (Lucy mới vừa sửa parity, chưa đo thực tế). (e) session lineage sâu (parent_session_id + bookends).
(f) MCP ecosystem + ACP adapter.

**Nice-to-have:** context-compressor (ROI cao khi chat dài) > batch+checkpoint > session-lineage dedupe.

## 4. UI / UX — Lucy 8 · Hermes(webui) 7.5

**Lucy Hub mạnh hơn ở thị giác:** React+vite, GIÀU hơn webui vanilla — Dashboard (819 LOC: metrics/agent-insights/
cho-lucy) · Board kanban (parked col + sub-badge lõi) · BrainViz · Mindmap · Galaxy (đồ thị tri thức) · NoteEditor +
RichText. Đẹp, "có hồn" hơn webui chức-năng-thuần.

**Hermes webui mạnh hơn ở parity-với-agent:** composer footer (đổi model/persona/context-ring ngay) · SSE streaming
(chữ chạy realtime) · card thinking/tool/approval inline · workspace panel (cây file + sửa inline + git) · session
mgmt (rename/archive/pin/tag/cost) · voice input · 11 theme · mobile.

**Nice-to-have (giờ A đã có /model /persona /think ở bridge → Hub NÊN phơi ra):** (a) **composer footer** chọn
model/persona + vòng context-ring. (b) **SSE streaming** (giờ request-response 1 phát). (c) **card thinking** (mượn
webui vàng — A4 đã có data). (d) **approval card** HITL đẹp (thay gate thô). (e) **mobile** responsive. (f) hiện
**rate-guard/quota** (B1/B3 đã có data qua `/llm/guard`) lên Dashboard.

---

## TỔNG: Lucy ~7.9 · Hermes ~7.6 (cho QUY MÔ Lucy)
Lucy THẮNG structure/clean/UI-thị-giác (gọn, đẹp, dễ sửa, hợp 1-2 người). Hermes THẮNG core-depth + test-coverage +
UI-parity (chín, phủ rộng, hợp production/đội lớn). **Với mục tiêu của chủ nhân (trợ lý cá nhân 1 người, đẹp + đủ thông
minh), Lucy đang ở thế tốt** — không cần đuổi hết Hermes, chỉ nhặt nice-to-have ROI cao.

## NICE-TO-HAVE xếp ưu tiên (sau A+B+C)
1. **Hub phơi tính năng A/B** (composer model/persona + card thinking + panel rate-guard/quota) — *data đã có, chỉ thiếu UI*. Lời nhất.
2. **SSE streaming** Hub + bridge — cảm giác "sống", ROI UX cao.
3. **Context compressor** — chặn tràn ctx phiên dài (core gap rõ nhất còn lại).
4. **Dọn nợ test** (5 smoke đỏ) + CI gate — sức khỏe lâu dài.
5. **Tách engine.ts** + gói types dùng chung (bridge↔TS) — clean-code.
6. **Batch + checkpoint** — chỉ khi cần chạy hàng loạt task (chưa cấp thiết cho 1 người).
