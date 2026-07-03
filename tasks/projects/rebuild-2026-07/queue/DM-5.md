---
id: DM-5
title: Host gate + morning report
priority: 24
tier: claude
model: opus
scope: infra
status: queued
---

Gate: audit clean ∧ verify pass ∧ scope∈allowlist(ui/reports) → merge branch + host; risky → PR/hold. Morning report HTML+Telegram: chạy gì/audit/verify/hosted/held/token/next.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
