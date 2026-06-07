// Worker entry — CHẠY TRÊN MÁY LOCAL (mạnh). Quay ra coordinator, chạy claude -p thật.
// AM_RUNNER=claude để chạy thật (đốt token); mặc định mock (an toàn, chỉ test plumbing).
import { MockRunner, ClaudeRunner } from './runner'
import { runWorker } from './worker'
import type { Outcome } from './types'

const URL = process.env.AM_COORD_URL || 'http://127.0.0.1:8780'
const TOKEN = process.env.AM_TOKEN || ''
const MODE = (process.env.AM_RUNNER || 'mock').toLowerCase()
// số claude -p song song trên MÁY NÀY. VPS đặt 2 (cron/light); máy local mạnh đặt cao hơn.
const CONCURRENCY = Number(process.env.AM_WORKER_CONCURRENCY || 1)

const mockScript: Record<string, Outcome> = {} // mock -> default 'advance' (chỉ test đường truyền)
const runner = MODE === 'claude' ? new ClaudeRunner() : new MockRunner(mockScript)

console.log(`🛠 Lucy Agent-Machine worker → ${URL}  runner=${MODE} concurrency=${CONCURRENCY}` + (MODE !== 'claude' ? '  (MOCK — KHÔNG đốt token; đặt AM_RUNNER=claude để chạy claude -p thật)' : ''))
runWorker(URL, runner, { token: TOKEN || undefined, pollMs: Number(process.env.AM_POLL_MS || 800), concurrency: CONCURRENCY }).catch((e) => { console.error(e); process.exit(1) })
