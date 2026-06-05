import { useEffect, useState } from 'react'
import { jobs, type JobRow } from '../api'

export default function Tasks() {
  const [rows, setRows] = useState<JobRow[]>([])
  useEffect(() => {
    const f = () => jobs().then((d) => setRows(d.jobs || [])).catch(() => {})
    f()
    const t = setInterval(f, 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="h-full overflow-auto p-4">
      <h2 className="text-cyan text-lg mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>⚙️ RUNNING TASKS</h2>
      {rows.length === 0 && <div className="text-slate-500 text-sm">Chưa có task nào. Gửi tin ở tab Chat → hiện ở đây.</div>}
      <div className="flex flex-col gap-2">
        {rows.map((j) => (
          <div key={j.id} className="border border-cyan/20 p-2 text-sm flex items-center gap-3">
            <span className={j.status === 'running' ? 'text-pink animate-pulse' : 'text-cyan'}>
              {j.status === 'running' ? '⏳' : '✓'}
            </span>
            <span className="text-slate-400 w-14 shrink-0">{j.model}</span>
            <span className="flex-1 truncate">{j.prompt || '(no prompt)'}</span>
            <span className="text-slate-500 text-xs shrink-0">{j.elapsed}s</span>
          </div>
        ))}
      </div>
    </div>
  )
}
