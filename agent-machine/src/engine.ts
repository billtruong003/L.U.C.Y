// Engine — vòng auto-process: card -> stage -> runner -> outcome -> advance/gate/delegate.
// Guardrails: budget pause, cap lane, gate (HITL), workspace cô lập, blockedBy (DAG hold/resume).
import { Store } from './store'
import { Budget } from './budget'
import { makeWorkspace } from './workspace'
import { post, threadOf } from './channels'
import type { Runner } from './runner'
import type { Card } from './types'

let _n = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(_n++).toString(36)}`

export class Engine {
  store: Store
  runner: Runner
  budget: Budget
  maxLanes: number
  perCardMaxUsd: number // guardrail: 1 card không được đốt quá ngần này
  maxStageVisits: number // loop-breaker: 1 stage vào quá ngần này lần -> halt
  maxDepth: number // depth-breaker: delegate sâu quá -> halt (chống delegate vô hạn)
  paused = false

  constructor(store: Store, runner: Runner, budget: Budget, opts: { maxLanes?: number; perCardMaxUsd?: number; maxStageVisits?: number; maxDepth?: number } = {}) {
    this.store = store
    this.runner = runner
    this.budget = budget
    this.maxLanes = opts.maxLanes ?? 3
    this.perCardMaxUsd = opts.perCardMaxUsd ?? Infinity
    this.maxStageVisits = opts.maxStageVisits ?? 5
    this.maxDepth = opts.maxDepth ?? 6
  }

  createCard(title: string, brief: string, pipelineId: string, parentId?: string, depth = 0): Card {
    const id = uid('card')
    const card: Card = {
      id, title, brief, pipelineId, stageIndex: 0, status: 'queued',
      workspace: makeWorkspace(this.store.dir, id), parentId, depth, blockedBy: [],
      cost: { usd: 0, inTok: 0, outTok: 0 }, history: [{ ts: Date.now(), stage: '-', event: 'created' }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    this.store.putCard(card)
    post(this.store, 'coordination', 'engine', 'system', `+ card "${title}" → pipeline ${pipelineId}`, id)
    return card
  }

  // người DUYỆT 1 card đang chờ (dashboard/Telegram gọi vào đây)
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

  private working(): number {
    return this.store.listCards().filter((c) => c.status === 'working').length
  }

  // 1 tick: chạy các card actionable (tôn trọng budget + cap lane). Trả số card đã xử lý.
  async tick(): Promise<number> {
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
      await this.runStage(c)
      did++
    }
    this.resolveUnblocks()
    return did
  }

  private async runStage(c: Card) {
    const pipe = this.store.pipelines.get(c.pipelineId)!
    const stage = pipe.stages[c.stageIndex]
    const persona = this.store.personas.get(stage.personaId)!

    // guardrail: loop-breaker — stage vào quá nhiều lần -> halt
    c.stageVisits = c.stageVisits || {}
    c.stageVisits[stage.id] = (c.stageVisits[stage.id] || 0) + 1
    if (c.stageVisits[stage.id] > this.maxStageVisits) {
      c.status = 'failed'
      post(this.store, threadOf(c.id), 'engine', 'system', `⛔ loop-breaker: stage "${stage.name}" chạy quá ${this.maxStageVisits} lần → HALT`, c.id)
      this.store.putCard(c)
      return
    }

    c.status = 'working'
    this.store.putCard(c)
    post(this.store, threadOf(c.id), persona.name, 'status', `▶ ${persona.name} bắt đầu "${stage.name}"`, c.id)

    const res = await this.runner.run(c, stage, persona, c.workspace)

    c.cost.usd += res.cost.usd; c.cost.inTok += res.cost.inTok; c.cost.outTok += res.cost.outTok
    this.budget.add(res.cost)
    this.store.appendLedger({ ts: Date.now(), cardId: c.id, stage: stage.id, persona: persona.id, ...res.cost })
    post(this.store, threadOf(c.id), persona.name, 'status', res.outcome.summary, c.id)
    c.history.push({ ts: Date.now(), stage: stage.id, event: res.outcome.decision, detail: res.outcome.summary })

    // guardrail: per-card cost cap -> chặn lại hỏi người
    if (c.cost.usd >= this.perCardMaxUsd) {
      c.status = 'waiting_human'
      c.pendingQuestion = `Card vượt cap chi phí $${this.perCardMaxUsd.toFixed(2)} (đã $${c.cost.usd.toFixed(3)}) — duyệt để chạy tiếp?`
      post(this.store, threadOf(c.id), 'engine', 'decision', `⛔ COST CAP: ${c.pendingQuestion}`, c.id)
      this.store.putCard(c)
      return
    }

    switch (res.outcome.decision) {
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
        c.pendingQuestion = res.outcome.question ?? res.outcome.summary
        post(this.store, threadOf(c.id), 'engine', 'decision', `⛔ CẦN QUYẾT ĐỊNH: ${c.pendingQuestion}`, c.id)
        this.store.putCard(c)
        break
      case 'delegate': {
        const d = res.outcome.delegateTo!
        if (c.depth >= this.maxDepth) {
          c.status = 'failed'
          post(this.store, threadOf(c.id), 'engine', 'system', `⛔ depth-breaker: delegate quá sâu (depth ${c.depth} ≥ ${this.maxDepth}) → HALT`, c.id)
          this.store.putCard(c)
          break
        }
        const child = this.createCard(d.title, d.brief, d.pipelineId ?? c.pipelineId, c.id, c.depth + 1)
        c.blockedBy.push(child.id)
        c.status = 'blocked'
        post(this.store, threadOf(c.id), 'engine', 'system', `↪ delegate → ${child.id} ("${d.title}"); HOLD "${c.title}"`, c.id)
        this.store.putCard(c)
        break
      }
      case 'fail':
        c.status = 'failed'
        this.store.putCard(c)
        break
    }
  }

  // child xong -> parent qua stage tiếp (việc của stage này coi như đã xử lý bởi child)
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

  // chạy tới khi không còn việc TỰ ĐỘNG (dừng ở waiting_human/done) — helper skeleton
  async runUntilIdle(maxTicks = 100): Promise<void> {
    for (let i = 0; i < maxTicks; i++) {
      const did = await this.tick()
      if (!did) break
    }
  }
}
