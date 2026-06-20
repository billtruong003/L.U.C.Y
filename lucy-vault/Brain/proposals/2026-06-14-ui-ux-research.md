# Lucy Hub — Hướng đi thiết kế lại (UI/UX Research)

> Ngày: 2026-06-14 · Researcher: Lucy (UI/UX deep dive)
> Mục tiêu: Đề xuất hướng redesign cho web app "Lucy Hub" — command center của AI assistant cá nhân kiểu Jarvis (chạy 24/7, dùng qua Telegram + web Hub).
> Stack hiện tại: React + Vite + TS + Tailwind, 13 tab phẳng, galaxy 3D (three.js force-layout phân tán), sidebar 240px cứng, chưa responsive.

---

## Mục lục
1. [Pattern điều hướng cho app nhiều khu vực (chat-centric Jarvis HUD)](#1-pattern-điều-hướng)
2. [Visualize knowledge graph dạng SPHERE/GLOBE](#2-knowledge-graph-sphereglobe)
3. [Responsive cho dashboard nhiều panel (2025-2026)](#3-responsive-dashboard)
4. [Trình bày roster persona/agent có sức sống (RPG)](#4-roster-persona-rpg)
5. [TỔNG HỢP: 3 hướng thiết kế + khuyến nghị](#5-tổng-hợp--3-hướng-thiết-kế)
6. [Nguồn](#nguồn)

---

## 1. Pattern điều hướng

**Vấn đề:** 13 tab phẳng = quá nhiều cho một tab bar. Quy tắc IA chuẩn: tab bar chỉ hợp khi có **3–5 đích đến ngang hàng**; nhiều hơn thì chuyển sang sidebar có nhóm (grouped rail), accordion, hoặc command palette ([UXPin Mobile Nav](https://www.uxpin.com/studio/blog/mobile-navigation-examples/), [Eleken Tabs UX](https://www.eleken.co/blog-posts/tabs-ux), [Material 3 Nav Rail](https://m3.material.io/components/navigation-rail/guidelines)).

### 1a. Command Palette (Cmd+K) — BẮT BUỘC cho power-user
Đã thành chuẩn de-facto ở Linear, Raycast, Vercel, Figma, Notion, Slack. Cốt lõi là **combobox + fuzzy search + keyboard ergonomics**, rút ngắn đường đi, bỏ qua IA tuyến tính, và giúp **khám phá tính năng ẩn**. Raycast còn có "palette trong palette" (nested) cho contextual actions ([techinterview Cmd+K](https://www.techinterview.org/post/3233475212/build-command-palette-cmd-k/), [Mobbin Command Palette](https://mobbin.com/glossary/command-palette), [Philip Davis](https://philipcdavis.com/writing/command-palette-interfaces)).
→ **Áp dụng:** Cmd+K là "lối tắt vạn năng" — navigate tới bất kỳ tab nào, chạy task, hỏi Lucy, switch persona. Cho phép giảm số mục nav nhìn thấy mà không mất khả năng truy cập.

### 1b. Grouped Nav Rail (thay 13 tab phẳng)
Xu hướng thực tế: **Vercel** (26/02/2026) bỏ horizontal tabs → sidebar **resizable, ẩn được**, hợp nhất nav team + project ([Vercel changelog](https://vercel.com/changelog/dashboard-navigation-redesign-rollout)). **Arc** gom tab vào sidebar theo **"Spaces"** = container theo dự án ([Blake Crosley on Arc](https://blakecrosley.com/guides/design/arc)). Material khuyến nghị nav rail cho nav chính/phụ stack dọc, gom item theo nhóm có heading + active highlight ([Material 3](https://m3.material.io/components/navigation-rail/guidelines)).
→ **Gom 13 tab thành ~4-5 nhóm:**
- **Talk** → Chat, Personas
- **Knowledge** → Memory (galaxy), Workspace, Projects, Draw
- **Ops** → Dashboard, Tasks, Schedule, Neural
- **System** → Aki, Logs, Settings

### 1c. Chat-centric + Contextual panels (canvas/artifacts)
Mô hình AI chat trội hiện nay: chat là **cột giữa**, max-width ~65–72 ký tự/dòng (≈720–768px), line-height ~1.6 ([Setproduct AI chat anatomy](https://www.setproduct.com/blog/ai-chat-interface-ui-design)). Bố cục 2-3 pane chuẩn: **rail trái (thu thành icon) → message column → panel phải tùy ngữ cảnh (artifacts)**. Khuyến nghị quan trọng: panel artifacts **chỉ trượt ra khi có gì để show**, không thường trực — giữ message stream dễ đọc. Bản đồ vị trí AI trong UI: chat-centric vs copilot-sidebar vs canvas đều hợp lệ tùy use-case ([UX Collective — where should AI sit](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e), [aiuxplayground playbook](https://aiuxplayground.com/blog/ai-chat-playbook/)).

### 1d. Sự thật về "Jarvis HUD" (cảnh báo)
Phân tích FUI thật (Jayse Hansen, scifiinterfaces) chỉ ra: HUD Iron Man phần lớn là **spectacle**, không command-and-control thực; orbital/radial decoration gây **information overload + parallax**, JARVIS phải làm "bộ lọc chú ý". Nguyên tắc đúng của HUD dùng được: **attention management** (ẩn cái không quan trọng, escalate cái khẩn), **contextual awareness**, và **clarity over spectacle** (gần cockpit hơn là phim) ([scifiinterfaces Iron HUD](https://scifiinterfaces.com/tag/iron-hud/?order=asc), [liistudio Sci-Fi UI](https://liistudio.com/sci-fi-ui-design-inspired-by-films/)).
→ **Takeaway:** Làm "Jarvis vibe" qua **màu/motion/glow tiết chế + radial widget biết co giãn theo tier thông tin**, KHÔNG bằng cách rải panel khắp màn hình. Aesthetic là lớp da, không phải bộ xương.

---

## 2. Knowledge Graph — Sphere/Globe

**Mục tiêu chủ:** galaxy hiện force-layout phân tán → muốn **TỤ thành quả cầu sống động** (auto-rotate, cluster = lục địa).

### 2a. Tránh "hairball"
Đồ thị tốt = **cluster dày, kết nối thưa giữa cluster**, không phải nối tất-cả-với-tất-cả. Chỉnh **repel strength / link distance** để cluster tách bạch; force-layout nâng cao đẩy các "community" (modularity) ra xa nhau cho dễ đọc ([Obsidian graph mastery](https://medium.com/@lennart.dde/mastering-obsidians-graph-view-for-knowledge-management-f1bbe2c8f087), [InfraNodus PKM](https://infranodus.com/use-case/visualize-knowledge-graphs-pkm), [Nodus Labs 3D graph](https://noduslabs.com/featured/obsidian-3d-graph-view-plugin-with-network-science-insights/)).

### 2b. Kỹ thuật làm node TỤ lên mặt cầu — KHẢ THI với stack hiện tại
Library `3d-force-graph` của Vasco Asturiano (đã dùng three.js) hỗ trợ **`d3Force()`** để thêm/sửa lực, và `d3-force-3d` có **`forceRadial(radius, x, y, z)`** kéo node về mặt cầu bán kính cho trước, kết hợp **forceCollide 3D** để node không chồng ([3d-force-graph repo](https://github.com/vasturiano/3d-force-graph), [d3-force-3d](https://github.com/vasturiano/d3-force-3d), [3D Radial Force notebook](https://observablehq.com/@vasturiano/3d-radial-force), [Zdog graph on sphere](https://observablehq.com/@nhogs/zdog-3d-force-directed-graph-on-a-sphere)).
→ **Công thức "globe tri thức":**
1. Thêm `forceRadial(R)` (cùng R) cho TẤT CẢ node → ép lên một vỏ cầu.
2. Giữ `link`/`charge` yếu để node trượt trên vỏ thành cluster tự nhiên = **lục địa** (cluster theo type/tag, màu bằng `nodeAutoColorBy`).
3. Để **continents tách bạch**: gán mỗi cluster một "tâm hút" riêng (custom force kéo về một sector/anchor trên cầu), hoặc dùng nhiều `forceRadial` mục tiêu khác nhau theo nhóm.
4. **Auto-rotate** qua `cameraPosition()` quay quanh tâm + `zoomToFit()`. `dagMode('radialout')` là lựa chọn phụ cho cây phân tầng.

### 2c. Quy mô & lựa chọn lib
- `3d-force-graph`/three.js: đẹp, control cao, nhưng cần tối ưu thủ công ở graph lớn (InstancedMesh, LOD) ([Tom Sawyer three.js](https://blog.tomsawyer.com/advanced-techniques-in-threejs-graph-visualization)).
- **deck.gl / Graph.gl**: GPU-first, mượt ở 5k–10k+ node nếu sau này memory phình to ([deck.gl perf](https://deck.gl/docs/developer-guide/performance), [Cybergarden WebGL tools](https://cybergarden.au/blog/7-powerful-open-source-webgl-data-visualization-tools-2025)).
→ **Khuyến nghị:** Giữ `3d-force-graph` (đỡ rewrite), chỉ thêm `forceRadial` + clustering + auto-rotate. Chỉ cân nhắc deck.gl khi vượt vài nghìn node.

---

## 3. Responsive Dashboard

Best practice 2025-2026 ([Lovable](https://lovable.dev/guides/responsive-web-design-techniques-that-work), [UXPin responsive](https://www.uxpin.com/studio/blog/best-practices-examples-of-excellent-responsive-design/), [brand.dev dashboard](https://www.brand.dev/blog/dashboard-design-best-practices), [uicodenow container queries](https://uicodenow.in/responsive-design-in-2025-how-css-container/)):

- **Container queries** (~94% browser support, production-ready 12/2025): widget tự biết bề rộng container cha → tự chọn cách hiển thị. Lý tưởng cho dashboard widget tái dùng ở nhiều vị trí. Thay nhiều media query cứng.
- **Mobile-first**: bắt đầu từ màn nhỏ, ép chọn data thiết yếu → progressive enhancement lên desktop. Mobile chỉ show KPI quan trọng dạng card, giấu chart/table chi tiết vào tab/expandable.
- **Nav collapse**: mobile gom nav vào hamburger/drawer hoặc **bottom sheet**; tablet/desktop expand inline. Nav là phụ so với content trên mobile.
- **Bottom sheet** cho secondary controls + **CTA fixed** chỉ bật ở viewport nhỏ.
- **Fluid typography/spacing** bằng `clamp()` thay font/spacing cứng theo breakpoint.
- **Touch target ≥ 44×44px**.
→ **Sửa trực tiếp vấn đề chủ:** bỏ width cứng 240px → rail dùng `clamp()` + collapse thành icon; panel không "ẩn hẳn <768px" mà chuyển thành **bottom sheet / drawer**; mỗi panel galaxy/dashboard dùng container query để tự thu gọn.

---

## 4. Roster Persona (RPG)

**Vấn đề:** persona đang là card phẳng đều nhau = trông như trang trí. Chủ là game dev mê RPG-gamification → dùng ngôn ngữ game-UI.

Bài học từ game character-select UX ([Game UX RPG screen — Taliashvili](https://medium.com/@salvadortali/game-ux-creating-new-rpg-character-screen-for-a-console-game-7f8658cd4e14), [Char-select case study](https://medium.com/@TheDesignMechanic/game-ui-case-study-character-selection-optimization-c817be8bf905), [Game UI Database — Character Select](https://www.gameuidatabase.com/index.php?scrn=41), [Hero Selection UI Kit](https://www.figma.com/community/file/1555603680731959805/hero-selection-ui-kit)):

- Lỗi kinh điển của char-select: **visual hierarchy kém, feedback state mơ hồ, layout phẳng dàn đều** — đúng bệnh hiện tại của persona.
- Mục tiêu: tăng khám phá, chọn nhanh & tự tin, **làm rõ vai trò (role) từng nhân vật**.
- Card nhân vật nên có: **tên, class/role, lore ngắn, core stats, power color, progress/upgrade indicator, nút add-to-team**.
- **Party roster** xếp chồng bên cạnh, thứ tự stack = thứ tự lượt → truyền tải team-building.
→ **Áp dụng cho Lucy personas:**
- **Hero card** (không dàn đều): persona đang active = **hero lớn** (avatar to, aura/glow, "đang trực"), còn lại = thumbnail tier nhỏ.
- Mỗi card: avatar + **role tag** (vd "Tài chính", "Dev tooling", "Research") + **trạng thái live** (online/idle/đang chạy task) + mini-stats (số task, độ tin cậy routing BH-D).
- Gamification: tier/level theo lịch sử dùng, "active party" = persona đang bật.
- Tham khảo trực quan: **Game UI Database** (1300+ game, 55k screenshot, filter theo layout/genre) ([gameuidatabase.com](https://www.gameuidatabase.com/)).

---

## 5. Tổng hợp — 3 hướng thiết kế

### Hướng A — "Chat Cockpit" (chat-centric, contextual panels) ⭐ KHUYẾN NGHỊ
- **Bố cục:** 3 vùng. Trái = grouped nav rail (collapse thành icon). Giữa = **Chat là sân khấu chính** (max-width ~720px, full-width message, không bubble). Phải = **contextual panel trượt ra khi cần** (galaxy / dashboard số liệu / task pipeline / artifact) — không thường trực.
- **Nav:** Cmd+K vạn năng + rail gom 4-5 nhóm (Talk/Knowledge/Ops/System).
- **Galaxy:** mở trong panel phải hoặc full-screen overlay; sphere + auto-rotate; continents = cluster.
- **Persona:** hero card, active persona hiện ngay header chat (avatar + role + status).
- **Responsive:** rail→icon→hamburger; panel phải→bottom sheet trên mobile; container queries cho widget.
- **Ưu:** đúng "Jarvis vibe" thật (chat là não, panel là HUD theo ngữ cảnh), giảm rối, hợp xu hướng AI app 2026, ít rewrite (giữ three.js + tab cũ thành panel). **Nhược:** cần làm panel-orchestration (khi nào trượt cái gì). **Độ khó: Trung bình.**

### Hướng B — "Constellation OS" (galaxy làm trung tâm)
- **Bố cục:** galaxy/globe là **home screen**, mỗi cluster/lục địa = một khu vực (Tasks, Memory, Projects...); click vào "đáp xuống" mở panel khu vực; chat là dock/overlay luôn gọi được (Cmd+J).
- **Nav:** điều hướng chủ yếu bằng không gian 3D + Cmd+K.
- **Persona:** mỗi persona = một "ngôi sao/vệ tinh" quay quanh.
- **Ưu:** cực kỳ "sống động"/độc bản, đã thẳng wishlist galaxy của chủ. **Nhược:** 3D làm nav chính = rủi ro usability (như cảnh báo HUD spectacle), nặng, khó responsive trên mobile, learning-curve cao. **Độ khó: Cao.**

### Hướng C — "Console gọn" (grouped sidebar + dashboard truyền thống, ít rủi ro)
- **Bố cục:** sidebar nhóm (kiểu Vercel/Linear) + content area dạng dashboard widget responsive; chat là một tab/panel mạnh.
- **Nav:** sidebar nhóm + Cmd+K; galaxy là 1 view trong nhóm Knowledge (vẫn nâng lên sphere).
- **Persona:** hero card trong tab riêng.
- **Ưu:** an toàn, nhanh, responsive dễ, quen thuộc. **Nhược:** ít "wow", chưa đạt cảm giác Jarvis/RPG chủ muốn. **Độ khó: Thấp.**

### Khuyến nghị
**Hướng A — Chat Cockpit.** Nó cân bằng đúng 3 thứ chủ nêu: (1) chat-centric Jarvis HUD thật (chat = não, panel HUD theo ngữ cảnh — đúng nguyên lý attention-management của FUI dùng được, tránh bẫy "spectacle"); (2) gom 13 tab rối thành rail-nhóm + Cmd+K; (3) tái dùng galaxy three.js (chỉ thêm `forceRadial` + clustering + auto-rotate để thành globe) và nâng persona thành hero card — **không phải rewrite từ đầu**. Hướng B có thể làm **chế độ "Galaxy mode" tùy chọn** (full-screen) bên trong Hướng A để thỏa mãn khát khao constellation mà không hi sinh usability hằng ngày.

**Lộ trình gợi ý:** (1) Responsive fix + grouped rail + Cmd+K → (2) Galaxy sphere (forceRadial + cluster + auto-rotate) → (3) Persona hero card → (4) Contextual right-panel orchestration → (5) (tùy chọn) Galaxy mode toàn màn.

---

## Nguồn

**Nav / command palette / chat-centric**
- https://www.techinterview.org/post/3233475212/build-command-palette-cmd-k/
- https://mobbin.com/glossary/command-palette
- https://philipcdavis.com/writing/command-palette-interfaces
- https://vercel.com/changelog/dashboard-navigation-redesign-rollout
- https://blakecrosley.com/guides/design/arc
- https://m3.material.io/components/navigation-rail/guidelines
- https://www.uxpin.com/studio/blog/mobile-navigation-examples/
- https://www.eleken.co/blog-posts/tabs-ux
- https://www.setproduct.com/blog/ai-chat-interface-ui-design
- https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e
- https://aiuxplayground.com/blog/ai-chat-playbook/
- https://scifiinterfaces.com/tag/iron-hud/?order=asc
- https://liistudio.com/sci-fi-ui-design-inspired-by-films/

**Knowledge graph sphere/globe**
- https://github.com/vasturiano/3d-force-graph
- https://github.com/vasturiano/d3-force-3d
- https://observablehq.com/@vasturiano/3d-radial-force
- https://observablehq.com/@nhogs/zdog-3d-force-directed-graph-on-a-sphere
- https://medium.com/@lennart.dde/mastering-obsidians-graph-view-for-knowledge-management-f1bbe2c8f087
- https://infranodus.com/use-case/visualize-knowledge-graphs-pkm
- https://noduslabs.com/featured/obsidian-3d-graph-view-plugin-with-network-science-insights/
- https://blog.tomsawyer.com/advanced-techniques-in-threejs-graph-visualization
- https://deck.gl/docs/developer-guide/performance
- https://cybergarden.au/blog/7-powerful-open-source-webgl-data-visualization-tools-2025

**Responsive dashboard**
- https://lovable.dev/guides/responsive-web-design-techniques-that-work
- https://www.uxpin.com/studio/blog/best-practices-examples-of-excellent-responsive-design/
- https://www.brand.dev/blog/dashboard-design-best-practices
- https://uicodenow.in/responsive-design-in-2025-how-css-container/

**Persona / RPG roster**
- https://medium.com/@salvadortali/game-ux-creating-new-rpg-character-screen-for-a-console-game-7f8658cd4e14
- https://medium.com/@TheDesignMechanic/game-ui-case-study-character-selection-optimization-c817be8bf905
- https://www.gameuidatabase.com/index.php?scrn=41
- https://www.gameuidatabase.com/
- https://www.figma.com/community/file/1555603680731959805/hero-selection-ui-kit
