// Placeholder cho H3 (three.js cục năng lượng + dây LLM). Hiện animation đơn giản.
export default function BrainViz() {
  return (
    <div className="h-full grid place-items-center">
      <div className="text-center">
        <div
          className="w-40 h-40 rounded-full mx-auto mb-6"
          style={{
            background: 'radial-gradient(circle, rgba(63,211,255,.7), rgba(63,211,255,0) 70%)',
            animation: 'lucy-pulse 2.2s ease-in-out infinite',
          }}
        />
        <div className="text-cyan tracking-[0.3em] text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>BRAIN-VIZ</div>
        <div className="text-slate-500 text-sm mt-2">three.js cục năng lượng + dây nối LLM (Iron Man) — H3 đang làm.</div>
      </div>
    </div>
  )
}
