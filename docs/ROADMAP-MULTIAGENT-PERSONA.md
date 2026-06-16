# Roadmap chiến lược — Chat đa-phiên · Persona thật · Multi-agent (2026-06-13, Bill định hướng)

> Trả lời các câu hỏi định hướng của Bill + đề xuất phase mới. Đây là HƯỚNG, chưa build.

## Trả lời thẳng câu hỏi
- **Agent có brain riêng chưa?** ✅ CÓ RỒI — `lucy-vault/Brain/agents/<persona>.md` (đang có thật: builder.md, eng.md, reviewer.md). Là "não nghề" class-level mỗi persona học được, dream-per-persona (agent-brain-dream) tự gộp. KHÁC não chung (preferences/active.md).
- **Sao không thấy visual?** Vì galaxy (`brain.ts` GRAPH_DIRS) KHÔNG gồm `Brain/agents` → brain agent tồn tại nhưng chưa vẽ. → fix dễ: thêm zone "agents" vào galaxy.
- **Persona hiện có "sức mạnh" thật?** Chưa nhiều. Persona = systemPrompt + model + allowedTools + flavor (realm/kind). Trong agent-machine có dùng thật (mỗi stage 1 persona + brain riêng). Trong CHAT thì persona chỉ là overlay nhẹ → đúng là "trang trí" như Bill nói.
- **E (context/memory) đã xong** — và nó làm auto-routing AN TOÀN hơn (D7 đã chặn hạ model rẻ giữa phiên). Auto-route + memory bổ trợ nhau, không "kì".

## PHASE J — Chat đa-phiên (Hermes webUI style) ⭐ [UX win, vừa sức, nên làm sớm]
Hiện: Hub chat = 1 phiên global (1 `chat.json`, 1 sessionId). Muốn: nhiều cuộc trò chuyện lưu riêng (như ChatGPT/Hermes webUI — ref github.com/nesquena/hermes-webui).
- **J1 Server:** thay `chat.json` đơn → `chats/<id>.json` (mỗi convo: title + sessionId + messages). API: list / new / switch / rename / delete.
- **J2 Client:** sidebar danh sách hội thoại + nút "＋ mới", click chuyển. Mỗi convo giữ sessionId riêng → context KHÔNG lẫn giữa các chuyện.
- **ROI:** hết cảnh mọi thứ dồn 1 phiên; hợp với auto-route (mỗi convo 1 mạch). Pairs với D6 (đã có sync lịch sử).

## PHASE K — Persona THẬT + Expert-consultation routing 🧠 [chiến lược, Bill hào hứng]
Biến persona từ trang trí → sức mạnh thật + multi-agent.
- **K1 Persona đa lĩnh vực:** không chỉ dev — thêm marketing, UI/UX, finance, copywriter, research... mỗi persona = systemPrompt chuyên + skill (Skills/) + brain riêng (Brain/agents/) + model phù hợp.
- **K2 Expert-consultation routing** (cái Bill mô tả): Lucy trong phiên (vd đang dev) CẦN thông tin lĩnh vực khác → "hỏi expert": spawn sub-agent mang persona+skill+brain của lĩnh vực đó (vd marketing/UX), nó TỔNG HỢP theo skill nó có rồi CẤP LẠI. Lucy chính tổng hợp tiếp.
  - **Có tăng độ tin cậy không?** CÓ — đây là pattern multi-agent thật (sub-agent chuyên biệt + context riêng): câu trả lời được "chuyên gia có ngữ cảnh đúng" kiểm/tổng hợp thay vì 1 model đoán mò mọi lĩnh vực. Giống panel/consultation. Nhiều bên (kể cả Claude Code subagents) làm vậy.
  - Kỹ thuật: tận dụng Agent SDK (vừa migrate) → spawn sub-agent với `system_prompt` = persona expert + `add_dirs` skill/brain riêng, trả kết quả về phiên chính. Có thể wire qua coordinator (đã có lane/route) hoặc 1 "consult tool".
- **K3 Per-agent brain VISUAL:** thêm `Brain/agents` vào galaxy (zone "agents") + view riêng mỗi agent học được gì → Bill thấy được não nghề từng persona (đang ẩn).
- **K4 (optional) Persona registry/UI:** quản persona (tạo/sửa/skill/brain) từ Hub thay vì file tay.

## CÒN LẠI (polish/infra — làm rải sau)
- Cron lọc tin xàm mỗi tối (cần trình hướng theo "phương pháp cronjob" của Bill trước)
- D polish (rate-guard chart · mobile · context-ring) · Dream lớp 2 (node→card/file) · F (CI gate + dọn smoke đỏ)

## ĐỀ XUẤT THỨ TỰ (Lucy suggest)
1. **Agent-brain VISUAL (K3)** — nhỏ, đã có data, trả lời ngay "sao không thấy" → quick win + thấy được multi-agent đang có gì.
2. **Chat đa-phiên (J)** — UX win rõ, vừa sức, hợp auto-route.
3. **Expert-consultation routing (K2) + persona đa lĩnh vực (K1)** — phần CHIẾN LƯỢC lớn nhất, biến Lucy thành multi-agent thật. Làm sau khi J + K3 xong (đã có nền + thấy được brain).
4. Polish/cron/F — rải sau.

> Lý do: K3 rẻ + trả lời câu hỏi ngay; J tạo nền nhiều-phiên để consult không lẫn context; rồi K2/K1 là đỉnh (multi-agent expert). Polish cuối.
