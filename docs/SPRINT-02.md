# SPRINT-02 — Phase 1.6: Lõi điều phối thông minh

> **Cho Lucy:** đọc file này + [PHASE-1.6-CORE.md](PHASE-1.6-CORE.md) → tạo card dưới vào dự án **Lucy** (repoUrl `/root/lucy`)
> đúng `pipelineId` → đẩy vào hàng chạy. Mỗi card có DoD rõ. Gate review để autopilot/Bill duyệt. **KHÔNG auto-push.**
> Neo: [NORTH_STAR.md](NORTH_STAR.md) Phase 1.6 · [AUTOPILOT.md](AUTOPILOT.md) (cách chạy).

## 0. Mục tiêu sprint
Đắp **lõi trí phán đoán** giữa pipeline: bắt task kẹt, chặn task to, phân loại lỗi đúng, và cho mỗi agent
một cái não học dần. Xong sprint = đội agent đỡ đốt token, tự xử nhiều hơn, giỏi lên theo thời gian.

## 1. Tạo dự án (nếu chưa có)
```bash
TOK=<AM_TOKEN của coordinator>
curl -s -XPOST 127.0.0.1:8780/project -H "x-worker-token: $TOK" -H 'content-type: application/json' \
  -d '{"name":"Lucy","repoUrl":"/root/lucy","branch":"main"}'   # → projectId (vd "lucy")
```

## 2. Card (5) — pipeline + DoD

| # | Card | pipeline | DoD (done khi) |
|---|---|---|---|
| C0 | Nền: wire turn-log + error-stats sống | `feature` | runner/lane-runner ghi `turn-log.jsonl` khi `AM_TURNS_LOG` set; `/error-stats` trả số thật sau 1 lane chạy; smoke chứng minh |
| C1 | Rate-limit → park + báo Telegram | `feature` | lane-runner/runner phân loại 429/quota = `rate-limit` (KHÁC fail); card → `parked` + retry-after; bắn ĐÚNG 1 tin Telegram (soạn bằng ds-v4-flash-free) qua notify.ts; smoke giả lập 429 |
| C2 | Stuck-detector → Lucy triage/split | `feature` | card chạm ngưỡng rework/visit → gọi triage opus đọc history+reports → split thành card con `blockedBy` HOẶC nâng model HOẶC escalate; smoke giả lập card kẹt → ra ≥2 subtask |
| C3 | Task-size gate: decompose-first | `feature` | stage spec (architect opus) ước lượng task to → bắt ra danh sách subtask atomic trước executor; gate chặn executor nhận khối to; smoke chứng minh task to bị chặn |
| C4 | Não riêng từng agent | `feature` | sau card xong rút 1–2 bài học theo persona → ghi `Brain/agents/<personaId>.md`; lần sau persona chạy tự nạp (prepend như active.md); dream-per-persona; smoke: persona X có brain riêng được nạp |

> Pipeline `feature` = Kurisu(architect)→Tanjiro(builder)→Shinobu(test)→Giyu(spec-review)→Rengoku(quality-gate).
> Executor (Tanjiro) chạy **DeepSeek V4 free** (laneModel); architect/reviewer = **opus**.
> **Thứ tự:** C0 (nền — cần trước) → C1 (nhẹ, cứu token) → C2 (lõi) → C3 → C4 (nặng nhất).

## 3. Brief từng card (DoD đầy đủ)

### C0 — Nền: wire turn-log + error-stats sống
`turn-log.ts` đã có (opt-in `AM_TURNS_LOG`). Wire vào `runner.ts` + `lane-runner.ts`: mỗi turn ghi 1 dòng JSONL
(agent, task, stage, model, motive, outcome). `error-stats.ts` + `/error-stats` đã có (đọc turn-log.jsonl).
**DoD:** set `AM_TURNS_LOG` → chạy 1 lane card → `turn-log.jsonl` có dòng; `/error-stats` trả `total>0` phân loại đúng; smoke pass; tsc sạch.

### C1 — Rate-limit → park + báo Telegram
`llm-lane.ts callLLMRaw` đã có FALLBACKS provider. Khi tất cả fallback dính 429/quota → phân loại lỗi `rate-limit`
(KHÁC `fail`). Engine: card sang status `parked` + `retryAfter` (không retry ngay, không đốt thêm). `notify.ts` đã có
khung Telegram → soạn tin ngắn bằng `ds-v4-flash-free`, gửi ĐÚNG 1 lần/đợt (chống spam). **DoD:** smoke giả lập 429 →
card `parked` + 0 retry vô ích + 1 tin Telegram (mock fetch); tsc sạch. Không đụng card đang chạy tốt.

### C2 — Stuck-detector → Lucy triage/split *(trái tim)*
Engine đã đếm `maxStageVisits` + rework. Thêm hook `onStuck` khi card chạm ngưỡng (rework ≥2 hoặc visit ≥ cap mà vẫn
fail/rework). Module `triage.ts` (opus, Lucy-director) đọc `card.history`+`reports` → quyết 1 trong 3: (a) **split** đẻ
2–3 card con atomic `blockedBy` rồi re-delegate; (b) nâng persona/model; (c) escalate Bill (lý do). **DoD:** smoke dựng
card kẹt giả → triage ra ≥2 subtask con HOẶC escalate có lý do; KHÔNG loop vô hạn; tsc sạch.

### C3 — Task-size gate: decompose-first
Siết stage spec (Kurisu architect opus): task lớn PHẢI ra danh sách subtask atomic; executor (Tanjiro) chỉ nhận mảnh.
Gate chặn executor nhận khối quá to (heuristic: brief dài/đa-mục → yêu cầu plan trước). **DoD:** smoke task-to → bị chặn +
ép decompose; task-nhỏ → qua thẳng; tsc sạch.

### C4 — Não riêng từng agent *(học dần như Lucy)*
Sau mỗi card xong, rút 1–2 bài học theo nghề persona (cái gì sai/đúng) → ghi `lucy-vault/Brain/agents/<personaId>.md`.
`runner.ts`/`lane-runner.ts`: `readActiveDigest()` thêm `readAgentBrain(personaId)` prepend vào system prompt. Nguồn học =
`error-stats` (lỗi hay gặp của persona) + reports; refine qua dream-per-persona. **DoD:** smoke: persona có brain riêng →
được nạp vào prompt (in chứng minh); persona chưa có → no-op; tsc sạch. KHÔNG đụng `Brain/preferences` (máy quản).

## 4. Cách chạy
```bash
# worker composite + autopilot (xem AUTOPILOT.md §4), rồi:
AM_TOKEN=$TOK AM_AUTOPILOT_MAX=15 pm2 start npm --name lucy-autopilot -- run autopilot
# theo dõi: Hub board + pm2 logs lucy-autopilot ; diff: ~/lucy/agent-machine/.worker/repos/Lucy
```
**Đêm đầu:** chạy **C0 + C1** (nhẹ, an toàn) xem 1-2 card trôi qua gate rồi mới thả C2–C4.

## 5. JSON sẵn (đẩy nhanh)
```json
[
 {"pipelineId":"feature","title":"C0 Nền: wire turn-log + error-stats sống","brief":"Wire turn-log.ts vào runner.ts + lane-runner.ts: mỗi turn ghi 1 dòng JSONL (agent,task,stage,model,motive,outcome) khi AM_TURNS_LOG set. error-stats.ts + /error-stats đã có. DoD: set AM_TURNS_LOG → 1 lane card → turn-log.jsonl có dòng; /error-stats total>0 phân loại đúng; smoke pass; tsc sạch."},
 {"pipelineId":"feature","title":"C1 Rate-limit → park + báo Telegram","brief":"callLLMRaw tất cả fallback dính 429/quota → phân loại lỗi rate-limit (KHÁC fail). Engine: card → status parked + retryAfter, không retry đốt token. notify.ts soạn tin ngắn bằng ds-v4-flash-free gửi ĐÚNG 1 lần qua Telegram. DoD: smoke giả lập 429 → card parked + 0 retry vô ích + 1 tin (mock fetch); tsc sạch."},
 {"pipelineId":"feature","title":"C2 Stuck-detector → Lucy triage/split","brief":"Engine hook onStuck khi card chạm ngưỡng (rework≥2 hoặc visit≥cap mà vẫn fail/rework). triage.ts (opus) đọc card.history+reports → (a) split 2-3 card con atomic blockedBy rồi re-delegate, (b) nâng model, (c) escalate Bill có lý do. DoD: smoke card kẹt → ≥2 subtask HOẶC escalate; không loop vô hạn; tsc sạch."},
 {"pipelineId":"feature","title":"C3 Task-size gate: decompose-first","brief":"Siết stage spec (Kurisu architect opus): task lớn PHẢI ra danh sách subtask atomic trước executor; gate chặn executor nhận khối quá to. DoD: smoke task-to bị chặn + ép decompose; task-nhỏ qua thẳng; tsc sạch."},
 {"pipelineId":"feature","title":"C4 Não riêng từng agent","brief":"Sau card xong rút 1-2 bài học theo persona → ghi Brain/agents/<personaId>.md. runner+lane-runner: readActiveDigest thêm readAgentBrain(personaId) prepend system prompt. Nguồn = error-stats + reports; refine qua dream-per-persona. DoD: smoke persona có brain riêng được nạp (in chứng minh); persona chưa có thì no-op; KHÔNG đụng Brain/preferences; tsc sạch."}
]
```
