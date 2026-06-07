import { useEffect, useRef, useState } from 'react'
import { amState, amConfig, amSetLanes, amCreateCard, amApprove, type AmCard } from '../api'

const COLS: { id: string; label: string; color: string }[] = [
  { id: 'queued', label: 'XẾP HÀNG', color: '#9fb4c9' },
  { id: 'working', label: 'ĐANG CHẠY', color: '#3fd3ff' },
  { id: 'waiting_human', label: 'CHỜ DUYỆT', color: '#ff5d9e' },
  { id: 'blocked', label: 'HOLD', color: '#c9a85f' },
  { id: 'done', label: 'XONG', color: '#5fe39a' },
  { id: 'failed', label: 'LỖI', color: '#ff6b6b' },
]

export default function Board() {
  const [cards, setCards] = useState<AmCard[]>([])
  const [cfg, setCfg] = useState<{ configured: boolean; offline?: boolean; maxLanes?: number; queued?: number; inFlight?: number }>({ configured: true })
  const [form, setForm] = useState({ title: '', brief: '', pipeline: 'course' })
  const [lanes, setLanes] = useState('')
  const busy = useRef(false)

  const pull = async () => {
    if (busy.current) return; busy.current = true
    try {
      const [s, c] = await Promise.all([amState(), amConfig()])
      setCfg(c)
      setCards(s.cards || [])
      if (!lanes && c.maxLanes != null) setLanes(String(c.maxLanes))
    } catch { /* */ } finally { busy.current = false }
  }
  useEffect(() => { pull(); const iv = setInterval(pull, 2000); return () => clearInterval(iv) }, [])

  const create = async () => {
    if (!form.title.trim()) return
    await amCreateCard(form.title.trim(), form.brief.trim(), form.pipeline.trim() || 'course')
    setForm({ ...form, title: '', brief: '' }); pull()
  }
  const setLanesNow = async () => { const n = Number(lanes); if (n >= 1) { await amSetLanes(n); pull() } }

  if (cfg.configured === false) return <Empty msg="Agent-Machine chưa cấu hình — đặt AM_COORD_URL + AM_TOKEN cho hub server." />
  if (cfg.offline) return <Empty msg="Coordinator offline — kiểm tra coordinator có đang chạy không." />

  return (
    <div className="h-full flex flex-col p-3 sm:p-4 gap-3 overflow-hidden">
      {/* control bar */}
      <div className="card p-3 flex flex-wrap items-center gap-2 text-sm shrink-0">
        <input className="input !w-44" placeholder="Tên việc…" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <input className="input !w-56 flex-1 min-w-32" placeholder="Mô tả ngắn (brief)…" value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <input className="input !w-28" placeholder="pipeline" value={form.pipeline} onChange={(e) => setForm({ ...form, pipeline: e.target.value })} />
        <button className="btn btn-primary" onClick={create}>+ Card</button>
        <div className="flex items-center gap-1.5 ml-auto text-inkdim">
          <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-cyan" /> queue width</span>
          <input className="input !w-14 text-center" value={lanes} onChange={(e) => setLanes(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setLanesNow()} />
          <button className="btn !py-1.5" onClick={setLanesNow}>set</button>
          <span className="text-[11px] ml-1">⚡{cfg.inFlight ?? 0} chạy · {cfg.queued ?? 0} chờ</span>
        </div>
      </div>

      {/* kanban */}
      <div className="flex-1 min-h-0 grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3 overflow-x-auto">
        {COLS.map((col) => {
          const list = cards.filter((c) => c.status === col.id)
          return (
            <div key={col.id} className="flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2 px-1 shrink-0">
                <span className="display text-[11px] tracking-[0.2em]" style={{ color: col.color }}>{col.label}</span>
                <span className="chip !py-0 !px-1.5 text-[10px]">{list.length}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
                {list.map((c) => <CardView key={c.id} c={c} accent={col.color} onApprove={() => amApprove(c.id).then(pull)} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CardView({ c, accent, onApprove }: { c: AmCard; accent: string; onApprove: () => void }) {
  return (
    <div className="card p-2.5" style={{ borderColor: accent + '40' }}>
      <div className="text-[13px] font-semibold text-ink leading-tight">{c.title}</div>
      <div className="text-[10.5px] text-inkfaint mt-1 flex items-center gap-2 flex-wrap">
        <span>{c.pipelineId} · st{c.stageIndex}</span>
        <span>${c.cost?.usd?.toFixed(3) ?? '0'}</span>
        {c.depth > 0 && <span>↳d{c.depth}</span>}
        {c.blockedBy?.length > 0 && <span className="text-[#c9a85f]">⛓{c.blockedBy.length}</span>}
      </div>
      {c.status === 'waiting_human' && (
        <div className="mt-2">
          {c.pendingQuestion && <div className="text-[11px] text-pink mb-1.5">⛔ {c.pendingQuestion}</div>}
          <button className="btn btn-primary !py-1 !text-[12px] w-full" onClick={onApprove}>✓ Duyệt</button>
        </div>
      )}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-full grid place-items-center p-6"><div className="card p-5 max-w-md text-center text-inkdim text-sm">{msg}</div></div>
}
