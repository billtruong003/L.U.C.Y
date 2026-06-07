// LucyChat — Lucy hội thoại per-project: trò chuyện DÀI để gom ý tưởng, hỏi lại khi
// chưa rõ, và khi đủ rõ thì đề xuất các task (card) có nút Tạo. Dùng bridge claude (send/poll).
import { useEffect, useRef, useState } from 'react'
import { send, poll, amCreateCard, amState, amLogLucy, type AmPipeline } from '../api'
import { parseDrafts, type Draft } from './Planner'

type Msg = { role: 'me' | 'lucy'; text: string; drafts?: Draft[]; created?: boolean }

function convPrompt(project: string, pipes: AmPipeline[], transcript: string): string {
  const plist = pipes.map((p) => `- ${p.id}: ${p.name} (${p.stages.map((s) => s.name).join(' → ')})`).join('\n')
  return [
    `Bạn là Lucy — điều phối viên kỹ thuật của dự án "${project}". Trò chuyện với chủ để GOM yêu cầu/ý tưởng rồi chia thành task.`,
    `Pipeline có sẵn (chỉ chọn id trong đây):`, plist || '- (không có)',
    ``,
    `QUY TẮC:`,
    `- Nếu yêu cầu CHƯA đủ rõ để chia task -> HỎI LẠI ngắn gọn (1-2 câu), KHÔNG kèm json.`,
    `- Khi ĐÃ đủ rõ -> trả lời 1 câu chốt NGẮN rồi kèm DUY NHẤT 1 khối json ở cuối (model: opus cho việc khó, sonnet việc thường):`,
    '```json', `[{"title":"...","brief":"...","pipelineId":"<id>","model":"sonnet"}]`, '```',
    `- CHIA ĐỦ task như 1 product owner: mục tiêu lớn -> nhiều task nhỏ làm được (dự án lớn 5-15 task), mỗi task 1 việc rõ ràng. Đừng gộp 1 task khổng lồ, cũng đừng vụn vặt.`,
    `- Trả lời tiếng Việt, gọn, xưng "em" gọi "chủ".`,
    ``,
    `HỘI THOẠI:`, transcript, `Lucy:`,
  ].join('\n')
}

export default function LucyChat({ project, pipes, onCreated }: { project: string; pipes: AmPipeline[]; onCreated: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'lucy', text: 'Chào chủ 👋 Dự án này chủ muốn làm gì? Cứ kể tự nhiên — em hỏi lại cho rõ rồi chia task.' }])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])

  // V3: nạp lại lịch sử chat đã lưu (kênh __lucy) khi mở dự án — qua F5/đa thiết bị
  useEffect(() => {
    let alive = true
    amState().then((s) => {
      if (!alive) return
      const hist = (s.channels || []).filter((m) => m.channel === `p:${project}:__lucy`).map((m) => ({ role: m.author === 'bill' ? 'me' : 'lucy', text: m.text } as Msg))
      if (hist.length) setMsgs(hist)
    }).catch(() => { /* */ })
    return () => { alive = false }
  }, [project])

  const sendMsg = async () => {
    if (!draft.trim() || busy) return
    const userText = draft.trim()
    const hist: Msg[] = [...msgs, { role: 'me', text: userText }]
    setMsgs(hist); setDraft(''); setBusy(true); setSecs(0)
    amLogLucy(project, 'me', userText).catch(() => { /* */ })
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    try {
      const transcript = hist.map((m) => `${m.role === 'me' ? 'Chủ' : 'Lucy'}: ${m.text}`).join('\n')
      const { job_id } = await send(convPrompt(project, pipes, transcript), false)
      let res = ''
      for (let i = 0; i < 100; i++) { await new Promise((s) => setTimeout(s, 1200)); const p = await poll(job_id); if (p.result != null) { res = p.result; break }; if (p.status === 'error' || p.status === 'failed') throw new Error('bridge') }
      const ds = parseDrafts(res, pipes)
      const text = res.replace(/```json[\s\S]*?```/g, '').trim() || (ds.length ? 'Em đề xuất các task dưới đây:' : '(không có nội dung)')
      setMsgs((h) => [...h, { role: 'lucy', text, drafts: ds.length ? ds : undefined }])
      amLogLucy(project, 'lucy', text).catch(() => { /* */ })
    } catch { setMsgs((h) => [...h, { role: 'lucy', text: '⚠️ Lỗi gọi Lucy — thử lại.' }]) } finally { clearInterval(t); setBusy(false) }
  }

  const createDrafts = async (idx: number, ds: Draft[]) => {
    for (const d of ds) await amCreateCard(d.title, d.brief, d.pipelineId, project, false, d.model)
    onCreated()
    setMsgs((h) => h.map((m, k) => (k === idx ? { ...m, created: true } : m)))
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {msgs.map((m, i) => (
          <div key={i} className={'max-w-[85%] ' + (m.role === 'me' ? 'self-end' : 'self-start')}>
            <div className={'rounded-2xl px-3.5 py-2 text-[13px] leading-snug whitespace-pre-wrap ' + (m.role === 'me' ? 'bg-cyan/15 text-ink rounded-br-sm' : 'bg-panel border border-line text-inkdim rounded-bl-sm')}>
              {m.role === 'lucy' && <span className="text-[10px] text-cyan font-semibold block mb-0.5">Lucy</span>}
              {m.text}
            </div>
            {m.drafts && (
              <div className="mt-2 card !bg-black/20 p-2.5 flex flex-col gap-1.5">
                <div className="text-[11px] text-inkfaint">{m.drafts.length} task đề xuất:</div>
                {m.drafts.map((d, k) => (
                  <div key={k} className="flex items-center gap-2 text-[12px]">
                    <span className="text-inkdim truncate flex-1">{d.title}</span>
                    <span className="chip !py-0 !px-1.5 !text-[9px]">{pipes.find((p) => p.id === d.pipelineId)?.name || d.pipelineId}</span>
                    <span className="chip !py-0 !px-1.5 !text-[9px]" style={{ color: d.model === 'opus' ? '#b78cff' : '#7fe3ff' }}>{d.model}</span>
                  </div>
                ))}
                <button className="btn btn-primary !py-1.5 mt-1 self-start" disabled={m.created} onClick={() => createDrafts(i, m.drafts!)}>
                  {m.created ? '✓ Đã tạo' : `✓ Tạo ${m.drafts.length} task`}
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="self-start text-[12px] text-cyan flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-cyan animate-pulse" />Lucy đang nghĩ… {secs}s</div>}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-line p-2.5 flex gap-2">
        <input className="input flex-1" placeholder="Kể cho Lucy nghe ý tưởng / yêu cầu…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMsg()} disabled={busy} />
        <button className="btn btn-primary shrink-0" onClick={sendMsg} disabled={busy || !draft.trim()}>Gửi</button>
      </div>
    </div>
  )
}
