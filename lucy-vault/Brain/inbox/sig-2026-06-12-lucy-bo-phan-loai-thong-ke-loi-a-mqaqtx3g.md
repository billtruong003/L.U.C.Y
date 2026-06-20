---
kind: brain-signal
id: sig-2026-06-12-lucy-bo-phan-loai-thong-ke-loi-a-mqaqtx3g
created_at: 2026-06-12T09:47:58.540Z
topic: Lucy/bo-phan-loai-thong-ke-loi-agent
signal: negative
agent: engine
principle: "Cột byModel sai: TurnRecord thiếu field 'model' (turn-log.ts:12) nên error-stats.ts:135 suy lại từ config → khi TokenGuard SOFT hạ cấp (engine.ts:383, laneModel→ds-v4-flash-free) thì lỗi bị gom nhầm về config laneModel (devstral-med); fix: ghi model thực vào record ở lane-runner.ts:122/136 và đọc t.model thay vì suy từ persona. Phụ: (B) ?? vs || đẻ nhãn model rỗng, (C) log thiếu decision bị đếm thành công. Repro: src/smoke-error-stats-model.ts 4/4 fail."
scope: tester
evidenced_by: [card_mqadppy6c]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: Cột byModel sai: TurnRecord thiếu field 'model' (turn-log.ts:12) nên error-stats.ts:135 suy lại từ config → khi TokenGuard SOFT hạ cấp (engine.ts:383, laneModel→ds-v4-flash-free) thì lỗi bị gom nhầm về config laneModel (devstral-med); fix: ghi model thực vào record ở lane-runner.ts:122/136 và đọc t.model thay vì suy từ persona. Phụ: (B) ?? vs || đẻ nhãn model rỗng, (C) log thiếu decision bị đếm thành công. Repro: src/smoke-error-stats-model.ts 4/4 fail.
