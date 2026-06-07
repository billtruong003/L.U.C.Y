// Lucy Agent Machine — core data model (config-là-DATA, engine generic).

export type Stage = {
  id: string
  name: string
  personaId: string
  gate?: boolean // true => xong stage phải có người DUYỆT mới qua (checkpoint quan trọng)
}
export type Pipeline = { id: string; name: string; stages: Stage[] }

export type Persona = {
  id: string
  name: string
  avatar?: string // link/upload — gắn được từ prompt cho Lucy hoặc tay
  systemPrompt: string
  model: 'sonnet' | 'opus'
  allowedTools?: string[] // least-privilege (FS defense)
  timeoutSec?: number
}

export type CardStatus = 'queued' | 'working' | 'waiting_human' | 'blocked' | 'done' | 'failed'
export type Cost = { usd: number; inTok: number; outTok: number }

export type Card = {
  id: string
  title: string
  brief: string
  pipelineId: string
  stageIndex: number
  status: CardStatus
  workspace: string // dir cô lập (blast-radius)
  parentId?: string
  blockedBy: string[] // DAG: card này chờ các card này xong (hold/resume)
  pendingQuestion?: string
  cost: Cost
  history: { ts: number; stage: string; event: string; detail?: string }[]
  createdAt: number
  updatedAt: number
}

export type Decision = 'advance' | 'done' | 'needs_decision' | 'delegate' | 'fail'
export type Outcome = {
  decision: Decision
  summary: string
  question?: string // khi needs_decision
  delegateTo?: { personaId: string; title: string; brief: string; pipelineId?: string } // khi delegate
}
export type RunResult = { outcome: Outcome; cost: Cost; raw: string }

export type ChannelKind = 'chat' | 'status' | 'report' | 'decision' | 'system'
export type ChannelMsg = {
  ts: number
  channel: string
  author: string
  kind: ChannelKind
  text: string
  cardId?: string
}
