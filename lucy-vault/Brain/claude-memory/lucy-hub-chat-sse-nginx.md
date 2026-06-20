---
name: lucy-hub-chat-sse-nginx
description: "Lucy Hub web chat dùng SSE stream — nginx phải proxy_buffering off + timeout dài, nếu không \"fail fetch\""
metadata: 
  node_type: memory
  type: project
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

Chat trên Lucy Hub (`/api/chat/stream`) là **SSE stream** chạy `claude -p` (có thể >60s khi research).

**Bug "fail fetch":** config nginx đang chạy `/etc/nginx/sites-enabled/lucy` ở `location /` THIẾU `proxy_read_timeout` (mặc định 60s) + `proxy_buffering off` → claude research >60s không nhả byte → nginx cắt → browser "Failed to fetch". File mẫu `hub/nginx-lucy.conf.example` có 1200s nhưng `deploy.sh` KHÔNG áp nginx config → phải sửa tay.

**Fix (2026-06-13):** thêm block riêng `location /api/chat/stream` với `proxy_buffering off; proxy_cache off; chunked_transfer_encoding on; proxy_read_timeout/send_timeout 1200s; proxy_set_header Connection ""`. Lưu ý: khi browser báo fail, server-side claude VẪN chạy xong + lưu `~/.lucy-hub/chat.json` → gửi lại = tốn token gấp đôi.

Liên quan [[lucy-hub-web-command-center]]. Server hub = `tsx src/index.ts` (sửa server chỉ cần `pm2 restart lucy-hub`, KHÔNG build); web = `vite build` trong `hub/web`.
