import { useEffect, useMemo, useRef, useState } from 'react'
import { amState, type AmMsg } from '../api'

const KIND: Record<string, { icon: string; color: string }> = {
  decision: { icon: '⛔', color: '#ff5d9e' },
  report: { icon: '🏁', color: '#5fe39a' },
  system: { icon: '·', color: '#9fb4c9' },
  status: { icon: '▸', color: '#3fd3ff' },
  chat: { icon: '💬', color: '#e7f1fb' },
}

export default function Channels() {
  const [msgs, setMsgs] = useState<AmMsg[]>([])
  const [cur, setCur] = useState<string>('coordination')
  const [configured, setConfigured] = useState(true)
  const [offline, setOffline] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const pull = async () => {
    if (busy.current) return; busy.current = true
    try { const s = await amState(); setConfigured(s.configured); setOffline(!!s.offline); setMsgs(s.channels || []) } catch { /* */ } finally { busy.current = false }
  }
  useEffect(() => { pull(); const iv = setInterval(pull, 2000); return () => clearInterval(iv) }, [])

  const channels = useMemo(() => {
    const set = new Map<string, number>()
    for (const m of msgs) set.set(m.channel, (set.get(m.channel) || 0) + 1)
    const names = [...set.keys()]
    names.sort((a, b) => (a === 'coordination' ? -1 : b === 'coordination' ? 1 : a.localeCompare(b)))
    return names.map((n) => ({ name: n, count: set.get(n) || 0 }))
  }, [msgs])

  useEffect(() => { if (channels.length && !channels.find((c) => c.name === cur)) setCur(channels[0].name) }, [channels, cur])
  const list = useMemo(() => msgs.filter((m) => m.channel === cur), [msgs, cur])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [list.length, cur])

  if (configured === false) return <Empty msg="Agent-Machine chưa cấu hình — đặt AM_COORD_URL cho hub server." />

  return (
    <div className="h-full flex overflow-hidden">
      {/* channel list */}
      <div className="w-44 shrink-0 border-r border-line bg-panel/40 overflow-y-auto p-2 flex flex-col gap-1">
        <div className="text-[10px] text-inkfaint tracking-[0.2em] px-2 py-1">KÊNH {offline && <span className="text-pink">· offline</span>}</div>
        {channels.length === 0 && <div className="text-[11px] text-inkfaint px-2">chưa có message</div>}
        {channels.map((c) => {
          const on = c.name === cur
          const label = c.name.startsWith('card-') ? '🧩 ' + c.name.slice(5, 13) : '# ' + c.name
          return (
            <button key={c.name} onClick={() => setCur(c.name)}
              className={'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition ' + (on ? 'bg-cyan/10 text-cyan' : 'text-inkdim hover:text-ink hover:bg-white/[0.03]')}>
              <span className="truncate">{label}</span>
              <span className="text-[10px] text-inkfaint shrink-0 ml-1">{c.count}</span>
            </button>
          )
        })}
      </div>

      {/* messages */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-10 shrink-0 flex items-center px-4 border-b border-line text-sm text-ink">
          <span className="display tracking-[0.18em] text-[13px]">{cur.startsWith('card-') ? cur : '#' + cur}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1.5">
          {list.map((m, i) => {
            const k = KIND[m.kind] || KIND.status
            return (
              <div key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
                <span className="text-inkfaint text-[10px] mt-0.5 w-12 shrink-0 mono">{new Date(m.ts).toISOString().slice(11, 19)}</span>
                <span className="shrink-0" style={{ color: k.color }}>{k.icon}</span>
                <span className="font-semibold shrink-0" style={{ color: m.author === 'bill' ? '#5fe39a' : m.author === 'engine' ? '#9fb4c9' : '#7fe3ff' }}>{m.author}</span>
                <span className="text-inkdim break-words">{m.text}</span>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="h-full grid place-items-center p-6"><div className="card p-5 max-w-md text-center text-inkdim text-sm">{msg}</div></div>
}
