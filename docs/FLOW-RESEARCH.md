# C3 — Nghiên cứu tối ưu flow đám agent (data thật)

> **2026-06-13.** Phân tích từ ledger production (`/root/.agent-machine`) + /metrics + history 59 card. KHÔNG lý thuyết suông.

## 1. Số liệu thật (tháng này)
- **Tổng:** $146.81 · 37.6M token · 59 card · 275 lượt agent chạy · 85 rework.
- **Theo model:** opus **$86** (59% tiền, chỉ 17% token) · sonnet **$61** (41% tiền, 83% token).
- **Lane (free) chỉ chiếm 17% số lượt chạy** (49/275). **83% chạy claude TRẢ TIỀN.**
- **Theo agent (paid):** builder $33.88 (75 run, chỉ 26 free) · tester $32.86 (71 run, 14 free) · architect $28.94 (opus) · reviewer-gate $20.55 (opus) · engineer $16.63 (32 run, 4 free) · reviewer-spec $10.96.
- **Rework: 1.44/card** (85/59). Nhiều card 6–9× rework ($5–10/card) trước khi chạm loop-cap (8).

## 2. Rò rỉ token — xếp hạng

### 🔴 L1 — Executor BỎ QUA lane free (rò rỉ #1)
Builder/engineer có `laneModel` + 7 provider đều có key, *vẫn chạy claude trả tiền 65–87% số lượt*. Lane chỉ 17% tổng. Builder: 49/75 run là PAID. **Đây là khoản phí lớn nhất, lẽ ra ~$0.** Nghi nguyên nhân: (a) `laneModel` builder bị gỡ giữa sprint (đã khôi phục), (b) `CompositeRunner`/`laneAvailable()` route sai hoặc lane lỗi → fallback claude âm thầm. *Cần truy root-cause khi build.*

### 🟠 L2 — Rework loop đốt kép
1.44 rework/card; card 6–9× rework. Mỗi rework re-run stage — gồm cả **reviewer opus** → phí nhân lên. 85 rework ≈ phần lớn token thừa. Não-nghề (C1 vừa làm) sẽ giảm dần, nhưng cần đo + siết.

### 🟠 L3 — Pipeline `feature` cứng 5 stage
Mọi card (kể cả nhỏ) chạy architect(opus) → builder → tester → reviewer-spec → reviewer(opus) = **tối thiểu 2 lượt opus**. Size-gate chặn task TO nhưng không giảm SỐ stage cho task nhỏ.

### 🟡 L4 — tester chạy sonnet ($33)
Tester (Shinobu) = agent tốn thứ 2, không có `laneModel` → luôn trả tiền. Test/tìm-bug thường model rẻ làm được.

### 🟡 L5 — opus = 59% chi phí
architect + reviewer-gate + autopilot-director đều opus. Nhiều quyết định đơn giản không cần opus.

## 3. Hướng tối ưu (đề xuất — xếp theo ROI)

| # | Hướng | Việc | Tiết kiệm ước tính | Effort | Rủi ro |
|---|---|---|---|---|---|
| **O1** | **Sửa routing lane** | Truy vì sao executor đi claude; đảm bảo có laneModel+key → LANE. Log rõ mỗi run đi lane hay claude (vì sao fallback) | **~$30–50/sprint** (lớn nhất) | vừa | thấp (lane đã verify chạy được) |
| **O2** | **Giảm rework** | Dùng C1 não-nghề + handoff `lastSummary` dày hơn (builder thấy đúng feedback) + triage sớm hơn (hạ ngưỡng stuck) | gián tiếp lớn (cắt loop) | vừa | thấp |
| **O3** | **Pipeline right-size** | Thêm pipeline `feature-lite` (builder→reviewer) cho card nhỏ; size-gate chọn lite vs full | cắt 1 opus + 2 stage/card nhỏ | vừa | trung (cần phân loại đúng) |
| **O4** | **tester → lane** | Thêm `laneModel` cho tester (model rẻ viết test đủ tốt) | ~tester paid → ~free | thấp | thấp-trung (chất lượng test) |
| **O5** | **Review phân tầng** | Gate reviewer dùng sonnet cho card thấp-rủi-ro, opus chỉ cho phức tạp/security | giảm phần opus | vừa | trung (chất lượng gate) |

## 4. Khuyến nghị thứ tự
**O1 trước** (rò rỉ lớn nhất, rủi ro thấp, lane đã sống) → **O4** (dễ, free ngay) → **O2** (cắt loop, cộng hưởng C1) → **O3** (cấu trúc) → **O5** (cân nhắc chất lượng).

> Lưu ý đo lường: trước khi sửa, bật log "run đi lane/claude + lý do" (một phần O1) để có baseline → sửa xong so số thật, không đoán.
