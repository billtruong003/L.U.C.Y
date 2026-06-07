// Engine — vòng auto-process tách RÕ: dispatch (tick) -> queue -> worker claim/run/submit.
// Local mode: worker in-process (drainLocal). Remote mode: worker quay ra qua coordinator (HTTP).
// Guardrails: budget pause, cap lane, gate (HITL), per-card cost cap, depth-breaker, loop-breaker, workspace cô lập.
import { Store } from './store'
import { Budget } from './budget'
import { makeWorkspace } from './workspace'
import { post, threadOf } from './channels'
import type { Runner } from './runner'
import type { Card, Stage, Persona, Project, RunResult } from './types'

let _n = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(_n++).toString(36)}`

export type JobSpec = { jobId: string; cardId: string; card: Card; stage: Stage; persona: Persona; repo?: { url: string; branch?: string; projectId: string } }

export class Engine {
  store: Store
  runner: Runner // worker in-process (local mode); remote thì worker bên ngoài claim/submit
  budget: Budget
  maxLanes: number
  perCardMaxUsd: number
  maxStageVisits: number
  maxDepth: number
  paused = false

  private pending: { id: string; cardId: string }[] = []
  private inFlight = new Map<string, string>() // jobId -> cardId

  constructor(store: Store, runner: Runner, budget: Budget, opts: { maxLanes?: number; perCardMaxUsd?: number; maxStageVisits?: number; maxDepth?: number } = {}) {
    this.store = store
    this.runner = runner
    this.budget = budget
    this.maxLanes = opts.maxLanes ?? 3
    this.perCardMaxUsd = opts.perCardMaxUsd ?? Infinity
    this.maxStageVisits = opts.maxStageVisits ?? 5
    this.maxDepth = opts.maxDepth ?? 6
  }

  createCard(title: string, brief: string, pipelineId: string, parentId?: string, depth = 0, projectId = 'default', deferred = false, modelOverride?: 'sonnet' | 'opus'): Card {
    const id = uid('card')
    const card: Card = {
      id, title, brief, pipelineId, projectId, stageIndex: 0, status: deferred ? 'backlog' : 'queued', modelOverride,
      workspace: makeWorkspace(this.store.dir, id), parentId, depth, blockedBy: [],
      cost: { usd: 0, inTok: 0, outTok: 0 }, history: [{ ts: Date.now(), stage: '-', event: deferred ? 'created-backlog' : 'created' }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    this.ensureProject(projectId) // card luôn thuộc 1 project có thật
    this.store.putCard(card)
    post(this.store, 'coordination', 'engine', 'system', `+ card "${title}" → pipeline ${pipelineId}${deferred ? ' (để sau)' : ''}`, id)
    return card
  }

  // ── PROJECT: container thật (repo + board + kênh + chat) ──
  ensureProject(id: string): Project {
    const ex = this.store.getProject(id)
    if (ex) return ex
    const p: Project = { id, name: id, channels: ['general'], createdAt: Date.now(), updatedAt: Date.now() }
    this.store.putProject(p)
    return p
  }
  createProject(name: string, opts: { repoUrl?: string; branch?: string; description?: string; skill?: string } = {}): Project {
    const id = (name || '').trim() || 'default'
    const ex = this.store.getProject(id)
    const p: Project = ex
      ? { ...ex, repoUrl: opts.repoUrl ?? ex.repoUrl, branch: opts.branch ?? ex.branch, description: opts.description ?? ex.description, skill: opts.skill ?? ex.skill }
      : { id, name: id, repoUrl: opts.repoUrl, branch: opts.branch, description: opts.description, skill: opts.skill, channels: ['general'], createdAt: Date.now(), updatedAt: Date.now() }
    this.store.putProject(p)
    if (!ex) post(this.store, 'coordination', 'engine', 'system', `📁 dự án mới: "${id}"${opts.repoUrl ? ' (repo thật)' : ''}`)
    return p
  }
  removeProject(id: string): boolean {
    // chỉ xoá project rỗng (không còn card) — tránh mồ côi card
    if (this.store.listCards().some((c) => (c.projectId || 'default') === id)) return false
    return this.store.deleteProject(id)
  }

  // ── KÊNH Discord-style per-project (R4) — channel id = `p:<projectId>:<name>` ──
  addChannel(projectId: string, name: string): boolean {
    const p = this.store.getProject(projectId); if (!p) return false
    const n = (name || '').trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase(); if (!n) return false
    if (!p.channels.includes(n)) { p.channels.push(n); this.store.putProject(p); post(this.store, `p:${projectId}:general`, 'engine', 'system', `# tạo kênh "${n}"`) }
    return true
  }
  removeChannel(projectId: string, name: string): boolean {
    const p = this.store.getProject(projectId); if (!p || name === 'general') return false
    p.channels = p.channels.filter((c) => c !== name); this.store.putProject(p); return true
  }
  // người (Bill) gõ vào kênh — có thể @tag 1 agent để điều hướng. channel = tên kênh dự án HOẶC card-<id> (rep trong thread task)
  postHuman(projectId: string, channel: string, text: string, mention?: string) {
    if (!(text || '').trim()) return
    const ch = (channel || '').startsWith('card-') ? channel : `p:${projectId}:${channel || 'general'}`
    post(this.store, ch, 'bill', 'chat', (mention ? `@${mention} ` : '') + text.trim())
  }
  // V3: lưu hội thoại Lucy (kênh ẩn __lucy, không hiện trong tab Channels) -> qua F5/đa thiết bị
  logLucy(projectId: string, role: 'me' | 'lucy', text: string) {
    if (!(text || '').trim()) return
    post(this.store, `p:${projectId}:__lucy`, role === 'me' ? 'bill' : 'Lucy', 'chat', text.trim())
  }
  // backfill: mọi projectId trên card phải có Project entity (migration cho card cũ)
  private backfillProjects() {
    const have = new Set(this.store.listProjects().map((p) => p.id))
    for (const c of this.store.listCards()) { const pid = c.projectId || 'default'; if (!have.has(pid)) { this.ensureProject(pid); have.add(pid) } }
  }

  // defer/backlog: card 'backlog' KHÔNG được dispatch -> bấm "Chạy" mới vào hàng.
  activate(cardId: string) {
    const c = this.store.getCard(cardId)
    if (!c || c.status !== 'backlog') return
    c.status = 'queued'
    c.history.push({ ts: Date.now(), stage: '-', event: 'activated' })
    post(this.store, threadOf(c.id), 'engine', 'system', `▶ kích hoạt "${c.title}" → vào hàng chạy`, c.id)
    this.store.putCard(c)
  }

  // xoá card (rác/lỗi). Dọn luôn job đang chờ/bay của nó để không mồ côi.
  removeCard(cardId: string): boolean {
    const c = this.store.getCard(cardId)
    if (!c) return false
    this.pending = this.pending.filter((j) => j.cardId !== cardId)
    for (const [jid, cid] of [...this.inFlight]) if (cid === cardId) this.inFlight.delete(jid)
    this.store.removeWorkspace(cardId) // dọn dir trên đĩa luôn
    const ok = this.store.deleteCard(cardId)
    if (ok) post(this.store, 'coordination', 'engine', 'system', `🗑 xoá card "${c.title}"`, cardId)
    return ok
  }

  // ── THÙNG RÁC dự án: trash (ẩn) -> restore | purge (xoá HẲN: card + workspace + record) ──
  trashProject(id: string): boolean {
    const p = this.store.getProject(id); if (!p) return false
    p.trashed = true; this.store.putProject(p)
    post(this.store, 'coordination', 'engine', 'system', `🗑 ném dự án "${p.name}" vào thùng rác`)
    return true
  }
  restoreProject(id: string): boolean {
    const p = this.store.getProject(id); if (!p) return false
    p.trashed = false; this.store.putProject(p); return true
  }
  // xoá HẲN: mọi card của dự án (+ workspace dir) + record dự án. (Repo clone trên worker là cache, tự dọn/clone lại.)
  purgeProject(id: string): number {
    const p = this.store.getProject(id); if (!p) return 0
    let n = 0
    for (const c of this.store.listCards().filter((c) => (c.projectId || 'default') === id)) { if (this.removeCard(c.id)) n++ }
    this.store.deleteProject(id)
    post(this.store, 'coordination', 'engine', 'system', `🔥 xoá HẲN dự án "${p.name}" (${n} card)`)
    return n
  }

  approve(cardId: string) {
    const c = this.store.getCard(cardId)
    if (!c || c.status !== 'waiting_human') return
    post(this.store, threadOf(c.id), 'bill', 'decision', `✓ duyệt: ${c.pendingQuestion ?? 'tiếp tục'}`, c.id)
    c.pendingQuestion = undefined
    this.advanceCard(c)
  }

  // TRẢ LẠI ở gate: bạn ghi vấn đề/yêu cầu -> card lùi về stage trước (vd review -> build)
  // để agent (Max) SỬA theo feedback, rồi review lại. Loop-breaker chặn lặp vô hạn.
  reject(cardId: string, feedback: string) {
    const c = this.store.getCard(cardId)
    if (!c || c.status !== 'waiting_human') return
    const pipe = this.store.pipelines.get(c.pipelineId)
    if (!pipe) { c.status = 'failed'; this.store.putCard(c); return }
    const note = (feedback || '').trim() || 'Có vấn đề — làm lại kỹ hơn.'
    c.reviewNotes = (c.reviewNotes || []).concat(note)
    c.pendingQuestion = undefined
    c.stageIndex = Math.max(0, c.stageIndex - 1) // lùi về stage trước gate (thường = build)
    c.status = 'queued'
    const back = pipe.stages[c.stageIndex]
    post(this.store, threadOf(c.id), 'bill', 'decision', `✗ TRẢ LẠI: ${note}`, c.id)
    post(this.store, threadOf(c.id), 'engine', 'system', `↩ về "${back.name}" để sửa theo feedback`, c.id)
    c.history.push({ ts: Date.now(), stage: back.id, event: 'reject-rework', detail: note })
    this.store.putCard(c)
  }

  private advanceCard(c: Card) {
    const pipe = this.store.pipelines.get(c.pipelineId)!
    if (c.stageIndex >= pipe.stages.length - 1) {
      c.status = 'done'
      c.history.push({ ts: Date.now(), stage: pipe.stages[c.stageIndex].id, event: 'done' })
      post(this.store, threadOf(c.id), 'engine', 'report', `🏁 card "${c.title}" DONE`, c.id)
    } else {
      c.stageIndex++
      c.status = 'queued'
      c.history.push({ ts: Date.now(), stage: pipe.stages[c.stageIndex].id, event: 'enter-stage' })
    }
    this.store.putCard(c)
  }

  // chỉnh giới hạn LÚC ĐANG CHẠY (dynamic): tăng/giảm queue width, cost cap...
  setLimits(p: { maxLanes?: number; perCardMaxUsd?: number; maxDepth?: number; maxStageVisits?: number }) {
    if (p.maxLanes != null) this.maxLanes = Math.max(1, Math.floor(p.maxLanes))
    if (p.perCardMaxUsd != null) this.perCardMaxUsd = p.perCardMaxUsd
    if (p.maxDepth != null) this.maxDepth = Math.max(0, Math.floor(p.maxDepth))
    if (p.maxStageVisits != null) this.maxStageVisits = Math.max(1, Math.floor(p.maxStageVisits))
  }
  limits() { return { maxLanes: this.maxLanes, perCardMaxUsd: this.perCardMaxUsd, maxDepth: this.maxDepth, maxStageVisits: this.maxStageVisits, queued: this.store.listCards().filter((c) => c.status === 'queued').length, inFlight: this.inFlight.size } }

  // crash recovery: card 'working' (đã dispatch nhưng mất kết quả khi restart) -> queued lại.
  // Cards persist trong store; status là source-of-truth -> gate/blocked/done resume tự nhiên sau restart.
  recover(): number {
    this.pending = []
    this.inFlight.clear()
    this.backfillProjects() // card cũ -> đảm bảo có Project entity
    let n = 0
    for (const c of this.store.listCards()) {
      if (c.status === 'working') {
        c.status = 'queued'
        c.history.push({ ts: Date.now(), stage: '-', event: 'recovered' })
        this.store.putCard(c)
        n++
      }
    }
    if (n) post(this.store, 'coordination', 'engine', 'system', `♻ recovery: ${n} card 'working' mồ côi → queued lại`)
    return n
  }

  private working(): number { return this.inFlight.size }

  // ── DISPATCH: tìm card actionable -> đẩy vào queue (mark working). KHÔNG chạy ở đây. ──
  tick(): number {
    const b = this.budget.check()
    if (!b.ok) {
      if (!this.paused) { this.paused = true; post(this.store, 'coordination', 'engine', 'system', `⛔ ${b.reason}`) }
      return 0
    }
    if (b.soft && !this.budget.warned) { this.budget.warned = true; post(this.store, 'coordination', 'engine', 'system', `⚠ budget mềm: đã dùng $${b.used.toFixed(4)} trong cửa`) }
    this.paused = false

    let did = 0
    for (const c of this.store.listCards()) {
      if (this.working() >= this.maxLanes) break
      if (c.status !== 'queued' || c.blockedBy.length) continue

      const pipe = this.store.pipelines.get(c.pipelineId)
      const stage = pipe?.stages[c.stageIndex]
      const persona = stage ? this.store.personas.get(stage.personaId) : undefined
      // guardrail: cấu hình sai (pipeline/stage/persona thiếu) -> FAIL card NÀY, KHÔNG throw.
      // (1 card hỏng từng làm tick() throw -> auto-tick nuốt lỗi -> kẹt CẢ queue.)
      if (!pipe || !stage || !persona) {
        c.status = 'failed'
        post(this.store, threadOf(c.id), 'engine', 'system', `⛔ cấu hình sai: ${!pipe ? `pipeline "${c.pipelineId}" không tồn tại` : !stage ? `stage #${c.stageIndex} không tồn tại` : 'persona không tồn tại'} → card FAILED`, c.id)
        this.store.putCard(c)
        continue
      }
      // guardrail: loop-breaker
      c.stageVisits = c.stageVisits || {}
      c.stageVisits[stage.id] = (c.stageVisits[stage.id] || 0) + 1
      if (c.stageVisits[stage.id] > this.maxStageVisits) {
        c.status = 'failed'
        post(this.store, threadOf(c.id), 'engine', 'system', `⛔ loop-breaker: stage "${stage.name}" chạy quá ${this.maxStageVisits} lần → HALT`, c.id)
        this.store.putCard(c)
        continue
      }
      c.status = 'working'
      this.store.putCard(c)
      const jobId = uid('job')
      this.pending.push({ id: jobId, cardId: c.id })
      this.inFlight.set(jobId, c.id)
      post(this.store, threadOf(c.id), persona.name, 'status', `▶ ${persona.name} nhận "${stage.name}"`, c.id)
      did++
    }
    this.resolveUnblocks()
    return did
  }

  // ── WORKER claim: lấy 1 job để chạy (in-process hoặc remote qua HTTP) ──
  claim(): JobSpec | null {
    const j = this.pending.shift()
    if (!j) return null
    const c = this.store.getCard(j.cardId)
    if (!c) { this.inFlight.delete(j.id); return null }
    const pipe = this.store.pipelines.get(c.pipelineId)
    const stage = pipe?.stages[c.stageIndex]
    const base = stage ? this.store.personas.get(stage.personaId) : undefined
    if (!pipe || !stage || !base) { this.inFlight.delete(j.id); c.status = 'failed'; this.store.putCard(c); return null }
    const proj = this.store.getProject(c.projectId)
    // model override + SKILL dự án -> nhồi vào persona (clone, không mutate gốc)
    let persona = c.modelOverride ? { ...base, model: c.modelOverride } : base
    if (proj?.skill) persona = { ...persona, systemPrompt: persona.systemPrompt + `\n\n--- SKILL DỰ ÁN "${proj.name}" ---\n${proj.skill}` }
    // repo: nếu project có repoUrl -> worker clone & làm việc trong repo thật (R2)
    const repo = proj?.repoUrl ? { url: proj.repoUrl, branch: proj.branch, projectId: proj.id } : undefined
    return { jobId: j.id, cardId: c.id, card: c, stage, persona, repo }
  }

  // ── WORKER submit: trả kết quả -> áp outcome ──
  submit(jobId: string, result: RunResult): void {
    const cardId = this.inFlight.get(jobId)
    if (!cardId) return
    this.inFlight.delete(jobId)
    const c = this.store.getCard(cardId)
    if (!c) return
    const pipe = this.store.pipelines.get(c.pipelineId)!
    const stage = pipe.stages[c.stageIndex]
    const persona = this.store.personas.get(stage.personaId)!

    c.cost.usd += result.cost.usd; c.cost.inTok += result.cost.inTok; c.cost.outTok += result.cost.outTok
    this.budget.add(result.cost)
    this.store.appendLedger({ ts: Date.now(), cardId: c.id, stage: stage.id, persona: persona.id, ...result.cost })
    post(this.store, threadOf(c.id), persona.name, 'status', result.outcome.summary, c.id)
    c.history.push({ ts: Date.now(), stage: stage.id, event: result.outcome.decision, detail: result.outcome.summary })
    if (result.artifacts) c.artifacts = { ...result.artifacts, stage: stage.id } // V1: báo cáo đổi gì

    // guardrail: per-card cost cap
    if (c.cost.usd >= this.perCardMaxUsd) {
      c.status = 'waiting_human'
      c.pendingQuestion = `Card vượt cap chi phí $${this.perCardMaxUsd.toFixed(2)} (đã $${c.cost.usd.toFixed(3)}) — duyệt để chạy tiếp?`
      post(this.store, threadOf(c.id), 'engine', 'decision', `⛔ COST CAP: ${c.pendingQuestion}`, c.id)
      this.store.putCard(c)
      return
    }

    switch (result.outcome.decision) {
      case 'advance':
      case 'done': // 'done' = agent xong việc của STAGE này -> advanceCard (tự kết thúc card nếu là stage CUỐI); tôn trọng gate
        if (stage.gate) {
          c.status = 'waiting_human'
          c.pendingQuestion = `Duyệt qua "${stage.name}"?`
          post(this.store, threadOf(c.id), 'engine', 'decision', `⛔ GATE: ${c.pendingQuestion} (cần bạn duyệt)`, c.id)
          this.store.putCard(c)
        } else this.advanceCard(c)
        break
      case 'needs_decision':
        c.status = 'waiting_human'
        c.pendingQuestion = result.outcome.question ?? result.outcome.summary
        post(this.store, threadOf(c.id), 'engine', 'decision', `⛔ CẦN QUYẾT ĐỊNH: ${c.pendingQuestion}`, c.id)
        this.store.putCard(c)
        break
      case 'delegate': {
        const d = result.outcome.delegateTo!
        if (c.depth >= this.maxDepth) {
          c.status = 'failed'
          post(this.store, threadOf(c.id), 'engine', 'system', `⛔ depth-breaker: delegate quá sâu (depth ${c.depth} ≥ ${this.maxDepth}) → HALT`, c.id)
          this.store.putCard(c)
          break
        }
        const tgt = this.store.personas.get(d.personaId)
        const child = this.createCard(d.title, d.brief, d.pipelineId ?? c.pipelineId, c.id, c.depth + 1, c.projectId)
        c.blockedBy.push(child.id)
        c.status = 'blocked'
        // agent↔agent: người đang làm NHỜ persona khác (handoff thật, không phải log)
        post(this.store, threadOf(c.id), persona.name, 'handoff', `📨 → ${tgt?.name ?? d.personaId}: nhờ xử lý "${d.title}"`, c.id)
        this.store.putCard(c)
        break
      }
      case 'fail':
        c.status = 'failed'
        this.store.putCard(c)
        break
    }

    // agent↔agent: child xong -> báo NGƯỢC về người nhờ (trong thread của parent)
    if (c.parentId && c.status === 'done') {
      post(this.store, threadOf(c.parentId), persona.name, 'handoff', `↩ "${c.title}" xong — trả về`, c.parentId)
    }
  }

  // child xong -> parent qua stage tiếp
  private resolveUnblocks() {
    for (const c of this.store.listCards()) {
      if (c.status !== 'blocked' || !c.blockedBy.length) continue
      const still = c.blockedBy.filter((id) => {
        const d = this.store.getCard(id)
        return d && d.status !== 'done' && d.status !== 'failed'
      })
      if (!still.length) {
        c.blockedBy = []
        post(this.store, threadOf(c.id), 'engine', 'system', `▲ dependency xong → RESUME "${c.title}"`, c.id)
        this.advanceCard(c)
      } else c.blockedBy = still
    }
  }

  // ── LOCAL worker in-process: claim+run+submit hết queue ──
  async drainLocal(): Promise<number> {
    let n = 0
    let spec = this.claim()
    while (spec) {
      const res = await this.runner.run(spec.card, spec.stage, spec.persona, spec.card.workspace)
      this.submit(spec.jobId, res)
      n++
      spec = this.claim()
    }
    return n
  }

  // chạy tới khi không còn việc TỰ ĐỘNG (local mode) — helper demo/test.
  // (resolveUnblocks chạy cuối tick có thể queue card mới -> phải xét 'còn queued' để không thoát sớm)
  async runUntilIdle(maxRounds = 300): Promise<void> {
    for (let i = 0; i < maxRounds; i++) {
      const d = this.tick()
      if (this.paused) break
      const r = await this.drainLocal()
      const moreQueued = this.store.listCards().some((c) => c.status === 'queued')
      if (!d && !r && !moreQueued && !this.pending.length && !this.inFlight.size) break
    }
  }
}
