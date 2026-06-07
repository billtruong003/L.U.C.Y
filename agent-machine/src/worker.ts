// Worker — CHẠY TRÊN MÁY LOCAL (mạnh). Quay ra coordinator: claim job -> chạy claude -p -> submit.
// VPS không chạy agent; worker đến/đi tự do (máy tắt -> card xếp hàng; bật -> hút tiếp).
import path from 'node:path'
import fs from 'node:fs'
import type { Runner } from './runner'
import type { RunResult } from './types'

// 1 bước: claim -> chạy -> submit. Trả true nếu có job đã xử lý.
export async function workerStep(coordUrl: string, runner: Runner, opts: { token?: string; localRoot?: string } = {}): Promise<boolean> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token) headers['x-worker-token'] = opts.token

  let job: any = null
  try {
    const r = await fetch(coordUrl + '/worker/claim', { method: 'POST', headers })
    job = (await r.json()).job
  } catch { return false }
  if (!job) return false

  const root = opts.localRoot || path.join(process.cwd(), '.worker')
  const ws = path.join(root, job.cardId || job.jobId) // theo CARD -> các stage cùng card chia sẻ file
  fs.mkdirSync(ws, { recursive: true })

  let result: RunResult
  try {
    result = await runner.run(job.card, job.stage, job.persona, ws)
  } catch (e) {
    result = { outcome: { decision: 'fail', summary: `worker lỗi: ${String(e).slice(0, 200)}` }, cost: { usd: 0, inTok: 0, outTok: 0 }, raw: '' }
  }
  try {
    await fetch(coordUrl + '/worker/result', { method: 'POST', headers, body: JSON.stringify({ jobId: job.jobId, result }) })
  } catch { /* coordinator tạm mất -> job sẽ được re-dispatch sau (M2.1 lease/timeout) */ }
  return true
}

// Vòng worker: poll coordinator (dial-out). concurrency = số claude -p CHẠY SONG SONG tối đa
// trên MÁY NÀY (vd VPS cap 2, local cap nhiều hơn). stopWhenIdle=true cho test.
export async function runWorker(coordUrl: string, runner: Runner, opts: { token?: string; pollMs?: number; localRoot?: string; stopWhenIdle?: boolean; concurrency?: number } = {}) {
  const pollMs = opts.pollMs ?? 500
  const concurrency = Math.max(1, opts.concurrency ?? 1)
  const lane = async () => {
    for (;;) {
      const did = await workerStep(coordUrl, runner, opts)
      if (!did) {
        if (opts.stopWhenIdle) return
        await new Promise((s) => setTimeout(s, pollMs))
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => lane()))
}
