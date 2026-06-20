---
title: Lucy vs Hermes — parity check (sau khi publish HQ+GD+memory)
date: 2026-06-19
agent: lucy
hermes_rev: c02192f (NousResearch/hermes-agent, pull mới nhất)
---

# Lucy vs Hermes — đã ngang chưa?

Đối chiếu Hermes mới nhất (2368 file py) với Lucy hiện tại (đã có HQ-1/2/3 + GD-1/2 + memory fix).

## Verdict ngắn
- **Theo ĐÚNG vai Lucy (trợ lý cá nhân Telegram): NGANG — vài chỗ VƯỢT.**
- **Theo bề mặt tính năng tổng (Hermes = product khổng lồ đa mặt): ~60-70%** — nhưng phần lớn cái thiếu là Lucy KHÔNG cần.
- **1 lỗ hổng THẬT đáng vá: auto context-compression** (chat Telegram dài ngày sẽ tràn context).

## Lucy NGANG Hermes
- System prompt 3 tầng + prefix-cache (buildSystemPrompt — vừa nâng HQ).
- Model-aware guidance (HQ-1) · verify-before-done (HQ-2, contract còn chặt hơn Hermes).
- Tool web/file/git/MCP · session resume · turn-log · web dashboard (hub).
- Fallback model rẻ (lane FALLBACKS).

## Lucy VƯỢT Hermes (điểm mạnh nhất)
- **Memory sâu hơn hẳn**: Hermes dừng ở recall snapshot (Phase 0). Lucy có thêm **Phase 2 episodic** (nhớ từng lượt xuyên phiên) + **Phase 3 consolidation** (gộp/sửa fact Mem0) + **Phase 4 bi-temporal** (valid_to, A→B→C). Hermes KHÔNG có 3 cái này.
- **Graceful degradation 2 tầng** (GD): Claude sập → lane gánh + banner. Hermes chỉ có error-handling, không có cầu claude↔lane → có thể abort. Lucy "không bao giờ chết".

## Hermes CÒN HƠN
- 🔴 **Auto context-compression** (`context_compressor.py`): tự nén hội thoại khi tràn context. Lucy chỉ có L3 compressor cho lane, *claude-path chat chính chưa auto-nén* → chat dài ngày phải `/new` tay. **Đây là gap đáng vá nhất.**
- 🟡 Skill tự-cải-tiến ghi thẳng SKILL.md (Lucy đi đường signal→dream, chậm hơn).
- 🟡 Taxonomy lỗi phong phú hơn (auth/billing/rate/overflow/content-policy). Lucy outcome-focused.

## Hermes CÓ mà Lucy KHÔNG CẦN (đừng ôm)
browser automation · image-gen · billing/credits portal · TUI · Slack/Discord · multi-provider adapter (Azure/Bedrock/Copilot) · codex/copilot ACP. Đây là product dev-agent đa khách — Lucy là trợ lý cá nhân 1 người, không cần.

## Kết luận
Để làm tốt vai trò của Lucy → **đã đủ và ngang Hermes**, riêng memory + uptime thì vượt. Muốn "ngang tuyệt đối về kỹ thuật core" → còn đúng **1 việc đáng làm: auto context-compression cho claude-path** (HQ-4 synthesis pass + nén giữa-hội-thoại là họ hàng). Phần còn lại Hermes hơn là do nó là product to, ngoài phạm vi Lucy.
