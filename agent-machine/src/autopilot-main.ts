// Autopilot poller — "Lucy trực đêm". Process riêng (như worker), CẦN có claude (chạy director opus).
// Poll /state → gate nào không phải deploy/security → Lucy-director đọc & /approve hoặc /reject.
// Bật = chạy process này; tắt = kill. max quyết/phiên chống đốt token đêm.
import { isProtectedGate, directorDecide, directorAnswer } from './autopilot'
import type { Card, Persona, Pipeline } from './types'

const URL = process.env.AM_COORD_URL || 'http://127.0.0.1:8780'
const TOKEN = process.env.AM_TOKEN || ''
const POLL = Number(process.env.AM_AUTOPILOT_POLL_MS || 6000)
const MAX = Number(process.env.AM_AUTOPILOT_MAX || 100)
const headers: Record<string, string> = { 'content-type': 'application/json', ...(TOKEN ? { 'x-worker-token': TOKEN } : {}) }

let decisions = 0
const inFlight = new Set<string>()
const escalated = new Set<string>() // 'decision' Lucy không tự quyết được → để Bill, không hỏi lại mỗi tick

async function post(p: string, body: object): Promise<void> {
  try { await fetch(URL + p, { method: 'POST', headers, body: JSON.stringify(body) }) } catch { /* coordinator tạm mất */ }
}

async function tick(): Promise<void> {
  let state: { cards?: Card[]; personas?: Persona[]; pipelines?: Pipeline[] }
  try { state = await fetch(URL + '/state', { headers }).then((r) => r.json()) } catch { return }
  const personas = Object.fromEntries((state.personas || []).map((p) => [p.id, p]))
  const pipes = Object.fromEntries((state.pipelines || []).map((p) => [p.id, p]))
  for (const c of state.cards || []) {
    if (decisions >= MAX) return
    if (c.status !== 'waiting_human' || inFlight.has(c.id) || escalated.has(c.id)) continue
    if (c.waitKind !== 'gate' && c.waitKind !== 'decision') continue // cost/loop → để Bill
    const pipe = pipes[c.pipelineId]
    const stage = pipe?.stages[c.stageIndex]
    const persona = stage ? personas[stage.personaId] : undefined
    if (isProtectedGate(pipe, persona)) continue // deploy/security → để Bill
    const proj = c.projectId || 'default'
    inFlight.add(c.id)
    try {
      if (c.waitKind === 'gate') {
        const d = await directorDecide(c, stage?.name || '?')
        decisions++
        const tag = d.action === 'approve' ? '✅ DUYỆT' : '↩ TRẢ LẠI'
        await post('/channel/post', { projectId: proj, channel: 'general', text: `🌙 Lucy trực đêm — ${tag} "${c.title}": ${d.reason}` })
        if (d.action === 'approve') await post('/approve', { cardId: c.id })
        else await post('/reject', { cardId: c.id, feedback: `[Lucy trực đêm] ${d.reason}` })
        console.log(`[autopilot] ${tag} "${c.title}" — ${d.reason}`)
      } else { // 'decision' — agent hỏi / chưa kết luận → Lucy trả lời/nhích thay (hoặc ESCALATE)
        const ans = await directorAnswer(c, stage?.name || '?')
        decisions++
        if (/^ESCALATE/i.test(ans)) {
          escalated.add(c.id)
          await post('/channel/post', { projectId: proj, channel: 'general', text: `🌙 Lucy trực đêm — ESCALATE "${c.title}": cần Bill quyết.` })
          console.log(`[autopilot] ESCALATE "${c.title}" → để Bill`)
        } else {
          await post('/channel/post', { projectId: proj, channel: 'general', text: `🌙 Lucy trực đêm — trả lời "${c.title}": ${ans.slice(0, 180)}` })
          await post('/answer', { cardId: c.id, text: `[Lucy trực đêm] ${ans}` })
          console.log(`[autopilot] 💬 answered "${c.title}" — ${ans.slice(0, 120)}`)
        }
      }
    } catch (e) { console.error('[autopilot] lỗi', String(e instanceof Error ? e.message : e)) }
    finally { inFlight.delete(c.id) }
  }
}

async function loop(): Promise<void> {
  console.log(`🌙 Lucy autopilot → ${URL}  (duyệt thay ở gate + trả lời decision, TRỪ deploy/security; max ${MAX} quyết/phiên; poll ${POLL}ms)`)
  for (;;) {
    await tick()
    if (decisions >= MAX) { console.log('[autopilot] đạt max quyết — DỪNG (chống đốt token đêm). Restart để reset.'); return }
    await new Promise((s) => setTimeout(s, POLL))
  }
}
loop().catch((e) => { console.error(e); process.exit(1) })
