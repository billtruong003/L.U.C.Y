import { useEffect, useMemo, useRef, useState } from 'react'
import { amState, type AmMsg } from '../api'

// màu/avatar theo "ai nói" — agent là thành viên của kênh (như Discord)
const AGENT_PALETTE = ['#3fd3ff', '#5fe39a', '#ff9d5c', '#b78cff', '#46c6ec', '#f5d76e']
function hashIdx(s: string, n: number) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % n }
function authorColor(a: string) { return a === 'bill' ? '#5fe39a' : a === 'engine' ? '#5e748b' : AGENT_PALETTE[hashIdx(a, AGENT_PALETTE.length)] }
function initials(a: string) { const t = a.replace(/·.*/, '').trim(); return (t[0] || '?').toUpperCase() }

export default function Channels() {
  const [msgs, setMsgs] = useState<AmMsg[]>([])
  const [cur, setCur] = useState<string>('coordination')
  const [configured, setConfigured] = useState(true)
  const [offline, setOffline] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const pull = async () => {
    if (busy.current) return; busy.current = true
    try { const s = await amState(); setConfigured(s.configured !== false); setOffline(!!s.offline); setMsgs(s.channels || []) } catch { /* */ } finally { busy.current = false }
  }
  useEffect(() => { pull(); const iv = setInterval(pull, 2000); return () => clearInterval(iv) }, [])

  const channels = useMemo(() => {
    const m = new Map<string, { count: number; title?: string }>()
    for (const x of msgs) {
      const e = m.get(x.channel) || { count: 0 }
      e.count++
      if (x.kind === 'system' && x.text.startsWith('+ card')) e.title = x.text.replace(/^\+ card "(.*?)".*/, '$1')
      m.set(x.channel, e)
    }
    const names = [...m.keys()].sort((a, b) => (a === 'coordination' ? -1 : b === 'coordination' ? 1 : a.localeCompare(b)))
    return names.map((n) => ({ name: n, ...m.get(n)! }))
  }, [msgs])

  useEffect(() => { if (channels.length && !channels.find((c) => c.name === cur)) setCur(channels[0].name) }, [channels, cur])
  const list = useMemo(() => msgs.filter((m) => m.channel === cur), [msgs, cur])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [list.length, cur])

  // thành viên đang nói trong kênh này
  const members = useMemo(() => {
    const s = new Set(list.filter((m) => m.author !== 'engine').map((m) => m.author))
    return [...s]
  }, [list])

  if (configured === false) return <Empty msg="Agent-Machine chưa cấu hình — đặt AM_COORD_URL cho hub server." />

  return (
    <div className="h-full flex overflow-hidden">
      {/* channel list */}
      <div className="w-48 shrink-0 border-r border-line bg-panel/40 overflow-y-auto p-2 flex flex-col gap-1">
        <div className="text-[10px] text-inkfaint tracking-[0.2em] px-2 py-1">KÊNH AGENT {offline && <span className="text-pink">· offline</span>}</div>
        {channels.length === 0 && <div className="text-[11px] text-inkfaint px-2">chưa có hội thoại</div>}
        {channels.map((c) => {
          const on = c.name === cur
          const label = c.name === 'coordination' ? '# coordination' : c.title ? '🧩 ' + c.title : '🧩 ' + c.name.slice(5, 13)
          return (
            <button key={c.name} onClick={() => setCur(c.name)}
              className={'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition ' + (on ? 'bg-cyan/10 text-cyan' : 'text-inkdim hover:text-ink hover:bg-white/[0.03]')}>
              <span className="truncate">{label}</span>
              <span className="text-[10px] text-inkfaint shrink-0 ml-1">{c.count}</span>
            </button>
          )
        })}
      </div>

      {/* conversation */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-11 shrink-0 flex items-center gap-3 px-4 border-b border-line">
          <span className="display tracking-[0.16em] text-[13px] text-ink">{cur === 'coordination' ? '# coordination' : '🧩 ' + (channels.find((c) => c.name === cur)?.title || cur)}</span>
          <div className="flex items-center gap-1 ml-auto">
            {members.map((a) => <span key={a} title={a} className="h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold" style={{ background: authorColor(a) + '22', color: authorColor(a), border: `1px solid ${authorColor(a)}55` }}>{initials(a)}</span>)}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
          {list.map((m, i) => <Row key={i} m={m} prev={list[i - 1]} />)}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}

function Row({ m, prev }: { m: AmMsg; prev?: AmMsg }) {
  const col = authorColor(m.author)
  const time = new Date(m.ts).toISOString().slice(11, 19)
  const sameAuthor = prev && prev.author === m.author && prev.kind !== 'decision' && m.kind !== 'decision' && m.ts - prev.ts < 60000

  // system lifecycle = mờ, 1 dòng nhỏ (không phải agent nói)
  if (m.kind === 'system') return (
    <div className="flex items-center gap-2 py-0.5 pl-11 text-[11px] text-inkfaint/70"><span className="mono text-[9px]">{time}</span><span>· {m.text}</span></div>
  )

  // decision = cần NGƯỜI -> nổi bật
  if (m.kind === 'decision') return (
    <div className="my-1 ml-11 rounded-lg border px-3 py-2" style={{ borderColor: '#ff5d9e66', background: '#ff5d9e10' }}>
      <div className="text-[11px] text-pink font-semibold">⛔ {m.author} cần quyết định</div>
      <div className="text-[12.5px] text-ink mt-0.5">{m.text.replace(/^⛔\s*(GATE|CẦN QUYẾT ĐỊNH):?\s*/i, '')}</div>
    </div>
  )

  // agent nói / handoff / report
  const isHandoff = m.kind === 'handoff'
  const isReport = m.kind === 'report'
  return (
    <div className={'flex items-start gap-2.5 ' + (sameAuthor ? 'mt-0' : 'mt-2')}>
      <div className="w-8 shrink-0 flex justify-center">
        {!sameAuthor && <span className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold mt-0.5" style={{ background: col + '22', color: col, border: `1px solid ${col}55` }}>{initials(m.author)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        {!sameAuthor && (
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold" style={{ color: col }}>{m.author}</span>
            <span className="text-[9px] text-inkfaint mono">{time}</span>
          </div>
        )}
        <div className={'text-[13px] leading-snug break-words ' + (isHandoff ? 'text-cyan font-medium' : isReport ? 'text-grn' : 'text-inkdim')}>
          {isHandoff && <span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] align-middle" style={{ background: '#3fd3ff18', color: '#7fe3ff', border: '1px solid #3fd3ff33' }}>handoff</span>}
          {m.text}
        </div>
      </div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-full grid place-items-center p-6"><div className="card p-5 max-w-md text-center text-inkdim text-sm">{msg}</div></div>
}
