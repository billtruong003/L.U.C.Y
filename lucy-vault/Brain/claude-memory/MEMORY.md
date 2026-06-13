# Memory Index

- [Report every task](report-every-task.md) — ⭐Bill: xong mỗi task phải chủ động báo cáo (Telegram), không làm lặng lẽ
- [Owner = Bill Truong (billthedev)](owner-bill-truong-profile.md) — Game dev & Senior Technical Artist (Unity/VR/shader), tên thật Trương Ngọc Châu, HCMC→LA; FPT Univ SE; mê RPG-gamification + AI tooling. GitHub real = billtruong003 (NOT Bill-the-dev)
- [Bill identities & platforms](bill-identities-platforms.md) — bản đồ mọi handle (GitHub/LinkedIn/FB/IG/YouTube/itch) + trạng thái truy cập; FB/IG/LinkedIn login-wall, GitHub/portfolio/itch đào tốt
- [Lucy's take on owner](lucy-take-on-owner.md) — game/tech-art guy doing infra as side turf → keep devops answers gọn + copy-paste; real numbers only on markets

- [Lucy Hub web command center](lucy-hub-web-command-center.md) — pm2 `lucy-hub` on 127.0.0.1:8800, nginx :80 → http://14.225.255.73 (login pwd); no HTTPS/domain yet, no ufw
- [Lucy = bridge, not Hermes](lucy-bridge-replaces-hermes.md) — ⭐CURRENT: Telegram↔`claude -p` bridge under pm2 `lucy-bridge`; Hermes stopped+disabled (shared bot token = 409 if both run)
- [Hermes + Claude Max OAuth blocker](hermes-claude-max-oauth-extra-usage.md) — Max-token "extra usage" block; RESOLVED by routing through OmniRoute
- [OmniRoute VM hosting](omniroute-vm-hosting.md) — self-hosted LLM proxy (Docker :20128) fronting Claude OAuth for Lucy/Hermes
- [Lucy gateway = systemd --user](lucy-gateway-systemd-not-pm2.md) — restart via `systemctl --user restart hermes-gateway.service`, NOT pm2 (docs say pm2, wrong)
- [Secret handling](secret-handling-no-chat-no-echo.md) — ⚠️Bill: không hỏi/echo/cat secret qua chat; nhập secret là việc của Bill
- [Daily brief setup](daily-brief-setup.md) — cron 2 buổi (7h+17h): báo cáo HTML host http://14.225.255.73/reports/ → Telegram + Discord(Aki)
- [Cronjob prompt methodology](cronjob-prompt-methodology.md) — ⭐công thức prompt cronjob chuẩn (lọc nhiễu+phân tầng+nguồn cụ thể+TOP3+radar); PHẢI hỏi chủ nhân & liệt kê hướng đi trước khi lên/nâng cronjob
