// Store — thin file-based persistence (swappable cho Postgres+pg-boss+DBOS ở M2.1).
import fs from 'node:fs'
import path from 'node:path'
import type { Card, Persona, Pipeline, ChannelMsg, Cost } from './types'

export class Store {
  dir: string
  cards = new Map<string, Card>()
  personas = new Map<string, Persona>()
  pipelines = new Map<string, Pipeline>()

  constructor(dir: string) {
    this.dir = dir
    fs.mkdirSync(path.join(dir, 'workspaces'), { recursive: true })
    this.load()
  }

  private cardsFile() { return path.join(this.dir, 'cards.json') }

  load() {
    try {
      const arr = JSON.parse(fs.readFileSync(this.cardsFile(), 'utf8')) as Card[]
      for (const c of arr) this.cards.set(c.id, c)
    } catch { /* fresh */ }
  }
  // atomic: ghi tmp rồi rename -> crash giữa chừng không hỏng cards.json
  private saveCards() {
    const tmp = this.cardsFile() + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify([...this.cards.values()], null, 2))
    fs.renameSync(tmp, this.cardsFile())
  }

  putCard(c: Card) { c.updatedAt = Date.now(); this.cards.set(c.id, c); this.saveCards() }
  getCard(id: string) { return this.cards.get(id) }
  listCards() { return [...this.cards.values()] }
  deleteCard(id: string): boolean { const ok = this.cards.delete(id); if (ok) this.saveCards(); return ok }

  registerPersona(p: Persona) { this.personas.set(p.id, p) }
  registerPipeline(p: Pipeline) { this.pipelines.set(p.id, p) }

  postMessage(m: ChannelMsg) { fs.appendFileSync(path.join(this.dir, 'channels.jsonl'), JSON.stringify(m) + '\n') }
  readChannel(channel?: string): ChannelMsg[] {
    try {
      const lines = fs.readFileSync(path.join(this.dir, 'channels.jsonl'), 'utf8').trim().split('\n')
      const all = lines.filter(Boolean).map((l) => JSON.parse(l) as ChannelMsg)
      return channel ? all.filter((m) => m.channel === channel) : all
    } catch { return [] }
  }

  appendLedger(e: { ts: number; cardId: string; stage: string; persona: string } & Cost) {
    fs.appendFileSync(path.join(this.dir, 'ledger.jsonl'), JSON.stringify(e) + '\n')
  }
}
