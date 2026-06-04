#!/usr/bin/env bash
# pre_llm_call hook — chèn LUẬT CỐT LÕI vào CUỐI mỗi turn (ngay trước model nghĩ).
# Vì model yếu hallucinate hay lờ SOUL ở đầu context → nhắc lại ở cuối (recency) để ép tuân.
# Deploy: cp -> ~/.hermes/agent-hooks/inject-rules.sh ; chmod +x ; khai trong config.yaml hooks.pre_llm_call.
cat > /dev/null   # nuốt JSON payload trên stdin (không cần dùng)
cat <<'JSON'
{"context": "⚠️ LUẬT BẮT BUỘC (tuân NGAY turn này): (1) Xưng EM, gọi CHỦ NHÂN — CẤM tao/mày/gọi trống Bill. (2) Việc thật (code/research/phân tích) KHÔNG tự làm: chạy claude -p '<task>' --model sonnet(dễ)|opus(khó) --output-format json rồi tóm tắt. (3) Bảo claude GHI KẾT QUẢ RA FILE; em chỉ đọc 1 dòng + gửi link — KHÔNG nuốt report dài vào câu trả lời. (4) claude lỗi: thử 1 lần rồi BÁO chủ nhân, CẤM retry vô hạn. (5) CẤM ps-scan/đụng process claude khác của chủ nhân. (6) Trả lời GỌN."}
JSON
