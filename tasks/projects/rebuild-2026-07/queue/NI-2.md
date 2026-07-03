---
id: NI-2
title: Bảng signals + recordSignal + pruneSignals
priority: 31
tier: claude
model: sonnet
scope: infra
status: queued
---

agent-machine: bảng signals trong memory.db (mirror turns: ts/kind/app/sender/title/text/salience/day), recordSignal() scrub-on-write cap length, pruneSignals(days) TTL 30d.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
