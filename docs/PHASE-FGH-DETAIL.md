# Phase F / G / H — DETAIL đầy đủ (2026-06-13)

> Viết rõ "nó là gì · giải đau gì · HOẠT ĐỘNG như nào · đụng file nào · xong khi nào" cho từng mục.
> Bill đọc, có ý/chỉnh thì kêu Lucy thêm vào. Trạng thái: 📋 chưa build (trừ H3 ✅).

---

# PHASE F — SỨC KHỎE CODE (test / CI / clean)
**Mục tiêu chung:** đổi đồ không sợ vỡ ngầm; mỗi push tự kiểm; code không phình. ROI: lâu dài, chống regress.

## F1 — Dọn 5 smoke test đang đỏ
- **Đau:** 37 smoke test, 5 cái đỏ/flaky → mất niềm tin vào test, không dám dựa.
- **Hoạt động:** sửa từng cái theo nguyên nhân thật:
  - `error-stats-bugs` / `error-stats-model`: assert sai sau khi đổi schema error-stats → cập nhật assert.
  - `remote` (EADDRINUSE): test mở port cố định, chạy lại trùng port → đổi sang **random free port** mỗi lần.
  - `verify-gate-loop`: lẫn giữa "stuck" và "loop" → tách rõ điều kiện (stuck = không tiến triển; loop = lặp cùng stage N lần).
  - `conc` (concurrency timing flaky): ngưỡng thời gian quá chặt → **nới ngưỡng** + assert theo thứ tự thay vì theo ms.
- **Đụng:** `agent-machine/src/smoke-*.ts`.
- **Xong khi:** `npm run smoke` xanh 37/37 ổn định (chạy 3 lần không flaky).

## F2 — CI gate (chặn merge khi đỏ)
- **Đau:** không có cổng tự động → code lỗi lọt vào main, phát hiện muộn.
- **Hoạt động:** GitHub Actions: mỗi `push`/`PR` → chạy `tsc --noEmit` (typecheck cả hub+agent-machine) + `npm run smoke` → đỏ thì **chặn merge** (required check). Thêm badge trạng thái.
- **Đụng:** `.github/workflows/ci.yml` (mới), package.json scripts.
- **Xong khi:** push lên là Actions chạy; PR đỏ không merge được.

## F3 — Tách `engine.ts` (đang ~834 dòng, phình)
- **Đau:** 1 file quá to → khó đọc, dễ đụng nhầm, merge-conflict.
- **Hoạt động:** tách theo trách nhiệm:
  - `engine-core.ts` — vòng đời card (queue→working→done), state machine.
  - `engine-dispatch.ts` — chọn runner/persona/model, gọi runner.
  - `engine-triage.ts` — xử lý outcome (advance/rework/needs_decision), stuck/loop/size-gate.
  - Giữ `engine.ts` làm façade re-export để không vỡ import ngoài.
- **Đụng:** `agent-machine/src/engine.ts` → 3 file; cập nhật import nội bộ.
- **Xong khi:** tsc + smoke xanh, hành vi KHÔNG đổi (refactor thuần), mỗi file < ~350 dòng.

## F4 — Gói types dùng chung (1 nguồn sự thật cho catalog model)
- **Đau:** danh mục model khai 2 nơi (TS `MODEL_CATALOG` + bridge Python tự chép) → lệch nhau, sửa 1 quên 1.
- **Hoạt động:** script build sinh **JSON catalog** từ `MODEL_CATALOG` (TS) → `shared/models.json`; bridge Python ĐỌC file đó thay vì hardcode. TS là nguồn duy nhất, Python chỉ consume.
- **Đụng:** `agent-machine/src/llm/*` (export gen), script `gen-catalog`, `bridge/lucy_bridge.py` (đọc json).
- **Xong khi:** đổi model 1 chỗ (TS) → bridge tự thấy, không sửa tay 2 nơi.

## F5 — Integration test thật (e2e)
- **Đau:** smoke phần lớn là unit/mock; chưa test luồng THẬT coordinator↔worker↔bridge.
- **Hoạt động:** test e2e có key thật (hoặc lane free): tạo 1 card nhỏ → coordinator giao worker → runner chạy → outcome về → assert end-to-end. Chạy tách (tag `e2e`, không trong CI mặc định vì tốn token).
- **Đụng:** `agent-machine/src/smoke-e2e.ts` (mở rộng), script riêng.
- **Xong khi:** `npm run smoke:e2e` chứng minh 1 card đi trọn pipeline thật.

---

# PHASE G — SCALE & HỆ SINH THÁI
**Mục tiêu chung:** khi Lucy gánh NHIỀU dự án/kênh/tool. ROI: chỉ cấp thiết khi tải nặng → để sau.

## G1 — Batch + checkpoint (chạy hàng loạt + resume)
- **Đau:** giờ chạy tuần tự; backlog lớn (vd quét 50 task đêm) thì chậm + lỡ crash là mất tiến độ.
- **Hoạt động:** queue nhiều task chạy **song song có giới hạn** (worker pool); mỗi task ghi **checkpoint** (đã tới stage nào) → crash/restart **resume** từ checkpoint thay vì làm lại. Cron đêm quét backlog.
- **Đụng:** coordinator (scheduler), worker (pool + checkpoint store), `~/.agent-machine`.
- **Xong khi:** kill giữa chừng → khởi động lại chạy tiếp đúng chỗ, không làm lại từ đầu.

## G2 — MCP / Plugin system (cắm tool ngoài)
- **Đau:** Lucy chỉ có tool built-in (Read/Write/Bash/web). Muốn thêm năng lực (Notion, GitHub API, DB...) phải sửa code.
- **Hoạt động:** Agent SDK (vừa migrate) hỗ trợ **MCP servers** sẵn → khai 1 file config `mcp_servers` (url/command + credential qua vault), persona nào cần thì bật toolset đó. Cắm/gỡ tool không sửa core.
- **Đụng:** option SDK `mcpServers`/`mcp_servers` ở runner/hub/bridge; file config + vault credential.
- **Xong khi:** thêm 1 MCP server qua config → agent dùng được tool mới, không đụng code.

## G3 — Multi-platform gateway (Telegram + Discord + WhatsApp 1 khung)
- **Đau:** bridge hiện chỉ Telegram; Discord qua radiant-bot riêng; thêm kênh = viết lại.
- **Hoạt động:** trừu tượng 1 lớp `Channel` (nhận tin / gửi tin / chia nhỏ / file) → mỗi nền tảng 1 adapter (Telegram/Discord/WhatsApp) cắm vào cùng lõi xử lý (run_claude_stream + persona + session). Per-platform toolset/giới hạn.
- **Đụng:** tách lõi bridge khỏi Telegram-specific; thêm adapters.
- **Xong khi:** bật kênh mới = thêm 1 adapter, lõi không đổi.

## G4 — Credential-pool sâu (xoay key cross-process)
- **Đau:** rate-guard/cred-pool hiện in-process (mỗi tiến trình tự biết); nhiều tiến trình (hub/bridge/worker) không chia sẻ trạng thái key đang cooldown → đụng limit chéo.
- **Hoạt động:** store cooldown **dùng chung** (file/sqlite) → mọi tiến trình đọc/ghi "key X đang nghỉ tới T". Provider-profile **khai báo** (gom quirk mỗi nhà cung cấp 1 chỗ).
- **Đụng:** llm-lane / cred-pool, store chung ở `~/.agent-machine`.
- **Xong khi:** key bị limit ở tiến trình A → tiến trình B cũng né, không đụng lại.

## G5 — Curator-at-scale (gộp skill/brain quy mô lớn)
- **Đau:** skill + brain nhiều dần → trùng lặp, khó tra, "umbrella" chưa gộp tốt.
- **Hoạt động:** curator gộp các skill/brain cùng ô (umbrella merge) + đo **usage telemetry** (cái nào hay dùng nổi lên, cái nào chết thì archive). Tự dọn định kỳ.
- **Đụng:** curator (agent-machine), Skills/ + Brain/.
- **Xong khi:** skill/brain trùng được gộp, ít dùng được archive, tra cứu gọn.

---

# PHASE H — ORCHESTRATOR NÂNG CẤP (luồng nhiều agent)
**Mục tiêu chung:** điều phối multi-agent mượt + tiết kiệm. Nối tiếp UX streaming.

## H1 — Stream cho auto/orchestrator (chữ chạy lúc plan + tổng hợp)
- **Đau:** auto_run/orch_run hiện chạy "1 cục" (chờ lâu mới ra), không thấy tiến trình.
- **Hoạt động:** dùng `run_claude_stream`/SDK stream cho cả khâu PLAN (orchestrator nghĩ kế hoạch) + SYNTHESIS (tổng hợp kết quả sub-agent) → chữ chạy realtime như chat thường.
- **Đụng:** bridge auto_run/orch_run, hub orchestrator path.
- **Xong khi:** chạy auto/orch thấy plan + tổng hợp chạy chữ, không đứng hình.

## H2 — Offload sub-agent → free-lane (đỡ ăn rate-limit subscription)
- **Đau:** mọi sub-agent đều ăn Claude subscription → tốn + dễ đụng rate-limit.
- **Hoạt động:** sub-agent KHÔNG cần Claude xịn (vd việc tổng hợp/lọc đơn giản) → route xuống **lane free** (Nemotron free / OpenRouter) qua coordinator. Persona khai `laneModel` (đã có field sẵn). Việc khó vẫn Claude.
- **Đụng:** coordinator dispatch, runner chọn lane theo persona.kind/laneModel.
- **Xong khi:** sub-agent đơn giản chạy lane free, subscription dành cho não chính.

## H3 — Đường B (Claude Agent SDK in-process) ✅ ĐÃ XONG (phiên 2026-06-13)
- Hub + dream-brain + runner + bridge đều chạy `@anthropic-ai/claude-agent-sdk`. Bỏ spawn latency, code sạch. Verified live.

---

> Ghi chú: F = nền an toàn, làm khi muốn vững dài hạn (không gấp). G = chỉ khi Lucy gánh nhiều dự án/kênh.
> H1/H2 = nối tiếp khi đẩy mạnh multi-agent (sau Phase K). Thứ tự thực tế: ưu tiên K3 → J → K trước, F/G/H rải sau theo nhu cầu.
