---
name: dash-fix-token-cost
description: DASH-FIX (MASTER-SPEC
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fa27803-e831-4c7e-9acb-4dcb4b60fa55
---

DASH-FIX = sửa luồng token/cost Dashboard (audit `/root/lucy-workspace/dashboard-data-audit.md`). Gốc: 2 sổ rời (ledger worker-only vs token-guard counter mọi-đường) → ngày>tháng, 60M token mà $0, telegram không hiện.

**Round 1 [S1+S2+S3 backend] ✅ DONE 2026-06-17:**
- `LedgerEntry` (types.ts) +`source/model/cacheTok` (backward-compat: readLedger vá dòng cũ→source='worker',cacheTok=0). `inTok` giờ = input "tươi", cache tách `cacheTok`.
- `engine.recordSpend()` = 1 ĐƯỜNG GHI ledger; worker submit qua đó, **BỎ tokenGuard.addTokens**. `token-guard.used` DẪN XUẤT `engine.ledgerUsedToday()` (Σ in+cache+out hôm nay, UTC) — wire `tokenGuard.ledgerSum` ở coordinator-main. Cache 1 ngày, invalidate khi recordSpend.
- Coordinator `POST /spend` (đủ trường) tính usd 1 chỗ qua `pricing.ts`; `/token-guard/add` thành alias source='unknown'.
- `pricing.ts`: FALLBACK hardcode (opus 5/25 · sonnet 3/15 · haiku 1/5 · fable 10/50 USD/1M; cacheRead 0.1×in, cacheWrite 1.25×in — xác nhận claude-api skill) + `refreshOpenRouterPrices()` fetch lane.
- Bơm source+model+cache vào: hub index.ts ×4 (reportTok→/spend), auto-build.py, bridge lucy_bridge.py (model=LAST_MODEL) + report_tok.py cron (4 .sh truyền slug+opus), autopilot-main director.
- **Cutover forward-only:** migrate 1 entry catch-up token-day.json hôm nay (70.77M, source=unknown usd=0, KHÔNG bịa attribution) vào ledger → used() liên tục qua restart + giữ safety guard.
- Verify LIVE: `token-guard.used == Σ ledger hôm nay = 70,769,768` ✓. smoke 43/13/16/22 PASS.

**Round 2 [S4 dashboard] ✅ DONE 2026-06-17:**
- metrics.ts: MetricsDay/Group +`cacheTok`, Metrics +`costBySource`, helper `add()` gom in/out/cache, buildMetrics ưu tiên `e.model` ghi-thẳng (dòng cũ→resolve persona), buildSeries token GỘP cache → khớp guard.used.
- Coordinator /metrics: tokenDay/Month +cache, costByModel/Agent +in/out/cache, mảng `costBySource` sort theo token.
- FE api.ts: MetricsCostEntry/AgentEntry +in/out/cache, type MetricsSourceEntry, MetricsData.costBySource?. Dashboard.tsx: REVERT vá interim (Token/ngày→`data.tokenDay`), helper `TokBreakdown` + `SOURCE_LABEL`, cột in·out·cache cho Model/Agent, section "Nguồn đốt".
- Verify LIVE: `tokenDay==guard.used=98,342,570` ✓ · `tokenDay≤tokenMonth` 98M≤136M ✓ (P2 ngày>tháng HẾT) · costBySource worker$146.81+unknown$0. smoke-metrics 19/19. ⚠️ costDay=0 hôm nay = ngoại lệ forward-only (hôm nay ledger chỉ source=unknown từ /token-guard/add legacy của bridge/cron CHƯA restart); cacheTok=0 toàn bộ (entry mới qua /spend cacheReadTok mới lấp).

**Round 3 [S5 QA] ✅ DONE 2026-06-17 — DASH-FIX HOÀN TẤT (S1-S5):**
- TZ=VN(UTC+7) 1 NGUỒN: `src/tz.ts` (`vnDay`/`vnMonth`/`vnAlign`, đọc env `LUCY_TZ_OFFSET` def 7) thay MỌI `toISOString().slice(0,10)` UTC ở: token-guard.today, engine.ledgerUsedToday (+filter vnDay(e.ts)), metrics.buildMetrics (tokenByDay+cardThroughput) + buildSeries (ngày căn nửa đêm VN), coordinator /metrics. → resetDay↔metrics khớp, hết lệch ~7h quanh nửa đêm.
- Smoke reconcile: smoke-token-guard 46/46 (+used==Σledger hôm nay VN · double-count guard: addTokens KHÔNG đẩy used · token>0⇒usd>0); smoke-metrics 23/23 (+ngày≤tháng · cost ngày≤tháng · Σ usd costBySource==costByModel). token-guard-bugs 13/13.
- Perf: `store.readLedger()` cache mtime+size (invalidate khi appendLedger / ghi ngoài) — /metrics gọi 3-4× nay parse 1 lần. Ledger nhỏ (~35KB/278 dòng) → rotate file DEFER (đo trước, chưa cần).
- Verify LIVE (port 8780, header `x-worker-token` KHÔNG phải Bearer): tokenDay==guard.used=103,065,541 ✓ · tokenDay≤tokenMonth 103M≤140M ✓ · guard.date=2026-06-17 (VN) ✓. costDay=0 hôm nay = ngoại lệ forward-only (today toàn source=unknown usd=0 từ bridge/cron legacy CHƯA restart — Bill restart sẽ vào /spend priced).

⚠️ Restart coordinator phải giữ full env /proc (AM_TOKEN 48-ký + AM_DATA + LUCY_VAULT). KHÔNG restart lucy-bridge (code-only, Bill restart). Liên quan [[token-guard-single-source]] [[pt-telegram-token-parity]] [[lucy-roadmap-state-jun15]].
