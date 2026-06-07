// Lucy Agent Machine — core data model (config-là-DATA, engine generic).

export type Stage = {
  id: string
  name: string
  personaId: string
  gate?: boolean // true => xong stage phải có người DUYỆT mới qua (checkpoint quan trọng)
}
export type Pipeline = { id: string; name: string; stages: Stage[] }

// Project = container thật: repo (clone được) + board + kênh + chat Lucy riêng.
export type Project = {
  id: string
  name: string
  repoUrl?: string // git repo để agent CLONE & sửa thật (R2). Trống = workspace nháp.
  branch?: string // nhánh làm việc (mặc định nhánh chính)
  description?: string
  skill?: string // SKILL.md domain của dự án (vd Unity/Colyseus) -> chèn vào prompt MỌI agent dự án này
  trashed?: boolean // thùng rác: ẩn khỏi list, chờ purge (xoá hẳn)
  channels: string[] // kênh con Discord-style (R4). Mặc định ['general']
  createdAt: number
  updatedAt: number
}

export type Persona = {
  id: string
  name: string
  avatar?: string // link/upload — gắn được từ prompt cho Lucy hoặc tay
  systemPrompt: string
  model: 'sonnet' | 'opus'
  allowedTools?: string[] // least-privilege (FS defense)
  timeoutSec?: number
}

export type CardStatus = 'backlog' | 'queued' | 'working' | 'waiting_human' | 'blocked' | 'done' | 'failed'
export type Cost = { usd: number; inTok: number; outTok: number }

export type Card = {
  id: string
  title: string
  brief: string
  pipelineId: string
  projectId: string // 1 hệ chạy NHIỀU dự án — card thuộc 1 project
  stageIndex: number
  status: CardStatus
  workspace: string // dir cô lập (blast-radius)
  parentId?: string
  depth: number // độ sâu delegate (root=0) — depth-breaker chống delegate vô hạn
  blockedBy: string[] // DAG: card này chờ các card này xong (hold/resume)
  pendingQuestion?: string
  modelOverride?: 'sonnet' | 'opus' // ép model cho CARD này (đè model mặc định của persona) — orchestrator/bạn chọn
  reviewNotes?: string[] // feedback khi bạn TRẢ LẠI ở gate -> chèn vào prompt cho agent sửa
  cost: Cost
  stageVisits?: Record<string, number> // loop-breaker: đếm số lần vào mỗi stage
  artifacts?: { files?: string[]; diffstat?: string; stage?: string; isRepo?: boolean } // báo cáo: file đã tạo/đổi ở stage gần nhất
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
export type RunResult = { outcome: Outcome; cost: Cost; raw: string; artifacts?: { files?: string[]; diffstat?: string; isRepo?: boolean } }

export type ChannelKind = 'chat' | 'status' | 'report' | 'decision' | 'system' | 'handoff'
export type ChannelMsg = {
  ts: number
  channel: string
  author: string
  kind: ChannelKind
  text: string
  cardId?: string
}
