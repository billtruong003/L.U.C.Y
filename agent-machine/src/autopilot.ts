// Autopilot — "Lucy trực đêm": tự đẻ sprint + duyệt thay Bill ở gate.
// Director = claude -p OPUS (điều hướng, single-shot, đọc báo cáo → quyết). KHÔNG tự duyệt
// gate deploy/bảo mật/secret (để Bill). claude -p chạy ở process này (worker/VPS có claude).
import { spawn } from 'node:child_process'
import { resolveClaude } from './claude-bin'
import type { Card, Persona, Pipeline } from './types'

// Gate KHÔNG auto-duyệt (chọn của Bill: "duyệt hết trừ deploy/secret"):
const PROTECTED_PERSONAS = new Set(['devops', 'security'])
const PROTECTED_PIPELINES = new Set(['secure-ship'])
export function isProtectedGate(pipeline: Pipeline | undefined, persona: Persona | undefined): boolean {
  if (persona && PROTECTED_PERSONAS.has(persona.id)) return true
  if (pipeline && PROTECTED_PIPELINES.has(pipeline.id)) return true
  return false
}

// claude -p single-shot (no tools) — Lucy "điều hướng". model mặc định opus (Bill: opus để điều hướng).
function claudeOneShot(prompt: string, opts: { model?: string; timeoutSec?: number } = {}): Promise<string> {
  const model = opts.model || process.env.AM_DIRECTOR_MODEL || 'opus'
  const timeoutSec = opts.timeoutSec ?? 150
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

export function lastJson(text: string): unknown {
  if (!text) return null
  const cands: string[] = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1])
  cands.push(text)
  const arr = text.match(/\[[\s\S]*\]/); if (arr) cands.push(arr[0])
  const obj = text.match(/\{[\s\S]*\}/); if (obj) cands.push(obj[0])
  for (const c of cands) { try { return JSON.parse(c.trim()) } catch { /* next */ } }
  return null
}

export interface GateDecision { action: 'approve' | 'return'; reason: string }

export async function directorDecide(card: Card, stageName: string): Promise<GateDecision> {
  const reports = (card.reports || []).slice(-4).map((r) => `### ${r.persona} @ ${r.stage}\n${r.text.slice(0, 1500)}`).join('\n\n')
  const files = card.artifacts?.files?.length ? `\nFILE đổi: ${card.artifacts.files.slice(0, 30).join(', ')}` : ''
  const diff = card.artifacts?.diffstat ? `\nDIFFSTAT:\n${card.artifacts.diffstat.slice(0, 1500)}` : ''
  const prompt = `Bạn là Lucy — trợ lý của Bill, đang TRỰC ĐÊM duyệt THAY anh ấy tại 1 checkpoint (gate).
Đọc báo cáo + thay đổi rồi QUYẾT: cho qua (approve) hay trả lại sửa (return).

TASK: ${card.title}
YÊU CẦU (done là gì): ${card.brief}
GATE ở bước: ${stageName}
BÁO CÁO các bước trước:
${reports || '(không có báo cáo — đáng ngờ)'}${files}${diff}

TIÊU CHÍ: chỉ approve khi báo cáo cho thấy ĐÚNG yêu cầu + agent đã tự verify (build/test thật) + không lỗi nặng/bịa.
Thiếu verify / lệch yêu cầu / nghi ngờ → return kèm lý do CỤ THỂ để bước trước sửa. Khi phân vân → return (an toàn hơn).
Trả về DUY NHẤT 1 dòng JSON: {"action":"approve"|"return","reason":"<ngắn gọn vì sao>"}`
  const raw = await claudeOneShot(prompt)
  const j = lastJson(raw) as Partial<GateDecision> | null
  if (j && (j.action === 'approve' || j.action === 'return') && typeof j.reason === 'string') return j as GateDecision
  return { action: 'return', reason: 'Lucy-director không đọc được kết quả rõ ràng → trả lại cho chắc (an toàn).' }
}

export interface SprintCard { title: string; brief: string; pipelineId: string }

export async function generateSprint(opts: { projectName: string; projectId: string; goal: string; pipelines: string[]; existingTitles: string[] }): Promise<SprintCard[]> {
  const prompt = `Bạn là Okabe — orchestrator của Lucy. Bill giao 1 mục tiêu cho dự án; hãy CHIA thành 3-7 card công việc
ĐỘC LẬP, mỗi card nhỏ gọn (làm trong ~vài bước), chọn ĐÚNG pipeline có sẵn. Brief mỗi card nêu rõ "done là gì".

DỰ ÁN: ${opts.projectName} (id: ${opts.projectId})
MỤC TIÊU: ${opts.goal}
PIPELINE có sẵn (chỉ được chọn trong các id này): ${opts.pipelines.join(', ')}
CARD đã có (ĐỪNG tạo trùng): ${opts.existingTitles.slice(0, 20).join(' | ') || '(chưa có)'}

Trả về DUY NHẤT 1 JSON array (không thêm chữ): [{"title":"...","brief":"...","pipelineId":"<id>"}]`
  const raw = await claudeOneShot(prompt, { timeoutSec: 200 })
  const arr = lastJson(raw)
  if (!Array.isArray(arr)) return []
  const valid = new Set(opts.pipelines)
  return arr
    .filter((c): c is SprintCard => !!c && typeof c.title === 'string' && typeof c.brief === 'string' && valid.has(c.pipelineId))
    .slice(0, 10)
}
