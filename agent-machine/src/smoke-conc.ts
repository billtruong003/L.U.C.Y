// Smoke concurrency — worker cap N chạy SONG SONG (vd VPS cap 2). Exit 1 nếu fail.
import fs from 'node:fs'
import path from 'node:path'
import { Store } from './store'
import { Budget } from './budget'
import { Engine } from './engine'
import { MockRunner } from './runner'
import { startCoordinator } from './coordinator'
import { runWorker } from './worker'
import type { Outcome } from './types'

let pass = 0
let fail = 0
const check = (n: string, c: boolean, e = '') => { if (c) { pass++; console.log(`  ✅ ${n}`) } else { fail++; console.log(`  ❌ ${n} ${e}`) } }
const sleep = (ms: number) => new Promise((s) => setTimeout(s, ms))

const PORT = Number(process.env.AM_CONC_PORT || 8794)
const URL = `http://127.0.0.1:${PORT}`
const TOKEN = 'conc'

async function main() {
  console.log('🧪 concurrency smoke — worker cap N song song (no token burn)')
  const dir = path.join(process.cwd(), '.smoke-conc'); fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(path.join(process.cwd(), '.worker'), { recursive: true, force: true })
  const store = new Store(dir)
  store.registerPersona({ id: 'eng', name: 'Eng', systemPrompt: 'x', model: 'sonnet' })
  store.registerPipeline({ id: 'one', name: 'One stage', stages: [{ id: 'fix', name: 'Fix', personaId: 'eng' }] })
  // mock 'fix' mất ~120ms -> nếu tuần tự 4 job ≈ 480ms; song song cap 2 ≈ 240ms
  const slow = new MockRunner({ fix: { decision: 'done', summary: 'done' } } as Record<string, Outcome>, { usd: 0.001, inTok: 1, outTok: 1 })
  const engine = new Engine(store, slow, new Budget({ windowMs: 5 * 3600e3, capUsd: 99 }), { maxLanes: 8 })
  const co = startCoordinator(engine, store, PORT, { token: TOKEN })
  await sleep(120)

  const N = 4
  for (let i = 0; i < N; i++) engine.createCard(`job${i}`, 'b', 'one')
  while (engine.tick() > 0) { /* dispatch hết N job vào queue */ }

  // worker MOCK chậm (120ms/job) nhưng concurrency 2 -> 2 chạy cùng lúc
  const slowWorker = new MockRunner({ fix: { decision: 'done', summary: 'done' } } as Record<string, Outcome>)
  // ép mỗi job ~120ms ở phía worker
  ;(slowWorker as any).run = async () => { await sleep(120); return { outcome: { decision: 'done', summary: 'done' }, cost: { usd: 0.001, inTok: 1, outTok: 1 }, raw: '' } }

  const t0 = Date.now()
  await runWorker(URL, slowWorker, { token: TOKEN, concurrency: 2, stopWhenIdle: true, localRoot: path.join(process.cwd(), '.worker') })
  const elapsed = Date.now() - t0

  const st = (await (await fetch(URL + '/state')).json()) as { cards: any[] }
  check(`tất cả ${N} card DONE`, st.cards.filter((c) => c.status === 'done').length === N, `(done=${st.cards.filter((c) => c.status === 'done').length})`)
  // 4 job × 120ms: tuần tự ≈480ms; cap 2 ≈ ~240-360ms. Nới ngưỡng cho chắc.
  check(`song song nhanh hơn tuần tự (elapsed ${elapsed}ms < 440ms)`, elapsed < 440, `(${elapsed}ms)`)

  co.stop()
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(path.join(process.cwd(), '.worker'), { recursive: true, force: true })
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'} — ${pass} pass, ${fail} fail`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
