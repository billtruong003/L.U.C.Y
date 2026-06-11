// evidence.ts — mạch "học thật" (A1): ghi {ts, prefId, kind:'applied'|'violated'} vào
// lucy-vault/Brain/log/<YYYY-MM-DD>.jsonl. dream.readEvidence đọc các dòng này → Wilson confidence →
// preference unconfirmed → confirmed. Trước A1: KHÔNG mạch nào ghi file này → pref kẹt unconfirmed mãi.
//
// Nguồn evidence (đều THẬT, deterministic — không bịa attribution):
//  • auto (trong dream): signal cùng dấu lặp lại trên 1 pref = applied (rule tái diễn) · ngược dấu = violated.
//  • tay (UI Bộ não): nút 👍 áp dụng / 👎 bác của Bill = ground-truth.
import fs from 'node:fs'
import path from 'node:path'

export type EvidenceKind = 'applied' | 'violated'

// ghi 1 dòng evidence. KHÔNG throw (ghi memory không được làm gãy pipeline). Trả true nếu ghi được.
export function recordEvidence(vaultDir: string, prefId: string, kind: EvidenceKind, ts: number = Date.now()): boolean {
  if (!prefId || (kind !== 'applied' && kind !== 'violated')) return false
  try {
    const dir = path.join(vaultDir, 'Brain', 'log')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, new Date(ts).toISOString().slice(0, 10) + '.jsonl')
    fs.appendFileSync(file, JSON.stringify({ ts, prefId, kind }) + '\n')
    return true
  } catch { return false }
}

// env-guard: chỉ ghi khi LUCY_VAULT trỏ vault thật (test/CI không set → no-op, không bẩn repo).
export function recordEvidenceSafe(prefId: string, kind: EvidenceKind): boolean {
  const vault = process.env.LUCY_VAULT
  if (!vault || !fs.existsSync(vault)) return false
  return recordEvidence(vault, prefId, kind)
}
