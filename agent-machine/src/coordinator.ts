// Coordinator — chạy trên VPS (nhẹ): giữ board/queue/channels, KHÔNG chạy claude -p.
// Worker (máy local) quay ra qua HTTP: claim job -> chạy -> submit result.
import http from 'node:http'
import type { Engine, JobSpec } from './engine'
import type { Store } from './store'

function serializeJob(j: JobSpec) {
  // worker không cần workspace của coordinator — nó tự tạo workspace local.
  // persona đã được engine.claim() áp modelOverride (nếu có) -> gửi nguyên.
  return { jobId: j.jobId, cardId: j.cardId, card: { id: j.card.id, title: j.card.title, brief: j.card.brief, reviewNotes: j.card.reviewNotes, lastSummary: j.card.lastSummary }, stage: j.stage, persona: j.persona, repo: j.repo }
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (d) => (s += d))
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}) } catch { resolve({}) } })
  })
}

export function startCoordinator(engine: Engine, store: Store, port: number, opts: { autoTickMs?: number; token?: string; host?: string } = {}) {
  let timer: ReturnType<typeof setInterval> | null = null
  if (opts.autoTickMs) timer = setInterval(() => { try { engine.tick() } catch { /* */ } }, opts.autoTickMs)

  const server = http.createServer(async (req, res) => {
    const send = (code: number, obj: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
    const url = (req.url || '').split('?')[0]
    // auth: token bảo vệ MỌI endpoint (trừ /health) — chống tạo card/đọc state trái phép (RCE qua /card).
    // Hub proxy + worker đều gửi header x-worker-token. KHÔNG để hở khi expose public.
    if (opts.token && url !== '/health' && req.headers['x-worker-token'] !== opts.token) return send(401, { error: 'bad token' })
    try {
      if (req.method === 'POST' && url === '/tick') return send(200, { did: engine.tick() })
      if (url === '/config') {
        if (req.method === 'POST') { const b = await readBody(req); engine.setLimits(b) }
        return send(200, engine.limits()) // GET hoặc POST đều trả limits hiện tại (dynamic)
      }
      if (req.method === 'POST' && url === '/worker/claim') { const j = engine.claim(); return send(200, { job: j ? serializeJob(j) : null }) }
      if (req.method === 'POST' && url === '/worker/result') { const b = await readBody(req); engine.submit(b.jobId, b.result); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/card') { const b = await readBody(req); const mdl = (b.model === 'opus' || b.model === 'sonnet') ? b.model : undefined; return send(200, { card: engine.createCard(b.title, b.brief, b.pipelineId, undefined, 0, b.projectId || 'default', !!b.deferred, mdl) }) }
      if (req.method === 'POST' && url === '/card/remove') { const b = await readBody(req); return send(200, { ok: engine.removeCard(b.cardId) }) }
      if (req.method === 'POST' && url === '/card/activate') { const b = await readBody(req); engine.activate(b.cardId); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/project') { const b = await readBody(req); return send(200, { project: engine.createProject(b.name, { repoUrl: b.repoUrl, branch: b.branch, description: b.description, skill: b.skill }) }) }
      if (req.method === 'POST' && url === '/project/remove') { const b = await readBody(req); return send(200, { ok: engine.removeProject(b.projectId) }) }
      if (req.method === 'POST' && url === '/project/trash') { const b = await readBody(req); return send(200, { ok: engine.trashProject(b.projectId) }) }
      if (req.method === 'POST' && url === '/project/restore') { const b = await readBody(req); return send(200, { ok: engine.restoreProject(b.projectId) }) }
      if (req.method === 'POST' && url === '/project/purge') { const b = await readBody(req); return send(200, { purged: engine.purgeProject(b.projectId) }) }
      if (req.method === 'POST' && url === '/pipeline') { const b = await readBody(req); return send(200, { pipeline: engine.upsertPipeline(b) }) }
      if (req.method === 'POST' && url === '/pipeline/remove') { const b = await readBody(req); return send(200, { ok: engine.deletePipeline(b.id) }) }
      if (req.method === 'POST' && url === '/project/channel') { const b = await readBody(req); return send(200, { ok: engine.addChannel(b.projectId, b.name) }) }
      if (req.method === 'POST' && url === '/project/channel/remove') { const b = await readBody(req); return send(200, { ok: engine.removeChannel(b.projectId, b.name) }) }
      if (req.method === 'POST' && url === '/channel/post') { const b = await readBody(req); engine.postHuman(b.projectId, b.channel, b.text || '', b.mention); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/lucy/log') { const b = await readBody(req); engine.logLucy(b.projectId, b.role === 'me' ? 'me' : 'lucy', b.text || ''); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/approve') { const b = await readBody(req); engine.approve(b.cardId); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/reject') { const b = await readBody(req); engine.reject(b.cardId, b.feedback || ''); return send(200, { ok: true }) }
      if (req.method === 'GET' && url === '/state') return send(200, {
        cards: store.listCards(),
        projects: store.listProjects(),
        channels: store.readChannel().slice(-200),
        pipelines: [...store.pipelines.values()],
        personas: [...store.personas.values()].map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, model: p.model })),
        limits: engine.limits(),
      })
      if (req.method === 'GET' && url === '/health') return send(200, { ok: true, pending: store.listCards().filter((c) => c.status === 'queued' || c.status === 'working').length })
      send(404, { error: 'not found' })
    } catch (e) { send(500, { error: String(e) }) }
  })
  server.listen(port, opts.host || '127.0.0.1') // mặc định CHỈ localhost — nginx/overlay mới là mặt tiền public
  return { server, stop: () => { if (timer) clearInterval(timer); server.close() } }
}
