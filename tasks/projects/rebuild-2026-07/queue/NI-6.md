---
id: NI-6
title: Cron distill + wire recall + card Hub + verify purge
priority: 35
tier: claude
model: opus
scope: infra
status: queued
---

Cron đêm auxComplete đúc ≤10 fact/ngày .md → Brain/claude-memory (consolidate hấp thụ). DRY-RUN trước. Card Hub theo dõi. Verify LUCY_INTAKE=off tắt sạch + purge được.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
