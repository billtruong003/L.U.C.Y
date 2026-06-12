// Autopilot poller — "Lucy trực đêm". Process riêng (như worker), CẦN có claude (chạy director opus).
// Poll /state → gate nào không phải deploy/security → Lucy-director đọc & /approve hoặc /reject.
// Bật = chạy process này; tắt = kill. max quyết/phiên chống đốt token đêm.
import { isProtectedGate, directorDecide, directorAnswer, directorCost } from './autopilot'
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

const HARD_USD = Number(process.env.AM_CARD_HARD_USD || 8) // trần cost/card: vượt → ESCALATE Bill

// BỨC TRANH DỰ ÁN: sprint overview (mọi card cùng dự án + status) → director thấy toàn cảnh, hết "phán ngáo".
function buildCtx(card: Card, allCards: Card[]): string {
  const pid = card.projectId || 'default'
  const sibs = allCards.filter((x) => (x.projectId || 'default') === pid)
  const lines = sibs.map((x) => `  - [${x.status}${x.waitKind ? '/' + x.waitKind : ''}] $${(x.cost?.usd || 0).toFixed(2)} ${x.title}${x.id === card.id ? '   ← ĐANG XÉT' : ''}`).join('\n')
  return `Dự án "${pid}" — ${sibs.length} card trong sprint:\n${lines}`
}

async function tick(): Promise<void> {
  let state: { cards?: Card[]; personas?: Persona[]; pipelines?: Pipeline[] }
  try { state = await fetch(URL + '/state', { headers }).then((r) => r.json()) } catch { return }
  const personas = Object.fromEntries((state.personas || []).map((p) => [p.id, p]))
  const pipes = Object.fromEntries((state.pipelines || []).map((p) => [p.id, p]))
  const cards = state.cards || []
  for (const c of cards) {
    if (decisions >= MAX) return
    if (c.status !== 'waiting_human' || inFlight.has(c.id) || escalated.has(c.id)) continue
    if (c.waitKind !== 'gate' && c.waitKind !== 'decision' && c.waitKind !== 'cost') continue // 'loop' → để Bill
    const pipe = pipes[c.pipelineId]
    const stage = pipe?.stages[c.stageIndex]
    const persona = stage ? personas[stage.personaId] : undefined
    if (isProtectedGate(pipe, persona)) continue // deploy/security → để Bill
    const proj = c.projectId || 'default'
    const ctx = buildCtx(c, cards) // TOÀN CẢNH cho director
    const sn = stage?.name || '?'
    const say = (text: string) => post('/channel/post', { projectId: proj, channel: 'general', text })
    const esc = async (reason: string, kind: string) => { escalated.add(c.id); await say(`🌙 Lucy trực đêm — ESCALATE (${kind}) "${c.title}": ${reason}`); console.log(`[autopilot] ESCALATE(${kind}) "${c.title}" — ${reason}`) }
    inFlight.add(c.id)
    try {
      if (c.waitKind === 'gate') {
        const d = await directorDecide(c, sn, ctx); decisions++
        if (d.action === 'escalate') { await esc(d.reason, 'gate') }
        else {
          const tag = d.action === 'approve' ? '✅ DUYỆT' : '↩ TRẢ LẠI'
          await say(`🌙 Lucy trực đêm — ${tag} "${c.title}": ${d.reason}`)
          await post(d.action === 'approve' ? '/approve' : '/reject', d.action === 'approve' ? { cardId: c.id } : { cardId: c.id, feedback: `[Lucy trực đêm] ${d.reason}` })
          console.log(`[autopilot] ${tag} "${c.title}" — ${d.reason}`)
        }
      } else if (c.waitKind === 'decision') {
        const ans = await directorAnswer(c, sn, ctx); decisions++
        if (/^ESCALATE/i.test(ans)) await esc('cần Bill quyết', 'decision')
        else { await say(`🌙 Lucy trực đêm — trả lời "${c.title}": ${ans.slice(0, 180)}`); await post('/answer', { cardId: c.id, text: `[Lucy trực đêm] ${ans}` }); console.log(`[autopilot] 💬 answered "${c.title}" — ${ans.slice(0, 120)}`) }
      } else { // 'cost' — Lucy quản tiền
        decisions++
        if ((c.cost?.usd || 0) >= HARD_USD) { await esc(`đã $${(c.cost?.usd || 0).toFixed(2)} ≥ trần $${HARD_USD}`, 'cost') }
        else {
          const d = await directorCost(c, sn, ctx)
          if (d.action === 'continue') { await say(`🌙 Lucy trực đêm — 💰 CẤP THÊM "${c.title}" (tiếp): ${d.reason}`); await post('/approve', { cardId: c.id }); console.log(`[autopilot] 💰 continue "${c.title}" — ${d.reason}`) }
          else await esc(d.reason, 'cost')
        }
      }
    } catch (e) { console.error('[autopilot] lỗi', String(e instanceof Error ? e.message : e)) }
    finally { inFlight.delete(c.id) }
  }
}

async function loop(): Promise<void> {
  console.log(`🌙 Lucy autopilot → ${URL}  (gate + decision + cost, thấy TOÀN CẢNH dự án; trần $${HARD_USD}/card; TRỪ deploy/security; max ${MAX} quyết; poll ${POLL}ms)`)
  for (;;) {
    await tick()
    if (decisions >= MAX) { console.log('[autopilot] đạt max quyết — DỪNG (chống đốt token đêm). Restart để reset.'); return }
    await new Promise((s) => setTimeout(s, POLL))
  }
}
loop().catch((e) => { console.error(e); process.exit(1) })
