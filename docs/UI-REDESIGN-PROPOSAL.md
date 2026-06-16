# Lucy Hub — GIẢI PHÁP THIẾT KẾ LẠI UI/UX (2026-06-14)

> Dựa trên feedback của chủ nhân: (1) persona nhiều như đồ trang trí, (2) UI chưa responsive, (3) tinh hà tri thức chưa tụ thành cục sphere như bản "live", (4) tinh hà xuất hiện ở 2 tab. Tài liệu này là GIẢI PHÁP để duyệt trước, chưa code.

---

## VẤN ĐỀ 1 — Tinh hà ở 2 TAB (trùng lặp) → GOM 1 NGUỒN

**Hiện trạng:** `<Galaxy/>` được render ở:
- `Memory.tsx:156` (khi overview, không search) — galaxy chèn vào tab Memory
- `NeuralTab.tsx:14` (mode='galaxy', toggle 🌌 Tinh hà ⟷ ⚡ Live)

→ Cùng 1 thứ ở 2 chỗ = rối, tốn GPU, lệch trạng thái.

**Giải pháp:** Tinh hà có **MỘT NHÀ DUY NHẤT** = tab **Neural** (đổi tên thành **"Tinh hà"** 🌌).
- Bỏ `<Galaxy/>` khỏi Memory.tsx. Tab Memory về đúng vai: duyệt file/preference + note editor (danh sách trái + nội dung phải), gọn nhẹ, không 3D.
- Ở Memory, mỗi node/preference thêm nút nhỏ **"Xem trong Tinh hà →"** → nhảy sang tab Tinh hà và *focus* đúng node đó (truyền nodeId qua state).
- Lợi: 1 mental model, hết trùng, Memory load nhanh (không three.js), Tinh hà là "sân khấu" riêng.

---

## VẤN ĐỀ 2 — Tinh hà chưa "tụ thành cục sphere" → ĐỔI LAYOUT

**Hiện trạng:** `forceLayout3D()` (Galaxy.tsx:172) chỉ có lực đẩy → node nở ra như đám mây phân tán, không có hình khối.

**Giải pháp (3 hướng — chủ nhân chọn):**

- **A. GLOBE (quả cầu tri thức) ⭐ khuyến nghị:** chiếu mọi node lên *vỏ mặt cầu* (project ra bán kính R), cluster theo topic = các "lục địa" sáng trên quả cầu; auto-rotate chậm + bloom/glow. Trông như 1 hành tinh tri thức sống — gần nhất với bản "live" chủ nhân thích. Click lục địa → zoom vào cụm.
- **B. ORB ĐẶC (cục lõi):** thêm lực hướng tâm mạnh → các node *sụp vào* thành 1 cục cầu đặc quanh core, node phụ bám sát lõi. Đậm đặc, "1 khối não".
- **C. CỤM SPHERE LỒNG NHAU:** mỗi topic = 1 quả cầu nhỏ, các quả cầu nhỏ quay quanh 1 cầu trung tâm (galaxy = chùm sphere). Phức tạp nhất, nhìn "thiên hà" nhất.

(Cả 3 đều giữ three.js + shader sẵn có, chỉ đổi hàm layout + thêm centripetal/spherical constraint + auto-rotate. A là ít rủi ro & đẹp nhất cho mục tiêu "cục sphere giống live".)

---

## VẤN ĐỀ 3 — Persona "nhiều như đồ trang trí" → PHÂN TẦNG + CHỌN LỌC

**Hiện trạng:** 17 persona hiện grid card ĐỀU NHAU (Personas.tsx:104) → không phân biệt cái nào dùng được, cái nào chỉ là vai nội bộ pipeline.

**Phân loại thật:** trong 17 con, đa số là *vai nội bộ build* (architect/builder/data/designer/devops/engineer/grinder/investigator/orchestrator/reviewer/reviewer-spec/tester/writer = 13 con) — chủ nhân không "nói chuyện" với chúng. Chỉ vài con là **EXPERT người dùng gọi được**: finance, marketing, researcher, security (4 con).

**Giải pháp:** Tab Personas chia 2 tầng rõ:
- **🌟 EXPERT (gọi được):** finance/marketing/researcher/security — card LỚN, có avatar/realm, mô tả thế mạnh, nút **"Hỏi expert này"** → mở chat với persona đó (dùng consult_expert sẵn có). Đây là phần "sống", có giá trị.
- **🔧 Crew nội bộ (13):** section *thu gọn mặc định* ("Crew pipeline (13) ▸"), card nhỏ/list, chỉ bung khi cần xem/sửa. Không chiếm spotlight.
- Kết hợp với **K4** (đang auto-build màn CRUD persona): K4 lo tạo/sửa/xoá; thiết kế này lo *trình bày phân tầng* + nút "Hỏi". Sau khi K4 xong sẽ ghép.
- Tuỳ chọn dọn thật: xoá/gộp persona trùng vai để bớt rác (cần chủ nhân duyệt danh sách giữ/bỏ).

---

## VẤN ĐỀ 4 — RESPONSIVE → SỬA LAYOUT CO GIÃN

**Các điểm vỡ (Explore tìm được) + cách sửa:**
1. Sidebar `w-60` cứng, <768px ẩn hẳn (App.tsx:107) → đổi thành **rail co được**: icon-only ở md, full ở lg, drawer trượt ở mobile.
2. Left panel Memory `hidden md:block w-[300px]` (Memory.tsx:114) → tablet mất panel → đổi thành toggle/bottom-sheet thay vì biến mất.
3. Galaxy note panel `w-[min(440px,92%)]` (Galaxy.tsx:333) → mobile che màn → đổi thành **bottom-sheet** trượt dưới lên ở <640px.
4. Search bar `flex-1 sm:w-64 order-last` (Memory.tsx:101) → mobile xấu → xếp lại grid stat cards 2 cột ở sm.
5. `max-w-3xl` không có sm breakpoint (Memory/Galaxy) → thêm `w-full px-4` để không tràn ngang.
+ Bonus: 13 tab hơi nhiều → cân nhắc gom nhóm (Trí tuệ: Chat/Tinh hà/Memory/Personas · Việc: Tasks/Schedule/Projects/Workspace · Hệ thống: Logs/Settings/Aki/Draw/Dashboard) cho gọn nav.

---

## ĐỀ XUẤT TRIỂN KHAI (sau khi chủ nhân duyệt)

**Gói khuyến nghị (1 đợt opus, sau khi K4 xong + rehost):**
1. Gom tinh hà về 1 tab (bỏ khỏi Memory) + nút "xem trong tinh hà".
2. Layout tinh hà = **GLOBE (hướng A)** + auto-rotate + cluster lục địa.
3. Persona phân tầng Expert/Crew + nút "Hỏi expert".
4. Responsive pass: sidebar rail + bottom-sheet + bỏ width cứng.

Ước ~1-2 vòng opus. Mỗi thay đổi đều tsc+build gate trước khi rehost. KHÔNG đụng bridge.

**Cần chủ nhân quyết:** (1) kiểu sphere A/B/C, (2) có gom 13 tab thành nhóm không, (3) danh sách persona giữ/bỏ (nếu muốn dọn thật).
