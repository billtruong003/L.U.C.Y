import { useEffect, useState } from 'react'
import { jobs, type JobRow } from '../api'

export default function Tasks() {
  const [rows, setRows] = useState<JobRow[]>([])
  useEffect(() => {
    const f = () => jobs().then((d) => setRows(d.jobs || [])).catch(() => {})
    f(); const t = setInterval(f, 3000); return () => clearInterval(t)
  }, [])
  const live = rows.filter((r) => r.status === 'running').length
  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4 text-sm text-inkdim">
          <span className="chip"><span className={'h-1.5 w-1.5 rounded-full ' + (live ? 'bg-grn' : 'bg-inkfaint')} /> {live} đang chạy</span>
          <span className="chip">{rows.length} gần đây</span>
        </div>
        {rows.length === 0 && (
          <div className="card p-8 text-center text-inkfaint text-sm">
            <div className="text-2xl mb-2">⚙️</div>
            Chưa có task nào. Gửi tin ở tab <span className="text-cyan">Chat</span> → hiện ở đây.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {rows.map((j) => {
            const run = j.status === 'running'
            return (
              <div key={j.id} className="card px-4 py-3 flex items-center gap-3">
                <span className={'grid place-items-center h-7 w-7 rounded-full text-xs shrink-0 ' + (run ? 'text-grn' : 'text-cyan')}
                  style={{ background: run ? 'rgba(95,227,154,0.12)' : 'rgba(63,211,255,0.10)', animation: run ? 'lucy-pulse 1.4s infinite' : undefined }}>
                  {run ? '⏳' : '✓'}
                </span>
                <span className="mono text-[11px] text-inkdim w-14 shrink-0 uppercase">{j.model}</span>
                <span className="flex-1 truncate text-sm">{j.prompt || '(no prompt)'}</span>
                <span className="mono text-[11px] text-inkfaint shrink-0">{j.elapsed}s</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
