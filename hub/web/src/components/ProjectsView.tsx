// ProjectsView — mỗi dự án là 1 container: list/dashboard -> click vào workspace
// (3 tab: Kanban / Lucy / Channels). Repo URL -> agent clone & sửa repo thật.
import { useEffect, useMemo, useState } from 'react'
import { amState, amCreateProject, amRemoveProject, type AmProject, type AmCard, type AmPipeline } from '../api'
import Board from './Board'
import Channels from './Channels'
import Planner from './Planner'

export default function ProjectsView() {
  const [projects, setProjects] = useState<AmProject[]>([])
  const [cards, setCards] = useState<AmCard[]>([])
  const [pipes, setPipes] = useState<AmPipeline[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [tab, setTab] = useState<'kanban' | 'lucy' | 'channels'>('kanban')
  const [configured, setConfigured] = useState(true)
  const [nf, setNf] = useState({ open: false, name: '', repoUrl: '' })

  const pull = async () => {
    try { const s = await amState(); setConfigured(s.configured !== false); setProjects(s.projects || []); setCards(s.cards || []); setPipes(s.pipelines || []) } catch { /* */ }
  }
  useEffect(() => { pull(); const iv = setInterval(pull, 3000); return () => clearInterval(iv) }, [])

  const counts = useMemo(() => {
    const m = new Map<string, Record<string, number>>()
    for (const c of cards) {
      const pid = c.projectId || 'default'
      const r = m.get(pid) || {}
      r[c.status] = (r[c.status] || 0) + 1; r.total = (r.total || 0) + 1
      m.set(pid, r)
    }
    return m
  }, [cards])

  const createProject = async () => { if (!nf.name.trim()) return; await amCreateProject(nf.name.trim(), nf.repoUrl.trim() || undefined); setNf({ open: false, name: '', repoUrl: '' }); pull() }
  const removeProject = async (id: string) => { await amRemoveProject(id); pull() }

  if (configured === false) return <div className="h-full grid place-items-center text-inkfaint text-sm p-6">Agent-Machine chưa cấu hình — đặt AM_COORD_URL + AM_TOKEN cho hub server.</div>

  // ── WORKSPACE 1 dự án ──
  const proj = projects.find((p) => p.id === active)
  if (active && proj) {
    const TABS = [{ k: 'kanban', label: '📋 Kanban' }, { k: 'lucy', label: '✨ Lucy' }, { k: 'channels', label: '💬 Channels' }] as const
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 h-13 flex items-center gap-3 px-4 py-2 border-b border-line bg-panel/30">
          <button className="btn btn-icon !w-8 !h-8 shrink-0" title="về danh sách dự án" onClick={() => setActive(null)}>←</button>
          <span className="text-lg shrink-0">📁</span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink truncate leading-tight">{proj.name}</div>
            {proj.repoUrl ? <a href={proj.repoUrl} target="_blank" rel="noreferrer" className="text-[10px] text-cyan hover:underline truncate block">{proj.repoUrl}</a> : <div className="text-[10px] text-inkfaint">workspace nháp (chưa gắn repo)</div>}
          </div>
          <div className="ml-auto flex gap-1 shrink-0">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={'btn !py-1.5 !text-[12px] ' + (tab === t.k ? 'btn-primary' : '')}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {tab === 'kanban' && <Board projectId={proj.id} />}
          {tab === 'lucy' && <div className="h-full overflow-auto"><Planner project={proj.id} pipes={pipes} onDone={() => { pull(); setTab('kanban') }} onClose={() => setTab('kanban')} /></div>}
          {tab === 'channels' && <Channels projectId={proj.id} />}
        </div>
      </div>
    )
  }

  // ── DANH SÁCH dự án ──
  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="display text-[15px] tracking-[0.14em] text-ink">DỰ ÁN</div>
        <span className="text-[11px] text-inkfaint">{projects.length} dự án</span>
        <button className="btn btn-primary ml-auto" onClick={() => setNf({ ...nf, open: !nf.open })}>{nf.open ? 'Đóng' : '+ Dự án'}</button>
      </div>
      {nf.open && (
        <div className="card p-3 mb-4 flex flex-col sm:flex-row gap-2">
          <input className="input sm:!w-56" placeholder="Tên dự án…" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && createProject()} autoFocus />
          <input className="input flex-1" placeholder="Repo URL (tuỳ chọn — agent sẽ CLONE & sửa repo thật)" value={nf.repoUrl} onChange={(e) => setNf({ ...nf, repoUrl: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && createProject()} />
          <button className="btn btn-primary" onClick={createProject}>Tạo</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((p) => {
          const c = counts.get(p.id) || {}
          return (
            <div key={p.id} className="card p-4 text-left hover:border-cyan/40 transition cursor-pointer group" onClick={() => { setActive(p.id); setTab('kanban') }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">📁</span>
                <span className="text-[14px] font-semibold text-ink truncate">{p.name}</span>
                {p.repoUrl && <span className="chip !py-0 !px-1.5 !text-[9px] text-cyan ml-auto shrink-0">repo</span>}
              </div>
              {p.repoUrl && <div className="text-[10px] text-inkfaint truncate mt-1">{p.repoUrl}</div>}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <Stat v={c.total || 0} label="tổng" />
                {c.working ? <Stat v={c.working} label="chạy" color="#3fd3ff" /> : null}
                {c.waiting_human ? <Stat v={c.waiting_human} label="cần duyệt" color="#ff5d9e" /> : null}
                {c.done ? <Stat v={c.done} label="xong" color="#5fe39a" /> : null}
                {c.failed ? <Stat v={c.failed} label="lỗi" color="#ff6b6b" /> : null}
                {(c.total || 0) === 0 && (
                  <button className="text-[10px] text-inkfaint hover:text-pink ml-auto" onClick={(e) => { e.stopPropagation(); removeProject(p.id) }}>xoá</button>
                )}
              </div>
            </div>
          )
        })}
        {projects.length === 0 && <div className="text-inkfaint text-sm col-span-full p-8 text-center card">Chưa có dự án — bấm <b className="text-cyan">+ Dự án</b> để tạo (gắn repo URL để agent làm trên repo thật).</div>}
      </div>
    </div>
  )
}

function Stat({ v, label, color }: { v: number; label: string; color?: string }) {
  return <span className="chip !py-0.5 !text-[11px]"><b style={{ color: color || '#cfe0ee' }}>{v}</b> <span className="text-inkfaint ml-0.5">{label}</span></span>
}
