# Phase M — Tool harness cho MỌI model (lane model "biết dùng máy" như Hermes)

> Bill chỉ ra (2026-06-13): model free/API (Nemotron…) trong Lucy KHÔNG ý thức được cách truy cập/dùng máy
> (file, bash, web fetch, research) → fail multi-agent automation. Hermes thì cùng model đó RẤT khôn:
> web fetch, research, task dài không đứt. Đây là phân tích + thiết kế vá.

## 1. VÌ SAO LANE MODEL "NGU" TRONG LUCY (root cause)

**Trong Lucy có 3 đường chạy model — chỉ 1 đường có tool:**
| Đường | Tool? | Dùng ở |
|---|---|---|
| Claude (Agent SDK) | ✅ đầy đủ (bash/file/web_fetch/web_search) | chat claude-path, runner, bridge |
| **lane CHAT** (`chat-lane.ts`) | ❌ KHÔNG — "chat thuần" (code ghi rõ) | /model, /persona, **auto-route** |
| lane RUNNER (`lane-runner.ts`) | 🟡 có file+bash, **KHÔNG web** | chỉ pipeline card (executor) |

→ Hệ quả:
1. **Auto-route sang lane = model bị tước hết tool** → không đọc file, không bash, không web → "ngu", fail task cần hành động.
2. Ngay cả đường lane-runner (có tool) cũng **thiếu web_fetch/web_search** → không research/fetch được.
3. Không có **vòng agentic thống nhất** cho lane ở mọi path → multi-agent automation với model rẻ sẽ đứt.

**Vì sao Hermes khôn:** Hermes cấp cho MỌI model một **tool harness thống nhất** (web fetch/search/file/bash) qua OpenAI tool-calling + chạy **agentic loop** bất kể provider. Model free hỗ trợ tool-calling (đa số giờ đều có) → thành agent thật.

**Lucy ĐÃ có nửa mảnh:** `lane-runner.ts` có sẵn agentic loop (callLLMRaw + execTool + turn-loop, OpenAI tool schema). Thiếu: (a) web tools, (b) nối vào chat/auto-route, (c) cấp cho sub-agent.

## 2. THIẾT KẾ (làm sao bằng Hermes)

### M1 — Bộ tool dùng chung, provider-agnostic ⭐
Gom 1 tool registry chạy harness-side (OpenAI function schema), tái dùng cho mọi lane path:
- **file**: read_file · list_dir · write_file · edit_file (đã có ở lane-runner — nhấc ra dùng chung)
- **bash**: chạy lệnh trong workspace (đã có)
- **web_fetch**: lấy nội dung 1 URL (MỚI — đây là cái thiếu)
- **web_search**: tìm web trả top kết quả (MỚI — research)
- Mỗi tool exec harness-side, an toàn (sandbox workspace, không git push/đụng ngoài như HOUSE_SKILL).

### M2 — Agentic loop thống nhất cho lane ⭐ (trái tim)
- Nhấc turn-loop của `lane-runner.ts` thành module dùng chung: gọi model với `tools` → model trả `tool_calls` → execTool → nhồi kết quả lại → lặp tới khi xong (hoặc cap turn). 
- Cho lane biết nó CÓ tool qua system prompt ("bạn có tool web_fetch/web_search/read/bash, PHẢI dùng để khảo sát/nghiên cứu trước khi trả").

### M3 — Nối vào MỌI path
- **Chat/auto-route**: thay `chat-lane` (text thuần) bằng agentic loop khi task cần hành động (hoặc luôn, nếu model hỗ trợ tool). → auto-route sang lane vẫn web/research/file được.
- **Sub-agent (Phase K)**: expert sub-agent chạy lane cũng dùng harness này.
- **Pipeline card**: lane-runner nâng cấp thêm web tools.

### M4 — Capability-aware routing (dựa catalog L4)
- Không phải free model nào cũng tool-calling tốt. Catalog (Phase L4) gắn cờ `tool-calling` (đã có role list: gemini-flash, or-nemotron-super, groq-gptoss-120b...). → task cần tool CHỈ route tới model tool-capable; model yếu → fallback Claude hoặc degrade (báo "model này không tool").

## 3. KẾT QUẢ
- Model free (Nemotron…) trong Lucy = agent THẬT: web fetch, research, đọc/sửa file, chạy bash, task dài không đứt — **ngang Hermes**.
- Multi-agent automation với model rẻ chạy được (đỡ ăn subscription Claude — hợp H2).

## 4. QUAN HỆ PHASE
- Đi CẶP với **Phase L** (context): L = nối mạch ngữ cảnh, M = cấp tool/máy. Cả 2 mới ra "free model = agent khôn như Hermes".
- Tái dùng `lane-runner.ts` (đã có loop+file+bash) → công thật = thêm web tools + tách dùng chung + nối chat.
- Hỗ trợ **K** (sub-agent expert có tool) + **H2** (offload sub-agent xuống lane).
- Capability cờ lấy từ **L4** catalog.

## 5. THỨ TỰ
Sau L (context) hoặc song song: M1 web tools + M2 tách loop dùng chung → M3 nối auto-route/chat → M4 capability routing. L + M xong = lane model ngang Hermes (khôn + nối mạch).
