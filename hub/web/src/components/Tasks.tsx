import { useEffect, useState } from 'react'
import { jobs, poll, type JobRow } from '../api'
import Markdown from './Markdown'

export default function Tasks() {
  const [rows, setRows] = useState<JobRow[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>>({}) // id -> result (đã tải). Thiếu key = chưa tải.
  useEffect(() => {
    const f = async () => {
      try { const d = await jobs(); setRows(d.jobs || []) } catch { /* */ }
      if (openId) { try { const p = await poll(openId); setResults((r) => ({ ...r, [openId]: p.result || '' })) } catch { /* */ } } // C3: job đang mở -> cập nhật result live
    }
    f(); const t = setInterval(f, 3000); return () => clearInterval(t)
  }, [openId])

  // C3: mở 1 task -> tải full kết quả (poll trả result) -> render Markdown có cách dòng
  const toggle = async (j: JobRow) => {
    if (openId === j.id) { setOpenId(null); return }
    setOpenId(j.id)
    try { const p = await poll(j.id); setResults((r) => ({ ...r, [j.id]: p.result || '' })) }
    catch { setResults((r) => ({ ...r, [j.id]: '' })) }
  }

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
            const isOpen = openId === j.id
            const res = results[j.id]
            return (
              <div key={j.id} className="card overflow-hidden">
                <button className="w-full px-4 py-3 flex items-center gap-3 text-left" onClick={() => toggle(j)}>
                  <span className={'grid place-items-center h-7 w-7 rounded-full text-xs shrink-0 ' + (run ? 'text-grn' : 'text-cyan')}
                    style={{ background: run ? 'rgba(95,227,154,0.12)' : 'rgba(63,211,255,0.10)', animation: run ? 'lucy-pulse 1.4s infinite' : undefined }}>
                    {run ? '⏳' : '✓'}
                  </span>
                  <span className="mono text-[11px] text-inkdim w-14 shrink-0 uppercase">{j.model}</span>
                  <span className={'flex-1 text-sm ' + (isOpen ? 'break-words' : 'truncate')}>{j.prompt || '(no prompt)'}</span>
                  <span className="mono text-[11px] text-inkfaint shrink-0">{j.elapsed}s</span>
                  <span className="text-inkfaint text-[11px] shrink-0">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 border-t border-line max-h-[60vh] overflow-auto">
                    {res === undefined ? <div className="text-[12px] text-inkfaint py-2">đang tải kết quả…</div>
                      : res === '' ? <div className="text-[12px] text-inkfaint py-2">{run ? 'đang chạy — chưa có kết quả' : '(chưa có kết quả)'}</div>
                        : <Markdown>{res}</Markdown>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
