# Đội hình multi-agent cho Lane Free — chấm điểm sở trường + kiến trúc fanout

> Research: Lucy · 2026-06-19 · nguồn web THẬT (links cuối). Số vendor-published tách khỏi independent (Artificial Analysis). Stealth/thiếu số → ghi "cần test thực tế", KHÔNG bịa.
> Nối tiếp: [[free-model-benchmark-strategy]]. Câu hỏi chủ nhân: lane free có fanout nhiều agent + dùng đúng sở trường từng con không?

## 1. Trả lời ngắn: ĐƯỢC — nhưng code hiện CHƯA có fanout, chỉ có fallback tuần tự

Code `llm-lane.ts` đã có sẵn 2 nền móng:
- **Khái niệm `Role`** (`executor | reasoning | fast | content`) — đã là "phân vai" thô.
- **`callLLM` / `callLLMRaw` đều async** → bọc `Promise.all` là fanout song song được ngay, không cần viết lại core.

Còn THIẾU để thành "đội hình đúng sở trường":
- `FALLBACKS` hiện = chuỗi **tuần tự để chống chết** (con fail → con sau), KHÔNG phải chọn-con-giỏi-nhất-cho-loại-việc.
- Catalog đang **thiếu 3 con free Zen mới**: `north-mini-code-free`, `nemotron-3-ultra-free`, `big-pickle` (mới có mimo + ds-v4-flash). `minimax-m3-free` thì đã hết free (giữ note).
- Chưa có lớp **router theo task-type** (content/doc/code/reasoning/long-ctx/vision) và chưa có hàm **fanout + chọn kết quả tốt nhất**.

## 2. 5 con free LIVE trên OpenCode Zen (fetch opencode.ai/docs/zen 2026-06-19)

Đúng 5 con, tất cả type=Coding, $0. KHÔNG có con free mới nào khác.

| id Zen | Base thật | Kiến trúc | Context / out | Vision |
|---|---|---|---|---|
| `mimo-v2.5-free` | Xiaomi MiMo V2.5 | MoE 310B/15B active, omnimodal | ~131K / 8K cap | base CÓ, Zen docs ghi KHÔNG → ⚠️cần test |
| `deepseek-v4-flash-free` | DeepSeek V4 Flash | MoE 284B/13B active | 1M / cao | Không |
| `north-mini-code-free` | Cohere North Mini Code 1.0 | MoE 30B/**3B active** | 256K / 64K | Không |
| `nemotron-3-ultra-free` | NVIDIA Nemotron 3 Ultra 550B/55B | hybrid Mamba-MoE | **1M** / 128K | Không |
| `big-pickle` | stealth (đoán GLM-4.6) | ? | 200K / 32K | Không |

⚠️ Cảnh báo vận hành:
- `nemotron-3-ultra-free` đang báo lỗi "Model not supported" trên Zen (GitHub issue #30951, catalog lệch backend) — PHẢI smoke-test trước khi route prod.
- MiMo vision: base model omnimodal nhưng **docs Zen ghi vision=Không** cho bản free → mâu thuẫn với giả định cũ "mimo làm Vision QA". Cần test 1 ảnh thật trước khi tin. Nếu Zen không serve vision → **lane free hiện KHÔNG có con vision nào**, Vision QA phải dùng Gemini Flash (content role) hoặc Claude.
- Cả 5 con free đều **log data để train** (limited-time promo) → KHÔNG bỏ secret/confidential (đã có redact.ts).

## 3. Bảng chấm điểm /10 theo sở trường (tổng hợp 2 nhánh research)

Điểm neo theo AA Intelligence Index + benchmark domain; số thiếu thì suy từ kiến trúc và ghi rõ độ tin.

| Model | Code | Document/kỹ thuật | Content/marketing | Reasoning/debug | Tốc độ | Token-eff | Độ tin |
|---|---|---|---|---|---|---|---|
| **North Mini Code** | 8 | 6 | 5 | 6 | **9** | 8 | claim Cohere + kiến trúc 3B |
| **Big Pickle** (GLM-4.6?) | 8 | 7 | 6 | 7 | ? | ? | suy từ GLM-4.6, KHÔNG có bench riêng |
| **DeepSeek V4 Flash** | 8 | 7 | 5 | **8** | 7 | **4** ⚠️ | AA Index 40 + vendor |
| **Nemotron 3 Ultra** | 6 | **8** | 7 | 8 | **9** | **9** | NVIDIA/CodeRabbit (đo thật, relative) |
| **MiMo V2.5** | 7 | 7 | 5 | 7 | 6 | 7 | AA Index 40 + vendor |

Đọc nhanh:
- **Code thuần / agentic nhanh-rẻ** → North Mini Code (train riêng cho harness OpenCode, 3B active = latency thấp) hoặc Big Pickle (refactor project-wide nếu đúng GLM-4.6).
- **Reasoning/debug khó** → DeepSeek V4 Flash (mạnh nhất nhóm) NHƯNG verbose gấp ~2× (230M vs 110M avg token) → **bắt buộc cap max_tokens / ép non-think**.
- **Long-context (đọc repo lớn, RAG, planning, orchestrate đa-agent) + viết document** → Nemotron 3 Ultra (1M ctx, instruction-following dẫn đầu, -30% token/task, 5× throughput) — nhưng **yếu terminal coding nhiều bước**, và đang lỗi Zen.
- **Vision QA** → MiMo (chỉ khi Zen thật sự serve vision — chưa chắc).
- DeepSeek & MiMo cùng AA Index 40 (cùng hạng IQ) → phân biệt bằng trait, không phải "con nào thông minh hơn".

## 4. Đề xuất kiến trúc "đội hình" (3 lớp, thêm vào llm-lane, KHÔNG đập core)

**Lớp A — Specialist map (router theo loại việc):**
```
SPECIALISTS = {
  code_fast:    ['north-mini-code-free', 'big-pickle', 'mimo-v2.5-free'],   // việc code thường, nhiều bước
  code_refactor:['big-pickle', 'ds-v4-flash-free'],                         // refactor project-wide
  reasoning:    ['ds-v4-flash-free', 'nemotron-3-ultra-free'],              // debug/logic khó (cap token)
  longctx:      ['nemotron-3-ultra-free', 'ds-v4-flash-free'],              // đọc repo lớn / RAG / plan
  document:     ['nemotron-3-ultra-free', 'ds-v4-flash-free'],              // viết doc kỹ thuật
  content:      ['gemini-flash', 'nemotron-3-ultra-free', 'mistral-large'], // marketing copy (free Zen yếu content → mượn Gemini)
  vision:       ['mimo-v2.5-free'(?), 'gemini-flash'],                      // QA ảnh — verify Zen vision trước
}
```
Mỗi nhóm vẫn xài fallback tuần tự sẵn có để chống chết.

**Lớp B — Fanout song song (cho task khó/quan trọng):**
- `fanoutLLM(task, ['ds-v4-flash-free','nemotron-3-ultra-free'])` = `Promise.all` gọi 2-3 con cùng lúc → 1 con "judge" (hoặc Claude) chọn output tốt nhất / vote.
- Free nên đốt token thoải mái, đổi lại chất lượng. Đây đúng tinh thần multi-agent verify.

**Lớp C — Pipeline chia việc trong 1 sprng ABF:**
- Plan (Nemotron long-ctx đọc repo) → Code từng file (North Mini Code nhanh) → Debug chỗ rối (DeepSeek reasoning) → QA ảnh (MiMo/Gemini) → mỗi pha 1 con đúng sở trường.

## 5. Việc cần làm (ĐỀ XUẤT — chờ chủ nhân duyệt, đụng llm-lane LIVE)

1. Thêm 3 con free vào `MODEL_CATALOG`: north-mini-code-free, nemotron-3-ultra-free, big-pickle — kèm role hợp lý + ctx.
2. Smoke-test 3 con này thật (nhất là nemotron — đang lỗi issue #30951) trước khi đưa vào FALLBACKS.
3. Verify MiMo vision trên Zen (gửi 1 ảnh) — quyết định Vision QA dùng con nào.
4. Thêm `SPECIALISTS` map + hàm `fanoutLLM()` (lớp A+B). Core callLLM giữ nguyên.
5. Sửa đầu `FALLBACKS.executor` cho mimo lên đầu (yêu cầu cũ "mimo khi chạm limit") + bỏ minimax-m3-free khỏi chain.
6. Cap max_tokens khi route DeepSeek Flash (chống verbose đốt token gấp đôi).

## Nguồn
- opencode.ai/docs/zen (fetch 2026-06-19) · AA: mimo-v2-5-0424, deepseek-v4-flash
- Cohere North Mini Code: cohere.com/blog/north-mini-code · HF CohereLabs/North-Mini-Code-1.0 · VentureBeat
- NVIDIA Nemotron 3 Ultra: developer.nvidia.com blog · coderabbit.ai/blog/nemotron-3-ultra-release · OpenRouter
- Big Pickle = GLM-4.6 (đoán): oh-my-openagent docs · pi.dev/models/opencode/big-pickle
- Nemotron lỗi Zen: github issue #30951 · BenchLM compare ds-v4-flash vs mimo
