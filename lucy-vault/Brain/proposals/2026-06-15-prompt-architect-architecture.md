# Kiến trúc đề xuất: Tính năng "Prompt Architect" cho Lucy Hub

> Cho chủ nhân (Bill). Soạn 2026-06-15 bởi Lucy. Đầu vào để chạy SPRINT sau (research → architect → sprint).
> Nguồn: deep-research 5 trục (academic APO + sản phẩm + clarifying questions + model rẻ + UX/personalization), đã trích từ 31 kết quả workflow + 2 claim verify. Dẫn nguồn ở cuối.

---

## TL;DR

- **Cơ chế lõi đã được chứng minh = meta-prompting** (1 model viết/sửa prompt cho model khác). Anthropic Prompt Improver làm đúng vầy: +30% accuracy, output chia **sections + XML tags**. Đây là blueprint gần 1:1 cho Prompt Architect.
- **ĐỪNG build full auto-optimizer** (APE/APO/DSPy/OPRO) — chúng cần *tập đánh giá + 300+ ví dụ + vòng lặp*. Quá mức cho 1 chat refiner. Mượn *heuristics* (section template + CoT + clarify), không chạy optimizer.
- **Clarify thông minh, không hỏi nhiều:** chỉ hỏi khi *thật sự mơ hồ* (intent-entropy gate) — hỏi đúng 10% input mơ hồ nhất → *gấp đôi* hiệu quả; batch 2-3 câu giá trị cao; tie-break nghiêng về trả lời. Chính là thuốc cho "não xanh".
- **Model rẻ DeepSeek đủ cho khâu này** (cấu trúc-hoá + hỏi làm rõ), rẻ ~90x frontier. NHƯNG model nhỏ *yếu khi tự suy ý mơ hồ phức tạp* → giữ vai trò structural + có nút *escalate lên Claude* (FrugalGPT cascade).
- **Moat = vòng phỏng vấn ý định + cá nhân hoá (nhớ phong cách user)**, KHÔNG phải "1-click optimize" (PromptPerfect kiểu đó đã đóng cửa 9/2026).
- **Tái dùng gần hết stack Lucy:** persona-chat.ts + lane DeepSeek/OmniRoute + recall Jina + hub chat SSE. MVP chủ yếu = thêm 1 persona + meta-prompt scaffold + lưu lịch sử.

---

## 1. LUỒNG KIẾN TRÚC

```
[Tab UI Hub /prompts]  user DÁN ngữ cảnh thô
        │
        ▼
[Endpoint hub]  (reuse chat SSE)
        │
        ▼
[Persona "Prompt Architect"]  ← system = META-PROMPT SCAFFOLD (mục 3)
   model: deepseek-chat (qua OmniRoute, non-reasoning)
        │
        ├─(a) RECALL Jina (nhỏ): phong cách + preference user (tuỳ chọn)
        │
        ├─(b) INTENT GATE: ngữ cảnh có mơ hồ không?
        │       • mơ hồ cao  → hỏi 2-3 câu làm rõ (batch) → chờ trả lời
        │       • rõ/ít mơ hồ → bỏ qua, đi thẳng output (tie-break: trả lời)
        │
        ▼
[OUTPUT]  prompt hoàn chỉnh chia SECTIONS (Role/Context/Task/Constraints/Output/Self-check)
   + (tuỳ chọn) 2-3 BIẾN THỂ nếu còn nhiều cách hiểu
   + điểm tự-chấm (scorecard)
        │
        ▼
[User EDIT]  sửa trực tiếp (edit dễ hơn viết từ đầu) → resubmit nếu cần
        │
        ▼
[LƯU]  versioned history (prompt + câu hỏi + edit user) → SQLite/vault (async)
        │
        ▼
[HỌC]  trích preference (ngôn ngữ, độ dài, style output...) → few-shot lần sau
        │
        └─[ESCALATE] nút "nâng cấp bằng Claude" khi prompt khó / user chưa ưng
```

---

## 2. THÀNH PHẦN & TÁI DÙNG (map vào stack Lucy)

| Thành phần | Dùng cái đã có | Việc mới |
|---|---|---|
| Chat UI | hub chat SSE | tab /prompts (sprint UI) |
| Hội thoại đa lượt | `persona-chat.ts` | thêm persona def "prompt-architect" |
| Model rẻ | lane + OmniRoute | route `deepseek-chat` + bật prompt caching |
| Hiểu user | recall Jina (FTS5+vector) | inject *nhỏ* style/preference |
| Trí nhớ | episodic + vault | bảng lịch sử prompt versioned + preferences |
| Escalate | claude -p / SDK | nút "improve với Claude" |

→ Phần lớn là *cấu hình persona + scaffold + lưu trữ*, không phải hệ thống mới.

---

## 3. META-PROMPT SCAFFOLD (trái tim — system prompt của persona)

Scaffold phải ép persona làm đúng 6 việc:

1. **Section template chuẩn** (theo Anthropic Improver / OpenAI Generate / PromptAgent):
   `Role · Context · Task · Constraints · Output format · Self-check` (+ Examples nếu có).
   Dùng XML-ish tags phân tách. *Kết luận/định dạng output để CUỐI.* Giữ NGUYÊN guideline user cung cấp.
2. **Meta-prompt rewrite 1 lần** (cơ chế đã chứng minh) — viết lại ý thô thành prompt cấu trúc.
3. **Clarify policy (intent-entropy gate):** chỉ hỏi khi 1 câu trả lời không thể thoả mọi cách hiểu hợp lý. Hỏi tối đa 2-3 câu *đúng facet thiếu*. Tie giữa hỏi/trả-lời → nghiêng trả lời (chống over-ask).
4. **Rewrite-then-edit:** luôn xuất 1 *bản nháp prompt* để user sửa; khi user trả lời câu hỏi → *tiêm câu trả lời vào prompt rồi xuất lại* (tốt hơn chat dài).
5. **Giữ vai trò structural:** KHÔNG cố suy diễn ý mơ hồ phức tạp (model rẻ dễ sai) → khi khó thì hỏi hoặc đề nghị escalate.
6. **Target-model aware:** hỏi/giả định prompt này để chạy model nào → chỉnh style (vd XML cho Claude) vì prompt *không transfer tốt* giữa model.
7. **KHÔNG EXECUTE:** chỉ refine yêu cầu, không chạy task, không đụng code (đúng spec chủ nhân).

---

## 4. CƠ CHẾ KHÁC BIỆT (tính năng đề xuất)

1. **Chế độ "Phỏng vấn ý định" (gated):** 2-3 câu sắc bén CHỈ khi mơ hồ cao. (Generative Active Task Elicitation; clarify đúng 10% mơ hồ nhất → gấp đôi hiệu quả.)
2. **Prompt Scorecard:** chấm bản nháp theo rubric (clarity/specificity/output-spec/constraints...) thang điểm + chỉ chỗ yếu → vừa là self-check, vừa dạy user. (Agentic Workers 15 tiêu chí/75.)
3. **Đa biến thể (reconcile 2 trường phái):** thay vì hỏi, xuất 2-3 *biến thể prompt* theo các cách hiểu khác nhau (theo GPT-5.2 "cover all intents"); user chọn. Dùng khi mơ hồ vừa.
4. **Học preference user:** nhớ phong cách (tiếng Việt, gọn, thích output dạng diff/bảng, domain hay làm) → auto-áp lần sau. (Memory 3 tầng, async, có TTL + user xoá được.)
5. **Side-by-side compare:** cho xem prompt cũ vs mới khác gì (usefulness 4.11/5 trong nghiên cứu) — giúp user *hiểu* tại sao tốt hơn.

---

## 5. RỦI RO / ANTI-PATTERN (né ngay từ thiết kế)

1. **Over-engineering optimizer:** full APO cần eval set + 300+ ví dụ → KHÔNG hợp chat single-shot. Dùng heuristic template, để DSPy-style scoring "sau" khi có dataset feedback.
2. **Model rẻ tự suy ý sâu → hỏng:** OPRO/self-reflection ở model nhỏ dễ sai, "viết lại tệ hơn". → giữ DeepSeek ở mức structure+clarify; escalate Claude cho ca khó.
3. **Hỏi quá nhiều = "não xanh":** intent gate + batch ≤3 + tie-break trả lời. User bỏ cuộc khi câu hỏi vô nghĩa.
4. **Context bloat:** đừng nhồi cả lịch sử (model rẻ loãng + tốn). Tách 3 tầng nhớ, recall nhỏ giọt, ghi async, TTL.
5. **Black-box 1-click:** PromptPerfect kiểu đó đã đóng cửa → moat là *interview + personalization*, không phải nút optimize trơn.

---

## 6. PHẠM VI MVP (sprint 1) vs ĐỂ SAU

**MVP (sprint 1) — chứng minh giá trị, ít rủi ro:**
- Persona "prompt-architect" (deepseek-chat qua OmniRoute) + meta-prompt scaffold (section template + clarify-gate + no-execute + rewrite-then-edit).
- Chat tab tối giản (reuse SSE) — input ngữ cảnh, output prompt chia sections.
- Lưu prompt cuối + câu hỏi vào lịch sử vault (async).
- Nút *escalate sang Claude* thủ công.

**Để sau (sprint 2+):**
- Học preference / few-shot từ lịch sử (cá nhân hoá).
- Prompt Scorecard UI + đa biến thể + side-by-side compare.
- Target-model tailoring.
- Versioned diff history UI + polish tab trong đợt đại tu UI.

---

## 7. KẾT LUẬN

Tính năng *khả thi cao + rẻ* vì cơ chế (meta-prompting + section template + clarify-gate) đã được chứng minh và stack Lucy đã có sẵn mảnh ghép. Mấu chốt thành công: (1) scaffold meta-prompt tốt, (2) hỏi đúng-ít (intent gate), (3) giữ model rẻ ở vai structural + escalate, (4) cá nhân hoá qua memory = moat. Bắt đầu bằng MVP persona+scaffold, đo phản hồi, rồi mới thêm scorecard/variants/personalization trong sprint sau.

## 8. CỤM BUILD (gộp 13 task → 4 cụm, mỗi cụm Opus build 1 lần — tiết kiệm token)

- **🅰️ CỤM A — Bộ não lõi (backend, KHÔNG đụng UI):** task 1+2+5+6 — persona "prompt-architect" + meta-prompt scaffold + wiring DeepSeek/OmniRoute + lưu lịch sử + escalate Claude. Verify qua chat/CLI, không cần tab. *Làm trước, test bằng chat (khỏi build web).*
- **🅱️ CỤM B — Mặt tiền Hub (frontend+tích hợp):** task 3+4+7 — endpoint/SSE + tab UI /prompts + smoke+verify+rehost. Đụng Hub UI → ghép nhịp UI sprint. Build 1 lần (tsc+build web+rehost).
- *→ Hết MVP = A + B.*
- **🅲 CỤM C — Thông minh hoá (backend logic):** task 8+9+10+12 — preference/few-shot + scorecard + đa biến thể + target-model tailoring.
- **🅳 CỤM D — UX nâng cao Hub (frontend):** task 11+13 — side-by-side compare + versioned diff history UI + polish (đại tu UI).
- **Thứ tự:** A → B → C → D. Mẹo token: test cụm A qua chat trước khi build web (cụm B).

## NGUỒN (deep-research, 2024-2026)
- **Sản phẩm:** Anthropic Prompt Improver (anthropic.com/news/prompt-improver + docs) · OpenAI Prompt Generation (platform.openai.com) · GPT-5.2 Prompting Guide · PromptPerfect (đóng cửa 9/2026) · PromptLayer/LangSmith/DSPy (TechTarget compare).
- **Academic:** "A Systematic Survey of Automatic Prompt Optimization" EMNLP 2025 (arxiv 2502.16923, đã verify) · "Modeling Future Conversation Turns..." ICLR 2025 (arxiv 2410.13788) · "Clarify When Necessary" (arxiv 2311.09469) · OPRO small-LLM limits (arxiv 2405.10276) · FrugalGPT (arxiv 2305.05176) · MPCO meta-prompting (arxiv 2508.01443).
- **Model rẻ:** DeepSeek pricing (benchlm.ai) · "Make Smaller Models Punch Above Their Weight" (orq.ai).
- **UX/memory:** Jakob Nielsen "Prompt Augmentation" · UX Tigers "Aided Prompt Understanding" · "AI Agents That Remember User Preferences" (freecodecamp) · TELUS 7 UX rules · Agentic Workers Prompt Scorecard.
