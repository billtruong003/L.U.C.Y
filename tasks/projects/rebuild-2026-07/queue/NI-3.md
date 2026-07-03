---
id: NI-3
title: redactPersonal typed PII + kill OTP (TRƯỚC endpoint)
priority: 32
tier: claude
model: opus
scope: infra
status: queued
---

Mở rộng redact.ts: redactPersonal() phone/email/(name) → [PHONE]/[EMAIL]/[PERSON], kill OTP digit. Unit test (mirror smoke-redact). LÀM TRƯỚC khi mở endpoint.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
