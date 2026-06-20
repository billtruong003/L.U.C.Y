---
name: fitcity-admin-live
description: FitCity admin (dashboard đổi ảnh) ĐÃ go-live 2026-06-17 — pm2 fitcity-admin :8790 + nginx route ẩn; pw ở file 600
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d9843b7-bb2e-44d4-a41f-8960493c84ab
---

FitCity admin (service `admin/` trong repo fitcity-web — Express+multer+sharp, 62 slot ảnh) **ĐÃ HOST LIVE** (2026-06-17, Bill "set đại đi rồi host").

- **URL ẩn:** `http://14.225.255.73/quan-ly-701510/` (route random qua env ADMIN_ROUTE).
- **pm2:** `fitcity-admin` (`npm start` → node server.js, cwd `/root/lucy-workspace/fitcity-web/admin`, `--no-autorestart` KHÔNG set nên pm2 tự restart). `pm2 save` rồi.
- **Env** ở `admin/.env` (chmod 600, server.js KHÔNG có dotenv → pm2 giữ env snapshot lúc start; đổi env phải `set -a; . .env; set +a` rồi `pm2 restart fitcity-admin --update-env`): PORT=8790, HOST=127.0.0.1, ADMIN_ROUTE=quan-ly-701510, PUBLIC_DIR=`/var/www/lucy-reports/fitcity-preview` (admin ghi đè ảnh vào đây → preview + admin cùng dùng).
- **Mật khẩu** ở `/root/lucy/fitcity-admin-LOGIN.txt` (chmod 600, Bill tự cat — KHÔNG echo chat). Login field JSON = `password` (KHÔNG phải `pw`); auth = HMAC cookie HttpOnly, sai pw→401.
- **nginx** `/etc/nginx/sites-enabled/lucy`: `location /quan-ly-701510/` proxy :8790 (client_max_body_size 6m) + `location /images/` alias preview/images (ảnh sống).
- ⚠️ Bảo mật: hiện chỉ route-ẩn + pw. Nếu để lâu nên thêm lớp (nginx basic-auth / allow IP) như README khuyến nghị. Đổi ảnh KHÔNG cần rebuild (ghi thẳng PUBLIC_DIR/images). Liên quan [[fitcity-task3-real-images]].
