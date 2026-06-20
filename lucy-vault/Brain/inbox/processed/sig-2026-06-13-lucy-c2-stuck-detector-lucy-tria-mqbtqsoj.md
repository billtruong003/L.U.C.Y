---
kind: brain-signal
id: sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbtqsoj
created_at: 2026-06-13T03:57:17.875Z
topic: Lucy/c2-stuck-detector-lucy-triage-split
signal: negative
agent: bill
principle: "[Lucy trực đêm] DoD chưa đạt: tsc CHƯA sạch (2 lỗi) + smoke-triage 11/25 fail. 3 bug CRITICAL chặn DoD, đã có chỗ sửa cụ thể: (1) engine.ts:699 upgrade-case phải reset card.stageVisits={} trước putCard (nếu không card quay lại waiting_human ngay tick sau); (2) engine.ts:678 split-case bỏ arg [card.id] để child không blockedBy parent → tránh deadlock vòng tròn; (3) engine.ts:685 đổi blockKind='dep' → 'delegate' để resolveUnblocks advance parent qua stage kế thay vì re-enter stage kẹt. Thiết kế/kiến trúc đã đúng hướng — chỉ cần vá 3 điểm trên rồi chạy lại smoke tới khi tsc sạch & ≥2 subtask/escalate."
scope: review
evidenced_by: [card_mqb4cx8q2]
---
## Raw
Bill trả lại "C2 Stuck-detector → Lucy triage/split": [Lucy trực đêm] DoD chưa đạt: tsc CHƯA sạch (2 lỗi) + smoke-triage 11/25 fail. 3 bug CRITICAL chặn DoD, đã có chỗ sửa cụ thể: (1) engine.ts:699 upgrade-case phải reset card.stageVisits={} trước putCard (nếu không card quay lại waiting_human ngay tick sau); (2) engine.ts:678 split-case bỏ arg [card.id] để child không blockedBy parent → tránh deadlock vòng tròn; (3) engine.ts:685 đổi blockKind='dep' → 'delegate' để resolveUnblocks advance parent qua stage kế thay vì re-enter stage kẹt. Thiết kế/kiến trúc đã đúng hướng — chỉ cần vá 3 điểm trên rồi chạy lại smoke tới khi tsc sạch & ≥2 subtask/escalate.
