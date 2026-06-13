# Roadmap kế tiếp — đóng gap vs Hermes (sau A/B/C + streaming Đường A)

> **Viết 2026-06-13.** Gom mọi thứ [ASSESSMENT-VS-HERMES.md](ASSESSMENT-VS-HERMES.md) chấm Lucy CÒN THIẾU →
> các PHASE cụ thể, có card + ROI + phụ thuộc. Đã xong: A (multi-model chat+route+thinking), B (rate-guard/cred-pool/
> quota/quality-first), C (cache-parity/aux/curator + FTS5 sẵn), + Đường A (claude chat streaming Telegram).
> Mục tiêu: từ Lucy ~6 → thu hẹp về Hermes ~8.8, theo thứ tự ROI cho 1-người-dùng.

---

## PHASE D — UX SỐNG (parity công-năng, ROI cao nhất, data phần lớn ĐÃ CÓ)
Gap: Hermes webui sống (SSE, composer, card thinking/approval); Hub Lucy đẹp-nhưng-tĩnh.
- **D1. SSE streaming cho Hub** — chat/board cập nhật realtime (giờ request-response). Nối stream-json (đã có ở bridge) lên Hub.
- **D2. Composer footer** — chọn model/persona + vòng context-ring + trạng thái gateway, ngay khung chat. (API `/llm/models` `/llm/guard` đã có.)
- **D3. Card thinking / tool / approval** — block 💭 vàng + tool-call card + approval allow/deny/always (thay gate thô). (A4 + verify-gate đã có data.)
- **D4. Panel rate-guard / quota** lên Dashboard — hiện provider đang limit + free-tier còn lại. (B1/B3 `/llm/guard` sẵn — chỉ thiếu UI.)
- **D5. Mobile responsive** Hub + test cảm-ứng.
> ROI: biến tính năng A/B đã code thành "nhìn thấy & bấm được". Phụ thuộc: không (data sẵn).

## PHASE E — CONTEXT & TRÍ NHỚ SÂU (gap core nặng nhất)
Gap: Lucy thiếu context-compression (phiên dài TRÀN ctx); FTS5 chưa lineage/bookends.
- **E1. Context compressor** ⭐ — `should_compress` khi prompt ≥ 0.5×ctx → giữ head + tail-budget, summarize GIỮA bằng model rẻ (aux-client đã có), "latest wins". Chống tràn phiên dài.
- **E2. Session lineage + bookends** trên FTS5 — parent_session_id + 3-đầu/3-cuối + ±N window + dedupe theo lineage (recall.ts đã có FTS5 trần).
- **E3. Đo prompt-cache thật** — log `cache_read_input_tokens` trước/sau C1 → chứng minh % cache + $/card giảm.
- **E4. Trajectory compressor** — nén phiên CỰC dài (ưu tiên thấp, chỉ khi cần).
> ROI: lõi sâu, chống vỡ khi dùng lâu. Phụ thuộc: aux-client (xong), recall.ts (xong).

## PHASE F — SỨC KHỎE CODE (test/CI/clean)
Gap: 37 smoke (5 đỏ), không CI; engine.ts phình; bridge lặp catalog của TS.
- **F1. Dọn 5 nợ test** — error-stats-bugs/model, remote (EADDRINUSE → random port), verify-gate-loop (stuck-vs-loop), conc (timing flaky → nới ngưỡng).
- **F2. CI gate** — GitHub Actions chạy tsc + smoke mỗi push (chặn merge khi đỏ).
- **F3. Tách engine.ts** (834 LOC) → engine-core + engine-dispatch + engine-triage.
- **F4. Gói types dùng chung** — gen JSON catalog từ MODEL_CATALOG (TS) cho bridge Python đọc → 1 nguồn sự thật (hết lặp).
- **F5. Integration test thật** — coordinator↔worker↔bridge e2e (có key), không chỉ unit.
> ROI: lâu dài, chống regress. Phụ thuộc: không.

## PHASE G — SCALE & ECOSYSTEM (Hermes hơn nhiều, làm khi cần)
- **G1. Batch + checkpoint** — chạy hàng loạt task multiprocessing + resume (cron quét backlog ban đêm).
- **G2. MCP / plugin system** — cắm tool ngoài (như Hermes optional-mcps).
- **G3. Multi-platform gateway** — trừu tượng kênh (Telegram/Discord/WhatsApp) 1 khung, per-platform toolset.
- **G4. Credential-pool sâu** — key cooldown cross-process (giờ in-process) + provider-profile declarative (gom quirk).
- **G5. Curator-at-scale** — umbrella merge + usage telemetry cho skill/brain.
> ROI: chỉ cấp thiết khi Lucy gánh nhiều dự án/kênh. Để sau cùng.

## PHASE H — ORCHESTRATOR nâng cấp (tiếp Đường A)
- **H1. Stream auto/orch** — `auto_run`/`orch_run` dùng `run_claude_stream` cho plan + synthesis (chữ chạy).
- **H2. Offload sub-agent → free-lane** — sub-agent KHÔNG cần Claude xịn → chạy Nemotron free / lane (đỡ ăn rate-limit subscription).
- **H3. Đường B (Claude Agent SDK)** — `pip install claude-agent-sdk` in-process (bỏ subprocess-spawn latency), nếu muốn code sạch hơn.
> ROI: tiếp nối UX vừa làm. Phụ thuộc: Đường A (xong).

---

## THỨ TỰ ĐỀ XUẤT
**D (UX sống) → E (context, chống tràn) → H (orchestrator stream) → F (test/CI) → G (scale).**
Lý do: D biến công sức A/B thành thấy-được (động lực + dùng được ngay); E chặn lỗi vỡ-khi-dùng-lâu; H hoàn thiện luồng
streaming; F/G là nền dài hạn. Mỗi phase em sẽ: hỏi chốt hướng → code từng card → smoke → commit → báo.

> Ghi chú quota: việc rẻ/bulk → free-lane (Nous Nemotron free / OpenRouter) để DÀNH subscription Claude cho não chính.
> Nạp credit Nous (tùy chọn) mở Claude-via-Nous metered + 265 model — chỉ cần khi muốn model Claude không có.
