#!/usr/bin/env bash
# Wrapper chạy auto-build.py với model opus, load env, logrotate đơn giản
set -euo pipefail

cd /root/lucy

# Load env nếu có
[ -f .env ] && export $(grep -v '^#' .env | xargs -d '\n' -r)

# Ép model claude_opus (script đọc ENV MODEL hoặc --model)
export MODEL="claude-opus-4-20250514"

# Log file rotation (giữ 7 ngày)
LOGFILE="/root/lucy/logs/auto-build-$(date +%F).log"
mkdir -p /root/lucy/logs
exec >>"$LOGFILE" 2>&1
find /root/lucy/logs -name 'auto-build-*.log' -mtime +7 -delete

echo "=== $(date '+%F %T') START auto-build (opus) ==="
python3 auto-build.py --max-tasks 8 --hours 2
echo "=== $(date '+%F %T') END auto-build ==="
