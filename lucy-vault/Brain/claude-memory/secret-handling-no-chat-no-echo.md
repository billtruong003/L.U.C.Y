---
name: secret-handling-no-chat-no-echo
description: "Luật secret của Bill: không hỏi mật khẩu/secret qua chat, không echo/cat giá trị secret; nhập secret là việc của Bill"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 43e33831-558a-4a5b-8d4a-bcb39968a944
---

Khi deploy/cấu hình cho Bill: **TUYỆT ĐỐI không** yêu cầu Bill paste mật khẩu/secret vào chat, và **không echo/cat/in giá trị** secret (kể cả prefix vài ký tự). Bước đặt secret (vd `LUCY_HUB_PASSWORD`, token) là **phần của Bill** — Bill tự `nano` file `.env` rồi báo "done"; mình lo các bước không-secret (set các dòng config thường, build, pm2, nginx...).

**Why:** Bill nêu rõ thành "LUẬT SECRET (bắt buộc)" — bảo mật, không để secret lọt vào transcript/log.

**How to apply:** Kiểm tra `.env` thì chỉ liệt kê TÊN key (vd `grep -oE '^[A-Z_]+=' .env` ra `LUCY_HUB_PASSWORD=` không kèm value), không bao giờ `cat .env`. So khớp 2 secret thì so gián tiếp (hash/độ dài) hoặc để Bill tự xác nhận, không in value. Khi cần secret mới (vd `openssl rand`) thì để Bill tự tạo/đặt, hoặc tạo nhưng KHÔNG in ra chat. Liên quan [[lucy-hub-web-command-center]].
