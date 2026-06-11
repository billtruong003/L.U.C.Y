// LaneRunner — chạy 1 stage bằng MODEL RẺ (OpenRouter/OpenCode-Zen…) qua lát API in-house.
// Cho model rẻ "tay" (read/write/edit/bash trong workspace) bằng OpenAI tool-calling → agentic
// như claude -p nhưng tốn ít token tiền. claude -p giữ cho orchestrator/critic (opus).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Runner } from './runner'
import { readActiveDigest, HOUSE_SKILL, OUTCOME_CONTRACT, extractOutcome, cleanReport } from './runner'
import { callLLMRaw, type RawMsg, type ToolDef } from './llm-lane'
import type { Card, Stage, Persona, RunResult, Outcome, Cost } from './types'

// Tool → quyền cần (map persona.allowedTools kiểu claude → tool lane). Least-privilege giữ nguyên.
const TOOL_PERM: Record<string, string> = { read_file: 'Read', list_dir: 'Read', write_file: 'Write', edit_file: 'Edit', bash: 'Bash' }

const ALL_TOOLS: ToolDef[] = [
  { type: 'function', function: { name: 'read_file', description: 'Đọc nội dung 1 file trong workspace.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'đường dẫn tương đối workspace' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'list_dir', description: 'Liệt kê file/thư mục.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'mặc định "."' } } } } },
  { type: 'function', function: { name: 'write_file', description: 'Ghi/đè 1 file (tạo thư mục cha nếu thiếu).', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Thay old_string → new_string trong file (old_string phải khớp đúng).', parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['path', 'old_string', 'new_string'] } } },
  { type: 'function', function: { name: 'bash', description: 'Chạy lệnh shell trong workspace (build/test/grep/git status…). Không git push, không đụng ngoài workspace.', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } } },
]

function S(a: Record<string, unknown>, k: string): string { const v = a[k]; return typeof v === 'string' ? v : v == null ? '' : String(v) }

function safePath(ws: string, p: string): string {
  const root = path.resolve(ws)
  const abs = path.resolve(ws, p)
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('đường dẫn ngoài workspace — bị chặn')
  return abs
}

function runBash(cmd: string, ws: string): Promise<string> {
  return new Promise((resolve) => {
    const ch = spawn(cmd, { cwd: ws, shell: true, env: { ...process.env, IS_SANDBOX: '1' } })
    let out = ''
    const timer = setTimeout(() => ch.kill(), 120000)
    ch.stdout.on('data', (d) => (out += d))
    ch.stderr.on('data', (d) => (out += d))
    ch.on('close', (code) => { clearTimeout(timer); resolve(((out || '(no output)').slice(0, 8000)) + (code ? `\n[exit ${code}]` : '')) })
    ch.on('error', (e) => { clearTimeout(timer); resolve(`ERROR spawn: ${e}`) })
  })
}

async function execTool(name: string, args: Record<string, unknown>, ws: string, allowed: Set<string>): Promise<string> {
  const need = TOOL_PERM[name]
  if (!need) return `ERROR: tool lạ "${name}"`
  if (!allowed.has(need)) return `ERROR: persona không được phép tool "${name}" (${need})`
  switch (name) {
    case 'read_file': { const c = fs.readFileSync(safePath(ws, S(args, 'path')), 'utf8'); return c.length > 30000 ? c.slice(0, 30000) + '\n…(cắt bớt)' : c }
    case 'list_dir': { const d = safePath(ws, S(args, 'path') || '.'); return fs.readdirSync(d, { withFileTypes: true }).map((e) => e.isDirectory() ? e.name + '/' : e.name).join('\n') || '(rỗng)' }
    case 'write_file': { const p = safePath(ws, S(args, 'path')); fs.mkdirSync(path.dirname(p), { recursive: true }); const c = S(args, 'content'); fs.writeFileSync(p, c); return `đã ghi ${S(args, 'path')} (${c.length} ký tự)` }
    case 'edit_file': { const p = safePath(ws, S(args, 'path')); const cur = fs.readFileSync(p, 'utf8'); const o = S(args, 'old_string'); if (!cur.includes(o)) return `ERROR: không thấy old_string trong ${S(args, 'path')}`; fs.writeFileSync(p, cur.replace(o, S(args, 'new_string'))); return `đã sửa ${S(args, 'path')}` }
    case 'bash': return runBash(S(args, 'cmd'), ws)
    default: return `ERROR: tool lạ "${name}"`
  }
}

// parse khối json outcome cuối → null nếu chưa có (để nudge tiếp, đừng dừng sớm).
function tryOutcome(text: string): Outcome | null {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1])
  // không có fence → thử tìm object có "decision" ở cuối
  if (!blocks.length) { const m = text.match(/\{[\s\S]*"decision"[\s\S]*\}\s*$/); if (m) blocks.push(m[0]) }
  const last = blocks.pop()
  if (!last) return null
  try { const o = JSON.parse(last) as Outcome; return o.decision ? o : null } catch { return null }
}

const LANE_NOTE = `

---
BẠN CHẠY QUA LÁT API (model rẻ) — có tool: read_file · list_dir · write_file · edit_file · bash. PHẢI dùng tool để
ĐỌC/KHẢO SÁT trước rồi mới sửa; tự chạy build/test bằng bash để verify. Xong việc bước này → trả khối JSON outcome (KHÔNG kèm tool_call).`

export class LaneRunner implements Runner {
  async run(card: Card, stage: Stage, persona: Persona, ws: string): Promise<RunResult> {
    const model = persona.laneModel || 'executor'
    const sys = readActiveDigest() + persona.systemPrompt + HOUSE_SKILL + OUTCOME_CONTRACT + LANE_NOTE
    const notes = card.reviewNotes?.length ? `\n\n⚠️ PHẢN HỒI cần SỬA:\n- ${card.reviewNotes.join('\n- ')}` : ''
    const prev = card.lastSummary ? `\n\n↪ Bước TRƯỚC: ${card.lastSummary}\n(đọc kết quả bước trước trong workspace, nối tiếp.)` : ''
    const user = `Card: ${card.title}\n\n${card.brief}\n\nStage hiện tại: ${stage.name}.${prev}${notes}`
    const allowed = new Set(persona.allowedTools ?? ['Read', 'Write', 'Edit', 'Bash'])
    const tools = ALL_TOOLS.filter((t) => allowed.has(TOOL_PERM[t.function.name]))
    const messages: RawMsg[] = [{ role: 'system', content: sys }, { role: 'user', content: user }]
    const cost: Cost = { usd: 0, inTok: 0, outTok: 0 } // model lane free → $0; vẫn đếm token
    const maxTurns = persona.maxTurns ?? 16
    let raw = ''
    for (let i = 0; i < maxTurns; i++) {
      let r
      try { r = await callLLMRaw(model, messages, { tools, maxTokens: 4096, timeoutMs: 90000 }) }
      catch (e) { return { outcome: { decision: 'fail', summary: `lane lỗi: ${String(e instanceof Error ? e.message : e).slice(0, 200)}` }, cost, raw } }
      if (r.usage) { cost.inTok += r.usage.prompt_tokens ?? 0; cost.outTok += r.usage.completion_tokens ?? 0 }
      const msg = r.message
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls })
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          let out: string
          try { const a = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>; out = await execTool(tc.function.name, a, ws, allowed) }
          catch (e) { out = `ERROR: ${String(e instanceof Error ? e.message : e)}` }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: out.slice(0, 8000) })
        }
        continue
      }
      raw = msg.content ?? ''
      const oc = tryOutcome(raw)
      if (oc) return { outcome: oc, cost, raw, report: cleanReport(raw) }
      // không tool, chưa có outcome → nhắc tiếp (chống dừng sớm khi model chỉ "nói")
      messages.push({ role: 'user', content: 'Tiếp tục: dùng tool nếu chưa xong, hoặc nếu đã xong bước này thì kết thúc bằng ĐÚNG khối JSON outcome.' })
    }
    // hết turn → đẩy lên người (an toàn, dùng extractOutcome cho thông điệp chuẩn)
    const fallback = extractOutcome(raw)
    return { outcome: fallback.decision === 'needs_decision' ? { decision: 'needs_decision', summary: `Lane agent (${model}) hết ${maxTurns} turn chưa kết luận`, question: 'Executor chạy hết turn mà chưa ra outcome — cần bạn xem.' } : fallback, cost, raw, report: cleanReport(raw) }
  }
}
