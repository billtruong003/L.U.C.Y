// Runner — thực thi 1 stage. Interface để swap Mock (free) <-> Claude thật <-> remote worker.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
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
    return { outcome, cost: this.cost, raw: '[mock]', report: `[mock] ${persona.name} @ ${stage.name}: ${outcome.summary}` }
  }
}

// ── ClaudeRunner: spawn claude -p THẬT. Không dùng trong demo mặc định (đốt token). ──
const OUTCOME_CONTRACT = `

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
const HOUSE_SKILL = `

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

GIAO TIẾP: gọn, thẳng việc. Báo cuối = 2-3 câu (làm gì + verify ra sao), không tự tâng. Kẹt -> nêu blocker + 2 lựa chọn + đề xuất.`

export class ClaudeRunner implements Runner {
  bin: string
  constructor(bin = process.env.CLAUDE_BIN || 'claude') { this.bin = bin }

  async run(card: Card, stage: Stage, persona: Persona, ws: string): Promise<RunResult> {
    const personaFile = path.join(ws, '.persona.md')
    fs.writeFileSync(personaFile, persona.systemPrompt + HOUSE_SKILL + OUTCOME_CONTRACT)
    const notes = card.reviewNotes?.length ? `\n\n⚠️ PHẢN HỒI cần SỬA (bị trả lại — fix kỹ những điểm này):\n- ${card.reviewNotes.join('\n- ')}` : ''
    const prev = card.lastSummary ? `\n\n↪ Bước TRƯỚC đã làm: ${card.lastSummary}\n(đọc kết quả bước trước trong workspace, nối tiếp — đừng làm lại từ đầu.)` : ''
    const prompt = `Card: ${card.title}\n\n${card.brief}\n\nStage hiện tại: ${stage.name}.${prev}${notes}`
    const args = [
      '-p', prompt, '--output-format', 'json', '--permission-mode', 'bypassPermissions',
      '--model', persona.model, '--append-system-prompt-file', personaFile,
      '--max-turns', String(persona.maxTurns ?? 40), // cho agent tự iterate sâu (đọc→sửa→test→fix)
      '--allowedTools', (persona.allowedTools ?? ['Read', 'Write', 'Edit', 'Bash']).join(','),
    ]
    const raw = await new Promise<string>((resolve) => {
      const ch = spawn(this.bin, args, { cwd: ws, env: { ...process.env, IS_SANDBOX: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      const timer = setTimeout(() => ch.kill(), (persona.timeoutSec ?? 600) * 1000)
      ch.stdout.on('data', (d) => (out += d))
      ch.on('close', () => { clearTimeout(timer); resolve(out) })
      ch.on('error', (e) => { clearTimeout(timer); resolve(JSON.stringify({ result: `spawn lỗi: ${e}` })) })
    })
    return parseClaude(raw)
  }
}

function parseClaude(raw: string): RunResult {
  let result = raw
  let cost: Cost = { usd: 0, inTok: 0, outTok: 0 }
  try {
    const d = JSON.parse(raw) as any
    result = d.result ?? raw
    cost = { usd: d.total_cost_usd ?? 0, inTok: d.usage?.input_tokens ?? 0, outTok: d.usage?.output_tokens ?? 0 }
  } catch { /* không phải JSON */ }
  return { outcome: extractOutcome(result), cost, raw, report: cleanReport(result) }
}

// C1: narrative "agent đã làm như nào" — bỏ khối JSON outcome ở cuối, cap để khỏi phình store.
function cleanReport(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```\s*$/i, '').trim().slice(0, 12000)
}

function extractOutcome(text: string): Outcome {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)]
  const last = blocks.pop()
  if (last) {
    try {
      const o = JSON.parse(last[1]) as Outcome
      if (o.decision) return o
    } catch { /* parse fail */ }
  }
  // không tuân contract -> raise gate để người xem (an toàn)
  return { decision: 'needs_decision', summary: 'Agent không trả JSON outcome đúng', question: 'Output không có outcome JSON hợp lệ — cần bạn xem.' }
}
