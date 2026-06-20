---
kind: brain-signal
topic: lucy/module-hoa-san-pham
signal: positive
principle: Bản phân phối Lucy = terminal-first TUI siêu nhẹ (kiểu Hermes), setup qua terminal, copy folder tách khỏi lucy gốc
created_at: 2026-06-17T18:00:00+07
agent: lucy
---

Bill chốt hướng MODULE HÓA Lucy thành sản phẩm tải về (2026-06-17):
- **Dạng phân phối = TUI/terminal siêu nhẹ kiểu Hermes**, KHÔNG phải web hub nặng. Setup hoàn toàn qua terminal.
- **Tách bằng copy folder ra** khỏi `/root/lucy` gốc → bản phát hành độc lập, không mang data/secret cá nhân theo.
- **Vụ token hardcode (tech_harness.py/vn_trending.py) tạm KỆ** vì bản module copy ra sẽ không chứa file đó; chỉ lo khi thực sự tách.

**How to apply:** proposal "module hóa Lucy" phải lấy con đường terminal/TUI nhẹ làm trục chính (CLI installer, ít dependency, không bắt buộc nginx/pm2 web stack), tham chiếu cách Hermes làm. Liên quan [[auto-task-engine]] + research workflow đang chạy.
