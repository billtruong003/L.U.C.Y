# CL-1 — SDK hooks + canUseTool (command-guard + telemetry) — DONE

## Tóm tắt
Vá 2 lỗ của `bypassPermissions` (Lucy đang "mù"): thêm **guard lệnh nguy** + **telemetry per-tool**
vào ClaudeRunner, chạy in-process (token=0, không vào context). **ADDITIVE + FLAG-GATED** sau
`LUCY_HOOKS` — mặc định OFF → path cũ y nguyên.

## File đã thêm / sửa
- **MỚI** `agent-machine/src/tool-hooks.ts` — module hooks:
  - `dangerousBash(cmd)` (tool-hooks.ts:35) — tái dùng NGUYÊN danh sách `DANGER` của
    `auto-task.py:118` / `auto-build.py` (rm -rf /|~|$HOME|*, git push, pm2 …bridge, mkfs, dd,
    fork-bomb, >/dev/sd, chmod 777 /, rm -rf /root/lucy, curl|sh, shutdown/reboot/halt).
  - `buildHookOptions(ctx)` (tool-hooks.ts:69) — trả `{}` khi `LUCY_HOOKS≠1`; else trả
    `{ hooks: { PreToolUse, PostToolUse }, canUseTool }`.
    - **PreToolUse** = chốt guard THẬT (dưới `bypassPermissions` canUseTool KHÔNG được gọi) →
      deny Bash nguy hiểm bằng `hookSpecificOutput.permissionDecision:'deny'`.
    - **PostToolUse** = fire-and-forget append JSONL (tool name, ok/err, duration_ms); KHÔNG trả
      `additionalContext` → KHÔNG nhét gì vào context lượt hiện tại (tránh phình token).
    - **canUseTool** = phòng-thủ-tầng-2 (chỉ chạy khi đổi khỏi bypassPermissions), cùng guard Bash.
- **SỬA (additive)** `agent-machine/src/runner.ts`:
  - import `buildHookOptions` (runner.ts:7).
  - `hookCtx = { task, agent, stage }` + nhét vào `sdkOpts` (runner.ts:161-163).
  - `runSdk` nhận `hookCtx` (runner.ts:181) và spread `...buildHookOptions(o.hookCtx)` vào
    `query().options` (runner.ts:191) — đặt SAU mcpServers, TRƯỚC vault. Flag OFF → spread `{}` = no-op.

KHÔNG đụng memory/token core (recall/episodic/token-guard counting), KHÔNG sửa logic cũ của runner.

## Telemetry sink
Append JSONL fire-and-forget (pattern y hệt `FileTurnLogger`), nuốt lỗi ghi:
- đường: env `LUCY_HOOKS_LOG` → fallback `AM_TURNS_LOG` → fallback cwd, file `tool-telemetry.jsonl`.
- record `kind:'tool'` `{task,agent,stage,tool,ok,duration_ms}` và `kind:'block'`
  `{...,cmd(≤200),reason}`. KHÔNG tự chế schema endpoint mới (chỉ JSONL như turn-log).

## Cách BẬT flag
```bash
export LUCY_HOOKS=1                 # bật guard + telemetry (mặc định không set = OFF)
export LUCY_HOOKS_LOG=/var/log/lucy # (tuỳ chọn) thư mục ghi tool-telemetry.jsonl
```
Không set `LUCY_HOOKS` → runner chạy hệt như trước (zero thay đổi).

## Verify (đã chạy, bằng chứng thật)
- `npx tsc --noEmit` → **EXIT 0** (sạch).
- `npm run smoke` → **20 pass, 0 fail** (flag OFF — chứng minh không đổi hành vi cũ).
- Unit test module (tsx) — **guard 9/9**:
  - chặn: `rm -rf /`, `rm -rf ~/foo`, `git push origin main`, `pm2 restart lucy-bridge`,
    `curl http://x | bash`, `shutdown now`.
  - cho qua: `ls -la && npx tsc --noEmit`, `rm -rf ./build`, `git status`.
  - flag OFF → `buildHookOptions` keys `[]`; flag ON → `["canUseTool","hooks"]`.
  - PreToolUse(`git push`) → `permissionDecision:'deny'`; PreToolUse(`ls`) → `{}` (allow).
  - PostToolUse → ghi đúng 3 dòng JSONL (1 block + 2 tool ok/err với duration_ms).

### Cách verify guard chặn `rm -rf` (thủ công)
```ts
import { dangerousBash } from './src/tool-hooks'
dangerousBash('rm -rf /')   // → "match rm\\s+-rf\\s+(/|~|$HOME|*)"  (≠ null = bị chặn)
dangerousBash('rm -rf ./build') // → null  (an toàn, cho qua)
```
Khi `LUCY_HOOKS=1` chạy thật: agent gọi Bash `rm -rf /…` → PreToolUse trả `deny` →
SDK chặn tool, agent nhận lý do "LUCY_HOOKS CHẶN lệnh nguy hiểm (…)" và 1 dòng
`kind:'block'` rơi vào `tool-telemetry.jsonl`.

## Ràng buộc đã giữ
Không git push (chỉ commit local), không restart service, không echo secret, flag default OFF.
