#!/bin/bash
# Fix tech-digest + crontab — chạy 1 lần bởi Claude Opus
# Được schedule bởi at

cd /root/lucy-workspace

# Log
echo "===== Fix Tech Digest + Info — $(date) =====" >> /root/lucy-workspace/tech-cron.log

# Gọi Claude Code model Opus để tự sửa lỗi
claude \
  --model claude-opus-4-20250514 \
  --allow-dangerously-skip-permissions \
  --print \
  -p "Bạn là Lucy AI — hãy dùng tool Bash/Read/Write/Edit để sửa các lỗi sau:

1. **Script cron_tech.sh**: /root/lucy/bridge/cron_tech.sh
   - Lỗi: '--dangerously-skip-permissions cannot be used with root/sudo privileges'
   - Fix: Đọc file, xoá hoặc sửa flag --permission-mode bypassPermissions. Nếu cần thì thêm --allow-dangerously-skip-permissions. Đảm bảo script chạy được với root.

2. **Crontab mất dòng**: Dòng tech-digest biến mất khỏi crontab
   - Fix: Chạy 'crontab -e' hoặc 'crontab -l | ...' để thêm lại dòng:
     0 8 * * * /root/lucy/bridge/cron_tech.sh >> /root/lucy-workspace/tech-cron.log 2>&1

3. **Verify**: Chạy thử script xem còn lỗi không và ghi log.

Hãy làm từng bước và báo kết quả." 2>&1 | tee -a /root/lucy-workspace/tech-cron.log

echo "===== Fix complete — $(date) =====" >> /root/lucy-workspace/tech-cron.log
