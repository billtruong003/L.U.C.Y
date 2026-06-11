# SPRINT-01 — Hoàn thiện Phase 1.5 (Lucy tự build cockpit + đa-model)

> **Cho Lucy:** đọc file này → tạo dự án **Lucy** (repoUrl `/root/lucy`) → tạo các card dưới (đúng `pipelineId`)
> → đẩy vào hàng chạy. Mỗi card đã có DoD rõ. Gate review để autopilot/Bill duyệt. KHÔNG auto-push.
> Neo: [NORTH_STAR.md](NORTH_STAR.md) Phase 1.5 · [AUTOPILOT.md](AUTOPILOT.md) (cách chạy).

## 0. Mục tiêu sprint
Đóng nốt Phase 1.5: **vào web thấy Dashboard token/cost trước**, chọn agent+model lúc giao việc, agent biết tự
load skill, và autopilot minh bạch + an toàn token. Xong sprint này = đa-model + cockpit dùng được production.

## 1. Tạo dự án
```bash
TOK=<AM_TOKEN của coordinator>
curl -s -XPOST 127.0.0.1:8780/project -H "x-worker-token: $TOK" -H 'content-type: application/json' \
  -d '{"name":"Lucy","repoUrl":"/root/lucy","branch":"main"}'   # → projectId (vd "lucy")
```

## 2. Card (6) — pipeline + DoD

| # | Card | pipeline | agent chính | DoD (done khi) |
|---|---|---|---|---|
| C1 | Cost ledger + `/metrics` | `feature` | Kurisu→Tanjiro→Shinobu→Giyu→Rengoku | engine ghi cost theo ngày·model·agent; coordinator có `GET /metrics`; smoke ra số thật |
| C2 | Dashboard landing (web) | `ui` | Mitsuri→Tanjiro→Rengoku | web mở mặc định = tab Dashboard, đọc `/metrics`+providerStatus; vite build sạch |
| C3 | Pick-agent + model ở Board | `feature` | Kurisu→Tanjiro→Shinobu→Giyu→Rengoku | giao card chọn được persona(14)+model; card chạy đúng lựa chọn |
| C4 | Skill-loader M3 | `feature` | Kurisu→Tanjiro→Shinobu→Giyu→Rengoku | loader match task→chèn SKILL.md vào prompt (cap token); smoke chứng minh |
| C5 | Provider health trong Settings | `ui` | Mitsuri→Tanjiro→Rengoku | Settings hiện provider sống/chết live + catalog theo role + chọn executor |
| C6 | Autopilot minh bạch + token-guard | `feature` | Kurisu→Tanjiro→Shinobu→Giyu→Rengoku | board nhãn "🌙 autopilot duyệt"+lý do; token ngày gần ngưỡng→tự hạ model/cảnh báo |

> `feature` chạy review 2-bước (Giyu spec → Rengoku quality, gate). `ui` = Mitsuri thiết kế → Tanjiro code → Rengoku duyệt.
> Executor (Tanjiro) chạy **DeepSeek V4 free**; architect/reviewer = **opus**.

## 3. Brief từng card (DoD đầy đủ)

### C1 — Cost ledger + `/metrics` *(nền cho Dashboard)*
Gom `card.cost` (đã có: usd/inTok/outTok) thành ledger theo **ngày · model · agent · project**. Thêm `GET /metrics`
ở coordinator trả: `{tokenByDay[], costByModel[], costByAgent[], cardThroughput, vault:{notes,prefs,inboxPending}}`.
Nguồn: `store.listCards()` + history. **DoD:** `/metrics` trả số THẬT; 1 smoke test (`smoke:metrics`) dựng vài card → kiểm số khớp; tsc sạch. KHÔNG đụng engine loop.

### C2 — Dashboard landing (web)
Tab **Dashboard** thành **trang mở mặc định** (thay vì vào thẳng dự án). Hiển thị từ `/metrics` + `providerStatus()`:
token in/out **theo ngày → cuộn tháng**, cost **/model · /agent**, **model sống/chết** (xanh/đỏ), card đang chạy,
cảnh báo token. Giữ dark-premium (`#05070e`+cyan, NORTH_STAR §4). **DoD:** mở web = Dashboard; số liệu thật;
`cd hub/web && npx vite build` sạch; responsive cơ bản.

### C3 — Pick-agent + model ở Board
Khi tạo/giao card: dropdown chọn **persona** (14 con, hiện avatar+realm) + **model override** (opus/sonnet, hoặc dùng
`laneModel` của persona). Truyền vào `/card` (đã có field `model`) + cho phép chỉ định personaId stage đầu. **DoD:**
chọn "builder=Tanjiro chạy DeepSeek" → card chạy đúng; UI rõ; smoke/manual chứng minh.

### C4 — Skill-loader M3 (progressive disclosure)
Loader đọc `skills/INDEX.md` (name+description) → match keyword của task → **chèn full SKILL.md đúng cái** vào system
prompt agent (cap ~6k token, top-1..2). Wire vào `runner.ts`/`lane-runner.ts` (prepend như active.md). **DoD:** smoke:
card "viết test cho X" → loader nạp `test-driven-development` SKILL vào prompt (in ra để chứng minh); không match → không nạp (giữ token).

### C5 — Provider health trong Settings
Mở rộng tab Settings (đã có khối lát API): hiện `providerStatus()` **sống/chết real-time** + `MODEL_CATALOG` nhóm theo
role (đã có CLI `npm run providers` — đưa lên UI) + chọn executor model mặc định. **DoD:** Settings hiện trạng provider
+ catalog; chọn model lưu lại; vite build sạch.

### C6 — Autopilot minh bạch + token-guard *(đụng cost → có Gyomei review)*
(a) Board/channel **nhãn rõ** ai duyệt: "🌙 Lucy trực đêm" vs Bill, kèm lý do. (b) **Token-guard:** khi tổng token ngày
vượt ngưỡng (env `AM_DAY_TOKEN_SOFT`) → autopilot **tự hạ executor xuống model rẻ nhất + cảnh báo Telegram**, vượt hard
→ tạm dừng nhận card mới. **DoD:** nhãn hiện đúng; guard kích hoạt được (smoke giả lập vượt ngưỡng); review của Gyomei (gate) — Bill duyệt vì đụng tự-động + tiền.

## 4. Cách chạy (sau khi tạo card)
```bash
# bật worker composite + autopilot (xem AUTOPILOT.md §4), rồi:
AM_TOKEN=$TOK AM_AUTOPILOT_MAX=15 pm2 start npm --name lucy-autopilot -- run autopilot
# theo dõi: Hub board + pm2 logs lucy-autopilot ; diff: ~/lucy/agent-machine/.worker/repos/lucy
```
**Thứ tự khuyến nghị:** C1 → C2 (cần C1) → C5 → C3 → C4 → C6. Đêm đầu chạy **C1+C5** (nhẹ, an toàn) xem 1-2 card trôi qua gate rồi mới thả phần còn lại.

## 5. JSON sẵn (đẩy nhanh nếu không qua Lucy)
```json
[
 {"pipelineId":"feature","title":"Cost ledger + /metrics","brief":"Gom card.cost thành ledger theo ngày·model·agent·project. Thêm GET /metrics ở coordinator trả tokenByDay/costByModel/costByAgent/cardThroughput/vault. Nguồn store.listCards()+history. DoD: /metrics ra số thật + smoke:metrics + tsc sạch. KHÔNG đụng engine loop."},
 {"pipelineId":"ui","title":"Dashboard landing","brief":"Tab Dashboard thành trang mở mặc định. Hiển thị /metrics + providerStatus: token ngày→tháng, cost/model·/agent, model sống/chết, card chạy, cảnh báo token. Dark-premium #05070e+cyan. DoD: mở web=Dashboard, số thật, vite build sạch."},
 {"pipelineId":"feature","title":"Pick-agent + model ở Board","brief":"Giao card chọn persona(14)+model override (opus/sonnet/laneModel). Truyền /card field model + personaId stage đầu. DoD: chọn builder=Tanjiro DeepSeek → card chạy đúng; smoke/manual."},
 {"pipelineId":"feature","title":"Skill-loader M3","brief":"Loader đọc skills/INDEX, match keyword task → chèn full SKILL.md đúng cái vào system prompt (cap 6k token, top-1..2), prepend như active.md trong runner+lane-runner. DoD: smoke card 'viết test' → nạp test-driven-development SKILL (in chứng minh); không match thì không nạp."},
 {"pipelineId":"ui","title":"Provider health trong Settings","brief":"Settings hiện providerStatus() sống/chết real-time + MODEL_CATALOG theo role (như npm run providers) + chọn executor mặc định. DoD: hiện trạng+catalog, lưu lựa chọn, vite build sạch."},
 {"pipelineId":"feature","title":"Autopilot minh bạch + token-guard","brief":"(a) Board/channel nhãn rõ '🌙 Lucy trực đêm' vs Bill + lý do. (b) token-guard: token ngày vượt AM_DAY_TOKEN_SOFT → autopilot hạ executor xuống model rẻ nhất + cảnh báo Telegram; vượt hard → tạm dừng nhận card. DoD: nhãn đúng + guard kích hoạt (smoke giả lập) + Gyomei review (gate, Bill duyệt)."}
]
```
