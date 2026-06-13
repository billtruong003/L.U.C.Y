# Đợt B — Provider Resilience: free model chạy BỀN + quality-first (thiết kế)

> **Viết 2026-06-13.** Mục tiêu: làm cho model FREE chạy liên tục không gãy (như Hermes) + chế độ "ép vào khuôn,
> làm tới hoàn thiện dù đốt token". Neo: [HERMES-GAP-MATRIX.md](HERMES-GAP-MATRIX.md) tầng 2+3 ·
> [MODEL-BENCHMARK.md](MODEL-BENCHMARK.md). Nguyên tắc: claude -p đi thẳng Anthropic; lane = free model qua llm-lane.

## Vì sao Đợt B (chủ nhân nói "execute model free liên tục")
Free model hay 429/hết quota → lane gãy giữa chừng. Hermes chạy bền nhờ 3 thứ: **rate-guard chung**,
**credential pool**, **credits tracking**. Cộng **iteration budget** để task khó vẫn cày tới xong. Đợt B port 4 cái đó.

## Mục tiêu Đợt B (4 card)

- **B1. Rate-guard chung (cross-process)** — 1 cú 429 không nổ thành N call phí quota; mọi tiến trình né provider đang bị limit.
- **B2. Credential pool** — nhiều key/1 provider, hết key nhảy key kia → free-tier chạy lâu hơn.
- **B3. Credits / quota tracking** — đọc header provider biết còn bao nhiêu → xoay model trước khi cạn.
- **B4. Quality-first mode** — card quan trọng: nâng cap vòng lặp, cày tới hoàn thiện (chấp nhận đốt token).

---

## B1 — Rate-guard chung (cross-process) ⭐ ROI cao nhất

**Vấn đề:** coordinator/worker/distill là tiến trình RIÊNG. Mỗi cái tự đâm provider → cùng lúc ăn 429, mỗi 429 lại
retry (SDK×Hermes = tới 9 call/turn) → đốt sạch RPH của free-tier. Lucy hiện có `RateLimitError` + park CARD nhưng
state nằm trong RAM 1 process, process khác không biết.

**Thiết kế (crib `nous_rate_guard.py`):**
- File state chung: `~/.lucy/rate-guard.json` = `{ "<providerId>": { until: epoch, reason } }`.
- `llm-lane.ts` TRƯỚC mỗi call: đọc file → nếu provider đang `until > now` → SKIP provider đó, sang fallback ngay (không gọi → không ăn thêm 429).
- Khi nhận 429: ghi `until = now + retryAfter` vào file (atomic write) → mọi process thấy ngay.
- TTL tự hết: `until` qua → tự dùng lại. Dọn entry cũ.
- Nối sẵn: park-card (engine) đã có; B1 thêm tầng PROVIDER (chặn ở lane trước khi tới card).

**DoD:** ép 1 provider 429 → file có entry; process thứ 2 đọc → bỏ qua provider đó, không phát thêm request (đếm log);
hết TTL → tự gọi lại. Smoke: 2 "process" giả ghi/đọc cùng file, đếm số call bị chặn.

## B2 — Credential pool

**Thiết kế (crib `credential_pool.py`):**
- `.env.llm` cho phép nhiều key/provider: `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2`, ... (hoặc CSV).
- llm-lane giữ pool key/provider + con trỏ round-robin; key dính 429/401 → mark cooldown, nhảy key kế.
- Kết hợp B1: provider chỉ bị "guard" khi MỌI key của nó đều cooldown (không phải 1 key 429 là chặn cả provider).
- Secret: chỉ đọc từ env/file, KHÔNG log/echo key (giữ luật secret).

**DoD:** 2 key OpenRouter; key#1 ép 429 → tự dùng key#2, lane không gãy; cả 2 cooldown → mới guard provider. Smoke với key giả.

## B3 — Credits / quota tracking

**Thiết kế (crib `rate_limit_tracker.py` + `credits_tracker.py`):**
- Parse header response: `x-ratelimit-remaining-*`, `x-ratelimit-reset`, (nếu có) credits → lưu `~/.lucy/quota.json`.
- Hub/Telegram đọc → hiện "free-tier còn X req/Y token tới reset". Smart-router (Đợt A) đọc để TRÁNH con sắp cạn.
- Cảnh báo trước khi cạn (vd <10%) → Telegram 1 tin.

**DoD:** sau vài call, `quota.json` có số remaining thật từ header; Hub hiện; còn <10% → báo Telegram (dedup).

## B4 — Quality-first mode (ép vào khuôn, làm tới xong) ⭐ chủ nhân nhấn

**Ý chủ nhân:** task quan trọng thì cho agent cày tới hoàn thiện, chấp nhận đốt token — như Hermes iteration-budget cap cao (90).

**Lucy hiện:** cố tình thấp để tiết kiệm VPS — `maxTurns` persona ~12-32, `maxStageVisits` ~8, cost-cap/card. Hạ tầng ĐÃ CÓ, chỉ cần "công tắc".

**Thiết kế:**
- Cờ per-card `quality: 'fast' | 'thorough'` (mặc định 'fast' giữ nguyên hành vi).
- 'thorough' → nâng động: `maxTurns ×N`, `maxStageVisits +K`, per-card cost-cap cao hơn, BẬT verify-gate cứng (đã có) + thêm vòng reviewer.
- Đặt qua: Board (chọn card → "Quality-first"), hoặc smart-router/autopilot tự gắn khi task gắn nhãn quan trọng, hoặc `/quality` chat.
- Vẫn chặn trần tuyệt đối (token-guard hard limit) để không chạy vô hạn — "thorough" ≠ "vô hạn".

**DoD:** card gắn 'thorough' → log thấy cap nâng; chạy nhiều vòng hơn tới khi verify PASS; card 'fast' không đổi. Token-guard hard vẫn cắt.

---

## Thứ tự + rủi ro
1. B1 (rate-guard — lời ngay, ít rủi ro) → 2. B3 (quota tracking, bổ trợ router) → 3. B2 (credential pool) → 4. B4 (quality-first).
- **Rủi ro:** file-state chung cần atomic write (tránh race 2 process ghi đè) — dùng write-tmp-rename. Secret nhiều key → tuyệt đối không log.
  B4 dễ "đốt token mất kiểm soát" → bắt buộc giữ token-guard hard làm trần.
- **Đo lường:** sau Đợt B kỳ vọng: free-lane ít gãy 429 hẳn (đếm 'rate-limit-parked' giảm), quota hiện minh bạch, card thorough tỉ lệ done-không-cần-người tăng.
