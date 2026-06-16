#!/usr/bin/env bash
# Stylized Shader Kit — runner LOOP nhiều sprint/window (mỗi sprint = 1 call riêng, khỏi timeout).
# Làm sprint N → push GitHub → notify → N++ → sprint kế... tới khi hết token / BLOCKED / hết sprint thì ngưng.
# Bill chốt 2026-06-16. Crontab: 40 4 * * * (token-window sáng) + chạy tay khi cần.
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export IS_SANDBOX=1

REPO_NAME="stylized-toon-world-kit"; OWNER="billtruong003"
KIT_DIR="/root/lucy-workspace/shader-kit"
SPEC="/root/lucy-workspace/stylized-shader-kit-spec.md"
STATE="/root/lucy/shader-sprint.state"
NUM_SPRINTS=6          # 0=Nền,1=P1,2=P3,3=P2,4=P4,5=P5
MAX_PER_RUN=6          # tối đa số sprint 1 window (an toàn, thực tế token sẽ chặn sớm)
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"; TG="$LUCY_ALLOWED_USER_ID"
tgsend(){ [ -n "$TELEGRAM_BOT_TOKEN" ] && curl -s "$API/sendMessage" -d chat_id="$TG" --data-urlencode text="$1" >/dev/null 2>&1 || true; }

# Guard: chờ claude rảnh ≤30'
_W=0; while [ "$(pgrep -c claude 2>/dev/null)" -gt 1 ] && [ $_W -lt 1800 ]; do sleep 15; _W=$((_W+15)); done

# GitHub token (KHÔNG echo) + tạo repo idempotent + git setup (1 lần)
GHTOK=$(grep -oE 'https://[^@]+@github.com' ~/.git-credentials 2>/dev/null | head -1 | sed -E 's#https://[^:]+:([^@]+)@github.com#\1#')
if [ -n "$GHTOK" ]; then
  curl -s -o /dev/null -H "Authorization: Bearer $GHTOK" -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO_NAME\",\"description\":\"Stylized Toon World Kit — URP/Unity6 shader packs (Mobile/PC/VR)\",\"private\":false}" 2>/dev/null || true
fi
mkdir -p "$KIT_DIR"
if [ ! -d "$KIT_DIR/.git" ]; then
  git -C "$KIT_DIR" init -q
  git -C "$KIT_DIR" remote add origin "https://github.com/$OWNER/$REPO_NAME.git" 2>/dev/null || true
  git -C "$KIT_DIR" config user.email "lucy@billtruong.dev" 2>/dev/null || true
  git -C "$KIT_DIR" config user.name "Lucy (for Bill)" 2>/dev/null || true
fi

run_one_sprint(){   # $1 = N → in status: LIMIT|DONE|BLOCKED
  local N="$1" RES OUT
  RES="$(mktemp)"
  local P="Bạn là Lucy + Technical Artist, làm ĐÚNG 1 SPRINT của 'Stylized Toon World Kit'. \
ĐỌC TRƯỚC: spec $SPEC ('KẾ HOẠCH SPRINT' + 'NGUYÊN TẮC THIẾT KẾ') + memory vault 'unity-shader-version-gotchas'. \
RESUME-AWARE: TRƯỚC TIÊN \`git -C $KIT_DIR log --oneline 2>/dev/null | head -20\` + liệt kê file trong $KIT_DIR để biết ĐÃ làm tới đâu (sprint trước có thể DỞ vì hết token). Tiếp tục phần CÒN THIẾU, KHÔNG làm lại. \
SPRINT HIỆN TẠI = $N (0=Nền: repo + P0 Core Library 5 .hlsl include + URPCompat Forward+/SRP-batcher/instancing/VR-single-pass + README + ShaderGUI base C#; 1=P1 Toon+Outline; 2=P3 VFX; 3=P2 Environment; 4=P4 Surface; 5=P5 NPR). LÀM CHỈ sprint $N, NHỎ GỌN. \
Code vào $KIT_DIR. Nguyên tắc: optimize draw-call/batch, target Mobile/PC/VR, ShaderGUI mỗi shader, block-comment đầu file, modular trỏ P0, URP17/Unity6 trước rồi ghi case down-version. \
RESEARCH trước khi viết (WebFetch docs Unity URP + Cyanilux/MinionsArt/Ilett/Jettelly/ameye/Roystan; tham khảo repo Bill billtruong003). \
⭐ LƯU DOCS-RAG: mỗi trang docs/nguồn QUAN TRỌNG fetch để học → LƯU bản markdown sạch vào /root/lucy/lucy-vault/Reference/unity-urp/<slug>.md (mkdir nếu chưa có; ghi rõ URL nguồn + ngày ở đầu file). KIỂM thư mục đó TRƯỚC khi fetch — nếu đã có thì ĐỌC lại (recall), khỏi fetch lại + dùng chung mọi sprint. \
HỌC CASE MỚI → ghi vault memory unity-shader-version-gotchas (additive). \
XONG: git add -A && git commit -m 'sprint $N: ...' && git push -u origin HEAD:main (creds ~/.git-credentials, KHÔNG echo token). \
DÒNG CUỐI: 'SHADER_SPRINT: DONE — <tóm tắt>' nếu xong; 'SHADER_SPRINT: BLOCKED — <lý do>' nếu kẹt."
  timeout 2400 "${CLAUDE_BIN:-claude}" -p "$P" --model claude-opus-4-8 --permission-mode bypassPermissions \
    --append-system-prompt-file "${LUCY_PERSONA:-$HOME/lucy/bridge/persona.md}" \
    --add-dir "${LUCY_VAULT:-/root/lucy/lucy-vault}" --add-dir "$KIT_DIR" \
    --output-format json < /dev/null > "$RES" 2>/dev/null || true
  OUT="$(python3 -c "import json;print((json.load(open('$RES')).get('result') or '')[:1500])" 2>/dev/null)"
  echo "$OUT" | tail -4 >&2
  if echo "$OUT" | grep -q "session limit"; then echo "LIMIT";
  elif echo "$OUT" | grep -q "SHADER_SPRINT: DONE"; then
    tgsend "✅ Shader Sprint $N XONG → push https://github.com/$OWNER/$REPO_NAME. $(echo "$OUT" | grep -o 'SHADER_SPRINT: DONE.*' | head -c 280)"; echo "DONE";
  else tgsend "⚠️ Shader Sprint $N kẹt/chưa trọn. $(echo "$OUT" | tail -c 250)"; echo "BLOCKED"; fi
}

echo "$(date '+%Y-%m-%d %H:%M') === SHADER RUN START ==="
done_cnt=0
for i in $(seq 1 $MAX_PER_RUN); do
  N=$(cat "$STATE" 2>/dev/null || echo 0); N=${N:-0}
  if [ "$N" -ge "$NUM_SPRINTS" ]; then echo "ALL SPRINTS DONE"; [ $done_cnt -gt 0 ] && tgsend "🎉 Shader Kit: tất cả $NUM_SPRINTS sprint XONG."; break; fi
  [ $i -eq 1 ] && tgsend "🧩 Shader Kit — window mới, bắt đầu từ Sprint $N. Em làm liên tiếp tới khi hết token."
  ST="$(run_one_sprint "$N")"
  echo "$(date '+%H:%M') sprint $N → $ST"
  if [ "$ST" = "DONE" ]; then echo "$((N+1))" > "$STATE"; done_cnt=$((done_cnt+1)); continue
  elif [ "$ST" = "LIMIT" ]; then tgsend "⏳ Hết token ở Sprint $N — ngưng, cron 04:40 chạy tiếp từ đây."; break
  else break; fi   # BLOCKED → dừng để Bill xem
done
echo "$(date '+%H:%M') === SHADER RUN END (làm $done_cnt sprint) ==="
