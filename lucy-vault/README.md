# lucy-vault — bộ não bền của Lucy

Thư mục markdown = **trí nhớ xuyên phiên** của Lucy. `claude -p --add-dir lucy-vault` để agent đọc/ghi.
Mở bằng **Obsidian** (trỏ vault vào đây) để Bill tự xem/sửa. Học từ: basic-memory + open-second-brain
(xem `docs/STEAL_FROM_HERMES.md`, `docs/NORTH_STAR.md`).

## Cách hoạt động
- **File là sự thật.** SQLite `.index/` chỉ là index tìm kiếm (xoá/dựng lại được).
- Agent **ghi tự do:** `Context/`, `Projects/`, `Daily/`, `Brain/inbox/`.
- **Máy quản, KHÔNG sửa tay:** `Brain/preferences/`, `Brain/active.md` (do "dream" sinh ra).

## Định dạng note (mượn basic-memory)
- **Quan sát:** `- [danh-mục] nội dung #tag (ngữ cảnh)`
- **Liên hệ:** `- loại_liên_hệ [[Note khác]]`
- **Frontmatter:** `title` · `type` (note|project|decision|entity|skill) · `tags` · `permalink`

## Học (dream)
Signal thô → `Brain/inbox/sig-<ngày>.md`. "dream" gộp **lặp ≥2 lần cùng dấu** thành preference (có
confidence Wilson) → `active.md` (digest nạp đầu mỗi phiên). Ngưỡng ở `_brain.yaml`.
