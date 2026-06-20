---
kind: brain-signal
id: sig-2026-06-12-lucy-autopilot-minh-bach-token-g-mqajm26u
created_at: 2026-06-12T06:25:54.582Z
topic: Lucy/autopilot-minh-bach-token-guard
signal: negative
agent: bill
principle: "KHÔNG làm lại từ đầu — chỉ vá 4 chỗ rồi chạy smoke + KẾT THÚC bằng JSON outcome (lease giờ 50p, đủ thời gian, đừng để treo): (1) engine.ts:400 submit() thêm this.tokenGuard?.addTokens(result.cost.inTok,result.cost.outTok) — thiếu dòng này counter ngày luôn=0, guard không bao giờ kích hoạt. (2) Wire actor lucy 3 lớp: engine.approve/reject/answer thêm param actor (default bill); coordinator.ts:83-85 đọc b.actor truyền xuống; autopilot-main.ts:118,125,132 POST kèm actor:lucy -> board hiện Lucy thay vì bill. (3) engine.ts:373-382 claim() chỉ downgrade khi persona có laneModel -> scope đúng executor. (4) Thêm smoke case submit->addTokens. Xong PHẢI in JSON outcome {decision:advance,...}."
scope: review
evidenced_by: [card_mqa8xuni5]
---
## Raw
Bill trả lại "Autopilot minh bạch + token-guard": KHÔNG làm lại từ đầu — chỉ vá 4 chỗ rồi chạy smoke + KẾT THÚC bằng JSON outcome (lease giờ 50p, đủ thời gian, đừng để treo): (1) engine.ts:400 submit() thêm this.tokenGuard?.addTokens(result.cost.inTok,result.cost.outTok) — thiếu dòng này counter ngày luôn=0, guard không bao giờ kích hoạt. (2) Wire actor lucy 3 lớp: engine.approve/reject/answer thêm param actor (default bill); coordinator.ts:83-85 đọc b.actor truyền xuống; autopilot-main.ts:118,125,132 POST kèm actor:lucy -> board hiện Lucy thay vì bill. (3) engine.ts:373-382 claim() chỉ downgrade khi persona có laneModel -> scope đúng executor. (4) Thêm smoke case submit->addTokens. Xong PHẢI in JSON outcome {decision:advance,...}.
