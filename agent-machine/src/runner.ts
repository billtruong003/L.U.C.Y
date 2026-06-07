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
    return { outcome, cost: this.cost, raw: '[mock]' }
  }
}

// ── ClaudeRunner: spawn claude -p THẬT. Không dùng trong demo mặc định (đốt token). ──
const OUTCOME_CONTRACT = `

---
KHI XONG STAGE: kết thúc câu trả lời bằng ĐÚNG MỘT khối JSON (không thêm chữ sau nó):
\`\`\`json
{"decision":"advance|done|needs_decision|delegate|fail","summary":"tóm tắt 1 câu","question":"(chỉ khi needs_decision)"}
\`\`\``

export class ClaudeRunner implements Runner {
  bin: string
  constructor(bin = process.env.CLAUDE_BIN || 'claude') { this.bin = bin }

  async run(card: Card, stage: Stage, persona: Persona, ws: string): Promise<RunResult> {
    const personaFile = path.join(ws, '.persona.md')
    fs.writeFileSync(personaFile, persona.systemPrompt + OUTCOME_CONTRACT)
    const prompt = `Card: ${card.title}\n\n${card.brief}\n\nStage: ${stage.name}.`
    const args = [
      '-p', prompt, '--output-format', 'json', '--permission-mode', 'bypassPermissions',
      '--model', persona.model, '--append-system-prompt-file', personaFile,
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
  return { outcome: extractOutcome(result), cost, raw }
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
