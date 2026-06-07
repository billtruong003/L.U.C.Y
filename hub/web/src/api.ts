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

export async function send(prompt: string, opus: boolean) {
  const r = await fetch('/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, opus }),
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
  id: string; title: string; brief: string; pipelineId: string; stageIndex: number
  status: string; depth: number; blockedBy: string[]; pendingQuestion?: string
  parentId?: string; cost: { usd: number }
  history?: { ts: number; stage: string; event: string }[]
}
export type AmMsg = { ts: number; channel: string; author: string; kind: string; text: string; cardId?: string }
export type AmStage = { id: string; name: string; personaId: string; gate?: boolean }
export type AmPipeline = { id: string; name: string; stages: AmStage[] }
export type AmPersona = { id: string; name: string; avatar?: string; model?: string }
export async function amState(): Promise<{ configured: boolean; offline?: boolean; cards: AmCard[]; channels: AmMsg[]; pipelines?: AmPipeline[]; personas?: AmPersona[] }> {
  const r = await fetch('/api/am/state'); return r.json()
}
export async function amConfig(): Promise<{ configured: boolean; offline?: boolean; maxLanes?: number; perCardMaxUsd?: number; queued?: number; inFlight?: number }> {
  const r = await fetch('/api/am/config'); return r.json()
}
export async function amSetLanes(maxLanes: number) {
  const r = await fetch('/api/am/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxLanes }) }); return r.json()
}
export async function amCreateCard(title: string, brief: string, pipelineId: string) {
  const r = await fetch('/api/am/card', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, brief, pipelineId }) }); return r.json()
}
export async function amApprove(cardId: string) {
  await fetch('/api/am/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cardId }) })
}

export type Entry = { name: string; type: 'dir' | 'file' }
export async function tree(p: string): Promise<{ root: string; path: string; entries: Entry[] }> {
  const r = await fetch('/api/tree?path=' + encodeURIComponent(p)); return r.json()
}
export async function readFile(p: string): Promise<{ binary?: boolean; tooBig?: boolean; name?: string; content?: string; size?: number }> {
  const r = await fetch('/api/file?path=' + encodeURIComponent(p)); return r.json()
}

