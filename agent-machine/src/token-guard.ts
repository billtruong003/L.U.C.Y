// TokenGuard — giới hạn token/ngày: soft → hạ executor, hard → pause nhận card.
// Persist daily counter vào file để sống qua restart pm2.
import fs from 'node:fs'
import path from 'node:path'

export const ENV_SOFT = 'AM_DAY_TOKEN_SOFT'
export const ENV_HARD = 'AM_DAY_TOKEN_HARD'

const DEFAULT_SOFT = 500_000
const DEFAULT_HARD = 1_000_000

export type TokenDayRecord = {
  date: string       // YYYY-MM-DD (UTC)
  inTok: number
  outTok: number
}

export type TokenGuardStatus = {
  ok: boolean        // false = hard reach → không tạo card mới
  soft: boolean      // true = soft reach → nên hạ executor
  hard: boolean      // true = hard reach → dừng
  used: number       // tổng (inTok + outTok) hôm nay
  softLimit: number
  hardLimit: number
  date: string
}

export class TokenGuard {
  private file: string
  private record: TokenDayRecord
  softLimit: number
  hardLimit: number

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'token-day.json')
    this.softLimit = Number(process.env[ENV_SOFT]) || DEFAULT_SOFT
    this.hardLimit = Number(process.env[ENV_HARD]) || DEFAULT_HARD
    this.record = this.load()
  }

  private today(): string {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  private load(): TokenDayRecord {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      const r = JSON.parse(raw) as TokenDayRecord
      if (r.date === this.today()) return r
    } catch { /* file hỏng / chưa có */ }
    return { date: this.today(), inTok: 0, outTok: 0 }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = this.file + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this.record))
      fs.renameSync(tmp, this.file)
    } catch { /* best-effort */ }
  }

  /** Cộng token vào counter ngày hiện tại. Tự động reset nếu sang ngày mới. */
  addTokens(inTok: number, outTok: number): void {
    const today = this.today()
    if (this.record.date !== today) {
      this.record = { date: today, inTok: 0, outTok: 0 }
    }
    this.record.inTok += Math.max(0, inTok)
    this.record.outTok += Math.max(0, outTok)
    this.save()
  }

  /** Tổng token đã dùng hôm nay */
  used(): number {
    this.ensureFresh()
    return this.record.inTok + this.record.outTok
  }

  private ensureFresh(): void {
    const today = this.today()
    if (this.record.date !== today) {
      this.record = { date: today, inTok: 0, outTok: 0 }
      this.save()
    }
  }

  /** Kiểm tra trạng thái */
  check(): TokenGuardStatus {
    this.ensureFresh()
    const used = this.used()
    return {
      ok: used < this.hardLimit,
      soft: used >= this.softLimit,
      hard: used >= this.hardLimit,
      used,
      softLimit: this.softLimit,
      hardLimit: this.hardLimit,
      date: this.record.date,
    }
  }

  /** Reset counter (cho smoke test / admin) */
  resetDay(): void {
    this.record = { date: this.today(), inTok: 0, outTok: 0 }
    this.save()
  }

  /** Ghi đè limits (cho smoke test) */
  setLimits(soft: number, hard: number): void {
    this.softLimit = soft
    this.hardLimit = hard
  }
}
