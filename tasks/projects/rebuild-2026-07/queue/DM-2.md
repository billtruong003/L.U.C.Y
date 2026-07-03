---
id: DM-2
title: Nightly runner: chọn task đêm → branch/worktree → execute
priority: 21
tier: claude
model: opus
scope: infra
status: queued
---

dev_manager.py nightly mode: lấy task priority cao nhất đêm nay, tạo git worktree riêng, gọi auto-build harness execute 1 task, ghi trạng thái. Cap token/đêm. Chưa host.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
