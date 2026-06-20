---
kind: brain-signal
id: sig-2026-06-12-lucy-bo-phan-loai-thong-ke-loi-a-mqam9d0p
created_at: 2026-06-12T07:40:00.937Z
topic: Lucy/bo-phan-loai-thong-ke-loi-agent
signal: negative
agent: engine
principle: "2 bug MEDIUM tái hiện được: (1) error-stats.ts:66-69 classifyTurn dò 'hết '/'salvage'/'không ra gì' trên motive nhưng không gate theo decision, mà lane-runner.ts:122 ghi motive=free-text agent → outcome THÀNH CÔNG (advance/done) bị đếm thành lỗi salvage/out-of-turns; fix bằng regex /^hết \\d+ turn — (salvage|không ra gì)$/. (2) error-stats.ts:28 KW_WRONG chứa 'outcome' quá phổ biến → fail thường bị nhét wrong-output thay vì other; fix bỏ 'outcome' khỏi KW_WRONG."
scope: tester
evidenced_by: [card_mqadppy6c]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 2 bug MEDIUM tái hiện được: (1) error-stats.ts:66-69 classifyTurn dò 'hết '/'salvage'/'không ra gì' trên motive nhưng không gate theo decision, mà lane-runner.ts:122 ghi motive=free-text agent → outcome THÀNH CÔNG (advance/done) bị đếm thành lỗi salvage/out-of-turns; fix bằng regex /^hết \d+ turn — (salvage|không ra gì)$/. (2) error-stats.ts:28 KW_WRONG chứa 'outcome' quá phổ biến → fail thường bị nhét wrong-output thay vì other; fix bỏ 'outcome' khỏi KW_WRONG.
