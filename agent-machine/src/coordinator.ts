// Coordinator — chạy trên VPS (nhẹ): giữ board/queue/channels, KHÔNG chạy claude -p.
// Worker (máy local) quay ra qua HTTP: claim job -> chạy -> submit result.
import http from 'node:http'
import type { Engine, JobSpec } from './engine'
import type { Store } from './store'
import type { Recall } from './recall'
import { browseVault, readVaultFile, listPreferences, listInbox, readActive, buildGraph, setPinned } from './brain'
import { dream } from './dream'
import { recordEvidence, hasManualEvidenceToday } from './evidence'
import { buildMetrics } from './metrics'
import { buildErrorStats } from './error-stats'
import { MODEL_CATALOG, providerStatus } from './llm-lane'
import { chatLane, routeTask, routerModel, ROUTE_TABLE } from './chat-lane'

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

export function startCoordinator(engine: Engine, store: Store, port: number, opts: { autoTickMs?: number; token?: string; host?: string; recall?: Recall | null; vaultDir?: string } = {}) {
  let timer: ReturnType<typeof setInterval> | null = null
  if (opts.autoTickMs) timer = setInterval(() => { try { engine.tick() } catch { /* */ } }, opts.autoTickMs)
  const vaultDir = opts.vaultDir
  const recall = opts.recall ?? null
  const brainOn = !!(recall && vaultDir)
  // auto-reindex debounce: agent ghi note vào vault GIỮA phiên → search vẫn thấy mà không reindex mỗi request
  // (reindex incremental so mtime+checksum — vault nhỏ thì rẻ, nhưng vẫn chặn spam). Warm lúc start ở coordinator-main.
  let lastReindex = Date.now()
  const freshIndex = () => {
    if (!recall || Date.now() - lastReindex < 30_000) return
    lastReindex = Date.now()
    try { recall.reindex() } catch { /* index hỏng không được chặn route đọc */ }
  }

  const server = http.createServer(async (req, res) => {
    const send = (code: number, obj: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
    const url = (req.url || '').split('?')[0]
    const qs = new URLSearchParams((req.url || '').split('?')[1] || '')
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
      if (req.method === 'POST' && url === '/card') {
        const b = await readBody(req)
        const mdl = (b.model === 'opus' || b.model === 'sonnet' || b.model === 'laneModel') ? b.model : undefined
        // BUG-1a: laneModel chỉ hợp lệ cho persona CÓ field laneModel — từ chối LOUD, không no-op im lặng
        if (mdl === 'laneModel') {
          const pid = b.personaId || (b.pipelineId && store.pipelines.get(b.pipelineId)?.stages[0]?.personaId)
          if (pid) {
            const persona = store.personas.get(pid)
            if (persona && !persona.laneModel) return send(400, { error: `Persona '${persona.name}' không có laneModel — bỏ chọn 'rẻ' hoặc chọn agent có lane.` })
          }
        }
        return send(200, { card: engine.createCard(b.title, b.brief, b.pipelineId, undefined, 0, b.projectId || 'default', !!b.deferred, mdl, Array.isArray(b.blockedBy) ? b.blockedBy : [], b.personaId || undefined) })
      }
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
      if (req.method === 'POST' && url === '/approve') { const b = await readBody(req); engine.approve(b.cardId, b.actor); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/reject') { const b = await readBody(req); engine.reject(b.cardId, b.feedback || '', b.actor); return send(200, { ok: true }) }
      if (req.method === 'POST' && url === '/answer') { const b = await readBody(req); engine.answer(b.cardId, b.text || '', b.actor); return send(200, { ok: true }) }
      // ── TOKEN GUARD: trạng thái token/ngày (soft → hạ executor, hard → dừng) ──
      if (url === '/token-guard/reset') { if (req.method === 'POST') { engine.tokenGuard?.resetDay(); return send(200, { ok: true }) } }
      // Nạp token vào NGUỒN DUY NHẤT (engine.tokenGuard). Autopilot gọi đây thay vì tự đếm → hết double-count/stale.
      if (req.method === 'POST' && url === '/token-guard/add') {
        const b = await readBody(req)
        const sane = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }
        engine.tokenGuard?.addTokens(sane(b.inTok), sane(b.outTok))
        return send(200, { ok: true, status: engine.tokenGuardStatus() })
      }
      if (url === '/token-guard') { return send(200, engine.tokenGuardStatus()) }
      // ── LÁT API (lane model-rẻ): catalog cho dropdown + trạng thái key (KHÔNG lộ key) ──
      if (req.method === 'GET' && url === '/llm/models') return send(200, { catalog: MODEL_CATALOG, providers: providerStatus(), routeTable: ROUTE_TABLE, router: routerModel() })
      // ── Đợt A: chat qua lane model FREE (claude-path do bridge tự lo, KHÔNG qua đây) ──
      if (req.method === 'POST' && url === '/chat-lane') {
        const b = await readBody(req)
        if (!b.model || !Array.isArray(b.messages)) return send(400, { error: 'cần {model, messages[]}' })
        try { return send(200, await chatLane(b.model, b.messages, { maxTokens: b.maxTokens })) }
        catch (e) { return send(502, { error: String(e instanceof Error ? e.message : e) }) }
      }
      // ── Đợt A: smart-routing — router model đọc brief → quyết role+model+needsTools ──
      if (req.method === 'POST' && url === '/route') {
        const b = await readBody(req)
        if (!b.brief) return send(400, { error: 'cần {brief}' })
        try { return send(200, await routeTask(String(b.brief), { router: b.router })) }
        catch (e) { return send(502, { error: String(e instanceof Error ? e.message : e) }) }
      }
      // ── METRICS: frontend-compatible shape ──
      if (req.method === 'GET' && url === '/metrics') {
        const m = buildMetrics(store, recall)
        const today = new Date().toISOString().slice(0, 10)
        const monthPfx = today.slice(0, 7)
        let tokenDay = 0, tokenMonth = 0, costDay = 0, costMonth = 0
        for (const [day, d] of Object.entries(m.tokenByDay)) {
          const toks = d.inTok + d.outTok
          if (day === today) { tokenDay = toks; costDay = d.usd }
          if (day.startsWith(monthPfx)) { tokenMonth += toks; costMonth += d.usd }
        }
        const costByModel = Object.entries(m.costByModel)
          .map(([model, g]) => ({ model, usd: g.usd, tokens: g.inTok + g.outTok }))
          .sort((a, b) => b.usd - a.usd).slice(0, 8)
        const costByAgent = Object.entries(m.costByAgent)
          .map(([pId, g]) => {
            const pName = store.personas.get(pId)?.name ?? pId
            return { agent: pName.split('·')[0].trim(), usd: g.usd, tokens: g.inTok + g.outTok }
          })
          .sort((a, b) => b.usd - a.usd).slice(0, 8)
        const ledger = store.readLedger()
        const cardCost = new Map<string, { usd: number; tokens: number }>()
        for (const e of ledger) {
          const c = cardCost.get(e.cardId) ?? { usd: 0, tokens: 0 }
          c.usd += e.usd; c.tokens += e.inTok + e.outTok
          cardCost.set(e.cardId, c)
        }
        const activeCards = store.listCards().filter(c => !['done', 'failed'].includes(c.status))
        const costByCard = activeCards
          .map(c => { const co = cardCost.get(c.id) ?? { usd: 0, tokens: 0 }; return { cardId: c.id, title: c.title, usd: co.usd, tokens: co.tokens } })
          .filter(c => c.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 10)
        const allCards = store.listCards()
        const cardsRunning = allCards.filter(c => c.status === 'working').length
        const cardsWaiting = allCards.filter(c => c.status === 'waiting_human').length
        const cardsTotal = allCards.filter(c => !['done', 'failed', 'backlog'].includes(c.status)).length
        const providers = providerStatus()
        const alerts: { kind: string; message: string }[] = []
        if (costMonth > 10) alerts.push({ kind: 'cost', message: `Chi phí tháng này $${costMonth.toFixed(2)} — vượt ngưỡng $10` })
        else if (costDay > 2) alerts.push({ kind: 'cost', message: `Chi phí hôm nay $${costDay.toFixed(2)} — vượt ngưỡng $2` })
        return send(200, { tokenDay, tokenMonth, costDay, costMonth, costByModel, costByAgent, costByCard, cardsRunning, cardsWaiting, cardsTotal, providers, alerts, tokenGuard: engine.tokenGuardStatus() })
      }
      // ── ERROR-STATS: phân loại lỗi agent từ turn-log.jsonl (đọc env AM_TURNS_LOG cục bộ) ──
      if (req.method === 'GET' && url === '/error-stats') return send(200, buildErrorStats(store))
      // ── BỘ NÃO (M1: recall + vault browse + dream). brainOn=false nếu chưa set LUCY_VAULT. ──
      if (url.startsWith('/recall') || url.startsWith('/brain')) {
        if (!brainOn || !recall || !vaultDir) return send(200, { configured: false })
        if (req.method === 'GET' && url === '/recall') {
          freshIndex()
          const q = qs.get('q') || ''
          const after = qs.get('after') ? Number(qs.get('after')) : undefined
          const hits = q ? recall.search(q, { type: qs.get('type') || undefined, after, limit: Number(qs.get('limit')) || 10 }) : []
          // A7 graph-walk: kéo theo note nối hit 1 bước wikilink (2 chiều)
          return send(200, { configured: true, hits, related: hits.length ? recall.related(hits.map((h) => h.file_path)) : [] })
        }
        if (req.method === 'GET' && url === '/brain/recent') {
          freshIndex()
          return send(200, { configured: true, rows: recall.recent({ timeframe: qs.get('timeframe') || undefined, type: qs.get('type') || undefined, limit: Number(qs.get('limit')) || 15 }) })
        }
        if (req.method === 'GET' && url === '/brain/state') {
          freshIndex()
          return send(200, { configured: true, tree: browseVault(vaultDir), active: readActive(vaultDir), preferences: listPreferences(vaultDir), inbox: listInbox(vaultDir), stats: recall.stats() })
        }
        if (req.method === 'GET' && url === '/brain/graph')
          return send(200, buildGraph(vaultDir, { bornWithinMs: Number(qs.get('bornMs')) || 0 }))
        if (req.method === 'GET' && url === '/brain/file') {
          const f = readVaultFile(vaultDir, qs.get('path') || '')
          return f ? send(200, { configured: true, ...f }) : send(404, { error: 'not found / bad path' })
        }
        if (req.method === 'POST' && url === '/brain/reindex') return send(200, { configured: true, stats: recall.reindex({ full: true }) })
        if (req.method === 'POST' && url === '/brain/dream') return send(200, { configured: true, summary: dream(vaultDir) })
        // A1 evidence: Bill bấm 👍 áp dụng / 👎 bác 1 preference → ghi evidence rồi dream NGAY (confirm tức thì).
        // Dedup: 1 evidence manual / (pref, kind) / ngày — bấm lặp không thổi confidence.
        if (req.method === 'POST' && url === '/brain/evidence') {
          const b = await readBody(req)
          const kind = b.kind === 'violated' ? 'violated' : 'applied'
          const dup = b.prefId ? hasManualEvidenceToday(vaultDir, String(b.prefId), kind) : false
          const ok = !!b.prefId && !dup && recordEvidence(vaultDir, String(b.prefId), kind, Date.now(), 'manual')
          return send(200, { configured: true, ok, deduped: dup, summary: ok ? dream(vaultDir) : null })
        }
        if (req.method === 'POST' && url === '/brain/pin') {
          const b = await readBody(req)
          const ok = b.prefId ? setPinned(vaultDir, String(b.prefId), b.pinned !== false) : false
          return send(200, { configured: true, ok })
        }
        return send(404, { error: 'not found' })
      }
      if (req.method === 'GET' && url === '/state') return send(200, {
        cards: store.listCards(),
        projects: store.listProjects(),
        channels: store.readChannel().slice(-200),
        pipelines: [...store.pipelines.values()],
        personas: [...store.personas.values()].map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, model: p.model, realm: p.realm, kind: p.kind, laneModel: p.laneModel, tags: p.tags })),
        limits: engine.limits(),
        tokenGuard: engine.tokenGuardStatus(),
      })
      if (req.method === 'GET' && url === '/health') return send(200, { ok: true, pending: store.listCards().filter((c) => c.status === 'queued' || c.status === 'working').length })
      send(404, { error: 'not found' })
    } catch (e) { send(500, { error: String(e) }) }
  })
  server.listen(port, opts.host || '127.0.0.1') // mặc định CHỈ localhost — nginx/overlay mới là mặt tiền public
  return { server, stop: () => { if (timer) clearInterval(timer); server.close() } }
}
