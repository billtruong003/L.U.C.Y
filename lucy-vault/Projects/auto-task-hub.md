---
title: Auto-Task Hub — quản lý theo DỰ ÁN + research-backed sprint
status: proposal
created: 2026-06-17
owner: Bill
agent: lucy
tags: [automation, auto-task, hub, per-project, research]
parent: auto-task-engine
---

# Auto-Task Hub — `lucy-autotask` tầng 2

> Nâng [[auto-task-engine]] từ "1 hàng đợi chung" → **quản lý theo DỰ ÁN**, mỗi sprint
> mở đầu bằng **research lại bối cảnh** (vừa làm đúng, vừa đẻ data để chủ nhân check),
> và một **Hub tab xem được** để quản lý khi cần nhìn.
> Bill chốt 2026-06-17: research **nhẹ** mặc định · Hub **read-only** trước.

---

## 1. Vấn đề & mục tiêu

Auto-Task Engine (AT-1→AT-8) đã chạy: queue chung → triage → lane/Claude → report.
Nhưng khi nhiều việc thuộc **nhiều dự án khác nhau**, hàng đợi phẳng khó:
- không biết việc nào của dự án nào, tiến độ từng dự án ra sao;
- không có "trí nhớ bối cảnh" mỗi lần cày → dễ lạc;
- chủ nhân muốn **xem/quản lý** được, có **data để check**.

Mục tiêu:
1. **Per-project**: mỗi dự án 1 không gian riêng (mục tiêu + queue + lịch sử sprint + cost).
2. **Research-backed sprint**: mỗi sprint bắt đầu bằng pha research → ghi file = data check + ngữ cảnh cho sprint.
3. **Hub xem được**: tab "Auto-Task" liệt kê dự án → research, task, sprint, chi phí. (read-only trước, điều khiển sau).
4. Giữ triết lý cũ: **lane rẻ lo research + việc dễ, Sonnet lo việc khó**; engine độc lập, không đụng coordinator.

---

## 2. Mô hình DỰ ÁN (filesystem, mở rộng từ queue cũ)

```
/root/lucy/tasks/
  queue/ doing/ done/ failed/        # (cũ) hàng đợi "general", vẫn chạy
  projects/
    <slug>/
      project.md                     # mục tiêu + bối cảnh + cấu hình
      queue/ doing/ done/ failed/     # task RIÊNG của dự án
      research/<YYYY-MM-DD>.md         # output research mỗi sprint (DATA để check)
      sprints/<n>.md                   # log từng sprint (task làm, kết quả, cost)
      state.json                       # {sprint_count, last_run, total_usd, totals}
```

**`project.md`** frontmatter:
```markdown
---
slug: shader-kit
title: Stylized Shader Kit
goal: Hoàn thiện + tài liệu hoá shader kit
research_depth: light      # light (mặc định) | deep
status: active             # active | paused | done
created: 2026-06-17
---
## Bối cảnh
<mô tả dự án, link repo/spec, ràng buộc>
## Định hướng sprint
<những việc lớn cần xử theo thứ tự>
```

Tương thích ngược: queue cũ = dự án ngầm `general`. Không vỡ gì.

---

## 3. Sprint per-project (3 pha)

`run_project_sprint(slug)`:

1. **RESEARCH** (`run_research(project)`):
   - `light` (mặc định): lane model đọc `project.md` + `state.json` + sprint gần nhất + web nhẹ → ghi `research/<date>.md` (tóm tắt bối cảnh + việc nên ưu tiên + tín hiệu mới). Rẻ.
   - `deep`: fan-out nhiều nguồn kiểu deep-research → report dài có cite (chỉ dự án khai `research_depth: deep`).
   - File research = **data chủ nhân liếc** + bake vào prompt execute để sprint bám ngữ cảnh.

2. **EXECUTE**: nhặt task `projects/<slug>/queue/` (priority) → triage → lane/Claude executor (TÁI DÙNG `triage()/run_lane()/run_claude()` đã có) → move `done/|failed/`. Bao nhiêu task/sprint = `AUTOTASK_MAX_ITERS`.

3. **REPORT**: ghi `sprints/<n>.md` (task đã làm + tóm tắt + cost) + cập nhật `state.json` + Telegram 3-5 dòng + cập nhật HTML hub.

Cost: engine TỰ cộng usd mỗi sprint vào `state.json` (KHÔNG đụng ledger coordinator — giữ độc lập), token vẫn report `/spend` source='autotask' như cũ.

---

## 4. Hub tab "Auto-Task" (read-only trước)

- **API** đặt trong **hub server** (`/root/lucy/hub/server`, KHÔNG đụng coordinator env-nhạy-cảm): đọc filesystem `tasks/projects/` → JSON.
  - `GET /api/autotask/projects` → list `{slug,title,status,sprint_count,queued,done,failed,total_usd,last_run,latest_research_date}`.
  - `GET /api/autotask/projects/:slug` → detail `{project, research:[{date,excerpt}], tasks:{queue,done,failed}, sprints:[{n,date,summary,usd}]}`.
- **Web** (`/root/lucy/hub/web`, React, tái dùng class theme T1 `.glass/.num` + lime/gold): tab "Auto-Task" =
  - lưới **project card** (title · status · tiến độ done/queue · cost · sprint cuối);
  - click → **detail**: research history (mở xem md), task list (done/queue/failed), sprint log, cost theo thời gian.
- Build bằng `bash /root/lucy/hub/deploy.sh` (KHÔNG vite trần) → restart **lucy-hub** (KHÔNG đụng lucy-bridge/coordinator).

---

## 5. An toàn & ràng buộc (giữ như AT)

- Engine độc lập: chỉ GỌI `/chat-lane-agentic` + `/spend` qua HTTP; API mới nằm ở **hub server** (đọc filesystem), KHÔNG sửa coordinator.
- DANGER guard cũ giữ nguyên. KHÔNG `git push`. KHÔNG restart bridge/coordinator. Restart lucy-hub OK (sau build).
- Secret: research/report KHÔNG echo secret.
- Tương thích ngược: queue `general` cũ vẫn chạy.

---

## 6. Build plan — AUTO-BUILD cày bằng SONNET (block AT-HUB)

> Mỗi task auto-able, có tiêu chí DONE rõ. Engine = sửa `/root/lucy/auto-task.py` + thêm API/tab hub.

- [x] **ATH-1** Project model + loader: cấu trúc `tasks/projects/<slug>/` + `project.md` schema + `load_projects()` trong auto-task.py (đọc nhiều project, queue riêng); queue cũ → dự án `general`. CLI `--project <slug>` + `--list-projects`. DONE = tạo 1 project mẫu, `--list-projects` in ra đúng.
- [x] **ATH-2** Research phase `run_research(project)`: DONE (2026-06-17 autobuild)
- [x] **ATH-3** Per-project sprint `run_project_sprint(slug)`: DONE (2026-06-17 autobuild)
- [x] **ATH-4** Hub API read-only: DONE (2026-06-17 autobuild)
- [x] **ATH-5** Hub tab "Auto-Task" web: DONE (2026-06-17 autobuild)
- [x] **ATH-6** HTML report per-project + index: DONE (2026-06-17 autobuild)

---

## 7. Lộ trình
- **Tầng A (giờ)**: ATH-1→ATH-6 = per-project + research nhẹ + hub read-only + report.
- **Tầng B (sau)**: nút điều khiển trên hub (thêm task / chạy sprint / dừng), research deep cho dự án chọn, lịch cron tự chạy sprint mỗi dự án theo token-window.

## 8. Habit (cập nhật khi chạy)
- Việc thuộc 1 dự án cụ thể → tạo/để project trong `tasks/projects/<slug>/`, thả task vào queue riêng; xem tiến độ ở Hub tab Auto-Task.
- Research mỗi sprint = nguồn data check; chủ nhân muốn nhìn → mở tab hoặc `/reports/autotask/`.
