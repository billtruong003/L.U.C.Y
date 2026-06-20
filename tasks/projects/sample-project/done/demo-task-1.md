---
id: demo-task-1
title: Demo task trong sample-project
tier: lane
priority: 3
max_lane_turns: 4
status: queued
---

## Mục tiêu
Tóm tắt ngắn nội dung file project.md của sample-project.

## Đầu ra mong muốn
- 3 dòng tóm tắt goal của project
- Ghi ra file output


---

## Kết quả (lane)

Tôi đã đọc file `project.md` của sample-project. Giờ tôi sẽ ghi kết quả ra file và trả lời tóm tắt.

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="write_file">
<｜｜DSML｜｜parameter name="path" string="true">/root/lucy/tasks/projects/sample-project/done/demo-task-1-output.md</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="content" string="true"># DEMO TASK 1 OUTPUT — Tóm tắt project.md

## Tóm tắt goal của

📄 File: `/root/lucy/tasks/projects/sample-project/done/demo-task-1-output.md`
