# ☀️ Morning handoff — đêm 2026-06-14/15

## Đêm nay chạy gì
Runner tự động (auto-build opus, pm2 `lucy-autobuild`, tối đa 14 task) làm TUẦN TỰ qua 3 mặt trận, mỗi task tsc/smoke gate + báo Telegram + KHÔNG đụng bridge, KHÔNG phá data:
- **UI**: U2 gom tinh hà 1 tab · U3 nav nhóm + Cmd+K · U4 responsive · U5 persona roster RPG.
- **M2 Tay/MCP**: M2.1 framework · M2.2 core no-auth (filesystem/fetch/git) · M2.3 basic-memory · M2.4 GitHub scaffold · M2.5 Google/Notion scaffold. (plan: `docs/M2-MCP-EXECUTION.md`)
- **M3 Tự học**: M3.1 SKILL.md+store · M3.2 loader · M3.3 self-improve (chỉ đề xuất) · M3.4 seed skills. (plan: `docs/M3-SELFLEARN-EXECUTION.md`)

`overnight-rehost.sh` chờ runner xong → tsc-gate → build web → rehost (no bridge) → báo Telegram "chào buổi sáng".

## CHỦ NHÂN CẦN LÀM SÁNG (để bật "tay" M2 — phần cần creds)
1. **GitHub**: `gh auth login` hoặc thêm `GITHUB_TOKEN=...` vào `/root/lucy/.env.llm` → bật flag GitHub MCP.
2. **Google (Gmail/Calendar/Drive)**: chạy OAuth 1 lần (bấm `authenticate` MCP claude.ai, hoặc theo DOC trong M2-MCP-EXECUTION.md) → bật flag Google.
3. **Notion** (nếu dùng): `NOTION_TOKEN=...`.
→ Các phần này đêm chỉ SCAFFOLD sẵn, chưa bật (không tự auth được khi chủ nhân ngủ).

## Kiểm tra nhanh sáng
- `pm2 list` — services online?
- `grep 'vòng' /root/lucy/auto-build.log | tail -20` — task nào DONE/skip.
- Hub hard-refresh (Ctrl+Shift+R) xem nav mới + persona roster + galaxy.
- Lỗi tsc giữa đêm → watcher KHÔNG rehost, báo Telegram; xem `rehost.log`.

## ⭐ "M3.6" — 2 TASK DEEP-RESEARCH (KHÔNG execute) — SAU runner 6 nhóm, nếu KHÔNG hold token
> Chủ nhân chốt (2026-06-15): sau T5/T6, làm **2 task DEEP RESEARCH MẠNH** (dùng skill deep-research) — **CHỈ nghiên cứu + ra ý tưởng/đề xuất, KHÔNG sửa code/execute**. Output = report + design proposals để chủ nhân duyệt; execute là đợt SAU (riêng).
> **R1) Research đại tu UI toàn diện:** audit full web hiện trạng (sau 6 nhóm) + research sâu → đề xuất design HOÀN TOÀN MỚI cho cả web (trên nền Jarvis Cockpit). Ra mockup/ý tưởng, KHÔNG code.
> **R2) Research khai thác JINA sâu (song song — `Brain/claude-memory/jina-potential-roadmap.md`):** ⭐#2 omni đa phương thức (index mockup/screenshot/tech-art → search bằng chữ, phục vụ thiết kế UI) + #1 reranker + #3 reader/search API + #4 classifier + #5 matryoshka. Ra đề xuất cách khai thác, KHÔNG code.
> - 2 cái nghiên cứu SONG SONG vì bổ trợ nhau. Coi như phase **M3.6 (research)** — KHÁC tab "Kỹ năng" trong T6.
> - Điều kiện: runner 6 nhóm DONE + token không hold (hold → chờ quota).
> - Việc nhỏ dọn khi rảnh: sửa comment "dim 1024"→768 trong `agent-machine/src/embed.ts` (~dòng 47).

## Chưa đụng (chờ chủ nhân quyết)
- Multi-device session (auth) · Phase 3-4 memory apply (LUCY_CONSOLIDATE_APPLY) · reviewer-spec wire/xoá · tab Kết nối/Kỹ năng UI (M2.7/M3.5 nếu hết giờ).
