/**
 * Lucy Hub — Node/TS backend (Express). Web command center, standalone (KHÔNG Hermes).
 * Login + job nền + poll. Engine = `claude -p` (child_process). Serve React build (../../web/dist).
 *
 * Dev:  npm install ; (đặt env) ; npm run dev      (web: cd ../web && npm run dev, proxy /api)
 * Prod: cd ../web && npm run build ; rồi  npm start
 */
import express, { type Request } from 'express'
import cookieParser from 'cookie-parser'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const home = (p: string) => p.replace(/^~/, os.homedir())

const PASSWORD = process.env.LUCY_HUB_PASSWORD || ''
const PORT = Number(process.env.LUCY_HUB_PORT || 8800)
const WORKDIR = home(process.env.LUCY_WORKDIR || '~/lucy/workspace')
const CLAUDE = process.env.CLAUDE_BIN || 'claude'
const PERSONA = home(process.env.LUCY_PERSONA || '~/lucy/bridge/persona.md')
const TIMEOUT = Number(process.env.LUCY_CLAUDE_TIMEOUT || 900) * 1000
const DIST = path.join(__dirname, '..', '..', 'web', 'dist')

fs.mkdirSync(WORKDIR, { recursive: true })

const tokens = new Set<string>()
type Job = { status: 'running' | 'done'; result: string | null; model: string; t0: number; session_id: string | null }
const jobs = new Map<string, Job>()

function runClaude(prompt: string, sessionId: string | null, model: string): Promise<{ sid: string | null; text: string }> {
  const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--model', model]
  if (fs.existsSync(PERSONA)) args.push('--append-system-prompt-file', PERSONA)
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

app.post('/login', (req, res) => {
  if (PASSWORD && req.body?.password === PASSWORD) {
    const tok = randomBytes(24).toString('base64url')
    tokens.add(tok)
    res.cookie('lucy_token', tok, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400 * 1000 })
    return res.json({ ok: true })
  }
  res.status(401).json({ ok: false })
})

app.get('/api/me', (req, res) => res.json({ authed: authed(req) }))

app.post('/api/send', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauth' })
  const prompt = (req.body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'empty' })
  const model = req.body?.opus ? 'opus' : 'sonnet'
  const sessionId = req.body?.session_id || null
  const id = randomBytes(8).toString('base64url')
  jobs.set(id, { status: 'running', result: null, model, t0: Date.now(), session_id: sessionId })
  runClaude(prompt, sessionId, model).then(({ sid, text }) => {
    const j = jobs.get(id)
    if (j) { j.result = text; j.session_id = sid || j.session_id; j.status = 'done' }
  })
  res.json({ job_id: id })
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

// serve React build (đặt CUỐI để /api ưu tiên)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.listen(PORT, '0.0.0.0', () => {
  if (!PASSWORD) console.log('⚠️  CHƯA đặt LUCY_HUB_PASSWORD — không đăng nhập được. Đặt env!')
  console.log(`Lucy Hub: http://0.0.0.0:${PORT}`)
})
