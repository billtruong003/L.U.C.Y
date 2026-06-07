import { useEffect, useState } from 'react'
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
import { me } from './api'

const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬', sub: 'Trò chuyện & ra lệnh' },
  { id: 'workspace', label: 'Dự án', icon: '🗂️', sub: 'Kanban · Lucy · Channels' },
  { id: 'tasks', label: 'Tasks', icon: '⚙️', sub: 'Việc đang chạy' },
  { id: 'schedule', label: 'Schedule', icon: '🗓️', sub: 'Đặt lịch tự chạy' },
  { id: 'projects', label: 'Mã nguồn', icon: '📁', sub: 'Cây mã nguồn' },
  { id: 'brain', label: 'Neural', icon: '🧠', sub: 'Bản đồ não Lucy' },
  { id: 'aki', label: 'Aki', icon: '📣', sub: 'Đẩy báo cáo Discord' },
  { id: 'logs', label: 'Logs', icon: '📜', sub: 'Nhật ký hệ thống' },
  { id: 'settings', label: 'Settings', icon: '🔐', sub: 'Bảo mật 2FA' },
]

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tab, setTab] = useState('workspace')
  const [open, setOpen] = useState(false)   // sidebar drawer (mobile)
  useEffect(() => { me().then((d) => setAuthed(d.authed)).catch(() => setAuthed(false)) }, [])

  if (authed === null) return <div className="h-[100dvh] grid place-items-center text-cyan mono bg-bg">…</div>
  if (!authed) return <Login onOk={() => setAuthed(true)} />

  const cur = TABS.find((t) => t.id === tab)!
  const pick = (id: string) => { setTab(id); setOpen(false) }

  return (
    <div className="h-[100dvh] flex bg-bg text-ink overflow-hidden">
      {/* overlay mobile */}
      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* SIDEBAR */}
      <nav className={'fixed md:static z-40 inset-y-0 left-0 w-60 shrink-0 flex flex-col border-r border-line bg-panel md:bg-panel/60 backdrop-blur transition-transform duration-200 ' +
        (open ? 'translate-x-0' : '-translate-x-full md:translate-x-0')}>
        <div className="px-5 pt-6 pb-5 border-b border-line">
          <div className="flex items-center gap-2.5">
            <img src="/lucy.jpg" alt="Lucy" className="h-9 w-9 rounded-full object-cover shrink-0" style={{ border: '1px solid rgba(63,211,255,0.5)', boxShadow: '0 0 12px rgba(63,211,255,.45)' }} />
            <div>
              <div className="display text-cyan text-lg tracking-[0.32em] leading-none" style={{ textShadow: '0 0 12px rgba(63,211,255,.45)' }}>LUCY</div>
              <div className="text-[10px] text-inkfaint mt-1 tracking-wide">personal AI hub</div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-1.5 overflow-auto">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => pick(t.id)}
                className={'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ' +
                  (on ? 'bg-cyan/10 text-ink' : 'text-inkdim hover:text-ink hover:bg-white/[0.03]')}>
                {on && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r bg-cyan" style={{ boxShadow: '0 0 10px rgba(63,211,255,.8)' }} />}
                <span className={'text-base transition-transform ' + (on ? 'scale-110' : 'opacity-70 group-hover:opacity-100')}>{t.icon}</span>
                <span className="flex-1">
                  <span className={'block text-sm font-semibold ' + (on ? 'text-cyan' : '')}>{t.label}</span>
                  <span className="block text-[10px] text-inkfaint">{t.sub}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="p-4 border-t border-line flex items-center gap-2 text-[11px] text-inkdim">
          <span className="h-2 w-2 rounded-full bg-grn" style={{ boxShadow: '0 0 8px #5fe39a' }} />
          online · claude engine
        </div>
      </nav>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-line bg-panel/30">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setOpen(true)} className="btn btn-icon md:hidden !w-9 !h-9 shrink-0">☰</button>
            <span className="text-lg shrink-0">{cur.icon}</span>
            <div className="min-w-0">
              <div className="display text-sm tracking-[0.18em] text-ink leading-none truncate">{cur.label.toUpperCase()}</div>
              <div className="text-[11px] text-inkfaint mt-0.5 truncate">{cur.sub}</div>
            </div>
          </div>
          <span className="chip shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-cyan" /> Lucy</span>
        </header>

        <section className="flex-1 min-h-0 relative">
          <div className={tab === 'chat' ? 'absolute inset-0' : 'hidden'}><Chat /></div>
          <div className={tab === 'workspace' ? 'absolute inset-0' : 'hidden'}><ProjectsView /></div>
          <div className={tab === 'tasks' ? 'absolute inset-0' : 'hidden'}><Tasks /></div>
          <div className={tab === 'schedule' ? 'absolute inset-0' : 'hidden'}><Schedule /></div>
          <div className={tab === 'projects' ? 'absolute inset-0' : 'hidden'}><Projects /></div>
          <div className={tab === 'brain' ? 'absolute inset-0' : 'hidden'}><BrainViz visible={tab === 'brain'} /></div>
          <div className={tab === 'aki' ? 'absolute inset-0' : 'hidden'}><Aki /></div>
          <div className={tab === 'logs' ? 'absolute inset-0' : 'hidden'}><Logs /></div>
          <div className={tab === 'settings' ? 'absolute inset-0' : 'hidden'}><Settings /></div>
        </section>
      </main>
    </div>
  )
}
