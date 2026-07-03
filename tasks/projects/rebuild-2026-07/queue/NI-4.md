---
id: NI-4
title: POST /intake flag+token riêng + nginx + rate-limit
priority: 33
tier: claude
model: opus
scope: infra
status: queued
---

coordinator /intake behind LUCY_INTAKE + LUCY_INTAKE_TOKEN (KHÔNG worker-token, check trước), body validate, try/catch. nginx location /lucy-intake rate-limit. Coordinator vẫn 127.0.0.1.
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
