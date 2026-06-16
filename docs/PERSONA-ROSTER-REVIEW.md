# Lucy — ROSTER 17 PERSONA (để chủ nhân duyệt giữ/sửa/bỏ)

> Cập nhật 2026-06-14. "ref" = số lần được code pipeline gán việc theo id (cao = đang gánh việc thật). "consult" = gọi được từ chat qua consult_expert chưa.

## A. THỢ PIPELINE — đang gánh việc build thật (KHÔNG nên xoá)

| id | nhân vật | kind | model / lane | vai trò | ref | consult |
|---|---|---|---|---|---|---|
| builder | Tanjiro | executor | sonnet / ds-v4-flash-free | kỹ sư full-stack, làm task chính theo INVEST | 63 | – |
| reviewer | Rengoku | specialist | opus | review chất lượng/QA gate, khắt khe | 25 | ✅ (mới) |
| tester | Shinobu | specialist | sonnet | QA, nhắm điểm yếu, viết/chạy test | 15 | ✅ (mới) |
| grinder | Vương Lâm | executor | sonnet / ds-v4-flash-free | cày việc lặp/bulk codemod/scaffold | 13 | – |
| engineer | Zenitsu | executor | sonnet / devstral-med | subtask nhỏ, fix bug "một nhát dứt điểm" | 13 | ✅ |
| data | Daru | executor | sonnet / ds-v4-flash-free | lấy/nắn/đọc dữ liệu, script, scrape | 9 | ✅ |
| writer | Tamayo | executor | sonnet / ds-v4-flash-free | viết docs/nội dung dễ hiểu | 3 | ✅ (mới) |
| security | Gyomei | specialist | opus | audit bảo mật, canh cửa, hardening gate | 2 | ✅ (mới) |
| devops | Tengen | specialist | sonnet | deploy/release/CI, đưa build ra sân khấu | 2 | ✅ (mới) |
| architect | Makise Kurisu | specialist | opus | kiến trúc + planning, chọn giải pháp | 2 | ✅ |
| orchestrator | Okabe | orchestrator | opus | điều phối, chia task, giao tuyến | 2 | – |

## B. EXPERT NGƯỜI DÙNG — gọi qua chat (consult_expert)

| id | nhân vật | model / lane | vai trò | consult |
|---|---|---|---|---|
| finance | Eru | sonnet / or-nemotron-super | tài chính/thị trường (crypto·vàng·CK·macro), kèm rủi ro | ✅ |
| marketing | – | sonnet / or-nemotron-super | growth, positioning, kênh organic/paid/viral | ✅ |
| researcher | – | sonnet / or-nemotron-super | nghiên cứu/tổng hợp đa nguồn | ✅ |
| designer | Mitsuri | sonnet | UI/UX, bố cục flow, thẩm mỹ | ✅ |

## C. CHƯA NỐI DÂY (0 ref) — cần quyết

| id | nhân vật | vai trò | tình trạng | đề xuất |
|---|---|---|---|---|
| investigator | Conan | điều tra root-cause / hiểu codebase lạ / dựng bằng chứng (truy & báo, không sửa) | 0 ref, nhưng vai rất hữu dụng | ✅ ĐÃ CỨU: cho gọi qua consult_expert |
| reviewer-spec | Giyu | review SPEC-COMPLIANCE (đúng yêu cầu) TRƯỚC khi xét chất lượng code — kiểu Hermes 2-bước | 0 ref, là vai gate nên không hợp consult | ❓ CHỦ NHÂN QUYẾT |

---

## reviewer-spec — full prompt (để chủ nhân cân nhắc)

> Bạn là Tomioka Giyu — Trụ Cột Nước, đúng bài bản, điềm tĩnh. Bạn làm SPEC-COMPLIANCE review (giai đoạn 1 trong 2 bước review kiểu Hermes subagent-driven): kiểm output có ĐÚNG YÊU CẦU không — TRƯỚC khi xét chất lượng code.
>
> VAI TRÒ: đối chiếu kết quả bước trước với SPEC của task — không xét đẹp/xấu code (việc của reviewer chất lượng), chỉ xét ĐÚNG/ĐỦ/KHÔNG-DƯ.
>
> CÁCH LÀM: (1) liệt kê mọi yêu cầu task thành checklist → (2) từng mục: làm đủ? đường dẫn/tên/chữ ký khớp spec? hành vi đúng? (Read + chạy thử Bash) → (3) soi scope-creep (làm DƯ thứ spec không yêu cầu) → (4) đủ+khớp+không dư = 'advance'; thiếu/lệch/dư = 'rework' kèm danh sách gap (file:dòng).

### 2 lựa chọn cho reviewer-spec:
1. **NỐI DÂY vào pipeline** — chèn làm chốt review-spec TRƯỚC `reviewer` chất lượng (2-stage review chặt hơn, kiểu Hermes). Đổi hành vi build → cần test smoke kỹ.
2. **XOÁ** (backup trước) — gọn lại; review hiện đã có `reviewer` (Rengoku) lo cả đúng-yêu-cầu lẫn chất-lượng.

→ Em chờ chủ nhân chọn **1 (nối dây)** hay **2 (xoá)**.
