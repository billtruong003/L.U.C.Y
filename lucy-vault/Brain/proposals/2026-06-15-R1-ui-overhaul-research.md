---
title: "R1 — Lucy Hub UI Overhaul: Deep Research & Design Proposal"
date: 2026-06-15
type: proposal
status: research-complete (no code touched)
theme_locked: "Jarvis Cockpit (glass-minimalism + hover-reveal, cyan #22d3ee + gold #f5b54a, dark #05070e, Inter + JetBrains Mono)"
constraint: "VPS 1.9GB RAM; client render must stay light; galaxy/timeline drag must not lag"
---

# R1 — Lucy Hub UI Overhaul: Deep Research & Design Proposal

> Mục tiêu: nghiên cứu nhiều nguồn (đối chiếu, không bịa, KHÔNG sửa code) → ra đề xuất thiết kế cho đợt "đại tu UI toàn diện" của Lucy Hub. Tài liệu này là **đầu vào để đợt SAU execute**. Mọi claim đều có nguồn ở cuối bài; chỗ nào nguồn yếu/không kiểm chứng được đều ghi rõ.

## Mục lục
1. [Bối cảnh & tiêu chí đánh giá](#1-bối-cảnh--tiêu-chí-đánh-giá)
2. [Q1 — Bố cục "Chat Cockpit" cao cấp 2026](#2-q1--bố-cục-chat-cockpit-cao-cấp-2026)
3. [Q2 — FUI/HUD Jarvis đẹp mà không slop](#3-q2--fuihud-jarvis-đẹp-mà-không-slop)
4. [Q3 — Trình bày từng khu của Lucy](#4-q3--trình-bày-từng-khu-của-lucy)
5. [Q4 — Glassmorphism + minimalism + hover-reveal + mobile + perf](#5-q4--glassmorphism--minimalism--hover-reveal--mobile--perf)
6. [Q5 — Figma & AI design-to-code: có nên dùng không?](#6-q5--figma--ai-design-to-code-có-nên-dùng-không)
7. [Q-perf — Galaxy nhẹ trên client yếu (three.js/3d-force-graph)](#7-q-perf--galaxy-nhẹ-trên-client-yếu-threejs3d-force-graph)
8. [Q6 — Tổng hợp: 3 hướng đại tu + khuyến nghị](#8-q6--tổng-hợp-3-hướng-đại-tu--khuyến-nghị)
9. [Roadmap thực thi (chia task cho đợt SAU)](#9-roadmap-thực-thi-chia-task-cho-đợt-sau)
10. [Rủi ro & độ tin cậy nguồn](#10-rủi-ro--độ-tin-cậy-nguồn)
11. [Nguồn](#11-nguồn)

---

## 1. Bối cảnh & tiêu chí đánh giá

Lucy Hub = command center cho AI assistant cá nhân kiểu Jarvis (React + Vite + TS + Tailwind + three.js). Chủ nhân = game dev / technical artist (Unity/VR/shader), mê RPG-gamification, đồng thời dùng làm trợ lý tài chính (crypto/vàng/CK). Theme **đã chốt** ("Jarvis Cockpit") không bàn lại — nghiên cứu này chỉ tìm cách **thực thi theme đó cho đẹp + dùng được + nhẹ**.

Tiêu chí xuyên suốt rút ra từ nghiên cứu (mọi đề xuất bên dưới bám 4 cái này):
- **Progressive disclosure** là nguyên lý meta lặp lại ở mọi khu: bề mặt overview gọn → drill xuống chi tiết, không đổ hết một lúc (NN/g).
- **Mỗi hiệu ứng glow/animation phải map vào dữ liệu/trạng thái thật** — glow = tín hiệu, không phải trang trí. Đây chính là lằn ranh "FUI đẹp vs AI slop".
- **Chrome dịu, focus sáng**: nav/khung làm tối/giảm tương phản để vùng chat/work nổi lên (Linear).
- **Nhẹ theo mặc định**: no-motion-first, blur tiết chế, galaxy render-on-demand — vì client yếu + theme nhiều hiệu ứng.

---

## 2. Q1 — Bố cục "Chat Cockpit" cao cấp 2026

Đối chiếu sản phẩm thật:

- **Linear** — "inverted-L chrome": sidebar trái + header trên bọc vùng nội dung lớn (list/board/timeline/split/fullscreen). Side panel = nơi chứa metadata/properties (bề mặt riêng, KHÔNG phải nội dung chính). Refresh gần đây cố ý làm sidebar **dịu/tối hơn** để work area "lên ngôi", đồng thời tăng hierarchy + density của nav. Cmd+K là xương sống hành động; `/` lọc view; phím đơn thao tác trên item. [linear-redesign], [linear-refresh], [logrocket-linear]
- **Raycast** — command-first: hotkey → gõ ý định → kết quả tức thì. AI Extensions biến tool đã cài thành "tool" mà model tự chọn + chạy. Bề mặt built-in là **context-aware** (đọc trang đang mở, lịch, clipboard). Design system gò bó vài component chuẩn (List/Grid/Detail/Form) để mọi bề mặt nhất quán. [hackdesign-raycast], [raycast-ai-ext], [raycast-ui]
- **Arc / Dia** — sidebar dọc (tab thành list quét được); Dia coi **tốc độ tương tác sidebar gần-tức-thì là mục tiêu cứng**. Arc "Spaces" = mỗi khu giữ state riêng (pinned tab/favorites/theme/history). Dia đặt **AI là lõi, không phải add-on**: trợ lý sidebar đọc nội dung đang xem để tóm tắt/so sánh/hoàn tất task. [dia-vertical-tabs], [arc-ends], [arc-vs-dia]
- **Perplexity** — chat-centric + nguồn/threads là first-class. Chi tiết craft: cột giữa **~720px max-width**; auto-scroll chỉ khi gần đáy (trong 100px), nếu không thì khóa + hiện nút nổi "Jump to latest". [uxdi-perplexity], [setproduct-chat]
- **Cursor** — 3-pane cố định (sidebar / editor / **AI chat phải**); chat hiểu context project, đính kèm file/doc/lỗi làm context; agent/plan/run là **first-class object** trong sidebar; Tiled Layout chia pane theo session agent. [prismic-cursor], [cursor-changelog]
- **Warp** — "Blocks": mỗi cặp input+output là 1 element gom được/copy/share được; **composer neo đáy** ("user luôn biết gõ ở đâu"); AI phải opt-in, minh bạch (hiện lệnh sinh ra), dismiss bằng 1 phím; gợi ý AI inline. [starlog-warp], [blakecrosley-warp], [warp-terminal]
- **Vercel dashboard** — project-as-filter (1 click đổi scope toàn trang), mobile floating bottom bar; triết lý "tôn trọng thời gian dev, tránh đường". Pattern observability: **Activity Feed** (event stream theo thời gian) + **Console Panel** gom log/lỗi, đẩy real-time qua WebSocket. [vercel-dashboard], [medium-vercel], [deepwiki-vercel-obs]

Galleries (xác nhận tồn tại + đúng category, nhưng KHÔNG fetch được shot cụ thể → dùng làm điểm browse, không cite design lẻ): Mobbin (thư viện AI app + Chat Bot screens), Dribbble (concept "ai dashboard"), Awwwards (stream Film/TV/Game Interfaces FUI/HUD — sát "arc-reactor/hud-ring" nhất), Godly.website, Cosmos.so (không verify được specifics). [mobbin-chat], [mobbin-ai], [dribbble-ai], [awwwards-fui], [godly]

### 5 pattern áp được cho Lucy
1. **Inverted-L chrome, nav dịu + chat trung tâm sáng.** Khớp với `.glass` chrome tối vs focus gold của ta. [linear-refresh]
2. **HUD panel phải, context-aware, chỉ hiện khi liên quan.** History rail trái · chat giữa cap ~720–768px · panel phải cho artifact/nguồn/context (hiện động, gập khi không cần) — pattern thống trị của Claude/ChatGPT/Perplexity/Cursor. [setproduct-chat]
3. **Cmd+K + composer neo đáy = 2 trục input bổ sung.** Một cho lệnh/điều hướng (Linear), một cho hội thoại (Warp). [logrocket-linear], [blakecrosley-warp]
4. **Blocks/sessions là đơn vị địa-chỉ-hóa + 1 HUD Activity sống.** Mỗi exchange là 1 block (Warp), mỗi agent/task là first-class trong sidebar (Cursor), kèm Activity Feed + Console real-time (Vercel) cho biết Lucy đang làm gì. [starlog-warp], [cursor-changelog], [deepwiki-vercel-obs]
5. **"Spaces" giữ state riêng + sidebar assistant context-aware, perf sidebar là yêu cầu cứng.** Đúng mô hình Arc/Dia, khớp ràng buộc render-perf của ta. [arc-vs-dia], [dia-vertical-tabs]

---

## 3. Q2 — FUI/HUD Jarvis đẹp mà không slop

Nguồn mạnh nhất: **Jayse Hansen** (chính người thiết kế HUD Iron Man). Cốt lõi nghề của FUI là **trông cực phức tạp nhưng đọc tức thì** ("look super complex, but super clear at the same time"); phải **grounded vào thiết bị thật** (anh tham vấn phi công, nghiên cứu màn hình buồng lái) nếu không sẽ "cheesy/Playskool"; **mọi element phải truyền tin, không trang trí**. [postperspective-hansen], [vfxer-hansen]

Phê bình "vì sao FUI thành slop": Amber Case — designer nhầm "hình ảnh tạo cho kịch tính tối đa" thành "giải pháp khả thi/đáng dùng"; cái "ngầu trong phim" thường "frustrating, distracting, convoluted" khi dùng thật; form-over-function cho ra cảm giác "sterile/showroom". Bài 80s sci-fi (TheNextWeb, snippet): UI dở = "đồ họa nhấp nháy không chỉ điều gì có nghĩa"; fix là **tiết chế** (Star Wars iconic vì "really minimal"). [amber-case], [tnw-80s]

Cảnh báo từ chính HUDS+GUIS: FUI phim "thường không thực dụng/không có chức năng" (làm khớp diễn xuất sau quay) → coi là **cảm hứng, không phải spec để bê nguyên**. [hudsandguis]

Ràng buộc usability/a11y cứng (định lượng):
- **Glass + text**: glass trong suốt → tương phản chỗ đạt chỗ fail; phải có lớp fill bán-mờ sau text, đạt WCAG (4.5:1 body, 3:1 large/UI). Cho user nút giảm transparency/tăng contrast. [nng-glass], [axesslab-glass]
- **Motion**: build **no-motion-first**, tôn trọng `prefers-reduced-motion`; loop/parallax/flashing liên tục gây chóng mặt/buồn nôn/migraine (vestibular, ADHD). [webdev-motion], [mdn-a11y-media]
- **Flash**: không quá **3 lần/giây** (WCAG 2.3.1); đỏ bão hòa bị siết chặt hơn → cẩn thận arc-reactor/alert màu đỏ. [w3c-flash]

### DO / DON'T cho Jarvis-FUI tử tế
**DO:** mỗi glow/animation map vào data/state thật · grounded vào dụng cụ thật · arc-reactor + HUD ring là **1 điểm nhấn hero duy nhất** (xung quanh để calm) · glass tiết chế trên nền đơn giản/tối · fill bán-mờ sau text + check ≥4.5:1 ở nền xấu nhất · monospace dành cho data thật (metric/tọa độ/status) · no-motion-first + honor reduced-motion · giữ flicker dưới 3/s · cho toggle "reduce effects".

**DON'T:** thêm flashing/particle/ring không đại diện gì (đây là lằn ranh slop) · bê nguyên FUI phim (làm cho 1-giây kịch tính, không cho làm việc bền) · để text trôi trên nền bận/động · chạy loop full-strength cho mọi user · để bloom/glow nuốt contrast · để chrome chôn data thật.

Một dòng chốt: **Jarvis tử tế = 1 hero accent grounded (reactor/ring) + motion truyền state thật + glass tiết chế trên nền calm + monospace cho data thật, tất cả gate sau contrast-check, reduced-motion, và giới hạn 3-flash.**

---

## 4. Q3 — Trình bày từng khu của Lucy

### 4.1 Knowledge Galaxy (graph tri thức)
- **Mặc định mở view cục bộ/focus, KHÔNG hairball toàn vault**: note đang mở + 1–2 hop, hoặc kết quả search; full galaxy là opt-in. Graph full mất tác dụng điều hướng quá ~200 note, hairball chắc chắn quá ~500 (ngưỡng là opinion cộng đồng, không phải nghiên cứu).
- **Là bề mặt điều hướng, không phải đồ trang trí**: search box first-class, click-to-focus, filter (tag/type/recency/status). Mã hóa nghĩa qua kích thước node (độ quan trọng/degree) + màu (type/cluster); label cắt ngắn + tooltip. Điểm yếu kinh điển của Obsidian/Roam graph là chỉ hiện topology mà thiếu thông tin vận hành → thêm status/độ-cũ làm chiều màu/filter là cái lật nó từ gimmick thành tool.
- **Cluster/aggregate trên vài trăm node** (combo gập được + LOD: bong bóng cluster khi zoom out, node/label khi zoom in).
- Perf: xem mục 7. [cambridge-large], [codeculture-obsidian]
- *Bất đồng nguồn*: defenders (Eleanor Konik) thấy giá trị bắt orphan/gap, nhưng giá trị tụ ở view nhỏ/cục bộ/đã lọc.

### 4.2 Persona Roster (RPG party)
- **Master–detail**: grid card personas ("party") + panel hero/detail cho cái đang chọn — khớp dashboard multi-agent thật (mỗi agent là 1 card có tên/role/status) + pattern master-detail kinh điển.
- **Card gọn**: avatar + tên + 1 role label (mã màu) + status indicator + 1 action. Phần còn lại ("character sheet") nằm ở detail panel.
- **Character sheet là UI thật**: role/capability dễ đọc, gom card/token thay vì bảng số dày, feedback chọn rõ để giảm time-to-select.
- Phủ affordance agent lên khung RPG: detail panel chứa status sống + nút override/pause + tín hiệu confidence nhị phân (cao/thấp, không %), không chỉ lore. [agentsroom], [webapphuddle-md]
- *Guardrail*: tránh gamification vì-gamification (NN/g: tránh badge-spam/leaderboard ép). RPG framing dựa vào nguồn game/character-sheet riêng.

### 4.3 Dashboard (token cost / thị trường tài chính)
- **Băng trên = hero zone F-pattern cho KPI toàn cục**: metric card lớn (spend hôm nay, MTD, budget còn, giá trị portfolio), quan trọng nhất top-left; mỗi card có delta vs kỳ trước + sparkline. Giới hạn KPI at-a-glance ~5–9.
- **Gom thành block khái niệm** (token/cost một cụm, market một cụm), tách bằng whitespace + chrome card nhất quán (tiêu đề top-left, date picker top-right, legend đáy). IA quan trọng hơn việc thêm chart.
- Usage/cost theo thời gian: sparkline trong card + 1 line/bar chart chính + 1 toggle range (MTD/QTD/YTD/rolling-12mo) + variance hiện cả tuyệt-đối lẫn %, cờ RAG (đỏ/hổ phách/xanh) khi over-budget.
- **Chart khai thác preattentive**: bar (có thứ tự) + line; tránh pie/donut/gauge/3D. Mặc định ít, drill để xem nhiều. Market: xanh-lên/đỏ-xuống + candlestick/line. [pencilpaper-dash], [nng-preattentive], [aiaccountant-budget]
- *Căng thẳng*: trend 2026 "dense trở lại" vs progressive disclosure — hòa giải: density OK **nếu** hierarchy/grouping mạnh.

### 4.4 Task Pipeline (task AI đang chạy/chờ)
- **Kanban gom theo status là bề mặt sống chính** (Queued → Running → Done/Failed) + đếm cột để liếc thấy tải. Activity feed = stream phụ "vừa xảy ra gì". Timeline/Gantt = để xem lịch sử.
- **Mỗi state có chi tiết cụ thể, không bao giờ chỉ spinner**: Queued hiện vị trí + ETA; Running hiện progress thật + bước hiện tại ("step 4/6"); Done tóm tắt output; Failed cho lý do cụ thể + action khôi phục. Mã màu xanh/hổ phách/đỏ.
- **Khớp progress với thời lượng**: percent cho op >10s, ít nhất indicator động cho >1s (NN/g heuristic #1: visibility of system status) để báo còn sống, tránh re-click.
- Xử lý kết quả hỗn hợp rõ ràng ("20 ok, 3 fail, 5 skip") + retry-failed-only. Run agent phân nhánh → workflow graph mã màu đọc tốt hơn list phẳng. [logrocket-async], [nng-status], [nng-progress]

### 4.5 MCP Connections / integrations
- **Grid card chia "Connected" và "Available"**. Mỗi MCP server = 1 card (logo/icon + tên + 1 dòng mô tả + status badge). Card thắng table vì item nhận-diện-bằng-logo và user browse chứ không so dày thuộc tính.
- **Status rõ + action per-card**: ~3–5 thuộc tính max + status badge (Connected / Disconnected / Error-needs-reauth). 1 primary action (Connect, hoặc Manage/Disconnect); action phụ (revoke, reconnect, view permissions) sau kebab top-right.
- Theo convention đã có: Vercel marketplace (filter category sidebar + search, tách installed-vs-marketplace, dialog detail/install) + OAuth connected-apps (luôn thấy Manage → Revoke). Thêm search + filter + empty-state "action card" để connect inline. [uxpatterns-cards], [patternfly-card], [vercel-integrations], [oauth-revoke]

### 4.6 Skills (thư viện năng lực)
- **Grid card đồng nhất trên cột nhất quán** (12-col → ~4-col mobile, base 8px), quy tắc 1 chiều-cao-card — cắt overflow thay vì để card cao thấp lệch (layout lệch gây quét bán-ngẫu-nhiên — NN/g).
- **Card tối giản**: icon + tên + 1 dòng mục đích + 1 tín hiệu tin cậy (badge official, tag category, lượt dùng) + toggle bật. Chi tiết ở listing/detail (progressive disclosure).
- **Toggle bật/tắt hiệu lực tức thì** (không bước confirm), phân biệt ON/OFF mạnh (sáng/xanh vs xám trung tính) + label "Enabled/Available" + contrast ≥4.5:1.
- **Phân biệt enabled vs available bằng grouping + state, không ẩn**: section "Enabled" trên cùng hoặc filter chip; làm mờ item không tương thích (~38% opacity, Material disabled) để đọc là trơ-mà-vẫn-thấy. Search bar nổi bật + 3–5 filter chính, advanced sau expander. [nng-grids], [lowcode-marketplace], [eleken-toggle], [aspirity-marketplace]

---

## 5. Q4 — Glassmorphism + minimalism + hover-reveal + mobile + perf

### 5.1 Glassmorphism + a11y — bài học Apple
Apple ra "Liquid Glass" (WWDC 2025), bị chê nặng (khó đọc, mỏi mắt), phải **tăng opacity trước khi launch tháng 9**, rồi iOS 26.1 thêm toggle tăng opacity/contrast + "Reduce Bright Effects". Bài học: ngay cả Apple cũng không làm trong-suốt-khắp-nơi đọc được mặc định → **glass là điểm nhấn trang trí có lối thoát, không phải bề mặt mặc định cho text**. [apple-newsroom], [tomsguide-liquidglass], [macrumors-transparency], [phonearena-liquidglass]

**DO**: fill solid/bán-mờ sau text (≥4.5:1 body, 3:1 large/UI) · support `prefers-reduced-transparency` + `prefers-contrast` (đổi sang nền đặc) · border/shadow để glass vẫn đọc là bề mặt tương tác · test contrast hiệu dụng đa điều kiện (nắng/tối, OLED/LCD, dark mode, zoom, screen reader) · dành glass cho chrome/nav/overlay trên nền tĩnh ít biến thiên.
**DON'T**: text body trên blur của ảnh/video/gradient động · dùng transparency để truyền state · ship glass không có fallback đặc · tin "qua contrast checker 1 lần" (checker test nền tĩnh, glass thì nền động). [axesslab-glass], [nng-glass], [newtarget-glass]

### 5.2 Perf của blur / backdrop-filter
Blur là **convolution**: mỗi pixel output đọc nhiều pixel input → cost tỉ lệ với **diện tích × bán kính** blur. Cost rơi vào **GPU/compositor client** (RAM VPS chỉ ảnh hưởng build/serve), và client yếu chính là nơi nhiều lớp blur gây jank. [chrome-animblur]

**DO**: bán kính khiêm tốn (~≤20px) · giới hạn **số lớp blur đồng thời** (heuristic blog: ~3–5 trên mobile — coi là trần mềm, không phải mục tiêu) · blur vùng nhỏ có biên (nav/card) thay vì full-viewport · nếu animate blur thì **đừng animate bán kính** — precompute vài bản (1/2/4/8px) rồi cross-fade bằng opacity (rasterize blur lên parent để cache) · `will-change` chỉ ngay trước animation rồi gỡ (nó ghim GPU memory) · dùng CSS `contain` chặn reflow lan ra ngoài panel · profile bằng DevTools Performance + Paint Flashing.
**DON'T**: backdrop-filter trên element lớn/full-screen hay stack nhiều · animate bán kính per-frame · để `will-change` vĩnh viễn · quên gotcha: parent có opacity<1/filter/mask/clip-path/mix-blend-mode/will-change thành "backdrop root" → backdrop-filter của con blur rỗng · giả định support phổ quát (backdrop-filter mới Baseline từ 9/2024 → cần fallback nền đặc, trùng luôn với đường reduced-transparency). [chrome-animblur], [mdn-backdrop], [f22-css], [openreplay-blur]

### 5.3 Hover-reveal / progressive disclosure + mobile
NN/g: tối đa **2 cấp** disclosure (sâu hơn user lạc); trigger phải đặt thấy được + label rõ (information scent); staged disclosure chỉ cho bước tuần tự độc lập. Ràng buộc cứng: **hover không tồn tại trên touch** → hover không bao giờ được là cách duy nhất tới nội dung/action thiết yếu. [nng-progressive], [smashing-hover]

**DO**: gate hiệu ứng hover sau `@media (hover: hover) and (pointer: fine)` · trên touch để nội dung tương đương **luôn hiện** (hoặc tap-to-reveal) — hover-reveal là enhancement, không phải cơ chế truy cập · ghép hover với `:focus`/`:focus-within` cho bàn phím · tap target ≥~48px + `@media (any-pointer: coarse)` thêm spacing · trigger reveal hiện rõ + label · `aria-expanded` trên toggle · ≤2 cấp.
**DON'T**: giấu action/nội dung thiết yếu sau hover-only tooltip/menu · tin `(hover:hover)` = "desktop" (hybrid laptop touch + chuột bị phân loại sai → design touch-first làm baseline) · ưu tiên JS UA-detect hơn CSS media query · vượt 2 cấp / stage bước phụ thuộc nhau. [smashing-hover], [css-tricks-interaction], [mdn-any-pointer]

### 5.4 Minimalism vs density
Đừng chọn minimalist *vs* dense — **dày ở chỗ user là chuyên gia thao tác nhanh**, dùng grouping/hierarchy/spacing giữ density đọc được; quản density high-level → drill-down (chính là progressive disclosure). [freshconsulting-density], [logrocket-density]

---

## 6. Q5 — Figma & AI design-to-code: có nên dùng không?

**Figma cho design tokens**: pipeline chuẩn 3 chặng = define token trong Figma (Variables / Tokens Studio) → transform bằng Style Dictionary → import vào Tailwind. Tokens Studio mạnh (24 loại token, sync GitHub). Nhưng các nguồn ủng hộ đều scope lợi ích vào **"khi sync design↔dev quan trọng cho team/codebase lớn"** — đúng cái lợi ích mà solo dev **không có**. [tokens-studio-docs], [figmafy], [nicolalazzari], [figma-devmode]

**AI design-to-code (2025–26)**: phát hiện lặp ở MỌI nguồn — mọi tool đạt **~70–75%**, 30% cuối (a11y, semantic HTML, khớp design-system, dọn 20–40% CSS phình) là **~80% công sức**. v0 (Vercel) tốt nhất cho React/Next + Tailwind/shadcn, chat-iterate, nhưng credit cháy nhanh + a11y lọt. Builder.io Visual Copilot match codebase qua CLI. Locofy nhanh. Anima map component sẵn có. Figma Make build "primitive hơn", và **không tool nào thực sự hỗ trợ design system**. [skywork-v0], [sixtythirtyten], [figma-make]

**Code-first vs Figma-first cho solo dev**: lập luận code-first mạnh nhất là **Tailwind v4 `@theme`** — biến chính file CSS thành single source of truth (token định 1 lần, sinh utility + lộ CSS variables, theming runtime không rebuild). Cộng **shadcn/ui** (component sống trong repo, theme hoàn toàn qua CSS-variable token) → solo dev đã có design system thật, versioned, type-checked **không cần Figma trong vòng lặp**. [tailwind-v4], [tailwind-theme], [shadcncraft]

### KHUYẾN NGHỊ (cho solo game-dev/technical-artist này)
**Đi code-first. Lấy Tailwind v4 `@theme` + CSS variables làm single source of truth, đặt shadcn/ui lên trên, dùng AI design-to-code như máy phát (generator) — KHÔNG dùng Figma làm system of record.** Lý do: (1) token pipeline của Figma chỉ đáng giá cho sync team — solo không có; (2) Tailwind v4 đã cho sẵn thứ Figma token định cung cấp, native trong code, version-controlled, không bước export; (3) AI tool nào cũng cap ~70–75% và bạn làm 30% cuối kiểu gì cũng vậy → tối ưu cho generator gần stack nhất (**v0** để scaffold rồi tự polish trong repo). **Chỉ thêm Figma** nếu sau này có cộng tác viên/designer, cần khám phá layout mới fidelity cao trước khi code, hoặc cần artifact trình bày; khi đó Tokens Studio + Style Dictionary là cầu nối đã được kiểm chứng (chạy ngược: import CSS variables hiện có vào Figma để code vẫn là source of truth).

---

## 7. Q-perf — Galaxy nhẹ trên client yếu (three.js/3d-force-graph)

Lưu ý: RAM VPS 1.9GB chỉ ảnh hưởng build/serve; render là client-side GPU/main-thread. Các điểm dưới nhắm client.

**3d-force-graph (lib):**
- **Đóng băng layout engine nhanh** — đừng để sim chạy mãi: `warmupTicks` + `cooldownTicks(0)` (hoặc `cooldownTime` ngắn) để layout không tick khi kéo timeline. Galaxy lớn/tĩnh: `warmupTicks(300).cooldownTicks(0)` để snap thẳng tới layout đã settle, render 1 lần. [forcegraph-gh], [forcegraph-i27]
- `pauseAnimation()` đóng băng render loop — NHƯNG caveat: nó cho ảnh tĩnh, mất zoom/pan, không hợp lúc kéo (chỉ dùng khi thật sự muốn frame đông cứng). [forcegraph-i479]
- `enablePointerInteraction(false)` nếu không cần hover/click per-node — README nói tắt cái này cho throughput tối đa. [forcegraph-gh]
- Giảm `nodeResolution` (default 8) + `linkResolution` (default 6) + `nodeRelSize` — galaxy điểm sáng không cần sphere mượt.
- **Ngưỡng**: user report tụt mạnh sau ~7k element, OOM WebGL ở 100k+ (báo cáo user, không phải benchmark maintainer). Cân nhắc bản **2D canvas** (react-force-graph-2d, interface gần như y hệt) cho case rất lớn/yếu. [forcegraph-i223], [forcegraph-i202], [reactforcegraph-gh]

**three.js chung:**
- **Draw call là đòn bẩy chính** — instancing/batching giảm 90%+ (con số blog, rule of thumb). Caveat: InstancedMesh KHÔNG luôn nhanh hơn (issue mở: chậm hơn shared-geometry mesh ở ~5000 sphere) → benchmark trước; cho galaxy điểm, 1 object `Points` thắng cả hai. [utsubo-threejs], [three-i30352]
- Cap `pixelRatio = Math.min(devicePixelRatio, 2)`. [discoverthreejs]
- Ít/không direct light, **không shadow**; ưu tiên emissive/additive. [discoverthreejs]
- Built-in MSAA thay vì post-process FXAA/SMAA. Tránh UnrealBloom (full-screen post pass) — fake bloom bằng additive Points + sprite glow / fresnel shader. [discoverthreejs], [tympanus-dissolve], [kadekeith-glow]
- **Render-on-demand** (đòn lớn nhất cho graph tương tác): three.js manual liệt kê "3d graph generator" là ứng viên render-on-demand — render 1 lần rồi chỉ render khi có change event (controls change/resize/data/input). 3d-force-graph tự pause redraw khi sim halt — nhưng custom animated `nodeThreeObject` phá cái đó. [threejs-ondemand], [forcegraph-gh]
- Dispose geometry/material/texture khi unmount (rò rỉ nếu tab galaxy mount/unmount nhiều). Share material; đừng tạo object trong render loop; toggle `.visible` thay vì add/remove. [discoverthreejs], [utsubo-threejs]

**Low-end client:** fallback 2D Canvas/SVG khi không có WebGL; detect device class để hạ texture/tắt shadow/blur/particle; **lazy-load cả scene 3D theo brain tab** (đừng import three.js tới khi mở tab). [webglfundamentals-mem], [pixelfreestudio-webgl], [utsubo-threejs]

**Galaxy đẹp mà rẻ:** body galaxy = 1 `THREE.Points` (1 BufferGeometry, 1 draw call); animate trong vertex shader, không mutate vertex trên CPU (Three.js Journey "Animated galaxy" là tham chiếu chuẩn); glow = additive blending trên sprite/points, nhẹ hơn postprocessing. [tympanus-gpgpu], [threejs-journey-galaxy], [tympanus-dissolve]

---

## 8. Q6 — Tổng hợp: 3 hướng đại tu + khuyến nghị

### Hướng A — "Cockpit 3 cột" (an toàn, sản-phẩm-thật)
- **Layout**: inverted-L. Nav dọc trái (Spaces, dịu) · cột giữa = chat cap ~720–768px + composer neo đáy + Cmd+K · panel HUD phải context-aware (artifact/nguồn/Activity Feed, hiện-động gập-được).
- **Nav**: vertical Spaces giữ state riêng + Cmd+K xương sống.
- **Galaxy/Persona/Dashboard**: là Spaces riêng; galaxy mở local-view, lazy-load.
- **Persona**: master-detail (grid card → character sheet).
- **Dashboard**: KPI band trên + block token/market.
- **Responsive**: nav xuống bottom bar (kiểu Vercel mobile), panel phải thành sheet trượt, hover→tap.
- Ưu: quen thuộc, ít rủi ro, khớp trực tiếp Linear/Cursor/Perplexity. Nhược: ít "wow" Jarvis nếu hero làm nhạt.

### Hướng B — "Reactor Hub" (Jarvis-forward)
- **Layout**: trang chủ là **HERO arc-reactor** (lõi reactor + vài HUD ring xoay chậm = launcher trung tâm); click vào từng cung mở Space (galaxy/persona/dashboard/tasks/skills/connections). Vào trong Space thì về layout calm 3 cột (như A).
- **Nav**: reactor như radial menu + Cmd+K; ring = trạng thái hệ thống thật (token, task đang chạy, market — glow map data).
- **Galaxy**: là 1 "cung" của reactor, vào full mới render nặng.
- **Persona**: party đứng quanh reactor như character-select.
- **Ưu**: bản sắc Jarvis mạnh nhất, đúng gu game-dev. **Nhược**: dễ trượt vào slop nếu ring/particle không map data; rủi ro perf cao nhất (phải no-motion-first + render-on-demand nghiêm).

### Hướng C — "Command Surface phẳng" (tối giản, perf-first)
- **Layout**: gần như chỉ chat + Cmd+K; mọi khu (galaxy/dashboard/...) là overlay/panel gọi từ command palette, không chiếm chỗ thường trực.
- **Nav**: Cmd+K là gần như duy nhất; ít chrome nhất.
- **Galaxy**: chỉ load khi gọi; 2D fallback mặc định trên máy yếu.
- **Ưu**: nhẹ nhất, calm nhất, hợp client yếu. **Nhược**: ít hero Jarvis; khu giàu hình (galaxy/dashboard) bị giấu, kém "trưng bày".

### ⭐ KHUYẾN NGHỊ: **Hướng A làm xương + mượn 1 liều B cho trang chủ** ("A+")
- Dùng **Cockpit 3 cột (A)** làm khung làm-việc mọi nơi (calm, đã được sản phẩm thật chứng minh, dễ responsive).
- Làm **1 trang chủ/landing kiểu Reactor (B)** — arc-reactor + HUD ring **chỉ ở đây**, mỗi ring/glow map vào 1 metric thật (token/task/market), no-motion-first + honor reduced-motion. Đây là "hero Jarvis" tập trung 1 chỗ, tránh slop khắp app.
- **Galaxy/Dashboard/Persona** trình bày như mục 4; galaxy luôn lazy-load + cool-down nhanh + 2D fallback.
- Giữ **C làm kỷ luật xuyên suốt**: blur tiết chế, render-on-demand, mọi hero gập được — để không hi sinh perf.
- Lý do chọn A+: tối đa bản sắc Jarvis ở **1 bề mặt hero kiểm soát được**, còn vùng work bám pattern đã chứng minh + ràng buộc perf cứng của ta. Cân bằng "đẹp vs dùng được vs nhẹ" tốt nhất trong 3 hướng.

---

## 9. Roadmap thực thi (chia task cho đợt SAU)

**Phase 0 — Nền tảng token & kỷ luật (không Figma)**
- E0.1 Khai báo design tokens trong Tailwind v4 `@theme` (cyan/gold/dark + spacing), bắt đầu hẹp (màu + spacing) rồi mở rộng. Map class hiện có `.glass/.hover-reveal/.num/.arc-reactor/.hud-ring` về token.
- E0.2 Thêm `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` làm switch toàn cục + 1 toggle "reduce effects" trong settings.
- E0.3 Audit contrast: fill bán-mờ sau mọi text-on-glass, đảm bảo ≥4.5:1 ở nền xấu nhất.

**Phase 1 — Khung Cockpit (Hướng A)**
- E1.1 Inverted-L: nav dọc Spaces (dịu) + header + work area.
- E1.2 Chat trung tâm cap ~720–768px + composer neo đáy + auto-scroll "jump to latest".
- E1.3 Cmd+K palette (điều hướng + action) — đối chiếu cái đã có.
- E1.4 HUD panel phải context-aware (artifact/nguồn/Activity Feed), hiện-động + gập.
- E1.5 Responsive: bottom bar mobile, panel phải → sheet, hover→tap (`@media hover/pointer`).

**Phase 2 — Trang chủ Reactor (liều B)**
- E2.1 Arc-reactor hero + HUD ring **map metric thật** (token/task/market); no-motion-first.
- E2.2 Radial entry vào các Space; verify dưới 3-flash + reduced-motion.

**Phase 3 — Đại tu từng khu (mục 4)**
- E3.1 Galaxy: local-view mặc định, lazy-load, `warmupTicks+cooldownTicks(0)`, `enablePointerInteraction` on-demand, Points + additive glow, 2D fallback, dispose-on-unmount.
- E3.2 Persona: master-detail (card party → character sheet + status/override).
- E3.3 Dashboard: KPI band F-pattern + block token/market + sparkline + RAG + time-range toggle.
- E3.4 Task pipeline: kanban theo status + chi tiết state + progress đúng thời lượng + retry-failed-only.
- E3.5 MCP: grid card Connected/Available + status badge + revoke/manage.
- E3.6 Skills: grid card đồng nhất + toggle hiệu-lực-tức-thì + enabled/available bằng grouping.

**Phase 4 — Perf hardening & QA**
- E4.1 Profile DevTools (Paint Flashing, draw calls), cap pixelRatio=2, giảm số lớp blur.
- E4.2 Test máy yếu thật + touch device; kiểm timeline drag không lag.
- E4.3 A11y pass: screen reader, keyboard, contrast đa điều kiện, reduced-motion.

**(Tùy chọn) Tooling**: dùng v0 để scaffold màn mới rồi polish trong repo; chỉ thêm Figma nếu có cộng tác viên.

> Thứ tự gợi ý: Phase 0 → 1 → 3 (song song được giữa các khu) → 2 → 4. Phase 0 phải xong trước vì mọi thứ sau bám token + a11y switch.

---

## 10. Rủi ro & độ tin cậy nguồn

- **Nguồn mạnh (fetch full)**: NN/g (glassmorphism, progressive disclosure, preattentive, status/progress, grids), Jayse Hansen (postPerspective), Amber Case, Chrome for Developers (animated blur), MDN, Apple Newsroom + Tom's Guide/MacRumors (Liquid Glass walk-back), Tailwind docs, three.js manual + discoverthreejs, 3d-force-graph README/issues.
- **Nguồn yếu / chỉ snippet (đánh dấu trong bài)**: galleries Mobbin/Dribbble/Godly/Cosmos (xác nhận platform/category, không cite shot lẻ); TheNextWeb 80s (403, snippet); một số Medium/Figma blog (403/cert); ngưỡng "7k element / 100k OOM" của force-graph (user report, không benchmark maintainer); "3–5 blur đồng thời" và "<100 draw call / 90%+" (heuristic blog); WebGPU "~70%" (dự phóng 2026 blog).
- **Bất đồng đã ghi**: graph view full có hữu ích không (defenders vs critics → giá trị tụ ở view cục bộ/đã lọc); minimalism vs density (hòa giải bằng grouping/hierarchy); InstancedMesh không phải luôn nhanh hơn (benchmark trước).
- **Không sửa code** trong đợt nghiên cứu này (đúng yêu cầu). Mọi item roadmap là đề xuất cho đợt SAU.

---

## 11. Nguồn

### Q1 — Chat cockpit layout
- [linear-redesign] https://linear.app/now/how-we-redesigned-the-linear-ui
- [linear-refresh] https://linear.app/now/behind-the-latest-design-refresh
- [logrocket-linear] https://blog.logrocket.com/ux-design/linear-design/
- [hackdesign-raycast] https://www.hackdesign.org/toolkit/raycast/
- [raycast-ai-ext] https://manual.raycast.com/ai/ai-extensions
- [raycast-ui] https://developers.raycast.com/api-reference/user-interface
- [dia-vertical-tabs] https://alternativeto.net/news/2025/7/vertical-tabs-and-faster-sidebar-interaction-now-available-in-dia-browser/
- [arc-ends] https://www.theregister.com/2025/05/27/arc_browser_development_ends/
- [arc-vs-dia] https://supasidebar.com/blog/arc-browser-vs-dia-browser
- [uxdi-perplexity] https://www.uxdesigninstitute.com/blog/perplexity-ai-and-design-process/
- [setproduct-chat] https://www.setproduct.com/blog/ai-chat-interface-ui-design
- [prismic-cursor] https://prismic.io/blog/cursor-ai
- [cursor-changelog] https://cursor.com/changelog/2-3
- [starlog-warp] https://starlog.is/articles/ai-agents/warpdotdev-warp
- [blakecrosley-warp] https://blakecrosley.com/guides/design/warp
- [warp-terminal] https://www.warp.dev/modern-terminal
- [vercel-dashboard] https://vercel.com/changelog/dashboard-navigation-redesign-rollout
- [medium-vercel] https://medium.com/design-bootcamp/vercels-new-dashboard-ux-what-it-teaches-us-about-developer-centric-design-93117215fe31
- [deepwiki-vercel-obs] https://deepwiki.com/vercel-labs/agent-browser/7.5-observability-dashboard
- [mobbin-chat] https://mobbin.com/explore/web/screens/chat-bot
- [mobbin-ai] https://mobbin.com/explore/mobile/app-categories/ai
- [dribbble-ai] https://dribbble.com/search/ai-dashboard
- [awwwards-fui] https://www.awwwards.com/inspiration/the-martian-ui-reel
- [godly] https://godly.website/

### Q2 — FUI/HUD Jarvis
- [postperspective-hansen] https://postperspective.com/behind-title-artist-jayse-hansen/
- [vfxer-hansen] https://www.vfxer.com/vfx-inspiration-jayse-hansenthe-avengers-iron-man-hud-tutorials/
- [amber-case] https://modus.medium.com/why-sci-fi-is-bad-for-design-8805e093cc4d
- [tnw-80s] https://thenextweb.com/news/80s-sci-fi-movies-can-teach-us-bad-ui
- [hudsandguis] https://www.hudsandguis.com/fui
- [nng-glass] https://www.nngroup.com/articles/glassmorphism/
- [webdev-motion] https://web.dev/learn/accessibility/motion
- [mdn-a11y-media] https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility
- [w3c-flash] https://www.w3.org/TR/UNDERSTANDING-WCAG20/seizure-does-not-violate.html
- [pixflow-hud] https://pixflow.net/blog/how-to-add-futuristic-hud-elements-to-your-sci-fi-footag/

### Q3 — Trình bày từng khu
- [cambridge-large] https://cambridge-intelligence.com/blog/visualize-large-networks/
- [cambridge-ux] https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/
- [codeculture-obsidian] https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful
- [agentsroom] https://agentsroom.dev/multi-agent-dashboard
- [webapphuddle-md] https://webapphuddle.com/master-detail-ui-pattern-design/
- [rpgnarco-sheet] https://rpgnarco.com/designing-the-character-sheet-of-the-future/
- [designmechanic-charselect] https://medium.com/@TheDesignMechanic/game-ui-case-study-character-selection-optimization-c817be8bf905
- [nng-gamification] https://www.nngroup.com/videos/gamification-user-experience/
- [pencilpaper-dash] https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards
- [nng-preattentive] https://www.nngroup.com/articles/dashboards-preattentive/
- [aiaccountant-budget] https://www.aiaccountant.com/blog/budget-versus-actual-dashboard-guide
- [logrocket-async] https://blog.logrocket.com/ux-design/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/
- [nng-status] https://www.nngroup.com/articles/visibility-system-status/
- [nng-progress] https://www.nngroup.com/articles/progress-indicators/
- [uxpatterns-cards] https://uxpatterns.dev/pattern-guide/table-vs-list-vs-cards
- [patternfly-card] https://www.patternfly.org/patterns/card-view/design-guidelines/
- [vercel-integrations] https://vercel.com/docs/integrations
- [oauth-revoke] https://www.oauth.com/oauth2-servers/listing-authorizations/revoking-access/
- [nng-grids] https://www.nngroup.com/articles/using-grids-in-interface-designs/
- [lowcode-marketplace] https://www.lowcode.agency/blog/marketplace-app-ui-ux-design-best-practices
- [eleken-toggle] https://www.eleken.co/blog-posts/toggle-ux
- [aspirity-marketplace] https://aspirity.com/blog/marketplace-ux-design

### Q4 — Glass / blur / hover-reveal
- [axesslab-glass] https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/
- [newtarget-glass] https://www.newtarget.com/web-insights-blog/glassmorphism/
- [ixdf-glass] https://ixdf.org/literature/topics/glassmorphism
- [apple-newsroom] https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/
- [tomsguide-liquidglass] https://www.tomsguide.com/phones/iphones/ios-26-1-lets-you-adjust-liquid-glass-transparency-on-your-iphone-heres-how-to-do-it
- [macrumors-transparency] https://www.macrumors.com/how-to/ios-reduce-transparency-liquid-glass-effect/
- [phonearena-liquidglass] https://www.phonearena.com/news/liquid-glass-was-so-bad-that-apple-will-give-you-another-way-to-tone-it-down_id178795
- [chrome-animblur] https://developer.chrome.com/blog/animated-blur
- [mdn-backdrop] https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/backdrop-filter
- [f22-css] https://www.f22labs.com/blogs/how-css-properties-affect-website-performance/
- [openreplay-blur] https://blog.openreplay.com/creating-blurred-backgrounds-css-backdrop-filter/
- [nng-progressive] https://www.nngroup.com/articles/progressive-disclosure/
- [smashing-hover] https://www.smashingmagazine.com/2022/03/guide-hover-pointer-media-queries/
- [mdn-any-pointer] https://developer.mozilla.org/en-US/docs/Web/CSS/@media/any-pointer
- [css-tricks-interaction] https://css-tricks.com/interaction-media-features-and-their-potential-for-incorrect-assumptions/
- [freshconsulting-density] https://www.freshconsulting.com/insights/blog/ui-ux-principle-52-manage-data-density-high-level-to-low-level/
- [logrocket-density] https://blog.logrocket.com/balancing-information-density-in-web-development/

### Q5 — Figma & design-to-code
- [tokens-studio-docs] https://docs.tokens.studio/
- [figmafy] https://figmafy.com/figma-variables-to-code-tokens-to-tailwind-css-vars/
- [nicolalazzari] https://nicolalazzari.ai/articles/integrating-design-tokens-with-tailwind-css
- [figma-devmode] https://www.figma.com/blog/everything-you-need-to-know-about-dev-mode/
- [skywork-v0] https://skywork.ai/blog/vercel-v0-dev-review-2025-ai-ui-react-tailwind/
- [sixtythirtyten] https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026
- [figma-make] https://www.figma.com/solutions/prompt-to-app/
- [tailwind-v4] https://tailwindcss.com/blog/tailwindcss-v4
- [tailwind-theme] https://tailwindcss.com/docs/theme
- [shadcncraft] https://shadcncraft.com/docs/figma/v2/variables

### Q-perf — three.js / galaxy
- [forcegraph-gh] https://github.com/vasturiano/3d-force-graph
- [forcegraph-i27] https://github.com/vasturiano/3d-force-graph/issues/27
- [forcegraph-i479] https://github.com/vasturiano/3d-force-graph/issues/479
- [reactforcegraph-gh] https://github.com/vasturiano/react-force-graph
- [forcegraph-i223] https://github.com/vasturiano/react-force-graph/issues/223
- [forcegraph-i202] https://github.com/vasturiano/react-force-graph/issues/202
- [threejs-ondemand] https://threejs.org/manual/en/rendering-on-demand.html
- [discoverthreejs] https://discoverthreejs.com/tips-and-tricks/
- [utsubo-threejs] https://www.utsubo.com/blog/threejs-best-practices-100-tips
- [three-i30352] https://github.com/mrdoob/three.js/issues/30352
- [webglfundamentals-mem] https://webglfundamentals.org/webgl/lessons/webgl-qna-why-does-webgl-take-more-memory-than-canvas-2d.html
- [pixelfreestudio-webgl] https://blog.pixelfreestudio.com/webgl-in-mobile-development-challenges-and-solutions/
- [tympanus-gpgpu] https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/
- [tympanus-dissolve] https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/
- [threejs-journey-galaxy] https://threejs-journey.com/lessons/animated-galaxy
- [kadekeith-glow] https://kadekeith.me/2017/09/12/three-glow.html
