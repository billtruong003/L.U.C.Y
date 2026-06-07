import { useEffect, useMemo, useRef, useState } from 'react'
import { amState, amSetLanes, amCreateCard, amApprove, amReject, type AmCard, type AmPipeline, type AmPersona } from '../api'

const STATUS: Record<string, { label: string; color: string; icon: string }> = {
  queued: { label: 'XẾP HÀNG', color: '#9fb4c9', icon: '◦' },
  working: { label: 'ĐANG CHẠY', color: '#3fd3ff', icon: '⏳' },
  waiting_human: { label: 'CHỜ BẠN DUYỆT', color: '#ff5d9e', icon: '⛔' },
  blocked: { label: 'HOLD', color: '#c9a85f', icon: '⏸' },
  done: { label: 'XONG', color: '#5fe39a', icon: '✓' },
  failed: { label: 'LỖI', color: '#ff6b6b', icon: '✕' },
}
const ORDER = ['queued', 'working', 'waiting_human', 'blocked', 'done', 'failed']
const EVENT_ICON: Record<string, string> = { created: '✚', 'enter-stage': '→', advance: '↑', done: '🏁', delegate: '📨', needs_decision: '⛔', fail: '✕', 'reject-rework': '↩', recovered: '♻' }

export default function Board() {
  const [cards, setCards] = useState<AmCard[]>([])
  const [pipes, setPipes] = useState<AmPipeline[]>([])
  const [personas, setPersonas] = useState<AmPersona[]>([])
  const [limits, setLimits] = useState<{ maxLanes?: number; queued?: number; inFlight?: number }>({})
  const [cfgState, setCfgState] = useState<'ok' | 'unconfigured' | 'offline'>('ok')
  const [sel, setSel] = useState<string | null>(null)
  const [proj, setProj] = useState('all')
  const [form, setForm] = useState({ title: '', brief: '', pipeline: 'course', project: '', open: false })
  const [lanes, setLanes] = useState('')
  const busy = useRef(false)

  const pull = async () => {
    if (busy.current) return; busy.current = true
    try {
      const s = await amState()
      if ((s as any).configured === false) { setCfgState('unconfigured'); return }
      setCfgState(s.offline ? 'offline' : 'ok')
      setCards(s.cards || []); setPipes(s.pipelines || []); setPersonas(s.personas || [])
      const lm = (s as any).limits || {}; setLimits(lm)
      if (!lanes && lm.maxLanes != null) setLanes(String(lm.maxLanes))
    } catch { /* */ } finally { busy.current = false }
  }
  useEffect(() => { pull(); const iv = setInterval(pull, 2000); return () => clearInterval(iv) }, [])

  const pipeMap = useMemo(() => new Map(pipes.map((p) => [p.id, p])), [pipes])
  const personaMap = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])
  const stageOf = (c: AmCard) => pipeMap.get(c.pipelineId)?.stages[c.stageIndex]
  const personaOf = (c: AmCard) => { const st = stageOf(c); return st ? personaMap.get(st.personaId) : undefined }
  const projects = useMemo(() => [...new Set(cards.map((c) => c.projectId || 'default'))].sort(), [cards])
  const shown = proj === 'all' ? cards : cards.filter((c) => (c.projectId || 'default') === proj)
  const waiting = shown.filter((c) => c.status === 'waiting_human')
  const selected = cards.find((c) => c.id === sel) || null

  const create = async () => { if (!form.title.trim()) return; const pj = form.project.trim() || (proj !== 'all' ? proj : 'default'); await amCreateCard(form.title.trim(), form.brief.trim(), form.pipeline.trim() || 'course', pj); setForm({ ...form, title: '', brief: '', open: false }); pull() }
  const approve = async (id: string) => { await amApprove(id); pull() }
  const reject = async (id: string, fb: string) => { await amReject(id, fb); pull() }
  const setLanesNow = async () => { const n = Number(lanes); if (n >= 1) { await amSetLanes(n); pull() } }

  if (cfgState === 'unconfigured') return <Empty icon="📋" msg="Agent-Machine chưa cấu hình — đặt AM_COORD_URL + AM_TOKEN cho hub server." />

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── header ── */}
      <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-line flex items-center gap-2 flex-wrap">
        <span className="chip"><span className={'h-1.5 w-1.5 rounded-full ' + (limits.inFlight ? 'bg-cyan' : 'bg-inkfaint')} /> {limits.inFlight ?? 0} chạy · {limits.queued ?? 0} chờ</span>
        {waiting.length > 0 && <span className="chip" style={{ color: '#ff5d9e', borderColor: '#ff5d9e55' }}>⛔ {waiting.length} cần bạn duyệt</span>}
        {cfgState === 'offline' && <span className="chip text-pink">coordinator offline</span>}
        <div className="ml-auto flex items-center gap-1.5 text-inkdim">
          <span className="text-[11px]">queue</span>
          <input className="input !w-12 text-center !py-1.5" value={lanes} onChange={(e) => setLanes(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setLanesNow()} title="số agent chạy song song (maxLanes)" />
          <button className="btn !py-1.5" onClick={setLanesNow}>set</button>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ ...form, open: !form.open })}>{form.open ? 'Đóng' : '+ Card'}</button>
      </div>

      {/* ── project selector (1 hệ, nhiều dự án) ── */}
      {projects.length > 0 && (
        <div className="shrink-0 px-4 sm:px-5 py-2 border-b border-line flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-inkfaint tracking-[0.16em] shrink-0 mr-1">DỰ ÁN</span>
          <button onClick={() => setProj('all')} className={'chip shrink-0 transition ' + (proj === 'all' ? '!text-cyan !border-cyan/50 bg-cyan/5' : 'hover:text-ink')}>Tất cả</button>
          {projects.map((p) => (
            <button key={p} onClick={() => setProj(p)} className={'chip shrink-0 transition ' + (proj === p ? '!text-cyan !border-cyan/50 bg-cyan/5' : 'hover:text-ink')}>{p}</button>
          ))}
        </div>
      )}

      {/* ── create form ── */}
      {form.open && (
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-line bg-panel/30 flex flex-col sm:flex-row gap-2">
          <input className="input sm:!w-56" placeholder="Tên việc…" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && create()} autoFocus />
          <input className="input flex-1" placeholder="Mô tả / brief…" value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <input className="input sm:!w-32" placeholder="dự án" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
          <select className="input sm:!w-40" value={form.pipeline} onChange={(e) => setForm({ ...form, pipeline: e.target.value })}>
            {pipes.length === 0 && <option value="">(chưa có pipeline)</option>}
            {pipes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={create}>Tạo</button>
        </div>
      )}

      {/* ── needs-you banner (nổi bật chỗ phải làm) ── */}
      {waiting.length > 0 && (
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b" style={{ borderColor: '#ff5d9e33', background: '#ff5d9e0c' }}>
          <div className="flex items-center gap-2 mb-2"><span className="text-pink text-sm font-semibold">🔔 Cần bạn quyết định</span></div>
          <div className="flex flex-col gap-2">
            {waiting.map((c) => (
              <div key={c.id} className="flex items-center gap-3 card !bg-black/20 px-3 py-2">
                <button className="text-left flex-1 min-w-0" onClick={() => setSel(c.id)}>
                  <div className="text-[13px] font-semibold text-ink truncate">{c.title}</div>
                  <div className="text-[12px] text-pink truncate">{c.pendingQuestion || 'cần duyệt để chạy tiếp'}</div>
                </button>
                <button className="btn btn-primary shrink-0" onClick={() => approve(c.id)}>✓ Duyệt</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── kanban + drawer ── */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-x-auto p-3 sm:p-4">
          <div className="h-full grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-3">
            {ORDER.map((s) => {
              const meta = STATUS[s]; const list = shown.filter((c) => c.status === s)
              if (s === 'failed' && list.length === 0) return null
              return (
                <div key={s} className="flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2.5 px-1 shrink-0">
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}88` }} />
                    <span className="display text-[10.5px] tracking-[0.18em]" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="chip !py-0 !px-1.5 text-[10px]">{list.length}</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-0.5">
                    {list.map((c) => {
                      const st = stageOf(c); const pr = personaOf(c)
                      const flag = c.status === 'waiting_human'
                      return (
                        <button key={c.id} onClick={() => setSel(c.id)} className="card p-3 text-left transition hover:border-cyan/40"
                          style={flag ? { borderColor: '#ff5d9e66', boxShadow: '0 0 0 1px #ff5d9e22' } : sel === c.id ? { borderColor: '#3fd3ff66' } : undefined}>
                          <div className="text-[13px] font-semibold text-ink leading-tight">{c.title}</div>
                          <div className="text-[11px] text-inkfaint mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{pipeMap.get(c.pipelineId)?.name || c.pipelineId}</span>
                            {st && <span className="text-inkdim">· {st.name}</span>}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[10.5px]">
                            {pr && <span className="flex items-center gap-1 text-inkdim"><Dot s={pr.name} /> {pr.name.replace(/·.*/, '').trim()}</span>}
                            <span className="text-inkfaint ml-auto mono">${c.cost?.usd?.toFixed(3) ?? '0'}</span>
                          </div>
                        </button>
                      )
                    })}
                    {list.length === 0 && <div className="text-[11px] text-inkfaint/60 px-1 py-2">—</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* detail drawer */}
        {selected && <Detail c={selected} stage={stageOf(selected)} persona={personaOf(selected)} pipeName={pipeMap.get(selected.pipelineId)?.name} personaMap={personaMap} onClose={() => setSel(null)} onApprove={() => approve(selected.id)} onReject={(fb) => reject(selected.id, fb)} />}
      </div>
    </div>
  )
}

function Detail({ c, stage, persona, pipeName, personaMap, onClose, onApprove, onReject }: { c: AmCard; stage: any; persona: any; pipeName?: string; personaMap: Map<string, AmPersona>; onClose: () => void; onApprove: () => void; onReject: (feedback: string) => void }) {
  const [fb, setFb] = useState('')
  const meta = STATUS[c.status]
  return (
    <div className="w-[330px] sm:w-[360px] shrink-0 border-l border-line bg-panel/40 backdrop-blur flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-line">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
        <span className="display text-[12px] tracking-[0.14em]" style={{ color: meta.color }}>{meta.label}</span>
        <button className="btn btn-icon !w-7 !h-7 ml-auto" onClick={onClose}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="text-[15px] font-semibold text-ink leading-tight">{c.title}</div>
        {c.brief && <div className="text-[12.5px] text-inkdim">{c.brief}</div>}

        <div className="grid grid-cols-2 gap-2 text-[11.5px]">
          <Field k="Dự án" v={c.projectId} />
          <Field k="Pipeline" v={pipeName || c.pipelineId} />
          <Field k="Stage" v={stage ? `${stage.name}${stage.gate ? ' 🔒' : ''}` : `#${c.stageIndex}`} />
          <Field k="Agent" v={persona?.name || '—'} />
          <Field k="Chi phí" v={`$${c.cost?.usd?.toFixed(4) ?? '0'}`} />
          {c.depth > 0 && <Field k="Delegate depth" v={String(c.depth)} />}
          {c.blockedBy?.length > 0 && <Field k="Đang chờ" v={`${c.blockedBy.length} việc con`} />}
        </div>

        {/* khối DUYỆT — rõ ràng chỗ phải làm */}
        {c.status === 'waiting_human' && (
          <div className="rounded-xl border p-3" style={{ borderColor: '#ff5d9e55', background: '#ff5d9e10' }}>
            <div className="text-[11px] text-pink font-semibold mb-1">⛔ Cần bạn quyết định</div>
            <div className="text-[13px] text-ink mb-2">{c.pendingQuestion || 'Duyệt để tiếp tục?'}</div>
            <textarea className="input w-full !h-auto mb-2 text-[12.5px]" rows={3}
              placeholder="Có vấn đề? Ghi yêu cầu / lỗi cần sửa rồi bấm 'Trả lại' — agent sẽ làm lại theo feedback…"
              value={fb} onChange={(e) => setFb(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={onApprove}>✓ Duyệt & tiếp</button>
              <button className="btn flex-1" style={{ borderColor: '#ff9d5c66', color: '#ff9d5c' }}
                onClick={() => onReject(fb)} title="Trả card về cho agent sửa theo feedback">↩ Trả lại sửa</button>
            </div>
          </div>
        )}

        {/* timeline */}
        <div>
          <div className="text-[10px] text-inkfaint tracking-[0.18em] mb-2">LỊCH SỬ</div>
          <div className="flex flex-col gap-1.5">
            {(c.history || []).slice().reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-[11.5px]">
                <span className="mono text-[9px] text-inkfaint w-12 shrink-0 mt-0.5">{new Date(h.ts).toISOString().slice(11, 19)}</span>
                <span className="shrink-0">{EVENT_ICON[h.event] || '·'}</span>
                <span className="text-inkdim break-words">{h.event}{h.stage && h.stage !== '-' ? ` · ${h.stage}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[9.5px] text-inkfaint tracking-wide">{k.toUpperCase()}</div><div className="text-ink truncate">{v}</div></div>
}
function Dot({ s }: { s: string }) {
  const pal = ['#3fd3ff', '#5fe39a', '#ff9d5c', '#b78cff', '#46c6ec']; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return <span className="h-2 w-2 rounded-full inline-block" style={{ background: pal[h % pal.length] }} />
}
function Empty({ icon, msg }: { icon: string; msg: string }) {
  return <div className="h-full grid place-items-center p-6"><div className="card p-8 text-center text-inkfaint text-sm max-w-md"><div className="text-2xl mb-2">{icon}</div>{msg}</div></div>
}
