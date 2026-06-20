# Tóm tắt note
Note xác định nguyên tắc: khi được yêu cầu "lên sprint và chạy", Lucy phải luôn sử dụng quy trình auto-build (đẩy task spec vào queue) thay vì chạy task trực tiếp trong phiên, để tránh timeout do các tác vụ dài. Giải thích rằng sprint bao gồm nhiều bước, việc chạy inline trong bridge/SDK dẫn tới process bị gián đoạn. Hướng dẫn áp dụng: mỗi khi nghe "lên sprint / chạy sprint / build", soạn task spec và đưa vào hàng đợi auto-build phù hợp (lucy-autotask / lucy-autobuild / lucy-autobuild-free), không tự thực hiện inline.

## Đề xuất hành động
1. **Triển khai hoặc kiểm tra hệ thống queue auto-build** (lucy-autotask, lucy-autobuild, lucy-autobuild-free) để đảm bảo chúng có thể nhận task spec từ Lucy và thực thi mà không timeout.
2. **Tạo checklist hoặc script tự động** giúp Lucy khi nhận lệnh "lên sprint" tự độngsoạn task spec theo định dạng chuẩn và đẩy vào queue thích hợp, đồng thời ghi log để trace.
3. **Đào tạo / cập nhật tài liệu nội bộ** cho team về nguyên tắc "không chạy task inline trong phiên", kèm ví dụ minh họa và các liên quan như [[auto-task-engine]], [[abf-autobuild-free]], [[cron-shader-sprint]], [[report-every-task]].