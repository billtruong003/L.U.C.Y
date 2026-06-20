---
name: lucy-productize-proposal
description: Proposal module hóa Lucy → sản phẩm self-host TUI; rào cản sống còn = Claude OAuth subscription bị Anthropic CẤM cho third-party
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d9843b7-bb2e-44d4-a41f-8960493c84ab
---

Proposal "Module hóa Lucy → sản phẩm tải về" (2026-06-17, tổng hợp Opus từ deep-research + audit codebase).
- Vault: `Projects/module-hoa-lucy-proposal.md` · Web: http://14.225.255.73/reports/module-hoa-lucy-proposal.html
- Findings thô: `Projects/module-hoa-lucy-research-raw.md` · /reports/module-hoa-lucy-research.html

**⚠️ Insight sống còn:** Anthropic ĐÃ CẤM dùng OAuth token Claude Free/Pro/Max trong tool bên thứ ba (KỂ CẢ Agent SDK) — chỉ Claude Code + Claude.ai chính thức. Lucy hiện chạy Claude qua subscription/OAuth → KHÔNG phát hành cho người lạ kiểu đó được. Bản phát hành PHẢI: BYO Anthropic API key HOẶC model-agnostic (tận dụng `llm-lane` 8 provider + Ollama local). Khuyến nghị model-agnostic mặc định.

**Hướng chốt (Bill):** bản phân phối = TUI/terminal siêu nhẹ kiểu Hermes (React/Ink, MIT), copy folder tách khỏi lucy gốc. KHÔNG bê web hub+pm2+nginx. License MIT. Kiếm tiền kiểu Postiz (free self-host + cloud tier, "charge only for cloud costs"). Định vị KHÁC chat-clone: "trợ lý AI cá nhân chủ động 24/7 + memory + auto-task".

**Lộ trình:** P0 spike (Lucy chạy KHÔNG cần Claude-OAuth, dùng model rẻ/API key → go/no-go) → P1 tách+template vault → P2 TUI → P3 đóng gói 1 lệnh → P4 cloud tier. Khi Bill chốt → auto-task/auto-build Sonnet làm từ P0. Liên quan [[auto-task-engine]].
