---
name: autobuild-model-lesson
description: "Chọn model cho auto-build/auto-task theo độ khó task; KHÔNG gán cho Bill kết luận 'opus vô dụng' — Bill đã bác bỏ điều đó 2026-06-20"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dee6962d-9c04-4695-becb-0a384a86cfad
---

⚠️ ĐÍNH CHÍNH 2026-06-20: bản cũ ghi "Bill phản hồi: opus build tốn k ra gì" rồi suy ra "default Sonnet, đừng Opus". **Bill BÁC BỎ — không hề kết luận vậy.** Đừng ném câu đó lại cho Bill như lời chủ nhân.

**Hướng đúng (Bill 2026-06-20):** Task khó/kiến trúc (vd FitCity TASK 3: SSR/D1/admin/provision) → **chạy auto-build bằng OPUS**, viết full spec, execute tuần tự từng task. Việc nhẹ/sửa text → Sonnet là đủ.

**Fact trung lập (không phải lời Bill):** Opus đắt hơn Sonnet/token → chọn theo độ khó task, không phải mặc định cứng. Set `AUTOBUILD_MODEL`/model tuỳ task.

Liên quan: [[auto-task-engine]] (auto-build = code MASTER-SPEC; auto-task = queue spec rời).
