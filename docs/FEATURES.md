# Lucy — Features (master list)

> Mục tiêu file: **bắt trọn mọi tính năng muốn có để không miss.** Mỗi mục có trạng thái:
> `core` (lõi P1-3) · `idea` (muốn, chưa lịch) · `later` (về sau, cần bàn riêng).
> Cập nhật mỗi khi nảy ý mới.

---

## 1. Bộ não & runtime

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 1.1 | Hermes Agent always-on trên VPS Ubuntu | core | self-improving, memory, subagent |
| 1.2 | Model: Claude (việc khó) + rẻ (Nous/Groq/Gemini/OpenRouter) cho thường | core | model-agnostic, có budget cap |
| 1.3 | Persistent memory qua nhiều phiên | core | có sẵn trong Hermes |
| 1.4 | Tự tạo / cải thiện skill từ kinh nghiệm | idea | tính năng Hermes, để mở |

## 2. Kênh giao tiếp

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 2.1 | **Telegram personal** — chat + ra lệnh + thao tác máy + **voice** | core | line riêng Bill, full service |
| 2.2 | Discord — **chỉ text của Aki** (báo cáo), KHÔNG voice | core | Discord voice đã bỏ khỏi scope |
| 2.3 | Discord text — báo cáo gated Trưởng Lão + Tiên Nhân (qua Aki/control API) | core | |
| 2.4 | Voice memo Telegram → auto-transcribe | core | Hermes có sẵn |
| 2.5 | Zalo bridge (nhắn ngược qua Zalo) | later | Hermes KHÔNG có sẵn → custom (Zalo OA / n8n node) |

## 3. 🎙️ Voice — **CHỈ Telegram** (chi tiết ở VOICE.md)

> Voice là **async voice note** trên Telegram, không phải live call. Discord KHÔNG có voice.

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 3.1 | **Nghe** — Bill gửi voice note Telegram → transcribe | core | Hermes có sẵn transcribe |
| 3.2 | **Voice reply** (TTS → voice note Telegram) | core | FREE no-GPU base: **MeloTTS family** (EN/JA/... + `nmcuong/MeloTTS-Vietnamese` cho VN). Nâng cấp: VieNeu-TTS clone / HF Space anime JP. Xem VOICE.md §3-4 |
| 3.3 | Lucy có 1 giọng nhân vật riêng nhất quán | core | clone/chọn 1 giọng cố định |
| 3.4 | Cảm xúc / nhấn nhá theo nội dung | later | tùy engine |
| ~~3.x~~ | ~~Discord voice / wake word / VAD / realtime~~ | **bỏ** | Discord chỉ text Aki |

## 4. Research kiếm tiền (skills)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 4.1 | Cron 2 lần/ngày (giờ chưa chốt) | core | |
| 4.2 | 6 tracks: crypto core · new coins/narratives · alpha · gold · macro · content/data trends | core | |
| 4.3 | Output: `research/YYYY-MM-DD.md` + `TREND.md` (so ngày qua ngày) | core | |
| 4.4 | Báo cáo + đề xuất đầu tư → Discord (Trưởng Lão + Tiên Nhân) | core | |
| 4.5 | Skills cộng đồng: awesome-finance-skills, last30days-skill | idea | vet trước khi tin |
| 4.6 | MiroFish (mô phỏng bầy đàn dự đoán) | later | app riêng, nặng |
| 4.7 | Watchlist coin + loại vàng (XAU/SJC) | core (chưa chốt) | cần Bill chốt |

## 5. Điều khiển radiant-bot từ xa

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 5.1 | Control API `/api/agent/*` + HMAC trong radiant-bot | core | mở rộng từ `/api/contribute` |
| 5.2 | Ra lệnh từ Telegram → Aki làm việc trong Discord | core | whitelist hành động + khóa Telegram user ID |
| 5.3 | Lucy đẩy báo cáo → Aki phát (một giọng text duy nhất) | core | |

## 6. Web brain-viz dashboard

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 6.1 | Cục năng lượng giữa + dây nối tới từng LLM | idea | three.js/canvas |
| 6.2 | Dòng năng lượng chạy khi LLM đó active | idea | **cần telemetry live** (phần khó) |
| 6.3 | Telemetry: Hermes + LLM router bắn event qua WebSocket/SSE | idea | làm TRƯỚC viz |
| 6.4 | Web dashboard host billthedev / VPS | idea | |

## 7. Money spectrum (định hướng — đọc kỹ)

| Mức | Trạng thái | |
|---|---|---|
| AI hỗ trợ quyết định (research/alpha) | core | ✅ lõi, bắt đầu ở đây |
| AI làm content → ra tiền | idea | ✅ hợp Bill |
| AI tự trade tiền thật | later | ⚠️ rủi ro cao, read-only trước, cần bàn riêng |
| AI tự kiếm tiền hoàn toàn | — | ❌ phần lớn là hype |

---

## To-decide (chưa chốt)
- Schedule 2 lần/ngày (giờ VN).
- Watchlist coin + loại vàng.
- ~~Voice TTS engine~~ → **CHỐT: free no-GPU, base MeloTTS family self-host CPU (EN/JA + `nmcuong/MeloTTS-Vietnamese` cho VN).** Còn lại: nghe thử + chọn speaker/giọng Lucy; cân nhắc VieNeu-TTS nếu muốn clone giọng cute riêng.
- Model provider chính cho Hermes.
- VPS: Vietnix `14.225.255.73` chung được (không cần GPU nhờ fallback CPU).
