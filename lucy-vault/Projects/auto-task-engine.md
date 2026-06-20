---
title: Auto-Task Engine (lucy-autotask)
status: proposal
created: 2026-06-17
owner: Bill
agent: lucy
tags: [automation, lane-model, local-tools, auto-build-sibling]
---

# Auto-Task Engine — `lucy-autotask`

> Bộ tool local tự động hóa thứ 2 của Lucy, **song sinh với auto-build**.
> Auto-build = "tự CÀY CODE theo MASTER-SPEC". Auto-task = "tự LÀM VIỆC theo task spec rời".
> Triết lý: **lane model (rẻ) lo phần cày, Claude lo phần nghĩ** — chỉ escalate khi khó.

---

## 1. Vì sao làm cái này

Chủ nhân thích auto-build vì nó **tự chạy + tự báo cáo, đúng ý**. Nhưng auto-build chỉ
ăn được task *code theo MASTER-SPEC*. Còn rất nhiều việc lặp/đời thường không phải build code:
research nhẹ, soạn nháp, tóm tắt, dọn vault, sinh đề xuất từ 1 note ý tưởng...
→ Cần 1 harness tổng quát hơn, **rẻ token**, để Lucy tự nhặt việc mà làm.

Mục tiêu cứng:
- **Tiết kiệm token**: việc dễ/lặp → lane model (Nemotron/Hermes); chỉ việc khó mới đốt Claude, và Claude dùng **Sonnet** chứ không Opus.
- **Tự chạy + tự báo cáo**: y cảm giác auto-build (state, sprint, Telegram report).
- **Local-first**: harness Python nhỏ gọn, KHÔNG thay skill/MCP lớn — tái dùng hạ tầng đã có.
- **An toàn live**: kế thừa nguyên guard của auto-build (chặn git push / rm -rf / pm2 đụng bridge).

---

## 2. Kiến trúc tổng thể

```
                 ┌─────────────────────────────────────────────┐
   Nguồn task →  │  TASK QUEUE  (filesystem state machine)      │
                 │  /root/lucy/tasks/{queue,doing,done,failed}/ │
                 └───────────────┬─────────────────────────────┘
                                 │ nhặt task .md (theo priority)
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │  TRIAGE  (lane model phân tầng)             │
                 │  → tier = lane | claude | reject            │
                 └───────┬──────────────────────┬──────────────┘
            lane-able    │                      │  cần suy nghĩ
                         ▼                      ▼
          ┌────────────────────────┐   ┌────────────────────────┐
          │  LANE EXECUTOR         │   │  CLAUDE EXECUTOR       │
          │  POST /chat-lane-      │   │  Agent SDK in-process  │
          │  agentic (Nemotron)    │   │  model=sonnet          │
          │  tool: web/file/bash   │   │  guard DANGER regex    │
          └───────────┬────────────┘   └───────────┬────────────┘
                      │  fail/escalate ──────────────┘
                      ▼
          ┌─────────────────────────────────────────────────────┐
          │  REPORT + LEDGER                                     │
          │  • POST /spend  source='autotask'  → token-guard    │
          │  • Telegram báo cáo gọn                             │
          │  • Host HTML report → /var/www/lucy-reports/        │
          └─────────────────────────────────────────────────────┘
```

---

## 3. Thành phần chi tiết

### 3.1. Task Queue — state machine bằng filesystem
Đơn giản, không cần DB. Mỗi task = 1 file `.md` di chuyển giữa các thư mục:

```
/root/lucy/tasks/
  queue/    # chờ làm (chủ nhân thả vào, hoặc watcher sinh)
  doing/    # đang làm (chống nhặt trùng)
  done/     # xong (kèm output + report)
  failed/   # fail sau N retry, chờ chủ nhân ngó
```

**Schema task spec** (frontmatter + body):
```markdown
---
id: t-2026-06-17-001
title: Tóm tắt 5 bài trending crypto sáng nay
tier: auto            # auto = để triage tự quyết | lane | claude
priority: 2           # 1 cao nhất
model: sonnet         # chỉ dùng khi tier=claude (mặc định sonnet, KHÔNG opus)
max_lane_turns: 12
created: 2026-06-17T08:00:00+07
status: queued
---

## Mục tiêu
<mô tả việc cần làm, rõ ràng như 1 mini-spec>

## Đầu ra mong muốn
- [ ] file kết quả ở <path>
- [ ] báo cáo Telegram 3-5 dòng

## Ràng buộc
- nguồn thật, ghi nguồn + thời điểm
- không đụng <gì>
```

### 3.2. Triage — chỗ lane model tỏa sáng (tiết kiệm nhất)
Một lượt **lane model** đọc task, trả JSON quyết định:
```json
{ "tier": "lane|claude|reject",
  "reason": "...",
  "plan": ["bước 1", "bước 2"],
  "risk": "low|med|high" }
```
Quy tắc:
- `tier=lane` → việc lặp/đơn giản (format, tóm tắt, research nhẹ, soạn nháp, dọn file) → lane executor cày luôn.
- `tier=claude` → cần suy luận/đa bước/đụng code → Claude executor (Sonnet).
- `tier=reject` → mơ hồ/nguy hiểm → đẩy `failed/` + hỏi chủ nhân.
- `risk=high` → **luôn** escalate Claude bất kể tier, và bật guard chặt.

→ Phần lớn task rơi vào `lane`, đốt token rẻ. Chỉ thiểu số lên Sonnet.

### 3.3. Lane Executor
Gọi coordinator có sẵn: `POST http://127.0.0.1:8780/chat-lane-agentic`
- Body `{ model: LUCY_LANEMODEL, messages, maxTurns }`
- Vòng agentic sẵn tool: `web_search, web_fetch, read_file, list_dir, bash, write_file, edit_file, consult_expert` (sandbox `safePath`).
- Nếu lane "bí" (trả về cờ NEEDS_CLAUDE hoặc vượt maxTurns không xong) → **escalate** sang Claude executor, đính kèm trace lane đã làm để khỏi làm lại từ đầu.

### 3.4. Claude Executor
Y khuôn auto-build:
- **Claude Agent SDK in-process** (`from claude_agent_sdk import query`), KHÔNG `claude -p`.
- `model = task.model or 'sonnet'` (env `AUTOTASK_MODEL=sonnet`, **mặc định Sonnet để tiết kiệm**).
- `can_use_tool` callback tái dùng **nguyên `DANGER` regex của auto-build.py** (chặn `git push`, `rm -rf /root/lucy`, pm2 đụng bridge, mkfs, dd, fork bomb, curl|bash...).
- Đo `usage` trong `ResultMessage` → `report_tok()`.

### 3.5. Watcher / Trigger (tầng 2)
Theo dõi để **tự sinh task**, không cần chủ nhân gõ:
- `/root/lucy/lucy-vault/Brain/inbox/` có file mới → sinh task "research + soạn đề xuất từ note này".
- Folder/feed tùy cấu hình.
- Cơ chế: polling mtime mỗi vòng cron (không cần inotify daemon cho gọn).

### 3.6. Report + Ledger
- **Token**: mọi executor `POST /spend` với `source='autotask'`, kèm `model` thật (sonnet/nemotron) + cacheTok → vào LedgerEntry, token-guard tính đúng, không double-count.
- **Telegram**: mỗi task xong/fail báo gọn 3-5 dòng tới `LUCY_ALLOWED_USER_ID`.
- **Web report**: gom kết quả 1 sprint → HTML host `/var/www/lucy-reports/autotask-YYYY-MM-DD.html` → đọc tại `http://14.225.255.73/reports/`.

---

## 4. Vòng chạy (sprint loop) & lịch

Khuôn theo auto-build + cron token-window:
- pm2 process: **`lucy-autotask`** (`--interpreter python3 --no-autorestart`).
- Mỗi vòng nhặt task `queue/` priority cao nhất → triage → execute → report → move file.
- `AUTOTASK_MAX_ITERS` task/lần (mặc định 6, theo token-window như shader sprint).
- Dừng êm: `touch /root/lucy/.autotask-stop` (dừng sau task hiện tại).
- Cron canh token-window (ví dụ vài lần/ngày), hoặc chạy tay khi có task gấp.
- Env then chốt: `AUTOTASK_MODEL=sonnet`, `LUCY_LANEMODEL`, `AUTOTASK_MAX_ITERS`, `AM_COORD_URL`, `AM_TOKEN`.

---

## 5. An toàn (kế thừa auto-build, không nới lỏng)

- Guard `DANGER` regex copy nguyên từ `auto-build.py` (dòng 89–101) → `PermissionResultDeny`.
- Lane executor đã có `safePath()` sandbox chặn path escape.
- Secret: KHÔNG đọc/echo secret qua task/report (theo [[secret-handling-no-chat-no-echo]]).
- Việc phá hủy lớn / đụng hệ chung (bridge, radiant-bot) → `tier=reject` → hỏi chủ nhân, KHÔNG tự làm.
- `failed/` là chốt chặn: fail N lần thì dừng, không retry vô hạn đốt token.

---

## 6. Tái dùng hạ tầng thật (không dựng mới)

| Cần | Dùng lại cái có sẵn |
|-----|---------------------|
| Harness loop + guard + SDK call | khuôn `/root/lucy/auto-build.py` |
| Lane model + tool agentic | coordinator `POST /chat-lane-agentic` (`lane-chat.ts`, `web-tools.ts`) |
| Token attribution | coordinator `POST /spend` (`coordinator.ts:126`) |
| Cron token-window | khuôn `cron_shader_sprint.sh` + state file |
| Host report web | `/var/www/lucy-reports/` → `http://14.225.255.73/reports/` |
| Báo cáo Telegram | `tg()` khuôn auto-build |

---

## 7. Build plan — để AUTO-BUILD cày bằng SONNET

> Chủ nhân chốt: **viết kiến trúc trước → auto-build execute bằng Sonnet cho tiết kiệm.**
> Dưới đây là task list auto-able, dán vào MASTER-SPEC (hoặc spec rời) cho `lucy-autotask`.
> Mỗi task auto-able, có tiêu chí DONE rõ để harness tự mark ✅.

- [ ] **AT-1** Scaffold `/root/lucy/auto-task.py` (copy khung auto-build: tg(), report_tok(), DANGER guard, SDK call). DONE = file chạy `python3 auto-task.py --dry` in ra "no tasks".
- [ ] **AT-2** Task queue: tạo `/root/lucy/tasks/{queue,doing,done,failed}/` + loader đọc frontmatter + sort priority. DONE = thả 1 file mẫu vào queue, harness nhận diện & in plan.
- [ ] **AT-3** Triage: gọi lane model phân tier (JSON schema mục 3.2), guard risk=high→claude. DONE = task mẫu được gán tier đúng, log lý do.
- [ ] **AT-4** Lane executor: gọi `/chat-lane-agentic`, parse kết quả, ghi output vào `done/`. DONE = 1 task "tóm tắt file X" chạy hết bằng lane, có output.
- [ ] **AT-5** Claude executor + escalation: tier=claude hoặc lane-bí → SDK model=sonnet, đính trace lane. DONE = 1 task khó escalate thành công, ledger ghi source=autotask model=sonnet.
- [ ] **AT-6** Report: Telegram 3-5 dòng + HTML host `/var/www/lucy-reports/autotask-DATE.html`. DONE = link mở được trên browser.
- [ ] **AT-7** Sprint loop + pm2 `lucy-autotask` + `.autotask-stop` + env. DONE = `pm2 start` chạy N task rồi dừng êm.
- [ ] **AT-8** (tầng 2) Watcher `Brain/inbox/` → tự sinh task. DONE = thả note vào inbox, task tự xuất hiện ở queue.

---

## 8. Lộ trình phân tầng

- **Tầng 1 (MVP)**: AT-1 → AT-7. Có queue thủ công + triage + 2 executor + report. → dùng được ngay.
- **Tầng 2**: AT-8 watcher tự sinh task từ inbox.
- **Tầng 3 (sau)**: task định kỳ tự sinh (cron), template task hay dùng, learning chọn tier từ feedback 👍/👎 (giống [[bh-d-routing-self-learning]]).

---

## 9. Cách Lucy DÙNG tool này (habit — để tự biết xài)

- Khi chủ nhân giao 1 việc lặp/research nhẹ/soạn nháp mà KHÔNG cần làm ngay → **viết task spec thả vào `/root/lucy/tasks/queue/`** thay vì tự cày tốn token Opus.
- Việc code theo MASTER-SPEC → vẫn dùng **auto-build**, KHÔNG nhầm sang auto-task.
- Mặc định `tier=auto` để triage tự quyết; chỉ ép `tier=claude` khi chắc chắn cần suy luận sâu.
- Luôn mặc định **Sonnet**, không Opus, cho Claude executor.
- Xong sprint → đọc report ở `http://14.225.255.73/reports/` + check `failed/` xem có gì kẹt.
