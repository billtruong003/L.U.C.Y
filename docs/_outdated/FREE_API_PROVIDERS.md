# Free API Providers — nguồn cắm vào OmniRoute (Tầng 0)

> **Viết 2026-06-09.** Research theo yêu cầu Bill: tìm chỗ cấp API free như OpenCode/OpenRouter, nhất
> là các model đáng chú ý. Đây là **danh mục nguồn để cắm vào OmniRoute** ([COST_MODEL.md](COST_MODEL.md)
> Tầng 0 = $0). Tất cả OpenAI-compatible → OmniRoute gom được hết.

---

## 0. Bill đang cung cấp gì

- **"api open code" = OpenCode Zen** (gateway của opencode.ai). Endpoint OpenAI-compat:
  `https://opencode.ai/zen/v1/chat/completions` (+ Anthropic-compat `/v1/messages`, Google-compat).
  Auth = API key. Free models (limited-time): **Big Pickle, DeepSeek V4 Flash Free, Nemotron 3 Ultra
  Free, MiMo-V2.5 Free, MiniMax M2.5 Free, North Mini Code Free**. Model id dạng `opencode/<id>`.
  ⚠️ Pay-as-you-go cho model trả phí; free models có hạn (đang thu feedback). Đặt được monthly limit.
- **List thứ 2 (T tokens + %) = OpenRouter trending** (có "Owl Alpha by openrouter", stealth models).

→ Cả 2 đều OpenAI-compat → cắm thẳng vào OmniRoute làm upstream.

---

## 1. Danh mục provider FREE (no credit card trừ khi ghi chú)

| Provider | Model free đáng chú ý | Rate limit free | OpenAI-compat | Ghi chú |
|---|---|---|---|---|
| **Google AI Studio (Gemini)** | Gemini 3 Flash, 2.5 Flash/Pro | **1,500 RPD** / 15 RPM | ✅ | Mạnh nhất cho volume; quota reset mỗi ngày, vĩnh viễn |
| **Groq** | Llama 3.3 70B, Qwen QwQ 32B | 30 RPM / **14,400 RPD** | ✅ | Nhanh nhất (LPU); chủ lực content draft |
| **Cerebras** | Llama 3.3 70B, Qwen3 235B | 30 RPM / 60k TPM | ✅ | ~2000 tok/s — nhanh khủng |
| **OpenCode Zen** ⭐(Bill cấp) | Big Pickle, DeepSeek V4 Flash, Nemotron 3 Ultra, MiMo-V2.5 | chưa公布 (limited-time) | ✅ | Curated cho coding agent; free có hạn |
| **OpenRouter** `:free` | DeepSeek V4/R1, Qwen3, MiniMax M3 Free, Owl Alpha, Poolside Laguna | 20 RPM / 50–1000 RPD | ✅ | Nạp $10 1 lần (không hết hạn) → RPD 50→1000 vĩnh viễn |
| **NVIDIA NIM** (build.nvidia.com) | DeepSeek V4/R1, Llama, Qwen3 235B, Nemotron | 40 RPM credit-based | ✅ | Cần verify SĐT; nhiều model lớn free |
| **GitHub Models** | GPT-4o/5, Llama, DeepSeek-R1 | 10–15 RPM / 50–150 RPD | ✅ | Hợp dev workflow; cần GitHub token |
| **Z.ai / Zhipu** | GLM-4.7-Flash, GLM 5 (preview) | undocumented | ✅ | GLM tiếng Trung mạnh |
| **Mistral** | Mistral Small/Large 3 | 1 req/s / **1B tok/tháng** | ✅ | Quota tháng lớn |
| **Cohere** | Command A, R+ | 20 RPM / 1000 req/tháng | ⚠️ partial | |
| **Cloudflare Workers AI** | Llama, nhiều OSS | 10k neurons/ngày | ✅ | Edge, hợp task nhẹ |
| **HuggingFace Serverless** | Llama 3.3 70B, Qwen2.5 72B | $0.10/tháng tự nạp | ✅ | |
| **Pollinations** | Gemini/GPT/Llama variants | không cần signup | ✅ | Free nhất, chất lượng tạp |

**Danh sách canon (đào tiếp khi cần):**
[awesome-free-llm-apis](https://github.com/amardeeplakshkar/awesome-free-llm-apis) ·
[freellm.net](https://freellm.net/) · [free-coding-models (170+)](https://github.com/vava-nessa/free-coding-models) ·
[cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources).

---

## 2. Các model Bill đánh dấu — lấy free ở đâu

| # | Model | Nguồn free | Dùng cho LUCY |
|---|---|---|---|
| 1 | **DeepSeek V4 Flash** | OpenCode Zen (free), OpenRouter `:free`, NVIDIA NIM | reasoning-heavy coding draft, 1M ctx |
| 2 | **Tencent Hy3 preview** | OpenRouter (preview) | thử nghiệm — chưa ổn định |
| 3 | **MiniMax M3** | OpenRouter (M3 Free), OpenCode Zen (M2.5) | content gen |
| 4 | **Xiaomi MiMo-V2.5** | OpenCode Zen (free), OpenRouter | code/content |
| 5 | **Owl Alpha** | OpenRouter (stealth) | thử — model ẩn |
| 6 | **DeepSeek V4 Pro** | OpenRouter, NVIDIA NIM | task khó hơn V4 Flash |
| 7 | **Step 3.7 Flash (StepFun)** | OpenRouter | content nhanh |
| 8 | **Nemotron 3 (Super/Ultra)** | NVIDIA NIM (free), OpenCode Zen, OpenRouter | 120B MoE, mạnh |
| 9 | **GLM 5 / 5.1** | Z.ai free, OpenRouter | đa năng |
| 10 | **Kimi K2.6** | OpenRouter, Moonshot | long-context |
| 11 | **Qwen3.6 Plus** | OpenRouter `:free` (preview), Alibaba DashScope | 1M ctx, CoT — top OpenRouter |
| 12 | **Poolside Laguna M.1** | OpenRouter (free) | code |

> ⚠️ Stealth/preview (Big Pickle, Owl Alpha, Hy3, Laguna) = **free vì đang thu feedback → có thể biến mất
> bất cứ lúc nào hoặc log prompt**. Đừng cho data nhạy cảm. Hợp content public (vốn sẽ publish).

---

## 3. Stack đề xuất cho LUCY (xếp vai trò)

```
CONTENT FLEET (60 bài/ngày, volume cao)     → Groq (chủ lực) + Gemini (1500 RPD) + Cerebras (tốc độ)
                                               fallback: OpenRouter :free + OpenCode Zen free
AKI chat / narration / classify             → Groq Llama 3.3 70B (nhanh, rẻ=free)
Code-heavy draft (nếu cần, KHÔNG phải Claude)→ DeepSeek V4 / Qwen3 Coder qua OpenCode Zen / OpenRouter
Embedding / RAG                              → Gemini embedding free / local
```

**Nguyên tắc rải tải (OmniRoute lo tự động):** mỗi provider có RPD trần → OmniRoute **round-robin +
fallback 4 tầng + circuit breaker** giữa Groq→Gemini→Cerebras→OpenRouter→OpenCode Zen. 60 bài × 5
stage ≈ 300 req/ngày → chia 5 nguồn ≈ 60 req/nguồn/ngày, **thừa sức trong free quota**.

---

## 4. Cách cắm vào OmniRoute (Sprint 1)

OmniRoute = "The Free AI Gateway", Node ≥22, port 20128, dashboard nhúng được. Đường cắm:
1. **Provider có sẵn** (Groq/Gemini/Cerebras/OpenRouter/NVIDIA NIM nằm trong 177 provider của nó) →
   chỉ cần **dán API key qua dashboard** (vault AES-256). Không cần code.
2. **OpenCode Zen** = OpenAI-compat custom upstream → thêm như **custom provider** (baseURL
   `https://opencode.ai/zen/v1` + key). Verify lúc config xem OmniRoute cho thêm custom-OpenAI qua UI
   hay phải register `src/shared/constants/providers.ts` (CLAUDE.md §"Adding a New Provider").
3. Bật **nén RTK+Caveman** + **combo routing** (cost-optimized / round-robin) → fallback tự động.
4. LUCY fleet trỏ `OPENAI_BASE_URL=http://localhost:20128/v1` + key OmniRoute. **`claude -p` KHÔNG
   qua đây** (giữ thẳng Anthropic — xem [COST_MODEL.md](COST_MODEL.md)).

**Cần Bill cấp để config:** (a) **OpenCode Zen API key**, (b) đăng ký free + lấy key:
**Groq** (console.groq.com), **Google AI Studio** (aistudio.google.com), **Cerebras** (cloud.cerebras.ai),
**OpenRouter** (openrouter.ai, nạp $10 nâng RPD). Tất cả no-credit-card (trừ OpenRouter $10 tùy chọn).

---

## 5. Sources
[OpenRouter free models](https://costgoat.com/pricing/openrouter-free-models) ·
[OpenCode Zen docs](https://opencode.ai/docs/zen/) · [Free LLM API 2026 (TokenMix)](https://tokenmix.ai/blog/free-llm-api) ·
[awesome-free-llm-apis](https://github.com/amardeeplakshkar/awesome-free-llm-apis) ·
[Best free LLM API (CostBench)](https://costbench.com/best/best-llm-api-with-free-tier/) ·
[free-coding-models](https://github.com/vava-nessa/free-coding-models)
