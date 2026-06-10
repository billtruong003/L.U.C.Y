import { useEffect, useRef, useState } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import Tasks from './components/Tasks'
import Schedule from './components/Schedule'
import Projects from './components/Projects'
import ProjectsView from './components/ProjectsView'
import BrainViz from './components/BrainViz'
import Aki from './components/Aki'
import Logs from './components/Logs'
import Settings from './components/Settings'
import Draw from './components/Draw'
import { me, amState, amTrashProject, amCreateProject, type AmProject } from './api'
import { showToast } from './toast'

const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬', sub: 'Trò chuyện & ra lệnh' },
  { id: 'workspace', label: 'Dự án', icon: '🗂️', sub: 'Kanban · Lucy · Channels' },
  { id: 'tasks', label: 'Tasks', icon: '⚙️', sub: 'Việc đang chạy' },
  { id: 'schedule', label: 'Schedule', icon: '🗓️', sub: 'Đặt lịch tự chạy' },
  { id: 'projects', label: 'Mã nguồn', icon: '📁', sub: 'Cây mã nguồn' },
  { id: 'brain', label: 'Neural', icon: '🧠', sub: 'Bản đồ não Lucy' },
  { id: 'draw', label: 'Draw', icon: '✏️', sub: 'Canvas vẽ tay' },
  { id: 'aki', label: 'Aki', icon: '📣', sub: 'Đẩy báo cáo Discord' },
  { id: 'logs', label: 'Logs', icon: '📜', sub: 'Nhật ký hệ thống' },
  { id: 'settings', label: 'Settings', icon: '🔐', sub: 'Bảo mật 2FA' },
]

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tab, setTab] = useState('workspace')
  const [open, setOpen] = useState(false)   // sidebar drawer (mobile)

  // project list for sidebar "note list"
  const [projects, setProjects] = useState<AmProject[]>([])
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [newProjName, setNewProjName] = useState('')
  const [showNewProj, setShowNewProj] = useState(false)
  const newProjRef = useRef<HTMLInputElement>(null)

  useEffect(() => { me().then((d) => setAuthed(d.authed)).catch(() => setAuthed(false)) }, [])

  useEffect(() => {
    const fetchProjects = () =>
      amState().then((s) => setProjects((s.projects || []).filter((p) => !p.trashed))).catch(() => { /* */ })
    fetchProjects()
    const iv = setInterval(fetchProjects, 5000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (showNewProj) setTimeout(() => newProjRef.current?.focus(), 50)
  }, [showNewProj])

  if (authed === null) return <div className="h-[100dvh] grid place-items-center text-cyan mono bg-bg">…</div>
  if (!authed) return <Login onOk={() => setAuthed(true)} />

  const cur = TABS.find((t) => t.id === tab)!
  const pick = (id: string) => { setTab(id); setOpen(false) }

  const pickProject = (id: string) => {
    setOpenProjectId(id)
    setTab('workspace')
    setOpen(false)
  }

  const createProject = async () => {
    if (!newProjName.trim()) return
    try {
      await amCreateProject(newProjName.trim())
      setNewProjName('')
      setShowNewProj(false)
      const s = await amState()
      setProjects((s.projects || []).filter((p) => !p.trashed))
      showToast('Đã tạo note mới', 'success')
    } catch {
      showToast('Lỗi khi tạo note', 'error')
    }
  }

  const trashProject = async (id: string) => {
    const proj = projects.find((p) => p.id === id)
    try {
      await amTrashProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (openProjectId === id) setOpenProjectId(null)
      showToast(`Đã xóa "${proj?.name || 'note'}"`, 'info')
    } catch {
      showToast('Lỗi khi xóa note', 'error')
    }
  }

  return (
    <div className="h-[100dvh] flex bg-bg text-ink overflow-hidden">
      {/* overlay mobile — luôn render, fade in/out bằng opacity */}
      <div className={'fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-200 ' + (open ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={() => setOpen(false)} />

      {/* SIDEBAR */}
      <nav
        style={{ transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}
        className={'fixed md:static z-40 inset-y-0 left-0 w-60 shrink-0 flex flex-col border-r border-line bg-panel md:bg-panel/60 backdrop-blur ' +
          (open ? 'translate-x-0' : '-translate-x-full md:translate-x-0')}>

        {/* header */}
        <div className="px-5 pt-5 pb-4 border-b border-line flex items-center gap-2.5">
          <img src="/lucy.jpg" alt="Lucy" className="h-9 w-9 rounded-full object-cover shrink-0" style={{ border: '1px solid rgba(63,211,255,0.5)', boxShadow: '0 0 12px rgba(63,211,255,.45)' }} />
          <div className="flex-1 min-w-0">
            <div className="display text-cyan text-lg tracking-[0.32em] leading-none" style={{ textShadow: '0 0 12px rgba(63,211,255,.45)' }}>LUCY</div>
            <div className="text-[10px] text-inkfaint mt-1 tracking-wide">personal AI hub</div>
          </div>
          {/* close button — mobile only */}
          <button onClick={() => setOpen(false)} className="md:hidden text-inkfaint hover:text-ink transition text-lg !w-11 !h-11 flex items-center justify-center rounded" aria-label="Đóng sidebar">✕</button>
        </div>

        {/* nav items */}
        <div className="p-3 flex flex-col gap-0.5">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => pick(t.id)}
                className={'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-100 ' +
                  (on ? 'bg-cyan/10 text-ink' : 'text-inkdim hover:text-ink hover:bg-white/[0.05]')}>
                {on && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-cyan" style={{ boxShadow: '0 0 10px rgba(63,211,255,.8)' }} />}
                <span className={'text-base transition-transform ' + (on ? 'scale-110' : 'opacity-70 group-hover:opacity-100')}>{t.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className={'block text-[13px] font-semibold truncate ' + (on ? 'text-cyan' : '')}>{t.label}</span>
                  <span className="block text-[10px] text-inkfaint truncate">{t.sub}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* PROJECT NOTE LIST */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-line overflow-hidden">
          <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-inkfaint uppercase tracking-widest flex-1">Dự án</span>
            <button
              onClick={() => setShowNewProj((v) => !v)}
              className="text-inkfaint hover:text-cyan transition text-base leading-none w-5 h-5 flex items-center justify-center"
              title="Tạo dự án mới">+</button>
          </div>

          {/* create new project inline */}
          {showNewProj && (
            <div className="px-3 pb-2 flex gap-1 shrink-0">
              <input
                ref={newProjRef}
                className="input !py-1.5 text-[12px] flex-1"
                placeholder="Tên dự án…"
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createProject()
                  if (e.key === 'Escape') { setShowNewProj(false); setNewProjName('') }
                }}
              />
              <button className="btn btn-primary !py-1 !text-[11px] shrink-0" onClick={createProject} disabled={!newProjName.trim()}>Tạo</button>
            </div>
          )}

          {/* project list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {projects.length === 0 && !showNewProj ? (
              <div className="py-8 flex flex-col items-center gap-2 text-center px-3">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-inkfaint opacity-40 shrink-0">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                <div className="text-[13px] font-medium text-inkdim leading-snug">Chưa có note nào</div>
                <div className="text-[11px] text-inkfaint leading-snug">Nhấn + để tạo note đầu tiên</div>
                <button className="btn btn-primary !py-1.5 !px-4 !text-[12px] mt-1" onClick={() => setShowNewProj(true)}>Tạo note</button>
              </div>
            ) : (
              projects.map((p, idx) => {
                const isActive = tab === 'workspace' && openProjectId === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => pickProject(p.id)}
                    style={{ animationDelay: `${idx * 30}ms` }}
                    className={'note-item group relative flex items-center gap-2 rounded-lg px-2 py-1.5 min-h-[44px] cursor-pointer transition-colors duration-100 select-none ' +
                      (isActive ? 'bg-cyan/10' : 'hover:bg-white/[0.05]')}>
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r bg-cyan" style={{ boxShadow: '0 0 8px rgba(63,211,255,.7)' }} />}
                    <span className="text-sm shrink-0 opacity-80">📁</span>
                    <span className={'text-[12px] truncate flex-1 ' + (isActive ? 'text-cyan font-medium' : 'text-inkdim group-hover:text-ink')}>{p.name}</span>
                    {p.repoUrl && <span className="chip !py-0 !px-1 !text-[9px] text-cyan shrink-0 opacity-70 group-hover:opacity-100">repo</span>}
                    <button
                      className="shrink-0 text-inkfaint hover:text-pink opacity-0 group-hover:opacity-100 transition text-[12px] w-5 h-5 flex items-center justify-center rounded"
                      title="Xoá dự án"
                      onClick={(e) => { e.stopPropagation(); trashProject(p.id) }}>
                      🗑
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* status bar */}
        <div className="p-4 border-t border-line flex items-center gap-2 text-[11px] text-inkdim shrink-0">
          <span className="h-2 w-2 rounded-full bg-grn" style={{ boxShadow: '0 0 8px #5fe39a' }} />
          online · claude engine
        </div>
      </nav>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-line bg-panel/30">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setOpen(true)} className="btn btn-icon md:hidden !w-11 !h-11 shrink-0">☰</button>
            <span className="text-lg shrink-0">{cur.icon}</span>
            <div className="min-w-0">
              <div className="display text-sm tracking-[0.18em] text-ink leading-none truncate">{cur.label.toUpperCase()}</div>
              <div className="text-[11px] text-inkfaint mt-0.5 truncate">{cur.sub}</div>
            </div>
          </div>
          <span className="chip shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-cyan" /> Lucy</span>
        </header>

        <section className="flex-1 min-h-0 relative">
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'chat' ? '' : 'opacity-0 pointer-events-none')}><Chat /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'workspace' ? '' : 'opacity-0 pointer-events-none')}>
            <ProjectsView openProjectId={openProjectId} onOpenProjectChange={setOpenProjectId} />
          </div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'tasks' ? '' : 'opacity-0 pointer-events-none')}><Tasks /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'schedule' ? '' : 'opacity-0 pointer-events-none')}><Schedule /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'projects' ? '' : 'opacity-0 pointer-events-none')}><Projects /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'brain' ? '' : 'opacity-0 pointer-events-none')}><BrainViz visible={tab === 'brain'} /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'draw' ? '' : 'opacity-0 pointer-events-none')}><Draw /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'aki' ? '' : 'opacity-0 pointer-events-none')}><Aki /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'logs' ? '' : 'opacity-0 pointer-events-none')}><Logs /></div>
          <div className={'absolute inset-0 transition-opacity duration-150 ' + (tab === 'settings' ? '' : 'opacity-0 pointer-events-none')}><Settings /></div>
        </section>
      </main>
    </div>
  )
}
