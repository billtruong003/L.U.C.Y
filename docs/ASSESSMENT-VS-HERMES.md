# Đánh giá Lucy (sau A+B+C) vs Hermes — TUYỆT ĐỐI, không bias

> **Viết lại 2026-06-13.** Bản trước bias (chấm "theo quy mô Lucy" để bơm điểm — sai). Đây là so TUYỆT ĐỐI:
> Hermes là framework agent *production, đa nền tảng, đã chiến trận nhiều năm*; Lucy là trợ lý cá nhân *mới vài tuần*,
> vừa MƯỢN một số pattern của Hermes ở dạng MVP. Thang 1-10 (10 = state-of-the-art thực thụ).
> Số thật: Hermes ~7.150 test · 190+ contributor · 30+ subsystem · cli.py ~621KB. Lucy 92 file TS (~9.660 LOC, 37 smoke,
> 5 đỏ) · Hub 31 file · bridge 563 LOC.

---

## Sự thật nền: Hermes hơn Lucy RÕ RỆT, không phải sát nút
Hermes có: provider declarative + credential rotation + rate-guard + **context compressor + trajectory compressor** +
**batch multiprocessing + checkpoint** + cron scheduler + **gateway đa nền (Telegram/Discord/WhatsApp/Weixin)** + **ACP +
MCP ecosystem + plugins** + skill-learning **có curator-at-scale** + FTS5 **có lineage + bookends** + prompt-caching **đã
đo giảm 26%** + ~7.150 test. Lucy có phiên bản MVP của ~một-nửa danh sách đó, phần lớn NÔNG hơn, và THIẾU HẲN: context
compression, batch/checkpoint, MCP, ACP, multi-platform gateway, trajectory, plugin system, curator-at-scale.

---

## 1. CORE / Lõi — Hermes 9.5 · Lucy 5
Lucy sau A+B+C có: multi-model chat, smart-routing, thinking, rate-guard, cred-pool, quota, quality-first, brain-per-agent,
dream, triage, verify-gate, token-guard, FTS5 recall, cache-parity. NGHE nhiều, NHƯNG mỗi cái là **MVP 1 vòng**: rate-guard
mới file-lock cơ bản (Hermes có cross-session + amplification math); FTS5 chưa lineage/bookends; cache-parity *vừa sửa, chưa
đo*; chưa có context-compression (phiên dài là TRÀN). Hermes lõi sâu + hardened + phủ thứ Lucy chưa chạm. **Khoảng cách lớn.**

## 2. CLEAN CODE / Test — Hermes 8.5 · Lucy 6
Lucy code sạch-để-đọc (module nhỏ, strict TS, comment tại-sao) — đây là điểm Lucy ổn thật. NHƯNG test: **37 smoke unit-ish,
5 đang ĐỎ, không CI gate** vs Hermes **~7.150 test có CI**. Về kỷ luật kiểm thử Hermes vượt xa (gấp ~190× số test, phủ
edge-case như think_scrubber per-delta, credits schema-version). Lucy "sạch nhưng mỏng"; Hermes "to nhưng phủ kín".

## 3. STRUCTURE / Kiến trúc — Hermes 9 · Lucy 6.5
Lucy thắng đúng 1 điểm: **không có file monolith** (max 834 LOC) → dễ onboard. Nhưng kiến trúc Hermes *đã chứng minh ở
quy mô lớn*: đa-process, đa-nền-tảng, plugin, ACP/MCP, batch — Lucy chưa kiểm chứng ở tải thật, phạm vi hẹp (1 người, 1-2
kênh). Monolith của Hermes là nợ-đọc, KHÔNG phải nợ-năng-lực. Năng lực kiến trúc Hermes trên cơ Lucy nhiều bậc.

## 4. UI / UX — Hermes(webui) 8 · Lucy 6.5
Lucy Hub **đẹp/giàu thị giác hơn** (BrainViz/Mindmap/Galaxy/Board kanban — React) — điểm cộng thật về thẩm mỹ. NHƯNG về
UX-công-năng Hermes hơn hẳn: **SSE streaming** (chữ chạy realtime — Lucy còn request-response 1 phát), **composer footer**
(đổi model/persona/context-ring tại chỗ), **card thinking/tool/approval** inline, **workspace panel** (cây file + sửa +
git), **session mgmt** (rename/archive/pin/tag/cost), **voice**, **11 theme**, **mobile**. Lucy đẹp-nhưng-tĩnh; Hermes
xấu-hơn-nhưng-sống + phủ luồng làm-việc-thật.

---

## TỔNG (tuyệt đối): Hermes ~8.8 · Lucy ~6
**Hermes hơn Lucy rõ rệt ở MỌI chiều trừ "đẹp thị giác" và "dễ đọc code".** Hai cái Lucy thắng là *thật nhưng nhỏ* so với
chênh-lệch core/test/UX-công-năng/ecosystem. Lucy mới đi ~60-65% chặng đường tới một "Hermes thu nhỏ" — và đó đã là tiến
bộ tốt cho vài tuần, nhưng KHÔNG nên tự nhận ngang ngửa.

## Lucy thực sự thắng ở đâu (đừng phóng đại, nhưng có thật)
- **Dễ đọc/sửa:** không file 600KB → 1 người maintain được, đổi nhanh.
- **Thẩm mỹ Hub:** đồ-thị-tri-thức (Galaxy/Mindmap/BrainViz) đẹp hơn webui.
- **Hợp đúng 1 người:** không gánh nặng multi-tenant/đa-nền Lucy chưa cần.

## Lucy thua rõ nhất → nhợp làm tiếp (xếp theo gap)
1. **Context compressor** — Hermes có, Lucy KHÔNG → phiên dài tràn ctx. Gap core nặng nhất.
2. **UX-công-năng:** SSE streaming + composer (model/persona/context-ring) + card thinking/approval. Lucy data đã có (A4, /llm/guard), thiếu UI sống.
3. **Test coverage + CI gate:** 37→nhiều hơn, dọn 5 đỏ, tự động hoá. (Hermes 7.150.)
4. **Session lineage + bookends** trên FTS5 (Lucy có FTS5 trần).
5. **Batch + checkpoint** (chạy hàng loạt) — chưa cấp thiết 1 người.
6. **MCP / plugin ecosystem** — mở rộng dài hạn.

> Chốt thẳng: Hermes là đích tham chiếu xịn thật. Lucy nên tiếp tục NHẶT pattern Hermes (context-compress, UX-parity,
> test/CI) thay vì tự coi đã ngang — còn một quãng dài, nhưng hướng đi đúng.
