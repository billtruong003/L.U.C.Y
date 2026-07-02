#!/usr/bin/env bash
# Daily VN News + Chứng khoán VN — chạy cùng thời điểm với brief
# Crontab:
#   30 9  * * * /root/lucy/bridge/cron_vn.sh morning
#   0  18 * * * /root/lucy/bridge/cron_vn.sh afternoon
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export IS_SANDBOX=1

# Guard: chờ claude rảnh (≤1 process) tối đa 10 phút
_WAIT=0; _MAX=1800
while [ "$(pgrep -c claude 2>/dev/null)" -gt 1 ] && [ $_WAIT -lt $_MAX ]; do
  sleep 15; _WAIT=$((_WAIT+15))
done
if [ $_WAIT -ge $_MAX ]; then
  echo "$(date '+%Y-%m-%d %H:%M') SKIP: claude busy sau ${_MAX}s — vn digest bỏ qua lần này"
  exit 0
fi

SESSION="${1:-morning}"
case "$SESSION" in
  afternoon|chieu|pm)
    LABEL="VN chiều"; SLUG="pm"
    SESS_NOTE="Đây là BÁO CÁO CHIỀU (chốt phiên chứng khoán VN). Nhấn mạnh DIỄN BIẾN trong phiên hôm nay: \
VN-Index đóng cửa thế nào, thanh khoản, khối ngoại mua/bán ròng, nhóm ngành dẫn dắt, tin tức doanh nghiệp nổi bật trong ngày. " ;;
  *)
    LABEL="VN sáng"; SLUG="am"
    SESS_NOTE="Đây là BÁO CÁO SÁNG (mở đầu ngày). Nhấn mạnh những TIN TỨC KINH TẾ VN và ĐỊNH HƯỚNG THỊ TRƯỜNG đầu ngày: \
lịch sự kiện, tin tức vĩ mô/diễn biến quốc tế ảnh hưởng đến phiên VN, nhóm ngành dự kiến dẫn dắt, vùng hỗ trợ/kháng cự VN-Index. " ;;
esac

WORKDIR="${LUCY_WORKDIR:-$HOME/lucy-workspace}"; mkdir -p "$WORKDIR"
WEB_ROOT="/var/www/lucy-reports"
ARCHIVE="$WEB_ROOT/archive"
mkdir -p "$ARCHIVE"
PUBLIC_BASE="${LUCY_REPORTS_URL:-http://14.225.255.73/reports}"

DATE_STR="$(date +%F)"
MD_OUT="$WORKDIR/vn-$DATE_STR-$SLUG.md"
HTML_OUT="$WORKDIR/vn-$DATE_STR-$SLUG.html"
RES="$(mktemp)"
SUMM_FILE="$(mktemp)"
DATA_LINE="$(mktemp)"

# 1. Gọi Claude sinh báo cáo
"${CLAUDE_BIN:-claude}" -p --model claude-sonnet-4-6 \
  "Làm BÁO CÁO THỊ TRƯỜNG VIỆT NAM + TIN TỨC KINH TẾ VN trong 24h qua. \
CHI TIẾT, CHUYÊN NGHIỆP, GÓC NHÀ ĐẦU TƯ CÁ NHÂN. LỌC NHIỄU MẠNH TAY — \
ưu tiên thứ thực sự tác động thị trường/danh mục, BỎ tin PR/giật tít. Số liệu THẬT từ web (ghi rõ nguồn + giờ lấy). \
Độ dài: vừa phải, đọc hết 3-5 phút. Tiếng Việt, giữ thuật ngữ chuyên ngành bằng tiếng Anh khi cần. \
\
$SESS_NOTE\
\
=== CẤU TRÚC BÁO CÁO === \
\
📰 TIN TỨC NỔI BẬT (CafeF, Vietstock, VnExpress Kinh doanh, FireAnt, TBKTSG) \
- Tin vĩ mô/chính sách (NHNN, Chính phủ, đầu tư công, xuất nhập khẩu, FDI, lạm phát, lãi suất, tỷ giá USD/VND). \
- Tin doanh nghiệp: KQKD, cổ tức, thưởng, phát hành, chào bán, niêm yết/huỷ niêm yết, tin quản trị. \
- Tin ngành: bank, chứng khoán, BĐS, thép, bán lẻ, công nghệ, năng lượng, logistics. \
- Tin thế giới ảnh hưởng VN: Fed, giá dầu, giá hàng hoá, căng thẳng thương mại. \
- Mỗi tin kèm 1 dòng 'tại sao đáng chú ý' + link nguồn. \
\
📊 DIỄN BIẾN CHỨNG KHOÁN VN \
- VN-Index (điểm, % so với hôm qua, thanh khoản, độ rộng thị trường — mã tăng/giảm/đứng). \
- VN30 (rổ bluechip: VCB, BID, CTG, FPT, HPG, MWG, SSI, VIC, VHM, VRE...): top tăng/giảm mạnh nhất. \
- HNX-Index, UPCOM-Index (tóm tắt). \
- Khối ngoại: mua ròng / bán ròng bao nhiêu tỷ, tập trung mã nào. \
- Nhóm ngành dẫn dắt hôm nay (bank/chứng/BĐS/thép/bán lẻ...). \
- Mã đáng chú ý: tăng/giảm bất thường, khối lượng đột biến, tin hỗ trợ. \
\
🔮 NHẬN ĐỊNH & GÓC NHÌN \
- Xu hướng ngắn hạn VN-Index (hỗ trợ/kháng cự gần, vùng nào nên quan sát). \
- Dòng tiền: đang chảy vào nhóm nào? Tâm lý nhà đầu tư? \
- Kế hoạch theo dõi trong phiên/ngày tới. \
\
=== NGUỒN (quét lần lượt, ghi link) === \
CafeF: https://cafef.vn (tin tức + chứng khoán + vĩ mô) \
Vietstock: https://vietstock.vn (phân tích + dữ liệu) \
FireAnt: https://fireant.vn (dữ liệu realtime + screener) \
VnExpress Kinh doanh: https://vnexpress.net/kinh-doanh \
TBKTSG Online: https://tbktsg.vn \
NDH: https://ndh.vn \
VietnamFinance: https://vietnamfinance.vn \
Investing.com VN: https://vn.investing.com \
TradingView VN: https://vn.tradingview.com \
Dữ liệu VN-Index/VN30: Cafef, Vietstock, FireAnt \
\
=== QUY TẮC === \
- Mỗi mục kèm nguồn + thời điểm lấy số liệu. \
- Mỗi tin/mã nêu kèm lý do 'tại sao đáng chú ý'. \
- Nếu hôm đó KHÔNG có gì nổi bật → nói thẳng, ĐỪNG cố nhồi. \
- Link viết dạng markdown [Tên](URL). \
\
=== VIẾT NHƯ NGƯỜI, KHÔNG GIỌNG AI === \
- Phân tích phải CỤ THỂ: nêu số + lý do nhân-quả thật, đừng gắn đuôi rỗng 'góp phần/thể hiện/phản ánh/qua đó tạo nên/mang lại'. \
- Cấm sáo rỗng: vô cùng, đáng chú ý (rỗng), không thể phủ nhận, trong bối cảnh, bức tranh tổng thể, đầy biến động, tâm điểm dòng tiền. \
- Cấm bộ ba nhồi cho đủ và cấm 'không chỉ... mà còn...'. Cắt danh từ hóa thừa (sự/việc/tính/một cách) khi câu vẫn rõ. \
- Cấm gạch ngang dài (— và –) trong văn; thay bằng dấu phẩy, chấm hoặc ngoặc. Đừng rào đón chồng chất 'có lẽ phần nào có thể'. \
- Câu dài ngắn xen kẽ. Phần nhận định phải có chính kiến rõ + rủi ro thật, đừng kết kiểu 'triển vọng tươi sáng' chung chung. \
- In đậm CHỈ cho số quan trọng, đừng bôi tràn lan. Emoji chỉ ở header mục, đừng rải trong câu. \
\
=== ĐỊNH DẠNG === \
- Dùng emoji header (📍 cho tin VN, 📊 cho chứng khoán, 🔮 cho nhận định). \
- **bảng markdown** cho số liệu so sánh (nếu cần). \
- **đậm** cho số quan trọng. \
- In TOÀN BỘ báo cáo ra stdout. TUYỆT ĐỐI KHÔNG bịa số — không lấy được thì ghi 'chưa lấy được'. \
\
=== DÒNG DỮ LIỆU CHO BIỂU ĐỒ (BẮT BUỘC — DÒNG CUỐI CÙNG) === \
Kết thúc, in ĐÚNG 1 dòng bắt đầu bằng '@@DATA ' rồi các cặp KEY=VALUE cách nhau bởi khoảng trắng. \
VALUE là SỐ THUẦN: không đơn vị, không ký hiệu, không dấu phẩy ngăn nghìn. \
Key chuẩn cho VN: VNINDEX = điểm VN-Index; VN30 = điểm VN30; HNX = điểm HNX-Index; \
DXY = chỉ số USD index; DONG = tỷ giá USD/VND; \
Chỉ ghi key có SỐ THẬT vừa lấy được; key nào không có thì BỎ HẲN. \
Ví dụ: @@DATA VNINDEX=1281 VN30=1357 HNX=234 DXY=105.5 DONG=25450" \
  --allowedTools "Bash WebSearch WebFetch Read Glob Grep" \
  --output-format json \
  --append-system-prompt-file "${LUCY_PERSONA:-$HOME/lucy/bridge/persona.md}" \
  < /dev/null > "$RES" 2>/dev/null || true

# B1: cộng token vòng claude -p vào token-guard CHUNG (fire-and-forget, không gãy cron)
python3 "$(dirname "$0")/report_tok.py" "$RES" "vn" sonnet 2>/dev/null || true

# 2. Tách full report + bản gọn Telegram
python3 -c "
import json, re
d = json.load(open('$RES'))
full = (d.get('result') or '').strip()
if not full:
    full = '(vn digest lỗi — không lấy được nội dung)'
# tách dòng @@DATA
data = [l.strip() for l in full.split('\n') if l.strip().startswith('@@DATA')]
open('$DATA_LINE','w',encoding='utf-8').write(data[-1] if data else '')
# bỏ @@DATA khỏi report
full = '\n'.join(l for l in full.split('\n') if not l.strip().startswith('@@DATA')).strip()
open('$MD_OUT','w', encoding='utf-8').write(full)
# bản Telegram: bỏ dòng bảng markdown
tg = '\n'.join(l for l in full.split('\n') if not re.match(r'^\s*\|', l))
print(tg[:3000])
" 2>/dev/null > "$SUMM_FILE" || { echo "(vn digest lỗi)" > "$SUMM_FILE"; echo "(vn digest lỗi)" > "$MD_OUT"; }

SUMMARY="$(cat "$SUMM_FILE")"

# 2b. Ghi số liệu cho chart
if [ -s "$DATA_LINE" ]; then
  SET_ARGS="$(sed 's/^@@DATA[[:space:]]*//' "$DATA_LINE")"
  if [ -n "$SET_ARGS" ]; then
    LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/lucy_data.mjs" record \
      --date "$DATE_STR" --session "$SLUG" --set $SET_ARGS 2>/dev/null \
      && echo "$(date '+%H:%M') DATA recorded: $SET_ARGS" || true
  fi
fi

# 3. Convert MD → HTML
if [ -s "$MD_OUT" ]; then
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" report \
    "$MD_OUT" "$SUMM_FILE" "$HTML_OUT" "$DATE_STR" 2>/dev/null || true
fi

# 4. Host trên VPS
PUBLIC_URL=""
if [ -s "$HTML_OUT" ]; then
  cp "$HTML_OUT" "$ARCHIVE/vn-$DATE_STR-$SLUG.html"
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" index 2>/dev/null || true
  PUBLIC_URL="$PUBLIC_BASE/archive/vn-$DATE_STR-$SLUG.html"
fi

# 5. Gửi Telegram
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"

if [ -n "$PUBLIC_URL" ]; then
  MSG="📍 *$LABEL* — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
else
  MSG="📍 *$LABEL* — $DATE_STR

$SUMMARY

⚠️ Tạo HTML thất bại — xem file: $MD_OUT"
fi

# gửi an toàn: parse_mode=Markdown, lỗi parse entities → tự gửi lại plain (không mất tin)
source "$(dirname "$0")/lib/tg_send.sh"
tg_send "$API" "$LUCY_ALLOWED_USER_ID" "$MSG" || true

echo "done [$SESSION]."
