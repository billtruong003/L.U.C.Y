# Lucy — HƯỚNG DẪN TEST (sau rehost 2026-06-14)

> Mở Hub: **http://14.225.255.73** (nhập mật khẩu). Lần đầu vào nhớ **Ctrl+Shift+R** (hard refresh) để nạp bundle mới `index-BjP5fikB.js`.
> Mỗi mục: NÓ LÀ GÌ · CÁCH TEST (bước) · VÍ DỤ NHẬP · KẾT QUẢ MONG ĐỢI · ✅ PASS khi nào.

---

## 1. Lane free model có TOOL (fix "hết lượt tool") ⭐ vừa fix

- **Là gì:** chọn model rẻ/free (Nemotron, Gemini free...) trong chat, nó vẫn tự dùng web_search/web_fetch để trả lời số liệu thật. Trước đây hay kêu "đã hết lượt tool".
- **Cách test:**
  1. Vào Hub → khung chat → đổi model sang 1 model FREE (vd `nvidia/nemotron...` hoặc `google/gemini-...free`).
  2. Hỏi câu cần web.
- **Ví dụ nhập:** `Giá BTC bây giờ bao nhiêu? Trả lời kèm nguồn.`
- **Kết quả mong đợi:** thấy tool-card 🔧 `web_search` → 🔧 `web_fetch` chạy, rồi ra **con số giá thật + nguồn**. KHÔNG còn câu "đã hết lượt tool, chưa có kết luận".
- **✅ PASS:** có số liệu thật + không có dòng "hết lượt tool". (Nếu model lặp gọi tool, hệ thống tự chặn lặp + ép trả lời ở lượt cuối.)
- **Cũng test trên Telegram:** gõ trong bot lane model → hỏi y vậy, phải ra số thật.

## 2. Galaxy TIME-TRAVEL (BH-B) ⭐ mới

- **Là gì:** bản đồ "não" (galaxy) giờ có thanh trượt thời gian — kéo để xem não Lucy ở từng mốc (node nào đã tồn tại lúc đó), hover node xem tuổi.
- **Cách test:**
  1. Hub → tab/nút **Galaxy** (bản đồ tri thức).
  2. Tìm thanh trượt thời gian (time-travel) → kéo từ trái (cũ) sang phải (nay).
  3. Hover 1 node bất kỳ.
- **Kết quả mong đợi:** kéo về quá khứ → số node ÍT đi (chỉ hiện node đã sinh trước mốc đó); kéo về nay → đủ ~289 node. Hover hiện tuổi node.
- **✅ PASS:** ở giữa mốc hiện ~145/289 node; node sinh sau mốc bị ẩn.

## 3. Routing TỰ HỌC (BH-D) ⭐ mới — backend xong, NÚT UI chưa có

- **Là gì:** Lucy học từ feedback 👍/👎 để lần sau tự chọn model tốt hơn cho từng loại task (vượt Hermes ở chỗ tự khôn lên).
- **Trạng thái:** API sống (`/llm/feedback`, `/llm/outcomes`) nhưng **nút 👍/👎 trên Hub CHƯA dựng** → giờ chưa bấm test từ giao diện được.
- **Cách "thấy" tạm (không bắt buộc):** sau khi auto-route chạy vài lần, dữ liệu outcome tích lại; khi đủ sẽ override bảng cứng. Nút bấm sẽ làm trong đợt sau (task nhỏ).
- **✅ PASS (đợi UI):** khi có nút, bấm 👍/👎 → lần sau task tương tự route sang model được khen.

## 4. Replay / Giải thích "vì sao Lucy làm X" (BH-G) ⭐ mới

- **Là gì:** ghi lại quỹ đạo từng bước (turn-log) của coordinator/worker để xem lại + giải thích quyết định; thêm tự-chữa khi card kẹt (stuck-triage self-healing).
- **Cách test:** chạy 1 task qua pipeline (giao 1 card/nhiệm vụ nhỏ trong Tasks) → xem có log từng bước (replay) để lần ngược lý do.
- **Kết quả mong đợi:** card chạy xong có dấu vết các bước; card kẹt thì hệ tự thử gỡ thay vì treo.
- **✅ PASS:** xem được trace các bước của 1 card.

## 5. Token-guard minh bạch (BH-E) ⭐ mới

- **Là gì:** chặn/ cảnh báo khi 1 lượt sắp tràn token + hiện rõ cho biết (autopilot minh bạch).
- **Cách test:** chat dài liên tục nhiều lượt trong 1 phiên → quan sát badge ngữ cảnh (ctx%/cache%) và không bị "vỡ" giữa chừng.
- **✅ PASS:** phiên dài không crash; có cảnh báo/cắt gọn khi gần ngưỡng.

---

## NHÓM ĐÃ LÀM TRƯỚC (vẫn nên rà lại nếu chưa test)

## 6. Chat ĐA-PHIÊN (J)
- Nút ☰ mở sidebar danh sách phiên chat → tạo phiên mới, đổi qua lại, mỗi phiên nhớ riêng.
- **Ví dụ:** phiên A nói "tên tôi là Bill" → mở phiên B hỏi "tên tôi?" → B KHÔNG biết (đúng, tách phiên); quay lại A hỏi → A nhớ "Bill".
- **✅ PASS:** mỗi phiên có lịch sử riêng, không lẫn.

## 7. Lane chat mang PERSONA + lịch sử (L2)
- Chọn model free, nói nhiều lượt → nó nhớ ngữ cảnh qua lượt (không phải hỏi lại từ đầu).
- **Ví dụ:** "nhớ giùm số 42" → lượt sau "số tôi vừa nói?" → trả "42".
- **✅ PASS:** model rẻ nhớ qua lượt.

## 8. Consult_expert (K2) — hỏi chuyên gia phụ
- Trong chat hỏi câu chuyên ngành → Lucy có thể gọi expert (marketing/finance/researcher...) qua tool-card.
- **Ví dụ:** "nhờ chuyên gia tài chính phân tích xu hướng vàng tuần này".
- **✅ PASS:** thấy tool-card consult_expert + câu trả lời từ persona expert.

## 9. Thinking UI + badge model
- Mỗi câu trả lời có timeline 💭thinking / 🔧tool / ✅final (collapse được), badge tên model, badge ctx%/cache%.
- **✅ PASS:** thấy đủ các thành phần, tool-card bung ra xem tên + tham số + kết quả.

---

## ĐANG/ SẮP CHẠY (auto-build opus đợt này)
- **Nhóm F:** F3 tách engine.ts · F4 catalog model 1 nguồn · F5 test e2e (refactor/test — không đổi tính năng người dùng thấy).
- **K4:** màn QUẢN persona trên Hub (tạo/sửa/xoá expert + skill + brain thay vì sửa JSON tay) → sau đợt này sẽ có màn để test CRUD persona.
- Xong sẽ tự rehost lại + báo Telegram.

## CHƯA LÀM (chờ chủ nhân)
- **N — Jarvis UI đổi giao diện lớn:** tạm hoãn (chưa có nhu cầu).
- Cron watcher */30 + ngưỡng giá cảnh báo · cron lọc tin xàm (cần chủ nhân duyệt công thức + ngưỡng).
