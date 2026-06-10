import { useState } from 'react'
import BrainViz from './BrainViz'
import Galaxy from './Galaxy'

// Tab Neural có 2 chế độ:
//  • Live    = BrainViz (graph agent đang chạy — telemetry real-time)
//  • Galaxy  = tinh hà tri thức (trí nhớ vault: hành tinh = note, đường sao = wikilink, nở theo thời gian)
export default function NeuralTab({ visible }: { visible: boolean }) {
  const [mode, setMode] = useState<'live' | 'galaxy'>('galaxy')
  return (
    <div className="relative h-full w-full">
      {/* mount cả 2 nhưng chỉ cái đang chọn 'visible' (giữ context, không re-init khi đổi) */}
      <div className={'absolute inset-0 ' + (mode === 'live' ? '' : 'opacity-0 pointer-events-none')}><BrainViz visible={visible && mode === 'live'} /></div>
      <div className={'absolute inset-0 ' + (mode === 'galaxy' ? '' : 'opacity-0 pointer-events-none')}><Galaxy visible={visible && mode === 'galaxy'} /></div>

      {/* toggle Live ⟷ Galaxy */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-0.5 rounded-xl border border-line bg-black/45 backdrop-blur p-0.5">
        {([['galaxy', '🌌 Tinh hà'], ['live', '⚡ Live']] as const).map(([m, lb]) => (
          <button key={m} onClick={() => setMode(m)}
            className={'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ' + (mode === m ? 'bg-cyan/15 text-cyan' : 'text-inkdim hover:text-ink')}>{lb}</button>
        ))}
      </div>
    </div>
  )
}
