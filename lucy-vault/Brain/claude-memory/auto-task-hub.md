---
name: auto-task-hub
description: ATH-1→ATH-6 per-project + research-backed sprint + hub tab; trạng thái build
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c090b6e-15f2-4ce5-b80d-7fa7f2f494e6
---

AT-HUB = nâng lucy-autotask (AT-1→AT-8) từ 1 queue phẳng → **per-project**.
Code: `/root/lucy/auto-task.py` (sửa thêm), API Hub server, tab web Hub.
Spec: `/root/lucy/lucy-vault/Projects/auto-task-hub.md`.

**Cấu trúc filesystem:**
```
/root/lucy/tasks/
  queue/ doing/ done/ failed/   # general (cũ, vẫn chạy)
  projects/
    <slug>/
      project.md               # slug/title/goal/research_depth/status/created
      queue/ doing/ done/ failed/
      research/<YYYY-MM-DD>.md
      sprints/<n>.md
      state.json               # {sprint_count, last_run, total_usd}
```

**Hàm đã có trong auto-task.py (ATH-1→ATH-6 ALL DONE):**
- `load_projects()`, `load_project_queue(slug)`, `move_project_task(task, subdir)`
- `_save_project_state(slug, state)`, `_load_project_state(slug)`
- `run_research(project)` — light/deep lane model → research/<date>.md
- `run_project_sprint(slug)` — 3 pha: research + execute + report (sprints/<n>.md + state.json + Telegram + HTML)
- `generate_project_html_report(slug)` → `/var/www/lucy-reports/autotask/<slug>.html`
- `generate_autotask_index()` → `/var/www/lucy-reports/autotask/index.html`
- CLI `--project <slug>`, `--list-projects`, `--research-test <slug>`
- Hub API: `GET /api/autotask/projects` + `GET /api/autotask/projects/:slug`
- Hub tab: `AutoTask.tsx` (📦 group=Việc)

**Tiến độ:**
- ✅ ATH-1→ATH-6 tất cả DONE (2026-06-17 autobuild)

**Why/How:** không restart bridge/coordinator; restart lucy-hub OK sau deploy.sh.
CLI thêm task: tạo .md trong `tasks/projects/<slug>/queue/`, chạy `python3 auto-task.py --project <slug>`.
