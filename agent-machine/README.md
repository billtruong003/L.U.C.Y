# Lucy Agent Machine — walking skeleton

Bộ máy multi-agent kiểu **Kanban** (xem [../docs/AGENT_MACHINE.md](../docs/AGENT_MACHINE.md)).
Đây là **walking-skeleton**: chứng minh lõi end-to-end **không đốt token** (MockRunner), trước khi cắm
durable infra thật (Postgres + pg-boss + DBOS) ở M2.1.

## Chạy
```bash
cd lucy/agent-machine
npm install
npm run demo        # MockRunner — KHÔNG gọi claude, không tốn token
```

## Demo chứng minh (đúng ví dụ portal)
`content soạn course → STUCK web không render → delegate sang engineer → HOLD →
engineer fix xong → RESUME → review (GATE) → Bill duyệt → ship → DONE`

→ Validate: **card→stage→runner→outcome→advance**, **delegate/blockedBy (DAG hold/resume)**,
**gate (HITL waiting_human + approve)**, **channels** (msg-as-data Bill đọc), **budget guard** (cửa 5h, cap → pause),
**workspace cô lập** mỗi card, **cap lane**.

## Cấu trúc
```
src/
├── types.ts      # Card / Stage / Pipeline / Persona / Outcome / ChannelMsg  (config-là-data)
├── store.ts      # persistence file-based (swap Postgres ở M2.1)
├── workspace.ts  # dir cô lập / blast-radius (→ git worktree ở M2.1)
├── budget.ts     # guardrail token theo cửa 5h/tuần
├── channels.ts   # message bus mỏng
├── runner.ts     # Runner: MockRunner (free) | ClaudeRunner (claude -p thật) | (remote worker sau)
├── engine.ts     # vòng auto-process: tick → run stage → áp outcome → gate/delegate
└── demo.ts       # kịch bản end-to-end
```

## Dùng Claude THẬT (đốt token — cẩn thận)
Đổi `new MockRunner(...)` → `new ClaudeRunner()` trong `demo.ts` (cần `claude` CLI trong PATH).
ClaudeRunner ép persona kết thúc bằng JSON outcome, parse `total_cost_usd`/`usage` cho ledger.

## Tiếp theo (M2.1)
- Swap Store → Postgres; queue → pg-boss; lifecycle/pause-resume → DBOS Transact.
- Runner → **remote worker** (local quay ra VPS coordinator pull card).
- Workspace → git worktree thật + restricted user + allowlist (FS defense đầy đủ).
- Wire vào hub UI: tab Board (Kanban) + tab Channels.
