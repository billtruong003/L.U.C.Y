# ABF-FIX-6: QA URL auto-detect từ workspace thay vì bắt buộc set env

**Priority:** LOW  
**File:** `/root/lucy/auto-build-free.py`

## Vấn đề
Hiện tại QA phase bị skip hoàn toàn nếu `AUTOBUILD_FREE_QA_URL` không set. Sprint YTM hiện tại: QA không chạy vì chưa set URL.

## Fix cần làm
Nếu `QA_URL` rỗng, thử auto-detect từ workspace:
1. Đọc `package.json` trong workspace → tìm `dev`/`start` script port
2. Thử start server tạm: `npm run dev -- --port 3099` trong subprocess
3. Dùng `http://localhost:3099` làm QA_URL tạm
4. Kill server sau QA xong

Hoặc đơn giản hơn: nếu workspace có `frontend/` → `http://localhost:5173` (Vite default).

## Alternative (simpler)
Thêm log warning rõ hơn và Telegram:
```
⚠️ QA phase skip: AUTOBUILD_FREE_QA_URL chưa set.
Để bật QA: export AUTOBUILD_FREE_QA_URL=http://localhost:PORT
```

## Acceptance
- Bill biết QA skip vì URL chưa set (không âm thầm)
- Hoặc QA tự detect URL và chạy được
