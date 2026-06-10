// dream-cli — chạy "gộp đêm" tay/cron. LUCY_VAULT trỏ tới lucy-vault.
//   npm run dream            # gộp signal → preference, regen active.md (idempotent)
import path from 'node:path'
import { dream } from './dream'

const vault = process.env.LUCY_VAULT || path.resolve(process.cwd(), '..', 'lucy-vault')
const s = dream(vault)
if (!s.changed && !s.contradictions.length) {
  console.log(`😴 dream: không có gì mới (no-op). ${s.activePrefs} preference đang sống.`)
} else {
  console.log('🌙 dream xong:')
  if (s.graduated.length) console.log(`  + graduate ${s.graduated.length} pref mới (unconfirmed): ${s.graduated.join(', ')}`)
  if (s.confirmed.length) console.log(`  ✓ confirmed ${s.confirmed.length}: ${s.confirmed.join(', ')}`)
  if (s.redundant) console.log(`  ~ ${s.redundant} signal trùng (noted-redundant)`)
  if (s.rebutted.length) console.log(`  ✗ rebutted ${s.rebutted.length}: ${s.rebutted.join(', ')}`)
  if (s.retired.length) console.log(`  ⌫ retire ${s.retired.length}: ${s.retired.join(', ')}`)
  if (s.contradictions.length) console.log(`  ⁇ mâu thuẫn (chờ thêm tín hiệu): ${s.contradictions.join(', ')}`)
  console.log(`  → ${s.processedSignals} signal đã xử lý · ${s.activePrefs} preference đang sống`)
}
