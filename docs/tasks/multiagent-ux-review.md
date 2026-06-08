# Multi-Agent — Review UX/UI (góc nhìn engineer chạy project)

> Viết 2026-06-08. Reviewer áp chuẩn WCAG + heuristic UX (KHÔNG có skill UI/UX file thật trong `skills/` — chỉ `.gitkeep`).
> Mục đích: liệt kê điểm yếu để **Bill xem có thiếu sót gì không và bổ sung**, rồi mới biến thành task.
> Phạm vi soi: [Board.tsx](../../hub/web/src/components/Board.tsx) · [Channels.tsx](../../hub/web/src/components/Channels.tsx) · [App.tsx](../../hub/web/src/App.tsx) · [index.css](../../hub/web/src/index.css) · [tailwind.config.js](../../hub/web/tailwind.config.js).
>
> **Khen trước (đừng đập bỏ):** dark base hợp ngồi lâu · IA tốt (banner "cần bạn duyệt" ghim trên + Kanban theo status + drawer chi tiết) · pink "cần bạn" dùng tiết chế đúng · Channels theo pattern Discord trực giác. **Xương tốt — vấn đề là trang trí > rõ ràng, và contrast chữ phụ.**

---

## TC1 — Đã tiện chưa? Chưa thì tại sao?

| # | Điểm chưa tiện | Tại sao đau (engineer) | Bằng chứng |
|---|---|---|---|
| U1 ⭐ | **Không xem được agent chạy LIVE** | Card "đang chạy" chỉ hiện đồng hồ + câu "kết quả hiện khi xong stage". Không thấy claude -p đang nghĩ/làm gì → chờ mù. T2 (xterm.js live) đã spec mà chưa build | [Board.tsx:245](../../hub/web/src/components/Board.tsx#L245) |
| U2 ⭐ | **Không thấy worker nào chạy / local hay VPS** | Worker vô danh, UI không có khái niệm máy. Không biết local có online không, card đang chạy ở đâu | worker.ts không đăng ký |
| U3 | **Artifact chỉ là tóm tắt, không xem được diff thật** | Drawer hiện danh sách file + `git diff --stat`, KHÔNG có nội dung diff. Muốn review phải mò sang máy worker | [Board.tsx:284-298](../../hub/web/src/components/Board.tsx#L284) |
| U4 | **Card `failed` không có nút chạy lại** | Chỉ backlog→activate, waiting_human→approve/reject. Fail là nằm chết, phải xoá tạo lại | Board.tsx Detail thiếu retry |
| U5 | **Không sửa được brief/title sau khi tạo** | Gõ sai = xoá + tạo lại | drawer brief read-only |
| U6 | **Default pipeline = `course`** | Sai default cho engineer (course là cho Học Phòng content) | [Board.tsx:28](../../hub/web/src/components/Board.tsx#L28) |
| U7 | Poll 2s, không push (ws có sẵn `serve-ws.ts` nhưng Board/Channels không dùng) | Cảm giác trễ, agent post xong vài giây mới thấy | Board.tsx:44 |

## TC2 — Rào cản đánh giá / ẩn log? Đủ info + data visual flow chưa?

| # | Vấn đề | Tại sao | Bằng chứng |
|---|---|---|---|
| E1 ⭐ | **Output thật của claude bị giấu** | Chỉ hiện `outcome.summary` 1 dòng + handoff/report. Raw response parse JSON xong **vứt** → không có cách đánh giá chất lượng việc agent làm từ hub | runner.ts parse rồi bỏ raw |
| E2 ⭐ | **Không có trạng thái BUDGET trên UI** | Engine PAUSE khi chạm cap 5h/tuần, nhưng hub không có đồng hồ ngân sách. Card đứng im mà không rõ vì sao (pause? hay treo?) | budget.ts có, UI không vẽ |
| E3 ⭐ | **Không có sơ đồ FLOW phụ thuộc (DAG)** | "Song song vs nối tiếp" là trái tim của project, nhưng chỉ hiện chữ "Đang chờ: 2 task trước". Không có graph A→B→C / cây delegate. Đây đúng là "data visual flow" Bill hỏi mà đang thiếu | [Board.tsx:237](../../hub/web/src/components/Board.tsx#L237) |
| E4 | **Tiến độ pipeline không trực quan** | Card hiện chữ "stage: build", không có stepper setup→build→test→review / "3/5". Phải đọc timeline event thô | Board.tsx:180, 300-312 |
| E5 | Token in/out không hiện per-card (chỉ $); engine message màu #5e748b gần như tàng hình | khó soi chi phí chi tiết | Channels.tsx:7 |

## TC3 — UI dễ nhìn? Màu mè quá? Contrast ổn?

### 3a. Màu mè — CÓ, cyan bội thực + glow khắp nơi
Cyan `#3fd3ff` dùng cho: nav active, border hover, chip, status "working", nút primary (kèm glow), scrollbar, switch, brand, dot, link… **cộng** body có 2 radial-glow (cyan+green) + nhiều `box-shadow` glow tĩnh (btn glow, nav glow, brand textShadow, dot glow).
→ **Khi mọi thứ phát sáng, thứ CẦN chú ý không nổi.** Ngồi lâu mỏi mắt. Đây là "màu mè quá" Bill nghi.

**Sửa (ngân sách màu = ý nghĩa):**
- Glow/cyan đậm **chỉ** dành cho **đang sống/cần thao tác** (working pulse, cần-bạn). Chrome mặc định (border, chip, nav inactive) → **xám trung tính**, bỏ ám cyan.
- **Bỏ** radial-glow body + glow trang trí trên phần tử tĩnh (brand textShadow, btn-primary glow). Giữ glow chỉ ở: working spinner, pink cần-bạn.
- Giữ pink `#ff5d9e` cho cần-bạn (đang đúng — chú ý cao, dùng ít). Giữ green cho done.

### 3b. Contrast — có chỗ DƯỚI chuẩn
- `inkfaint #5e748b` trên `bg #05070e` ≈ **~4:1 < WCAG AA 4.5:1**, lại dùng cho chữ NHỎ 9–11px (timestamp, sub, danh sách file, diffstat, history). → **chữ phụ khó đọc thật**. [tokens](../../hub/web/tailwind.config.js#L17)
- Border `rgba(127,179,214,0.14)` quá mờ → cột/card Kanban tách nhau yếu, khó quét nhanh. Nâng alpha viền card, hoặc cho nền cột khác nhau nhẹ.
- `inkdim #9fb4c9` trên card ≈ 6:1 — ổn, giữ cho body.

### 3c. Khác
- **Quá nhiều cỡ chữ**: ~11 cỡ (9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 15px) → không có type-scale. Sàn 9–10px quá nhỏ cho dashboard. → gom còn 4–5 bậc, nâng sàn lên 11–12px cho chữ phải đọc.
- **Tracking rộng** trên label hoa nhỏ (0.14–0.32em) → đẹp sci-fi nhưng chậm đọc. Giảm tracking ở label nhỏ.
- **Emoji làm icon chính** (status/nav/event) → render lệch theo OS, kém "pro tool". Cân nhắc bộ icon mono (lucide) — không gấp, nhưng làm UI bớt "đồ chơi".

**Triết lý sửa UI:** từ "cockpit sci-fi phát sáng mọi chỗ" → "**dashboard kỹ thuật tối, trầm, màu = ý nghĩa**". Cyan chỉ cho live/active · pink chỉ cho cần-bạn · green chỉ cho done · 90% còn lại xám.

---

## Quyết định Bill 2026-06-08
1. **User = Bill (solo)**, có thể có người khác nhưng **ưu tiên trải nghiệm cá nhân**. → không cần hand-holding cho người lạ; tối ưu cho power-user.
2. **Đa nền tảng** (Telegram · dashboard · bất cứ đâu — theo VISION). **MỚI: muốn inject/setup để BẤT KỲ máy nào cũng cắm vào thành local worker cho Lucy.** → nâng Worker Fleet thành tâm điểm + thêm luồng onboarding "máy lạ join".
3. **DAG flow (E3): không ưu tiên** — có thì tốt, không gấp. → hạ UX-C.
4. **Live output (U1/E1): để phase Remote Control** (T2 xterm.js) — defer UX-A.
5. **UI calm-pass: DUYỆT** — giảm glow giữ chất dark-cyan, **screenshot cho Bill duyệt** trước khi áp.

## Task ứng viên (đã ưu tiên theo quyết định)
- **UX-B ⭐⭐ Worker Fleet + Join-anywhere** — worker danh tính (local/VPS, tên/chữ ký/icon) + heartbeat + card `assignTo` + **onboarding: 1 lệnh/inject để máy bất kỳ dial vào coordinator thành worker có tên** — U2. Cần coordinator reachable (deploy VPS + TLS, AGENT_MACHINE §8). ⚠️ kèm T5 security (máy lạ chạy claude bypassPermissions).
- **UX-E ⭐ UI calm-pass** — de-glow, contrast WCAG, type-scale, tracking — TC3. → screenshot Bill duyệt.
- **W1 ⭐ Lucy dự án parity** — [W1-lucy-project-parity.md](W1-lucy-project-parity.md) (quick win, độc lập).
- **UX-D** Diff viewer + retry + edit/sửa brief card — U3, U4, U5.
- **E2** Budget gauge trên UI (cap 5h/tuần + cảnh báo pause) — quan trọng để hiểu vì sao card đứng.
- **UX-F** (nhỏ) default pipeline hợp lý + ws push thay poll — U6, U7.
- ~~UX-A Live output~~ → defer Remote Control. ~~UX-C DAG~~ → không ưu tiên.
