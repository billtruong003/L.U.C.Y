# Provider Models — tất cả AI khả dụng (live-verified 2026-06-11)

> Smoke-test thật từng model (không assume). ✓ = gọi ra content OK · ✗ = lỗi. Key ở `.env.llm`.
> Nguồn cho lát giữa (`agent-machine/src/llm-lane.ts`). claude -p (não) KHÔNG dùng lane này.

## Tổng quan đếm /models
| Provider | #models | Free thật? | Ghi chú |
|---|---|---|---|
| OpenRouter | 338 | ⚠️ 1 phần (`:free` + credit) | DeepSeek V4, Qwen3.6/3.7, MiniMax M3, Kimi, Nemotron, Grok, Gemini |
| Groq | 16 | ✅ free | gpt-oss-120b/20b, llama-3.3-70b, qwen3-32b, llama-4-scout — nhanh |
| Gemini | 56 | ✅ free (1500 RPD) | gemini-3-pro/flash, 3.1-pro, 2.5-pro/flash — frontier |
| Cerebras | 2 | ✅ free (⚠️ ctx 8K) | gpt-oss-120b, zai-glm-4.7 — cực nhanh |
| Mistral | 69 | ✅ free (1B tok/th) | codestral, devstral (agentic coding), mistral-large |
| OpenCode Zen | 48 | ⚠️ CHỈ `deepseek-v4-flash-free` | còn lại cần payment method |
| Z.ai | 7 | ✗ cần nạp tiền | glm-4.5→5.1 — key hiện "insufficient balance" |

## Đã SMOKE-TEST (chạy thật)
✓ `deepseek-v4-flash-free` (zen) · `devstral-medium-latest` + `codestral-2508` + `mistral-large` (mistral) ·
  `openai/gpt-oss-120b` + `llama-3.3-70b-versatile` (groq) · `gpt-oss-120b` + `zai-glm-4.7` (cerebras) ·
  `gemini-3-flash-preview` (gemini) · `deepseek/deepseek-v4-flash` + `deepseek/deepseek-v4-pro` (openrouter)
✗ `glm-4.7` (z.ai → no balance) · `qwen3.6-plus-free` (zen → free promo ended) · `kimi-k2.6` (zen → cần payment)

## Catalog dùng trong lát giữa (theo role, chỉ model đã verify)
- **executor** (coding): `deepseek-v4-flash-free` → `devstral-medium` → `deepseek-v4-flash` → `codestral`
- **reasoning**: `deepseek-v4-pro` → `deepseek-v4-flash` → `gpt-oss-120b(groq)`
- **fast** (việc nhẹ): `gpt-oss-120b(groq)` → `glm-4.7(cerebras)` → `llama-3.3-70b`
- **content** (viết): `gemini-3-flash` → `mistral-large` → `gpt-oss-120b`

## Model id đáng chú ý CÒN trên bàn (mở rộng sau khi có payment)
- OpenRouter `:free`: `nvidia/nemotron-3-ultra-550b:free`, `qwen3.6-*`, `minimax/minimax-m3`, `~moonshotai/kimi-latest`, `x-ai/grok-4.3`, `google/gemini-3.5-flash`
- OpenCode Zen (paid): `glm-5.1`, `glm-5`, `minimax-m2.7`, `kimi-k2.6`, `qwen3.6-plus`, `deepseek-v4-pro`
- Gemini: `gemini-3.1-pro-preview`, `gemini-3-pro-preview`, `gemini-2.5-pro`
- Mistral: `devstral-2512`, `codestral-latest`, `mistral-large-2512`

## TODO khi mở rộng
- Z.ai: nạp tiền hoặc bỏ khỏi catalog (hiện không free).
- OpenCode Zen: thêm payment → mở khoá glm-5.1/kimi/minimax (mạnh).
- OpenRouter: nạp $10 1 lần → RPD 50→1000, mở nhiều `:free`.
