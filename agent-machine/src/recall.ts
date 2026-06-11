// recall.ts — FTS5 recall trên lucy-vault (M1). Trả lời "Lucy đã biết/làm cái này chưa?" 0-token.
// File markdown = SỰ THẬT; DB sidecar (.index/memory.db, đã gitignore) DỰNG LẠI ĐƯỢC từ file.
// Crib: basic-memory models/search.py (FTS5 DDL) + services/search_service.py (relaxed-OR fallback).
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { listVaultFiles, parseNote, slug } from './vault'

// CHỈ index trí nhớ "tra cứu được". KHÔNG index Brain/inbox|preferences|active.md (máy quản, nhiễu).
// Brain/claude-memory = auto-memory built-in của Claude Code REDIRECT vào vault (autoMemoryDirectory,
// fix "2 não" 2026-06-11) — harness ghi theo bản năng vẫn rơi vào đây → searchable như mọi note.
const INDEX_DIRS = ['Context', 'Projects', 'Skills', 'Daily', 'Brain/decisions', 'Brain/entities', 'Brain/claude-memory']

// stopword nhẹ VN+EN — chỉ dùng cho relaxed-OR fallback (đừng OR mấy từ rỗng nghĩa).
const STOPWORDS = new Set([
  'va', 'la', 'cua', 'co', 'cho', 'khi', 'thi', 'ma', 'cac', 'nhung', 'mot', 'da', 'duoc', 'nay', 'do', 'voi', 'tu', 've',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'and', 'or', 'with', 'at', 'by',
])

export type SearchHit = {
  file_path: string; title: string; type: string; permalink: string; tags: string
  mtime: number; snippet: string; rank: number; relaxed: boolean; tri?: boolean
}
export type RelatedHit = { file_path: string; title: string; permalink: string; via: string }
export type RecallStats = { indexed: number; updated: number; deleted: number; total: number }

export class Recall {
  private db: Database.Database
  readonly vaultDir: string
  readonly dbPath: string
  private triOk = true // SQLite thiếu tokenizer trigram (build cũ) → tắt fallback, không nổ

  constructor(vaultDir: string) {
    this.vaultDir = path.resolve(vaultDir)
    const indexDir = path.join(this.vaultDir, '.index')
    fs.mkdirSync(indexDir, { recursive: true })
    this.dbPath = path.join(indexDir, 'memory.db')
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
    this.backfillIfNeeded()
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
    // A5: đếm recall + lần recall cuối (ranking + curator). ALTER fail = cột đã có (DB cũ) → bỏ qua.
    try { this.db.exec('ALTER TABLE note ADD COLUMN recall_count INTEGER DEFAULT 0') } catch { /* đã có */ }
    try { this.db.exec('ALTER TABLE note ADD COLUMN last_recall_at REAL') } catch { /* đã có */ }
    // A7: cạnh wikilink → graph-walk recall ("hỏi A kéo theo note nối A").
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relation(source_id INTEGER, target TEXT, target_slug TEXT, rel TEXT);
      CREATE INDEX IF NOT EXISTS idx_rel_src ON relation(source_id);
      CREATE INDEX IF NOT EXISTS idx_rel_tgt ON relation(target_slug);
    `)
    // A6: FTS trigram cho substring/mã/tên riêng ("adiant" → radiant). Text BỎ DẤU sẵn lúc insert
    // (tokenizer trigram không có remove_diacritics). SQLite cũ thiếu trigram → tắt fallback.
    try {
      this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS note_tri USING fts5(title, body, note_id UNINDEXED, tokenize='trigram')`)
    } catch { this.triOk = false }
    this.db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)')
  }

  private static SCHEMA = '2' // bump khi thêm bảng dẫn xuất (trigram/relation) → full reindex 1 LẦN cho DB cũ
  private backfillIfNeeded() {
    const v = (this.db.prepare("SELECT value FROM meta WHERE key='schema'").get() as { value: string } | undefined)?.value
    if (v === Recall.SCHEMA) return
    const notes = (this.db.prepare('SELECT COUNT(*) c FROM note').get() as { c: number }).c
    if (notes) this.reindex({ full: true })
    this.db.prepare("INSERT INTO meta(key,value) VALUES('schema',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(Recall.SCHEMA)
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
    this.db.prepare('DELETE FROM relation WHERE source_id = ?').run(id)
    if (this.triOk) this.db.prepare('DELETE FROM note_tri WHERE rowid = ?').run(id)
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
    // A6 trigram: text bỏ dấu (tokenizer trigram không tự bỏ) → "tinh ha" khớp "tinh hà", "adiant" khớp "radiant".
    if (this.triOk) {
      this.db.prepare('DELETE FROM note_tri WHERE rowid = ?').run(id)
      this.db.prepare('INSERT INTO note_tri(rowid, title, body, note_id) VALUES (?,?,?,?)').run(id, fold(n.title), fold(n.body), id)
    }
    // A7 relation: cạnh wikilink ra khỏi note này (target giữ raw + slug để khớp permalink).
    this.db.prepare('DELETE FROM relation WHERE source_id = ?').run(id)
    const insRel = this.db.prepare('INSERT INTO relation(source_id, target, target_slug, rel) VALUES (?,?,?,?)')
    for (const r of n.relations) insRel.run(id, r.target, slug(r.target), r.type)
  }

  // ── SEARCH: FTS5 MATCH rank bm25 → relaxed-OR (≥2 token) → trigram substring (A6). ──
  // A5: hit nào trả ra → bump recall_count + last_recall_at (high-signal nổi dần, nuôi curator/brightness).
  search(query: string, opts: { type?: string; after?: number; limit?: number } = {}): SearchHit[] {
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 50))
    const tokens = tokenize(query)
    if (!tokens.length) return []
    const strict = tokens.map((t) => `"${t}"`).join(' ') // implicit AND, quote → an toàn ký tự đặc biệt
    let rows = this.runFts(strict, opts, limit)
    let relaxed = false, tri = false
    // relaxed: strict rỗng + ≥2 token + query không có toán tử rõ ràng → OR (bỏ stopword).
    if (!rows.length && tokens.length >= 2 && !/["*]/.test(query)) {
      const kept = tokens.filter((t) => !STOPWORDS.has(t))
      const terms = kept.length ? kept : tokens
      rows = this.runFts(terms.map((t) => `"${t}"`).join(' OR '), opts, limit)
      relaxed = rows.length > 0
    }
    // trigram: vẫn rỗng + query ≥3 ký tự → khớp SUBSTRING ("adiant"→radiant, "hmac"→x-hmac-sig).
    if (!rows.length && this.triOk && fold(query).length >= 3) {
      rows = this.runTri(fold(query), opts, limit)
      tri = rows.length > 0
    }
    if (rows.length) this.bump(rows.map((r) => r.file_path))
    return rows.map((r) => ({ ...r, relaxed, ...(tri ? { tri } : {}) }))
  }

  private bump(filePaths: string[]) {
    try {
      const up = this.db.prepare('UPDATE note SET recall_count = recall_count + 1, last_recall_at = ? WHERE file_path = ?')
      const now = Date.now()
      for (const f of filePaths) up.run(now, f)
    } catch { /* thống kê — không được làm gãy search */ }
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
        ORDER BY rank, n.recall_count DESC, n.mtime DESC LIMIT ?
      `).all(...params) as Omit<SearchHit, 'relaxed'>[]
    } catch { return [] } // FTS5 syntax error (query lạ) → coi như 0 kết quả, không nổ
  }

  private runTri(foldedQuery: string, opts: { type?: string; after?: number }, limit: number): Omit<SearchHit, 'relaxed'>[] {
    const where: string[] = ['note_tri MATCH ?']
    const params: unknown[] = [`"${foldedQuery.replace(/"/g, '')}"`]
    if (opts.type) { where.push('n.type = ?'); params.push(opts.type) }
    if (opts.after) { where.push('n.mtime >= ?'); params.push(opts.after) }
    params.push(limit)
    try {
      return this.db.prepare(`
        SELECT n.file_path, n.title, n.type, n.permalink, n.tags, n.mtime,
               snippet(note_tri, 1, '«', '»', '…', 14) AS snippet, bm25(note_tri) AS rank
        FROM note_tri JOIN note n ON n.id = note_tri.rowid
        WHERE ${where.join(' AND ')}
        ORDER BY rank, n.recall_count DESC, n.mtime DESC LIMIT ?
      `).all(...params) as Omit<SearchHit, 'relaxed'>[]
    } catch { return [] }
  }

  // ── A7 GRAPH-WALK: từ các hit, đi theo cạnh wikilink 1 bước (cả 2 chiều) → note liên quan ──
  // "hỏi A → kéo kèm note nối A" (crib basic-memory build_context). Loại chính các hit khỏi kết quả.
  related(hitFilePaths: string[], limit = 8): RelatedHit[] {
    if (!hitFilePaths.length) return []
    try {
      const qMarks = hitFilePaths.map(() => '?').join(',')
      const seeds = this.db.prepare(`SELECT id, permalink, file_path FROM note WHERE file_path IN (${qMarks})`)
        .all(...hitFilePaths) as { id: number; permalink: string; file_path: string }[]
      if (!seeds.length) return []
      const seedIds = seeds.map((s) => s.id)
      const seedPaths = new Set(seeds.map((s) => s.file_path))
      const out: RelatedHit[] = []
      const seen = new Set<string>()
      const push = (r: { file_path: string; title: string; permalink: string }, via: string) => {
        if (seedPaths.has(r.file_path) || seen.has(r.file_path) || out.length >= limit) return
        seen.add(r.file_path); out.push({ ...r, via })
      }
      // chiều RA: hit → [[target]] (target khớp permalink/slug của note khác)
      const ids = seedIds.map(() => '?').join(',')
      const outs = this.db.prepare(`
        SELECT n.file_path, n.title, n.permalink, r.rel FROM relation r
        JOIN note n ON (n.permalink = r.target OR n.permalink = r.target_slug)
        WHERE r.source_id IN (${ids})
      `).all(...seedIds) as { file_path: string; title: string; permalink: string; rel: string }[]
      for (const r of outs) push(r, r.rel || 'liên kết')
      // chiều VÀO: note khác → [[hit]]
      const perms = seeds.flatMap((s) => [s.permalink, s.permalink]) // (target, target_slug) per seed
      const pMarks = seeds.map(() => '(r.target = ? OR r.target_slug = ?)').join(' OR ')
      const ins = this.db.prepare(`
        SELECT n.file_path, n.title, n.permalink, r.rel FROM relation r
        JOIN note n ON n.id = r.source_id
        WHERE ${pMarks}
      `).all(...perms) as { file_path: string; title: string; permalink: string; rel: string }[]
      for (const r of ins) push(r, '← ' + (r.rel || 'liên kết'))
      return out
    } catch { return [] }
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

// fold: lowercase + bỏ dấu + đ→d — chuẩn hoá cho bảng trigram (tokenizer trigram không tự bỏ dấu).
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
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
