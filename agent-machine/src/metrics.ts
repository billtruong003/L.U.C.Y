// metrics — build ledger thành token/cost time‑series + throughput.
// Thuần: không đụng engine, không đọc file trực tiếp, chỉ gọi store + recall.
import type { Store } from './store'
import type { Recall } from './recall'

export type MetricsDay = { inTok: number; outTok: number; usd: number }
export type MetricsGroup = { usd: number; inTok: number; outTok: number; runs: number }

export type Metrics = {
  tokenByDay: Record<string, MetricsDay>
  costByModel: Record<string, MetricsGroup>
  costByAgent: Record<string, MetricsGroup>
  costByProject: Record<string, MetricsGroup>
  cardThroughput: Record<string, { created: number; done: number }>
  vault: { notes: number; observations: number } | null
  totals: { usd: number; inTok: number; outTok: number; runs: number; cards: number }
}

// ── M5 time-series: bucket ledger thành chuỗi token/cost cho sparkline (24h theo giờ, 7d/30d theo ngày).
// Zero-fill bucket rỗng = SỐ THẬT (không có run → 0, KHÔNG bịa). t = mốc bắt đầu bucket (ms, UTC-aligned).
export type SeriesPoint = { t: number; tokens: number; usd: number; runs: number }
export type MetricsSeries = { '24h': SeriesPoint[]; '7d': SeriesPoint[]; '30d': SeriesPoint[] }

const HOUR_MS = 3600_000
const DAY_MS = 86_400_000

export function buildSeries(store: Store, now: number): MetricsSeries {
  const entries = store.readLedger()
  const bucketize = (count: number, span: number): SeriesPoint[] => {
    const align = (t: number) => Math.floor(t / span) * span
    const end = align(now)                  // bucket hiện tại (mới nhất)
    const points: SeriesPoint[] = []
    const idx = new Map<number, SeriesPoint>()
    for (let i = count - 1; i >= 0; i--) {  // cũ → mới
      const start = end - i * span
      const p: SeriesPoint = { t: start, tokens: 0, usd: 0, runs: 0 }
      points.push(p); idx.set(start, p)
    }
    for (const e of entries) {
      const p = idx.get(align(e.ts))
      if (p) { p.tokens += e.inTok + e.outTok; p.usd += e.usd; p.runs++ }
    }
    return points
  }
  return {
    '24h': bucketize(24, HOUR_MS),
    '7d': bucketize(7, DAY_MS),
    '30d': bucketize(30, DAY_MS),
  }
}

/** Model thực tế 1 run, replica logic engine.ts:368. */
function resolveModel(card: { modelOverride?: string }, personaModel: string): string {
  // 'laneModel' = dùng model mặc định của persona, giống engine (không đè)
  if (!card.modelOverride || card.modelOverride === 'laneModel') return personaModel
  // không hạ cấp nếu persona gốc là opus
  if (personaModel === 'opus') return 'opus'
  return card.modelOverride
}

export function buildMetrics(store: Store, recall?: Recall | null): Metrics {
  const entries = store.readLedger()

  const tokenByDay: Record<string, MetricsDay> = {}
  const costByModel: Record<string, MetricsGroup> = {}
  const costByAgent: Record<string, MetricsGroup> = {}
  const costByProject: Record<string, MetricsGroup> = {}

  for (const e of entries) {
    const day = new Date(e.ts).toISOString().slice(0, 10)

    // tokenByDay
    let d = tokenByDay[day]
    if (!d) { d = { inTok: 0, outTok: 0, usd: 0 }; tokenByDay[day] = d }
    d.inTok += e.inTok
    d.outTok += e.outTok
    d.usd += e.usd

    // tra cứu card để lấy projectId + modelOverride
    const card = store.getCard(e.cardId)
    const projectId = card ? (card.projectId || 'unknown') : 'unknown'

    // resolve model từ persona + card override
    const personaObj = store.personas.get(e.persona)
    const model = personaObj
      ? resolveModel(card ?? { modelOverride: undefined }, personaObj.model)
      : 'unknown'

    // costByModel
    let m = costByModel[model]
    if (!m) { m = { usd: 0, inTok: 0, outTok: 0, runs: 0 }; costByModel[model] = m }
    m.usd += e.usd; m.inTok += e.inTok; m.outTok += e.outTok; m.runs++

    // costByAgent — key = persona id
    const agent = e.persona
    let a = costByAgent[agent]
    if (!a) { a = { usd: 0, inTok: 0, outTok: 0, runs: 0 }; costByAgent[agent] = a }
    a.usd += e.usd; a.inTok += e.inTok; a.outTok += e.outTok; a.runs++

    // costByProject
    let p = costByProject[projectId]
    if (!p) { p = { usd: 0, inTok: 0, outTok: 0, runs: 0 }; costByProject[projectId] = p }
    p.usd += e.usd; p.inTok += e.inTok; p.outTok += e.outTok; p.runs++
  }

  // ── cardThroughput: từ card.history events ──
  const cardThroughput: Record<string, { created: number; done: number }> = {}
  for (const c of store.listCards()) {
    for (const h of c.history) {
      const day = new Date(h.ts).toISOString().slice(0, 10)
      let td = cardThroughput[day]
      if (!td) { td = { created: 0, done: 0 }; cardThroughput[day] = td }
      if (h.event === 'created' || h.event === 'created-backlog') td.created++
      if (h.event === 'done') td.done++
    }
  }

  // totals
  let totalUsd = 0, totalInTok = 0, totalOutTok = 0, totalRuns = 0
  for (const g of Object.values(costByModel)) {
    totalUsd += g.usd; totalInTok += g.inTok; totalOutTok += g.outTok; totalRuns += g.runs
  }

  // vault
  const vault = recall
    ? { notes: recall.stats().total, observations: recall.stats().observations }
    : null

  return {
    tokenByDay,
    costByModel,
    costByAgent,
    costByProject,
    cardThroughput,
    vault,
    totals: {
      usd: Math.round(totalUsd * 1e6) / 1e6,
      inTok: totalInTok,
      outTok: totalOutTok,
      runs: totalRuns,
      cards: store.listCards().length,
    },
  }
}
