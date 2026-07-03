---
id: DM-1
title: Week-planner: Manager sinh week-plan (dry-run)
priority: 20
tier: claude
model: opus
scope: infra
status: queued
---

Script bridge/dev_manager.py: chủ nhật đêm, Manager (model mạnh) đọc project queue + vault goals + outcome tuần + insight → sinh week-plan 5-7 task/ngày ghi ra tasks/projects/week-*/queue. DRY-RUN: chỉ sinh + báo Telegram, chưa chạy.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
