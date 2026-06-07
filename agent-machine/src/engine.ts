// Engine — vòng auto-process tách RÕ: dispatch (tick) -> queue -> worker claim/run/submit.
// Local mode: worker in-process (drainLocal). Remote mode: worker quay ra qua coordinator (HTTP).
// Guardrails: budget pause, cap lane, gate (HITL), per-card cost cap, depth-breaker, loop-breaker, workspace cô lập.
import { Store } from './store'
import { Budget } from './budget'
import { makeWorkspace } from './workspace'
import { post, threadOf } from './channels'
import type { Runner } from './runner'
import type { Card, Stage, Persona, RunResult } from './types'

let _n = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(_n++).toString(36)}`

export type JobSpec = { jobId: string; cardId: string; card: Card; stage: Stage; persona: Persona }

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

  createCard(title: string, brief: string, pipelineId: string, parentId?: string, depth = 0, projectId = 'default'): Card {
    const id = uid('card')
    const card: Card = {
      id, title, brief, pipelineId, projectId, stageIndex: 0, status: 'queued',
      workspace: makeWorkspace(this.store.dir, id), parentId, depth, blockedBy: [],
      cost: { usd: 0, inTok: 0, outTok: 0 }, history: [{ ts: Date.now(), stage: '-', event: 'created' }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    this.store.putCard(card)
    post(this.store, 'coordination', 'engine', 'system', `+ card "${title}" → pipeline ${pipelineId}`, id)
    return card
  }

  approve(cardId: string) {
    const c = this.store.getCard(cardId)
    if (!c || c.status !== 'waiting_human') return
    post(this.store, threadOf(c.id), 'bill', 'decision', `✓ duyệt: ${c.pendingQuestion ?? 'tiếp tục'}`, c.id)
    c.pendingQuestion = undefined
    this.advanceCard(c)
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

      const pipe = this.store.pipelines.get(c.pipelineId)!
      const stage = pipe.stages[c.stageIndex]
      // guardrail: loop-breaker
      c.stageVisits = c.stageVisits || {}
      c.stageVisits[stage.id] = (c.stageVisits[stage.id] || 0) + 1
      if (c.stageVisits[stage.id] > this.maxStageVisits) {
        c.status = 'failed'
        post(this.store, threadOf(c.id), 'engine', 'system', `⛔ loop-breaker: stage "${stage.name}" chạy quá ${this.maxStageVisits} lần → HALT`, c.id)
        this.store.putCard(c)
        continue
      }
      const persona = this.store.personas.get(stage.personaId)!
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
    const pipe = this.store.pipelines.get(c.pipelineId)!
    const stage = pipe.stages[c.stageIndex]
    const persona = this.store.personas.get(stage.personaId)!
    return { jobId: j.id, cardId: c.id, card: c, stage, persona }
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
        if (stage.gate) {
          c.status = 'waiting_human'
          c.pendingQuestion = `Duyệt qua "${stage.name}"?`
          post(this.store, threadOf(c.id), 'engine', 'decision', `⛔ GATE: ${c.pendingQuestion} (cần bạn duyệt)`, c.id)
          this.store.putCard(c)
        } else this.advanceCard(c)
        break
      case 'done':
        c.status = 'done'
        post(this.store, threadOf(c.id), 'engine', 'report', `🏁 "${c.title}" DONE`, c.id)
        this.store.putCard(c)
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
