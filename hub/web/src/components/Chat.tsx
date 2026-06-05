import { useEffect, useRef, useState } from 'react'
import { send, poll } from '../api'
import Markdown from './Markdown'

type Msg = { role: 'me' | 'lucy' | 'sys'; text: string }

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [inp, setInp] = useState('')
  const [opus, setOpus] = useState(false)
  const [busy, setBusy] = useState(false)
  const [speak, setSpeak] = useState(false)
  const [listening, setListening] = useState(false)
  const sid = useRef<string | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView() }, [msgs])

  function patchLast(text: string) {
    setMsgs((p) => { const c = [...p]; c[c.length - 1] = { role: 'sys', text }; return c })
  }

  function speakText(t: string) {
    try {
      const clean = t.replace(/```[\s\S]*?```/g, ' ').replace(/[#*`_>|~]/g, '').replace(/\[(.*?)\]\([^)]*\)/g, '$1').slice(0, 1200)
      const u = new SpeechSynthesisUtterance(clean)
      u.lang = 'vi-VN'
      const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith('vi'))
      if (v) u.voice = v
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    } catch { /* no tts */ }
  }
  function startMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Trình duyệt không hỗ trợ voice input — dùng Chrome.'); return }
    const rec = new SR(); rec.lang = 'vi-VN'; rec.interimResults = false
    setListening(true)
    rec.onresult = (e: any) => { go(e.results[0][0].transcript) }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
  }
  async function go(override?: string) {
    const text = (override ?? inp).trim()
    if (!text || busy) return
    setInp(''); setBusy(true)
    setMsgs((p) => [...p, { role: 'me', text }, { role: 'sys', text: '🤔 Lucy đang xử lý…' }])
    try {
      const { job_id } = await send(text, opus, sid.current)
      const res = await new Promise<string>((resolve, reject) => {
        const t = setInterval(async () => {
          try {
            const j = await poll(job_id)
            if (j.status === 'done') {
              clearInterval(t)
              if (j.session_id) sid.current = j.session_id
              resolve(j.result || '(rỗng)')
            } else patchLast(`⏳ Lucy đang chạy (${j.model})… ${j.elapsed}s`)
          } catch (e) { clearInterval(t); reject(e) }
        }, 2000)
      })
      setMsgs((p) => { const c = [...p]; c[c.length - 1] = { role: 'lucy', text: res }; return c })
      if (speak) speakText(res)
    } catch (e) { patchLast('❌ ' + e) }
    setBusy(false)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-3 border-b border-cyan/20 text-cyan" style={{ fontFamily: 'Orbitron, sans-serif' }}>💬 CHAT</header>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={
              'max-w-[90%] px-3 py-2 break-words border ' +
              (m.role === 'me'
                ? 'self-end border-pink/60 text-pink whitespace-pre-wrap'
                : m.role === 'sys'
                ? 'self-center border-0 text-slate-500 text-xs whitespace-pre-wrap'
                : 'self-start border-cyan/20')
            }
          >
            {m.role === 'lucy' ? <Markdown>{m.text}</Markdown> : m.text}
          </div>
        ))}
        <div ref={end} />
      </div>

      <footer className="flex gap-2 p-3 border-t border-cyan/20">
        <textarea
          value={inp}
          onChange={(e) => setInp(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}
          placeholder="Nhắn Lucy… (Shift+Enter xuống dòng)"
          className="flex-1 h-12 resize-none bg-panel border border-cyan/30 px-3 py-2 outline-none focus:border-cyan"
        />
        <button onClick={startMic} title="Nói (mic)" className={'border px-3 ' + (listening ? 'border-pink text-pink animate-pulse' : 'border-cyan/40 text-cyan hover:bg-cyan/10')}>🎤</button>
        <label className="flex items-center gap-1 text-slate-500 text-xs" title="Lucy đọc tiếng">
          <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> 🔊
        </label>
        <label className="flex items-center gap-1 text-slate-500 text-xs">
          <input type="checkbox" checked={opus} onChange={(e) => setOpus(e.target.checked)} /> opus
        </label>
        <button onClick={() => go()} disabled={busy} className="border border-cyan text-cyan px-4 hover:bg-cyan/10 disabled:opacity-40">
          GỬI
        </button>
      </footer>
    </div>
  )
}
