// Budget — guardrail token: cộng dồn theo cửa (5h/tuần), chạm cap → engine PAUSE.
import type { Cost } from './types'

export type BudgetCfg = {
  windowMs: number // cửa rolling (vd 5h = 5*3600*1000)
  capUsd: number // ngưỡng cứng trong cửa -> PAUSE
  softUsd?: number // ngưỡng mềm -> cảnh báo
}

export class Budget {
  cfg: BudgetCfg
  events: { ts: number; usd: number }[] = []
  warned = false

  constructor(cfg: BudgetCfg) { this.cfg = cfg }

  add(c: Cost) { this.events.push({ ts: Date.now(), usd: c.usd }) }

  usedInWindow(now = Date.now()): number {
    const from = now - this.cfg.windowMs
    return this.events.filter((e) => e.ts >= from).reduce((s, e) => s + e.usd, 0)
  }

  // ok=false => engine dừng phát card mới
  check(): { ok: boolean; used: number; soft: boolean; reason?: string } {
    const used = this.usedInWindow()
    const soft = this.cfg.softUsd != null && used >= this.cfg.softUsd
    if (used >= this.cfg.capUsd) {
      return { ok: false, used, soft, reason: `budget cửa chạm cap $${this.cfg.capUsd} (đã dùng $${used.toFixed(4)}) → PAUSE` }
    }
    return { ok: true, used, soft }
  }
}
