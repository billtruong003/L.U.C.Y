---
name: bh-d-routing-self-learning
description: BH-D routing tự học — feedback 👍/👎 đổi model auto-route; endpoints + cơ chế
metadata: 
  node_type: memory
  type: project
  originSessionId: 48605861-cb3d-439c-88e2-23e86b5a2be3
---

BH-D meta-learning ĐÃ XONG (2026-06-14): auto-route (`/route`) giờ TỰ HỌC từ outcome thật thay con đầu bảng hardcode.

Cơ chế: `routing-outcome.ts::pickLearnedModel()` override head của `ROUTE_TABLE[role]` CHỈ khi 1 candidate khác đủ `MIN_SAMPLES=4` feedback VÀ hơn head ≥`OVERRIDE_MARGIN=10`% (chống thrash khi data ít). `chat-lane.routeTask` trả thêm `learned:boolean` + ghi vết lý do vào `reason` (BH-G explainability).

Feedback lưu vault: `Brain/routing-outcomes.jsonl` (1 dòng/feedback).

Endpoints coordinator (:8780, cần x-worker-token):
- `POST /llm/feedback` `{model, rating:good|bad, taskType?, comment?, convId?}` → append + trả stats
- `GET /llm/outcomes` → `{total, stats:[{model,good,bad,score}]}`
Hub proxy: `POST /api/llm/feedback`, `GET /api/llm/outcomes` (authed).
Report: `npm run self-review` (agent-machine) gộp error-stats + outcomes ra markdown. Smoke: `npm run smoke:routing`.

CÒN: nút 👍/👎 trong Hub UI chưa có (N/Jarvis-UI, cần Bill quyết). Backend đã sẵn sàng. Liên quan [[lane-agentic-tools]].
