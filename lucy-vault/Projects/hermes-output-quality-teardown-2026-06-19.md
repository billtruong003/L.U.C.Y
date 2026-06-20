---
title: Vì sao Hermes output tốt hơn Lucy — teardown & cách áp dụng
date: 2026-06-19
agent: lucy
trigger: Bill muốn Lucy đạt chất lượng output như Hermes (chấp nhận đốt token hơn)
---

# Hermes output quality teardown

Mổ source Hermes trên VPS (`references/hermes-agent/`, `/root/hermes-webui`, `/usr/local/lib/hermes-agent`). Tìm ra **5 bí quyết** khiến output Hermes kỹ/đẹp hơn — và token nó đốt thêm mua được gì.

## 5 bí quyết (có dẫn chứng)

1. **System prompt 3 tầng (stable / context / volatile) + reuse prefix-cache.**
   `agent/system_prompt.py:62-79`, persist session DB `conversation_loop.py:225-337`. Instruction lõi luôn ổn định qua mỗi turn → model không bị "loãng" bởi context động, cache ấm.
   → Lucy: ❌ chưa (1 persona.md phẳng).

2. **Model-specific execution guidance.** GPT ≠ Gemini ≠ Claude được dặn khác nhau (`prompt_builder.py:315-395`), + block "finish the job" bắt **verify output thật, không mô tả suông** (`:292-305`).
   → Lucy: ❌ chưa (persona generic, không model-aware).

3. **Background review fork** sau mỗi turn — spawn agent phụ tự hỏi "nên lưu memory/skill gì?", tool whitelist (`background_review.py:1-148`). Học nhanh ngay trong phiên.
   → Lucy: ⚠️ một phần (brain-signal + episodic ghi async nhưng KHÔNG fork → ngấm chậm qua dream).

4. **Iteration-limit synthesis.** Khi vòng tool quá dài, gọi thêm 1 API (no-tool) để **tóm tắt + polish** ra câu trả lời thật, thay vì trả "I hit the limit" (`chat_completion_helpers.py:1390-1519`).
   → Lucy: ❌ chưa (hết iteration là fail).

5. **Dạy model phân biệt memory vs skill** ngay trong prompt (`prompt_builder.py:143-179`) → lưu đúng chỗ, ít rác.
   → Lucy: ⚠️ một phần.

## Token thêm mua được gì
Phần lớn token "dư" của Hermes nằm ở: (a) background fork review mỗi turn, (b) synthesis/polish pass cuối, (c) enforce verify (chạy thật rồi mới chốt). Đây chính là 3 thứ làm output "có đáy" thay vì nông.

## Top 3 đổi để Lucy ngang Hermes (ROI cao→thấp)
1. **Model-aware persona block** — coordinator đã biết model, chỉ cần inject guidance theo family. (~1-2 ngày)
2. **Synthesis/polish pass cuối** — trước khi trả output cuối (hoặc khi hết iteration), 1 API no-tool tóm tắt+đánh bóng. (~vài giờ)
3. **Verify-before-done enforcement** — bắt chạy/kiểm chứng thật, cấm "mô tả suông". (prompt-level)

## Áp dụng NGAY vào harness cổng dự án
Cổng (`/lucy/`) sẽ build kiểu Hermes — **đa pass, không 1-shot**:
plan (chốt registry schema + template) → build (3 lớp) → **verify** (render thật, curl 200, thử register/remove 1 manifest giả) → **synthesize/polish** (rà giao diện + tự phê bình rồi sửa). Đốt token hơn build-1-phát nhưng ra "có đáy".
