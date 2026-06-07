// Smoke card-management — defer/backlog + activate + remove (xoá rác/lỗi). No token burn. Exit 1 nếu fail.
import fs from 'node:fs'
import path from 'node:path'
import { Store } from './store'
import { Budget } from './budget'
import { Engine } from './engine'
import { MockRunner } from './runner'
import type { Outcome } from './types'

let pass = 0
let fail = 0
const check = (n: string, c: boolean, e = '') => { if (c) { pass++; console.log(`  ✅ ${n}`) } else { fail++; console.log(`  ❌ ${n} ${e}`) } }
const clean = (p: string) => fs.rmSync(p, { recursive: true, force: true })

function setup(dir: string) {
  clean(dir)
  const store = new Store(dir)
  store.registerPersona({ id: 'eng', name: 'Eng', systemPrompt: 'x', model: 'sonnet' })
  store.registerPipeline({ id: 'one', name: 'One', stages: [{ id: 'fix', name: 'Fix', personaId: 'eng' }] })
  const script = { fix: { decision: 'advance', summary: 'ok' } } as Record<string, Outcome>
  const engine = new Engine(store, new MockRunner(script), new Budget({ windowMs: 5 * 3600e3, capUsd: 99 }), { maxLanes: 4 })
  return { store, engine }
}

async function main() {
  console.log('🧪 card-management smoke (defer / activate / remove)')
  const dir = path.join(process.cwd(), '.smoke-mgmt')
  const { store, engine } = setup(dir)

  // ── DEFER: tạo backlog -> KHÔNG dispatch ──
  const d = engine.createCard('để sau', 'b', 'one', undefined, 0, 'default', true)
  check('defer -> status backlog', d.status === 'backlog')
  engine.tick()
  check('backlog KHÔNG bị dispatch (vẫn backlog)', store.getCard(d.id)!.status === 'backlog', `(got ${store.getCard(d.id)!.status})`)

  // ── ACTIVATE: backlog -> queued -> chạy ──
  engine.activate(d.id)
  check('activate -> queued', store.getCard(d.id)!.status === 'queued')
  engine.tick(); await engine.drainLocal()
  check('sau activate chạy tới done', store.getCard(d.id)!.status === 'done', `(got ${store.getCard(d.id)!.status})`)
  check('activate id không hợp lệ -> no-op (không throw)', (engine.activate('nope'), true))

  // ── REMOVE: xoá card rác ──
  const r = engine.createCard('rác', 'b', 'one')
  check('removeCard trả true', engine.removeCard(r.id) === true)
  check('card biến mất khỏi store', store.getCard(r.id) === undefined)
  check('removeCard id không tồn tại -> false', engine.removeCard('nope') === false)

  // ── REMOVE card đang in-flight: dọn sạch pending/inFlight, job mồ côi KHÔNG chạy ──
  const w = engine.createCard('đang bay', 'b', 'one')
  engine.tick() // -> working + pending
  check('card vào working sau tick', store.getCard(w.id)!.status === 'working', `(got ${store.getCard(w.id)!.status})`)
  engine.removeCard(w.id)
  check('remove working card -> mất khỏi store', store.getCard(w.id) === undefined)
  const ran = await engine.drainLocal()
  check('job mồ côi không chạy (drain = 0)', ran === 0, `(ran=${ran})`)

  // ── card backlog KHÔNG đếm là queued (limits) ──
  engine.createCard('backlog2', 'b', 'one', undefined, 0, 'default', true)
  check('backlog không tính vào queued', engine.limits().queued === 0, `(queued=${engine.limits().queued})`)

  // ── MODEL OVERRIDE: card ép opus -> claim trả persona.model = opus (local lẫn remote) ──
  const mo = engine.createCard('ép opus', 'b', 'one', undefined, 0, 'default', false, 'opus')
  check('card lưu modelOverride', store.getCard(mo.id)!.modelOverride === 'opus')
  engine.tick()
  const spec = engine.claim()
  check('claim áp model = opus', spec?.persona.model === 'opus', `(got ${spec?.persona.model})`)
  check('persona gốc KHÔNG bị đổi (clone, không mutate)', store.personas.get('eng')!.model === 'sonnet')
  check('project KHÔNG repo -> claim.repo undefined', spec?.repo === undefined)

  // ── PROJECT first-class ──
  const pj = engine.createProject('Game ABC', { repoUrl: 'https://github.com/x/abc' })
  check('createProject lưu repoUrl', store.getProject('Game ABC')?.repoUrl === 'https://github.com/x/abc')
  check('project có kênh "general" mặc định', store.getProject('Game ABC')!.channels.includes('general'))
  check('createProject idempotent (cùng tên không nhân đôi)', engine.createProject('Game ABC').id === pj.id && store.listProjects().filter((p) => p.id === 'Game ABC').length === 1)
  engine.createCard('t', 'b', 'one', undefined, 0, 'Dự án mới X')
  check('tạo card AUTO tạo project', !!store.getProject('Dự án mới X'))
  check('removeProject bị chặn khi còn card', engine.removeProject('Dự án mới X') === false)
  check('removeProject rỗng OK', engine.removeProject('Game ABC') === true)

  // ── R2: project có repoUrl -> claim gắn repo cho worker clone ──
  engine.createProject('repo-proj', { repoUrl: 'https://github.com/x/y', branch: 'dev' })
  const rc = engine.createCard('work', 'b', 'one', undefined, 0, 'repo-proj')
  engine.tick()
  let rs = engine.claim(); let guard = 0
  while (rs && rs.cardId !== rc.id && guard++ < 12) rs = engine.claim()
  check('claim gắn repo.url khi project có repoUrl', rs?.repo?.url === 'https://github.com/x/y', `(got ${rs?.repo?.url})`)
  check('claim gắn repo.branch', rs?.repo?.branch === 'dev', `(got ${rs?.repo?.branch})`)

  clean(dir)
  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'} — ${pass} pass, ${fail} fail`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
