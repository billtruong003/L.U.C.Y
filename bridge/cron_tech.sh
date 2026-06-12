#!/usr/bin/env bash
# Daily Tech Digest — AI mới ra mắt + Game Tech + Upcoming news
# Chạy 1 lần/ngày lúc 8h sáng:
#   0 8 * * * /root/lucy/bridge/cron_tech.sh >> /root/lucy-workspace/tech-cron.log 2>&1
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a

# Guard: chờ claude rảnh (≤1 process) tối đa 10 phút, nếu vẫn bận thì bỏ qua
_WAIT=0; _MAX=600
while [ "$(pgrep -c claude 2>/dev/null || echo 0)" -gt 1 ] && [ $_WAIT -lt $_MAX ]; do
  sleep 15; _WAIT=$((_WAIT+15))
done
if [ $_WAIT -ge $_MAX ]; then
  echo "$(date '+%Y-%m-%d %H:%M') SKIP: claude busy sau ${_MAX}s — tech digest bỏ qua lần này"
  exit 0
fi

WORKDIR="${LUCY_WORKDIR:-$HOME/lucy-workspace}"; mkdir -p "$WORKDIR"
WEB_ROOT="/var/www/lucy-reports"
ARCHIVE="$WEB_ROOT/archive"
mkdir -p "$ARCHIVE"
PUBLIC_BASE="${LUCY_REPORTS_URL:-http://14.225.255.73/reports}"

DATE_STR="$(date +%F)"
MD_OUT="$WORKDIR/tech-$DATE_STR.md"
HTML_OUT="$WORKDIR/tech-$DATE_STR.html"
RES="$(mktemp)"
SUMM_FILE="$(mktemp)"

# Chạy lại an toàn: '--if-missing' chỉ chạy khi digest hôm nay CHƯA hợp lệ (dùng cho cron retry)
if [ "${1:-}" = "--if-missing" ] && [ -f "$MD_OUT" ] && grep -q 'TOP 3' "$MD_OUT" 2>/dev/null; then
  echo "[skip] tech digest $DATE_STR đã hợp lệ, bỏ qua retry."
  exit 0
fi

# 1. Claude research digest công nghệ phân tầng
"${CLAUDE_BIN:-claude}" -p \
  "Hôm nay là $DATE_STR. Nhiệm vụ: tổng hợp DIỄN BIẾN CÔNG NGHỆ ĐÁNG CHÚ Ý NHẤT trong 24h qua. \
LỌC NHIỄU MẠNH TAY — ưu tiên thứ thực sự quan trọng, BỎ tin câu view/PR/quảng cáo. Research THẬT trên web, mọi mục kèm link.

=== PHÂN TẦNG CHỦ ĐỀ ===
TẦNG 1 — quét mỗi ngày, luôn báo nếu có:
- AI / LLM / foundation models: model mới, benchmark, kỹ thuật, agent, tooling, MCP
- Software dev: ngôn ngữ, framework, backend, database, dev tools
- Game development: engine, kỹ thuật, công cụ, postmortem
- Game news: tựa game lớn, ra mắt, sự kiện ngành game
- Big Tech: động thái đáng kể từ Apple, Google, Meta, Microsoft, OpenAI, Anthropic, Nvidia...
- Engineering deep-dives thiên về CODE: system design, kiến trúc, bài kỹ thuật chất

TẦNG 2 — CHỈ báo khi BOM TẤN (tin lớn làm thay đổi cuộc chơi, kiểu SpacetimeDB ra mắt; cộng đồng bàn mạnh, tác động rộng):
- Hệ thống/nền tảng/infra mới, hardware/chip/semiconductor, Security (chỉ CVE/breach lớn), Science/deep-tech (lượng tử/robotics/space), Tech policy/regulation.
- Bình thường BỎ QUA tầng 2. Đừng nhồi tin lẻ tẻ.

TẦNG 3 — CRYPTO (thứ yếu, GÓC TRADING): chỉ tin tác động giá/cơ hội (động thái lớn, quy định, hack/exploit, ra mắt sản phẩm lớn, dòng tiền). Bỏ tin shill. Hôm nào không có gì đáng kể → BỎ luôn mục này.

=== NGUỒN (kiểm lần lượt) ===
Aggregator: Hacker News (top + Show HN), Lobsters, GitHub Trending, r/LocalLLaMA, r/programming, r/gamedev.
AI: blog OpenAI/Anthropic/Google DeepMind/Meta AI, Hugging Face trending, Arxiv (cs.AI/cs.LG/cs.CL).
Tin: TechCrunch, The Verge, Ars Technica. Game: nguồn dev + news uy tín. Crypto: nguồn uy tín (cho Tầng 3). Engineering blogs hãng lớn cho deep-dive.

=== QUY TẮC LỌC ===
- Chỉ tin trong 24h qua (trừ Radar Sự kiện). Bỏ tin cũ/trùng/PR.
- Mỗi mục KÈM lý do 'tại sao đáng đọc', không chỉ tiêu đề.
- Phân biệt rõ Tầng 1 (báo bình thường) vs Tầng 2 (chỉ khi bom tấn).
- Nếu Tầng 1 hôm đó không có gì nổi bật → NÓI THẲNG, đừng cố nhồi.

=== ĐỊNH DẠNG OUTPUT (giữ y format này, dùng emoji header KHÔNG dùng dấu #) ===
📅 $DATE_STR

🔥 TOP 3 (đọc ngay)
1. [Tiêu đề] — 1 câu tóm tắt + tại sao quan trọng. [link]

🤖 AI / LLM
- [Tiêu đề] — tóm tắt 1 dòng + tại sao đáng đọc. [link]

💻 SOFTWARE DEV
- ...

🎮 GAME (DEV + NEWS)
- ...

🏢 BIG TECH
- ...

📐 DEEP-DIVE (nếu có bài hay)
- ...

💥 BOM TẤN KHÁC (Tầng 2 — chỉ khi có)
- ...

💰 CRYPTO (góc trading — chỉ khi có)
- ...

🗓️ RADAR SỰ KIỆN
Sắp tới: [sự kiện] — còn [X ngày]
Vừa qua: [sự kiện] — [X ngày trước]

=== YÊU CẦU KỸ THUẬT ===
- Giữ digest đọc hết trong 5 phút. Tiếng Việt, giữ thuật ngữ kỹ thuật bằng tiếng Anh.
- Link viết dạng markdown [Tên](URL).
- In TOÀN BỘ digest (đầy đủ, đúng format trên) ra stdout làm CÂU TRẢ LỜI CHÍNH. KHÔNG cần tự ghi file — script sẽ tự lưu.
- Xưng em, gọi chủ nhân. TUYỆT ĐỐI KHÔNG bịa — không tìm/không chắc thì ghi 'chưa tìm được'." \
  --permission-mode bypassPermissions \
  --output-format json \
  --append-system-prompt-file "${LUCY_PERSONA:-$HOME/lucy/bridge/persona.md}" \
  < /dev/null > "$RES" 2>/dev/null || true

# 2. Tách full digest (ghi MD) + bản gọn Telegram — KHÔNG phụ thuộc model tự ghi file
python3 -c "
import json
d = json.load(open('$RES'))
full = (d.get('result') or '').strip()
if not full:
    full = '(tech digest lỗi — không lấy được nội dung)'
open('$MD_OUT','w', encoding='utf-8').write(full)
print(full[:3000])           # bản gọn cho Telegram
" 2>/dev/null > "$SUMM_FILE" || { echo "(tech digest lỗi)" > "$SUMM_FILE"; echo "(tech digest lỗi)" > "$MD_OUT"; }

SUMMARY="$(cat "$SUMM_FILE")"

# Digest có HỢP LỆ không? (phải có 'TOP 3'). Nếu lỗi → KHÔNG post rác lên Discord.
VALID=0; grep -q 'TOP 3' "$MD_OUT" 2>/dev/null && VALID=1

# 3. Convert MD → HTML
if [ -s "$MD_OUT" ]; then
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" report \
    "$MD_OUT" "$SUMM_FILE" "$HTML_OUT" "$DATE_STR" 2>/dev/null || true
fi

# 4. Host trên VPS
PUBLIC_URL=""
if [ -s "$HTML_OUT" ]; then
  cp "$HTML_OUT" "$ARCHIVE/tech-$DATE_STR.html"
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" index 2>/dev/null || true
  PUBLIC_URL="$PUBLIC_BASE/archive/tech-$DATE_STR.html"
fi

# 5. Gửi Telegram
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"

if [ "$VALID" != 1 ]; then
  # Digest lỗi → chỉ báo riêng chủ nhân qua Telegram, KHÔNG post Discord
  MSG="⚠️ *Tech Digest* — $DATE_STR: em chưa lấy được nội dung (claude lỗi tạm thời). Cron sẽ tự thử lại lúc 8:20, hoặc chủ nhân kêu em chạy lại."
elif [ -n "$PUBLIC_URL" ]; then
  MSG="🔬 *Tech Digest* — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
else
  MSG="🔬 *Tech Digest* — $DATE_STR

$SUMMARY

⚠️ Tạo HTML thất bại — xem file: $MD_OUT"
fi

curl -s "$API/sendMessage" \
  -d chat_id="$LUCY_ALLOWED_USER_ID" \
  -d parse_mode="Markdown" \
  --data-urlencode "text=$MSG" \
  >/dev/null || true

# 6. Discord qua Aki — chỉ post vào THREAD (không post vào channel elder lounge)
TECH_DISCORD_THREAD="${LUCY_TECH_DISCORD_THREAD:-1513957545419608174}"     # thread archive
if [ "$VALID" = 1 ] && [ -n "$RADIANT_BOT_AGENT_SECRET" ]; then
  DISCORD_MSG="$(mktemp)"
  # Dựng tin: dòng template phân cách ngày + TOP 3 + link. Đếm "tin nóng" = số item trong digest.
  MD_OUT="$MD_OUT" DATE_STR="$DATE_STR" PUBLIC_URL="$PUBLIC_URL" PUBLIC_BASE="$PUBLIC_BASE" python3 -c "
import re, os
md   = open(os.environ['MD_OUT'], encoding='utf-8').read()
ds   = os.environ['DATE_STR']                       # YYYY-MM-DD
y,m,d = ds.split('-'); date_disp = f'{d}/{m}/{y}'
# đếm tin nóng: số dòng item (1. ... ) + (- ...) trong toàn digest
n = len(re.findall(r'(?m)^\s*(?:\d+\.|[-•])\s+\S', md))
# trích TOP 3
mt = re.search(r'🔥 TOP 3.*?(?=\n🤖|\n💻|\n🎮|\n🏢|\n📐|\n💥|\n💰|\n🗓️|\Z)', md, re.S)
top3 = mt.group(0).strip() if mt else '(chưa lấy được TOP 3)'
if len(top3) > 1300: top3 = top3[:1300].rstrip() + ' …'
lines = [f'📅 **{date_disp}** | 🔬 Tech Digest ({n} tin nóng)',
         '━━━━━━━━━━━━━━━━━━━━', '', top3, '']
if os.environ.get('PUBLIC_URL'): lines.append('📄 Full report: ' + os.environ['PUBLIC_URL'])
lines.append('📚 Tất cả báo cáo: ' + os.environ['PUBLIC_BASE'] + '/#tech')
open('$DISCORD_MSG','w', encoding='utf-8').write('\n'.join(lines))
" 2>/dev/null
  # Post chỉ vào thread (không post vào channel elder lounge)
  for TARGET in "$TECH_DISCORD_THREAD"; do
    [ -n "$TARGET" ] || continue
    TARGET="$TARGET" MSG_FILE="$DISCORD_MSG" python3 -c "
import json, hmac, hashlib, urllib.request, urllib.error, os
api  = os.environ.get('RADIANT_BOT_API_URL','http://127.0.0.1:3030').rstrip('/')
sec  = os.environ.get('RADIANT_BOT_AGENT_SECRET','')
ch   = os.environ['TARGET']
text = open(os.environ['MSG_FILE'], encoding='utf-8').read().strip()[:1900]
raw  = json.dumps({'channel': ch, 'text': text}, ensure_ascii=False).encode('utf-8')
sig  = 'sha256=' + hmac.new(sec.encode(), raw, hashlib.sha256).hexdigest()
req  = urllib.request.Request(api+'/api/agent/post', data=raw, method='POST',
         headers={'content-type':'application/json','x-lucy-signature':sig})
try:
  with urllib.request.urlopen(req, timeout=30) as r: print('OK', ch, r.read().decode())
except urllib.error.HTTPError as e: print('ERR', ch, e.code, e.read().decode())
" >> /root/lucy-workspace/tech-cron.log 2>&1 || true
  done
  rm -f "$DISCORD_MSG"
fi

rm -f "$RES" "$SUMM_FILE"
