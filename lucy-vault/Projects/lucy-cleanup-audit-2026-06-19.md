---
title: Lucy System Cleanup Audit
date: 2026-06-19
status: proposal (chờ chủ nhân duyệt từng tầng)
agent: lucy
---

# Lucy — Audit hệ thống & lộ trình dọn gọn (2026-06-19)

Khảo sát thực địa 4 vùng (agent-machine TS · bridge+harness Python · hub web/server · root+git+vault). Đây là **đề xuất hướng dọn**, chưa đụng code. Mọi việc RỦI RO (đụng live service) đều chờ chủ nhân duyệt.

## 0. Tình trạng tổng quan

Hệ thống **lành mạnh về kiến trúc** nhưng **lộn xộn về tổ chức file + git + flag**. Không phải code sai — là nợ tích tụ do bồi nhanh nhiều sprint.

- 4 service live (pm2): `lucy-coordinator` (8780), `lucy-hub` (8800), `lucy-bridge`, `lucy-vps-worker` + autopilot. Tất cả online.
- agent-machine/src = **132 file .ts** (core đúng kiến trúc: coordinator↔engine↔runner; memory M1–M4; llm-lane; mcp; skill).
- hub/server = **1 god-file index.ts 1220 dòng / 53 endpoint**. hub/web = 35 component.
- bridge + 3 harness Python (auto-task / auto-build / auto-build-free) **copy-paste nặng**.
- Git: **20 file tracked-modified + 919 untracked** chưa commit → "messy" lớn nhất là ở đây, không phải code.

## 1. Năm nguồn lộn xộn chính (xếp theo độ đau)

**① Git chưa chốt (đau nhất, nhưng dễ nhất).** 919 file untracked (gần hết là vault Brain/* + 3 harness .py + tasks/ state) + 20 tracked-modified treo lửng. Repo /root/lucy vừa có .gitmodules (vault là submodule) vừa track lẫn 39 file vault → double-tracking gây rối. → *Cảm giác "mọi thứ messy" phần lớn đến từ đây.*

**② File rác / thư mục tàn dư.**
- *.bak: `lucy_bridge.py.bak-presdk`, `.bak-stopcmd`, `gen_brief.mjs.bak`, `hub/server/src/index.ts.bak-l3`, `crontab.backup.20260614`.
- Thư mục chết: `hermes/`, `dashboard/`, `order-service/`, `voice/` — không proc pm2, đã bị thay/bỏ.
- `references/hermes-agent/` submodule 117MB = ref cũ (bridge đã thay Hermes 2026-06-13).
- One-shot script root: `overnight-rehost.sh`, `finish-crons-then-s5.sh`, `memory-rehost-watcher.sh`.

**③ Copy-paste tầng Python.** ~15 hàm nhân bản 3 lần qua auto-task/auto-build/auto-build-free: `tg()`, `log()`, `_read_env_file()`, `_coord_creds()`, `report_tok()` — ~450 dòng trùng. Timeout HTTP coordinator mỗi chỗ một kiểu (5s/90s/300s).

**④ Feature-flag rải rác.** ~34 biến `LUCY_*` + ~28 `AM_*` đọc rải khắp file, khó biết flag nào đang bật/DRY-RUN. Có flag chết: `LUCY_RERANK` (stub no-op), `LUCY_PROMPT_ARCHITECT_ESCALATE_MODEL` (dead), `LUCY_DISTILL` (mâu thuẫn guard).

**⑤ God-file + component phình.**
- `hub/server/src/index.ts` 1220 dòng / 53 endpoint inline.
- `hub/web/Dashboard.tsx` 973 dòng; 3 chat component trùng (Chat/LucyChat/PersonaChatPanel); ~18 chỗ `fetch()` tay bỏ qua api.ts.
- `agent-machine`: `coordinator.ts` handler ~350 dòng 1 hàm; `engine.tick()` ~200 dòng; CLI (11 file) + smoke (53 file) trộn chung thư mục src với code prod.

## 2. Lộ trình dọn — phân 3 tầng theo rủi ro

### TẦNG A — An toàn tuyệt đối (0 rủi ro live, làm ngay được)
1. **Chốt git**: commit snapshot 20 file modified + quyết track/ignore nhóm untracked. Thêm `.gitignore`: `/skills/ /tasks/ tools/ auto-build-free-plan.json fitcity-admin-LOGIN.txt agent-machine/.opencode-zen-keys`. Gỡ double-track vault (`git rm --cached` 39 file, để submodule lo).
2. **Xóa rác**: tất cả *.bak / *.backup, `hermes/ dashboard/ order-service/ voice/`, one-shot script. Gỡ submodule `references/hermes-agent`.
3. **Gom thư mục agent-machine/src**: `cli/` (11 *-cli.ts) + `test/` (53 smoke*.ts) + xóa `serve-ws.ts`. Code prod còn lại sạch hẳn.
4. **Xóa flag chết**: `LUCY_RERANK` stub, `LUCY_PROMPT_ARCHITECT_ESCALATE_MODEL`, hợp nhất guard `LUCY_DISTILL`.

→ Ước lượng: 1 buổi. Kết quả: repo gọn, cảm giác "messy" giảm ~70%.

### TẦNG B — Rủi ro thấp-trung (refactor thuần, cần test, KHÔNG đổi hành vi)
5. **Python `lib/common.py`**: gom tg/log/report_tok/_coord_creds → 3 harness import chung. Bỏ ~450 dòng trùng. Test trong sandbox trước, restart từng proc.
6. **Hub web api-client**: đưa ~18 `fetch()` tay vào `api.ts` type-safe (AutoTask/Schedule/Aki/Logs/Settings/BrainViz).
7. **Tách Dashboard.tsx** 973 → 4 component con (Metrics/Cost/Alerts/TokenGuard).
8. **Config singleton agent-machine**: 1 module `flags.ts` đọc & expose toàn bộ LUCY_*/AM_* (1 nguồn, dễ thấy trạng thái).

→ Ước lượng: 3–4 buổi rải. Mỗi mục verify riêng.

### TẦNG C — Rủi ro cao (đụng lõi live — CHỜ DUYỆT, không rush)
9. **Tách god-file hub `index.ts`** → `routes/` (auth/chat/schedule/am-proxy/metrics/build/prompt-arch). Làm trên branch, verify kỹ, deploy cẩn thận.
10. **Tách `coordinator.ts` HTTP handler** → router per-endpoint; **tách `engine.tick()`** thành step. Lõi 24/7 → 1 bug = outage. Cần smoke-e2e-http đầy đủ trước.
11. **Audit security `lane-chat.ts` agentic** (bash/file-read = RCE vector): thêm workspace isolation + audit log. Nên đi kèm /security-review.

## 3. Verify knowledge (vault vs thực tế)
- `pm2-live-services-not-ecosystem`, `lucy-hub-build-deploy`, token-guard memory → **khớp thực tế**.
- `lucy-bridge-replaces-hermes` đúng (không còn proc Hermes) nhưng thư mục `hermes/` + submodule còn sót → dọn ở Tầng A.
- `ecosystem.config.cjs` (root) vs `hub/ecosystem.config.cjs` **cùng khai lucy-hub** → trùng, cần chọn 1 nguồn.
- Brain/claude-memory: 54 file .md, không phình/trùng → ổn.

## 4. Khuyến nghị bắt đầu
Làm **Tầng A trước** (1 buổi, 0 rủi ro) — đây là thứ tạo cảm giác lộn xộn nhiều nhất mà rẻ nhất để dọn. Tầng B làm dần khi rảnh. Tầng C chỉ khi chủ nhân duyệt từng mục + có cửa sổ test, không đụng vào giờ live quan trọng.
