// agent-brain — não NGHỀ riêng từng persona (C4 / Track C1).
// Mỗi persona tích luỹ bài học theo thời gian → lần sau prepend vào system prompt (như active.md),
// để agent giỏi dần ở nghề mình, bớt lặp lỗi cũ → bớt rework/đốt token.
// Nguồn bài học = review feedback (rework) + card done — KHÔNG cần LLM call riêng.
// Ghi vào lucy-vault/Brain/agents/<personaId>.md (máy quản, KHÁC Brain/preferences & active.md).
import fs from 'node:fs'
import path from 'node:path'

const MAX_LESSONS = 12       // giữ N bài gần nhất → prompt không phình, cache-parity ổn
const MAX_LESSON_LEN = 220

function agentsDir(): string | null {
  const vault = process.env.LUCY_VAULT
  if (!vault) return null
  return path.join(vault, 'Brain', 'agents')
}

function fileFor(personaId: string): string | null {
  const dir = agentsDir()
  if (!dir || !/^[a-z0-9_-]+$/i.test(personaId)) return null // chặn path traversal
  return path.join(dir, `${personaId}.md`)
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, MAX_LESSON_LEN)
}

/** Đọc não nghề của persona → digest chèn vào system prompt. '' nếu chưa học gì (giữ prefix ổn định). */
export function readAgentBrain(personaId: string): string {
  const f = fileFor(personaId)
  if (!f) return ''
  try {
    const raw = fs.readFileSync(f, 'utf8')
    const lessons = raw.split('\n').filter((l) => l.trim().startsWith('- '))
    if (!lessons.length) return ''
    const recent = lessons.slice(-MAX_LESSONS).join('\n')
    return `NÃO NGHỀ CỦA BẠN (đã học từ các lần trước — tránh lặp lỗi cũ, phát huy cái đúng):\n${recent}\n\n---\n`
  } catch { return '' }
}

/** Ghi 1 bài học cho persona. kind: 'miss' = bị trả lại/lỗi · 'win' = hoàn thành tốt. Dedup + cap N. */
export function appendAgentLesson(personaId: string, lesson: string, kind: 'miss' | 'win'): void {
  const f = fileFor(personaId)
  if (!f) return
  const text = clean(lesson)
  if (text.length < 8) return // bỏ bài rỗng/vô nghĩa
  const day = new Date().toISOString().slice(0, 10)
  const line = `- [${kind === 'miss' ? '⚠️ tránh' : '✅ tốt'} · ${day}] ${text}`
  try {
    const dir = path.dirname(f)
    fs.mkdirSync(dir, { recursive: true })
    let lines: string[] = []
    try { lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim().startsWith('- ')) } catch { /* file mới */ }
    // dedup theo nội dung (bỏ tiền tố ngày/kind) → không nhồi lặp
    const sig = (l: string) => l.replace(/^- \[[^\]]*\]\s*/, '').toLowerCase()
    if (lines.some((l) => sig(l) === sig(line))) return
    lines.push(line)
    const kept = lines.slice(-MAX_LESSONS * 2) // giữ rộng hơn cap đọc một chút (lịch sử)
    const header = `# Não nghề — \`${personaId}\`\n\n> Máy quản (engine ghi từ review/done). Lần sau persona này chạy sẽ tự nạp ${MAX_LESSONS} bài gần nhất.\n\n`
    fs.writeFileSync(f, header + kept.join('\n') + '\n')
  } catch { /* ghi não không critical — nuốt lỗi để không hỏng card */ }
}
