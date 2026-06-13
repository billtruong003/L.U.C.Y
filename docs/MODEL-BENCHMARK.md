# Model Benchmark — con nào xịn việc gì (free-tier ưu tiên)

> **Crawl 2026-06-13** từ nguồn công khai (OpenRouter, Mistral, NVIDIA, ArtificialAnalysis, llm-stats, Spheron, Galaxy).
> Mục tiêu: chọn model cho từng VAI TRÒ trong Lucy + chọn con làm SMART-ROUTER. **Không bias** — ghi rõ nguồn +
> caveat (số vendor tự công bố ≠ độc lập; benchmark có thể nhiễm contamination). Số = "as of" thời điểm crawl.
>
> ⚠️ Đây là SNAPSHOT. Smart-routing nên *re-crawl định kỳ* (model đổi rất nhanh) — xem mục "Tự cập nhật".

---

## 1. Bảng tổng hợp (model trong MODEL_CATALOG của Lucy)

| key (catalog) | model | free | điểm mạnh THẬT (có nguồn) | điểm yếu | hợp vai trò |
|---|---|---|---|---|---|
| `or-nemotron-super` | Nemotron 3 Super 120B (12B active) | ✅ OR:free | SWE-bench Verified **60.47%** (cao nhất open model, NVIDIA công bố); **RULER@1M 91.75%** (1M ctx CHẠY thật, vs GPT-OSS 22.3%); hybrid Mamba-MoE, agentic RL 10+ env; +50% tốc độ gen | số vendor tự báo; cần verify độc lập | **router + executor ctx-lớn** |
| `ds-v4-flash-free` | DeepSeek V4 Flash | ✅ zen:free | Dòng V4 dẫn **reasoning đa bước + long-context**; rẻ ($0.14/M bản pro) ngang Opus 4.6/GPT-5.4 coding | bản flash < pro; free hay nghẽn | reasoning/executor |
| `ds-v4-pro` | DeepSeek V4 Pro | ❌ paid | S-tier reasoning+code, ceiling cao nhất nhóm open | tốn tiền | reasoning khó (trả phí) |
| `devstral-med` | Devstral Medium | ✅ free | **SWE-bench Verified 61.6%** (Mistral); chuyên agentic coding, vượt Gemini 2.5 Pro/GPT-4.1 ở giá rẻ | hẹp domain (code) | **executor coding** |
| `codestral` | Codestral 2508 | ✅ free | code-specialized, **256K ctx**, tool-use + structured output (Mistral, 8/2025) | không phải agentic-first | code fill/transform |
| `groq-gptoss-120b` | GPT-OSS 120B @ Groq | ✅ free | coding ~**83%**; reasoning ~90% chất DeepSeek với giá rẻ; **Groq = cực nhanh** | ctx vừa | **fast lane + router nhanh** |
| `cerebras-gptoss` / `cerebras-glm-47` | GPT-OSS 120B / GLM-4.7 @ Cerebras | ✅ free | **Cerebras nhanh nhất** (5.6s vs 17.5s Gemini Flash cùng tải); GLM dòng 4.x LiveCodeBench v6 **82.8%** (~Claude 4) | **cap ctx 8K** | việc nhẹ/nhanh, classify |
| `gemini-flash` | Gemini 3 Flash | ✅ free 1500RPD | **dẫn tool-calling** (dòng 3.5 Flash 42.8 BFCL, trên Opus 4.8 42.2); multimodal (ảnh/audio/video) + reasoning + structured | free cap 1500 req/ngày | **tool-calling + multimodal** |
| `groq-llama-70b` | Llama 3.3 70B @ Groq | ✅ free | nhanh, ổn classify/chat | đời cũ, < nhóm trên ở code/reasoning | classify/chat rẻ |
| `mistral-large` | Mistral Large | ✅ free | viết tốt, đa ngôn ngữ | không chuyên code/agentic | content/viết |

---

## 2. Xếp hạng theo VIỆC (free-tier, không bias)

- **Agentic coding (sửa code, multi-step):** Devstral Medium (61.6%) ≈ Nemotron Super (60.47%) > GPT-OSS-120B (~83% general-coding nhưng không chuyên agentic) > Codestral (fill/transform).
- **Reasoning đa bước / toán:** DeepSeek V4 (dẫn) > Nemotron Super > GPT-OSS-120B (~90% chất DS, rẻ hơn).
- **Long-context (đọc repo to, nhiều file):** Nemotron Super (RULER@1M 91.75% — 1M ctx thật) >> còn lại. DeepSeek V4 ctx 1M cũng tốt.
- **Tool-calling / function-calling:** Gemini 3 Flash (dẫn nhóm) > Nemotron (agentic RL) > GPT-OSS-120B.
- **Tốc độ (latency):** Cerebras (gpt-oss/GLM, ~5.6s) > Groq (gpt-oss/llama) > Gemini Flash (~17.5s) > OpenRouter free (biến động).
- **Classify / chat nhẹ:** Llama 3.3 70B @ Groq, GLM-4.7 @ Cerebras (nhanh, rẻ, đủ).
- **Viết/nội dung:** Gemini 3 Flash, Mistral Large.

---

## 3. Chọn con làm SMART-ROUTER (con "hiểu context để chọn model")

Router = đọc task → quyết "việc này giao model nào". Cần: **hiểu ngữ cảnh tốt + bám instruction + LATENCY THẤP**
(router gọi rất thường xuyên, không được chậm/đắt). KHÔNG cần con mạnh nhất — cần con *cân bằng tốc/hiểu*.

**Đề xuất (tiered, đều free):**
1. **Router mặc định: `groq-gptoss-120b`** — GPT-OSS 120B trên Groq. Lý do: reasoning ~90% chất DeepSeek + instruction-following tốt + **Groq nhanh** → quyết định route trong ~1s, không đốt ngân sách. Hợp 90% case.
2. **Router nâng (task to/mơ hồ): `or-nemotron-super`** — Nemotron Super free. Khi brief lớn / nhiều file / cần đọc context sâu để route đúng → nó có 1M ctx + agentic reasoning để "hiểu" task trước khi chia.
3. **Fallback: `gemini-flash`** — khi 2 con trên nghẽn 429 (Gemini free 1500RPD riêng quota).

> Vì sao KHÔNG để DeepSeek V4 làm router: mạnh nhưng free hay nghẽn + latency cao hơn → lãng phí cho việc "quyết nhanh".
> Vì sao KHÔNG để Cerebras (8K ctx) làm router nâng: ctx 8K không đọc nổi task to.

---

## 4. Mapping máy đọc được (smart-routing tiêu thụ)

```jsonc
// role → ưu tiên model (free trước). Smart-router đọc bảng này + benchmark để quyết.
{
  "router":        ["groq-gptoss-120b", "or-nemotron-super", "gemini-flash"],
  "agentic-code":  ["devstral-med", "or-nemotron-super", "ds-v4-flash-free", "codestral"],
  "reasoning":     ["ds-v4-flash-free", "or-nemotron-super", "groq-gptoss-120b"],
  "long-context":  ["or-nemotron-super", "ds-v4-flash-free"],
  "tool-calling":  ["gemini-flash", "or-nemotron-super", "groq-gptoss-120b"],
  "fast-classify": ["cerebras-glm-47", "groq-llama-70b", "groq-gptoss-120b"],
  "content":       ["gemini-flash", "mistral-large"]
}
```

---

## 5. Tự cập nhật (chống số liệu mốc)

Model free đổi tuần/tháng. Smart-routing KHÔNG hardcode số — nên:
- **Cron crawl định kỳ** (vd hằng tuần): fetch OpenRouter `/models` + ArtificialAnalysis + llm-stats leaderboard → cập nhật bảng §1, §4.
- **Live signal:** đếm thực tế trong Lucy — model nào hay 429, hay timeout, hay bị reviewer rework → hạ ưu tiên. (nối token-guard + verify-gate sẵn có.)
- Ghi lại snapshot có ngày, không xoá cũ → so được drift.

---

## Nguồn (as of 2026-06-13)
- [OpenRouter — Nemotron 3 Super (free)](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free) · [NVIDIA blog — Nemotron 3 Super](https://developer.nvidia.com/blog/introducing-nemotron-3-super-an-open-hybrid-mamba-transformer-moe-for-agentic-reasoning/)
- [Mistral — Devstral](https://mistral.ai/news/devstral/) · [Mistral — Codestral 25.08](https://mistral.ai/news/codestral-25-08/)
- [Spheron — Open-weight showdown 2026](https://www.spheron.network/blog/open-weight-frontier-model-showdown-2026/) · [MindStudio — DeepSeek V4](https://www.mindstudio.ai/blog/deepseek-v4-open-source-frontier-model-review)
- [llm-stats — best tool-calling](https://llm-stats.com/leaderboards/best-ai-for-tool-calling) · [llm-stats — benchmarks](https://llm-stats.com/benchmarks)
- [Cerebras — speed Gemini Flash vs Kimi](https://www.cerebras.ai/blog/which-is-faster-gemini-3-5-flash-or-kimi-k2-6-on-cerebras) · [Galaxy — Gemini 3 Flash vs Llama 3.3 70B](https://blog.galaxy.ai/compare/gemini-3-flash-preview-vs-llama-3-3-70b-instruct)
- [BuildFast — leaderboard May 2026](https://www.buildfastwithai.com/blogs/best-ai-models-may-2026-leaderboard) · [TokenMix — GPT-OSS-120B review](https://tokenmix.ai/blog/gpt-oss-120b-review-benchmark-2026)

> ⚠️ Caveat không bias: SWE-bench của Nemotron/Devstral là **số vendor tự công bố** — chưa kiểm chéo độc lập đầy đủ.
> LiveCodeBench/BFCL ít nhiễu hơn nhưng vẫn có rủi ro contamination. Khi quyết định lớn → ưu tiên ArtificialAnalysis/llm-stats (bên thứ 3).
