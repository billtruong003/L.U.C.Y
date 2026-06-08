// Lucy Hub API client
export async function me(): Promise<{ authed: boolean; twofa?: boolean }> {
  const r = await fetch('/api/me')
  return r.json()
}

export async function login(password: string, code?: string): Promise<{ ok: boolean; need_code?: boolean; bad_code?: boolean }> {
  const r = await fetch('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password, code }),
  })
  try { return await r.json() } catch { return { ok: r.ok } }
}

// scope: chuỗi key (vd 'proj:<id>') → Lucy DỰ ÁN dùng phiên độc lập, KHÔNG đụng chat tổng. Bỏ trống = chat tổng.
export async function send(prompt: string, opus: boolean, scope?: string) {
  const r = await fetch('/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, opus, scope }),
  })
  return r.json() as Promise<{ job_id: string }>
}

export async function chatHistory(): Promise<{ messages: { role: 'me' | 'lucy'; text: string; t: number }[] }> {
  const r = await fetch('/api/chat'); return r.json()
}
export async function newChat() { await fetch('/api/chat/new', { method: 'POST' }) }

export type Poll = {
  status: string
  result: string | null
  elapsed: number
  model: string
  session_id: string | null
}
export async function poll(jobId: string): Promise<Poll> {
  const r = await fetch('/api/poll/' + jobId)
  return r.json()
}

export type JobRow = { id: string; status: string; model: string; prompt: string; elapsed: number }
export async function jobs(): Promise<{ jobs: JobRow[] }> {
  const r = await fetch('/api/jobs'); return r.json()
}

// ---- Agent-Machine (Board + Channels) ----
export type AmCard = {
  id: string; title: string; brief: string; pipelineId: string; projectId: string; stageIndex: number
  status: string; depth: number; blockedBy: string[]; pendingQuestion?: string
  parentId?: string; cost: { usd: number }; updatedAt?: number; reviewNotes?: string[]
  workspace?: string; artifacts?: { files?: string[]; diffstat?: string; stage?: string; isRepo?: boolean }
  lastSummary?: string; waitKind?: 'gate' | 'decision' | 'cost' | 'loop'; blockKind?: 'dep' | 'delegate'
  history?: { ts: number; stage: string; event: string; detail?: string }[]
  reports?: { stage: string; persona: string; text: string; ts: number }[] // C1: narrative đầy đủ agent đã làm gì mỗi stage
}
export type AmMsg = { ts: number; channel: string; author: string; kind: string; text: string; cardId?: string }
export type AmStage = { id: string; name: string; personaId: string; gate?: boolean }
export type AmPipeline = { id: string; name: string; stages: AmStage[] }
export type AmPersona = { id: string; name: string; avatar?: string; model?: string }
export type AmProject = { id: string; name: string; repoUrl?: string; branch?: string; description?: string; skill?: string; channels: string[]; createdAt: number; updatedAt?: number; trashed?: boolean }
export async function amState(): Promise<{ configured: boolean; offline?: boolean; cards: AmCard[]; projects?: AmProject[]; channels: AmMsg[]; pipelines?: AmPipeline[]; personas?: AmPersona[] }> {
  const r = await fetch('/api/am/state'); return r.json()
}
export async function amCreateProject(name: string, opts: { repoUrl?: string; branch?: string; description?: string; skill?: string } = {}) {
  const r = await fetch('/api/am/project', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, ...opts }) }); return r.json()
}
export async function amRemoveProject(projectId: string) {
  await fetch('/api/am/project/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) })
}
export async function amTrashProject(projectId: string) { await fetch('/api/am/project/trash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) }) }
export async function amRestoreProject(projectId: string) { await fetch('/api/am/project/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) }) }
export async function amPurgeProject(projectId: string) { await fetch('/api/am/project/purge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId }) }) }
export async function amAddChannel(projectId: string, name: string) {
  await fetch('/api/am/project/channel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, name }) })
}
export async function amPostChannel(projectId: string, channel: string, text: string, mention?: string) {
  await fetch('/api/am/channel/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, channel, text, mention }) })
}
export async function amLogLucy(projectId: string, role: 'me' | 'lucy', text: string) {
  await fetch('/api/am/lucy/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, role, text }) })
}
export async function amUpsertPipeline(p: { id?: string; name: string; stages: { name: string; personaId: string; gate?: boolean }[] }) {
  const r = await fetch('/api/am/pipeline', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }); return r.json()
}
export async function amRemovePipeline(id: string) {
  await fetch('/api/am/pipeline/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
}
export async function amConfig(): Promise<{ configured: boolean; offline?: boolean; maxLanes?: number; perCardMaxUsd?: number; queued?: number; inFlight?: number }> {
  const r = await fetch('/api/am/config'); return r.json()
}
export async function amSetLanes(maxLanes: number) {
  const r = await fetch('/api/am/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxLanes }) }); return r.json()
}
export async function amCreateCard(title: string, brief: string, pipelineId: string, projectId: string, deferred = false, model?: 'sonnet' | 'opus', blockedBy?: string[]) {
  const r = await fetch('/api/am/card', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, brief, pipelineId, projectId, deferred, model, blockedBy }) }); return r.json()
}
export async function amRemoveCard(cardId: string) {
  await fetch('/api/am/card/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId }) })
}
export async function amActivate(cardId: string) {
  await fetch('/api/am/card/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId }) })
}
export async function amApprove(cardId: string) {
  await fetch('/api/am/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId }) })
}
export async function amReject(cardId: string, feedback: string) {
  await fetch('/api/am/reject', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId, feedback }) })
}
export async function amAnswer(cardId: string, text: string) {
  await fetch('/api/am/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId, text }) })
}

export type Entry = { name: string; type: 'dir' | 'file' }
export async function tree(p: string): Promise<{ root: string; path: string; entries: Entry[] }> {
  const r = await fetch('/api/tree?path=' + encodeURIComponent(p)); return r.json()
}
export async function readFile(p: string): Promise<{ binary?: boolean; tooBig?: boolean; name?: string; content?: string; size?: number }> {
  const r = await fetch('/api/file?path=' + encodeURIComponent(p)); return r.json()
}

