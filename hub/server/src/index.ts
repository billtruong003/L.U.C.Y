/**
 * Lucy Hub — Node/TS backend (Express). Web command center, standalone (KHÔNG Hermes).
 * Login + job nền + poll. Engine = `claude -p` (child_process). Serve React build (../../web/dist).
 *
 * Dev:  npm install ; (đặt env) ; npm run dev      (web: cd ../web && npm run dev, proxy /api)
 * Prod: cd ../web && npm run build ; rồi  npm start
 */
import 'dotenv/config'   // auto-load .env (cùng thư mục chạy) → pm2 khỏi cần set env tay
import express, { type Request } from 'express'
import cookieParser from 'cookie-parser'
import { spawn } from 'node:child_process'
import { randomBytes, createHmac } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { generateSecret, generateSync, verifySync, generateURI } from 'otplib'
import * as qrcodeNs from 'qrcode'
const QRCode: any = (qrcodeNs as any).default || qrcodeNs
const totpOk = (code: string, secret: string) => { try { return verifySync({ token: code, secret }).valid } catch { return false } }

const home = (p: string) => p.replace(/^~/, os.homedir())

const PASSWORD = process.env.LUCY_HUB_PASSWORD || ''
const PORT = Number(process.env.LUCY_HUB_PORT || 8800)
const HOST = process.env.LUCY_HUB_HOST || '0.0.0.0'   // nginx setup: đặt 127.0.0.1 (chỉ nginx proxy vào)
const WORKDIR = home(process.env.LUCY_WORKDIR || '~/lucy/workspace')
const CLAUDE = process.env.CLAUDE_BIN || 'claude'
const PERSONA = home(process.env.LUCY_PERSONA || '~/lucy/bridge/persona.md')
// TRÍ NHỚ: vault = não DUY NHẤT — mọi claude -p phải --add-dir vault (không thì Lucy mù vault,
// ghi nhầm auto-memory built-in của Claude Code → 2 não đánh nhau, bug 2026-06-11).
const VAULT = home(process.env.LUCY_VAULT || '~/lucy/lucy-vault')
const TIMEOUT = Number(process.env.LUCY_CLAUDE_TIMEOUT || 900) * 1000
const DIST = path.join(__dirname, '..', '..', 'web', 'dist')
const PROJECTS = home(process.env.LUCY_PROJECTS_ROOT || WORKDIR)   // gốc cho tab Projects (file tree)
// (Voice đã bỏ — VPS 2GB không kham MeloTTS. Chỉ chat.)
// Brain-viz telemetry: integrations (API/MCP…) khai báo ở file -> mỗi cái = 1 node. Thêm vào file là node hiện.
const INTEGRATIONS_FILE = home(process.env.LUCY_INTEGRATIONS_FILE || path.join(PROJECTS, 'integrations.json'))
const TZ_OFFSET = Number(process.env.LUCY_TZ_OFFSET || 7)   // VN = UTC+7 (cho schedule)
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''       // optional: schedule đẩy Telegram
const TG_CHAT = process.env.LUCY_PUSH_CHAT_ID || process.env.LUCY_ALLOWED_USER_ID || ''
// Aki (radiant-bot Discord) control API — Lucy đẩy báo cáo / tạo kênh
const RADIANT_API = (process.env.RADIANT_BOT_API_URL || '').replace(/\/$/, '')
const AGENT_SECRET = process.env.RADIANT_BOT_AGENT_SECRET || ''
// Agent-Machine coordinator — hub proxy (browser gọi hub đã authed, token giữ server-side)
const AM_URL = (process.env.AM_COORD_URL || '').replace(/\/$/, '')
const AM_TOKEN = process.env.AM_TOKEN || ''
let lastAkiAt = 0   // brain-viz: node Aki sáng khi vừa đẩy
// STATE dir bền: 2FA secret, schedules, log, lịch sử chat
const STATE = home(process.env.LUCY_STATE || path.join(os.homedir(), '.lucy-hub'))
fs.mkdirSync(STATE, { recursive: true })
fs.mkdirSync(WORKDIR, { recursive: true })
const SECRET_FILE = path.join(STATE, 'twofa.json')
const SCHED_FILE = path.join(STATE, 'schedules.json')
const LOG_FILE = path.join(STATE, 'log.jsonl')
const CHAT_FILE = path.join(STATE, 'chat.json')

const readJSON = <T>(f: string, dflt: T): T => { try { return JSON.parse(fs.readFileSync(f, 'utf-8')) } catch { return dflt } }
const writeJSON = (f: string, v: unknown) => { try { fs.writeFileSync(f, JSON.stringify(v, null, 2)) } catch { /* */ } }

// ---- LOG (ring buffer + file jsonl) ----
type LogEv = { t: number; level: 'info' | 'warn' | 'error'; type: string; msg: string }
const logBuf: LogEv[] = []
function logEvent(level: LogEv['level'], type: string, msg: string) {
  const ev: LogEv = { t: Date.now(), level, type, msg: String(msg).slice(0, 500) }
  logBuf.push(ev); if (logBuf.length > 800) logBuf.shift()
  try { fs.appendFileSync(LOG_FILE, JSON.stringify(ev) + '\n') } catch { /* */ }
}

function safePath(p: string): string | null {
  const base = path.resolve(PROJECTS)
  const r = path.resolve(base, p || '.')
  return r === base || r.startsWith(base + path.sep) ? r : null   // chặn path traversal ra ngoài root
}

const tokens = new Set<string>()
type Job = { status: 'running' | 'done'; result: string | null; model: string; t0: number; session_id: string | null; prompt: string }
const jobs = new Map<string, Job>()

// Lịch sử chat (bền qua restart) — server tự giữ session_id để --resume
type ChatMsg = { role: 'me' | 'lucy'; text: string; t: number }
let chat = readJSON<{ sessionId: string | null; messages: ChatMsg[] }>(CHAT_FILE, { sessionId: null, messages: [] })
const saveChat = () => { if (chat.messages.length > 400) chat.messages = chat.messages.slice(-400); writeJSON(CHAT_FILE, chat) }

function runClaude(prompt: string, sessionId: string | null, model: string): Promise<{ sid: string | null; text: string }> {
  const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--model', model]
  if (fs.existsSync(PERSONA)) args.push('--append-system-prompt-file', PERSONA)
  if (fs.existsSync(VAULT)) args.push('--add-dir', VAULT) // não vault luôn trong tầm mắt
  if (sessionId) args.push('--resume', sessionId)
  return new Promise((resolve) => {
    // stdio stdin='ignore' → claude khỏi chờ stdin 3s. CLAUDE phải là exe thật (win: ...\bin\claude.exe).
    const child = spawn(CLAUDE, args, {
      cwd: WORKDIR, env: { ...process.env, IS_SANDBOX: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = '', errb = ''
    const timer = setTimeout(() => child.kill(), TIMEOUT)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (errb += d))
    child.on('error', (e) => { clearTimeout(timer); resolve({ sid: null, text: `❌ spawn lỗi: ${String(e).slice(0, 400)}` }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out) return resolve({ sid: null, text: `❌ Claude lỗi (${code}): ${(errb || '').slice(0, 600)}` })
      try {
        const d = JSON.parse(out)
        resolve({ sid: d.session_id || null, text: d.result || '(rỗng)' })
      } catch {
        resolve({ sid: null, text: (out || '(parse err)').slice(0, 3500) })
      }
    })
  })
}

const app = express()
app.use(express.json())
app.use(cookieParser())
const authed = (req: Request) => tokens.has(req.cookies?.lucy_token)
function issueToken(res: any) {
  const tok = randomBytes(24).toString('base64url')
  tokens.add(tok)
  res.cookie('lucy_token', tok, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400 * 1000 })
}

// ---- 2FA (TOTP, otplib v13) ----
let twofa = readJSON<{ secret?: string; enabled?: boolean }>(SECRET_FILE, {})
let pendingSecret: string | null = null   // secret chờ xác nhận khi setup
const twofaOn = () => !!(twofa.enabled && twofa.secret)

app.post('/login', (req, res) => {
  const pwOk = PASSWORD && req.body?.password === PASSWORD
  if (!pwOk) { logEvent('warn', 'auth', 'login sai mật khẩu'); return res.status(401).json({ ok: false }) }
  if (twofaOn()) {
    const code = String(req.body?.code || '').trim()
    if (!code) return res.status(401).json({ ok: false, need_code: true })
    if (!totpOk(code, twofa.secret!)) { logEvent('warn', 'auth', 'login sai mã 2FA'); return res.status(401).json({ ok: false, need_code: true, bad_code: true }) }
  }
  issueToken(res); logEvent('info', 'auth', 'login thành công')
  res.json({ ok: true, twofa: twofaOn() })
})

app.get('/api/me', (req, res) => res.json({ authed: authed(req), twofa: twofaOn() }))

// 2FA quản lý (cần đã đăng nhập)
app.get('/api/2fa/status', (req, res) => { if (!authed(req)) return res.status(401).json({ error: 'unauth' }); res.json({ enabled: twofaOn() }) })
app.post('/api/2fa/setup', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  pendingSecret = generateSecret()
  const uri = generateURI({ issuer: 'Lucy Hub', label: 'chủ nhân', secret: pendingSecret })
  const qr = await QRCode.toDataURL(uri, { margin: 1, color: { dark: '#0a1322', light: '#bff8ff' } })
  res.json({ secret: pendingSecret, qr })
})
app.post('/api/2fa/enable', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const code = String(req.body?.code || '').trim()
  if (!pendingSecret || !totpOk(code, pendingSecret)) return res.status(400).json({ error: 'mã sai' })
  twofa = { secret: pendingSecret, enabled: true }; writeJSON(SECRET_FILE, twofa); pendingSecret = null
  logEvent('info', 'auth', '2FA đã bật'); res.json({ ok: true })
})
app.post('/api/2fa/disable', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const code = String(req.body?.code || '').trim()
  if (!twofaOn() || !totpOk(code, twofa.secret!)) return res.status(400).json({ error: 'mã sai' })
  twofa = {}; writeJSON(SECRET_FILE, twofa); logEvent('warn', 'auth', '2FA đã tắt'); res.json({ ok: true })
})

app.get('/api/logs', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ logs: logBuf.slice(-200).reverse() })
})

app.post('/api/send', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const prompt = (req.body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'empty' })
  const model = req.body?.opus ? 'opus' : 'sonnet'
  // scope = chuỗi key (vd 'proj:<id>') → Lucy DỰ ÁN: phiên ĐỘC LẬP, KHÔNG --resume chat tổng,
  // KHÔNG ghi vào history chat tổng (hết lẫn ngữ cảnh + hết làm bẩn chat tổng). Lucy dự án tự nhồi
  // transcript mỗi lượt nên không cần --resume; lịch sử dự án lưu riêng ở kênh __lucy (client amLogLucy).
  const scope = typeof req.body?.scope === 'string' && req.body.scope.trim() ? req.body.scope.trim() : null
  const resumeSid = scope ? null : chat.sessionId
  const id = randomBytes(8).toString('base64url')
  if (!scope) { chat.messages.push({ role: 'me', text: prompt, t: Date.now() }); saveChat() }   // chỉ chat tổng mới lưu
  jobs.set(id, { status: 'running', result: null, model, t0: Date.now(), session_id: resumeSid, prompt: prompt.slice(0, 120) })
  logEvent('info', 'job', `▶ ${model}${scope ? ' · ' + scope : ''}: ${prompt.slice(0, 80)}`)
  runClaude(prompt, resumeSid, model).then(({ sid, text }) => {
    const j = jobs.get(id)
    if (j) { j.result = text; j.session_id = sid || j.session_id; j.status = 'done' }
    if (!scope) {   // chat tổng: cập nhật session + lưu trả lời. Lucy dự án: KHÔNG đụng chat tổng.
      chat.sessionId = sid || chat.sessionId
      chat.messages.push({ role: 'lucy', text, t: Date.now() }); saveChat()
    }
    logEvent('info', 'job', `✓ ${model} xong (${Math.floor((Date.now() - (j?.t0 || Date.now())) / 1000)}s)`)
  })
  res.json({ job_id: id })
})

app.get('/api/chat', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ messages: chat.messages.slice(-200) })
})
app.post('/api/chat/new', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  chat = { sessionId: null, messages: [] }; saveChat(); logEvent('info', 'chat', 'phiên chat mới')
  res.json({ ok: true })
})

// ---- Aki (Discord) qua radiant-bot control API (HMAC) ----
const akiOn = () => !!(RADIANT_API && AGENT_SECRET)
async function akiCall(pathName: string, payload: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const body = JSON.stringify(payload)
  const sig = 'sha256=' + createHmac('sha256', AGENT_SECRET).update(body).digest('hex')
  const r = await fetch(RADIANT_API + pathName, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lucy-signature': sig }, body })
  let data: any = null; try { data = await r.json() } catch { /* */ }
  return { ok: r.ok, status: r.status, data }
}

app.get('/api/aki/status', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ configured: akiOn() })
})
app.post('/api/aki/report', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!akiOn()) return res.status(400).json({ error: 'Aki chưa cấu hình (RADIANT_BOT_API_URL + RADIANT_BOT_AGENT_SECRET)' })
  const channel = String(req.body?.channel || '').trim()
  const text = String(req.body?.text || '').trim()
  if (!channel || !text) return res.status(400).json({ error: 'cần channel + text' })
  try {
    const r = await akiCall('/api/agent/post', { channel, text })
    lastAkiAt = Date.now()
    logEvent(r.ok ? 'info' : 'error', 'aki', r.ok ? `📣 đẩy báo cáo -> #${channel}` : `✗ Aki post lỗi: ${r.data?.error || r.status}`)
    res.status(r.ok ? 200 : 502).json(r.data || { error: 'aki ' + r.status })
  } catch (e) { logEvent('error', 'aki', 'Aki offline'); res.status(502).json({ error: 'Aki offline: ' + String(e).slice(0, 150) }) }
})
app.post('/api/aki/channel', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!akiOn()) return res.status(400).json({ error: 'Aki chưa cấu hình' })
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'cần name' })
  const payload = { name, type: req.body?.type === 'thread' ? 'thread' : 'text', parent: req.body?.parent, message: req.body?.message }
  try {
    const r = await akiCall('/api/agent/channel', payload)
    lastAkiAt = Date.now()
    logEvent(r.ok ? 'info' : 'error', 'aki', r.ok ? `➕ tạo ${payload.type} "${name}"` : `✗ Aki channel lỗi: ${r.data?.error || r.status}`)
    res.status(r.ok ? 200 : 502).json(r.data || { error: 'aki ' + r.status })
  } catch (e) { res.status(502).json({ error: 'Aki offline: ' + String(e).slice(0, 150) }) }
})

app.get('/api/poll/:id', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const j = jobs.get(req.params.id)
  if (!j) return res.status(404).json({ error: 'nojob' })
  res.json({
    status: j.status, result: j.result, model: j.model,
    elapsed: Math.floor((Date.now() - j.t0) / 1000), session_id: j.session_id,
  })
})

app.get('/api/jobs', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const list = [...jobs.entries()].slice(-30).reverse().map(([id, j]) => ({
    id, status: j.status, model: j.model, prompt: j.prompt, elapsed: Math.floor((Date.now() - j.t0) / 1000),
  }))
  res.json({ jobs: list })
})

// Brain-viz telemetry: graph state THẬT (node/link) từ jobs đang chạy + integrations + voice.
app.get('/api/telemetry', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const running = [...jobs.values()].filter((j) => j.status === 'running')
  const sonnetN = running.filter((j) => j.model === 'sonnet').length
  const opusN = running.filter((j) => j.model === 'opus').length
  let integrations: { id: string; label: string; group?: string }[] = []
  try { integrations = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, 'utf-8')) } catch { /* none */ }

  // PHÂN VÙNG lớn (zone) — core → zone → node
  const ZONES = [
    { id: 'z_agents', label: 'AGENTS' },
    { id: 'z_channels', label: 'CHANNELS' },
    { id: 'z_money', label: 'MONEY · DATA' },
    { id: 'z_dev', label: 'DEV' },
  ]
  // leaf hệ thống — LIVE (phản ánh state THẬT)
  const leaves: any[] = [
    { id: 'sonnet', label: 'Claude Sonnet', zone: 'z_agents', group: 'model', val: 13, active: sonnetN > 0, load: sonnetN, status: 'live' },
    { id: 'opus', label: 'Claude Opus', zone: 'z_agents', group: 'model', val: 13, active: opusN > 0, load: opusN, status: 'live' },
    { id: 'telegram', label: 'Telegram', zone: 'z_channels', group: 'channel', val: 10, active: false, status: 'live' },
    { id: 'aki', label: 'Aki · Discord', zone: 'z_channels', group: 'channel', val: 10, active: Date.now() - lastAkiAt < 8000, status: 'live' },
    { id: 'hub', label: 'Web Hub', zone: 'z_channels', group: 'channel', val: 11, active: true, status: 'live' },
  ]
  // mở rộng / IDEAS từ integrations.json (zone + status tuỳ chọn) — thêm dòng là có node
  for (const it of integrations as any[]) {
    leaves.push({ id: it.id, label: it.label, zone: it.zone || 'z_dev', group: it.group || 'api', val: it.val || 8, active: false, status: it.status || 'planned' })
  }
  // mỗi SCHEDULE/CRON = 1 node THẬT -> não lớn dần khi tạo thêm lịch (sáng ~8s khi vừa chạy)
  for (const s of scheds) {
    leaves.push({ id: 'sched_' + s.id, label: s.name, zone: 'z_dev', group: 'voice', val: 8, active: !!s.lastRun && Date.now() - (s.lastRun || 0) < 8000, status: 'live' })
  }

  // agent-machine: mỗi DỰ ÁN = 1 node (z_dev) — task chạy -> sáng + vào running. (Neural lớn dần theo số dự án.)
  const amRunning: { model: string; prompt: string; elapsed: number }[] = []
  try {
    const r = await amFetch('/state'); const st: any = await r.json()
    const cards: any[] = st.cards || []
    const working = cards.filter((c) => c.status === 'working')
    for (const p of (st.projects || []) as any[]) {
      if (p.trashed) continue
      const pc = cards.filter((c) => (c.projectId || 'default') === p.id)
      leaves.push({ id: 'proj_' + p.id, label: p.name, zone: 'z_dev', group: 'api', val: 10, active: pc.some((c) => c.status === 'working' || c.status === 'waiting_human'), load: pc.filter((c) => c.status === 'working').length, status: 'live' })
    }
    for (const c of working) amRunning.push({ model: c.modelOverride === 'opus' ? 'opus' : 'sonnet', prompt: c.title, elapsed: c.updatedAt ? Math.floor((Date.now() - c.updatedAt) / 1000) : 0 })
    const amSon = working.filter((c) => c.modelOverride !== 'opus').length
    const amOpu = working.filter((c) => c.modelOverride === 'opus').length
    const son = leaves.find((l) => l.id === 'sonnet'); if (son && amSon) { son.active = true; son.load = (son.load || 0) + amSon }
    const opu = leaves.find((l) => l.id === 'opus'); if (opu && amOpu) { opu.active = true; opu.load = (opu.load || 0) + amOpu }
  } catch { /* agent-machine offline -> bỏ qua */ }

  const nodes: any[] = [{ id: 'lucy', label: 'L.U.C.Y', group: 'core', val: 28, active: running.length > 0 || amRunning.length > 0, status: 'live' }]
  const links: any[] = []
  for (const z of ZONES) {
    const kids = leaves.filter((l) => l.zone === z.id)
    if (!kids.length) continue
    const zActive = kids.some((k) => k.active)
    const zFlow = kids.reduce((s, k) => s + (k.load || 0), 0)
    nodes.push({ id: z.id, label: z.label, group: 'zone', val: 15, active: zActive, status: 'live' })
    links.push({ source: 'lucy', target: z.id, flow: zFlow, active: zActive })
    for (const k of kids) { nodes.push(k); links.push({ source: z.id, target: k.id, flow: k.load || 0, active: !!k.active }) }
  }
  // mạng lưới: vòng nối các zone + vài cross-link node live -> rậm như neuron
  const zoneIds = nodes.filter((n) => n.group === 'zone').map((n) => n.id)
  for (let i = 0; i < zoneIds.length; i++) links.push({ source: zoneIds[i], target: zoneIds[(i + 1) % zoneIds.length], flow: 0, active: false })
  const has = (id: string) => nodes.some((n) => n.id === id)
  for (const [a, b] of [['hub', 'sonnet'], ['hub', 'opus'], ['telegram', 'aki'], ['aki', 'opus']]) {
    if (has(a) && has(b)) links.push({ source: a, target: b, flow: 0, active: false })
  }
  res.json({
    nodes, links, ts: Date.now(),
    running: [...running.map((j) => ({ model: j.model, prompt: j.prompt, elapsed: Math.floor((Date.now() - j.t0) / 1000) })), ...amRunning],
  })
})

app.get('/api/tree', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const dir = safePath(String(req.query.path || '.'))
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return res.status(400).json({ error: 'badpath' })
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
  res.json({ root: PROJECTS, path: path.relative(PROJECTS, dir) || '.', entries })
})

app.get('/api/file', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const fp = safePath(String(req.query.path || ''))
  if (!fp || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return res.status(400).json({ error: 'badpath' })
  const size = fs.statSync(fp).size
  if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|exe|bin|woff2?|mp[34]|mov|class|jar)$/i.test(fp)) return res.json({ binary: true, size })
  if (size > 500 * 1024) return res.json({ binary: false, tooBig: true, size })
  res.json({ binary: false, name: path.basename(fp), content: fs.readFileSync(fp, 'utf-8').slice(0, 200000) })
})

// ---- SCHEDULES (đặt lịch chạy prompt) ----
type Sched = { id: string; name: string; prompt: string; model: string; times: string[]; enabled: boolean; lastRun: number | null; lastStatus: string; lastResult: string; lastKey?: string }
let scheds: Sched[] = readJSON<Sched[]>(SCHED_FILE, [])
const saveScheds = () => writeJSON(SCHED_FILE, scheds)

async function pushTelegram(text: string) {
  if (!TG_TOKEN || !TG_CHAT) return
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: text.slice(0, 3800) }),
    })
  } catch { /* */ }
}

async function fireSchedule(s: Sched, manual = false) {
  logEvent('info', 'schedule', `⏰ chạy "${s.name}"${manual ? ' (thủ công)' : ''}`)
  const id = randomBytes(8).toString('base64url')
  jobs.set(id, { status: 'running', result: null, model: s.model, t0: Date.now(), session_id: null, prompt: `[lịch] ${s.name}` })
  const { text } = await runClaude(s.prompt, null, s.model)
  const j = jobs.get(id); if (j) { j.result = text; j.status = 'done' }
  s.lastRun = Date.now(); s.lastStatus = text.startsWith('❌') ? 'error' : 'ok'; s.lastResult = text.slice(0, 400); saveScheds()
  logEvent(s.lastStatus === 'ok' ? 'info' : 'error', 'schedule', `${s.lastStatus === 'ok' ? '✓' : '✗'} "${s.name}"`)
  await pushTelegram(`🗓️ Lucy — ${s.name}\n\n${text}`)
}

app.get('/api/schedules', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ schedules: scheds, push: !!(TG_TOKEN && TG_CHAT) })
})
app.post('/api/schedules', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const b = req.body || {}
  const name = String(b.name || '').trim(); const prompt = String(b.prompt || '').trim()
  if (!name || !prompt) return res.status(400).json({ error: 'thiếu name/prompt' })
  const times = (Array.isArray(b.times) ? b.times : String(b.times || '').split(','))
    .map((t: string) => t.trim()).filter((t: string) => /^\d{1,2}:\d{2}$/.test(t))
  const s: Sched = { id: randomBytes(6).toString('base64url'), name, prompt, model: b.model === 'opus' ? 'opus' : 'sonnet', times, enabled: true, lastRun: null, lastStatus: '', lastResult: '' }
  scheds.push(s); saveScheds(); logEvent('info', 'schedule', `+ tạo lịch "${name}" [${times.join(', ')}]`)
  res.json({ ok: true, schedule: s })
})
app.patch('/api/schedules/:id', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const s = scheds.find((x) => x.id === req.params.id); if (!s) return res.status(404).json({ error: 'nf' })
  if (typeof req.body?.enabled === 'boolean') s.enabled = req.body.enabled
  saveScheds(); res.json({ ok: true })
})
app.delete('/api/schedules/:id', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  scheds = scheds.filter((x) => x.id !== req.params.id); saveScheds(); res.json({ ok: true })
})
app.post('/api/schedules/:id/run', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const s = scheds.find((x) => x.id === req.params.id); if (!s) return res.status(404).json({ error: 'nf' })
  fireSchedule(s, true); res.json({ ok: true })
})

// ---- CRON hệ thống (chỉ xem) — surface crontab -l vào tab Schedule ----
function cronTimes(min: string, hour: string): string[] {
  if (min === '*' || hour === '*') return []
  const out: string[] = []
  for (const h of hour.split(',')) for (const m of min.split(',')) {
    if (/^\d{1,2}$/.test(h) && /^\d{1,2}$/.test(m)) out.push(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`)
  }
  return out
}
function readCrontab(): Promise<{ times: string[]; schedule: string; command: string; label: string; raw: string }[]> {
  return new Promise((resolve) => {
    const child = spawn('crontab', ['-l'])
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.on('error', () => resolve([]))
    child.on('close', () => {
      const rows: { times: string[]; schedule: string; command: string; label: string; raw: string }[] = []
      for (const line of out.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const m = t.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/)
        if (!m) continue
        const [, min, hour, dom, mon, dow, command] = m
        const cmd = command.replace(/\s*>>?.*$/, '').trim()   // bỏ phần redirect log
        const label = (cmd.split(/\s+/)[0].split('/').pop() || cmd).replace(/\.\w+$/, '')
        rows.push({ times: cronTimes(min, hour), schedule: `${min} ${hour} ${dom} ${mon} ${dow}`, command: cmd, label, raw: t })
      }
      resolve(rows)
    })
  })
}
app.get('/api/crontab', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ crons: await readCrontab() })
})

// scheduler tick: mỗi 30s, bắn lịch tới giờ (1 lần / time / ngày, theo giờ VN)
setInterval(() => {
  const now = new Date(Date.now() + TZ_OFFSET * 3600 * 1000)
  const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  const dayKey = now.toISOString().slice(0, 10)
  for (const s of scheds) {
    if (!s.enabled) continue
    if (s.times.some((t) => t.padStart(5, '0') === hhmm)) {
      const key = `${dayKey}T${hhmm}`
      if (s.lastKey !== key) { s.lastKey = key; saveScheds(); fireSchedule(s) }
    }
  }
}, 30000)

// ---- Agent-Machine (Board + Channels) proxy → coordinator ----
const amOn = () => !!AM_URL
async function amFetch(p: string, init?: { method?: string; body?: string }) {
  const headers: Record<string, string> = {}
  if (AM_TOKEN) headers['x-worker-token'] = AM_TOKEN
  if (init?.body) headers['content-type'] = 'application/json'
  return fetch(AM_URL + p, { method: init?.method || 'GET', headers, body: init?.body })
}
app.get('/api/am/state', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, cards: [], channels: [] })
  try { const r = await amFetch('/state'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, cards: [], channels: [], error: String(e).slice(0, 120) }) }
})
app.get('/api/am/config', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false })
  try { const r = await amFetch('/config'); res.json({ configured: true, ...(await r.json()) }) }
  catch { res.json({ configured: true, offline: true }) }
})
for (const [route, fwd] of [['/api/am/config', '/config'], ['/api/am/card', '/card'], ['/api/am/card/remove', '/card/remove'], ['/api/am/card/activate', '/card/activate'], ['/api/am/approve', '/approve'], ['/api/am/reject', '/reject'], ['/api/am/answer', '/answer'], ['/api/am/project', '/project'], ['/api/am/project/remove', '/project/remove'], ['/api/am/project/trash', '/project/trash'], ['/api/am/project/restore', '/project/restore'], ['/api/am/project/purge', '/project/purge'], ['/api/am/project/channel', '/project/channel'], ['/api/am/channel/post', '/channel/post'], ['/api/am/lucy/log', '/lucy/log'], ['/api/am/pipeline', '/pipeline'], ['/api/am/pipeline/remove', '/pipeline/remove']] as const) {
  app.post(route, async (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'unauth' })
    if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
    try { const r = await amFetch(fwd, { method: 'POST', body: JSON.stringify(req.body || {}) }); res.status(r.status).json(await r.json()) }
    catch (e) { res.status(502).json({ error: 'coordinator offline: ' + String(e).slice(0, 120) }) }
  })
}

// ---- BỘ NÃO (M1: recall + vault + dream) proxy → coordinator ----
// GET có query (recall/file/recent) → forward nguyên query sang coordinator.
for (const [route, fwd] of [['/api/brain/state', '/brain/state'], ['/api/brain/graph', '/brain/graph'], ['/api/brain/recall', '/recall'], ['/api/brain/recent', '/brain/recent'], ['/api/brain/file', '/brain/file'], ['/api/llm/models', '/llm/models']] as const) {
  app.get(route, async (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'unauth' })
    if (!amOn()) return res.json({ configured: false })
    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : ''
    try { const r = await amFetch(fwd + qs); res.status(r.status).json(await r.json()) }
    catch (e) { res.json({ configured: true, offline: true, error: String(e).slice(0, 120) }) }
  })
}
for (const [route, fwd] of [['/api/brain/reindex', '/brain/reindex'], ['/api/brain/dream', '/brain/dream'], ['/api/brain/evidence', '/brain/evidence'], ['/api/brain/pin', '/brain/pin']] as const) {
  app.post(route, async (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'unauth' })
    if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
    try { const r = await amFetch(fwd, { method: 'POST', body: JSON.stringify(req.body || {}) }); res.status(r.status).json(await r.json()) }
    catch (e) { res.status(502).json({ error: 'coordinator offline: ' + String(e).slice(0, 120) }) }
  })
}

// serve React build (đặt CUỐI để /api ưu tiên)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.listen(PORT, HOST, () => {
  if (!PASSWORD) console.log('⚠️  CHƯA đặt LUCY_HUB_PASSWORD — không đăng nhập được. Đặt env!')
  console.log(`Lucy Hub: http://${HOST}:${PORT}`)
})
