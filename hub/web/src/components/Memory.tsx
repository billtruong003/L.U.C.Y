import { useCallback, useEffect, useState } from 'react'
import Markdown from './Markdown'
import { brainState, brainRecall, brainFile, brainReindex, brainDream, brainEvidence, type BrainState, type BrainHit, type BrainPref } from '../api'
import { showToast } from '../toast'

// Tab "Bộ não" (M1) — trí nhớ bền của Lucy: duyệt vault · recall (FTS5) · gộp "dream".
// Khác tab "Neural" (BrainViz = graph agent live). Đây là TRÍ NHỚ markdown + preference đã học.

const BAND_COL: Record<string, string> = { high: 'text-grn border-grn/40', medium: 'text-cyan border-cyan/40', low: 'text-inkdim border-line' }
const STATUS_COL: Record<string, string> = { confirmed: 'text-grn', unconfirmed: 'text-cyan', stale: 'text-yellow-300', rebutted: 'text-pink', expired: 'text-inkfaint' }

// render snippet recall: «...» = đoạn khớp → highlight.
function Snippet({ text }: { text: string }) {
  const parts = text.split(/«|»/)
  return <>{parts.map((p, i) => (i % 2 === 1 ? <span key={i} className="text-cyan bg-cyan/10 rounded px-0.5">{p}</span> : <span key={i}>{p}</span>))}</>
}

export default function Memory({ visible }: { visible: boolean }) {
  const [st, setSt] = useState<BrainState | null>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<BrainHit[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [doc, setDoc] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { brainState().then(setSt).catch(() => { /* */ }) }, [])
  useEffect(() => { if (visible) load() }, [visible, load])

  const openFile = (path: string) => { setSel(path); setHits(null); setDoc(''); brainFile(path).then((d) => setDoc(d.content || '_(không đọc được)_')) }
  const search = () => {
    const term = q.trim()
    if (!term) { setHits(null); return }
    setSel(null); brainRecall(term).then((d) => setHits(d.hits || []))
  }
  const reindex = async () => {
    setBusy(true)
    try { const d = await brainReindex(); showToast(`Reindex xong: ${d.stats?.total ?? '?'} note`, 'success'); load() }
    catch { showToast('Reindex lỗi', 'error') } finally { setBusy(false) }
  }
  const runDream = async () => {
    setBusy(true)
    try {
      const d = await brainDream(); const s = d.summary
      if (!s) showToast('Dream lỗi', 'error')
      else if (!s.changed && !s.contradictions.length) showToast('Dream: không có gì mới (no-op)', 'info')
      else showToast(`Dream: +${s.graduated.length} học · ${s.processedSignals} signal · ${s.activePrefs} đang sống`, 'success')
      load()
    } catch { showToast('Dream lỗi', 'error') } finally { setBusy(false) }
  }
  // A1: đánh dấu 1 preference áp-dụng/vi-phạm → ghi evidence → dream confirm. active.md đầy, hành tinh sáng.
  const sendEvidence = async (prefId: string, kind: 'applied' | 'violated') => {
    try {
      const d = await brainEvidence(prefId, kind)
      const conf = d.summary?.confirmed?.length || 0
      showToast(kind === 'applied' ? `👍 +1 áp dụng${conf ? ` · ${conf} pref confirmed` : ''}` : '👎 +1 vi phạm', kind === 'applied' ? 'success' : 'info')
      load()
    } catch { showToast('Ghi evidence lỗi', 'error') }
  }

  if (st && st.configured === false) return (
    <div className="h-full grid place-items-center px-6">
      <div className="card max-w-md p-6 text-center">
        <div className="text-3xl mb-2">🧠</div>
        <div className="display text-cyan tracking-wide mb-2">BỘ NÃO CHƯA BẬT</div>
        <p className="text-[13px] text-inkdim leading-relaxed">
          Đặt env <code className="text-cyan">LUCY_VAULT</code> cho coordinator (trỏ tới thư mục <code className="text-cyan">lucy-vault/</code>) rồi restart agent-machine.
          {st.offline && <span className="block mt-2 text-pink">· coordinator đang offline.</span>}
        </p>
      </div>
    </div>
  )

  const prefs = st?.preferences || []
  const inbox = st?.inbox || []

  return (
    <div className="h-full flex flex-col">
      {/* TOOLBAR */}
      <div className="shrink-0 flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-line flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[200px]">
          <input className="input !py-1.5 text-[13px] flex-1" placeholder="recall — tìm trong trí nhớ (FTS5, không dấu cũng khớp)…"
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search() }} />
          <button className="btn btn-primary !py-1.5 !text-[12px] shrink-0" onClick={search}>🔎</button>
        </div>
        <div className="flex-1" />
        {st?.stats && <span className="chip shrink-0">{st.stats.total} note · {st.stats.observations} quan sát</span>}
        <button className="btn !py-1.5 !text-[12px] shrink-0" onClick={reindex} disabled={busy} title="Dựng lại index FTS5 từ file">↻ Reindex</button>
        <button className="btn btn-primary !py-1.5 !text-[12px] shrink-0" onClick={runDream} disabled={busy} title="Gộp signal → preference, cập nhật active.md">🌙 Dream</button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* LEFT: preferences + inbox + vault tree */}
        <div className="w-72 shrink-0 border-r border-line overflow-y-auto p-3 hidden md:block">
          <Section title={`Đã học (${prefs.length})`}>
            {prefs.length === 0 && <Empty text="Chưa học preference nào" />}
            {prefs.map((p) => <PrefRow key={p.id} p={p} onClick={() => openFile(p.path)} active={sel === p.path} onEvidence={(k) => sendEvidence(p.id, k)} />)}
          </Section>

          <Section title={`Inbox · chờ dream (${inbox.length})`}>
            {inbox.length === 0 && <Empty text="Trống — chưa có signal mới" />}
            {inbox.map((s) => (
              <button key={s.id} onClick={() => openFile(s.path)}
                className={'w-full text-left rounded-lg px-2 py-1.5 mb-0.5 transition-colors ' + (sel === s.path ? 'bg-cyan/10' : 'hover:bg-white/[0.05]')}>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0">{s.signal === 'negative' ? '⚠️' : '✅'}</span>
                  <span className="text-[11px] text-inkfaint truncate flex-1">{s.topic}</span>
                  <span className="chip !py-0 !px-1 !text-[9px] shrink-0">{s.agent}</span>
                </div>
                <div className="text-[12px] text-inkdim truncate mt-0.5">{s.principle}</div>
              </button>
            ))}
          </Section>

          <Section title="Vault">
            {(st?.tree || []).map((grp) => (
              <div key={grp.dir} className="mb-2">
                <div className="text-[10px] text-inkfaint uppercase tracking-widest px-2 mb-0.5">{grp.dir}</div>
                {grp.files.map((f) => (
                  <button key={f.path} onClick={() => openFile(f.path)}
                    className={'w-full text-left rounded-lg px-2 py-1 mb-0.5 flex items-center gap-1.5 transition-colors ' + (sel === f.path ? 'bg-cyan/10' : 'hover:bg-white/[0.05]')}>
                    <span className="text-[11px] shrink-0 opacity-70">{ICON[f.type] || '📄'}</span>
                    <span className={'text-[12px] truncate flex-1 ' + (sel === f.path ? 'text-cyan' : 'text-inkdim')}>{f.title}</span>
                    {f.status && <span className={'!text-[9px] shrink-0 ' + (STATUS_COL[f.status] || 'text-inkfaint')}>{f.status}</span>}
                  </button>
                ))}
              </div>
            ))}
          </Section>
        </div>

        {/* RIGHT: search hits | rendered doc | overview */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
          {hits !== null ? (
            <div className="max-w-3xl mx-auto">
              <div className="text-[12px] text-inkfaint mb-3">{hits.length} kết quả cho “{q}”{hits[0]?.relaxed && <span className="text-cyan"> · relaxed-OR</span>}</div>
              {hits.length === 0 && <Empty text="Không tìm thấy — thử từ khoá khác / Reindex" />}
              {hits.map((h) => (
                <button key={h.file_path} onClick={() => openFile(h.file_path)} className="card w-full text-left p-3 mb-2 hover:border-cyan/40 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="shrink-0">{ICON[h.type] || '📄'}</span>
                    <span className="text-[13px] text-cyan font-medium truncate flex-1">{h.title}</span>
                    <span className="text-[10px] text-inkfaint shrink-0 mono">{h.file_path}</span>
                  </div>
                  <div className="text-[12px] text-inkdim leading-relaxed"><Snippet text={h.snippet} /></div>
                </button>
              ))}
            </div>
          ) : sel && doc ? (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-3 text-[11px] text-inkfaint mono"><span>📄</span>{sel}</div>
              <div className="card p-5"><Markdown>{doc}</Markdown></div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="text-[12px] text-inkfaint mb-2 uppercase tracking-widest">Trí nhớ đang hoạt động</div>
              <div className="card p-5"><Markdown>{stripFm(st?.active || '') || '_Lucy chưa học preference nào — sẽ đầy dần khi chạy việc + dream._'}</Markdown></div>
              <p className="text-[11px] text-inkfaint mt-3 leading-relaxed">
                Chọn 1 mục bên trái để xem · gõ vào ô <b>recall</b> để tìm (FTS5, tiếng Việt không dấu cũng khớp) ·
                <b> Dream</b> gộp signal trong <i>Inbox</i> thành preference (≥2 cùng dấu/topic).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ICON: Record<string, string> = { project: '🗂️', note: '📄', skill: '🧩', daily: '📔', preference: '🧠', daily_: '📔' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] text-inkfaint uppercase tracking-widest px-2 mb-1.5">{title}</div>
      {children}
    </div>
  )
}
function Empty({ text }: { text: string }) { return <div className="text-[11px] text-inkfaint px-2 py-1.5 italic">{text}</div> }

function PrefRow({ p, onClick, active, onEvidence }: { p: BrainPref; onClick: () => void; active: boolean; onEvidence: (k: 'applied' | 'violated') => void }) {
  const live = p.status === 'unconfirmed' || p.status === 'confirmed' // chỉ pref đang sống mới feed evidence
  return (
    <div className={'rounded-lg px-2 py-1.5 mb-0.5 transition-colors ' + (active ? 'bg-cyan/10' : 'hover:bg-white/[0.05]')}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0">{p.sign === 'negative' ? '⚠️' : '✅'}</span>
          <span className={'text-[12px] truncate flex-1 ' + (active ? 'text-cyan' : 'text-inkdim')}>{p.principle}</span>
          {p.pinned && <span className="shrink-0 text-[10px]" title="pinned">📌</span>}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className={'chip !py-0 !px-1 !text-[9px] ' + (STATUS_COL[p.status] || '')}>{p.status}</span>
          <span className={'chip !py-0 !px-1 !text-[9px] ' + (BAND_COL[p.band] || '')}>{p.band} {p.confidence}</span>
        </div>
      </button>
      {live && (
        <div className="flex items-center gap-1 mt-1">
          <button onClick={() => onEvidence('applied')} className="chip !py-0 !px-1.5 !text-[10px] hover:border-grn/50 hover:text-grn transition-colors" title="Lucy áp dụng đúng → +1 applied (tăng confidence, unconfirmed→confirmed)">👍 áp dụng</button>
          <button onClick={() => onEvidence('violated')} className="chip !py-0 !px-1.5 !text-[10px] hover:border-pink/50 hover:text-pink transition-colors" title="Sai/vi phạm → +1 violated (giảm confidence)">👎 bác</button>
        </div>
      )}
    </div>
  )
}

// bỏ frontmatter khi render active.md ở overview (chỉ hiện phần digest người đọc).
function stripFm(md: string): string { return md.replace(/^---[\s\S]*?\n---\n/, '').trim() }
