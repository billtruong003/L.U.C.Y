import { useState } from 'react'
import { login } from '../api'

export default function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  async function go() {
    if (await login(pw)) onOk()
    else setErr('Sai mật khẩu.')
  }
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3">
      <div
        className="text-4xl tracking-[0.4em] text-cyan"
        style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 14px rgba(63,211,255,.6)' }}
      >
        L.U.C.Y
      </div>
      <div className="text-slate-500 text-sm">Literally Understands Crypto, Y'know</div>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder="mật khẩu"
        className="w-64 bg-panel border border-cyan/30 px-3 py-2 outline-none focus:border-cyan"
      />
      <button onClick={go} className="w-64 border border-cyan text-cyan py-2 hover:bg-cyan/10">
        ĐĂNG NHẬP
      </button>
      <div className="text-pink text-xs h-4">{err}</div>
    </div>
  )
}
