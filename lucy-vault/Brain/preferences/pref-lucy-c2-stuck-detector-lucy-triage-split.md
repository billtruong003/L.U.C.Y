---
title: "[Lucy trực đêm] DoD chưa đạt: tsc CHƯA sạch (2 lỗi) + smoke-triage 11/25 fail. 3"
type: preference
kind: brain-preference
id: pref-lucy-c2-stuck-detector-lucy-triage-split
topic: Lucy/c2-stuck-detector-lucy-triage-split
sign: negative
status: unconfirmed
principle: "[Lucy trực đêm] DoD chưa đạt: tsc CHƯA sạch (2 lỗi) + smoke-triage 11/25 fail. 3 bug CRITICAL chặn DoD, đã có chỗ sửa cụ thể: (1) engine.ts:699 upgrade-case phải reset card.stageVisits={} trước putCard (nếu không card quay lại waiting_human ngay tick sau); (2) engine.ts:678 split-case bỏ arg [card.id] để child không blockedBy parent → tránh deadlock vòng tròn; (3) engine.ts:685 đổi blockKind='dep' → 'delegate' để resolveUnblocks advance parent qua stage kế thay vì re-enter stage kẹt. Thiết kế/kiến trúc đã đúng hướng — chỉ cần vá 3 điểm trên rồi chạy lại smoke tới khi tsc sạch & ≥2 subtask/escalate."
scope: review
confidence: 0
band: low
applied: 0
violated: 0
evidenced_by: [sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbsjlj3, sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbspr1y, sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbtdtl7, sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbtqsoj]
created_at: 2026-06-13T05:13:23.778Z
updated_at: 2026-06-13T05:13:23.778Z
last_evidence_at: null
pinned: false
tags: [brain, preference]
permalink: pref-lucy-c2-stuck-detector-lucy-triage-split
---

# [Lucy trực đêm] DoD chưa đạt: tsc CHƯA sạch (2 lỗi) + smoke-triage 11/25 fail. 3 bug CRITICAL chặn DoD, đã có chỗ sửa cụ thể: (1) engine.ts:699 upgrade-case phải reset card.stageVisits={} trước putCard (nếu không card quay lại waiting_human ngay tick sau); (2) engine.ts:678 split-case bỏ arg [card.id] để child không blockedBy parent → tránh deadlock vòng tròn; (3) engine.ts:685 đổi blockKind='dep' → 'delegate' để resolveUnblocks advance parent qua stage kế thay vì re-enter stage kẹt. Thiết kế/kiến trúc đã đúng hướng — chỉ cần vá 3 điểm trên rồi chạy lại smoke tới khi tsc sạch & ≥2 subtask/escalate.

- [rule] [Lucy trực đêm] DoD chưa đạt: tsc CHƯA sạch (2 lỗi) + smoke-triage 11/25 fail. 3 bug CRITICAL chặn DoD, đã có chỗ sửa cụ thể: (1) engine.ts:699 upgrade-case phải reset card.stageVisits={} trước putCard (nếu không card quay lại waiting_human ngay tick sau); (2) engine.ts:678 split-case bỏ arg [card.id] để child không blockedBy parent → tránh deadlock vòng tròn; (3) engine.ts:685 đổi blockKind='dep' → 'delegate' để resolveUnblocks advance parent qua stage kế thay vì re-enter stage kẹt. Thiết kế/kiến trúc đã đúng hướng — chỉ cần vá 3 điểm trên rồi chạy lại smoke tới khi tsc sạch & ≥2 subtask/escalate. #preference #review
- trạng thái: **unconfirmed** · confidence 0 (low) · negative · applied 0/violated 0
