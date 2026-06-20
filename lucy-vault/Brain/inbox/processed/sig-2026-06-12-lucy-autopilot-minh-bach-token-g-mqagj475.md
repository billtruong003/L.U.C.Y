---
kind: brain-signal
id: sig-2026-06-12-lucy-autopilot-minh-bach-token-g-mqagj475
created_at: 2026-06-12T04:59:38.369Z
topic: Lucy/autopilot-minh-bach-token-guard
signal: negative
agent: bill
principle: "Spec-review (Giyu) tìm 2 gap CRITICAL THẬT, phải fix trước khi duyệt — KHÔNG làm lại từ đầu, chỉ vá đúng 4 chỗ rồi chạy smoke + KẾT THÚC bằng JSON outcome (đừng để hết turn): (1) engine.ts:400 submit() THIẾU this.tokenGuard?.addTokens(result.cost.inTok,result.cost.outTok) → counter ngày luôn=0 → guard KHÔNG BAO GIỜ kích hoạt = feature chết. (2) actor lucy chưa wire 3 lớp: engine.approve/reject/answer thêm param actor (default bill); coordinator.ts:83-85 đọc b.actor truyền xuống; autopilot-main.ts:118,125,132 POST kèm actor:lucy → board hiện đúng Lucy trực đêm thay vì bill (đây là YÊU CẦU minh bạch của chính card này). (3)[MEDIUM] engine.ts:373-382 claim() chỉ downgrade khi persona.kind===executor||persona.laneModel. (4)[MEDIUM] smoke end-to-end: drainLocal cho submit() cộng token → assert chạm soft engine.thrift===true. Builder giờ là sonnet, không còn lý do hết turn."
scope: review
evidenced_by: [card_mqa8xuni5]
---
## Raw
Bill trả lại "Autopilot minh bạch + token-guard": Spec-review (Giyu) tìm 2 gap CRITICAL THẬT, phải fix trước khi duyệt — KHÔNG làm lại từ đầu, chỉ vá đúng 4 chỗ rồi chạy smoke + KẾT THÚC bằng JSON outcome (đừng để hết turn): (1) engine.ts:400 submit() THIẾU this.tokenGuard?.addTokens(result.cost.inTok,result.cost.outTok) → counter ngày luôn=0 → guard KHÔNG BAO GIỜ kích hoạt = feature chết. (2) actor lucy chưa wire 3 lớp: engine.approve/reject/answer thêm param actor (default bill); coordinator.ts:83-85 đọc b.actor truyền xuống; autopilot-main.ts:118,125,132 POST kèm actor:lucy → board hiện đúng Lucy trực đêm thay vì bill (đây là YÊU CẦU minh bạch của chính card này). (3)[MEDIUM] engine.ts:373-382 claim() chỉ downgrade khi persona.kind===executor||persona.laneModel. (4)[MEDIUM] smoke end-to-end: drainLocal cho submit() cộng token → assert chạm soft engine.thrift===true. Builder giờ là sonnet, không còn lý do hết turn.
