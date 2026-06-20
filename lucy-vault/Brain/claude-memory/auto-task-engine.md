---
name: auto-task-engine
description: "⭐lucy-autotask HOÀN THÀNH AT-1→AT-8; pm2 lucy-autotask LIVE; sprint loop+inbox watcher+HTML report XONG; habit: việc lặp thả task spec vào queue thay vì cày Opus"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d9843b7-bb2e-44d4-a41f-8960493c84ab
---

`lucy-autotask` — bộ tool local tự động hóa thứ 2, **song sinh với auto-build** (Bill chốt 2026-06-17).
Auto-build = tự CÀY CODE theo MASTER-SPEC. Auto-task = tự LÀM VIỆC tổng quát theo task spec rời
(research nhẹ, soạn nháp, tóm tắt, dọn vault...). Triết lý: **lane model rẻ lo phần cày, Claude lo phần nghĩ**.

Trạng thái (2026-06-17): **AT-1→AT-8 TẤT CẢ XONG** ✅✅✅
- AT-1 ✅ scaffold `/root/lucy/auto-task.py` (log/tg/DANGER guard/report_tok, `--dry`)
- AT-2 ✅ `/root/lucy/tasks/{queue,doing,done,failed}/` + frontmatter parser + move_task
- AT-3 ✅ `triage()` gọi lane model → JSON {tier/reason/plan/risk}; danger→reject
- AT-4 ✅ `run_lane()` → `/chat-lane-agentic`, report_tok synchronous, source='autotask', LedgerSource LIVE
- AT-5 ✅ `run_claude()` Agent SDK in-process sonnet; escalation lane→claude với trace; _execute_task() helper
- AT-6 ✅ `tg()` 3-5 dòng với cost; `generate_html_report()` → `/var/www/lucy-reports/autotask-DATE.html` (dark lime/gold); `_estimate_usd()` model-aware
- AT-7 ✅ sprint loop MAX_ITERS; stop-file .autotask-stop; hết queue → tg "📭 hết task"; pm2 `lucy-autotask` --no-autorestart; VERIFY: 2 task→done/, pm2 stopped ✓
- AT-8 ✅ `scan_inbox()` polling Brain/inbox/*.md; `.inbox-seen` JSON; first-run seed không spam; file mới → task tier=auto priority=3 vào queue; `--inbox-test` CLI; VERIFY: tạo note→1 task sinh, lần 2=0 ✓
- Kiến trúc đầy đủ: `~/lucy/lucy-vault/Projects/auto-task-engine.md` (có build plan AT-1..AT-8 auto-able).
- Đọc web: http://14.225.255.73/reports/auto-task-engine.html

Thiết kế lõi (tái dùng hạ tầng thật, không dựng mới):
- Queue = filesystem state machine `/root/lucy/tasks/{queue,doing,done,failed}/`, task = file .md có frontmatter.
- Triage lane model → tier `lane|claude|reject`; risk=high luôn escalate Claude.
- Lane executor = coordinator `POST /chat-lane-agentic`; Claude executor = Agent SDK model=sonnet + DANGER guard copy từ auto-build.py.
- Token: `POST /spend` source='autotask'. Report: Telegram + HTML `/var/www/lucy-reports/`.
- pm2 `lucy-autotask`, dừng êm `touch /root/lucy/.autotask-stop`. Tầng 2 = watcher Brain/inbox/ tự sinh task.

**Habit khi tool đã chạy:** việc lặp/research nhẹ/soạn nháp KHÔNG gấp → viết task spec thả vào
`/root/lucy/tasks/queue/` thay vì tự cày tốn Opus. Việc code-theo-MASTER-SPEC vẫn dùng auto-build, đừng nhầm.
Mặc định Sonnet cho Claude executor. Liên quan: [[lane-agentic-tools]] · [[fitcity-autobuild-push-guard]] · [[bh-d-routing-self-learning]].
