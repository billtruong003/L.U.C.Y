---
name: cron-trend-radar-vn
description: "Cron \"Radar Trending VN\" 8h sáng — feed nội dung kênh tin (#3) + tín hiệu nhu cầu tool/service (#4)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0ded98c3-60c8-4e72-a49d-0ebcaeafa57e
---

Cron `cron_trend.sh` (đặt 2026-06-15, Bill duyệt) — `/root/lucy/bridge/cron_trend.sh`, crontab `0 8 * * *`, log `/root/lucy/cron-trend.log`.

Mục tiêu KÉP: (A) feed nội dung kênh tin/blog (idea #3 — biết viết gì ăn traffic), (B) bắt tín hiệu nhu cầu làm AI tool/service (idea #4 — biết làm gì người ta cần trả tiền). KHÁC `cron_vn.sh` (tin kinh tế/chứng khoán VN).

Phân tầng: Tầng1 luôn báo = tech/AI/dev/game/graphics hot VN+global; Tầng2 chỉ khi bùng to = viral xã hội/giải trí (sóng traffic). Cấu trúc: TOP trending + góc khai thác · tín hiệu nhu cầu tool · dev/AI radar (GitHub/HN/ProductHunt) · 3 góc nội dung đề xuất.

Tái dùng khuôn cron_vn.sh: env .env, guard chờ claude rảnh, `claude -p --model claude-opus-4-8 --allowedTools "Bash WebSearch WebFetch Read Glob Grep"` (KHÔNG bypass vì root — xem [[claude-root-permission-flag]]), persona.md, gen_brief.mjs (MD→HTML), archive `/var/www/lucy-reports/archive/trend-<date>.html`, tg_send.sh đẩy Telegram. Bỏ phần @@DATA/lucy_data.mjs (không cần chart).

Liên quan: idea #3/#4 trong vault `Projects/money-ideas.md`; hub http://14.225.255.73/reports/ideas-money-automation/ . Xem [[daily-brief-setup]] (cùng hạ tầng cron+report) và [[cronjob-prompt-methodology]] (công thức prompt).
