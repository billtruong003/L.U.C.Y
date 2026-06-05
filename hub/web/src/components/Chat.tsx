import { useEffect, useRef, useState } from 'react'
import { send, poll, chatHistory, newChat } from '../api'
import Markdown from './Markdown'

type Msg = { role: 'me' | 'lucy' | 'sys'; text: string }

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [inp, setInp] = useState('')
  const [opus, setOpus] = useState(false)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => {
    chatHistory().then((d) => { if (d.messages?.length) setMsgs(d.messages.map((m) => ({ role: m.role, text: m.text }))) }).catch(() => {})
  }, [])

  function patchLast(text: string) {
    setMsgs((p) => { const c = [...p]; c[c.length - 1] = { role: 'sys', text }; return c })
  }
  function startMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Trình duyệt không hỗ trợ nhập giọng nói — dùng Chrome.'); return }
    const rec = new SR(); rec.lang = 'vi-VN'; rec.interimResults = false
    setListening(true)
    rec.onresult = (e: any) => setInp((p) => (p ? p + ' ' : '') + e.results[0][0].transcript)
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false)
    rec.start()
  }
  async function go(override?: string) {
    const text = (override ?? inp).trim()
    if (!text || busy) return
    setInp(''); setBusy(true)
    setMsgs((p) => [...p, { role: 'me', text }, { role: 'sys', text: '🤔 Lucy đang xử lý…' }])
    try {
      const { job_id } = await send(text, opus)
      const res = await new Promise<string>((resolve, reject) => {
        const t = setInterval(async () => {
          try {
            const j = await poll(job_id)
            if (j.status === 'done') { clearInterval(t); resolve(j.result || '(rỗng)') }
            else patchLast(`⏳ Lucy đang chạy (${j.model})… ${j.elapsed}s`)
          } catch (e) { clearInterval(t); reject(e) }
        }, 2000)
      })
      setMsgs((p) => { const c = [...p]; c[c.length - 1] = { role: 'lucy', text: res }; return c })
    } catch (e) { patchLast('❌ ' + e) }
    setBusy(false)
  }
  async function clearChat() {
    if (!confirm('Xoá lịch sử & bắt đầu phiên mới?')) return
    await newChat(); setMsgs([])
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto px-3 sm:px-6 py-4 sm:py-5">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {msgs.length === 0 && (
            <div className="text-center text-inkfaint text-sm mt-16 sm:mt-20">
              <div className="text-3xl mb-3">🪐</div>
              Chào chủ nhân. Nhắn gì đó để bắt đầu —<br />research tiền, code, hay hỏi đáp đều được.
            </div>
          )}
          {msgs.map((m, i) => {
            if (m.role === 'sys') return <div key={i} className="self-center chip text-inkfaint">{m.text}</div>
            if (m.role === 'me') return (
              <div key={i} className="self-end max-w-[88%] sm:max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words"
                style={{ background: 'rgba(63,211,255,0.10)', border: '1px solid rgba(63,211,255,0.28)' }}>{m.text}</div>
            )
            return (
              <div key={i} className="self-start max-w-[92%] sm:max-w-[88%] flex gap-2.5">
                <img src="/lucy.jpg" alt="Lucy" className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" style={{ border: '1px solid rgba(63,211,255,0.45)' }} />
                <div className="card px-4 py-3 min-w-0">
                  <div className="display text-[10px] tracking-[0.2em] text-cyan/80 mb-1">LUCY</div>
                  <Markdown>{m.text}</Markdown>
                </div>
              </div>
            )
          })}
          <div ref={end} />
        </div>
      </div>

      <div className="px-3 sm:px-6 pb-4 sm:pb-5">
        <div className="max-w-3xl mx-auto card p-2.5 sm:p-3">
          <textarea
            value={inp}
            onChange={(e) => setInp(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}
            placeholder="Nhắn Lucy…  (Enter gửi · Shift+Enter xuống dòng)"
            rows={2}
            className="input resize-none border-0 bg-transparent focus:shadow-none px-1 py-1"
          />
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line">
            <button onClick={startMic} title="Nhập bằng giọng nói" className={'btn btn-icon ' + (listening ? 'text-pink border-pink/60' : '')} style={listening ? { animation: 'lucy-pulse 1s infinite' } : undefined}>🎤</button>
            <button onClick={() => setOpus(!opus)} className="flex items-center gap-1.5 text-xs text-inkdim" title="Dùng Opus (sâu, chậm hơn)">
              <span className="switch" data-on={opus} /> opus
            </button>
            <button onClick={clearChat} className="btn !py-1.5 !px-2.5 text-xs ml-1" title="Phiên mới (xoá lịch sử)">✨ mới</button>
            <div className="flex-1" />
            <button onClick={() => go()} disabled={busy} className="btn btn-primary px-5 sm:px-6">{busy ? '…' : 'GỬI'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
