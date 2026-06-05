import { useEffect, useState } from 'react'
import { tree, readFile, type Entry } from '../api'
import Markdown from './Markdown'

type FileView = { name?: string; content?: string; binary?: boolean; tooBig?: boolean; size?: number }

export default function Projects() {
  const [path, setPath] = useState('.')
  const [root, setRoot] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [file, setFile] = useState<FileView | null>(null)

  function load(p: string) {
    tree(p).then((d) => {
      if (d.entries) { setPath(d.path); setRoot(d.root); setEntries(d.entries); setFile(null) }
    })
  }
  useEffect(() => { load('.') }, [])

  function open(e: Entry) {
    const np = path === '.' ? e.name : path + '/' + e.name
    if (e.type === 'dir') load(np)
    else readFile(np).then((d) => setFile({ name: e.name, ...d }))
  }
  function up() {
    if (path === '.') return
    const parts = path.split('/'); parts.pop()
    load(parts.join('/') || '.')
  }

  return (
    <div className="h-full flex">
      <div className="w-72 border-r border-cyan/20 overflow-auto p-2 shrink-0">
        <div className="text-cyan text-sm mb-1 truncate" title={root}>📁 {path}</div>
        <div className="text-slate-600 text-[10px] mb-2 truncate" title={root}>{root}</div>
        {path !== '.' && (
          <button onClick={up} className="block w-full text-left px-1 py-0.5 text-sm text-slate-400 hover:text-cyan">.. (lên)</button>
        )}
        {entries.map((e) => (
          <button key={e.name} onClick={() => open(e)} className="block w-full text-left px-1 py-0.5 text-sm hover:text-cyan truncate">
            {e.type === 'dir' ? '📂' : '📄'} {e.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 min-w-0">
        {!file && <div className="text-slate-500 text-sm">Chọn file để xem (code hiện nội dung; ảnh/binary chỉ là node).</div>}
        {file?.binary && <div className="text-slate-500 text-sm">🖼️ {file.name} — binary ({Math.round((file.size || 0) / 1024)} KB), không hiển thị.</div>}
        {file?.tooBig && <div className="text-slate-500 text-sm">{file.name} — quá lớn ({Math.round((file.size || 0) / 1024)} KB).</div>}
        {file && !file.binary && !file.tooBig && file.content != null && (
          <>
            <div className="text-cyan text-sm mb-2">📄 {file.name}</div>
            {file.name?.endsWith('.md')
              ? <Markdown>{file.content}</Markdown>
              : <pre className="text-xs text-cyan/90 whitespace-pre-wrap break-words">{file.content}</pre>}
          </>
        )}
      </div>
    </div>
  )
}
