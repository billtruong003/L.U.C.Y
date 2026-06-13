// llm-lane.ts — "lát API" nhẹ in-house: gọi thẳng provider OpenAI-compat + fallback.
// Thay OmniRoute (Next.js nặng) trên VPS 2GB. Không dep mới (Node 20 fetch). Key từ .env.llm.
// claude -p (não) KHÔNG đi qua đây — đây là lane MODEL-RẺ (executor/bulk).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type ProviderId = 'openrouter' | 'groq' | 'gemini' | 'cerebras' | 'mistral' | 'opencode-zen' | 'zai'

export interface ProviderCfg { id: ProviderId; baseUrl: string; envKey: string; label: string }

// baseUrl = gốc OpenAI-compat (đã verify HTTP 200 /models, 2026-06-11).
export const PROVIDERS: Record<ProviderId, ProviderCfg> = {
  'openrouter':   { id: 'openrouter',   baseUrl: 'https://openrouter.ai/api/v1',                       envKey: 'OPENROUTER_API_KEY',   label: 'OpenRouter' },
  'groq':         { id: 'groq',         baseUrl: 'https://api.groq.com/openai/v1',                     envKey: 'GROQ_API_KEY',         label: 'Groq' },
  'gemini':       { id: 'gemini',       baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', envKey: 'GEMINI_API_KEY',  label: 'Gemini' },
  'cerebras':     { id: 'cerebras',     baseUrl: 'https://api.cerebras.ai/v1',                         envKey: 'CEREBRAS_API_KEY',     label: 'Cerebras' },
  'mistral':      { id: 'mistral',      baseUrl: 'https://api.mistral.ai/v1',                          envKey: 'MISTRAL_API_KEY',      label: 'Mistral' },
  'opencode-zen': { id: 'opencode-zen', baseUrl: 'https://opencode.ai/zen/v1',                         envKey: 'OPENCODE_ZEN_API_KEY', label: 'OpenCode Zen' },
  'zai':          { id: 'zai',          baseUrl: 'https://api.z.ai/api/paas/v4',                       envKey: 'ZAI_API_KEY',          label: 'Z.ai' },
}

export type Role = 'executor' | 'reasoning' | 'fast' | 'content'

export interface ModelEntry {
  key: string          // id ổn định dùng trong dropdown + config
  label: string        // hiện trên dropdown
  provider: ProviderId
  model: string        // model-id thật gửi cho provider
  role: Role
  free: boolean
  ctx?: string
  note?: string
}

// Catalog cho dropdown. TẤT CẢ id dưới đã SMOKE-TEST chạy thật 2026-06-11 (trừ ghi chú).
// Bỏ: z.ai (insufficient balance), zen paid/qwen-free-ended (cần payment) — không đưa vào.
export const MODEL_CATALOG: ModelEntry[] = [
  // executor — coding agentic
  { key: 'ds-v4-flash-free', label: 'DeepSeek V4 Flash (free)', provider: 'opencode-zen', model: 'deepseek-v4-flash-free', role: 'executor', free: true, ctx: '1M', note: 'reasoning — cấp max_tokens cao' },
  { key: 'devstral-med',     label: 'Devstral Medium',          provider: 'mistral',      model: 'devstral-medium-latest',     role: 'executor', free: true, note: 'agentic coding của Mistral' },
  { key: 'codestral',        label: 'Codestral 2508',           provider: 'mistral',      model: 'codestral-2508',             role: 'executor', free: true, note: 'code-specialized' },
  { key: 'ds-v4-flash',      label: 'DeepSeek V4 Flash',        provider: 'openrouter',   model: 'deepseek/deepseek-v4-flash', role: 'executor', free: false, ctx: '1M' },
  { key: 'or-nemotron-super', label: 'Nemotron 3 Super 120B',   provider: 'openrouter',   model: 'nvidia/nemotron-3-super-120b-a12b:free', role: 'executor', free: true, ctx: '1M', note: 'free + tool-calling, nhanh (verify 2026-06-12)' },
  { key: 'or-gptoss-120b',   label: 'GPT-OSS 120B (OpenRouter free)', provider: 'openrouter', model: 'openai/gpt-oss-120b:free', role: 'executor', free: true, ctx: '131k', note: 'free + tool-calling' },
  // reasoning
  { key: 'ds-v4-pro',        label: 'DeepSeek V4 Pro',          provider: 'openrouter',   model: 'deepseek/deepseek-v4-pro',   role: 'reasoning', free: false, ctx: '1M', note: 'S-tier reasoning+code' },
  // fast — nhanh, việc nhẹ
  { key: 'groq-gptoss-120b', label: 'GPT-OSS 120B (Groq)',      provider: 'groq',         model: 'openai/gpt-oss-120b',        role: 'fast', free: true, note: 'mạnh + nhanh, free' },
  { key: 'cerebras-glm-47',  label: 'GLM-4.7 (Cerebras)',       provider: 'cerebras',     model: 'zai-glm-4.7',                role: 'fast', free: true, note: 'cực nhanh, cap ctx 8K' },
  { key: 'cerebras-gptoss',  label: 'GPT-OSS 120B (Cerebras)',  provider: 'cerebras',     model: 'gpt-oss-120b',               role: 'fast', free: true, note: 'cap ctx 8K' },
  { key: 'groq-llama-70b',   label: 'Llama 3.3 70B (Groq)',     provider: 'groq',         model: 'llama-3.3-70b-versatile',    role: 'fast', free: true, note: 'classify/chat' },
  // content — viết
  { key: 'gemini-flash',     label: 'Gemini 3 Flash',           provider: 'gemini',       model: 'gemini-3-flash-preview',     role: 'content', free: true, note: '1500 RPD' },
  { key: 'mistral-large',    label: 'Mistral Large',            provider: 'mistral',      model: 'mistral-large-latest',       role: 'content', free: true },
]

// Chuỗi fallback theo role (chạy lần lượt tới khi 1 cái ra content). Chỉ model đã verify.
export const FALLBACKS: Record<Role, string[]> = {
  executor:  ['ds-v4-flash-free', 'or-nemotron-super', 'devstral-med', 'or-gptoss-120b', 'ds-v4-flash', 'codestral'],
  reasoning: ['ds-v4-pro', 'ds-v4-flash', 'groq-gptoss-120b'],
  fast:      ['groq-gptoss-120b', 'cerebras-glm-47', 'groq-llama-70b'],
  content:   ['gemini-flash', 'mistral-large', 'groq-gptoss-120b'],
}

// ── Rate-limit detection ──
export class RateLimitError extends Error {
  retryAfterMs: number
  constructor(msg: string, retryAfterMs: number) {
    super(msg)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

const DEFAULT_RETRY_AFTER_MS = 5 * 60_000 // 5 phút
function parseRetryAfterMs(res: Response): number {
  const raw = res.headers.get('retry-after')
  if (raw) {
    const asNum = parseInt(raw, 10)
    if (!isNaN(asNum) && asNum > 0) return asNum * 1000
    const asDate = Date.parse(raw)
    if (!isNaN(asDate)) return Math.max(0, asDate - Date.now())
  }
  const envVal = process.env.AM_RATELIMIT_PARK_MS
  if (envVal) { const n = parseInt(envVal, 10); if (!isNaN(n) && n > 0) return n }
  return DEFAULT_RETRY_AFTER_MS
}

let envLoaded = false
function loadEnvFile(): void {
  if (envLoaded) return
  envLoaded = true
  const p = process.env.LLM_ENV_FILE || path.join(os.homedir(), 'lucy', '.env.llm')
  let raw: string
  try { raw = fs.readFileSync(p, 'utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = s.indexOf('=')
    if (eq < 0) continue
    const k = s.slice(0, eq).trim()
    const v = s.slice(eq + 1).trim()
    if (k && !process.env[k]) process.env[k] = v
  }
}

export function keyFor(provider: ProviderId): string | undefined {
  loadEnvFile()
  const v = process.env[PROVIDERS[provider].envKey]
  return v && v.length > 0 ? v : undefined
}

export function entryByKey(key: string): ModelEntry | undefined {
  return MODEL_CATALOG.find((m) => m.key === key)
}

/** Provider nào có key (cho hub hiện trạng thái sống/chết — KHÔNG lộ key). */
export function providerStatus(): { provider: ProviderId; label: string; hasKey: boolean }[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({ provider: id, label: PROVIDERS[id].label, hasKey: !!keyFor(id) }))
}

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }
export interface LlmResult { content: string; reasoning?: string; modelKey: string; provider: ProviderId; model: string; usage?: unknown }

async function callOne(entry: ModelEntry, messages: ChatMsg[], maxTokens: number, timeoutMs: number): Promise<LlmResult> {
  const key = keyFor(entry.provider)
  if (!key) throw new Error(`no key for ${entry.provider}`)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${PROVIDERS[entry.provider].baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: entry.model, messages, max_tokens: maxTokens }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      if (res.status === 429) throw new RateLimitError(`${entry.provider}/${entry.model} HTTP 429`, parseRetryAfterMs(res))
      throw new Error(`${entry.provider}/${entry.model} HTTP ${res.status}`)
    }
    const data = await res.json() as { choices?: { message?: { content?: string; reasoning_content?: string; reasoning?: string } }[]; usage?: unknown }
    const msg = data.choices?.[0]?.message
    const content = (msg?.content || '').trim()
    if (!content) throw new Error(`${entry.provider}/${entry.model} empty content`)
    // A4: reasoning provider trả riêng (DeepSeek 'reasoning_content', số provider 'reasoning') → surface để hiển thị tách.
    const reasoning = (msg?.reasoning_content || msg?.reasoning || '').trim() || undefined
    return { content, reasoning, modelKey: entry.key, provider: entry.provider, model: entry.model, usage: data.usage }
  } finally {
    clearTimeout(timer)
  }
}

export interface CallOpts { maxTokens?: number; timeoutMs?: number; fallback?: boolean }

/**
 * Gọi 1 model theo key (hoặc role). Tự fallback theo FALLBACKS nếu fail/empty.
 * modelKeyOrRole: 'ds-v4-flash-free' | 'executor' | ...
 */
export async function callLLM(modelKeyOrRole: string, messages: ChatMsg[], opts: CallOpts = {}): Promise<LlmResult> {
  const maxTokens = opts.maxTokens ?? 2048
  const timeoutMs = opts.timeoutMs ?? 60000
  const fb = opts.fallback ?? true

  let chain: string[]
  if ((['executor', 'reasoning', 'fast', 'content'] as string[]).includes(modelKeyOrRole)) {
    chain = FALLBACKS[modelKeyOrRole as Role]
  } else {
    const entry = entryByKey(modelKeyOrRole)
    if (!entry) throw new Error(`unknown model key: ${modelKeyOrRole}`)
    chain = fb ? [entry.key, ...FALLBACKS[entry.role].filter((k) => k !== entry.key)] : [entry.key]
  }

  const errors: string[] = []
  let attempted = 0
  let rateLimitedCount = 0
  const rateLimitAfters: number[] = []
  for (const k of chain) {
    const entry = entryByKey(k)
    if (!entry || !keyFor(entry.provider)) { errors.push(`${k}: no entry/key`); continue }
    attempted++
    try {
      return await callOne(entry, messages, maxTokens, timeoutMs)
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      errors.push(msg)
      if (e instanceof RateLimitError) { rateLimitedCount++; rateLimitAfters.push(e.retryAfterMs) }
    }
  }
  // Có ÍT NHẤT 1 provider 429 + cả chuỗi fail → PARK (back-off), KHÔNG fail.
  // mixed 429+500: retry ngay vô ích vì đang bị giới hạn → park + notify mới đúng + tiết kiệm token.
  if (attempted > 0 && rateLimitedCount > 0) {
    const maxRa = Math.max(...rateLimitAfters, DEFAULT_RETRY_AFTER_MS)
    throw new RateLimitError(`providers rate-limited (${rateLimitedCount}/${attempted}): ${errors.join(' | ')}`, maxRa)
  }
  throw new Error(`all providers failed: ${errors.join(' | ')}`)
}

// ── TOOL-CALLING (agentic) — cho LaneRunner: model rẻ có "tay" (read/write/edit/bash) ──
export interface ToolDef { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface RawToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface RawMsg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: RawToolCall[]; tool_call_id?: string }
export interface RawResult { message: RawMsg; usage?: { prompt_tokens?: number; completion_tokens?: number }; modelKey: string; provider: ProviderId; model: string }

async function callOneRaw(entry: ModelEntry, messages: RawMsg[], tools: ToolDef[] | undefined, maxTokens: number, timeoutMs: number): Promise<RawResult> {
  const key = keyFor(entry.provider)
  if (!key) throw new Error(`no key for ${entry.provider}`)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const body: Record<string, unknown> = { model: entry.model, messages, max_tokens: maxTokens }
    if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto' }
    const res = await fetch(`${PROVIDERS[entry.provider].baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      if (res.status === 429) throw new RateLimitError(`${entry.provider}/${entry.model} HTTP 429`, parseRetryAfterMs(res))
      throw new Error(`${entry.provider}/${entry.model} HTTP ${res.status}`)
    }
    const data = await res.json() as { choices?: { message?: RawMsg }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    const message = data.choices?.[0]?.message
    if (!message) throw new Error(`${entry.provider}/${entry.model} no message`)
    return { message, usage: data.usage, modelKey: entry.key, provider: entry.provider, model: entry.model }
  } finally {
    clearTimeout(timer)
  }
}

/** Như callLLM nhưng GIỮ tool_calls (agentic loop). Mỗi lượt tự fallback model nếu fail. */
export async function callLLMRaw(modelKeyOrRole: string, messages: RawMsg[], opts: { tools?: ToolDef[]; maxTokens?: number; timeoutMs?: number; fallback?: boolean } = {}): Promise<RawResult> {
  const maxTokens = opts.maxTokens ?? 4096
  const timeoutMs = opts.timeoutMs ?? 90000
  const fb = opts.fallback ?? true
  let chain: string[]
  if ((['executor', 'reasoning', 'fast', 'content'] as string[]).includes(modelKeyOrRole)) {
    chain = FALLBACKS[modelKeyOrRole as Role]
  } else {
    const entry = entryByKey(modelKeyOrRole)
    if (!entry) throw new Error(`unknown model key: ${modelKeyOrRole}`)
    chain = fb ? [entry.key, ...FALLBACKS[entry.role].filter((k) => k !== entry.key)] : [entry.key]
  }
  const errors: string[] = []
  let attempted = 0
  let rateLimitedCount = 0
  const rateLimitAfters: number[] = []
  for (const k of chain) {
    const entry = entryByKey(k)
    if (!entry || !keyFor(entry.provider)) { errors.push(`${k}: no entry/key`); continue }
    attempted++
    try {
      return await callOneRaw(entry, messages, opts.tools, maxTokens, timeoutMs)
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      errors.push(msg)
      if (e instanceof RateLimitError) { rateLimitedCount++; rateLimitAfters.push(e.retryAfterMs) }
    }
  }
  // Có ÍT NHẤT 1 provider 429 + cả chuỗi fail → PARK (back-off), KHÔNG fail.
  // mixed 429+500: retry ngay vô ích vì đang bị giới hạn → park + notify mới đúng + tiết kiệm token.
  if (attempted > 0 && rateLimitedCount > 0) {
    const maxRa = Math.max(...rateLimitAfters, DEFAULT_RETRY_AFTER_MS)
    throw new RateLimitError(`providers rate-limited (${rateLimitedCount}/${attempted}): ${errors.join(' | ')}`, maxRa)
  }
  throw new Error(`all providers (raw) failed: ${errors.join(' | ')}`)
}

/** Lane có dùng được không (có ÍT NHẤT 1 key trong chain của model/role)? — để worker chọn runner. */
/** Tìm model lane rẻ nhất đang available (có key). */
export function cheapestAvailableLaneKey(): string | null {
  for (const m of MODEL_CATALOG) {
    if (laneAvailable(m.key)) return m.key
  }
  return null
}

export function laneAvailable(modelKeyOrRole: string): boolean {
  let chain: string[]
  if ((['executor', 'reasoning', 'fast', 'content'] as string[]).includes(modelKeyOrRole)) chain = FALLBACKS[modelKeyOrRole as Role]
  else { const e = entryByKey(modelKeyOrRole); if (!e) return false; chain = [e.key, ...FALLBACKS[e.role]] }
  return chain.some((k) => { const e = entryByKey(k); return e && !!keyFor(e.provider) })
}
