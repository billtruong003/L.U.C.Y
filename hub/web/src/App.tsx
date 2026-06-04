import { useEffect, useState } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import { me } from './api'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => {
    me().then((d) => setAuthed(d.authed)).catch(() => setAuthed(false))
  }, [])

  if (authed === null)
    return <div className="h-screen grid place-items-center text-cyan">…</div>
  return authed ? <Chat /> : <Login onOk={() => setAuthed(true)} />
}
