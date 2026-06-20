---
title: "Lucy Hub — UI Redesign EXECUTION (Chat Cockpit + Galaxy Sphere)"
date: 2026-06-14
author: Lucy
status: execution-plan
parent: 2026-06-14-ui-ux-research.md
---

# Lucy Hub — Redesign: đánh giá + direction + chia task

## 1. ĐÁNH GIÁ UI HIỆN TẠI (full)
- **Nav:** 13 tab phẳng (Dashboard/Chat/Workspace/Memory/Tasks/Schedule/Projects/Neural/Personas/Draw/Aki/Logs/Settings) — vượt xa quy tắc 3-5 mục, không phân tầng, khó quét. Chuyển tab bằng state + opacity fade (không router).
- **Tinh hà:** three.js (3d-force-graph) render Ở 2 NƠI (Memory.tsx + NeuralTab.tsx) → trùng, tốn GPU. Layout *lực đẩy phân tán* → như mây, không có hình khối. Time-travel (BH-B) re-filter node khi kéo → **nguy cơ lag**.
- **Persona:** 17 card phẳng dàn đều → nhìn như trang trí, không phân biệt expert dùng được vs thợ nội bộ.
- **Responsive:** sidebar `w-60` cứng + ẩn hẳn <768px; panel Memory `w-[300px]` ẩn hẳn tablet; galaxy panel `w-[440px]` che mobile; nhiều `max-w-3xl` không co. → vỡ trên màn nhỏ.
- **Điểm mạnh giữ lại:** thinking-UI/tool-card, multi-session chat, lane tool, dark theme, Tailwind sẵn.

## 2. DIRECTION CHỐT: "Chat Cockpit" (Hướng A từ deep-research)
Chat là trung tâm; quanh nó là HUD theo ngữ cảnh. Cụ thể:
- **Nav rail nhóm** (~4-5 nhóm) + **Cmd+K command palette** (nhảy nhanh mọi nơi, kiểu Linear/Raycast).
- **Tinh hà = quả cầu tri thức sống** (1 nhà duy nhất), mở như "mode"/panel.
- **Persona = roster kiểu RPG** (hero card + role + status), không phẳng.
- **Responsive thật**: rail co được, bottom-sheet thay panel-ẩn, container queries, bỏ width cứng.
- **Vibe Jarvis tiết chế**: đẹp qua màu/motion/glow, KHÔNG rải panel trang trí gây rối (cảnh báo từ research).

## 2b. SPEC ĐÚNG — "Thiên hà cầu" của chủ nhân (mô tả chuẩn, build bám cái này)

**Hình khối tổng:** một QUẢ CẦU LỚN = toàn bộ tri thức Lucy, mọi thứ nằm gọn bên trong (bounded).

**Cấu trúc bên trong (như globular cluster / chùm sao):**
- Bên trong là NHIỀU CỤM CẦU NHỎ ("trạm") rải trong THỂ TÍCH (cả trong lẫn ngoài, có density — dày ở tâm cụm, thưa ra rìa). Mỗi cụm = 1 zone/chủ đề.
- Mỗi cụm to/nhỏ theo lượng data (nhiều note → cầu to).
- **Lucy = trạm trung tâm ở lõi**, sáng nhất.
- Các cụm KHÔNG đè nhau, KHÔNG tràn ra ngoài quả cầu lớn.

**VẤN ĐỀ NẶNG = CÁCH NỐI (edges) — đây là chỗ đang lộn xộn:**
- Sai (hiện tại): vẽ HẾT mọi liên kết xuyên khắp quả cầu → đường thẳng cắt ngang loạn xạ = mạng nhện.
- ĐÚNG:
  1. **Nối chủ yếu LOCAL trong cụm** — node cùng cụm nối nhau bằng dây NGẮN nằm gọn trong cụm → mỗi cụm là 1 chòm sao có cấu trúc riêng. (Layout phải kéo node có-liên-kết về gần nhau trong cụm.)
  2. **Giữa các cụm chỉ vài CẦU NỐI chính** (1-2 đường đậm A↔B), không phải mọi node nối chéo.
  3. **Mặc định edge MỜ/ẨN**; chỉ sáng lên các đường liên quan khi hover/click 1 node hoặc 1 cụm (progressive disclosure).
  4. **Đường nối = cung cong mềm** (curved/bundled), KHÔNG phải đường thẳng cắt ngang quả cầu.

**Mắt thấy:** một quả cầu thiên hà; bên trong là các chòm sao (cụm) to nhỏ khác nhau, mỗi chòm có dây nối nội bộ gọn; vài cầu nối lớn giữa các chòm; Lucy sáng ở giữa; xoay chậm + glow + chiều sâu (fog). Sạch, có cấu trúc — không phải đống dây.

## 3. CHIA TASK (làm TỪNG CÁI MỘT — Bill thích focus)

### U1 — Galaxy SPHERE + RENDER PERF ⭐ (làm trước, chủ nhân nhấn mạnh) ✅ DONE 2026-06-14 · 🔄 volumetric 2026-06-14 · ✅ THIÊN HÀ CẦU (spec 2b) 2026-06-14

> **THIÊN HÀ CẦU (mặc định mới `galaxy`)** — làm đúng spec 2b:
> - **Layout `galaxyLayout3D` (viz3d.ts):** cụm cầu rải trong thể tích (∝ cbrt count), NHƯNG node có-liên-kết được KÉO LẠI GẦN bằng **force NỘI CỤM** (repulsion + lò xo intra-link, local trong sub-sphere, hub degree-cao hút về tâm cụm) → mỗi cụm là 1 chòm sao CÓ CẤU TRÚC, dây nội cụm NGẮN, không cắt ngang quả cầu. Lucy/core = lõi origin. 100% deterministic → tính 1 LẦN rồi FREEZE. Trả `{pos, info{center,local}}` để núm vặn rescale mà KHÔNG re-sim.
> - **Edges (B):** cung CONG mềm (`sampleArc` quadratic-bezier, lift ra ngoài tâm); intra=dây ngắn lift nhẹ, inter=chỉ giữ ≤2 cầu nối chính/cặp-zone (primary), còn lại ẩn tới khi hover. Shader edge per-vertex alpha (`EDGE_VERT/FRAG`) → **mặc định MỜ/ẨN**; hover 1 node → node+láng giềng+cạnh chạm SÁNG, phần còn lại mờ (progressive disclosure). Recall focus & time-travel cũng chỉ ghi alpha (rẻ).
> - **Núm vặn LIVE (panel ⚙️ góc phải dưới, localStorage):** khoảng-cách-cụm · density · ẩn/hiện+opacity edge · glow · fog · size node · tốc độ xoay + nút **copy config**. clusterDist/density rescale O(n) (không re-sim); còn lại đổi uniform/uniform fog/autoRotateSpeed.
> - **Perf giữ nguyên:** layout FREEZE, time-travel chỉ đổi visibility+alpha (geometry cung giữ nguyên), rAF throttle, pause auto-rotate khi kéo, LOD label.
> - Flag revert: `?galaxy=volume` (cầu đặc cũ) · `?galaxy=shell` (vỏ-cầu) · `?galaxy=disk` (đĩa). tsc web+server sạch, build OK (index-BS7dHm-9.js), lucy-hub deployed, bridge KHÔNG đụng. ⏳ chờ chủ nhân mở Hub chỉnh panel → gửi config chốt mặc định.
> **VOLUMETRIC (mặc định mới):** `volumeLayout3D` (viz3d.ts) — quả cầu ĐẶC R=130: node lấp đầy CẢ thể tích (không chỉ vỏ). Cluster theo zone = sub-sphere rải TRONG thể tích (tâm golden-angle + bán kính cbrt-volumetric), bán kính sub-sphere ∝ cbrt(count) → cụm nhiều data thì TO. Node trong cụm = điểm 3D trong ball (hash deterministic, expo 0.62 → dày về tâm cụm). Hub degree-cao lerp về lõi (origin), core=origin. BOUNDED: clamp node trong R*0.97, sub-sphere không tràn + 24 iter repulsion tâm-cụm (rẻ). 100% deterministic → tính 1 LẦN rồi FREEZE (giữ nguyên perf U1: time-travel chỉ đổi visibility, rAF throttle, pause auto-rotate, LOD label).
> Flag revert: `?galaxy=shell` (vỏ-cầu cũ `sphereLayout3D`) · `?galaxy=disk` (đĩa cũ `forceLayout3D`). tsc web+server sạch, build OK, lucy-hub deployed (bundle index-oMPi6YlU.js), bridge KHÔNG đụng.
>
> _(cũ) Layout `sphereLayout3D`: node lên VỎ cầu R=132, cluster zone→lục địa golden-angle, hub kéo vào lõi. Sim 150 iters rồi FREEZE. Time-travel `applyFilter()` chỉ đổi `p.visible`. Slider throttle rAF, pause auto-rotate khi kéo/orbit. LOD label camera>300._

- Layout: `forceRadial(R)` ép node lên vỏ mặt cầu; cluster theo tag/topic = vùng bề mặt ("lục địa"); node hub = lõi; auto-rotate chậm; glow nhẹ; click vùng → zoom.
- **RENDER PERF (bắt buộc, đây là yêu cầu cứng):**
  1. Force sim chạy 1 lần tới settle (cooldownTicks/alphaMin) rồi **FREEZE** — không re-sim mỗi frame.
  2. **Kéo thanh time-travel CHỈ đổi visibility/opacity** node+edge theo timestamp — TUYỆT ĐỐI không re-layout/re-sim (đây là nguồn lag chính).
  3. Throttle slider qua requestAnimationFrame; tạm dừng auto-rotate khi đang kéo.
  4. Giảm tải: ẩn label khi camera xa, giới hạn/đơn giản hoá edge, material rẻ, (cân nhắc) instancing.
  5. Mục tiêu: kéo slider mượt ~60fps với 300+ node.
- Giữ time-travel hoạt động; flag revert layout cũ.

### U2 — Gom tinh hà về 1 tab
Bỏ `<Galaxy/>` khỏi Memory.tsx (Memory về duyệt file/note nhẹ); tinh hà chỉ ở tab Neural (đổi tên "Tinh hà"); Memory thêm nút "xem trong tinh hà →" nhảy focus node.

### U3 — Nav nhóm + Cmd+K
Gom 13 tab → ~4-5 nhóm (Trí tuệ / Việc / Hệ thống...); thêm command palette Cmd+K search-to-jump.

### U4 — Responsive pass
Sidebar rail co (full→icon→drawer); panel ẩn → bottom-sheet; bỏ width cứng (300/440/max-w-3xl) → fluid `clamp()` + container queries.

### U5 — Persona roster RPG
Hero card cho persona (avatar/role/status/stats); tách Expert (gọi được) vs Crew nội bộ; bỏ grid phẳng.

## 4. CÁCH EXECUTE
- **Tuần tự U1 → U5**, mỗi task: auto-build opus 1-2 vòng → tsc + build web sạch → rehost → chủ nhân xem → mới qua task sau.
- Mỗi task có **flag/feature-toggle** để revert nếu lệch gu.
- KHÔNG restart bridge. Mỗi task xong em báo Telegram + (nếu hợp) ảnh/mô tả để chủ nhân duyệt vibe.
- Bắt đầu: **U1 (galaxy sphere + perf)**.
