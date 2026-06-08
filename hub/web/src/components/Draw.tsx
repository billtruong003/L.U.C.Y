import { useEffect, useRef, useState } from 'react'

const PALETTE = [
  '#e7f1fb', // ink
  '#3fd3ff', // cyan
  '#5fe39a', // grn
  '#ff5d9e', // pink
  '#ff9d5c', // orange
  '#b78cff', // purple
  '#c9a85f', // gold
  '#ff6b6b', // red
  '#05070e', // black
]

export default function Draw() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [color, setColor] = useState('#e7f1fb')
  const [size, setSize] = useState(4)
  const [eraser, setEraser] = useState(false)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // init canvas + handle resize
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const init = (w: number, h: number, prevImg?: string) => {
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#05070e'
      ctx.fillRect(0, 0, w, h)
      if (prevImg) {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0)
        img.src = prevImg
      }
    }

    const ro = new ResizeObserver(() => {
      const { width, height } = wrap.getBoundingClientRect()
      const prev = canvas.width > 0 ? canvas.toDataURL() : undefined
      init(width, height, prev)
    })
    ro.observe(wrap)
    const { width, height } = wrap.getBoundingClientRect()
    init(width, height)
    return () => ro.disconnect()
  }, [])

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    drawing.current = true
    const pos = getPos(e)
    lastPos.current = pos
    const ctx = canvasRef.current!.getContext('2d')!
    const r = eraser ? size * 3 : size
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r / 2, 0, Math.PI * 2)
    ctx.fillStyle = eraser ? '#05070e' : color
    ctx.fill()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || !lastPos.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = eraser ? '#05070e' : color
    ctx.lineWidth = eraser ? size * 3 : size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const onPointerUp = () => { drawing.current = false; lastPos.current = null }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#05070e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const savePNG = () => {
    const a = document.createElement('a')
    a.href = canvasRef.current!.toDataURL('image/png')
    a.download = 'drawing.png'
    a.click()
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── toolbar ── */}
      <div className="shrink-0 px-3 py-2 border-b border-line bg-panel/40 backdrop-blur flex items-center gap-3 overflow-x-auto">

        {/* color swatches */}
        <div className="flex items-center gap-1.5 shrink-0">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setEraser(false) }}
              title={c}
              style={{
                background: c,
                border: color === c && !eraser ? '2px solid #3fd3ff' : '2px solid rgba(127,179,214,0.2)',
                boxShadow: color === c && !eraser ? `0 0 8px ${c}99` : 'none',
              }}
              className="h-7 w-7 rounded-full transition-all shrink-0 hover:scale-110 active:scale-95"
            />
          ))}
          {/* custom color */}
          <label
            className="relative h-7 w-7 rounded-full overflow-hidden cursor-pointer shrink-0 flex items-center justify-center text-sm"
            style={{ border: '2px solid rgba(127,179,214,0.2)', background: color }}
            title="Màu tuỳ chọn"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setEraser(false) }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
        </div>

        <div className="w-px h-6 bg-line shrink-0" />

        {/* size slider */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-inkfaint tracking-widest">SIZE</span>
          <input
            type="range" min={1} max={40} value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24 accent-cyan"
          />
          <span className="mono text-[11px] text-inkdim w-5 text-right">{size}</span>
        </div>

        <div className="w-px h-6 bg-line shrink-0" />

        {/* eraser */}
        <button
          onClick={() => setEraser((v) => !v)}
          title="Tẩy"
          className={
            'btn !py-1.5 !px-3 !text-[12px] shrink-0 ' +
            (eraser ? '!border-pink/50 !text-pink !bg-pink/10' : '')
          }
        >
          ⌫ Tẩy
        </button>

        {/* clear */}
        <button onClick={clear} className="btn !py-1.5 !px-3 !text-[12px] shrink-0" title="Xoá trắng">
          ✕ Clear
        </button>

        {/* save png */}
        <button onClick={savePNG} className="btn !py-1.5 !px-3 !text-[12px] shrink-0 ml-auto" title="Tải xuống PNG">
          ↓ PNG
        </button>
      </div>

      {/* ── canvas area ── */}
      <div
        ref={wrapRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        style={{ background: '#05070e', cursor: eraser ? 'cell' : 'crosshair' }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  )
}
