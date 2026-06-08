# W2 — UI/UX + Observability pass

> Trạng thái: **PLAN — chờ Bill duyệt rồi code** (2026-06-08). Owner: hub + agent-machine.
> Nguồn: [multiagent-ux-review.md](multiagent-ux-review.md) (UX-E) + phản hồi Bill 2026-06-08 (board khó dùng,
> log đọc không được, agent nghĩ gì không hiện, agent ít nói chuyện, **tab Tasks viết không cách dòng**).
> Làm **full 1 đợt**, smoke test mỗi nhóm, screenshot Bill duyệt. KHÔNG đụng: remote/desktop stream (defer),
> Lucy Operator tools (Lát sau), edit/retry card (Lát sau).

## Vì sao (đã verify code)
- Màu mè + contrast dưới chuẩn — review TC3.
- `engine.submit` chỉ lưu **`outcome.summary` 1 dòng**, **vứt output đầy đủ** của agent (`runner` trả `raw` có `result` nhưng không lưu) → [engine.ts:352-355](../../agent-machine/src/engine.ts#L352). ⇒ "log đọc không được, agent nghĩ gì không hiện".
- Channel mỗi stage chỉ 1 dòng status ⇒ "agent ít nói chuyện".
- Tab Tasks: mỗi job 1 dòng `truncate`, không hiện result → [Tasks.tsx:34](../../hub/web/src/components/Tasks.tsx#L34). ⇒ "viết không cách dòng khó nhìn".

> ⚠️ Phân biệt: "agent nghĩ gì **real-time từng bước**" = phải stream (remote control → **defer**).
> W2 chỉ surface **output cuối + report** của agent (data đã có, chỉ là đang bị vứt).

## Nhóm A — Calm UI (de-glow + contrast + type-scale)
- **A1** Ngân sách màu = ý nghĩa: chrome (border/chip/nav inactive) → **xám trung tính**; cyan/glow **chỉ** cho live/active; pink chỉ cần-bạn; green chỉ done. Bỏ 2 radial-glow body + glow trang trí tĩnh (brand textShadow, btn-primary glow, dot glow). Files: [index.css](../../hub/web/src/index.css), [tailwind.config.js](../../hub/web/tailwind.config.js).
- **A2** Contrast WCAG: nâng `inkfaint #5e748b` (hoặc giới hạn chỗ dùng) đạt ≥4.5:1 trên bg; nâng alpha viền card/cột để Kanban tách rõ.
- **A3** Type-scale: gom ~11 cỡ chữ → 4–5 bậc, sàn 11–12px cho chữ phải đọc; giảm tracking ở label nhỏ.

## Nhóm B — Board dễ dùng
- **B1** Kanban quét được: tách cột rõ, mật độ card hợp lý, thêm **stepper tiến độ pipeline** trên card (setup→build→test→review, đang ở đâu) thay vì chữ "stage: build". Giảm nhiễu thị giác.
- **B2** Default pipeline hợp lý (không cứng `course` cho mọi card) → [Board.tsx:28](../../hub/web/src/components/Board.tsx#L28).

## Nhóm C — Observability (đọc được agent + agent nói nhiều hơn)
- **C1 (engine)** Lưu + post **output đầy đủ** mỗi stage như **comment kiểu Jira**: `engine.submit` lưu `result` text (cap ~12KB) vào card theo stage **và** post 1 message `kind:'report'` (narrative đầy đủ "agent đã làm như nào") vào thread card → drawer đọc được + channel sống + đặt nền cho comment-thread cộng tác sau (W3). Files: [engine.ts](../../agent-machine/src/engine.ts), [types.ts](../../agent-machine/src/types.ts), [runner.ts](../../agent-machine/src/runner.ts) (nới OUTCOME_CONTRACT cho phép `report` dài, tách khỏi `summary` 1 câu).
- **C2 (web)** Drawer Board: hiện report đầy đủ mỗi stage, **render readable** (Markdown + xuống dòng), expandable. Channels render message `report` nhiều dòng.
- **C3 (web)** Tab Tasks: row **mở rộng được** → hiện full prompt + result (Markdown/whitespace, có cách dòng), không chỉ 1 dòng truncate. Files: [Tasks.tsx](../../hub/web/src/components/Tasks.tsx).

## Smoke / Acceptance
- `vite build` ✓ · server tsc ✓ · agent-machine `npm run smoke` ✓ (+ assert mới: card lưu được full output sau submit).
- Visual (Bill duyệt screenshot): board bớt chói + dễ quét · drawer đọc được agent làm gì đầy đủ · Tasks tab xuống dòng đọc được · channels có report nhiều dòng.
- adversarial-ux-test (vai engineer cau có) pass — không còn RED về "đọc không được / chói / cụt dòng".

## Roadmap sau W2 (gồm 5 ý Bill thêm 2026-06-08 — xếp thành Lát riêng, KHÔNG nhồi vào W2)
W2 là **nền observability** mà mọi cái dưới đều cần (board phải đọc được trước đã).

- **W3 — Lucy/Agent Operator (cộng tác AI)**: lớp **tool** để Lucy VÀ agent *chủ động* hành động trên card — create/edit/assign/**comment**/approve qua coordinator. Gồm:
  - Lucy chủ động sửa card (ý #3) · agent chủ động edit + comment "đã làm như nào" vào thread (ý #4, dựng trên report-thread của W2.C).
  - **Auditor** (ý #5): persona/pipeline `audit-source` đọc code → comment **hướng implement đúng** vào card (chủ yếu config-là-data + cơ chế comment của W2/W3).
- **W4 — Board v2 Jira-like + GitHub** (ý #1, #2): custom field/cột/label/priority/assignee (config-là-data) + edit card UI · link/assign card ↔ **GitHub** issue/PR + sync trạng thái.
- **W5 — Worker Fleet**: IP-named worker, gán card→máy, chưa gán→VPS cap, onboarding lệnh đơn giản (app native sau).
- *(defer: remote/desktop/stream — app native, không webRTC)*

> Thứ tự lý do: **W2 đọc được** → **W3 AI hành động/comment được** (cần tool layer) → **W4 Jira-customize + GitHub** (cần card-edit + field) → **W5 Worker Fleet**. GitHub có thể kéo sớm nếu Bill cần gấp.
