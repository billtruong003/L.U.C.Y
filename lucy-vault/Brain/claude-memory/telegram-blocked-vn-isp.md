---
name: telegram-blocked-vn-isp
description: "VPS (14.225.x VN) bị ISP chặn dải IP Bot API Telegram → bridge mất phản hồi; bridge code OK, cần tunnel/proxy egress"
metadata: 
  node_type: memory
  type: ops
  originSessionId: e4a09812-8927-45b7-86d7-5d07ca4ff266
---

# Telegram Bot API bị chặn từ VPS (VN ISP) — 2026-06-16

**Triệu chứng:** nhắn Lucy trên Telegram KHÔNG còn phản hồi. Log `lucy-bridge`: `loop err ... getUpdates ... [Errno 101] Network is unreachable` lặp lại.

**Gốc rễ (đã chẩn đoán kỹ):** nhà mạng/ISP của VPS (`14.225.255.73`, dải VN) **null-route dải IP Bot API của Telegram** — khớp lệnh chặn Telegram toàn quốc VN.
- Internet chung BÌNH THƯỜNG: ping 8.8.8.8 OK, `curl github.com` = 200, default route + eth0 ổn.
- Riêng Telegram Bot API BLOCKED: `api.telegram.org`→`149.154.166.110` ping 100% mất gói, TCP443 unreachable. Cả dải `149.154.167.197-233` + `91.108.4.x` (dải Bot API chính thức) đều BLOCKED.
- Vài IP MTProto thông (`149.154.175.50/100`, `91.108.56.130`) nhưng KHÔNG phục vụ HTTP Bot API → mẹo `--resolve`/`/etc/hosts` VÔ DỤNG (http=000).
- Không có blackhole route ở máy → chặn ở GATEWAY/ISP, không sửa được trong VPS bằng route.

**KHÔNG phải do code/restart.** Bridge code (`/new`, `/stop`, episodic, persona, recall) đều ĐÚNG và đã live; sẽ chạy lại NGAY khi egress tới Bot API thông. Restart bridge thêm = vô ích.

**Hướng sửa (cần chủ nhân chốt — đổi hạ tầng/creds):**
1. ⭐**Cloudflare WARP proxy-mode** (free, không creds): `warp-cli` mở SOCKS5 local (vd 127.0.0.1:40000) KHÔNG đổi default route cả máy → chỉ trỏ RIÊNG bridge qua proxy (requests `proxies=` / env cho process bridge). Blast-radius nhỏ. Rủi: WARP đôi khi bị bóp ở VN.
2. **Proxy/VPN của chủ nhân ở server ngoài VN** (SOCKS5/HTTP/WireGuard): cần endpoint+creds (chủ nhân tự nhập, KHÔNG paste chat).
3. **Đổi kênh sang Discord** (Aki đã có sẵn) nếu không muốn vọc proxy.

Khi bật proxy: trong `bridge/lucy_bridge.py` mọi call Telegram đi qua `requests` — set `os.environ` `HTTPS_PROXY`/`ALL_PROXY` cho process bridge (pm2 env) hoặc thêm `proxies=` vào session là xong; nhớ verify `loop err` ngừng + `getUpdates` thông.

## ✅ FIX ĐÃ ÁP — Cloudflare WARP proxy (2026-06-16)
- Cài `cloudflare-warp` (2026.4.x) + `python3-socks` (PySocks cho requests socks5h). `warp-cli mode proxy` + `connect` → SOCKS5 local `127.0.0.1:40000`. Verify: `curl --proxy socks5h://127.0.0.1:40000 https://api.telegram.org/` = 302 (thông), không proxy = fail.
- **Code surgical** trong `lucy_bridge.py`: hằng `TG_PROXY=os.environ["LUCY_TG_PROXY"]` + `_TG_PROXIES`, chèn `proxies=_TG_PROXIES` vào 6 call Telegram (sendMessage x3, editMessageText, sendDocument, getUpdates). KHÔNG đụng coordinator(localhost) / claude(spawn) → chỉ Telegram đi WARP.
- Env `LUCY_TG_PROXY=socks5h://127.0.0.1:40000` set qua pm2 (tái dựng full env từ `/proc/<pid>/environ` + `--update-env` + `pm2 save` → giữ TELEGRAM_BOT_TOKEN/AM_TOKEN). Verify sau restart: 0 `loop err` sau banner online = poll thông.
- Boot-persist: `systemctl enable warp-svc` + pm2-root enabled (resurrect giữ env). Sau reboot bridge có thể lỗi vài giây tới khi WARP connect rồi tự hồi.
- **Tắt fix:** `warp-cli disconnect` / gỡ env `LUCY_TG_PROXY` (set rỗng → `_TG_PROXIES=None`, call thẳng như cũ). Nếu WARP bị bóp ở VN → đổi sang proxy ngoài-VN: chỉ cần đổi `LUCY_TG_PROXY` thành endpoint mới, không sửa code.

## 🐛 BUG /restart loop vô tận (fix 2026-06-16) — quan trọng
**Triệu chứng:** sau khi sống lại, bridge restart liên tục (restarts leo ~1 lần/4s, OUT in banner "Lucy bridge online" lặp lại, ERR = KeyboardInterrupt giữa getUpdates SSL = pm2 bắn SIGINT mỗi vòng).
**Gốc rễ:** lệnh `/restart` (RESTART_WORDS={`/restart`,`restart`,`/reload`,`/khoidong`,`khởi động lại`}) trong poll chạy `pm2 restart`. NHƯNG `offset` getUpdates KHÔNG được lưu (reset `None` mỗi lần start). Chủ nhân gõ "/restart" lúc bực → tin kẹt backlog Telegram → bật lên là nuốt lại đúng tin /restart → tự restart → vô tận. (Bất kỳ ai gõ /restart đều dính bug này.)
**Fix (3 phần, đã áp + verify stable):**
1. **Lưu offset ra file** `~/.lucy-bridge-offset.json`: helper `_load_offset/_save_offset`; `main()` load lúc start; `_save_offset(offset)` ngay sau `offset=update_id+1` → restart KHÔNG xử lại backlog.
2. **Flush backlog kẹt**: ghi offset file + gọi `getUpdates?offset=<max+1>` qua WARP để Telegram drop tin cũ (gồm /restart). Xác minh backlog=0.
3. **Script tự nạp .env** (`_load_env_file()` đầu file, `setdefault`): pm2 start cmd `bash -c python3 lucy_bridge.py` KHÔNG source .env → trước đó `LUCY_TG_PROXY` set qua `--update-env` BỊ MẤT khi `pm2 stop`+`start`. Giờ mọi env (gồm LUCY_TG_PROXY) đọc thẳng `bridge/.env` → bền qua mọi restart/stop-start, không phụ thuộc snapshot pm2. ⭐Bài học: env bridge = để trong `.env`, đừng dựa --update-env.
**Lưu ý:** code `lucy_bridge.py` các sửa này (proxy + offset + load .env) CHƯA commit git.
