import { useEffect, useState } from 'react'

export default function Settings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')

  type LlmModel = { key: string; label: string; provider: string; model: string; role: string; free: boolean; note?: string }
  type LlmData = { providers: { provider: string; label: string; hasKey: boolean }[]; catalog: LlmModel[] }
  const [llm, setLlm] = useState<LlmData | null>(null)
  const [execModel, setExecModel] = useState<string>(() => localStorage.getItem('lucy.executorModel') || 'executor')
  const pickModel = (k: string) => { setExecModel(k); localStorage.setItem('lucy.executorModel', k) }

  const load = () => fetch('/api/2fa/status').then((r) => r.json()).then((d) => setEnabled(!!d.enabled)).catch(() => setEnabled(false))
  useEffect(() => { load() }, [])
  useEffect(() => { fetch('/api/llm/models').then((r) => r.json()).then((d: LlmData) => { if (d && d.catalog) setLlm(d) }).catch(() => {}) }, [])

  async function setup() {
    setMsg(''); const r = await fetch('/api/2fa/setup', { method: 'POST' }); const d = await r.json()
    setQr(d.qr); setSecret(d.secret)
  }
  async function enable() {
    const r = await fetch('/api/2fa/enable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    if (r.ok) { setQr(''); setSecret(''); setCode(''); setMsg('✓ Đã bật 2FA. Lần sau đăng nhập cần mã.'); load() }
    else setMsg('✗ Mã sai, thử lại.')
  }
  async function disable() {
    const r = await fetch('/api/2fa/disable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    if (r.ok) { setCode(''); setMsg('Đã tắt 2FA.'); load() }
    else setMsg('✗ Mã sai.')
  }

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔐</span>
            <h3 className="display text-sm tracking-wide">XÁC THỰC 2 LỚP (2FA)</h3>
            <span className={'chip ml-auto ' + (enabled ? 'text-grn border-grn/40' : 'text-inkfaint')}>{enabled === null ? '…' : enabled ? 'ĐANG BẬT' : 'TẮT'}</span>
          </div>
          <p className="text-[12px] text-inkdim mb-4">Bảo vệ hub bằng mã TOTP (Google Authenticator / Authy / 1Password). Cần thiết trước khi mở ra internet.</p>

          {enabled === false && !qr && (
            <button onClick={setup} className="btn btn-primary">Bật 2FA</button>
          )}

          {qr && (
            <div className="flex flex-col items-center gap-3 border border-line rounded-xl p-4">
              <div className="text-[12px] text-inkdim text-center">Quét QR bằng app Authenticator, rồi nhập mã 6 số để xác nhận:</div>
              <img src={qr} alt="2FA QR" className="w-44 h-44 rounded-lg bg-white/5" />
              <div className="mono text-[11px] text-inkfaint break-all text-center">key: {secret}</div>
              <input className="input text-center mono tracking-[0.4em]" maxLength={6} inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <button onClick={enable} className="btn btn-primary w-full">Xác nhận & bật</button>
            </div>
          )}

          {enabled && (
            <div className="flex flex-col gap-2 border border-line rounded-xl p-4">
              <div className="text-[12px] text-inkdim">Tắt 2FA — nhập mã hiện tại để xác nhận:</div>
              <div className="flex gap-2">
                <input className="input text-center mono tracking-[0.4em]" maxLength={6} inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <button onClick={disable} className="btn text-pink/90 border-pink/40 shrink-0">Tắt 2FA</button>
              </div>
            </div>
          )}
          {msg && <div className="text-[12px] mt-3 text-cyan">{msg}</div>}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔌</span>
            <h3 className="display text-sm tracking-wide">LÁT API — lane model-rẻ</h3>
            <span className="chip ml-auto text-inkfaint">{llm ? `${llm.providers.filter((p) => p.hasKey).length}/${llm.providers.length} nguồn` : '…'}</span>
          </div>
          <p className="text-[12px] text-inkdim mb-4">Executor chạy model rẻ (DeepSeek V4…) thay vì đốt Claude. Key quản ở <span className="mono">.env.llm</span> (không lộ ra đây). <span className="text-pink/80">claude -p (não) vẫn đi thẳng Anthropic.</span></p>

          {!llm && <div className="text-[12px] text-inkfaint">Đang tải… (cần coordinator + AM_COORD_URL)</div>}
          {llm && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                {llm.providers.map((p) => (
                  <span key={p.provider} className={'chip ' + (p.hasKey ? 'text-grn border-grn/40' : 'text-inkfaint border-line')}>
                    {p.hasKey ? '●' : '○'} {p.label}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] text-inkdim">Model executor (card nặng / bulk):</label>
                <select className="input" value={execModel} onChange={(e) => pickModel(e.target.value)}>
                  <option value="executor">⚡ Auto (executor role + fallback)</option>
                  {(['executor', 'reasoning', 'fast', 'content'] as const).map((role) => (
                    <optgroup key={role} label={role}>
                      {llm.catalog.filter((m) => m.role === role).map((m) => (
                        <option key={m.key} value={m.key}>{m.label} {m.free ? '· free' : '· paid'} ({m.provider})</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="text-[11px] text-inkfaint mono">đang chọn: {execModel}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
