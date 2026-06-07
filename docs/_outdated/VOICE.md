# Lucy — Voice Stack (design)

> **Scope (chốt 2026-06-02): voice CHỈ ở Telegram.** Discord không có voice — Discord chỉ nhận **text của Aki**.
> Telegram voice = **voice note bất đồng bộ** (không phải live call) → đơn giản hơn nhiều, **không** áp lực latency realtime.
>
> **Cập nhật 2026-06-03:** Hermes có **Edge TTS FREE built-in** (toolset `tts`, no-GPU no-key) + STT
> faster-whisper local → **bắt đầu bằng cái này, gần như 0 setup**. MeloTTS/VieNeu bên dưới = **nâng cấp**
> khi muốn giọng Lucy riêng/cute. Đừng tự host MeloTTS ngay nếu chỉ cần voice chạy trước.

---

## 1. Vì sao Telegram-only dễ hơn nhiều

Bỏ hẳn được phần khó nhất của voice realtime:
- ❌ Không cần `@discordjs/voice`, Opus stream, libopus/sodium.
- ❌ Không cần VAD / wake word "Hey Lucy" / ngắt lời.
- ❌ Không áp lực latency < 1-2s (voice note là async — Lucy trả lời trong vài giây là ổn).

Còn lại 2 việc gọn:
- **Nghe:** Bill gửi voice note Telegram → transcribe → text.
- **Nói:** Lucy trả lời → sinh audio **giọng anime girl** → gửi lại dạng voice note Telegram.

---

## 2. Nghe — STT (voice note → text)

- **Hermes có sẵn transcribe voice memo Telegram** → gần như free, không phải tự build.
- Backup/nâng cấp nếu cần chính xác hơn: Whisper API / Deepgram / `faster-whisper` local.
- Async → latency không quan trọng.

---

## 3. Nói — TTS giọng anime girl ⭐ (phần custom chính)

> **Ràng buộc (chốt 2026-06-02): KHÔNG GPU + ưu tiên FREE (không ElevenLabs/cloud trả tiền).**
> Tension: giọng anime nhân vật thật vốn cần GPU; free+no-GPU khó có "chất" anime xịn. Giải = **fallback chain** (§4).

Lucy cần **1 giọng anime girl cố định** ("danh tính âm thanh"). 3 đường free-no-GPU:

### Đường 1 — HF Space Style-Bert-VITS2 (anime THẬT, free, chạy trên GPU của HF) ⭐
- Space vtuber/anime sẵn: `Kit-Lemonfoot/Hololive-Style-Bert-VITS2`, `Mahiruoshi/BangDream-Bert-VITS2`, `litagin/Style-Bert-VITS2-Editor-Demo`. JP/EN/CN, nhiều speaker.
- Gọi qua `gradio_client`:
  ```python
  from gradio_client import Client
  wav = Client("Kit-Lemonfoot/Hololive-Style-Bert-VITS2").predict(text="...", ...)
  ```
  (HF token free → quota tốt hơn.)
- ✅ Free, anime thật, không tốn GPU của mình.
- ❌ Space **ngủ khi rảnh** (cold start), **rate limit chung**, owner có thể tắt/đổi API, **ToS không bảo đảm automation 24/7**. → OK personal/async low-volume, KHÔNG reliable cho production. Phòng hờ: **duplicate Space về account mình**.

### Đường 2 — Self-host CPU ⭐ (free, reliable, đa ngôn ngữ GỒM tiếng Việt)
- **MeloTTS family** — CPU realtime, đa ngôn ngữ, tự nhiên (không khô). Official: EN/JA/ZH/KO/ES/FR + fork cộng đồng **`nmcuong/MeloTTS-Vietnamese`** (MIT) cho **tiếng Việt**. 1 thư viện, load model theo ngôn ngữ. → **base khuyến nghị.**
- **VieNeu-TTS** — VN + **clone giọng** + real-time CPU + 24kHz, on-device. Nâng cấp khi muốn giọng "cute riêng" cho Lucy.
- viXTTS / F5-TTS-VN — VN biểu cảm cao hơn nhưng nặng/chậm trên CPU (cần GPU để mượt).
- Kokoro-82M — #1 TTS Arena, CPU realtime, nhưng chủ yếu English, không clone.
- ✅ Chạy thẳng VPS không-GPU, free vĩnh viễn, không rate limit, **không phụ thuộc HF Space**.

### Đường 3 — edge-tts (Microsoft, free, không cần key)
- Nhiều giọng nữ (gồm vi-VN), nhẹ, chạy mọi nơi. Tự nhiên nhưng ≠ anime character. Backup nhanh.

### Định dạng + lưu ý
- Telegram voice note = OGG/Opus. Output TTS (wav/mp3) → convert bằng `ffmpeg` → gửi `sendVoice`.
- Lucy = **1 giọng cố định nhất quán** (1 speaker id / 1 voice).
- Giọng anime riêng **loại bỏ** API speech-to-speech realtime đóng (OpenAI Realtime / Gemini Live) — giọng chúng cố định.

---

## 4. Kiến trúc khuyến nghị — MeloTTS family làm base (self-host CPU), Space là tùy chọn

**Base (chốt theo ý Bill — đa ngôn ngữ, nhẹ, không khô, có VN):**
```
MeloTTS (official EN/JA/...) + nmcuong/MeloTTS-Vietnamese (VN)   ── self-host CPU, free, reliable
        ↑ nâng cấp giọng "cute riêng": VieNeu-TTS (VN + clone, CPU)
        ↑ tùy chọn "cho vui" giọng anime JP: HF Space Style-Bert-VITS2
```

- **Base self-host CPU = không phụ thuộc HF Space**, không rate limit, không cold start. **Zero tiền, zero GPU.**
- VPS Vietnix `14.225.255.73` (VM thường, không GPU) chạy MeloTTS realtime được.
- HF Space anime JP chỉ là layer optional khi muốn "chất" vtuber — không bắt buộc.
- Khi muốn biểu cảm cao hơn (viXTTS/F5) → mới tính GPU theo giờ / Modal serverless.

---

## 5. Sequence (voice — đã gọn)

1. **V1** — Lucy reply trên Telegram bằng voice note (TTS 1 giọng cố định). Xác nhận ra tiếng đúng giọng.
2. **V2** — Bill gửi voice note → transcribe → não → Lucy trả lời bằng voice note. Vòng lặp đầy đủ (async).
3. **V3** — Tinh chỉnh giọng (chọn/clone đúng "chất" anime girl Bill thích).

---

## 6. Điểm cần canh
- **Reliability** — HF Space ngủ/rate-limit → BẮT BUỘC có fallback CPU (Kokoro/MeloTTS) để không mất giọng.
- **ToS** — dùng public Space cho automation = gray area; duplicate Space về account mình nếu xài đều.
- **Chất anime** — đường free-no-GPU chỉ "anime thật" khi qua HF Space; fallback CPU là giọng nữ thường.
- **Privacy** — STT cloud = audio rời máy; nhạy cảm thì ưu tiên Hermes built-in / local.

---

## Phụ lục — Discord voice (ĐÃ BỎ khỏi scope)
Ý tưởng ban đầu (Lucy join Discord voice channel, realtime STT/TTS, wake word) **không làm nữa** —
Discord chỉ cần Aki text. Giữ note này phòng khi sau này muốn revisit.
