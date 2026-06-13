# Hermes vs Lucy — ma trận khoảng cách đầy đủ (đếm section)

> **Viết 2026-06-13.** Trả lời chủ nhân: "ta có bao nhiêu section cần làm, Hermes hơn ta những gì".
> Đọc source `hermes-agent` thật. Mỗi mục: Hermes có gì · Lucy có gì · GAP · công sức (Dễ/TB/Khó).
> Trạng thái: ✅ làm rồi · 🟡 có một phần · ❌ chưa có.
> Neo: [HERMES-DEEP-FINDINGS.md](HERMES-DEEP-FINDINGS.md) · [STEAL_FROM_HERMES.md](STEAL_FROM_HERMES.md)

**TÓM TẮT ĐẾM: 6 tầng · 20 section.** Trong đó ✅ ~5 · 🟡 ~6 · ❌ ~9.

---

## TẦNG 1 — GIAO TIẾP / CHAT (yếu nhất, chủ nhân chỉ đúng)

### 1.1 ❌ Multi-model chat — cắm model tự do (opencode, deepseek...)
- Hermes: chat chạy được mọi provider (OpenAI/Anthropic/Google/DeepSeek/OpenRouter/OpenCode Zen...).
- Lucy: bridge HARDCODE `claude --model opus|sonnet`. `llm-lane.ts` có 7 provider NHƯNG chỉ executor-card xài, chat KHÔNG.
- GAP: bridge route → llm-lane khi model ≠ claude. **Công sức: TB.**

### 1.2 ❌ Đổi model / persona CHAT lúc chạy (`/model`, `/persona`)
- Hermes: `/model` đổi ngay 0-restart; profile = persona, clone/switch mượt.
- Lucy: 1 persona.md + 1 model cố định, không đổi giữa phiên.
- GAP: lệnh `/model` `/persona`, map chat_id → {model, persona} bền. **Công sức: TB.**

### 1.3 ❌ Bắt & hiển thị "thinking" (reasoning)
- Hermes: state-machine tách `<think>` theo từng stream-delta (chống leak); webui card vàng riêng.
- Lucy: `parseClaude` chỉ lấy `result`, bỏ thinking.
- GAP: bật thinking + tách + hiện (Telegram đoạn 💭 / Hub card). **Công sức: TB.**

---

## TẦNG 2 — PROVIDER (cắm model + chạy free liên tục)

### 2.1 🟡 Provider Profile declarative
- Hermes: 1 class `ProviderProfile` khai báo auth/endpoint/quirk (Kimi bỏ temp, OpenCode Zen cần UA né WAF) 1 chỗ.
- Lucy: `PROVIDERS` map phẳng — có baseUrl/envKey nhưng KHÔNG gói quirk request-time.
- GAP: profile-hoá để cắm provider mới không sửa core. **Công sức: TB.**

### 2.2 ❌ Credential pool — nhiều key cùng 1 provider, tự xoay
- Hermes: `credential_pool.py` — nhiều key/provider, fail key này nhảy key kia (failover bền).
- Lucy: 1 key/provider (`.env.llm`). Hết quota key = chết lane đó.
- GAP: pool key + rotation. **Free model chạy liên tục lâu hơn.** **Công sức: TB.**

### 2.3 🟡 Rate-limit tracker + cross-session guard (chống retry-amplification)
- Hermes: đọc `x-ratelimit-*` header; `nous_rate_guard.py` ghi state RA FILE để MỌI phiên (CLI/cron/aux) check
  TRƯỚC khi gọi → 1 cú 429 không nổ thành 9 call phí quota.
- Lucy: có `RateLimitError` + park card + retryAfter (tốt!) NHƯNG parse header thô, KHÔNG có file guard chung
  cross-process (coordinator/worker/distill mỗi cái tự đâm 429 riêng).
- GAP: file rate-guard chung + parse header chuẩn. **Free model đỡ bị ban, chạy bền.** **Công sức: TB.**

### 2.4 ❌ Credits / usage tracking từ header
- Hermes: parse `x-nous-credits-*` → biết còn bao nhiêu, depletion detection, cảnh báo trước khi cạn.
- Lucy: chỉ đếm token nội bộ (token-guard), KHÔNG đọc quota thật từ provider.
- GAP: đọc header quota → biết free-tier còn gì mà xoay. **Công sức: TB.**

### 2.5 🟡 Auxiliary client router (side-task dùng model rẻ nhất có)
- Hermes: 1 chain resolve cho mọi việc phụ (compress/search/extract/vision) → tự lấy backend tốt nhất sẵn.
- Lucy: distill/salvage hardcode 'haiku'/'sonnet'; chưa có router chung.
- GAP: router 1 chỗ cho side-task. **Công sức: Dễ.**

---

## TẦNG 3 — ĐA NHIỆM / EXECUTION (queue, background, batch)

### 3.1 🟡 Queue + concurrency + background
- Hermes: cron `scheduler.tick()` file-lock + advance-before-run + pool song song (job độc lập) + pool tuần tự (job đụng env).
- Lucy: engine có pending/inFlight queue, `maxLanes` đồng thời, parked-sweep, lease-requeue, autopilot nền. KHÁ đủ.
- GAP: pool tách "song song vs tuần tự" theo va chạm tài nguyên; wake-gate. **Công sức: TB.**

### 3.2 ❌ Batch runner — multiprocessing + checkpoint/resume
- Hermes: `batch_runner.py` chạy HÀNG LOẠT prompt qua multiprocessing, checkpoint chịu lỗi, resume run dở.
- Lucy: chạy từng card, không có batch-mode hàng loạt + resume checkpoint.
- GAP: batch nhiều task + checkpoint. **Công sức: Khó.**

### 3.3 🟡 Iteration budget ("ép vào khuôn", chạy tới xong dù đốt token)
- Hermes: `IterationBudget` cap CAO (parent 90, subagent 50) consume/refund thread-safe → agent cày tới hoàn thiện.
- Lucy: `maxTurns` (persona ~12-32) + `maxStageVisits` (~8) + cost-cap. THẤP hơn nhiều (cố tình tiết kiệm token VPS).
- GAP: chế độ "quality-first" cho card quan trọng (nâng cap, chấp nhận đốt token). **Công sức: Dễ** (đã có hạ tầng, chỉ chỉnh).

### 3.4 🟡 Toolset / toolset-distribution
- Hermes: gom tool theo scenario, compose, hạn chế schema per-fork (token nhẹ + an toàn).
- Lucy: persona khai `allowedTools` tĩnh — có rồi nhưng không compose/distribution động.
- GAP: toolset compose động theo loại card. **Công sức: TB.**

---

## TẦNG 4 — CONTEXT / CHẤT LƯỢNG TOKEN

### 4.1 ❌ Prompt-cache parity (NỢ — ROI cao nhất)
- Hermes: fork dùng chung system-prompt cha byte-identical → trúng prefix cache, **ghi giảm ~26% chi phí**.
- Lucy: ⚠️ readAgentBrain/win-lesson (C1/C4) vừa thêm làm prefix ĐỔI mỗi stage → đang ăn mòn cache.
- GAP: giữ prefix ổn định + audit chỗ chèn động. **Công sức: Dễ→TB, tiết kiệm lớn.**

### 4.2 ❌ Context compressor (giữ head+tail, summarize giữa)
- Hermes: `should_compress` khi prompt ≥ 0.5×ctx → giữ system+đầu + tail-budget, summarize GIỮA bằng model rẻ, "latest wins".
- Lucy: không nén — dựa --resume session + brief-truncation (C3). Phiên dài sẽ tràn ctx.
- GAP: nén ngữ cảnh khi gần tràn. **Công sức: TB.**

### 4.3 ❌ Trajectory compressor
- Hermes: nén trajectory dài (cho data-gen/phiên rất dài).
- Lucy: chưa cần gấp (card ngắn). **Công sức: Khó / ưu tiên thấp.**

---

## TẦNG 5 — LEARNING (phần lớn ĐÃ làm — C1→C4)

### 5.1 ✅ Skill-loop / background-review → não nghề per-agent
- Lucy C1-C4: brain per-persona, win/miss lesson, dream đúc kết, blacklist KHÔNG-bắt. **Có rồi.** (Hermes thêm: patch SKILL.md + references/ — ta dùng vault thay.)

### 5.2 ❌ FTS5 session recall (0-token "đã làm chưa")
- Hermes: SQLite FTS5 + bookends + ±N window + lineage dedupe.
- Lucy: vault flat-file + dream; KHÔNG có full-text recall xuyên phiên.
- GAP: FTS5 trong better-sqlite3. **Công sức: Dễ, giá trị cao.**

### 5.3 🟡 Curator lifecycle (active→stale→archived, gộp umbrella)
- Hermes: curator no-LLM dọn skill theo thời gian.
- Lucy: dream có graduate/confirm/retire preference (gần tương đương) nhưng chưa cho não-nghề per-agent.
- GAP: lifecycle cho Brain/agents/. **Công sức: Dễ.**

---

## TẦNG 6 — UI / GATEWAY

### 6.1 🟡 Hub mượn pattern webui
- Hermes webui: composer footer (model/profile/context-ring), card thinking/tool/approval, SSE streaming, workspace panel.
- Lucy Hub: React đẹp, có Board/Dashboard/Cho-Lucy, NHƯNG chưa có composer đổi model, chưa SSE, chưa card thinking/approval.
- GAP: mượn 3 thứ: composer footer + thinking/tool/approval card + SSE. **Công sức: TB.**

### 6.2 🟡 Multi-platform gateway
- Hermes: 1 gateway → Telegram/Discord/WhatsApp/Weixin, per-platform toolset, delivery routing.
- Lucy: bridge Telegram + daily-brief Discord(Aki). Có 2 kênh nhưng không khung gateway thống nhất.
- GAP: trừu tượng gateway nếu cần thêm kênh. **Công sức: TB / ưu tiên thấp.**

---

## XẾP ƯU TIÊN ĐỀ XUẤT (theo ROI + ý chủ nhân)

**Đợt A (chủ nhân muốn — tầng chat):** 1.1 multi-model chat (cắm opencode) → 1.2 /persona /model → 1.3 thinking.
**Đợt B (free model chạy bền — đa nhiệm/provider):** 2.3 rate-guard chung → 2.2 credential pool → 2.4 credits → 3.3 quality-first mode.
**Đợt C (rẻ + lời lớn):** 4.1 prompt-cache parity → 5.2 FTS5 recall → 2.5 aux router → 5.3 curator não-nghề.
**Đợt D (UI/scale):** 6.1 Hub composer+thinking+SSE → 3.2 batch+checkpoint → 4.2 context compressor.
