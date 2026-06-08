# W1 — Lucy dự án ngang Lucy chat tổng

> Trạng thái: **IMPLEMENTED — chờ Bill visual sign-off** (2026-06-08). Owner: hub.
> Smoke: vite build ✓ · server tsc ✓ · scope-isolation smoke ✓ (tin scope KHÔNG lọt chat tổng). Adversarial QA fix: input→textarea.
> Bối cảnh: con Lucy điều phối **trong từng dự án** ([LucyChat.tsx](../../hub/web/src/components/LucyChat.tsx)) yếu hơn hẳn
> chat tổng ([Chat.tsx](../../hub/web/src/components/Chat.tsx)). Chat tổng GIỮ NGUYÊN (2 chế độ, Bill tự bật opus).
> Chỉ nâng Lucy dự án **cho ngang** chat tổng — KHÔNG bỏ tính năng đề xuất task.

## Vì sao
| Chat tổng có | Lucy dự án thiếu | Bằng chứng |
|---|---|---|
| `<Markdown>` render | in text thô `whitespace-pre-wrap` | [LucyChat.tsx:97](../../hub/web/src/components/LucyChat.tsx#L97) |
| Toggle opus/sonnet | cứng sonnet | [LucyChat.tsx:67](../../hub/web/src/components/LucyChat.tsx#L67) `send(prompt, false)` |
| Avatar + header "LUCY" + card style | bong bóng đơn | Chat.tsx:74-79 |
| Mic nhập giọng | không | Chat.tsx:23-31 |
| **Session riêng + `--resume`** | **dùng CHUNG global `chat.sessionId` + đẩy vào global `chat.messages`** → lẫn ngữ cảnh, làm bẩn chat tổng | [index.ts:169-178](../../hub/server/src/index.ts#L169) |

## Subtasks
- **W1.1 (server)** — `/api/send` nhận scope (vd `{scope:'project', key}` hoặc `ephemeral:true`):
  - dùng **session riêng per-project** (map sessionId theo key, lưu trong `LUCY_STATE`) HOẶC không `--resume` (vì convPrompt đã nhồi full transcript).
  - **KHÔNG** push vào global `chat.messages`. Hết lẫn ngữ cảnh với chat tổng. → đây là phần làm Lucy dự án thật sự khôn hơn.
- **W1.2 (web)** — LucyChat render tin Lucy qua `<Markdown>` + avatar `/lucy.jpg` + header "LUCY" + card style (mirror Chat.tsx).
- **W1.3 (web)** — toggle opus/sonnet (`.switch`) ở thanh nhập; truyền `send(prompt, opus)`. Mặc định sonnet.
- **W1.4 (web)** — mic STT (copy `startMic` từ Chat.tsx).
- **Giữ nguyên** — parse drafts + nút "Tạo N task" + dependsOn→blockedBy ([LucyChat.tsx:77-88](../../hub/web/src/components/LucyChat.tsx#L77)).

## Acceptance
1. Mở Lucy 1 dự án → tin Lucy render MD (heading/list/code/table/bold).
2. Bật opus trong Lucy dự án → job chạy opus (thấy ở Tasks/Logs).
3. Chat Lucy dự án **KHÔNG** xuất hiện trong lịch sử tab Chat tổng.
4. Trong 1 dự án, Lucy nhớ mạch hội thoại qua nhiều lượt (session riêng).
5. Phần đề xuất task vẫn chạy như cũ.

## Files
`hub/web/src/components/LucyChat.tsx` · `hub/web/src/api.ts` · `hub/server/src/index.ts`
