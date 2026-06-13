// Runner — thực thi 1 stage. Interface để swap Mock (free) <-> Claude thật <-> remote worker.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { resolveClaude } from './claude-bin'
import { loadSkillBlock } from './skill-loader'
import { readAgentBrain } from './agent-brain'
import { NoopTurnLogger, type TurnLogger } from './turn-log'
import type { Card, Stage, Persona, RunResult, Outcome, Cost } from './types'

export interface Runner {
  run(card: Card, stage: Stage, persona: Persona, ws: string): Promise<RunResult>
}

// ── MockRunner: outcome theo stage.id — CHỨNG MINH loop, KHÔNG đốt token ──
export class MockRunner implements Runner {
  script: Record<string, Outcome>
  cost: Cost
  constructor(script: Record<string, Outcome>, cost: Cost = { usd: 0.02, inTok: 1200, outTok: 400 }) {
    this.script = script
    this.cost = cost
  }
  async run(card: Card, stage: Stage, persona: Persona, _ws: string): Promise<RunResult> {
    await new Promise((r) => setTimeout(r, 30))
    const outcome = this.script[stage.id] ?? { decision: 'advance', summary: `(${persona.name}) xong "${stage.name}"` }
    return { outcome, cost: this.cost, raw: '[mock]', report: `[mock] ${persona.name} @ ${stage.name}: ${outcome.summary}`, sessionId: `mock-${card.id}-${persona.id}` }
  }
}

// ── ClaudeRunner: spawn claude -p THẬT. Không dùng trong demo mặc định (đốt token). ──
export const OUTCOME_CONTRACT = `

---
QUY TẮC KẾT THÚC (BẮT BUỘC): bạn chỉ đang làm 1 BƯỚC trong quy trình nhiều bước. Làm xong phần việc của
BƯỚC HIỆN TẠI thì kết thúc câu trả lời bằng ĐÚNG MỘT khối JSON (không thêm chữ nào sau nó):
\`\`\`json
{"decision":"advance|rework|needs_decision|delegate|fail","summary":"tóm tắt 1 câu","question":"(chỉ khi needs_decision)"}
\`\`\`
- "advance" = xong việc bước này, CHUYỂN sang bước kế (DÙNG mặc định khi hoàn thành tốt — KHÔNG tự kết thúc cả quy trình).
- "rework" = (review/test) PHÁT HIỆN LỖI / CHƯA ĐẠT → TRẢ LẠI bước trước sửa. BẮT BUỘC liệt kê vấn đề cụ thể (file:dòng + cách sửa) trong summary.
- "needs_decision" = cần người quyết · "delegate" = nhờ persona khác · "fail" = hỏng nặng không cứu được.`

// HOUSE_SKILL — kỷ luật kỹ sư UNIVERSAL gắn cho MỌI persona (chắt từ bộ SKILL.md chuẩn
// của Bill: arena-server/arena-unity + SOUL Hermes). Phần identity/domain riêng nằm ở persona.
export const HOUSE_SKILL = `

---
KỶ LUẬT KỸ SƯ (áp dụng MỌI việc):

ĐỌC TRƯỚC KHI LÀM:
- Repo có sẵn: đọc cấu trúc + file/spec/doc liên quan TRƯỚC. BÁM stack/convention/style đang có — KHÔNG bịa shape mới, KHÔNG đổi tên field/contract đang dùng, KHÔNG áp framework lạ. Tôn trọng contract (API/schema/interface) như luật.

NGUYÊN TẮC CODE:
- Strict: không 'any' (dùng 'unknown' + narrow). Validate input ở biên. Không magic number — hằng số đặt tên. Lỗi thì throw, KHÔNG nuốt im. Comment giải thích TẠI SAO, không phải CÁI GÌ.
- Làm ĐÚNG phạm vi, KHÔNG over-engineer, KHÔNG dependency/abstraction thừa. "Đơn giản đủ dùng" > "tổng quát hoành tráng".

DEFINITION OF DONE (tự verify TRƯỚC khi báo xong):
- Biên dịch sạch (typecheck), test xanh nếu có, build chạy; chạy thử bằng Bash khi làm được. KHÔNG báo "xong" nếu chưa tự kiểm.

CHỐNG BỊA (cứng):
- Chưa chắc -> KIỂM TRA (đọc file, ls, grep, chạy thử) rồi mới nói. KHÔNG giả định API/đường dẫn/hàm tồn tại. KHÔNG bịa số liệu/kết quả. Gặp lỗi -> đọc output lỗi THẬT để báo, không chế nguyên nhân.

AN TOÀN (cứng):
- CHỈ thao tác trong workspace hiện tại. Không xoá/sửa ngoài, không 'rm -rf' bừa, không 'git push', không log/đụng secret/token. Việc phá huỷ hoặc quyết định chủ quan (đổi contract, giá trị tuning) -> DỪNG hỏi (needs_decision), đừng tự quyết.

GIAO TIẾP: gọn, thẳng việc. Báo cuối = 2-3 câu (làm gì + verify ra sao), không tự tâng. Kẹt -> nêu blocker + 2 lựa chọn + đề xuất.

TRÍ NHỚ (nếu thấy thư mục lucy-vault/ trong dir được phép):
- TRƯỚC khi làm: đọc lucy-vault/Context/ (Bill là ai) + lucy-vault/Projects/<dự án liên quan> để bám bối cảnh — ĐỪNG hỏi lại cái đã ghi.
- Học được điều đáng nhớ (sở thích Bill / quyết định / pattern lặp lại) -> tạo file lucy-vault/Brain/inbox/sig-<YYYY-MM-DD>-<slug>.md ĐÚNG khung sau (sai format = hệ bỏ qua im lặng):
---
kind: brain-signal
id: sig-<YYYY-MM-DD>-<slug-ngắn>
created_at: <ISO-8601 UTC, vd 2026-06-11T08:00:00.000Z>
topic: <projectId>/<pattern-chung-kebab>
signal: positive|negative
agent: lucy
principle: <quy tắc 1 câu, dạng hành động>
evidenced_by: [<cardId nếu biết>]
---
  topic phần sau "/" = PATTERN CHUNG card khác cũng dính được (vd "hardcode-config") — KHÔNG phải tên card. KHÔNG ghi lỗi môi trường/transient/chuyện 1 lần.
- KHÔNG sửa lucy-vault/Brain/preferences/ hay active.md (máy quản). CẤM ghi trí nhớ vào auto-memory built-in của Claude Code (~/.claude/**/memory/) — vault là não DUY NHẤT, ghi chỗ khác = lạc trôi khỏi recall/dream.`

// Ráp system prompt agent: digest đã-học + skill khớp card + persona + kỷ luật chung + contract (+ extra của lane).
// 1 NGUỒN DUY NHẤT cho cả ClaudeRunner & LaneRunner → khử lặp, giữ thứ tự nối byte-identical (prompt-cache parity).
export function buildSystemPrompt(card: Card, persona: Persona, extra = ''): string {
  return readActiveDigest() + readAgentBrain(persona.id) + loadSkillBlock(card) + persona.systemPrompt + HOUSE_SKILL + OUTCOME_CONTRACT + extra
}

export class ClaudeRunner implements Runner {
  bin: string
  turnLogger: TurnLogger
  constructor(bin = process.env.CLAUDE_BIN || 'claude', turnLogger: TurnLogger = new NoopTurnLogger()) {
    this.bin = bin
    this.turnLogger = turnLogger
  }

  async run(card: Card, stage: Stage, persona: Persona, ws: string): Promise<RunResult> {
    const personaFile = path.join(ws, '.persona.md')
    // TRÍ NHỚ: prepend digest preference Lucy ĐÃ HỌC (Brain/active.md do dream sinh) vào ĐẦU system prompt.
    // Strip dòng timestamp "Cập nhật:" → prefix byte-ổn định giữa các lượt (giữ prompt-cache parity).
    fs.writeFileSync(personaFile, buildSystemPrompt(card, persona))
    // C3.1: reviewNotes slice(-3) — chỉ 3 ghi chú gần nhất vào prompt, tránh phình khi rework nhiều lần
    const recentNotes = card.reviewNotes?.slice(-3) ?? []
    const notes = recentNotes.length ? `\n\n⚠️ PHẢN HỒI cần SỬA (bị trả lại — fix kỹ những điểm này):\n- ${recentNotes.join('\n- ')}` : ''
    const prev = card.lastSummary ? `\n\n↪ Bước TRƯỚC đã làm: ${card.lastSummary}\n(đọc kết quả bước trước trong workspace, nối tiếp — đừng làm lại từ đầu.)` : ''
    // C3.2: brief truncation khi rework (≥ 2 lần cùng stage) — workspace đã có context, brief dài chỉ phình token
    const stageVisitCount = card.stageVisits?.[stage.id] ?? 0
    const briefText = stageVisitCount >= 2 && card.brief.length > 800
      ? card.brief.slice(0, 800) + `\n...[còn ${card.brief.length - 800} ký tự — workspace có context đủ, đọc file nếu cần]`
      : card.brief
    const prompt = `Card: ${card.title}\n\n${briefText}\n\nStage hiện tại: ${stage.name}.${prev}${notes}`
    // prompt đi qua STDIN (không phải arg): né giới hạn command-line Windows + né escaping khi cần shell (shim .ps1/.cmd).
    const baseArgs = [
      '-p', '--output-format', 'json', '--permission-mode', 'bypassPermissions',
      '--model', persona.model, '--append-system-prompt-file', personaFile,
      '--max-turns', String(persona.maxTurns ?? 12), // cap turn = chặn đốt token/thời gian (40 cũ → 5 phút/task). Persona tự khai trong config.
      '--allowedTools', (persona.allowedTools ?? ['Read', 'Write', 'Edit', 'Bash']).join(','),
    ]
    // TRÍ NHỚ: cho agent đọc/ghi vault bền (Lucy "biết" Bill + dự án xuyên phiên). Vault ổn định mọi stage → giữ prompt-cache parity.
    const vault = process.env.LUCY_VAULT
    if (vault && fs.existsSync(vault)) baseArgs.push('--add-dir', vault)
    const timeoutSec = persona.timeoutSec ?? 300
    // CACHE: cùng (card, persona, stage) chạy lại (rework) → --resume session cũ để agent NHỚ đã đọc/sửa gì, KHỎI quét lại project (đỡ token).
    // Key kèm stageIndex: cùng persona ở stage khác nhau KHÔNG resume nhầm session (C3.3).
    const resumeId = card.sessions?.[`${persona.id}:${card.stageIndex}`]
    let r = await this.spawn(resumeId ? [...baseArgs, '--resume', resumeId] : baseArgs, ws, timeoutSec, prompt)
    if (resumeId && r.code !== 0 && !r.out.trim()) r = await this.spawn(baseArgs, ws, timeoutSec, prompt) // resume hỏng (session ở máy khác / đã xoá) → chạy mới
    const res = parseClaude(r.out)
    // SALVAGE: agent làm xong nhưng quên JSON → suy ra outcome thay vì bounce/loop (gặp nhiều).
    if (res.outcome.summary === NO_JSON) res.outcome = await salvageOutcome(res.report || res.raw, stage.name)
    // Turn log (1 record/run) — đủ cho error-stats phân loại outcome/decision
    const common = { agent: persona.id, task: card.id, stage: stage.id, model: persona.model, turnCount: 0, token: res.cost.inTok + res.cost.outTok }
    if (r.code !== 0 && !res.report) {
      this.turnLogger.log({ ...common, motive: 'claude -p spawn thất bại', action: 'error', outcome: res.raw.slice(0, 500) })
    } else {
      const motive = (res.report || res.raw).split('\n')[0].slice(0, 200) || 'claude -p run'
      this.turnLogger.log({ ...common, motive, action: 'outcome', outcome: res.outcome.summary, decision: res.outcome.decision })
    }
    return res
  }

  private spawn(args: string[], ws: string, timeoutSec: number, stdin: string): Promise<{ out: string; code: number | null }> {
    return new Promise((resolve) => {
      // Windows: resolve claude.exe THẬT (né shim .cmd ENOENT + cmd-quoting-hell lồng shell — chết im tuỳ shell cha).
      const r = resolveClaude(this.bin)
      const opts = { cwd: ws, env: { ...process.env, IS_SANDBOX: '1' }, stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'] }
      const ch = r.shell
        ? spawn([r.bin, ...args].map((a) => `"${a}"`).join(' '), { ...opts, shell: true })
        : spawn(r.bin, args, opts)
      let out = ''
      const timer = setTimeout(() => ch.kill(), timeoutSec * 1000) // kill runaway (600 cũ → 10 phút). Persona tự khai.
      ch.stdout.on('data', (d) => (out += d))
      ch.on('close', (code) => { clearTimeout(timer); resolve({ out, code }) })
      ch.on('error', (e) => { clearTimeout(timer); resolve({ out: JSON.stringify({ result: `spawn lỗi: ${e}` }), code: 1 }) })
      ch.stdin.on('error', () => { /* EPIPE khi claude chết sớm — đã có 'error'/'close' lo */ })
      ch.stdin.write(stdin); ch.stdin.end()
    })
  }
}

// đọc Brain/active.md → digest preference đã học (bỏ frontmatter + dòng timestamp volatile).
// Trả '' nếu chưa có vault / chưa học gì → KHÔNG chèn nhiễu, giữ prefix ổn định.
export function readActiveDigest(): string {
  const vault = process.env.LUCY_VAULT
  if (!vault) return ''
  try {
    const raw = fs.readFileSync(path.join(vault, 'Brain', 'active.md'), 'utf8')
    const body = raw.replace(/^---[\s\S]*?\n---\n/, '').replace(/^>.*Cập nhật:.*$/m, '').trim()
    if (!/^- /m.test(body)) return '' // chưa có preference nào (chỉ placeholder) → bỏ qua
    return `TRÍ NHỚ ĐÃ HỌC (Lucy nhớ về chủ + dự án — tôn trọng, đừng hỏi lại):\n${body}\n\n---\n`
  } catch { return '' }
}

function parseClaude(raw: string): RunResult {
  let result = raw
  let cost: Cost = { usd: 0, inTok: 0, outTok: 0 }
  let sessionId: string | undefined
  try {
    const d = JSON.parse(raw) as any
    result = d.result ?? raw
    cost = { usd: d.total_cost_usd ?? 0, inTok: d.usage?.input_tokens ?? 0, outTok: d.usage?.output_tokens ?? 0 }
    sessionId = d.session_id || undefined // CACHE: lưu để rework --resume
  } catch { /* không phải JSON */ }
  return { outcome: extractOutcome(result), cost, raw, report: cleanReport(result), sessionId }
}

// C1: narrative "agent đã làm như nào" — bỏ khối JSON outcome ở cuối, cap để khỏi phình store.
export function cleanReport(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```\s*$/i, '').trim().slice(0, 12000)
}

export function extractOutcome(text: string): Outcome {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)]
  const last = blocks.pop()
  if (last) {
    try {
      const o = JSON.parse(last[1]) as Outcome
      if (o.decision) return o
    } catch { /* parse fail */ }
  }
  // không tuân contract -> raise gate để người xem (an toàn)
  return { decision: 'needs_decision', summary: NO_JSON, question: 'Output không có outcome JSON hợp lệ — cần bạn xem.' }
}

// Sentinel: agent QUÊN khối JSON outcome (gặp NHIỀU, nhất là model rẻ / task rộng).
export const NO_JSON = 'Agent không trả JSON outcome đúng'

// claude -p single-shot (no tool) — để SALVAGE: đọc output thô → suy ra outcome.
function claudeClassify(prompt: string, model: string, timeoutSec = 90): Promise<string> {
  return new Promise((resolve) => {
    const r = resolveClaude(process.env.CLAUDE_BIN || 'claude')
    const args = ['-p', '--output-format', 'json', '--permission-mode', 'bypassPermissions', '--model', model, '--max-turns', '1']
    const o = { env: { ...process.env, IS_SANDBOX: '1' }, stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'] }
    const ch = r.shell ? spawn([r.bin, ...args].map((a) => `"${a}"`).join(' '), { ...o, shell: true }) : spawn(r.bin, args, o)
    let out = ''
    const timer = setTimeout(() => ch.kill(), timeoutSec * 1000)
    ch.stdout.on('data', (d) => (out += d))
    ch.on('close', () => { clearTimeout(timer); try { resolve(JSON.parse(out).result ?? out) } catch { resolve(out) } })
    ch.on('error', () => { clearTimeout(timer); resolve('') })
    ch.stdin.on('error', () => { /* EPIPE */ })
    ch.stdin.write(prompt); ch.stdin.end()
  })
}

// SALVAGE outcome: agent làm việc nhưng quên JSON → đọc report → suy ra advance/rework/needs_decision.
// Tránh bounce-sang-người / loop. Model rẻ-ish (sonnet) đủ để classify.
export async function salvageOutcome(report: string, stageName: string): Promise<Outcome> {
  if (!report || report.length < 20) return { decision: 'needs_decision', summary: NO_JSON, question: 'Agent không có output để cứu — cần bạn xem.' }
  const model = process.env.AM_SALVAGE_MODEL || 'sonnet'
  const prompt = `Một agent vừa làm xong bước "${stageName}" NHƯNG quên kết thúc bằng khối JSON outcome theo contract.
Dựa vào OUTPUT của nó, SUY RA outcome đúng:
- advance: đã làm xong tốt phần việc bước này.
- rework: có lỗi / chưa đạt rõ ràng.
- needs_decision: thật sự cần người quyết (mơ hồ / thiếu thông tin chỉ người biết).
OUTPUT của agent:
"""
${report.slice(0, 7000)}
"""
Trả về DUY NHẤT 1 khối JSON: {"decision":"advance|rework|needs_decision","summary":"<1 câu>"}`
  const raw = await claudeClassify(prompt, model)
  const o = extractOutcome(raw)
  if (o.summary === NO_JSON) return { decision: 'needs_decision', summary: 'Không cứu được outcome (cả salvage cũng lỗi)', question: 'Cần bạn xem.' }
  return o
}
