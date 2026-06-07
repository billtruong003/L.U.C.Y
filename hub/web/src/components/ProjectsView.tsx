// ProjectsView — mỗi dự án là 1 container: list/dashboard -> click vào workspace
// (3 tab: Kanban / Lucy / Channels). Repo URL -> agent clone & sửa repo thật.
import { useEffect, useMemo, useState } from 'react'
import { amState, amCreateProject, amTrashProject, amRestoreProject, amPurgeProject, type AmProject, type AmCard, type AmPipeline, type AmPersona, type AmMsg } from '../api'
import Board from './Board'
import Channels from './Channels'
import LucyChat from './LucyChat'
import FlowEditor from './FlowEditor'

export default function ProjectsView() {
  const [projects, setProjects] = useState<AmProject[]>([])
  const [cards, setCards] = useState<AmCard[]>([])
  const [pipes, setPipes] = useState<AmPipeline[]>([])
  const [personas, setPersonas] = useState<AmPersona[]>([])
  const [channels, setChannels] = useState<AmMsg[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [tab, setTab] = useState<'kanban' | 'lucy' | 'channels' | 'flow'>('kanban')
  const [configured, setConfigured] = useState(true)
  const [nf, setNf] = useState({ open: false, name: '', repoUrl: '', skill: '' })
  const [showTrash, setShowTrash] = useState(false)

  const pull = async () => {
    try { const s = await amState(); setConfigured(s.configured !== false); setProjects(s.projects || []); setCards(s.cards || []); setPipes(s.pipelines || []); setPersonas(s.personas || []); setChannels(s.channels || []) } catch { /* */ }
  }
  useEffect(() => { pull(); const iv = setInterval(pull, 3000); return () => clearInterval(iv) }, [])

  // dashboard per-project: đếm status + kinh phí + số agent tham gia
  const stats = useMemo(() => {
    const m = new Map<string, { total: number; cost: number; agents: Set<string>; byStatus: Record<string, number> }>()
    const get = (pid: string) => { let r = m.get(pid); if (!r) { r = { total: 0, cost: 0, agents: new Set(), byStatus: {} }; m.set(pid, r) } return r }
    for (const c of cards) { const r = get(c.projectId || 'default'); r.byStatus[c.status] = (r.byStatus[c.status] || 0) + 1; r.total++; r.cost += c.cost?.usd || 0 }
    const cardProj = new Map(cards.map((c) => ['card-' + c.id, c.projectId || 'default'] as const))
    for (const msg of channels) { const pid = cardProj.get(msg.channel); if (pid && msg.author !== 'engine' && msg.author !== 'bill') get(pid).agents.add(msg.author) }
    return m
  }, [cards, channels])

  const active_ = projects.filter((p) => !p.trashed)
  const trashed = projects.filter((p) => p.trashed)

  const createProject = async () => { if (!nf.name.trim()) return; await amCreateProject(nf.name.trim(), { repoUrl: nf.repoUrl.trim() || undefined, skill: nf.skill.trim() || undefined }); setNf({ open: false, name: '', repoUrl: '', skill: '' }); pull() }
  const trashProject = async (id: string) => { await amTrashProject(id); pull() }
  const restoreProject = async (id: string) => { await amRestoreProject(id); pull() }
  const purgeProject = async (id: string) => { await amPurgeProject(id); pull() }

  if (configured === false) return <div className="h-full grid place-items-center text-inkfaint text-sm p-6">Agent-Machine chưa cấu hình — đặt AM_COORD_URL + AM_TOKEN cho hub server.</div>

  // ── WORKSPACE 1 dự án ──
  const proj = projects.find((p) => p.id === active)
  if (active && proj) {
    const TABS = [{ k: 'kanban', label: '📋 Kanban' }, { k: 'lucy', label: '✨ Lucy' }, { k: 'channels', label: '💬 Channels' }, { k: 'flow', label: '🧩 Flow' }] as const
    const s = stats.get(proj.id)
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-line bg-panel/30">
          <div className="h-13 flex items-center gap-3 px-4 py-2">
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
              <button className="btn btn-icon !w-8 !h-8" title="ném dự án vào thùng rác" onClick={() => { trashProject(proj.id); setActive(null) }}>🗑</button>
            </div>
          </div>
          {/* dashboard strip: kinh phí + agent + task */}
          <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
            <Stat v={s?.total || 0} label="task" />
            {s?.byStatus.working ? <Stat v={s.byStatus.working} label="chạy" color="#3fd3ff" /> : null}
            {s?.byStatus.waiting_human ? <Stat v={s.byStatus.waiting_human} label="cần duyệt" color="#ff5d9e" /> : null}
            {s?.byStatus.done ? <Stat v={s.byStatus.done} label="xong" color="#5fe39a" /> : null}
            {s?.byStatus.failed ? <Stat v={s.byStatus.failed} label="lỗi" color="#ff6b6b" /> : null}
            <span className="chip !py-0.5 !text-[11px]"><b className="text-grn">${(s?.cost || 0).toFixed(3)}</b><span className="text-inkfaint ml-1">kinh phí</span></span>
            <span className="chip !py-0.5 !text-[11px]"><b className="text-cyan">{s?.agents.size || 0}</b><span className="text-inkfaint ml-1">agent tham gia</span></span>
          </div>
        </div>
        {/* giữ MOUNTED cả 3, ẩn bằng CSS -> đổi tab không mất state (vd chat Lucy) */}
        <div className="flex-1 min-h-0 relative">
          <div className={tab === 'kanban' ? 'absolute inset-0' : 'hidden'}><Board projectId={proj.id} /></div>
          <div className={tab === 'lucy' ? 'absolute inset-0' : 'hidden'}><LucyChat key={proj.id} project={proj.id} pipes={pipes} onCreated={pull} /></div>
          <div className={tab === 'channels' ? 'absolute inset-0' : 'hidden'}><Channels projectId={proj.id} /></div>
          <div className={tab === 'flow' ? 'absolute inset-0' : 'hidden'}><FlowEditor pipes={pipes} personas={personas} onChanged={pull} /></div>
        </div>
      </div>
    )
  }

  // ── DANH SÁCH dự án ──
  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="display text-[15px] tracking-[0.14em] text-ink">DỰ ÁN</div>
        <span className="text-[11px] text-inkfaint">{active_.length} dự án</span>
        {trashed.length > 0 && <button className={'chip !text-[11px] ' + (showTrash ? '!text-pink !border-pink/40' : 'text-inkdim hover:text-ink')} onClick={() => setShowTrash((v) => !v)}>🗑 Thùng rác {trashed.length}</button>}
        <button className="btn btn-primary ml-auto" onClick={() => setNf({ ...nf, open: !nf.open })}>{nf.open ? 'Đóng' : '+ Dự án'}</button>
      </div>

      {showTrash && trashed.length > 0 && (
        <div className="card p-3 mb-4" style={{ borderColor: '#ff5d9e33' }}>
          <div className="text-[11px] text-pink mb-2">🗑 Thùng rác — khôi phục, hoặc <b>xoá HẲN</b> (mất sạch card + workspace trên VPS, không hoàn tác)</div>
          <div className="flex flex-col gap-1.5">
            {trashed.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[12.5px]">
                <span className="text-inkdim flex-1 truncate">📁 {p.name}{p.repoUrl ? ' · repo' : ''}</span>
                <button className="btn !py-1 !text-[11px]" onClick={() => restoreProject(p.id)}>Khôi phục</button>
                <button className="btn !py-1 !text-[11px]" style={{ borderColor: '#ff6b6b66', color: '#ff8a8a' }} onClick={() => { if (confirm(`Xoá HẲN dự án "${p.name}"? Mất sạch card + workspace, KHÔNG hoàn tác.`)) purgeProject(p.id) }}>🔥 Xoá hẳn</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {nf.open && (
        <div className="card p-3 mb-4 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input className="input sm:!w-56" placeholder="Tên dự án…" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} autoFocus />
            <input className="input flex-1" placeholder="Repo URL (tuỳ chọn — agent sẽ CLONE & sửa repo thật)" value={nf.repoUrl} onChange={(e) => setNf({ ...nf, repoUrl: e.target.value })} />
            <button className="btn btn-primary shrink-0" onClick={createProject}>Tạo</button>
          </div>
          <textarea className="input w-full !h-auto text-[12px]" rows={3} placeholder="SKILL dự án (tuỳ chọn) — dán nguyên SKILL.md domain (vd Unity/Colyseus) để MỌI agent dự án này thành chuyên gia…" value={nf.skill} onChange={(e) => setNf({ ...nf, skill: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {active_.map((p) => {
          const s = stats.get(p.id)
          return (
            <div key={p.id} className="card p-4 text-left hover:border-cyan/40 transition cursor-pointer group" onClick={() => { setActive(p.id); setTab('kanban') }}>
              <div className="flex items-center gap-2">
                <span className="text-lg shrink-0">📁</span>
                <span className="text-[14px] font-semibold text-ink truncate">{p.name}</span>
                {p.repoUrl && <span className="chip !py-0 !px-1.5 !text-[9px] text-cyan shrink-0">repo</span>}
                <button className="text-inkfaint hover:text-pink text-[13px] ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition" title="ném vào thùng rác" onClick={(e) => { e.stopPropagation(); trashProject(p.id) }}>🗑</button>
              </div>
              {p.repoUrl && <div className="text-[10px] text-inkfaint truncate mt-1">{p.repoUrl}</div>}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <Stat v={s?.total || 0} label="task" />
                {s?.byStatus.working ? <Stat v={s.byStatus.working} label="chạy" color="#3fd3ff" /> : null}
                {s?.byStatus.waiting_human ? <Stat v={s.byStatus.waiting_human} label="cần duyệt" color="#ff5d9e" /> : null}
                {s?.byStatus.done ? <Stat v={s.byStatus.done} label="xong" color="#5fe39a" /> : null}
                {s && s.cost > 0 ? <span className="chip !py-0.5 !text-[10px]"><b className="text-grn">${s.cost.toFixed(2)}</b></span> : null}
                {s && s.agents.size > 0 ? <span className="chip !py-0.5 !text-[10px]"><b className="text-cyan">{s.agents.size}</b><span className="text-inkfaint ml-0.5">agent</span></span> : null}
              </div>
            </div>
          )
        })}
        {active_.length === 0 && <div className="text-inkfaint text-sm col-span-full p-8 text-center card">Chưa có dự án — bấm <b className="text-cyan">+ Dự án</b> để tạo (gắn repo URL để agent làm trên repo thật).</div>}
      </div>
    </div>
  )
}

function Stat({ v, label, color }: { v: number; label: string; color?: string }) {
  return <span className="chip !py-0.5 !text-[11px]"><b style={{ color: color || '#cfe0ee' }}>{v}</b> <span className="text-inkfaint ml-0.5">{label}</span></span>
}
