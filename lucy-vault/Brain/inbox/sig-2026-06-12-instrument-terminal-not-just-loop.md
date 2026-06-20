---
kind: brain-signal
id: sig-2026-06-12-instrument-terminal-not-just-loop
created_at: 2026-06-12T16:00:00.000Z
topic: agent-machine/observability-instrument-all-exit-paths
signal: negative
agent: lucy
principle: Khi instrument log/metrics, phủ MỌI exit path — nhất là nhánh "stuck/exhausted" mà feature sinh ra để truy vết — đừng chỉ log thân vòng lặp.
evidenced_by: []
---

turn-log instrument mọi turn trong vòng `for i<maxTurns` (tool_call/text/outcome/error) nhưng nhánh maxTurns-exhausted (lane-runner.ts:130-135) — salvage/needs_decision — KHÔNG log record terminal. Đây đúng là ca "agent kẹt turn không ra outcome" mà card sinh ra để trace, nên trong JSONL chỉ thấy N tool_call rồi im lặng, không biết kết cục salvage hay needs_decision. Unit smoke (gọi logger trực tiếp) không bắt được; chỉ chạy THẬT LaneRunner.run mới lộ.
