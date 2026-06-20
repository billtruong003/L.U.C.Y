# Benchmark & chiến lược model free (OpenCode Zen) cho Auto-Build-Free

> Research: Lucy · 2026-06-19 · nguồn web thật (links cuối file). Số benchmark là vendor-published trừ khi ghi "independent".

## 1. Trạng thái model free LIVE trên OpenCode Zen (verify từ opencode.ai/docs/zen 2026-06-19)

Danh sách free HIỆN TẠI (đều "limited-time", Zen có thể dùng data để train trong giai đoạn free):

| Model | id Zen | Loại | Ghi chú |
|---|---|---|---|
| MiMo V2.5 Free | `mimo-v2.5-free` | coding (+vision) | **primary ABF hiện tại** |
| DeepSeek V4 Flash Free | `deepseek-v4-flash-free` | coding + reasoning | 3 mức reasoning, RẤT verbose |
| Big Pickle | `opencode/big-pickle` | coding (stealth) | chưa rõ base, đáng test |
| North Mini Code Free | `north-mini-code-free` | coding | chưa rõ |
| Nemotron 3 Ultra Free | `nemotron-3-ultra-free` | coding | trial-only, KHÔNG gửi data nhạy cảm |

⚠️ **MiniMax M3 Free đã KHÔNG còn trong danh sách free của Zen** (code ABF ghi promo end 2026-06-18 — khớp với docs live). Muốn xài M3 phải trả tiền.

## 2. Benchmark thật từng con (coding/agentic)

### MiniMax M3 (mạnh nhất — nhưng hết free)
- SWE-Bench Pro **59.0**, Terminal Bench 2.1 **66.0**, BrowseComp 83.52, MCP Atlas 74.2, OSWorld-Verified 70.06 (vendor).
- 1M context, native multimodal, open-weight. Release 2026-06-01.
- Vendor nói trên/ngang GPT-5.5 & Gemini 3.1 Pro ở vài hàng, tiệm cận Opus 4.7 — nhưng độc lập chưa verify, và KHÔNG dẫn đầu mọi benchmark.
- → Tier tốt nhất nếu có budget paid; với pipeline FREE thì loại.

### MiMo V2.5 (con đang dùng — free)
- Bản **standard (free trên Zen)**: MoE 310B total / **15B active**, 1M context, max output 131K.
- Bản Pro (KHÔNG free): SWE-Bench Pro **57.2**, ClawEval **63.8**, τ3-Bench 72.9 — dẫn đầu open-source ở agentic claw, đặc biệt **token-efficient (~70K token/trajectory, ít hơn Opus/Gemini/GPT 40-60%)**.
- Bản standard yếu hơn Pro nhưng kế thừa kiến trúc agentic + tiết kiệm token → **rất hợp auto-build vòng nhiều bước, ít đốt token**.
- Có vision → hợp Vision QA của ABF.

### DeepSeek V4 Flash (free — con reasoning)
- MoE 284B total / **13B active**, 1M context, 3 mức reasoning effort.
- Artificial Analysis: Intelligence Index **40**, tốc độ **107 tok/s**, TTFT **1.30s**.
- "Beats all open models ở Math/STEM/Coding" (vendor), reasoning gần bản Pro nếu cho thinking budget lớn.
- ⚠️ **CỰC verbose**: sinh ~230M output token trong bench (median chỉ 110M) → **đốt token gấp đôi**. Bắt buộc cap `max_tokens` + giới hạn reasoning effort khi dùng.
- → Tier "task khó / debug / cần suy luận", KHÔNG nên làm primary vì tốn token.

## 3. Chiến lược tận dụng cho Auto-Build-Free

**Phân tầng theo loại task (thay vì 1 model cho tất cả):**

1. **Executor mặc định (việc thường, nhiều bước): MiMo V2.5 Free** — giữ nguyên. Lý do: agentic-tuned + tiết kiệm token nhất → chạy sprint dài rẻ.
2. **Task khó / reasoning / fix bug rối: DeepSeek V4 Flash Free** (bật reasoning, **cap max_tokens ~8-16K** chặn verbose). Route khi task có tag "hard" hoặc khi MiMo fail logic.
3. **Vision QA (đổi ảnh / kiểm UI): MiMo V2.5** (có vision). DeepSeek Flash là text-only, không dùng được.
4. **Fallback chain đề xuất (free-first):**
   `mimo-v2.5-free → ds-v4-flash-free → big-pickle/north-mini-code → or-nemotron-super (OpenRouter)`
5. **Thử nghiệm:** chạy 1 sprint thử với **Big Pickle** + **North Mini Code** để có số thực tế (2 con này chưa có public benchmark) trước khi đưa vào chain.
6. **Rate-limit:** giữ round-robin 6 Zen key + cooldown-on-429 (đã có ở `cred-pool.ts` + `_zen_key()`).

## 4. Việc cần chỉnh trong code (ĐỀ XUẤT — chưa làm, đợi chủ nhân duyệt vì đụng llm-lane live)

- **Yêu cầu chủ nhân: "mimo-v2.5-free là model dùng khi chạm limit token".**
  Hiện `FALLBACKS.executor` (llm-lane.ts:77) = `['ds-v4-flash-free','or-nemotron-super',...]` — **KHÔNG có mimo ở đầu**. Khi Claude tụt lane, executor sẽ nhảy vào ds-v4-flash-free (con verbose tốn token) trước.
  → Đề xuất sửa đầu chain executor thành `['mimo-v2.5-free','ds-v4-flash-free','or-nemotron-super',...]`.
- Gỡ/để cờ `minimax-m3-free` trong catalog (đã hết free) để fallback không nhắm vào nó.
- Trong `run_mimo()` của auto-build-free.py khi route DeepSeek Flash: thêm `max_tokens` cap để chống đốt token.

## Nguồn
- OpenCode Zen docs: https://opencode.ai/docs/zen/
- MiniMax M3: https://venturebeat.com/technology/minimax-m3-debuts-eclipsing-gpt-5-5-and-gemini-3-1-pro-on-key-benchmark-performance-for-just-5-10-of-the-cost · https://felloai.com/minimax-m3/ · https://www.marktechpost.com/2026/06/01/minimax-releases-minimax-m3-with-msa-architecture-supporting-1m-token-context-native-multimodality-and-agentic-coding/
- MiMo V2.5: https://venturebeat.com/technology/open-source-xiaomi-mimo-v2-5-and-v2-5-pro-are-among-the-most-efficient-and-affordable-at-agentic-claw-tasks · https://huggingface.co/XiaomiMiMo/MiMo-V2.5 · https://mimo.xiaomi.com/mimo-v2-5/
- DeepSeek V4 Flash: https://artificialanalysis.ai/models/deepseek-v4-flash · https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash · https://www.datacamp.com/blog/deepseek-v4
