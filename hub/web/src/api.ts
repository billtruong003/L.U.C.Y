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

export type Entry = { name: string; type: 'dir' | 'file' }
export async function tree(p: string): Promise<{ root: string; path: string; entries: Entry[] }> {
  const r = await fetch('/api/tree?path=' + encodeURIComponent(p)); return r.json()
}
export async function readFile(p: string): Promise<{ binary?: boolean; tooBig?: boolean; name?: string; content?: string; size?: number }> {
  const r = await fetch('/api/file?path=' + encodeURIComponent(p)); return r.json()
}

