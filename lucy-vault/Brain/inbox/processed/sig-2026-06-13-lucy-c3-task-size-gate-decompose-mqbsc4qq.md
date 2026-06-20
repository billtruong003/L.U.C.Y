---
kind: brain-signal
id: sig-2026-06-13-lucy-c3-task-size-gate-decompose-mqbsc4qq
created_at: 2026-06-13T03:17:54.050Z
topic: Lucy/c3-task-size-gate-decompose-first
signal: negative
agent: engine
principle: "8/11 FAIL — size-gate.ts chưa tạo (BUG1); engine.ts:tick() dòng 317 dispatch vô điều kiện không kiểm brief length (BUG2); không spawn decompose child + không block parent (BUG3). Cần: tạo src/size-gate.ts với BRIEF_CHAR_MAX+briefTooLarge(), thêm nhánh if (briefTooLarge(c.brief)) vào tick() trước dòng 317 để block card + createCard child với architect pipeline."
scope: tester
evidenced_by: [card_mqb4cx8y3]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 8/11 FAIL — size-gate.ts chưa tạo (BUG1); engine.ts:tick() dòng 317 dispatch vô điều kiện không kiểm brief length (BUG2); không spawn decompose child + không block parent (BUG3). Cần: tạo src/size-gate.ts với BRIEF_CHAR_MAX+briefTooLarge(), thêm nhánh if (briefTooLarge(c.brief)) vào tick() trước dòng 317 để block card + createCard child với architect pipeline.
