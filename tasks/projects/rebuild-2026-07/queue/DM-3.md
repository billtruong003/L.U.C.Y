---
id: DM-3
title: Audit gate: agent soi diff tìm bug
priority: 22
tier: claude
model: opus
scope: infra
status: queued
---

Sau execute: chạy agent audit (giống /code-review) trên diff worktree → verdict clean/bug + severity. Bug nặng → HOLD.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
