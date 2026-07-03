---
id: DM-4
title: Verify gate: build+smoke+screenshot+drive → pass/fail
priority: 23
tier: claude
model: opus
scope: infra
status: queued
---

Verify hành vi: build, smoke liên quan, screenshot (UI) đọc lại, drive flow. Fail → auto-retry 1 lần (fix) rồi HOLD.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
