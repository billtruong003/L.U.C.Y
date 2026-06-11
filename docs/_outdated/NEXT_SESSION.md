# NEXT SESSION — prompt copy-paste cho Claude Code (làm tiếp Lucy)

> Paste nguyên khối dưới vào Claude Code (mở ở thư mục repo **L.U.C.Y/lucy**). Tự-chứa — agent đọc docs là đủ ngữ cảnh, không cần giải thích lại.

---

```
Bối cảnh: dự án Lucy (personal AI, memory-first). Tao đang ở thư mục repo L.U.C.Y/lucy.

BƯỚC 0 — chuẩn bị (làm trước, đừng bỏ):
1. git pull (repo lucy).
2. Chạy .\refs.ps1 (Windows) hoặc `bash refs.sh` → kéo 6 submodule references/ về (cần để crib Hermes/basic-memory/open-second-brain).
3. Đọc theo thứ tự, KHÔNG hỏi lại cái đã ghi: docs/NORTH_STAR.md → docs/HANDOFF_M1.md → docs/MEMORY_PEAK.md → docs/NEURAL_GALAXY.md.
4. Vault ở lucy/lucy-vault. Khi test, set env LUCY_VAULT trỏ vào đó.

TRẠNG THÁI (đã build + commit, branch main): M1 trí nhớ (recall FTS5 · write-back signal · dream Wilson-confidence · tab "Bộ não") + M1.5 tinh hà 3D (hành tinh=note, đường sao=wikilink, tab Neural toggle 🌌). Code: agent-machine/src/{recall,dream,signal,brain,vault}.ts + hub/web/src/components/{Memory,Galaxy,viz3d}.tsx.

VIỆC LÀM — A1 "evidence-loop" (ưu tiên 1, xem docs/MEMORY_PEAK.md §A1):
Vấn đề: dream.ts graduate signal → preference ở trạng thái `unconfirmed`, nhưng KHÔNG BAO GIỜ thành `confirmed`, vì computeConfidence cần số applied/violated đọc từ Brain/log/*.jsonl — mà hiện KHÔNG có mạch nào ghi file đó. Hậu quả: active.md luôn rỗng "confirmed", hành tinh galaxy không sáng lên → hệ chỉ "ghi nhớ" chứ chưa "học thật".
Cần: thiết kế + wire mạch ghi evidence {ts, prefId, kind:'applied'|'violated'} vào lucy-vault/Brain/log/<YYYY-MM-DD>.jsonl khi 1 preference được ÁP DỤNG hoặc VI PHẠM. Tự đề xuất cơ chế hợp lý (vd: runner prepend active.md → khi agent làm theo preference = applied; rework/reject đi ngược preference = violated; HOẶC nút áp/bác trong tab Bộ não feed vào). Giữ deterministic chỗ nào được, đừng bịa số.
Verify (BẮT BUỘC, đưa output thật): tạo vài evidence → chạy `npm run dream` → chứng minh preference chuyển `confirmed`, confidence > 0, active.md có nội dung. Mở galaxy thấy hành tinh preference sáng lên.

KỶ LUẬT:
- Bám convention sẵn có (đọc file liên quan trước). Strict TS, không any tùy tiện, lỗi thì throw.
- Typecheck sạch: `cd agent-machine && npm run typecheck` + `cd hub/web && npx vite build`.
- Test bằng CHẠY THẬT (reindex/dream/coordinator+hub) rồi đưa output — KHÔNG báo "xong" nếu chưa chứng minh bằng số liệu/log thật.
- FOCUS: làm xong + verify A1 RỒI mới hỏi có sang B không. Đừng mở nhiều mặt trận.

Lệnh preview (nếu cần xem UI):
  # term 1: $env:LUCY_VAULT="<...>/lucy/lucy-vault"; $env:AM_TOKEN="x"; cd agent-machine; npm run coordinator
  # term 2: $env:AM_COORD_URL="http://127.0.0.1:8780"; $env:AM_TOKEN="x"; $env:LUCY_HUB_PASSWORD="123"; cd hub/server; npm start
  # mở http://localhost:8800 (mật khẩu 123) → tab Neural → 🌌 Tinh hà / tab Bộ não

Xong A1 → hỏi tao có làm tiếp B (redesign tab Bộ não: lucide-react + design-system + galaxy làm hero + confidence-bar + pin) không, theo docs/MEMORY_PEAK.md §B.
```

---

**Ghi chú:** prompt này ưu tiên **A1** (biến memory thành "học thật" — ROI cao nhất). Nếu muốn làm **UI đẹp trước**, đổi câu "VIỆC LÀM" thành: *"Redesign tab Bộ não theo docs/MEMORY_PEAK.md §B (lucide-react + Card/Badge/Switch + galaxy hero + confidence-bar + pin), giữ dark-premium NORTH_STAR §4."*
