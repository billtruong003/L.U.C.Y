import { useEffect, useRef, useState } from 'react'
import { chatStream, chatHistory, newChat, llmModels, type LlmModel } from '../api'
import Markdown from './Markdown'

type Msg = { role: 'me' | 'lucy' | 'sys'; text: string; thinking?: string; route?: string }

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [inp, setInp] = useState('')
  const [model, setModel] = useState('claude:sonnet')
  const [models, setModels] = useState<LlmModel[]>([])
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [showThink, setShowThink] = useState<Record<number, boolean>>({})
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => {
    chatHistory().then((d) => { if (d.messages?.length) setMsgs(d.messages.map((m) => ({ role: m.role, text: m.text }))) }).catch(() => {})
    llmModels().then((d) => { if (d.catalog?.length) setModels(d.catalog) }).catch(() => {})
  }, [])

  function startMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Trình duyệt không hỗ trợ nhập giọng nói — dùng Chrome.'); return }
    const rec = new SR(); rec.lang = 'vi-VN'; rec.interimResults = false
    setListening(true)
    rec.onresult = (e: any) => setInp((p) => (p ? p + ' ' : '') + e.results[0][0].transcript)
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false)
    rec.start()
  }
  // cập nhật message Lucy cuối (đang stream) theo patch
  function patchLucy(patch: (m: Msg) => Msg) {
    setMsgs((p) => { const c = [...p]; const i = c.length - 1; if (i >= 0) c[i] = patch(c[i]); return c })
  }
  async function go(override?: string) {
    const text = (override ?? inp).trim()
    if (!text || busy) return
    setInp(''); setBusy(true)
    setMsgs((p) => [...p, { role: 'me', text }, { role: 'lucy', text: '', route: '⏳ …' }])
    try {
      await chatStream(text, model, (e) => {
        if (e.type === 'route') patchLucy((m) => ({ ...m, route: e.text }))
        else if (e.type === 'thinking') patchLucy((m) => ({ ...m, thinking: (m.thinking || '') + (e.text || '') }))
        else if (e.type === 'delta') patchLucy((m) => ({ ...m, route: undefined, text: m.text + (e.text || '') }))
        else if (e.type === 'final') patchLucy((m) => ({ ...m, route: undefined, text: e.text || m.text }))
        else if (e.type === 'error') patchLucy((m) => ({ ...m, route: undefined, text: (m.text || '') + '\n❌ ' + (e.text || 'lỗi') }))
      })
    } catch (e) { patchLucy((m) => ({ ...m, route: undefined, text: (m.text || '') + '\n❌ ' + e })) }
    setBusy(false)
  }
  async function clearChat() {
    if (!confirm('Xoá lịch sử & bắt đầu phiên mới?')) return
    await newChat(); setMsgs([])
  }

  const laneModels = models.filter((m) => !['ds-v4-flash'].includes(m.key)) // (giữ nguyên, lọc nếu cần)
  const curLabel = model === 'auto' ? '🧭 Auto (router tự chọn)'
    : model === 'claude:sonnet' ? 'Claude Sonnet (nhanh)'
    : model === 'claude:opus' ? 'Claude Opus (sâu)'
    : (models.find((m) => m.key === model)?.label || model)

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
                  {m.route && <div className="text-[11px] text-inkfaint mb-1.5">{m.route}</div>}
                  {m.thinking && (
                    <div className="mb-2">
                      <button onClick={() => setShowThink((s) => ({ ...s, [i]: !s[i] }))} className="text-[11px] text-amber-300/80 hover:text-amber-200">
                        💭 {showThink[i] ? 'ẩn suy nghĩ' : 'xem suy nghĩ'}
                      </button>
                      {showThink[i] && (
                        <div className="mt-1.5 text-[12px] text-inkdim whitespace-pre-wrap rounded-lg px-3 py-2"
                          style={{ background: 'rgba(245,200,66,0.06)', border: '1px solid rgba(245,200,66,0.20)' }}>{m.thinking}</div>
                      )}
                    </div>
                  )}
                  {m.text ? <Markdown>{m.text}</Markdown> : (!m.route && <span className="text-inkfaint text-sm">…</span>)}
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
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-line">
            <button onClick={startMic} title="Nhập bằng giọng nói" className={'btn btn-icon ' + (listening ? 'text-pink border-pink/60' : '')} style={listening ? { animation: 'lucy-pulse 1s infinite' } : undefined}>🎤</button>
            {/* Phase D2: composer model picker */}
            <select value={model} onChange={(e) => setModel(e.target.value)} title={`Model: ${curLabel}`}
              className="text-xs rounded-lg bg-transparent border border-line px-2 py-1.5 text-inkdim max-w-[46%] sm:max-w-none focus:outline-none">
              <optgroup label="Claude (subscription · có tool)">
                <option value="claude:sonnet">Claude Sonnet — nhanh</option>
                <option value="claude:opus">Claude Opus — sâu</option>
              </optgroup>
              <optgroup label="Tự động">
                <option value="auto">🧭 Auto — router tự chọn</option>
              </optgroup>
              {models.length > 0 && (
                <optgroup label="Lane (chat thuần · không tool)">
                  {laneModels.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}{m.free ? ' · free' : ''}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button onClick={clearChat} className="btn !py-1.5 !px-2.5 text-xs" title="Phiên mới (xoá lịch sử)">✨ mới</button>
            <div className="flex-1" />
            <button onClick={() => go()} disabled={busy} className="btn btn-primary px-5 sm:px-6">{busy ? '…' : 'GỬI'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
