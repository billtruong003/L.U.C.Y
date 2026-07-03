---
id: NI-5
title: Lọc nhiễu + salience + contact graph SQL → learning bus
priority: 34
tier: claude
model: sonnet
scope: infra
status: queued
---

Deterministic filter (regex OTP/promo/system) + salience score + contact-frequency rollup SQL (0 LLM). Đẩy residue vào signal bus (DM-6).
**RÀNG BUỘC:** flag-gated default OFF, DRY-RUN trước, KHÔNG tự host, KHÔNG đụng core sống. Acceptance: smoke pass, dry-run log đúng, báo cáo rõ.
