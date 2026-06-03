# Lucy — Money Playbook (tổng hợp ý tưởng → execute)

> File này **gộp 2 ghi chú nháp** (`stlf3y.md` = dev-automation ideas, `6unnhc.md` = vision Lucy trading/content)
> thành **một hướng tiền duy nhất, đã soi lại cho khớp docs gốc**. Đây là lớp *execution* — neo trên
> [FEATURES.md §7 Money spectrum](FEATURES.md) và [ARCHITECTURE.md](ARCHITECTURE.md), không thay thế chúng.
>
> Nguồn đã gộp & xóa: `lucy/stlf3y.md`, `lucy/6unnhc.md` (2026-06-03).

---

## 0. Một câu chốt

Lucy là **cỗ máy kiếm tiền cá nhân của Bill**, không phải startup bán tool. Tiền đến từ **3 kênh**,
ưu tiên giảm dần: **(1) Trading research → quyết định tốt hơn**, **(2) Content → ra tiền**,
**(3) Dev automation → tiết kiệm/đỡ tốn giờ** (và *có thể* hé cửa bán dịch vụ ở tier `later`).

---

## 1. Hòa giải mâu thuẫn 2 file (đọc trước)

Hai file nháp đi 2 hướng khác nhau. Đây là cách chốt để **không lệch flow gốc**:

| Điểm | `6unnhc.md` (vision Lucy) | `stlf3y.md` (dev automation) | **Chốt (theo docs gốc)** |
|---|---|---|---|
| Mục tiêu tiền | Trading + Content, **personal** | Bán tool/SaaS/freelance | **Personal-first.** Bán dịch vụ = tier `later`, chỉ mở khi pipeline đủ tin ([FEATURES §7](FEATURES.md)) |
| Coding/automation | kênh **hỗ trợ** (giải phóng giờ) | kênh **kiếm tiền chính** | Coding/automation = **hỗ trợ**, đúng như [FEATURES §1-5](FEATURES.md). Không đảo thành lõi |
| Model não | "Grok 4.1 Fast Reasoning" | (không nói) | **Đúng (đã chốt 2026-06-03):** thân = `grok-4.1-fast-reasoning` gọi xAI thẳng (~$10/năm), bỏ OmniRoute; não thật = Claude Code qua `!c`. Xem [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md) |
| Bán tool | "KHÔNG nhắm bán tool" | "bán tool là cách kiếm tiền" | Giữ **không bán** ở P1-3; ý tưởng bán giữ lại ở **§5 Tier `later`** để không vứt phí |

> Kết luận: `stlf3y.md` **không bị vứt** — các pain-point dev-automation của nó được hấp thụ vào **domain Coding/Automation**
> (giải phóng giờ cho Bill) và một phần đẩy lên **money spectrum tier `later`** (nếu sau này muốn bán). Nhưng **trục chính
> vẫn là personal money engine** đúng như toàn bộ docs Lucy.

---

## 2. Bản đồ 3 kênh tiền → kiến trúc Lucy

Mỗi kênh chạy trên **đúng bộ phận đã có** trong [ARCHITECTURE.md](ARCHITECTURE.md), không đẻ thêm hệ mới.

| Kênh | Bộ phận Lucy dùng | Output | Money spectrum tier ([FEATURES §7](FEATURES.md)) |
|---|---|---|---|
| **1. Trading research** | `skills/` (6 tracks) + cron + Hermes brain | `research/YYYY-MM-DD.md` + `TREND.md` → Discord Aki | **core** ✅ bắt đầu ở đây |
| **2. Content → tiền** | `skills/` (content/data-trends track) + Telegram review | draft bài + lịch đăng → Bill duyệt | **idea** ✅ hợp Bill |
| **3. Dev automation** | Hermes(grok) + `!c` → Claude Code | code/refactor/deploy từ xa qua Telegram | **hỗ trợ** (tiết kiệm giờ); bán = `later` |

---

## 3. Ideas để execute (cụ thể, đã lọc theo độ khả thi)

Mỗi idea: **flow → khả thi trên setup thật (VPS 2GB, no-GPU, thân grok-4.1-fast + `!c` Claude) → khớp phase nào.**

### I1 — Daily Trading Brief (kênh 1, core) ⭐ làm trước
- **Flow:** cron 2×/ngày → 6 skills research (crypto/new-coins/alpha/gold/macro/trends) → tổng hợp `research/<date>.md` → so với hôm qua ghi `TREND.md` → `bridge` POST → Aki phát text vào kênh Trưởng Lão + Tiên Nhân.
- **Khả thi:** **Cao.** Toàn text + web fetch, không cần GPU. Đã có chỗ đứng trong [FEATURES §4](FEATURES.md). Chi phí = vài LLM call/ngày, có budget cap.
- **Phase:** P2 (sau khi P1 Hermes+Telegram chạy).
- **Pain point Bill:** khỏi tự đọc 6 nguồn mỗi ngày; có dấu vết `TREND.md` để nhìn xu hướng.

### I2 — Voice Brief trên Telegram (kênh 1, core)
- **Flow:** brief I1 → TTS giọng Lucy (**Edge TTS free built-in của Hermes** để bắt đầu; MeloTTS-Vietnamese nếu muốn giọng riêng) → gửi voice note Telegram để Bill nghe lúc đi lại.
- **Khả thi:** **Cao** (Edge TTS có sẵn toolset `tts`, no-GPU no-key). Chỉ thêm ffmpeg convert OGG/Opus. Xem [VOICE.md](VOICE.md).
- **Phase:** P-voice.

### I3 — Content Drafter (kênh 2, idea)
- **Flow:** Bill nhắn Telegram "viết bài X" → skill content research → draft markdown → gửi Telegram review → (nếu OK) lên lịch đăng.
- **Khả thi:** **Trung bình.** Draft = dễ; auto-đăng cần API từng nền tảng (để sau). Bắt đầu chỉ "draft + review", chưa auto-publish.
- **Phase:** P2.5 (sau research).
- **Pain point:** biến research sẵn có thành content → tái dùng 1 lần research cho 2 kênh tiền.

### I4 — Remote Dev Hand (kênh 3, hỗ trợ)
- **Flow:** Bill gõ `!c fix bug / thêm feature repo Y` trên Telegram → Hermes(grok) chạy `claude -p` → **Claude Code** viết code/test → push PR → báo Telegram. (Đây là [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md).)
- **Khả thi:** **Trung bình.** Claude Code = não code thật; rủi ro = chạy lệnh trên VPS → `--allowedTools` + `--max-turns` + chỉ repo cho phép. KHÔNG auto-merge.
- **Phase:** P3+ (sau khi cài `claude` CLI). Hấp thụ trực tiếp ý "coding từ xa" của cả 2 file.
- **Pain point:** xử lý việc lặp khi Bill không ở máy.

### I5 — Inbox/Schedule Triage (kênh 3, hỗ trợ — từ stlf3y "repetitive tasks")
- **Flow:** Lucy đọc nguồn việc lặp (email/lịch/note) → tóm tắt + đề xuất rep → Bill duyệt qua Telegram.
- **Khả thi:** **Trung bình-thấp** ở P-sau (cần OAuth Gmail/Calendar, quyền). Giữ ở `idea`, làm sau cùng.
- **Phase:** `later`.

> **Cắt khỏi scope (để khỏi lan man):** ý "bán SaaS/tool cho developer" của `stlf3y.md` → **không build ở P1-3.**
> Lý do: trái scope personal đã chốt + tốn vận hành (support, billing, marketing) > giá trị lúc này. Giữ làm
> **Tier `later`** ở §5; chỉ mở khi I1-I4 chạy ổn và Bill chủ động muốn thương mại hóa.

---

## 4. Soi chi tiết từng flow (double-check khả thi)

### Flow trading (I1) — chi tiết & điểm gãy
```
cron(2×/ngày) ─► Hermes orchestrate ─► 6 skill chạy song song
                                          │ (web fetch + LLM tóm tắt, có budget cap)
                                          ▼
                              research/<date>.md  +  diff TREND.md
                                          │ bridge POST /api/agent/* (HMAC)
                                          ▼
                              radiant-bot ─► Aki phát CHỈ text (gated channels)
```
- **Điểm gãy cần chốt:** (a) giờ cron VN — *chưa chốt* ([FEATURES to-decide](FEATURES.md)); (b) watchlist coin + loại vàng (XAU/SJC) — *chưa chốt*; (c) endpoint `/api/agent/*` phía radiant-bot **chưa có**, phải thêm.
- **Không tự trade tiền thật** — chỉ ra quyết định. Đúng money spectrum.

### Flow content (I3) — chi tiết
```
Telegram "viết X" ─► content skill (tái dùng research) ─► draft.md ─► Telegram review ─► [tay] đăng
```
- **Khả thi gãy:** auto-publish = phần khó (API + token từng nền tảng). **Chốt:** P2.5 chỉ tới "review", auto-publish để `later`.

### Flow dev automation (I4) — chi tiết & an toàn
```
Telegram "fix Y" ─► Hermes đọc repo ─► Claude viết+test ─► git push branch ─► PR ─► báo Telegram (KHÔNG auto-merge)
```
- **An toàn bắt buộc:** khóa Telegram user ID Bill + whitelist repo/lệnh + không touch secret. Trùng kỷ luật [README §Kỷ luật](../README.md).

---

## 5. Money spectrum — cập nhật (đồng bộ [FEATURES §7](FEATURES.md))

| Mức | Idea map | Trạng thái |
|---|---|---|
| AI hỗ trợ quyết định (research/alpha) | I1, I2 | **core** ✅ bắt đầu |
| AI làm content → ra tiền | I3 | **idea** ✅ |
| AI tự động hóa việc lặp của Bill | I4, I5 | **hỗ trợ** |
| **AI bán dịch vụ/tool dev** (hấp thụ từ stlf3y) | — | **later** ⚠️ chỉ mở khi I1-I4 ổn + Bill chủ động |
| AI tự trade tiền thật | — | **later** ⚠️ read-only trước, bàn riêng |
| AI tự kiếm tiền hoàn toàn | — | ❌ hype |

> Khác biệt duy nhất so với FEATURES §7 hiện tại: **thêm 1 dòng "bán dịch vụ/tool dev" ở tier `later`** để
> hấp thụ stlf3y mà không phá trục personal. Nếu Bill OK, tôi sync dòng này ngược vào FEATURES.md.

---

## 6. Roadmap — gắn vào phase đã có ([P1_RUNBOOK](P1_RUNBOOK.md))

| Phase | Đã định nghĩa | Idea của playbook này |
|---|---|---|
| **P1** | Hermes + Telegram chat | (nền — chưa money) |
| **P2** | research skills + cron | **I1** Daily Trading Brief |
| **P2.5** | (mới) content | **I3** Content Drafter (chỉ tới review) |
| **P-voice** | Edge TTS built-in (→ MeloTTS VN nếu cần giọng riêng) | **I2** Voice Brief |
| **P3** | bridge → Aki | **I1** hoàn chỉnh (Aki phát) + **I4** Remote Dev Hand |
| **later** | — | **I5** triage + tier bán dịch vụ |

---

## 7. Open decisions (cần Bill chốt)
- [ ] Giờ cron research 2×/ngày (giờ VN).
- [ ] Watchlist coin + loại vàng (XAU vs SJC).
- [ ] Có sync dòng "bán dịch vụ/tool dev (later)" ngược vào [FEATURES.md §7](FEATURES.md) không?
- [ ] Thứ tự I3 (content) vs I4 (dev hand) — cái nào làm trước sau P2?

## 8. Tham chiếu
- Money/feature gốc: [FEATURES.md](FEATURES.md) · Kiến trúc: [ARCHITECTURE.md](ARCHITECTURE.md)
- Dựng nền: [P1_RUNBOOK.md](P1_RUNBOOK.md) · [VPS_KICKOFF.md](VPS_KICKOFF.md)
- Brain/model: [hermes/config.yaml](../hermes/config.yaml) · Blueprint: [`../../radiant-bot/docs/PERSONAL_AI_HERMES.md`](../../radiant-bot/docs/PERSONAL_AI_HERMES.md)
