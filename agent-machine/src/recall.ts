// recall.ts — FTS5 recall trên lucy-vault (M1). Trả lời "Lucy đã biết/làm cái này chưa?" 0-token.
// File markdown = SỰ THẬT; DB sidecar (.index/memory.db, đã gitignore) DỰNG LẠI ĐƯỢC từ file.
// Crib: basic-memory models/search.py (FTS5 DDL) + services/search_service.py (relaxed-OR fallback).
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { listVaultFiles, parseNote } from './vault'

// CHỈ index trí nhớ "tra cứu được". KHÔNG index Brain/inbox|preferences|active.md (máy quản, nhiễu).
const INDEX_DIRS = ['Context', 'Projects', 'Skills', 'Daily', 'Brain/decisions', 'Brain/entities']

// stopword nhẹ VN+EN — chỉ dùng cho relaxed-OR fallback (đừng OR mấy từ rỗng nghĩa).
const STOPWORDS = new Set([
  'va', 'la', 'cua', 'co', 'cho', 'khi', 'thi', 'ma', 'cac', 'nhung', 'mot', 'da', 'duoc', 'nay', 'do', 'voi', 'tu', 've',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'and', 'or', 'with', 'at', 'by',
])

export type SearchHit = {
  file_path: string; title: string; type: string; permalink: string; tags: string
  mtime: number; snippet: string; rank: number; relaxed: boolean
}
export type RecallStats = { indexed: number; updated: number; deleted: number; total: number }

export class Recall {
  private db: Database.Database
  readonly vaultDir: string
  readonly dbPath: string

  constructor(vaultDir: string) {
    this.vaultDir = path.resolve(vaultDir)
    const indexDir = path.join(this.vaultDir, '.index')
    fs.mkdirSync(indexDir, { recursive: true })
    this.dbPath = path.join(indexDir, 'memory.db')
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS note(
        id INTEGER PRIMARY KEY,
        file_path TEXT UNIQUE, title TEXT, type TEXT, permalink TEXT, tags TEXT,
        mtime REAL, checksum TEXT, frontmatter TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
        title, body, tags, permalink UNINDEXED, file_path UNINDEXED, note_id UNINDEXED,
        tokenize='unicode61 remove_diacritics 2 tokenchars 0x2F', prefix='2,3,4');
      CREATE VIRTUAL TABLE IF NOT EXISTS obs_fts USING fts5(
        category, content, tags, note_id UNINDEXED,
        tokenize='unicode61 remove_diacritics 2');
    `)
  }

  close() { this.db.close() }

  // ── REINDEX: so mtime+sha256 với row note; đổi → re-parse → upsert. Xoá note mất file. ──
  // full=true → drop sạch rồi dựng lại từ file (lệnh `lucy reindex`).
  reindex(opts: { full?: boolean } = {}): RecallStats {
    if (opts.full) this.db.exec('DELETE FROM note; DELETE FROM note_fts; DELETE FROM obs_fts;')
    const files = listVaultFiles(this.vaultDir, INDEX_DIRS)
    const stats: RecallStats = { indexed: 0, updated: 0, deleted: 0, total: 0 }
    const getNote = this.db.prepare('SELECT id, checksum FROM note WHERE file_path = ?')
    const seen = new Set<string>()

    const run = this.db.transaction(() => {
      for (const rel of files) {
        seen.add(rel)
        const abs = path.join(this.vaultDir, rel)
        let raw: string, mtime: number
        try { raw = fs.readFileSync(abs, 'utf8'); mtime = fs.statSync(abs).mtimeMs } catch { continue }
        const checksum = crypto.createHash('sha256').update(raw).digest('hex')
        const existing = getNote.get(rel) as { id: number; checksum: string } | undefined
        if (existing && existing.checksum === checksum) continue // không đổi → bỏ qua
        this.upsertNote(rel, raw, mtime, checksum)
        if (existing) stats.updated++; else stats.indexed++
      }
      // dọn note có trong DB nhưng file đã mất
      const all = this.db.prepare('SELECT id, file_path FROM note').all() as { id: number; file_path: string }[]
      for (const n of all) {
        if (seen.has(n.file_path)) continue
        this.deleteNote(n.id)
        stats.deleted++
      }
    })
    run()
    stats.total = (this.db.prepare('SELECT COUNT(*) c FROM note').get() as { c: number }).c
    return stats
  }

  private deleteNote(id: number) {
    this.db.prepare('DELETE FROM note WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM note_fts WHERE rowid = ?').run(id) // note_fts rowid = note.id (1-1)
    this.db.prepare('DELETE FROM obs_fts WHERE note_id = ?').run(id)
  }

  private upsertNote(rel: string, raw: string, mtime: number, checksum: string) {
    const n = parseNote(raw, rel)
    const tagsStr = n.tags.join(' ')
    this.db.prepare(`
      INSERT INTO note(file_path, title, type, permalink, tags, mtime, checksum, frontmatter)
      VALUES (@file_path, @title, @type, @permalink, @tags, @mtime, @checksum, @frontmatter)
      ON CONFLICT(file_path) DO UPDATE SET
        title=@title, type=@type, permalink=@permalink, tags=@tags, mtime=@mtime, checksum=@checksum, frontmatter=@frontmatter
    `).run({
      file_path: rel, title: n.title, type: n.type, permalink: n.permalink, tags: tagsStr,
      mtime, checksum, frontmatter: JSON.stringify(n.frontmatter),
    })
    const id = (this.db.prepare('SELECT id FROM note WHERE file_path = ?').get(rel) as { id: number }).id
    // note_fts: rowid = note.id → update = delete-by-rowid + insert (rẻ, chuẩn FTS5).
    this.db.prepare('DELETE FROM note_fts WHERE rowid = ?').run(id)
    this.db.prepare('INSERT INTO note_fts(rowid, title, body, tags, permalink, file_path, note_id) VALUES (?,?,?,?,?,?,?)')
      .run(id, n.title, n.body, tagsStr, n.permalink, rel, id)
    // obs_fts: nhiều row/note → xoá theo note_id rồi chèn lại.
    this.db.prepare('DELETE FROM obs_fts WHERE note_id = ?').run(id)
    const insObs = this.db.prepare('INSERT INTO obs_fts(category, content, tags, note_id) VALUES (?,?,?,?)')
    for (const o of n.observations) insObs.run(o.category ?? '', o.content, o.tags.join(' '), id)
  }

  // ── SEARCH: FTS5 MATCH rank bm25. Relaxed-OR fallback khi strict 0 và ≥3 token. ──
  search(query: string, opts: { type?: string; after?: number; limit?: number } = {}): SearchHit[] {
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 50))
    const tokens = tokenize(query)
    if (!tokens.length) return []
    const strict = tokens.map((t) => `"${t}"`).join(' ') // implicit AND, quote → an toàn ký tự đặc biệt
    let rows = this.runFts(strict, opts, limit)
    let relaxed = false
    // relaxed: strict rỗng + ≥2 token + query không có toán tử rõ ràng → OR (bỏ stopword).
    // (≥3 cũ làm query 2 từ miss trắng tay — audit 2026-06-11.)
    if (!rows.length && tokens.length >= 2 && !/["*]/.test(query)) {
      const kept = tokens.filter((t) => !STOPWORDS.has(t))
      const terms = kept.length ? kept : tokens
      rows = this.runFts(terms.map((t) => `"${t}"`).join(' OR '), opts, limit)
      relaxed = rows.length > 0
    }
    return rows.map((r) => ({ ...r, relaxed }))
  }

  private runFts(matchExpr: string, opts: { type?: string; after?: number }, limit: number): Omit<SearchHit, 'relaxed'>[] {
    const where: string[] = ['note_fts MATCH ?']
    const params: unknown[] = [matchExpr]
    if (opts.type) { where.push('n.type = ?'); params.push(opts.type) }
    if (opts.after) { where.push('n.mtime >= ?'); params.push(opts.after) }
    params.push(limit)
    try {
      return this.db.prepare(`
        SELECT n.file_path, n.title, n.type, n.permalink, n.tags, n.mtime,
               snippet(note_fts, 1, '«', '»', '…', 14) AS snippet, bm25(note_fts) AS rank
        FROM note_fts JOIN note n ON n.id = note_fts.rowid
        WHERE ${where.join(' AND ')}
        ORDER BY rank LIMIT ?
      `).all(...params) as Omit<SearchHit, 'relaxed'>[]
    } catch { return [] } // FTS5 syntax error (query lạ) → coi như 0 kết quả, không nổ
  }

  // ── RECENT: note theo mtime desc. timeframe = "7d" | "24h" | "30d" (optional). ──
  recent(opts: { timeframe?: string; type?: string; limit?: number } = {}): Omit<SearchHit, 'snippet' | 'rank' | 'relaxed'>[] {
    const limit = Math.max(1, Math.min(opts.limit ?? 15, 100))
    const where: string[] = []
    const params: unknown[] = []
    const cutoff = parseTimeframe(opts.timeframe)
    if (cutoff) { where.push('mtime >= ?'); params.push(cutoff) }
    if (opts.type) { where.push('type = ?'); params.push(opts.type) }
    params.push(limit)
    return this.db.prepare(`
      SELECT file_path, title, type, permalink, tags, mtime FROM note
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY mtime DESC LIMIT ?
    `).all(...params) as Omit<SearchHit, 'snippet' | 'rank' | 'relaxed'>[]
  }

  stats(): { total: number; observations: number } {
    return {
      total: (this.db.prepare('SELECT COUNT(*) c FROM note').get() as { c: number }).c,
      observations: (this.db.prepare('SELECT COUNT(*) c FROM obs_fts').get() as { c: number }).c,
    }
  }
}

// tokenize: lấy từ unicode (chữ+số), lowercase + bỏ dấu (khớp remove_diacritics 2 của FTS).
function tokenize(s: string): string[] {
  const m = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[\p{L}\p{N}]+/gu)
  return m ? m.filter((t) => t.length > 0) : []
}

function parseTimeframe(tf?: string): number | null {
  if (!tf) return null
  const m = tf.trim().match(/^(\d+)\s*([dhwm])$/i)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const ms = unit === 'h' ? 3600e3 : unit === 'w' ? 7 * 86400e3 : unit === 'm' ? 30 * 86400e3 : 86400e3
  return Date.now() - n * ms
}

// helper: mở Recall nếu LUCY_VAULT trỏ tới vault thật, ngược lại null (graceful — feature off).
export function openRecallFromEnv(): Recall | null {
  const vault = process.env.LUCY_VAULT
  if (!vault || !fs.existsSync(vault)) return null
  try { return new Recall(vault) } catch { return null }
}
