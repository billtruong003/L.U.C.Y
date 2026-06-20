# Sprint — Cổng dự án Lucy (LP) · 2026-06-19

> Mục tiêu: cổng gom link dự án ở route `/lucy/`, **data-driven 3 lớp**, build-on-register → serve tĩnh nhẹ VPS. KHÔNG hardcode HTML. Theo mockup đã duyệt `lucy-portal-mockup.html` (cockpit gold/cyan).
> Chạy qua **auto-build.py** (model: **Opus** theo ý chủ nhân — lưu ý rule cũ `autobuild-model-lesson` mặc định Sonnet, nhưng sprint này nặng thiết kế kiến trúc nên Opus hợp).

## Kiến trúc 3 lớp (chốt)
- **Registry** — 1 manifest JSON / project trong `registry/*.json`. Nguồn sự thật duy nhất.
- **Builder** — quét `registry/` → group theo zone → render HTML từ template (data-driven). Output `dist/`.
- **Ingest CLI** — `portal register|remove|list` ghi/xoá manifest rồi trigger build. Dành cho automation (cron đẻ web-app mỗi ngày tự hấp thụ).

## Cây thư mục đề xuất
```
/root/lucy/portal/
  registry/            # *.json — 1 manifest / project
  src/
    schema.mjs         # định nghĩa + validate manifest
    builder.mjs        # scan → group → render
    template.mjs       # render HTML data-driven (4 zone), bám mockup
  bin/
    portal             # CLI: register|remove|list (gọi builder)
  dist/                # index.html + assets (serve tĩnh)
  package.json
```

## Manifest schema (project.json)
```json
{
  "id": "fitcity-preview",
  "title": "FitCity — preview web",
  "zone": "preview",            // preview | report | money | daily
  "url": "/reports/fitcity-preview/",
  "description": "Landing 11 chi nhánh, dark gold",
  "status": "live",             // live | wip | archived
  "tags": ["astro", "landing"],
  "thumbnail": null,
  "createdAt": "2026-06-17",
  "updatedAt": "2026-06-19"
}
```

## 4 zone hiển thị
- 🌐 **preview** — web-app preview (`/reports/*-preview/`...)
- 📊 **report** — báo cáo phân tích / lucy-report-info
- 💰 **money** — money-ideas (`Projects/money-ideas.md`)
- 📅 **daily** — link daily brief + hub chính

---

## TASK BREAKDOWN (atomic, auto-build-able)

### LP-1 · Skeleton + schema
- Tạo cây `/root/lucy/portal/` như trên; `package.json` (ESM, node thuần, KHÔNG framework nặng).
- `src/schema.mjs`: định nghĩa field + `validate(manifest)` (bắt buộc id/title/zone/url; default status=wip).
- 1 manifest mẫu `registry/_sample.json`.
- **Acceptance:** `node -e "import('./src/schema.mjs')..."` load OK; validate manifest mẫu pass; validate manifest thiếu `zone` → fail rõ ràng.

### LP-2 · Builder + template (theo mockup)
- `src/template.mjs`: render HTML data-driven — header cockpit gold/cyan, 4 section theo zone, mỗi project = card (title/desc/status badge/tags/link). KHÔNG nhúng project cứng.
- `src/builder.mjs`: quét `registry/*.json` → validate → group theo zone → render → ghi `dist/index.html` (+ CSS inline/asset).
- **Acceptance:** `node src/builder.mjs` → `dist/index.html` tồn tại, chứa card từ `_sample.json`, đúng 4 section; headless screenshot ra theme gold/cyan giống mockup (không lệch màu nền).

### LP-3 · Backfill registry
- Sinh manifest cho project hiện có, gom đủ 4 zone:
  - preview: quét `/var/www/lucy-reports/*-preview/` (hoặc thư mục serve thật).
  - report: các báo cáo trong `/reports/` + lucy-report-info.
  - money: từ `lucy-vault/Projects/money-ideas.md`.
  - daily: link daily brief (`http://14.225.255.73/reports/`) + hub chính (`http://14.225.255.73`).
- **Acceptance:** build sau backfill hiện toàn bộ entry, group đúng zone, không card rỗng/url chết (kiểm path tồn tại).

### LP-4 · Ingest CLI
- `bin/portal`: `register <file.json | --field=...>` ghi manifest + build; `remove <id>` xoá + build; `list` in bảng.
- Idempotent; trigger builder sau mỗi thao tác.
- **Acceptance:** `portal register` dummy → xuất hiện trong `dist`; `portal remove` → biến mất; `portal list` in đúng số lượng.

### LP-5 · Wire nginx + serve tĩnh
- nginx `location /lucy/` → serve `/root/lucy/portal/dist/` (sau login giống hub nếu cần).
- **Acceptance:** `curl http://14.225.255.73/lucy/` trả HTML cổng (đúng auth flow); reload nginx không lỗi; KHÔNG đụng route `/reports/` và `/`.

---

## Cách chạy auto-build (MODEL SPLIT — chủ nhân chốt 2026-06-19: phần khó Opus, phần dễ Sonnet)
> Vì `auto-build.py` chỉ có 1 `AUTOBUILD_MODEL` global/process → tách model = chạy 2 đợt nối tiếp (chuỗi phụ thuộc vốn đã bắt nối tiếp).
1. Inject nhóm **LP** (LP-1→LP-5) vào `docs/MASTER-SPEC.md` Phần V (mục 19). ✅ DONE.
2. **Đợt A (Opus, phần khó):** `AUTOBUILD_MODEL=opus AUTOBUILD_GROUP=1 AUTOBUILD_FOCUS="LP-1, LP-2" python3 /root/lucy/auto-build.py` → kiến trúc skeleton+schema + builder+template.
3. **Đợt B (Sonnet, phần dễ):** sau khi A xong, `AUTOBUILD_MODEL=sonnet AUTOBUILD_GROUP=1 AUTOBUILD_FOCUS="LP-3, LP-4, LP-5" python3 /root/lucy/auto-build.py` → backfill + CLI + nginx.
4. Sau ALL_DONE: Lucy screenshot-verify `/lucy/` + báo chủ nhân.

## Thứ tự phụ thuộc
LP-1 → LP-2 → (LP-3 ‖ LP-4) → LP-5. LP-3 và LP-4 độc lập nhau, đều cần LP-2 xong.
