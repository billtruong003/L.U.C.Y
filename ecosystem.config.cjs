// pm2 ecosystem — chạy Lucy engine + hub (VPS hoặc local). `pm2 start ecosystem.config.cjs`
// Secret lấy từ ENV (KHÔNG commit). Đặt trước: export AM_TOKEN=... ; export LUCY_HUB_PASSWORD=...
// BỎ-LIMIT set sẵn (quản tiền bằng autopilot, không chặn cứng) — đè được qua env.
const path = require('path')
const ROOT = __dirname
const AM = path.join(ROOT, 'agent-machine')
const HUB = path.join(ROOT, 'hub', 'server')
// turn-log dir DÙNG CHUNG: worker GHI, coordinator ĐỌC (/error-stats). Cùng VPS → cùng path = chia sẻ file.
const TURNS = path.join(AM, '.turns')
const TOK = process.env.AM_TOKEN || 'lucytok'
const PWD = process.env.LUCY_HUB_PASSWORD || '123'
const COORD = 'http://127.0.0.1:8780'
const base = { autorestart: true, windowsHide: true, interpreter: 'node', interpreter_args: '--import tsx' }

// Limits nới rộng — agent làm tới chất lượng, không bị cut/cap cứng. Autopilot lo tiền (trần $/card).
const LIM = {
  AM_PER_CARD_USD: process.env.AM_PER_CARD_USD || '50',
  AM_MAX_STAGE_VISITS: process.env.AM_MAX_STAGE_VISITS || '8',
  AM_CAP_USD: process.env.AM_CAP_USD || '200',
  AM_WEEKLY_CAP_USD: process.env.AM_WEEKLY_CAP_USD || '1000',
  // VPS yếu → trần đồng-thời thấp: tối đa 2 lane chạy 1 lúc (đè được qua env).
  AM_MAX_LANES: process.env.AM_MAX_LANES || '2',
}

module.exports = {
  apps: [
    { ...base, name: 'lucy-coordinator', cwd: AM, script: 'src/coordinator-main.ts',
      env: { AM_TOKEN: TOK, AM_PORT: '8780', AM_HOST: '127.0.0.1', LUCY_VAULT: path.join(ROOT, 'lucy-vault'), AM_TURNS_LOG: TURNS, ...LIM } },
    { ...base, name: 'lucy-hub', cwd: HUB, script: 'src/index.ts',
      env: { AM_COORD_URL: COORD, AM_TOKEN: TOK, LUCY_HUB_PASSWORD: PWD, LUCY_HUB_PORT: '8800', LUCY_HUB_HOST: '0.0.0.0' } },
    { ...base, name: 'lucy-worker', cwd: AM, script: 'src/worker-main.ts',
      env: { AM_COORD_URL: COORD, AM_TOKEN: TOK, AM_RUNNER: 'claude', AM_WORKER_CONCURRENCY: process.env.AM_WORKER_CONCURRENCY || '1', LLM_ENV_FILE: path.join(ROOT, '.env.llm'), AM_TURNS_LOG: TURNS, LUCY_VAULT: path.join(ROOT, 'lucy-vault') } },
    { ...base, name: 'lucy-autopilot', cwd: AM, script: 'src/autopilot-main.ts',
      env: { AM_COORD_URL: COORD, AM_TOKEN: TOK, AM_DIRECTOR_MODEL: 'opus', AM_AUTOPILOT_MAX: process.env.AM_AUTOPILOT_MAX || '300', AM_CARD_HARD_USD: process.env.AM_CARD_HARD_USD || '20' } },
  ],
}
