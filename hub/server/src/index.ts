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
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'  // Đường B: chat stream in-process (thay spawn cho streamClaude)
// CỤM B (Prompt Architect): gọi TRỰC TIẾP bộ não lõi cụm A (agent-machine, chạy in-process qua tsx).
// ADDITIVE + FLAG-GATED (LUCY_PROMPT_ARCHITECT). Import tĩnh OK vì hub server chạy bằng tsx (ESM/CJS interop).
import {
  runPromptArchitect, escalatePromptArchitect, recordUserEdit,
  promptArchitectFlagOn, sanitizeChatHistory,
} from '../../../agent-machine/src/prompt-architect'
import { getPromptArchitectStore } from '../../../agent-machine/src/prompt-architect-store'
import { z } from 'zod'  // K2: consult_expert schema
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

// Phase J — CHAT ĐA-PHIÊN: nhiều hội thoại lưu riêng (chats/<id>.json), `chat` = hội thoại HIỆN TẠI.
// Backward-compat: tự migrate chat.json cũ thành hội thoại đầu. `chat.messages`/`chat.sessionId`/saveChat() giữ nguyên API.
type ChatMsg = { role: 'me' | 'lucy'; text: string; t: number }
type Conversation = { id: string; title: string; sessionId: string | null; messages: ChatMsg[]; createdAt: number; updatedAt: number }
const CHATS_DIR = path.join(STATE, 'chats'); fs.mkdirSync(CHATS_DIR, { recursive: true })
const CUR_FILE = path.join(STATE, 'chats-current.json')
const convFile = (id: string) => path.join(CHATS_DIR, id.replace(/[^A-Za-z0-9_-]/g, '') + '.json')
const newConvId = () => randomBytes(6).toString('base64url')
const deriveTitle = (msgs: ChatMsg[]): string => {
  const first = msgs.find((m) => m.role === 'me')
  return first ? first.text.replace(/\s+/g, ' ').trim().slice(0, 48) : 'Hội thoại mới'
}
function listConversations(): { id: string; title: string; updatedAt: number; count: number }[] {
  try {
    return fs.readdirSync(CHATS_DIR).filter((f) => f.endsWith('.json'))
      .map((f) => readJSON<Conversation | null>(path.join(CHATS_DIR, f), null)).filter((c): c is Conversation => !!c?.id)
      .map((c) => ({ id: c.id, title: c.title || '(chưa đặt tên)', updatedAt: c.updatedAt || 0, count: c.messages?.length || 0 }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch { return [] }
}
function loadConv(id: string): Conversation | null { return readJSON<Conversation | null>(convFile(id), null) }
function freshConv(): Conversation { return { id: newConvId(), title: 'Hội thoại mới', sessionId: null, messages: [], createdAt: Date.now(), updatedAt: Date.now() } }
let chat: Conversation = (() => {
  // migrate chat.json cũ → hội thoại đầu (1 lần)
  if (!listConversations().length) {
    const legacy = readJSON<{ sessionId: string | null; messages: ChatMsg[] } | null>(CHAT_FILE, null)
    if (legacy?.messages?.length) {
      const c: Conversation = { id: newConvId(), title: deriveTitle(legacy.messages), sessionId: legacy.sessionId, messages: legacy.messages, createdAt: Date.now(), updatedAt: Date.now() }
      writeJSON(convFile(c.id), c)
    }
  }
  const curId = readJSON<{ id?: string }>(CUR_FILE, {}).id
  if (curId) { const c = loadConv(curId); if (c) return c }
  const list = listConversations()
  if (list.length) { const c = loadConv(list[0].id); if (c) return c }
  const c = freshConv(); writeJSON(convFile(c.id), c); return c
})()
const setCurrent = (c: Conversation) => { chat = c; writeJSON(CUR_FILE, { id: c.id }) }
const saveChat = () => {
  if (chat.messages.length > 400) chat.messages = chat.messages.slice(-400)
  chat.updatedAt = Date.now()
  if ((!chat.title || chat.title === 'Hội thoại mới') && chat.messages.length) chat.title = deriveTitle(chat.messages)
  writeJSON(convFile(chat.id), chat)
}

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

// Phase D (D1+D3): claude -p stream-json → gọi onEvent khi có chữ/thinking/tool. Trả {sid, text, thinking}.
type StreamEvt = { type: 'delta' | 'thinking' | 'tool_use' | 'tool_result' | 'usage'; text?: string; name?: string; input?: string; id?: string; inTok?: number; cacheTok?: number; outTok?: number }
// gọn nội dung tool_result (string | mảng block) thành text ngắn để hiện UI
function toolResultText(content: any): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((b) => (typeof b === 'string' ? b : b?.text ?? '')).join('\n')
  return ''
}
// Đường B (Claude Agent SDK): query() in-process thay spawn. Cùng shape message (stream_event/assistant/user/result)
// → giữ y logic emit event. Dùng auth subscription như CLI. abort sau TIMEOUT.
async function streamClaude(prompt: string, sessionId: string | null, model: string,
                            onEvent: (e: StreamEvt) => void): Promise<{ sid: string | null; text: string; thinking: string }> {
  let answer = '', thinking = '', sid: string | null = null, finalResult: string | null = null
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT)
  const appendSys = fs.existsSync(PERSONA) ? fs.readFileSync(PERSONA, 'utf8') : undefined
  const dirs = fs.existsSync(VAULT) ? [VAULT] : undefined
  try {
    const q = query({
      prompt,
      options: {
        model, permissionMode: 'bypassPermissions', cwd: WORKDIR, includePartialMessages: true,
        ...(appendSys ? { appendSystemPrompt: appendSys } : {}),
        ...(dirs ? { additionalDirectories: dirs } : {}),
        ...(sessionId ? { resume: sessionId } : {}),
        env: { ...process.env, IS_SANDBOX: '1' },
        abortController: ac,
        mcpServers: { 'lucy-experts': expertMcpServer },  // K2 consult_expert inline (#3 minh bạch)
      },
    } as any)
    for await (const m of q as any) {
      if (m.type === 'stream_event' && m.event?.type === 'content_block_delta') {
        const dl = m.event.delta || {}
        if (dl.type === 'text_delta' && dl.text) { answer += dl.text; onEvent({ type: 'delta', text: dl.text }) }
        else if (dl.type === 'thinking_delta' && dl.thinking) { thinking += dl.thinking; onEvent({ type: 'thinking', text: dl.thinking }) }
      } else if (m.type === 'assistant') {
        for (const b of m.message?.content || []) {
          if (b?.type === 'tool_use') onEvent({ type: 'tool_use', name: b.name, input: JSON.stringify(b.input ?? {}).slice(0, 600), id: b.id })
        }
      } else if (m.type === 'user') {
        for (const b of m.message?.content || []) {
          if (b?.type === 'tool_result') onEvent({ type: 'tool_result', id: b.tool_use_id, text: toolResultText(b.content).slice(0, 800) })
        }
      } else if (m.type === 'result') {
        sid = m.session_id || sid; finalResult = m.result ?? null
        // E3: đo prompt-cache + context dùng — cho Hub HIỆN badge "cache X% · ctx Ytok"
        const u = m.usage || {}
        const inTok = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
        onEvent({ type: 'usage', inTok, cacheTok: u.cache_read_input_tokens ?? 0, outTok: u.output_tokens ?? 0 })
        // DASH-FIX S2: tách input "tươi" + cache read/write riêng, kèm source='hub' + model thật (parity bridge claude-path).
        reportTok(u.input_tokens ?? 0, u.output_tokens ?? 0, { source: 'hub', model, cacheReadTok: u.cache_read_input_tokens ?? 0, cacheWriteTok: u.cache_creation_input_tokens ?? 0 })
      }
      else if (m.type === 'system' && m.session_id && !sid) sid = m.session_id
    }
  } catch (e) {
    clearTimeout(timer)
    return { sid, text: answer || `❌ SDK lỗi: ${String((e as any)?.message || e).slice(0, 300)}`, thinking }
  }
  clearTimeout(timer)
  return { sid, text: finalResult ?? answer ?? '(rỗng)', thinking }
}

const app = express()
// Chặn path-traversal probe (%c0%af...): decodeURIComponent throw URIError trong serve-static → sập process.
// Bắt sớm URL không decode được → 400, khỏi rơi vào static handler.
app.use((req, res, next) => {
  try { decodeURIComponent(req.path) } catch { return res.status(400).send('bad request') }
  next()
})
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
  res.json({ messages: chat.messages.slice(-200), id: chat.id, title: chat.title })
})
app.post('/api/chat/new', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const c = freshConv(); writeJSON(convFile(c.id), c); setCurrent(c); logEvent('info', 'chat', 'hội thoại mới')
  res.json({ ok: true, id: c.id })
})
// Phase J: quản nhiều hội thoại
app.get('/api/chats', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ chats: listConversations(), currentId: chat.id })
})
app.post('/api/chats/switch', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const c = loadConv(String(req.body?.id || '')); if (!c) return res.status(404).json({ error: 'nochat' })
  setCurrent(c); res.json({ ok: true, id: c.id, messages: c.messages.slice(-200), title: c.title })
})
app.post('/api/chats/rename', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const id = String(req.body?.id || ''); const title = String(req.body?.title || '').trim().slice(0, 80)
  const c = loadConv(id); if (!c || !title) return res.status(400).json({ error: 'bad' })
  c.title = title; c.updatedAt = Date.now(); writeJSON(convFile(c.id), c)
  if (chat.id === c.id) chat.title = title
  res.json({ ok: true })
})
app.post('/api/chats/delete', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const id = String(req.body?.id || '')
  try { fs.unlinkSync(convFile(id)) } catch { /* đã mất */ }
  if (chat.id === id) { // xoá hội thoại đang mở → chuyển sang mới nhất / tạo mới
    const list = listConversations()
    const next = list.length ? loadConv(list[0].id) : null
    setCurrent(next || (() => { const c = freshConv(); writeJSON(convFile(c.id), c); return c })())
  }
  res.json({ ok: true, currentId: chat.id })
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
// B1 — token consolidation: cộng token tiêu của MỌI đường hub (claude-path + lane + prompt-architect)
// vào token-guard CHUNG (NGUỒN DUY NHẤT ở coordinator). Fire-and-forget — không chặn response, lỗi → bỏ qua.
// Tắt = LUCY_TOKEN_REPORT=0. Coordinator lane KHÔNG tự cộng → đây là chỗ DUY NHẤT cộng lane của hub (hết double-count).
const TOKEN_REPORT = !['0', 'false', 'off'].includes(String(process.env.LUCY_TOKEN_REPORT ?? '1').trim().toLowerCase())
// DASH-FIX S2: gửi /spend đủ trường (source+model+cache tách). inTok = input "tươi" (KHÔNG gộp cache); cache tách cacheRead/cacheWrite.
function reportTok(inTok?: number, outTok?: number, opts?: { source?: string; model?: string; cacheReadTok?: number; cacheWriteTok?: number }) {
  if (!TOKEN_REPORT || !amOn()) return
  const i = Math.max(0, Number(inTok) || 0)
  const o = Math.max(0, Number(outTok) || 0)
  const cr = Math.max(0, Number(opts?.cacheReadTok) || 0)
  const cw = Math.max(0, Number(opts?.cacheWriteTok) || 0)
  if (i <= 0 && o <= 0 && cr <= 0 && cw <= 0) return
  amFetch('/spend', { method: 'POST', body: JSON.stringify({ source: opts?.source || 'hub', model: opts?.model || 'unknown', inTok: i, outTok: o, cacheReadTok: cr, cacheWriteTok: cw }) }).catch(() => {})
}
// PHASE 0: prefetch recall — tra memory vault (coordinator POST /recall) trước khi gọi claude.
// Trả khối '🧠 Trí nhớ liên quan' (cap 5 hit / ~800 ký tự) để prepend vào prompt. Tắt = LUCY_RECALL_PREFETCH=0.
const RECALL_PREFETCH = !['0', 'false', 'off', ''].includes(String(process.env.LUCY_RECALL_PREFETCH ?? '1').trim().toLowerCase())
async function recallPrefetch(text: string): Promise<string> {
  if (!RECALL_PREFETCH || !amOn() || !text.trim()) return ''
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 4000)
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (AM_TOKEN) headers['x-worker-token'] = AM_TOKEN
    const r = await fetch(AM_URL + '/recall', { method: 'POST', headers, body: JSON.stringify({ q: text.slice(0, 500), limit: 5 }), signal: ctl.signal })
    clearTimeout(t)
    const hits = ((await r.json()) as any)?.hits || []
    let budget = 800
    const lines: string[] = []
    for (const h of hits.slice(0, 5)) {
      const title = String(h.title || h.file_path || '').trim()
      const snip = String(h.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      const item = snip ? `- ${title}: ${snip}` : `- ${title}`
      if (budget - item.length < 0) break
      budget -= item.length
      lines.push(item)
    }
    if (!lines.length) return ''
    return '🧠 Trí nhớ liên quan (tra tự động từ vault — dùng nếu hữu ích, bỏ qua nếu lạc đề):\n' + lines.join('\n') + '\n\n'
  } catch { return '' }
}
// PHASE 2: episodic — ghi turn hội thoại Hub vào memory.db (coordinator POST /episodic), fire-and-forget.
// Tắt = LUCY_EPISODIC=0. Lỗi/coordinator off → bỏ qua (không chặn chat).
const EPISODIC = !['0', 'false', 'off', ''].includes(String(process.env.LUCY_EPISODIC ?? '1').trim().toLowerCase())
function episodicLog(role: string, content: string, sessionId?: string | null) {
  if (!EPISODIC || !amOn() || !content || !content.trim()) return
  const safe = scrubSecrets(content)   // BẢO MẬT: giấu key/token trước khi lưu turn
  amFetch('/episodic', { method: 'POST', body: JSON.stringify({ source: 'hub', chat_id: 'hub', role, content: safe.slice(0, 8000), session_id: sessionId || '' }) }).catch(() => { /* fire-and-forget */ })
}
// BẢO MẬT: scrub secret khỏi text trước khi ghi episodic turn (mirror redact.ts/scrub_secrets bridge).
const SECRET_RULES: { re: RegExp; repl: string }[] = [
  { re: /\bBearer\s+[A-Za-z0-9._\-]{8,}/gi, repl: 'Bearer [REDACTED]' },
  { re: /\b(?:sk|rk|pk)-[A-Za-z0-9_\-]{16,}/g, repl: '[REDACTED]' },
  { re: /\bjina_[A-Za-z0-9]{16,}/g, repl: '[REDACTED]' },
  { re: /\b(?:ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}/g, repl: '[REDACTED]' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, repl: '[REDACTED]' },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, repl: '[REDACTED]' },
  { re: /\b([A-Za-z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|ACCESS[_-]?KEY))\s*[=:]\s*\S+/gi, repl: '$1=[REDACTED]' },
]
function scrubSecrets(text: string): string {
  if (!text) return text
  let s = text
  for (const { re, repl } of SECRET_RULES) s = s.replace(re, repl)
  s = s.replace(/[A-Za-z0-9+/_\-]{40,}={0,2}/g, (m) => {
    const hasB64 = /[+/=]/.test(m), hasUpper = /[A-Z]/.test(m), hasLower = /[a-z]/.test(m), hasDigit = /[0-9]/.test(m)
    return hasB64 || (hasUpper && hasLower && hasDigit) ? '[REDACTED]' : m
  })
  return s
}
// K2 consult_expert MCP server in-process cho claude-path (#3 minh bạch: tool_use event hiện card UI).
// Handler gọi coordinator /consult-expert khi Claude chọn dùng tool này.
const expertMcpServer = createSdkMcpServer({
  name: 'lucy-experts',
  alwaysLoad: true,
  instructions: 'Gọi consult_expert khi cần góc chuyên sâu từ expert persona (finance·marketing·researcher·designer·data·architect·engineer·security·investigator·devops·tester·writer).',
  tools: [{
    name: 'consult_expert',
    description: 'Hỏi 1 EXPERT chuyên lĩnh vực rồi dệt góc nhìn đó vào câu trả lời. Dùng khi cần chuyên sâu ngoài thế mạnh của mình.',
    inputSchema: {
      persona: z.string().describe('id expert: finance(tài chính) | marketing | researcher | designer(UI/UX) | data | architect | engineer | security(audit) | investigator(root-cause/debug) | devops(deploy/CI) | tester(QA) | writer(docs)'),
      question: z.string().describe('câu hỏi/yêu cầu cụ thể cho expert'),
    },
    handler: async ({ persona, question }: { persona: string; question: string }) => {
      try {
        if (!AM_URL) return { content: [{ type: 'text' as const, text: 'coordinator chưa cấu hình (AM_COORD_URL) — consult không khả dụng' }] }
        const r = await amFetch('/consult-expert', { method: 'POST', body: JSON.stringify({ persona, question }) })
        const d = await r.json() as any
        return { content: [{ type: 'text' as const, text: d.answer || d.error || '(rỗng)' }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: 'consult lỗi: ' + String(e).slice(0, 200) }], isError: true }
      }
    },
  }],
} as any)

app.get('/api/metrics', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, tokenDay: 0, tokenMonth: 0, costDay: 0, costMonth: 0, costByModel: [], costByAgent: [], costByCard: [], cardsRunning: 0, cardsWaiting: 0, cardsTotal: 0, providers: [], alerts: [] })
  try { const r = await amFetch('/metrics'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, tokenDay: 0, tokenMonth: 0, costDay: 0, costMonth: 0, costByModel: [], costByAgent: [], costByCard: [], cardsRunning: 0, cardsWaiting: 0, cardsTotal: 0, providers: [], alerts: [], error: String(e).slice(0, 120) }) }
})
app.get('/api/error-stats', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, total: 0, byCategory: [], byAgent: [], byModel: [], topCategory: null, scope: '' })
  try { const r = await amFetch('/error-stats'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, total: 0, byCategory: [], byAgent: [], byModel: [], topCategory: null, scope: '', error: String(e).slice(0, 120) }) }
})
app.get('/api/am/state', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, cards: [], channels: [] })
  try { const r = await amFetch('/state'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, cards: [], channels: [], error: String(e).slice(0, 120) }) }
})
// Phase D (D2/D4): catalog model + trạng thái rate-guard/quota → cho composer picker + Dashboard panel.
app.get('/api/llm/models', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, catalog: [], providers: [], routeTable: {}, router: '' })
  try { const r = await amFetch('/llm/models'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, catalog: [], providers: [], routeTable: {}, router: '', error: String(e).slice(0, 120) }) }
})
app.get('/api/llm/guard', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, guarded: [], quota: {} })
  try { const r = await amFetch('/llm/guard'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, guarded: [], quota: {}, error: String(e).slice(0, 120) }) }
})
// BH-D meta-learning: gửi feedback 👍/👎 cho model → routing tự học; xem bảng outcome đã học.
app.post('/api/llm/feedback', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ ok: false, error: 'coordinator chưa cấu hình' })
  try { const r = await amFetch('/llm/feedback', { method: 'POST', body: JSON.stringify(req.body || {}) }); res.json(await r.json()) }
  catch (e) { res.json({ ok: false, error: String(e).slice(0, 120) }) }
})
app.get('/api/llm/outcomes', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, stats: [], total: 0 })
  try { const r = await amFetch('/llm/outcomes'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, stats: [], total: 0, error: String(e).slice(0, 120) }) }
})
// K4 persona registry: CRUD expert qua Hub (proxy → coordinator /personas)
app.get('/api/personas', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, personas: [] })
  try { const r = await amFetch('/personas'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, personas: [], error: String(e).slice(0, 120) }) }
})
app.post('/api/personas', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
  try { const r = await amFetch('/personas', { method: 'POST', body: JSON.stringify(req.body || {}) }); res.status(r.status).json(await r.json()) }
  catch (e) { res.status(502).json({ error: String(e).slice(0, 120) }) }
})
app.delete('/api/personas/:id', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
  try { const r = await amFetch('/personas?id=' + encodeURIComponent(req.params.id), { method: 'DELETE' }); res.status(r.status).json(await r.json()) }
  catch (e) { res.status(502).json({ error: String(e).slice(0, 120) }) }
})

// M3.5 persona chat đa lượt + auto-routing (proxy → coordinator). Flag LUCY_PERSONA_CHAT ở coordinator.
app.post('/api/persona/chat', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
  try { const r = await amFetch('/persona-chat', { method: 'POST', body: JSON.stringify(req.body || {}) }); res.status(r.status).json(await r.json()) }
  catch (e) { res.status(502).json({ error: String(e).slice(0, 120) }) }
})
app.post('/api/persona/route', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
  try { const r = await amFetch('/persona-route', { method: 'POST', body: JSON.stringify(req.body || {}) }); res.status(r.status).json(await r.json()) }
  catch (e) { res.status(502).json({ error: String(e).slice(0, 120) }) }
})

// T5 MCP "Kết nối": trạng thái server MCP (proxy → coordinator /mcp)
app.get('/api/mcp', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, masterOn: false, servers: [] })
  try { const r = await amFetch('/mcp'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, masterOn: false, servers: [], error: String(e).slice(0, 120) }) }
})

// T6 Skill "Kỹ năng": active (INDEX) + proposed (_proposed, M3.3) (proxy → coordinator /skills)
app.get('/api/skills', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!amOn()) return res.json({ configured: false, learnOn: false, active: [], proposed: [] })
  try { const r = await amFetch('/skills'); res.json({ configured: true, ...(await r.json()) }) }
  catch (e) { res.json({ configured: true, offline: true, learnOn: false, active: [], proposed: [], error: String(e).slice(0, 120) }) }
})

// Phase D (D1+D2+D3): chat STREAMING qua SSE. model = claude:sonnet|claude:opus | auto | <lane-key>.
// claude → stream-json (chữ chạy thật). lane → coordinator /chat-lane (nhanh, trả 1 cục). auto → /route rồi dispatch.
const LANE_KEYS = new Set<string>()
const TOOL_LANE_KEYS = new Set<string>()   // M4: lane model hỗ trợ tool-calling → đi đường agentic (có web/file/bash)
// L2 (Hermes parity): lane model STATELESS → tự gửi persona (system) + LỊCH SỬ hội thoại để nối mạch + giữ persona.
// L3: compressor — token-aware sliding window thay cap cứng 24 msg.
const LANE_CTX_TOKENS = 5000   // ngân sách tối ước token
const LANE_VERBATIM_MIN = 6    // tối thiểu N tin gần nhất giữ nguyên
function estimateTok(text: string): number { return Math.ceil((text || '').length / 4) }
function buildLaneMessages(): { role: string; content: string }[] {
  const sys = fs.existsSync(PERSONA) ? fs.readFileSync(PERSONA, 'utf8') : ''
   const all = chat.messages
  if (!all.length) return sys ? [{ role: 'system', content: sys }] : []
  let budget = LANE_CTX_TOKENS
  let start = all.length
  for (let i = all.length - 1; i >= 0; i--) {
    const tok = estimateTok(all[i].text)
    if (budget - tok < 0 && all.length - start >= LANE_VERBATIM_MIN) break
    budget -= tok
    start = i
  }
  const verbatim = all.slice(start).map((m) => ({ role: m.role === 'lucy' ? 'assistant' : 'user', content: m.text }))
  const older = all.slice(0, start)
  let sysContent = sys
  if (older.length > 0) {
    const lines = older.map((m) => `• [${m.role === 'me' ? 'Chủ nhân' : 'Lucy'}] ${m.text.trim().slice(0, 180)}`).join('\n')
    sysContent += `\n\n--- Hội thoại trước (${older.length} tin, tóm gọn) ---\n${lines}\n---`
  }
  return sysContent ? [{ role: 'system', content: sysContent }, ...verbatim] : verbatim
}
app.post('/api/chat/stream', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const prompt = String(req.body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'empty' })
  let model = String(req.body?.model || 'claude:sonnet').trim()
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
  const sse = (ev: Record<string, unknown>) => { try { res.write(`data: ${JSON.stringify(ev)}\n\n`) } catch { /* client ngắt */ } }
  let closed = false
  res.on('close', () => { closed = true }) // res (KHÔNG phải req — req 'close' fire ngay sau khi đọc body → chặn nhầm delta)
  // refresh danh sách lane key (1 lần / khi rỗng) để phân biệt lane vs claude
  if (!LANE_KEYS.size && amOn()) {
    try {
      const d = await (await amFetch('/llm/models')).json() as any
      for (const m of d.catalog || []) LANE_KEYS.add(m.key)
      // M4: model tool-capable = role dùng tool (tool-calling/agentic-code/reasoning/long-context). content/fast-classify → chat thuần.
      const rt = d.routeTable || {}
      for (const role of ['tool-calling', 'agentic-code', 'reasoning', 'long-context']) for (const k of (rt[role] || [])) TOOL_LANE_KEYS.add(k)
    } catch { /* */ }
  }
  // đăng ký job nhẹ để chat hiện ở tab Tasks (stream cũng là 1 task đang chạy)
  const jobId = randomBytes(8).toString('base64url')
  jobs.set(jobId, { status: 'running', result: null, model, t0: Date.now(), session_id: chat.sessionId, prompt: prompt.slice(0, 120) })
  const finishJob = (result: string, sid?: string | null) => { const j = jobs.get(jobId); if (j) { j.status = 'done'; j.result = result; j.model = model; if (sid) j.session_id = sid } }
  try {
    chat.messages.push({ role: 'me', text: prompt, t: Date.now() }); saveChat()
    episodicLog('user', prompt, chat.sessionId)   // PHASE 2: ghi turn người dùng (async)
    // AUTO: router quyết role/model/needsTools
    if (model === 'auto') {
      // D7: phiên ĐÃ CÓ context (sessionId) → KHÔNG hạ xuống lane rẻ (lane stateless, mất persona+lịch sử → hỏng mạch).
      // Chỉ route lane cho câu MỚI/độc lập (chưa có session). Giữ mạch phiên trên claude (có --resume).
      if (chat.sessionId) { sse({ type: 'route', text: '🧭 auto → claude (giữ mạch phiên đang có)' }); model = 'claude:sonnet' }
      else if (!amOn()) { model = 'claude:sonnet' }
      else {
        try {
          const dec = await (await amFetch('/route', { method: 'POST', body: JSON.stringify({ brief: prompt }) })).json() as any
          if (dec?.error || dec?.needsTools) { sse({ type: 'route', text: `🧭 auto → claude (cần tool): ${dec?.reason || ''}` }); model = 'claude:sonnet' }
          else { sse({ type: 'route', text: `🧭 auto → ${dec.modelKey} (${dec.role}): ${dec.reason || ''}` }); model = dec.modelKey }
        } catch { model = 'claude:sonnet' }
      }
    }
    // LANE: model free/rẻ qua coordinator. L2 = persona+history. M = tool-capable → AGENTIC (web/file/bash), else chat thuần.
    if (model.startsWith('claude') === false && LANE_KEYS.has(model)) {
      if (!amOn()) { sse({ type: 'error', text: 'coordinator chưa cấu hình' }); return res.end() }
      try {
        if (TOOL_LANE_KEYS.has(model)) {
          // M: lane agentic — model rẻ tự web_search/web_fetch/read/bash. Trả {answer, trace, usage}.
          const r = await (await amFetch('/chat-lane-agentic', { method: 'POST', body: JSON.stringify({ model, messages: buildLaneMessages() }) })).json() as any
          if (r?.error) { sse({ type: 'error', text: r.error }); finishJob('❌ ' + r.error) }
          else {
            // #3 minh bạch: hiện tool-card (gửi gì / nhận gì) — khớp UI Section A theo id.
            (r.trace || []).forEach((t: any, i: number) => {
              sse({ type: 'tool_use', name: t.name, input: t.input, id: 'lt' + i })
              sse({ type: 'tool_result', id: 'lt' + i, text: t.result })
            })
            if (r.usage) { sse({ type: 'usage', inTok: r.usage.inTok, cacheTok: 0, outTok: r.usage.outTok }); reportTok(r.usage.inTok, r.usage.outTok, { source: 'lane', model }) }   // DASH-FIX S2: lane agentic → /spend (source=lane, model thật)
            sse({ type: 'delta', text: r.answer || '(rỗng)' })
            chat.messages.push({ role: 'lucy', text: r.answer || '(rỗng)', t: Date.now() }); saveChat()
            episodicLog('assistant', r.answer || '', chat.sessionId)
            finishJob(r.answer || '(rỗng)')
          }
        } else {
          const r = await (await amFetch('/chat-lane', { method: 'POST', body: JSON.stringify({ model, messages: buildLaneMessages() }) })).json() as any
          if (r?.error) { sse({ type: 'error', text: r.error }); finishJob('❌ ' + r.error) }
          else {
            if (r.thinking) sse({ type: 'thinking', text: String(r.thinking).slice(0, 2000) })
            if (r.usage) { sse({ type: 'usage', inTok: r.usage.inTok, cacheTok: 0, outTok: r.usage.outTok }); reportTok(r.usage.inTok, r.usage.outTok, { source: 'lane', model }) }   // DASH-FIX S2: lane chat → /spend (source=lane, model thật)
            sse({ type: 'delta', text: r.answer || '(rỗng)' })
            chat.messages.push({ role: 'lucy', text: r.answer || '(rỗng)', t: Date.now() }); saveChat()
            episodicLog('assistant', r.answer || '', chat.sessionId)
            finishJob(r.answer || '(rỗng)')
          }
        }
      } catch (e) { sse({ type: 'error', text: 'lane lỗi: ' + String(e).slice(0, 120) }); finishJob('❌ lane lỗi') }
      sse({ type: 'done', model }); return res.end()
    }
    // CLAUDE: stream-json (chữ chạy thật) — dùng subscription, giữ session chat.
    const cm = model === 'claude:opus' ? 'opus' : 'sonnet'
    // PHASE 0: chèn khối memory liên quan vào đầu prompt (lỗi/tắt flag → '' → prompt nguyên gốc).
    const cprompt = (await recallPrefetch(prompt)) + prompt
    let out = await streamClaude(cprompt, chat.sessionId, cm, (e) => { if (!closed) sse(e) })
    // resume hỏng (session cũ/khác process → claude trả rỗng) → chạy lại KHÔNG resume (như bridge ClaudeRunner)
    if (chat.sessionId && !out.sid && (!out.text || out.text === '(rỗng)')) {
      out = await streamClaude(cprompt, null, cm, (e) => { if (!closed) sse(e) })
    }
    chat.sessionId = out.sid || chat.sessionId
    chat.messages.push({ role: 'lucy', text: out.text, t: Date.now() }); saveChat()
    episodicLog('assistant', out.text, chat.sessionId)   // PHASE 2: ghi trả lời claude
    finishJob(out.text, out.sid)
    sse({ type: 'final', text: out.text, model: cm })
    sse({ type: 'done', model: cm })
  } catch (e) { sse({ type: 'error', text: String(e).slice(0, 200) }); finishJob('❌ ' + String(e).slice(0, 200)) }
  res.end()
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
for (const [route, fwd] of [['/api/brain/reindex', '/brain/reindex'], ['/api/brain/dream', '/brain/dream'], ['/api/brain/evidence', '/brain/evidence'], ['/api/brain/pin', '/brain/pin'], ['/api/llm/catalog-refresh', '/llm/catalog-refresh']] as const) {
  app.post(route, async (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'unauth' })
    if (!amOn()) return res.status(400).json({ error: 'Agent-Machine chưa cấu hình (AM_COORD_URL)' })
    try { const r = await amFetch(fwd, { method: 'POST', body: JSON.stringify(req.body || {}) }); res.status(r.status).json(await r.json()) }
    catch (e) { res.status(502).json({ error: 'coordinator offline: ' + String(e).slice(0, 120) }) }
  })
}

// ---- PROMPT ARCHITECT (CỤM B, task 3) — flag LUCY_PROMPT_ARCHITECT, MẶC ĐỊNH TẮT ----
// Bộ não lõi ở agent-machine (cụm A). Hub chỉ: wire flag + stream SSE + đọc store.recent() + nút escalate.
// KHÔNG EXECUTE: core dùng callLLM thuần (no tool). Tab UI chỉ hiện khi /api/prompts/status → enabled.
const PA_CHAT_ID = 'hub-prompts'   // 1 luồng lịch sử riêng cho tab Prompts ở Hub (tách khỏi chat tổng)

app.get('/api/prompts/status', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json({ enabled: promptArchitectFlagOn() })
})

// Lịch sử phiên (store.recent) — đọc trực tiếp sidecar DB cụm A. limit cap ở store (≤50).
app.get('/api/prompts/history', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!promptArchitectFlagOn()) return res.json({ enabled: false, sessions: [] })
  try {
    const store = getPromptArchitectStore(VAULT)
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    const sessions = store ? store.recent({ chatId: PA_CHAT_ID, limit }) : []
    res.json({ enabled: true, sessions })
  } catch (e) { res.json({ enabled: true, sessions: [], error: String(e).slice(0, 120) }) }
})

// Chạy 1 lượt (model RẺ ds-chat). Trả SSE giống chat: delta(answer) → final → done. Core không stream từng chữ
// (callLLM trả 1 cục) → emit 1 delta. Kèm meta (clarifying/finalPrompt/sessionId) trong sự kiện final.
app.post('/api/prompts/run', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!promptArchitectFlagOn()) return res.status(403).json({ error: 'Prompt Architect đang TẮT (đặt LUCY_PROMPT_ARCHITECT=1).' })
  const context = String(req.body?.context || '').trim()
  if (!context) return res.status(400).json({ error: 'empty' })
  const targetModel = String(req.body?.targetModel || '').trim() || undefined
  const variants = Number.isFinite(Number(req.body?.variants)) ? Number(req.body.variants) : undefined  // CỤM C: ≥2 → xuất đa biến thể
  const history = sanitizeChatHistory(req.body?.history)
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
  const sse = (ev: Record<string, unknown>) => { try { res.write(`data: ${JSON.stringify(ev)}\n\n`) } catch { /* client ngắt */ } }
  try {
    const r = await runPromptArchitect(context, { history, targetModel, variants, source: 'hub', chatId: PA_CHAT_ID, vaultDir: VAULT })
    if (r.usage) reportTok(r.usage.inTok, r.usage.outTok, { source: 'lane', model: r.laneModel || 'unknown' })   // DASH-FIX S2: prompt-architect lane → /spend (source=lane, model thật)
    if (r.rateLimit) sse({ type: 'route', text: `⏸️ rate-limit (~${Math.round(r.rateLimit.retryAfterMs / 1000)}s)` })
    sse({ type: 'delta', text: r.answer })
    sse({ type: 'final', text: r.answer, clarifying: r.clarifying, finalPrompt: r.finalPrompt, sessionId: r.sessionId, laneModel: r.laneModel, escalated: r.escalated, scorecard: r.scorecard, variants: r.variants, preferenceApplied: r.preferenceApplied })
    sse({ type: 'done', model: r.laneModel })
    logEvent('info', 'prompt-architect', `▶ run ${r.laneModel}${r.clarifying ? ' (hỏi làm-rõ)' : ''}: ${context.slice(0, 60)}`)
  } catch (e) { sse({ type: 'error', text: String(e).slice(0, 200) }) }
  res.end()
})

// Escalate 1 phiên khó bằng Claude (model mạnh) — trả JSON (1 cục, qua SDK query 1-shot).
app.post('/api/prompts/escalate', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!promptArchitectFlagOn()) return res.status(403).json({ error: 'Prompt Architect đang TẮT (đặt LUCY_PROMPT_ARCHITECT=1).' })
  const context = String(req.body?.context || '').trim()
  if (!context) return res.status(400).json({ error: 'empty' })
  const targetModel = String(req.body?.targetModel || '').trim() || undefined
  const history = sanitizeChatHistory(req.body?.history)
  const sessionId = Number.isFinite(Number(req.body?.sessionId)) ? Number(req.body.sessionId) : undefined
  try {
    logEvent('info', 'prompt-architect', `⬆ escalate Claude: ${context.slice(0, 60)}`)
    const r = await escalatePromptArchitect(context, { history, targetModel, source: 'hub', chatId: PA_CHAT_ID, sessionId, vaultDir: VAULT })
    res.json({ answer: r.answer, clarifying: r.clarifying, finalPrompt: r.finalPrompt, sessionId: r.sessionId, laneModel: r.laneModel, escalated: r.escalated, scorecard: r.scorecard })
  } catch (e) { res.status(502).json({ error: String(e).slice(0, 200) }) }
})

// Ghi bản EDIT của chủ nhân lên 1 phiên (rewrite-then-edit).
app.post('/api/prompts/edit', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  if (!promptArchitectFlagOn()) return res.status(403).json({ error: 'Prompt Architect đang TẮT.' })
  const sessionId = Number(req.body?.sessionId)
  const edit = String(req.body?.edit || '')
  if (!Number.isFinite(sessionId) || !edit.trim()) return res.status(400).json({ error: 'cần sessionId + edit' })
  const ok = recordUserEdit(sessionId, edit, VAULT)
  res.json({ ok })
})

// ─── ATH-4: Auto-Task Hub API (read-only) ────────────────────────────────────
const AUTOTASK_PROJECTS_DIR = path.join(os.homedir(), 'lucy', 'tasks', 'projects')

function atCountDir(d: string): number {
  try { return fs.readdirSync(d).filter(f => f.endsWith('.md')).length } catch { return 0 }
}

function atParseFrontmatter(content: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const m = content.match(/^---\s*\n(.*?)\n---\s*\n/s)
  if (!m) return meta
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return meta
}

function atReadState(slug: string): Record<string, unknown> {
  try {
    const p = path.join(AUTOTASK_PROJECTS_DIR, slug, 'state.json')
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch { return {} }
}

function atLatestResearchDate(slug: string): string | null {
  try {
    const resDir = path.join(AUTOTASK_PROJECTS_DIR, slug, 'research')
    const dates = fs.readdirSync(resDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map(f => f.slice(0, 10))
      .sort()
    return dates.length ? dates[dates.length - 1] : null
  } catch { return null }
}

function atListProjects(): unknown[] {
  const list: unknown[] = []
  if (!fs.existsSync(AUTOTASK_PROJECTS_DIR)) return list
  for (const slug of fs.readdirSync(AUTOTASK_PROJECTS_DIR).sort()) {
    const projMd = path.join(AUTOTASK_PROJECTS_DIR, slug, 'project.md')
    if (!fs.existsSync(projMd)) continue
    const content = fs.readFileSync(projMd, 'utf-8')
    const fm = atParseFrontmatter(content)
    const state = atReadState(slug)
    const base = path.join(AUTOTASK_PROJECTS_DIR, slug)
    list.push({
      slug,
      title:               fm.title || slug,
      status:              fm.status || 'active',
      sprint_count:        (state.sprint_count as number) || 0,
      queued:              atCountDir(path.join(base, 'queue')),
      done:                atCountDir(path.join(base, 'done')),
      failed:              atCountDir(path.join(base, 'failed')),
      total_usd:           (state.total_usd as number) || 0,
      last_run:            (state.last_run as string) || null,
      latest_research_date: atLatestResearchDate(slug),
    })
  }
  return list
}

app.get('/api/autotask/projects', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  try {
    res.json({ projects: atListProjects() })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

app.get('/api/autotask/projects/:slug', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const slug = req.params.slug.replace(/[^a-z0-9_-]/gi, '')
  const base = path.join(AUTOTASK_PROJECTS_DIR, slug)
  if (!fs.existsSync(path.join(base, 'project.md'))) return res.status(404).json({ error: 'not found' })
  try {
    const projContent = fs.readFileSync(path.join(base, 'project.md'), 'utf-8')
    const fm  = atParseFrontmatter(projContent)
    const state = atReadState(slug)

    // Research history (date + excerpt 200 chars)
    const research: unknown[] = []
    const resDir = path.join(base, 'research')
    if (fs.existsSync(resDir)) {
      for (const f of fs.readdirSync(resDir).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().reverse().slice(0, 10)) {
        const txt = fs.readFileSync(path.join(resDir, f), 'utf-8')
        research.push({ date: f.slice(0, 10), excerpt: txt.slice(0, 200) })
      }
    }

    // Task lists (id + title from frontmatter)
    const readTaskList = (subdir: string) => {
      const d = path.join(base, subdir)
      if (!fs.existsSync(d)) return []
      return fs.readdirSync(d).filter(f => f.endsWith('.md')).map(f => {
        const c = fs.readFileSync(path.join(d, f), 'utf-8')
        const m = atParseFrontmatter(c)
        return { id: m.id || f.slice(0, -3), title: m.title || f.slice(0, -3) }
      })
    }

    // Sprint list (n, date from filename + first line summary)
    const sprints: unknown[] = []
    const spDir = path.join(base, 'sprints')
    if (fs.existsSync(spDir)) {
      for (const f of fs.readdirSync(spDir).filter(f => /^\d+\.md$/.test(f)).sort((a, b) => Number(b.slice(0, -3)) - Number(a.slice(0, -3)))) {
        const txt = fs.readFileSync(path.join(spDir, f), 'utf-8')
        const lines = txt.split('\n').filter(l => l.trim())
        const usdMatch = txt.match(/Est\. cost: \$([0-9.]+)/)
        sprints.push({
          n:       Number(f.slice(0, -3)),
          summary: lines.slice(0, 4).join(' | ').slice(0, 200),
          usd:     usdMatch ? parseFloat(usdMatch[1]) : 0,
        })
      }
    }

    res.json({
      project: { ...fm, slug },
      state,
      research,
      tasks: {
        queue:  readTaskList('queue'),
        doing:  readTaskList('doing'),
        done:   readTaskList('done'),
        failed: readTaskList('failed'),
      },
      sprints,
    })
  } catch (e) { res.status(500).json({ error: String(e) }) }
})

// ─── Build Hub: auto-build + auto-build-free status ─────────────────────────
const LUCY_REPO = process.env.LUCY_REPO || path.join(os.homedir(), 'lucy')

function buildToolStatus(logFile: string, pidFile?: string) {
  const logPath = path.join(LUCY_REPO, logFile)
  let logTail: string[] = []
  let lastTs = ''
  try {
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)
    logTail = lines.slice(-20)
    const last = lines[lines.length - 1] || ''
    const m = last.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
    if (m) lastTs = m[1]
  } catch { /* no log yet */ }

  // detect running: check PID from nohup/pgrep
  let running = false
  try {
    const r = require('child_process').execSync(
      `pgrep -f "${logFile.replace('.log', '.py')}" 2>/dev/null || true`, { timeout: 2000 }
    ).toString().trim()
    running = r.length > 0
  } catch { running = false }

  // parse current task from log
  const currentTask = logTail.slice().reverse().find(l => l.includes('--- task '))
  const sprintEnd = logTail.find(l => l.includes('SPRINT END'))

  return { running, lastTs, logTail: logTail.slice(-10), currentTask, sprintEnd }
}

app.get('/api/autobuild/status', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  res.json(buildToolStatus('auto-build.log'))
})

app.get('/api/autobuild-free/status', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  // check cả sprint 1 và sprint 2 log
  const s1 = buildToolStatus('auto-build-free.log')
  const s2 = buildToolStatus('auto-build-free-s2.log')
  const active = s2.running ? s2 : s1.running ? s1 : (s2.lastTs > s1.lastTs ? s2 : s1)
  res.json({ ...active, sprint2: s2, sprint1: s1 })
})

// auto-task queue thường (pm2 lucy-autotask) — pgrep auto-task.py tự khớp
app.get('/api/auto-task/status', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const base = buildToolStatus('auto-task.log')
  const count = (sub: string) => {
    try {
      return fs.readdirSync(path.join(LUCY_REPO, 'tasks', sub))
        .filter(f => f.endsWith('.md')).length
    } catch { return 0 }
  }
  res.json({
    ...base,
    queue:  count('queue'),
    doing:  count('doing'),
    done:   count('done'),
    failed: count('failed'),
  })
})

// serve React build (đặt CUỐI để /api ưu tiên)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.listen(PORT, HOST, () => {
  if (!PASSWORD) console.log('⚠️  CHƯA đặt LUCY_HUB_PASSWORD — không đăng nhập được. Đặt env!')
  console.log(`Lucy Hub: http://${HOST}:${PORT}`)
})
