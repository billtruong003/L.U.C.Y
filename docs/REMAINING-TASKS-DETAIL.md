# Task CÒN LẠI — giải thích dễ hiểu + kế hoạch gộp (2026-06-14)

> Bill đọc để hiểu từng task: NÓ LÀ GÌ · ĐỂ LÀM GÌ · LỢI GÌ · CÓ CẦN BILL KHÔNG.

## A. TASK AUTO-ABLE (máy tự làm được, KHÔNG cần Bill)

### F3 — Tách file engine.ts
- **Là gì:** `engine.ts` (~834 dòng) là "bộ não điều phối" của agent-machine — quản vòng đời card (chờ → đang làm → xong, xử lý kết quả mỗi bước). Quá to, khó đọc.
- **Làm:** chẻ thành 3 file nhỏ: core (vòng đời) · dispatch (chọn model/persona) · triage (xử lý outcome/kẹt). Refactor THUẦN — KHÔNG đổi hành vi.
- **Lợi:** dễ đọc, dễ sửa, ít bug khi đụng sau. Như dọn nhà cho gọn.

### F4 — Catalog model 1 nguồn (types chung)
- **Là gì:** danh mục model khai 2 nơi (TS + bridge Python) → dễ lệch, sửa 1 quên 1.
- **Làm:** TS sinh ra 1 file JSON, Python đọc → 1 nguồn sự thật.
- **Lợi:** đổi model 1 chỗ là xong, hết lệch.

### F5 — Test tích hợp thật (e2e)
- **Là gì:** test hiện chủ yếu là unit/giả lập; chưa test luồng THẬT coordinator↔worker↔bridge.
- **Làm:** 1 card nhỏ đi trọn pipeline thật → assert.
- **Lợi:** bắt lỗi "ghép nối" mà unit test không thấy.

### BH-D — Routing TỰ HỌC ⭐ (hơn Hermes)
- **Là gì:** giờ auto-route chọn model theo bảng CỨNG (hardcode). 
- **Làm:** học từ kết quả THẬT (model nào làm tốt loại task nào, nhanh/đúng/rẻ) → tự điều chỉnh chọn model lần sau.
- **Lợi:** Lucy tự khôn lên, chọn model ngày càng chuẩn + tiết kiệm. Đây là điểm "vượt Hermes" rõ nhất.

### BH-B — Galaxy node = ĐIỂM THẬT
- **Là gì:** click node trong galaxy giờ mở file note, nhưng node preference/signal CHƯA link tới card/issue/file GỐC sinh ra nó.
- **Làm:** gắn node → resource thật → click ra đúng nơi (card/file).
- **Lợi:** galaxy thành "bản đồ tri thức sống" — click 1 đốm ra ngay việc/đoạn code thật, không chỉ trang trí.

### BH-G — Replay / Giải thích ("vì sao Lucy làm X")
- **Là gì:** xem lại quỹ đạo + LÝ DO Lucy quyết 1 việc (trace + giải thích).
- **Lợi:** tin được + debug được khi Lucy làm gì lạ.

## B. TASK CẦN BILL (máy BỎ QUA, để dành Bill) — vì sao?

### N — Jarvis UI 🎨 (CẦN BILL QUYẾT)
- **Là gì:** thiết kế lại GIAO DIỆN web thành kiểu Jarvis: *chat ở trung tâm*, các view (galaxy/market/task) *orbit panel theo ngữ cảnh*, + màn "Home of Lucy" sống.
- **VÌ SAO CẦN BILL:** đây là QUYẾT ĐỊNH THIẾT KẾ / GU THẨM MỸ — KHÔNG có "đúng" tuyệt đối. Máy build mò sẽ ra thứ *sai gu Bill* → phí token (opus) làm lại nhiều lần. Bill chỉ cần chọn HƯỚNG 1 lần:
  - *(1) Incremental:* giữ tabs + thêm màn Home sống + panel bật trong chat. Nhanh, ít rủi ro.
  - *(2) Đại tu:* chat toàn màn, mọi thứ orbit, ẩn tabs (HUD Iron Man). Đẹp nhất, nặng.
  - *(3) Mockup trước:* máy vẽ 1-2 hướng cho Bill duyệt rồi mới code.
- **"Bỏ" nghĩa là:** auto-build KHÔNG đụng N, làm task kỹ thuật khác trước; N chờ Bill chọn hướng.

### K4 — Persona registry UI 🎨 (CẦN BILL QUYẾT)
- **Là gì:** màn QUẢN persona (tạo/sửa/xoá expert: marketing/finance/... + skill + brain) ngay trên Hub, thay vì sửa file JSON tay.
- **VÌ SAO CẦN BILL:** cũng là UI/UX + quyết định *có cần màn này không* (vs cứ sửa JSON), layout/field ra sao. Máy đoán dễ làm thừa/sai.
- **"Bỏ":** để dành; persona giờ vẫn thêm/sửa được bằng file JSON (đã có 17 cái).

### Khác cần Bill (nhỏ)
- **Cron watcher */30** — bật theo dõi tự động (health/disk/RSI): cần Bill duyệt + set ngưỡng giá muốn cảnh báo.
- **BH-A proactive / BH-F watchlist mở rộng** — cần Bill chọn theo dõi coin/chỉ số nào, ngưỡng nào.
- **Cron lọc tin xàm mỗi tối** — cần Bill duyệt "công thức cronjob" trước (quy tắc của Bill).

## C. GỘP & SỐ VÒNG (task-group mode, opus)

Gộp 2-3 task CÙNG VÙNG/vòng để tiết kiệm warm-up (đọc spec + khảo sát codebase 1 lần cho cả nhóm):

- **Vòng 1 — Nhóm F (code-health):** F3 + F4 + F5 → 1 vòng opus
- **Vòng 2 — Nhóm BH (engineering):** BH-D + BH-B + BH-G → 1 vòng opus

→ **~2 vòng opus là XONG hết task auto-able.** (Có thể tách thành 3 nếu F3 tách-engine quá nặng nên làm riêng cho an toàn.)

Sau 2 vòng đó, chỉ còn các task CẦN BILL (N, K4, cron/ngưỡng) → auto-build sẽ báo NEEDS_HUMAN + dừng.

> Lưu ý chi phí: opus ~5x sonnet. 2-3 vòng opus ước ~$40-90 (tuỳ độ nặng F3/BH-D). Gộp giúp cắt overhead lặp, không cắt phần làm chính.
