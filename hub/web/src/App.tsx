import { useEffect, useState } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import Tasks from './components/Tasks'
import Projects from './components/Projects'
import BrainViz from './components/BrainViz'
import { me } from './api'

const TABS = [
  { id: 'chat', label: 'CHAT', icon: '💬' },
  { id: 'tasks', label: 'TASKS', icon: '⚙️' },
  { id: 'projects', label: 'PROJECTS', icon: '📁' },
  { id: 'brain', label: 'BRAIN', icon: '🧠' },
]

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tab, setTab] = useState('chat')
  useEffect(() => { me().then((d) => setAuthed(d.authed)).catch(() => setAuthed(false)) }, [])

  if (authed === null) return <div className="h-screen grid place-items-center text-cyan">…</div>
  if (!authed) return <Login onOk={() => setAuthed(true)} />

  return (
    <div className="h-screen flex">
      <nav className="w-44 border-r border-cyan/20 flex flex-col p-2 gap-1 shrink-0">
        <div className="text-cyan text-lg tracking-[0.25em] px-2 py-3" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 10px rgba(63,211,255,.5)' }}>L.U.C.Y</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'text-left px-3 py-2 border transition-colors ' +
              (tab === t.id ? 'border-cyan text-cyan bg-cyan/10' : 'border-transparent text-slate-400 hover:text-cyan')
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="mt-auto text-slate-600 text-[10px] px-2">● online</div>
      </nav>
      <main className="flex-1 min-w-0">
        {tab === 'chat' && <Chat />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'projects' && <Projects />}
        {tab === 'brain' && <BrainViz />}
      </main>
    </div>
  )
}
