// recall-cli — tay lái FTS5 recall. LUCY_VAULT trỏ tới lucy-vault.
//   npm run reindex            # dựng lại index từ file (full)
//   npm run recall -- "query"  # tìm
//   npm run recall -- --recent 7d
import path from 'node:path'
import { Recall } from './recall'

const vault = process.env.LUCY_VAULT || path.resolve(process.cwd(), '..', 'lucy-vault')
const args = process.argv.slice(2)

const r = new Recall(vault)
try {
  if (args[0] === 'reindex' || args[0] === '--reindex') {
    const s = r.reindex({ full: true })
    console.log(`✅ reindex (full): +${s.indexed} mới, ~${s.updated} cập nhật, -${s.deleted} xoá → ${s.total} note. db=${r.dbPath}`)
  } else if (args[0] === '--recent') {
    const rows = r.recent({ timeframe: args[1], limit: 20 })
    console.log(`🕒 ${rows.length} note gần đây${args[1] ? ` (${args[1]})` : ''}:`)
    for (const n of rows) console.log(`  · [${n.type}] ${n.title}  — ${n.file_path}  (${new Date(n.mtime).toLocaleString('vi-VN')})`)
  } else {
    const s = r.reindex() // incremental trước khi tìm (rẻ, chỉ file đổi)
    const q = args.filter((a) => !a.startsWith('--')).join(' ')
    if (!q) { console.log('Cách dùng: npm run recall -- "câu cần tìm"  |  --recent 7d  |  reindex'); process.exit(0) }
    const hits = r.search(q, { limit: 10 })
    console.log(`🔎 "${q}" → ${hits.length} kết quả${hits[0]?.relaxed ? ' (relaxed-OR)' : ''}  [index: ${s.total} note]`)
    for (const h of hits) console.log(`  · [${h.type}] ${h.title}  (${h.file_path})\n      ${h.snippet.replace(/\s+/g, ' ').trim()}`)
  }
} finally { r.close() }
