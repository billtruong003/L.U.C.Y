# Lucy = JARVIS — bức tranh hoàn thiện (north-star, 2026-06-13)

> Bill chốt: Lucy là personal assistant/side-kick mạnh TOÀN DIỆN (như Jarvis của Tony Stark), KHÔNG focus 1 hướng.
> Phê bình đúng: các ý tưởng trước HƯỚNG NGOẠI (làm task ngoài) + PHÂN MẢNH (nhiều session/tab rời). Peak phải là MỘT thực thể.
> Bổ sung NORTH_STAR.md — đây là góc "chống phân mảnh + Jarvis-feel + UI".

## VẤN ĐỀ CỐT LÕI: PHÂN MẢNH
Hiện Lucy = nhiều silo rời: chat (1 session global) · autopilot/card · cron brief · galaxy · Discord — mỗi cái 1 hộp.
Không có "MỘT Lucy biết mọi thứ và điều phối tất cả". Jarvis thì ngược lại: bạn nói với MỘT thực thể, nó có full context đời bạn + công việc, hành động xuyên mọi lĩnh vực, luôn ở đó.

## 5 TRỤ CỦA "MỘT LUCY"

### 1. MỘT bộ não — self liên tục (không session rời)
Mọi tương tác (chat/agent/cron/market/code) bồi vào CÙNG một context sống về Bill + thế giới của Bill.
Vault + dream là hạt giống, nhưng phải thành "ý thức nền" luôn cập nhật, không passive.
→ Lucy nhớ liên tục: "hôm qua anh làm X, sáng nay Y có update". KHÔNG bắt đầu lại mỗi lần.
→ (nền: L unified-context + E memory + J đa-phiên NHƯNG các phiên CHIA SẺ 1 self chung, không tách rời).

### 2. MỘT presence, nhiều mặt
Telegram / Hub web / Discord / (voice sau) = CÙNG một Lucy, CÙNG context. Bắt đầu ở phone → tiếp ở web liền mạch, không phải 2 con khác nhau.

### 3. Orchestrator-of-self (multi-agent = TAY CHÂN của 1 Lucy)
Bill nói 1 câu → Lucy (bộ điều phối) tự quyết: trả thẳng / hỏi sub-agent expert / kích autopilot task dài / check market → kết quả DỆT LẠI về 1 luồng trả lời.
→ K (persona/expert) + L (context) + M (tool) KHÔNG phải tính năng rời — là chi thể của MỘT Lucy. Bill chỉ thấy 1 Lucy, không thấy "đám agent".

### 4. Always-on awareness (ý thức nền — Jarvis luôn "ở đó")
Lucy không chỉ request→response. Có lớp chạy NGẦM: theo dõi dự án/market/lịch, dream đêm, watcher → CHỦ ĐỘNG surface cái đáng quan tâm đúng lúc, đúng kênh.
→ Cân bằng: chủ động nhưng không ồn (lọc nhiễu, chỉ nhắc khi đáng).

### 5. Inward — hiểu Bill sâu (không chỉ làm task ngoài)
Học pattern, đoán nhu cầu, giữ continuity, quan hệ sâu dần. Biết Bill là ai, đang ở đâu trong từng dự án, sở thích, nhịp làm việc. → trợ lý CÁ NHÂN thật, không phải bot công cụ.

## UI — bức tranh giao diện (Bill nêu là vấn đề thật)
**Vấn đề:** Hub hiện = tabs (Chat/Tasks/Board/Galaxy/Memory…) = HỘP CÔNG CỤ rời → cảm giác "đám app", không phải "một Lucy".

**Hướng Jarvis-UI:**
- **Hội thoại là TRUNG TÂM**, mọi thứ khác ORBIT quanh nó (như HUD Iron Man). Lucy chủ động surface card/galaxy/market/task NGAY trong dòng trò chuyện — không bắt Bill nhảy tab đi tìm.
- Các view (Board/Galaxy/Tasks) không biến mất mà thành "**Lucy đang cho anh xem cái này**" (panel bật ra theo ngữ cảnh hội thoại), không phải app tách biệt.
- **"Home of Lucy" = trạng thái SỐNG**: đang làm gì · đang watch gì · vừa học gì (galaxy mini) · task active · + ô chat. Một dashboard sống CHÍNH LÀ Lucy, không phải toolbox.
- Cảm giác: mở lên thấy "Lucy đang sống và biết mình", không phải "menu chức năng".

## TỪ HIỆN TẠI → PEAK (các phase phục vụ tầm nhìn nào)
- **L + M** (Hermes parity) = nền để mọi model/chi-thể chia sẻ 1 context + 1 bộ tool → trụ #1, #3.
- **J** (đa-phiên) nhưng các phiên CHIA SẺ self chung (không tách Lucy ra) → trụ #1.
- **K** (persona/expert) = trụ #3 (tay chân), Bill chỉ thấy 1 Lucy.
- **E/dream/vault** = trụ #1, #5 (self + hiểu Bill).
- **Proactive watcher** (beyond-hermes A) = trụ #4.
- **UI tái thiết kế** (mới — chưa có phase): chuyển từ tabs → hội thoại-trung-tâm + orbit. → đề xuất **Phase N — Jarvis UI**.

## ĐỀ XUẤT: thêm trục xuyên suốt
Mọi phase từ giờ phải hỏi: "cái này làm Lucy THỐNG NHẤT hơn hay PHÂN MẢNH thêm?" — ưu tiên thống nhất.
- **Phase N — Jarvis UI**: hội thoại-trung-tâm, view orbit theo ngữ cảnh, Home-of-Lucy sống. (song song K, vì K cho thấy multi-agent dệt về 1 luồng).
- Nguyên tắc: ẩn cơ chế (agent/model/session) — Bill chỉ trải nghiệm MỘT Lucy.
