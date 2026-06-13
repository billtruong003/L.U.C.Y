import { useEffect, useMemo, useState } from 'react'
import { metricsData, amState, errorStatsData, brainState, llmGuard, type MetricsData, type AmCard, type AmPersona, type AmMsg, type BrainSig, type ErrorStatsData, type ErrorCategory, type GuardData } from '../api'

// ── Overview helpers ─────────────────────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}
function fmtUsd(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1) return '$' + n.toFixed(3)
  return '$' + n.toFixed(4)
}
function pct(v: number, total: number): number {
  return !total ? 0 : Math.min(100, Math.round((v / total) * 100))
}

const EMPTY_METRICS: MetricsData = {
  configured: false, tokenDay: 0, tokenMonth: 0, costDay: 0, costMonth: 0,
  costByModel: [], costByAgent: [], costByCard: [], cardsRunning: 0, cardsWaiting: 0, cardsTotal: 0,
  providers: [], alerts: [],
}

const EMPTY_ERROR_STATS: ErrorStatsData = {
  configured: false, total: 0, byCategory: [], byAgent: [], byModel: [], topCategory: null, scope: '',
}

// Nhãn + màu theo nhóm lỗi (khớp ErrorCategory union ở api.ts / error-stats.ts).
const ERR_CAT_LABEL: Record<ErrorCategory, string> = {
  'llm-error': 'LLM lỗi', 'out-of-turns': 'Hết lượt', 'salvage': 'Salvage', 'build-fail': 'Build',
  'spec-fail': 'Test/Spec', 'loop': 'Lặp', 'wrong-output': 'Output sai', 'other': 'Khác',
}
const ERR_CAT_COLOR: Record<ErrorCategory, string> = {
  'llm-error': 'var(--red)', 'out-of-turns': '#ff9d5c', 'salvage': 'var(--grn)', 'build-fail': '#b78cff',
  'spec-fail': 'var(--pink)', 'loop': 'var(--cyan)', 'wrong-output': '#46c6ec', 'other': '#8a93a6',
}

// ── Insights helpers ─────────────────────────────────────────────────────────
type ReportKind = 'fail' | 'rework' | 'decision' | 'done' | 'working'

type EnrichedReport = {
  ts: number
  personaId: string
  personaName: string
  personaModel: string
  personaAvatar: string | undefined
  cardId: string
  cardTitle: string
  stage: string
  text: string
  kind: ReportKind
}

type AgentStat = {
  personaId: string
  name: string
  model: string
  avatar: string | undefined
  failCount: number
  reworkCount: number
  decisionCount: number
  doneCount: number
  totalReports: number
}

const KIND_COLOR: Record<ReportKind, string> = {
  fail:     'var(--red)',
  rework:   '#ff9d5c',
  decision: 'var(--pink)',
  done:     'var(--grn)',
  working:  'var(--cyan)',
}
const KIND_LABEL: Record<ReportKind, string> = {
  fail: 'FAIL', rework: 'REWORK', decision: 'ASK', done: 'DONE', working: 'RAN',
}

function classifyReport(
  r: NonNullable<AmCard['reports']>[number],
  card: AmCard,
): ReportKind {
  const isLast = card.reports?.[card.reports.length - 1] === r
  if (isLast && card.status === 'failed') return 'fail'
  if (isLast && card.status === 'done') return 'done'
  const hist = card.history ?? []
  if (hist.some(h => (h.event === 'reject-rework' || h.event === 'rework') && h.stage === r.stage && h.ts >= r.ts)) return 'rework'
  if (hist.some(h => h.event === 'needs_decision' && h.stage === r.stage && h.ts >= r.ts)) return 'decision'
  return 'working'
}

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function PersonaDot({ name, size = 16 }: { name: string; size?: number }) {
  const pal = ['#3fd3ff', '#5fe39a', '#ff9d5c', '#b78cff', '#46c6ec']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return (
    <span className="rounded-full inline-block shrink-0"
      style={{ width: size, height: size, background: pal[h % pal.length] }} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [innerTab, setInnerTab] = useState<'overview' | 'insights' | 'lucy'>('overview')

  // Overview data
  const [data, setData] = useState<MetricsData>(EMPTY_METRICS)
  const [oLoading, setOLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(0)
  const [guard, setGuard] = useState<GuardData | null>(null) // D4: rate-guard + quota

  // Insights data
  const [cards, setCards] = useState<AmCard[]>([])
  const [personas, setPersonas] = useState<AmPersona[]>([])
  const [iLoading, setILoading] = useState(true)
  const [iOffline, setIOffline] = useState(false)
  const [iConfigured, setIConfigured] = useState(true)
  const [modelFilter, setModelFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  // Error-stats (turn-log) — nguồn KHÁC card-report, đọc qua /api/error-stats
  const [errorStats, setErrorStats] = useState<ErrorStatsData>(EMPTY_ERROR_STATS)

  // 🌙 "Cho Lucy" — channels (nhật ký trực đêm) + brain inbox (hôm nay học gì)
  const [channels, setChannels] = useState<AmMsg[]>([])
  const [brainInbox, setBrainInbox] = useState<BrainSig[]>([])
  const loadLucy = async () => { try { const b = await brainState(); setBrainInbox(b.inbox ?? []) } catch { /* giữ state cũ */ } }

  const loadOverview = () => {
    metricsData()
      .then((d) => { setData(d); setLastRefresh(Date.now()) })
      .catch(() => {})
      .finally(() => setOLoading(false))
    llmGuard().then(setGuard).catch(() => {}) // D4: rate-guard + quota
  }

  const loadInsights = async () => {
    try {
      const s = await amState()
      if (!s.configured) { setIConfigured(false); setILoading(false); return }
      setIOffline(!!s.offline)
      setCards(s.cards ?? [])
      setPersonas(s.personas ?? [])
      setChannels(s.channels ?? [])
    } catch {
      setIOffline(true)
    } finally {
      setILoading(false)
    }
  }

  const loadErrorStats = async () => {
    try { setErrorStats(await errorStatsData()) } catch { /* giữ state cũ */ }
  }

  useEffect(() => {
    loadOverview()
    loadInsights()
    loadErrorStats()
    loadLucy()
    const iv1 = setInterval(loadOverview, 12_000)
    const iv2 = setInterval(() => { loadInsights(); loadErrorStats() }, 10_000)
    const iv3 = setInterval(loadLucy, 30_000)
    return () => { clearInterval(iv1); clearInterval(iv2); clearInterval(iv3) }
  }, [])

  // ── Insights computed ──────────────────────────────────────────────────────
  const personaMap = useMemo(() => new Map(personas.map(p => [p.name, p])), [personas])

  const allReports = useMemo((): EnrichedReport[] => {
    const out: EnrichedReport[] = []
    for (const card of cards) {
      if (!card.reports?.length) continue
      for (const r of card.reports) {
        const p = personaMap.get(r.persona)
        if (!p) continue
        out.push({
          ts: r.ts,
          personaId: r.persona,
          personaName: p.name,
          personaModel: p.model ?? 'unknown',
          personaAvatar: p.avatar,
          cardId: card.id,
          cardTitle: card.title,
          stage: r.stage,
          text: r.text,
          kind: classifyReport(r, card),
        })
      }
    }
    return out.sort((a, b) => b.ts - a.ts)
  }, [cards, personaMap])

  const models = useMemo(() => {
    const ms = new Set<string>()
    for (const r of allReports) ms.add(r.personaModel)
    return ['all', ...ms]
  }, [allReports])

  const filteredReports = useMemo(() => allReports.filter(r => {
    if (modelFilter !== 'all' && r.personaModel !== modelFilter) return false
    if (agentFilter && r.personaId !== agentFilter) return false
    return true
  }), [allReports, modelFilter, agentFilter])

  const agentStats = useMemo((): AgentStat[] => {
    const map = new Map<string, AgentStat>()
    for (const r of allReports) {
      if (modelFilter !== 'all' && r.personaModel !== modelFilter) continue
      if (!map.has(r.personaId)) {
        map.set(r.personaId, {
          personaId: r.personaId, name: r.personaName, model: r.personaModel,
          avatar: r.personaAvatar, failCount: 0, reworkCount: 0, decisionCount: 0,
          doneCount: 0, totalReports: 0,
        })
      }
      const s = map.get(r.personaId)!
      s.totalReports++
      if (r.kind === 'fail') s.failCount++
      else if (r.kind === 'rework') s.reworkCount++
      else if (r.kind === 'decision') s.decisionCount++
      else if (r.kind === 'done') s.doneCount++
    }
    return [...map.values()].sort((a, b) => (b.failCount + b.reworkCount) - (a.failCount + a.reworkCount))
  }, [allReports, modelFilter])

  const maxErrors = useMemo(
    () => Math.max(1, ...agentStats.map(s => s.failCount + s.reworkCount)),
    [agentStats],
  )

  const toggleExpand = (key: string) =>
    setExpandedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // ── Overview ───────────────────────────────────────────────────────────────
  const maxModelUsd = Math.max(...data.costByModel.map(m => m.usd), 0.0001)
  const maxAgentUsd = Math.max(...data.costByAgent.map(a => a.usd), 0.0001)
  const elapsed = lastRefresh ? Math.round((Date.now() - lastRefresh) / 1000) : null

  const totalFail   = agentStats.reduce((a, s) => a + s.failCount, 0)
  const totalRework = agentStats.reduce((a, s) => a + s.reworkCount, 0)
  const totalDone   = agentStats.reduce((a, s) => a + s.doneCount, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── inner tab bar ── */}
      <div className="tabs shrink-0">
        <button className={'tab-btn' + (innerTab === 'overview' ? ' active' : '')} onClick={() => setInnerTab('overview')}>
          <span className="tab-icon">📈</span> Overview
        </button>
        <button className={'tab-btn' + (innerTab === 'insights' ? ' active' : '')} onClick={() => setInnerTab('insights')}>
          <span className="tab-icon">🔬</span> Agent Insights
        </button>
        <button className={'tab-btn' + (innerTab === 'lucy' ? ' active' : '')} onClick={() => setInnerTab('lucy')}>
          <span className="tab-icon">🌙</span> Cho Lucy
        </button>
      </div>

      {/* ────────────────────────────── OVERVIEW ────────────────────────────── */}
      {innerTab === 'overview' && (
        <div className="flex-1 overflow-auto px-5 py-5">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">

            <div className="flex items-center gap-2.5">
              <span className="display text-sm tracking-[0.2em] text-inkdim uppercase">Dashboard</span>
              <span className="chip">
                <span className={'h-1.5 w-1.5 rounded-full ' + (oLoading ? 'bg-inkfaint' : data.offline ? 'bg-pink' : 'bg-grn')}
                  style={oLoading ? undefined : { boxShadow: data.offline ? '0 0 8px rgba(255,93,158,.7)' : '0 0 8px rgba(95,227,154,.7)' }} />
                {oLoading ? 'đang tải…' : data.offline ? 'coordinator offline' : data.configured ? 'live' : 'unconfigured'}
              </span>
              <div className="flex-1" />
              {elapsed !== null && <span className="text-[11px] text-inkfaint mono">{elapsed}s ago</span>}
              <button className="btn !py-1 !px-3 !text-[12px]" onClick={loadOverview} disabled={oLoading}>↺ refresh</button>
            </div>

            {data.alerts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {data.alerts.map((a, i) => (
                  <div key={i} className={'flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] border ' +
                    (a.kind === 'cost' ? 'border-pink/40 bg-pink/5 text-pink' : 'border-yellow-500/40 bg-yellow-500/5 text-yellow-300')}>
                    <span className="text-base shrink-0">{a.kind === 'cost' ? '⚠' : '!'}</span>
                    {a.message}
                  </div>
                ))}
              </div>
            )}

            {data.tokenGuard?.configured && data.tokenGuard.status && (() => {
              const g = data.tokenGuard!.status!
              const col = g.hard ? '#ff6b6b' : g.soft ? '#ff9d5c' : '#5fe39a'
              const label = g.hard ? '⛔ DỪNG (chạm hard limit)' : g.soft ? '💰 TIẾT KIỆM (đã hạ executor rẻ)' : '✅ Bình thường'
              const pct = Math.min(100, Math.round((g.used / Math.max(1, g.hardLimit)) * 100))
              return (
                <div className="rounded-xl px-4 py-2.5 border" style={{ borderColor: col + '66', background: col + '12' }}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold" style={{ color: col }}>Token-guard hôm nay: {label}</span>
                    <span className="mono text-[11px] text-inkdim">{fmtTokens(g.used)} / mềm {fmtTokens(g.softLimit)} · cứng {fmtTokens(g.hardLimit)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: '#ffffff14' }}>
                    <div className="h-full rounded-full" style={{ width: pct + '%', background: col }} />
                  </div>
                </div>
              )
            })()}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Token / ngày', value: fmtTokens(data.tokenDay), sub: 'in + out hôm nay', accent: false },
                { label: 'Token / tháng', value: fmtTokens(data.tokenMonth), sub: 'cộng dồn tháng', accent: false },
                { label: 'Chi phí hôm nay', value: fmtUsd(data.costDay), sub: 'USD agent-machine', accent: data.costDay > 1 },
                { label: 'Chi phí tháng', value: fmtUsd(data.costMonth), sub: 'USD tháng này', accent: data.costMonth > 5 },
              ].map((s) => (
                <div key={s.label} className="card px-4 py-3.5">
                  <div className="text-[10px] text-inkfaint uppercase tracking-widest mb-1.5">{s.label}</div>
                  <div className={'display text-2xl font-bold leading-none ' + (s.accent ? 'text-pink' : 'text-cyan')}
                    style={s.accent ? { textShadow: '0 0 20px rgba(255,93,158,.5)' } : { textShadow: '0 0 20px rgba(63,211,255,.35)' }}>
                    {s.value}
                  </div>
                  <div className="text-[10px] text-inkfaint mt-1.5">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="card px-4 py-4">
                <div className="text-[10px] text-inkfaint uppercase tracking-widest mb-3">Models · Providers</div>
                {data.providers.length === 0 ? (
                  <div className="text-[12px] text-inkfaint py-2">
                    {data.configured ? 'Chưa có provider nào' : 'Agent-Machine chưa kết nối'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {data.providers.map((p) => (
                      <div key={p.provider} className="flex items-center gap-2.5">
                        <span className={'h-2 w-2 rounded-full shrink-0 ' + (p.hasKey ? 'bg-grn' : 'bg-red')}
                          style={{ boxShadow: p.hasKey ? '0 0 7px rgba(95,227,154,.7)' : '0 0 7px rgba(255,107,107,.6)' }} />
                        <span className="text-[13px] flex-1 truncate">{p.label}</span>
                        <span className={'mono text-[11px] ' + (p.hasKey ? 'text-grn' : 'text-inkfaint')}>
                          {p.hasKey ? 'alive' : 'dead'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* D4: rate-guard + quota free-tier */}
                {guard && (guard.guarded?.length > 0 || Object.keys(guard.quota || {}).length > 0) && (
                  <div className="mt-3 pt-3 border-t border-line flex flex-col gap-1.5">
                    {guard.guarded?.length > 0 ? guard.guarded.map((g) => (
                      <div key={g.provider} className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full shrink-0 bg-orange-400" style={{ boxShadow: '0 0 7px rgba(255,157,92,.7)' }} />
                        <span className="text-[12.5px] flex-1 truncate">⏸ {g.provider}</span>
                        <span className="mono text-[11px] text-orange-300">rate-limit · còn ~{Math.ceil(g.secondsLeft / 60)}′</span>
                      </div>
                    )) : <div className="text-[11.5px] text-grn">✓ không provider nào bị rate-limit</div>}
                    {Object.entries(guard.quota || {}).map(([prov, q]) => (
                      <div key={prov} className="flex items-center gap-2.5">
                        <span className="text-[11.5px] text-inkfaint flex-1 truncate">{prov} · quota</span>
                        <span className="mono text-[11px] text-inkdim">
                          {q.remainingRequests != null ? `${q.remainingRequests} req` : ''}{q.creditsRemainingUsd != null ? ` · $${q.creditsRemainingUsd.toFixed(2)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card px-4 py-4">
                <div className="text-[10px] text-inkfaint uppercase tracking-widest mb-3">Cost by Model</div>
                {data.costByModel.length === 0 ? (
                  <div className="text-[12px] text-inkfaint py-2">Chưa có ledger — chạy card đầu tiên để có số.</div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {data.costByModel.map((m) => (
                      <div key={m.model}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] text-ink flex-1 truncate">{m.model}</span>
                          <span className="mono text-[11px] text-cyan">{fmtUsd(m.usd)}</span>
                          <span className="mono text-[10px] text-inkfaint">{fmtTokens(m.tokens)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-cyan/60 transition-all duration-500"
                            style={{ width: pct(m.usd, maxModelUsd) + '%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card px-4 py-4">
                <div className="text-[10px] text-inkfaint uppercase tracking-widest mb-3">Cost by Agent</div>
                {data.costByAgent.length === 0 ? (
                  <div className="text-[12px] text-inkfaint py-2">Chưa có ledger — chạy card đầu tiên để có số.</div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {data.costByAgent.map((a) => (
                      <div key={a.agent}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] text-ink flex-1 truncate">{a.agent}</span>
                          <span className="mono text-[11px] text-cyan">{fmtUsd(a.usd)}</span>
                          <span className="mono text-[10px] text-inkfaint">{fmtTokens(a.tokens)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-cyan/60 transition-all duration-500"
                            style={{ width: pct(a.usd, maxAgentUsd) + '%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-inkfaint uppercase tracking-widest flex-1">Cards live</span>
                <span className="chip"><span className={'h-1.5 w-1.5 rounded-full ' + (data.cardsRunning ? 'bg-grn' : 'bg-inkfaint')} /> {data.cardsRunning} chạy</span>
                <span className="chip text-yellow-300">{data.cardsWaiting} chờ duyệt</span>
                <span className="chip">{data.cardsTotal} active</span>
              </div>
              {data.cardsTotal === 0 ? (
                <div className="text-[12px] text-inkfaint py-1">Không có card nào đang chạy.</div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {data.costByCard.map((c) => (
                    <div key={c.cardId} className="flex items-center gap-2.5 py-1.5 border-b border-line last:border-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan/60 shrink-0" />
                      <span className="text-[12px] text-ink flex-1 truncate" title={c.title}>{c.title}</span>
                      <span className="mono text-[11px] text-inkdim">{fmtUsd(c.usd)}</span>
                      <span className="mono text-[10px] text-inkfaint">{fmtTokens(c.tokens)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────── INSIGHTS ────────────────────────────── */}
      {innerTab === 'insights' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

          {/* filter bar */}
          <div className="shrink-0 px-4 sm:px-5 py-2.5 border-b border-line flex items-center gap-2 flex-wrap">
            {/* summary counts */}
            <span className="chip" style={{ color: 'var(--red)', borderColor: 'rgba(255,107,107,0.3)' }}>
              ✕ {totalFail} fail
            </span>
            <span className="chip" style={{ color: '#ff9d5c', borderColor: 'rgba(255,157,92,0.3)' }}>
              ↩ {totalRework} rework
            </span>
            <span className="chip" style={{ color: 'var(--grn)', borderColor: 'rgba(95,227,154,0.3)' }}>
              ✓ {totalDone} done
            </span>
            {iOffline && <span className="chip" style={{ color: 'var(--pink)', borderColor: 'rgba(255,93,158,0.3)' }}>offline</span>}

            {/* model filter */}
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-inkfaint tracking-[0.14em]">MODEL</span>
              {models.map(m => (
                <button key={m} onClick={() => setModelFilter(m)}
                  className={'chip transition cursor-pointer ' + (modelFilter === m ? '!text-cyan !border-cyan/50 bg-cyan/5' : 'hover:text-ink')}>
                  {m}
                </button>
              ))}
            </div>

            <button onClick={loadInsights} className="btn btn-icon !w-7 !h-7 shrink-0 text-xs" title="Làm mới">↺</button>
          </div>

          {iLoading ? (
            <div className="flex-1 grid place-items-center">
              <div className="flex flex-col items-center gap-3">
                <span className="h-4 w-4 rounded-full border-2 border-cyan border-t-transparent"
                  style={{ animation: 'lucy-spin .8s linear infinite' }} />
                <span className="mono text-inkfaint text-sm">Đang tải insights…</span>
              </div>
            </div>
          ) : !iConfigured ? (
            <div className="flex-1 grid place-items-center p-6">
              <div className="card p-8 text-center text-inkfaint text-sm max-w-sm">
                <div className="text-2xl mb-2">📋</div>
                Agent-Machine chưa cấu hình (AM_COORD_URL + AM_TOKEN).
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

            {/* PHÂN LOẠI LỖI (turn-log) — nguồn khác card-report */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-line">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] text-inkfaint tracking-[0.16em]">PHÂN LOẠI LỖI · TURN-LOG</span>
                <span className="chip !py-0 !text-[9.5px]">{errorStats.total}</span>
                {errorStats.offline && <span className="chip !py-0 !text-[9px]" style={{ color: 'var(--pink)', borderColor: 'rgba(255,93,158,0.3)' }}>offline</span>}
              </div>
              {errorStats.total === 0 ? (
                <div className="text-[11.5px] text-inkfaint">
                  Chưa có turn-log / runner lane chưa chạy.
                </div>
              ) : (
                <div className="flex gap-4 flex-wrap">
                  {/* bars byCategory */}
                  <div className="flex-1 min-w-[240px] flex flex-col gap-1.5">
                    {errorStats.byCategory.map((c) => {
                      const max = errorStats.byCategory[0]?.count || 1
                      const color = ERR_CAT_COLOR[c.category]
                      return (
                        <div key={c.category} className="flex items-center gap-2">
                          <span className="text-[10px] text-inkdim w-[68px] shrink-0">{ERR_CAT_LABEL[c.category]}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${(c.count / max) * 100}%`, background: color }} />
                          </div>
                          <span className="text-[11px] mono w-5 text-right shrink-0" style={{ color }}>{c.count}</span>
                        </div>
                      )
                    })}
                  </div>
                  {/* byModel gọn */}
                  <div className="w-[200px] shrink-0 flex flex-col gap-1">
                    <span className="text-[9px] text-inkfaint uppercase tracking-widest mb-0.5">Model lỗi</span>
                    {errorStats.byModel.slice(0, 6).map((m) => (
                      <div key={m.model} className="flex items-center gap-2">
                        <span className="text-[11px] text-inkdim truncate flex-1">{m.model}</span>
                        <span className="text-[11px] mono text-inkfaint shrink-0">{m.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {errorStats.scope && (
                <div className="text-[10px] text-inkfaint mt-2 leading-snug">⚠ {errorStats.scope}</div>
              )}
            </div>

            {/* two-panel layout */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

              {/* LEFT — agent error ranking */}
              <div className="w-[280px] xl:w-[320px] shrink-0 flex flex-col border-r border-line overflow-hidden">
                <div className="px-3 pt-3 pb-1.5 shrink-0 flex items-center gap-2">
                  <span className="text-[10px] text-inkfaint tracking-[0.16em] flex-1">TOP LỖI · AGENT</span>
                  {agentFilter && (
                    <button className="text-[10px] text-cyan hover:text-cyan-light" onClick={() => setAgentFilter(null)}>
                      ✕ bỏ lọc
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1.5">
                  {agentStats.length === 0 ? (
                    <div className="py-10 text-center text-inkfaint text-[12px] px-4">
                      Chưa có dữ liệu báo cáo agent nào.
                    </div>
                  ) : (
                    agentStats.map(s => {
                      const isSelected = agentFilter === s.personaId
                      const errorTotal = s.failCount + s.reworkCount
                      return (
                        <button key={s.personaId}
                          onClick={() => setAgentFilter(isSelected ? null : s.personaId)}
                          className={'card p-3 text-left w-full transition-colors ' +
                            (isSelected ? 'border-cyan/50 bg-cyan/5' : 'hover:border-cyan/20')}>

                          {/* name row */}
                          <div className="flex items-center gap-2 mb-2.5">
                            {s.avatar
                              ? <img src={s.avatar} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                              : <PersonaDot name={s.name} size={20} />
                            }
                            <span className="text-[12.5px] font-semibold text-ink truncate flex-1">
                              {s.name.replace(/·.*/, '').trim()}
                            </span>
                            <span className="chip !py-0 text-[9px] shrink-0">{s.model}</span>
                          </div>

                          {/* fail bar */}
                          {s.failCount > 0 && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] text-inkfaint w-10 shrink-0 uppercase tracking-wide">fail</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${(s.failCount / maxErrors) * 100}%`, background: 'var(--red)', boxShadow: '0 0 6px rgba(255,107,107,0.5)' }} />
                              </div>
                              <span className="text-[11px] mono w-4 text-right shrink-0" style={{ color: 'var(--red)' }}>{s.failCount}</span>
                            </div>
                          )}

                          {/* rework bar */}
                          {s.reworkCount > 0 && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] text-inkfaint w-10 shrink-0 uppercase tracking-wide">rework</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${(s.reworkCount / maxErrors) * 100}%`, background: '#ff9d5c', boxShadow: '0 0 6px rgba(255,157,92,0.4)' }} />
                              </div>
                              <span className="text-[11px] mono w-4 text-right shrink-0" style={{ color: '#ff9d5c' }}>{s.reworkCount}</span>
                            </div>
                          )}

                          {/* ask bar */}
                          {s.decisionCount > 0 && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] text-inkfaint w-10 shrink-0 uppercase tracking-wide">ask</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${(s.decisionCount / maxErrors) * 100}%`, background: 'var(--pink)' }} />
                              </div>
                              <span className="text-[11px] mono w-4 text-right shrink-0" style={{ color: 'var(--pink)' }}>{s.decisionCount}</span>
                            </div>
                          )}

                          {/* done bar (lighter, thinner) */}
                          {s.doneCount > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-inkfaint w-10 shrink-0 uppercase tracking-wide">done</span>
                              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${(s.doneCount / Math.max(s.totalReports, 1)) * 100}%`, background: 'var(--grn)', opacity: 0.5 }} />
                              </div>
                              <span className="text-[11px] mono w-4 text-right shrink-0 text-grn">{s.doneCount}</span>
                            </div>
                          )}

                          {errorTotal === 0 && s.doneCount === 0 && (
                            <div className="text-[11px] text-inkfaint mt-0.5">{s.totalReports} báo cáo</div>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* RIGHT — motive timeline */}
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="px-4 pt-3 pb-1.5 shrink-0 flex items-center gap-2">
                  <span className="text-[10px] text-inkfaint tracking-[0.16em]">MOTIVE TIMELINE</span>
                  <span className="chip !py-0 !text-[9.5px]">{filteredReports.length}</span>
                  {agentFilter && (
                    <span className="chip !text-cyan !border-cyan/40 !py-0 !text-[9.5px]">
                      {agentStats.find(s => s.personaId === agentFilter)?.name.replace(/·.*/, '').trim()}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
                  {filteredReports.length === 0 ? (
                    <div className="py-10 text-center text-inkfaint text-[12px]">
                      {allReports.length === 0
                        ? 'Chưa có báo cáo agent nào. Chạy một card để có dữ liệu.'
                        : 'Không có kết quả với bộ lọc hiện tại.'}
                    </div>
                  ) : (
                    filteredReports.map((r, i) => {
                      const key = `${r.cardId}-${r.ts}`
                      const expanded = expandedKeys.has(key)
                      const preview = r.text.length > 130 ? r.text.slice(0, 130) + '…' : r.text
                      const color = KIND_COLOR[r.kind]
                      return (
                        <div key={i} className="card !rounded-xl px-3 py-2.5 transition-colors"
                          style={r.kind === 'fail'
                            ? { borderColor: 'rgba(255,107,107,0.22)', background: 'rgba(255,107,107,0.035)' }
                            : r.kind === 'rework'
                              ? { borderColor: 'rgba(255,157,92,0.18)', background: 'rgba(255,157,92,0.025)' }
                              : undefined}>
                          <div className="flex items-start gap-2.5">
                            {/* persona avatar + kind stripe */}
                            <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                              {r.personaAvatar
                                ? <img src={r.personaAvatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                                : <PersonaDot name={r.personaName} size={16} />
                              }
                              <div className="w-0.5 min-h-[10px] flex-1 rounded-full"
                                style={{ background: color, opacity: 0.4 }} />
                            </div>

                            {/* content */}
                            <div className="flex-1 min-w-0">
                              {/* row 1: agent + outcome + time */}
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="text-[12px] font-semibold text-ink">
                                  {r.personaName.replace(/·.*/, '').trim()}
                                </span>
                                <span className="chip !py-0 !px-1.5 text-[9px] shrink-0"
                                  style={{ color, borderColor: `${color}44` }}>
                                  {KIND_LABEL[r.kind]}
                                </span>
                                <span className="text-[10px] text-inkfaint mono ml-auto shrink-0">
                                  {relTime(r.ts)} ago
                                </span>
                              </div>

                              {/* row 2: card + stage */}
                              <div className="text-[11.5px] text-inkdim truncate mb-1">
                                {r.cardTitle}
                                <span className="text-inkfaint"> · {r.stage}</span>
                              </div>

                              {/* row 3: motive text */}
                              <div className="text-[11px] text-inkfaint leading-relaxed">
                                {expanded ? r.text : preview}
                                {r.text.length > 130 && (
                                  <button className="ml-1.5 text-cyan hover:text-cyan-light text-[10px] transition"
                                    onClick={() => toggleExpand(key)}>
                                    {expanded ? 'thu gọn' : 'xem thêm'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────── CHO LUCY ──────────────────────────── */}
      {innerTab === 'lucy' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">

          {/* 🆘 B2 — Cần Bill (ưu tiên trên cùng) */}
          {(() => {
            const need = cards.filter((c) => c.status === 'waiting_human')
            const wk: Record<string, string> = { gate: '🔍 chờ duyệt', decision: '💬 agent hỏi', cost: '💰 vượt cap', loop: '🔁 lặp', stuck: '🧩 kẹt → triage', 'size-gate': '📦 task to → tách' }
            return (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3"><span className="text-base">🆘</span><span className="display text-[12px] tracking-[0.14em] text-pink">CẦN BILL</span><span className="chip !py-0 !px-1.5 text-[10px]">{need.length}</span></div>
                {need.length === 0 ? <div className="text-[12.5px] text-inkfaint">✅ Không có gì chờ — Lucy tự xoay được.</div> : (
                  <div className="flex flex-col gap-2">
                    {need.map((c) => (
                      <div key={c.id} className="rounded-lg border border-pink/25 bg-pink/5 px-3 py-2">
                        <div className="text-[12.5px] font-semibold text-ink leading-tight">{c.title}</div>
                        <div className="text-[11px] text-inkdim mt-0.5">{wk[c.waitKind || ''] || '⛔ chờ'} · {c.projectId}{c.pendingQuestion ? ' — ' + c.pendingQuestion.slice(0, 90) : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ⏳ B3 — Runway / nhịp đốt token */}
          {(() => {
            const used = data.tokenDay
            const soft = data.tokenGuard?.status?.softLimit ?? 0
            const d = new Date()
            const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
            const hoursElapsed = Math.max(0.15, (Date.now() - startOfDay) / 3_600_000)
            const ratePerHour = used / hoursElapsed
            const remaining = Math.max(0, soft - used)
            const etaH = ratePerHour > 0 && soft ? remaining / ratePerHour : Infinity
            const pct = soft ? Math.min(100, Math.round((used / soft) * 100)) : 0
            const overSoft = soft > 0 && used >= soft
            const col = overSoft ? '#ff9d5c' : pct > 80 ? '#ffcf5c' : '#5fe39a'
            return (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3"><span className="text-base">⏳</span><span className="display text-[12px] tracking-[0.14em] text-cyan">RUNWAY · NHỊP ĐỐT</span></div>
                {!soft ? <div className="text-[12.5px] text-inkfaint">Token-guard chưa cấu hình (chưa có soft-cap).</div> : (
                  <>
                    <div className="flex items-baseline justify-between text-[12.5px] mb-2">
                      <span className="text-inkdim">đốt <b className="text-ink mono">{fmtTokens(Math.round(ratePerHour))}</b>/giờ hôm nay</span>
                      <span className="text-inkdim">{overSoft ? <span style={{ color: col }}>💰 đã chạm soft-cap — đang tiết kiệm</span> : <>còn <b className="text-ink mono">{fmtTokens(remaining)}</b> tới soft · ETA <b className="text-ink mono">{etaH === Infinity ? '∞' : '~' + etaH.toFixed(1) + 'h'}</b></>}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#ffffff14' }}><div className="h-full rounded-full" style={{ width: pct + '%', background: col }} /></div>
                    <div className="text-[10.5px] text-inkfaint mt-1.5 mono">{fmtTokens(used)} / soft {fmtTokens(soft)} ({pct}%)</div>
                  </>
                )}
              </div>
            )
          })()}

          {/* 🌙 B1 — Nhật ký trực đêm (autopilot) */}
          {(() => {
            const log = channels.filter((m) => (m.text || '').includes('🌙') || m.author === 'Lucy').sort((a, b) => b.ts - a.ts).slice(0, 14)
            return (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3"><span className="text-base">🌙</span><span className="display text-[12px] tracking-[0.14em] text-[#b78cff]">NHẬT KÝ TRỰC ĐÊM</span><span className="chip !py-0 !px-1.5 text-[10px]">{log.length}</span></div>
                {log.length === 0 ? <div className="text-[12.5px] text-inkfaint">Chưa có hoạt động trực đêm nào gần đây.</div> : (
                  <div className="flex flex-col gap-1.5">
                    {log.map((m, i) => (
                      <div key={i} className="flex gap-2 text-[12px] leading-snug">
                        <span className="text-inkfaint mono shrink-0 text-[10.5px] pt-0.5">{new Date(m.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-inkdim">{(m.text || '').replace(/^🌙 Lucy trực đêm\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* 🧠 B4 — Hôm nay em học gì */}
          {(() => {
            const today = new Date().toISOString().slice(0, 10)
            const todayLearned = brainInbox.filter((s) => (s.created_at || '').slice(0, 10) === today)
            const show = todayLearned.length ? todayLearned : brainInbox.slice(-6).reverse()
            return (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3"><span className="text-base">🧠</span><span className="display text-[12px] tracking-[0.14em] text-grn">{todayLearned.length ? 'HÔM NAY EM HỌC' : 'GẦN ĐÂY EM HỌC'}</span><span className="chip !py-0 !px-1.5 text-[10px]">{show.length}</span></div>
                {show.length === 0 ? <div className="text-[12.5px] text-inkfaint">Chưa có signal mới — vault đang chờ dream gộp.</div> : (
                  <div className="flex flex-col gap-2">
                    {show.map((s, i) => (
                      <div key={i} className="rounded-lg border border-line px-3 py-2">
                        <div className="text-[12.5px] text-ink leading-snug">{s.signal === 'negative' ? '⚠️' : '✅'} {s.principle}</div>
                        <div className="text-[10.5px] text-inkfaint mt-0.5 mono">{s.topic} · {s.agent}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

        </div>
      )}

    </div>
  )
}
