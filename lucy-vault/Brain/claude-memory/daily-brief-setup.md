---
name: daily-brief-setup
description: "Cron 2 buổi (7h sáng + 17h chiều) sinh HTML báo cáo thị trường, host trên VPS /reports/ archive đối chiếu, gửi Telegram + Discord(Aki)"
metadata: 
  node_type: memory
  type: project
  originSessionId: aee951fe-da77-4708-b943-3a92cd9c2116
---

Script `/root/lucy/bridge/cron_brief.sh` chạy tự động **2 buổi/ngày** (cập nhật 05/06/2026): `0 7 * * * cron_brief.sh morning` và `0 17 * * * cron_brief.sh afternoon`. Arg buổi (`morning|afternoon`, default morning) quyết định nhãn ("Brief sáng"/"Brief chiều"), SLUG file (`am`/`pm`), và một câu SESS_NOTE chèn vào prompt (chiều = nhấn diễn biến phiên + định hướng US session). Output tách riêng `brief-YYYY-MM-DD-am.{md,html}` / `-pm.{md,html}` để giữ cả 2 bản đối chiếu trong ngày.

**Flow:** Claude sinh báo cáo markdown chi tiết (nguồn = link markdown click được) → convert HTML dark-theme → copy vào archive → regenerate trang index → gửi summary + link qua Telegram.

**Hosting (đã chuyển từ catbox sang VPS):**
- Trang chủ/archive: `http://14.225.255.73/reports/` (index liệt kê tất cả report để đối chiếu, mới nhất lên đầu)
- Mỗi report: `http://14.225.255.73/reports/archive/brief-YYYY-MM-DD.html`
- nginx serve static từ `/var/www/lucy-reports/` (location `/reports/` thêm vào `/etc/nginx/sites-available/lucy`, backup ở `lucy.bak`). Phần `location /` vẫn proxy về lucy-hub :8800.

**Why:** Chủ nhân muốn (1) host trên IP cố định của mình thay catbox, (2) lưu archive đối chiếu lịch sử, (3) báo cáo chi tiết hơn + nguồn click được.

**Discord post qua Aki (thêm 05/06/2026):** sau bước gửi Telegram, `cron_brief.sh` còn POST summary+link sang Discord thread `1512380017168879648` (finance brief thread — ĐÚNG) qua radiant-bot Aki API (`POST $RADIANT_BOT_API_URL/api/agent/post`, ký HMAC `x-lucy-signature` = `openssl dgst -sha256 -hmac $RADIANT_BOT_AGENT_SECRET` trên đúng file body). Config trong `bridge/.env`: `RADIANT_BOT_API_URL`, `RADIANT_BOT_AGENT_SECRET` (=`AGENT_HMAC_SECRET` bên radiant-bot), `LUCY_BRIEF_DISCORD_CHANNEL`. Telegram vẫn giữ (gửi cả 2). Lưu ý: `/api/agent/post` của radiant-bot ban đầu chỉ resolve text channel — đã sửa `resolveChannel` trong `src/utils/health.ts` thành async + nhận thread theo ID (fetch nếu chưa cache); change này CHƯA commit/push lên radiant-bot repo. Xem [[lucy-hub-web-command-center]] (Aki bridge).

**Pipeline render = Node/marked** (đã bỏ Python từ 05/06/2026): `gen_brief.mjs` gộp cả MD→HTML lẫn index generator. Dùng `marked` GFM (cài qua `/root/lucy/bridge/package.json`, có `node_modules`). Lệnh: `node gen_brief.mjs report <md> <summary_file> <out_html> <YYYY-MM-DD>` và `node gen_brief.mjs index` (config path qua env `LUCY_WEB_ROOT`, default `/var/www/lucy-reports`).

**Design template (redesign 05/06/2026):** đậm = nhấn trung tính (trắng) KHÔNG phải xanh; nghiêng giữ italic màu xanh nhạt làm nhãn; `%±` tự tô màu theo dấu (xanh tăng/đỏ giảm) qua hàm `colorizePct`; bảng bọc `.table-wrap` cuộn ngang mobile; strip H1 đầu để không trùng tiêu đề header.

**Tech Digest (thêm 09/06/2026, nâng cấp cùng ngày):** Script riêng `/root/lucy/bridge/cron_tech.sh` chạy `0 8 * * *` (8h sáng). Là DIGEST CÔNG NGHỆ PHÂN TẦNG, lọc nhiễu mạnh tay, chỉ tin 24h qua: TẦNG 1 (luôn báo) = AI/LLM, software dev, game dev+news, big tech, code deep-dives; TẦNG 2 (chỉ khi BOM TẤN) = infra/hardware/security CVE lớn/science/policy; TẦNG 3 = crypto góc trading (bỏ nếu không có gì). Format cố định: 📅 ngày → 🔥 TOP 3 → 🤖 AI → 💻 SOFTWARE DEV → 🎮 GAME → 🏢 BIG TECH → 📐 DEEP-DIVE → 💥 BOM TẤN → 💰 CRYPTO → 🗓️ RADAR SỰ KIỆN (sắp tới/vừa qua). Nguồn: HN/Lobsters/GitHub Trending/Reddit + blog OpenAI/Anthropic/DeepMind/Meta + HF/Arxiv + TechCrunch/Verge/Ars. Full ghi `tech-YYYY-MM-DD.md`→HTML archive. Log: `/root/lucy-workspace/tech-cron.log`.

**Discord tech digest (chốt 11/06/2026):** mỗi ngày post 1 tin GỌN vào CẢ channel `1503999842836414496` (LUCY_TECH_DISCORD_CHANNEL, nổi dễ thấy) LẪN thread `1514087167335596032` (LUCY_TECH_DISCORD_THREAD, archive). Tin có dòng template phân cách ngày: `📅 **DD/MM/YYYY** | 🔬 Tech Digest (N tin nóng)` + ━━━ + TOP 3 + link full/archive. N = đếm số item (1./- ) trong digest. **Robust:** chỉ post khi digest hợp lệ (grep 'TOP 3' — tránh đẩy "(tech digest lỗi)" lên Discord khi claude lỗi tạm thời); nếu lỗi chỉ nhắn riêng Telegram. Có cron retry `20 8 * * * cron_tech.sh --if-missing` chạy lại nếu 8h sáng hỏng. (Bug đã sửa: sáng 11/06 claude -p lỗi → post bản rỗng vào thread.)

**Đề xuất tài chính (09/06/2026, CHƯA làm — chờ duyệt):** Bản đề xuất ở `/root/lucy-workspace/proposal-finance-cronjobs.md` — nâng `cron_brief.sh` lên format phân tầng + TOP 3, thêm chứng khoán VN (nguồn `vnstock` Python free TCBS/SSI, có OHLC cắm thẳng vào quant như Binance) + stocks Mỹ qua stooq, và thêm cổ phiếu VN vào paper-test (Lucy nghiêng Phương án B = portfolio VN tách riêng, không phá hệ crypto đang chạy). Chờ chủ nhân chọn phương án + vốn ảo + universe VN30/watchlist.

**Files:**
- Script chính: `/root/lucy/bridge/cron_brief.sh`
- HTML template report: `/root/lucy/bridge/brief_template.html`
- Render pipeline (MD→HTML + index): `/root/lucy/bridge/gen_brief.mjs` (+ `package.json`, `node_modules/marked`)
- Output: `/root/lucy-workspace/brief-YYYY-MM-DD-{am,pm}.{md,html}` + copy vào `/var/www/lucy-reports/archive/`. (Bản 05/06 sáng còn 1 file cũ không hậu tố `brief-2026-06-05.html` — index regex `gen_brief.mjs` đã sửa nhận cả dạng có/không `-(am|pm)`, sort pm trước am trong ngày, card hiện nhãn 🌅 Sáng/🌆 Chiều.)
- Cron log: `/root/lucy-workspace/brief-cron.log`

**How to apply:** Chạy thủ công: `bash /root/lucy/bridge/cron_brief.sh`. Nếu sửa template thì sửa file, lần sau tự dùng. Lưu ý: chưa có HTTPS/domain (xem [[lucy-hub-web-command-center]]).
