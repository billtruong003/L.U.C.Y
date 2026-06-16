# PM-PROMPT — đưa output multiagent (clone) → deliver sạch

> Paste khối dưới cho Lucy để chạy chế độ quản-lý-dự-án 4 tier. Đã nhúng sẵn kết quả audit (2026-06-12) nên Lucy không audit lại từ đầu.

---

Lucy, vào **chế độ QUẢN LÝ DỰ ÁN**. Mục tiêu: đưa TOÀN BỘ output multiagent đang đọng trong clone `agent-machine/.worker/repos/Lucy` thành **source live sạch — đã verify — đã push**. Làm **tuần tự 4 tier**, mỗi tier XONG thì báo cáo ngắn (Telegram-style, không bảng/header) rồi mới sang tier sau. **DỪNG chờ em gật ở ranh giới T3 → T4** (vì T4 đụng push/rehost). Không bịa số; typecheck + build phải XANH mới được qua tier.

Bối cảnh đã audit (tin, đừng làm lại): mọi deliverable là code thật + wired + clone tsc PASS; repo an toàn (không secret, không node_modules track, không auto-push). Pending merge: metrics.ts (rewrite, lệch chữ ký với live), Dashboard.tsx (C2), notify.ts (C6 token-guard), skill-loader.ts (C4), error-stats.ts/cli. Live HEAD đã có C1/C3/C5.

**T1 — BUG FIX (sửa lỗi thật, chưa thêm gì mới):**
- Reconcile `metrics.ts`: clone ký `buildMetrics(store, recall)` vs live `(store, vaultDir)` + chỗ gọi ở coordinator. Chọn 1 chữ ký, sửa cho compile sạch trên nền live HEAD.
- Sửa **double-count token** ở autopilot: engine đã cộng token thật rồi mà autopilot còn cộng ước lượng cứng (4k/3k) → bỏ 1 nguồn, để counter token/ngày đúng.
- TokenGuard: `check()` chỉ reload theo mốc ngày → xác nhận soft/hard đọc đúng số hiện tại (không stale trong ngày).
- Quét nhanh các lỗi runtime/logic khác trong diff clone; có thì liệt kê + fix. Không có thì nói "không thấy bug khác".
- HỎI em quyết 2 thứ (đừng tự đổi): (a) maxTurns siết lane 200→16, claude 40→12 — giữ hay nới? (b) tester.json đổi sonnet→model free — giữ rẻ hay trả lại sonnet?

**T2 — DỌN CODE:**
- Xoá rác untracked: 4 file `agent-machine/PLAN-*.md`, 4 file `agent-machine/_test-*.ts`.
- Rà các `src/smoke-*.ts` mới: cái nào là smoke test thật của feature thì giữ, cái nào nháp thì bỏ.
- Dọn comment thừa kiểu `// BUG-1b:` nếu chỉ là ghi chú tạm; chuẩn hoá tên/format theo code xung quanh.
- Không đổi hành vi — chỉ dọn. tsc vẫn phải xanh.

**T3 — TÍNH NĂNG CÒN THIẾU (đóng nốt 2 card blocked):**
- Nối `error-stats.ts` vào sản phẩm: thêm endpoint coordinator `GET /error-stats` + proxy hub `/api/error-stats`, rồi panel **"Agent Insights"** trong Dashboard (đúng card blocked "Dashboard Agent Insights").
- Card blocked "Nghiên cứu lỗi nhiều nhất + hướng fix": dùng error-stats sinh top-lỗi + gợi ý fix, render trong panel đó.
- Chứng minh `skill-loader.ts` thật sự kích hoạt: 1 smoke card "viết test cho X" → in ra SKILL được nạp.
- (tuỳ sức) vá lỗ verify-gate: stage `done` phải có deliverable/test pass mới cho qua — chống false-done.

**T4 — PUSH + DELIVER (chỉ chạy sau khi em gật):**
- Full verify: `npx tsc --noEmit` ở agent-machine + hub/server, `npx vite build` ở hub/web — phải sạch hết.
- Merge clone working-tree → `/root/lucy` (reconcile theo từng file trên nền live HEAD, KHÔNG copy đè mù; cẩn thận metrics.ts).
- Commit message rõ (liệt kê C2/C4/C6 + error-stats + bugfix), push lên `main` (origin billtruong003/L.U.C.Y), KHÔNG đụng `.env*`/secret.
- Rehost: `pm2 restart` coordinator/hub/worker/autopilot (giữ env, không đụng `lucy-bridge`).
- Verify live: `/health`, `/metrics`, `/error-stats` ra số thật; web mở vào Dashboard; board 49 card còn nguyên. Báo cáo cuối: cái gì đã live, cái gì còn lại.

Quy tắc xuyên suốt: report mỗi tier ngắn gọn + đường dẫn file; gặp việc phá huỷ lớn / đụng tiền-token nhiều → hỏi em trước.

---

## Phụ lục — bằng chứng audit (cho Lucy tham chiếu, 2026-06-12)
- Deliverable real-wired: metrics.ts→coordinator `/metrics`; notify.ts→autopilot-main; skill-loader.ts→runner+lane-runner; Dashboard.tsx→App.tsx tab; error-stats-cli→npm `stats:errors`.
- error-stats.ts = real nhưng nửa mồ côi (chỉ CLI, chưa API/UI) → T3 nối.
- Clone core diff KHÔNG xoá guardrail nào, ngược lại THÊM (token hard/soft, validate laneModel LOUD, cap turn). Clone `tsc` PASS.
- An toàn: 0 secret hardcode, 0 node_modules track, 0 lệnh auto-push/destructive trong code agent.
