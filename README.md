# L.U.C.Y — Personal AI Agent OS

> Trợ lý cá nhân của Bill: **biết rõ m + mọi dự án, tự làm việc bằng nhiều agent, chạm cả tech-life
> (code/mail/lịch/file/web), tự giỏi lên, chạy cả khi m ngủ — lái từ điện thoại.**
> Chat qua Telegram (bridge → `claude -p`), web cockpit always-on trên VPS.

> 📖 **Single source of truth → [docs/NORTH_STAR.md](docs/NORTH_STAR.md).** Đọc cái đó trước mọi thứ.

**Trạng thái (2026-06-12):**
- ✅ **M1 Trí nhớ** — vault markdown + FTS5/trigram recall + dream (Wilson) + evidence-loop + tinh hà 3D. 1 não thống nhất, biết Bill + dự án.
- 🔧 **Phase 1.5 — Đa-model + Dashboard** *(đang làm)* — lát API in-house 7 provider (smoke-tested) + executor đa-nguồn (DeepSeek V4 executor / Claude orchestrator) + web mở thẳng Dashboard đo token/cost.
- ⬜ M2 Tay (MCP) · M3 Tự học · M4 Chủ động · M5 Token/Cost · M6 Đa kênh.

## Kiến trúc (gọn)
```
📱 Telegram ──► lucy-bridge (VPS) ──claude -p──► agent-machine (card-engine, multi-persona)
                     │                                  │ --add-dir
                 lucy-hub (web cockpit)            lucy-vault/  (bộ não: Context · Brain · Projects)
                     │                                  │
              Dashboard · Bộ não 🌌 · Board · Settings(lát API)   FTS5 recall + dream + galaxy
```
- **Não** = `claude -p` đi thẳng Anthropic (không proxy). **Lát rẻ** = `agent-machine/src/llm-lane.ts` (7 provider free) cho executor.
- **Nhớ** = `lucy-vault/` (git-tracked markdown, mở được bằng Obsidian).
- Hermes đã **bỏ** (thay bằng bridge) · OmniRoute self-host đã **bỏ** (thay lát in-house, box 2GB yếu).

## Máy mới / sau khi pull — kéo references về
`references/` = 6 repo tham chiếu (git submodules) để crib khi build:
```powershell
.\refs.ps1      # Windows
bash refs.sh    # macOS/Linux/Git-Bash   (≡ git submodule update --init --depth 1)
```
Không chạy thì `references/` rỗng (code vẫn chạy). Map file→việc: [references/README.md](references/README.md).

## Docs
| Doc | Nội dung |
|---|---|
| [docs/NORTH_STAR.md](docs/NORTH_STAR.md) ⭐ | Viễn cảnh + lộ trình 6 milestone + UI/UX + việc kế — **đọc đầu tiên** |
| [docs/AGENT_MACHINE.md](docs/AGENT_MACHINE.md) | Kiến trúc multi-agent card-engine |
| [docs/MCP_ARCHITECTURE.md](docs/MCP_ARCHITECTURE.md) | Kiến trúc M2 (MCP) |
| [docs/M1_MEMORY_SPEC.md](docs/M1_MEMORY_SPEC.md) · [docs/NEURAL_GALAXY.md](docs/NEURAL_GALAXY.md) · [docs/MEMORY_PEAK.md](docs/MEMORY_PEAK.md) | Hệ trí nhớ M1 + tinh hà + peak |
| [docs/PROVIDER_MODELS.md](docs/PROVIDER_MODELS.md) · [docs/MODEL_COMPARISON.md](docs/MODEL_COMPARISON.md) · [docs/COST_MODEL.md](docs/COST_MODEL.md) | Lát API: model live + benchmark + token |
| [docs/LUCY_ULTIMATE_INFRA.md](docs/LUCY_ULTIMATE_INFRA.md) · [docs/STEAL_FROM_HERMES.md](docs/STEAL_FROM_HERMES.md) | Thiết kế 7 lớp + cơ chế rút từ Hermes |
| [docs/DEPLOY_HUB.md](docs/DEPLOY_HUB.md) · [docs/REMOTE_CONTROL.md](docs/REMOTE_CONTROL.md) | Deploy hub + remote (M6) |
| [docs/_outdated/](docs/_outdated/) | Docs gác/superseded (business, Hermes/OmniRoute, vision cũ) — hồi được |

## Folder
```
LUCY/
├── docs/          # tài liệu — NORTH_STAR.md là gốc
├── bridge/        # Telegram → claude -p (Python)
├── agent-machine/ # card-engine TS (recall/dream/signal/llm-lane/coordinator)
├── hub/           # web cockpit (server + web React)
├── lucy-vault/    # bộ não markdown (Context · Brain · Projects)
├── skills/        # custom Agent Skills (agentskills.io)
└── references/    # (submodules) source tham chiếu, KHÔNG commit
```

## Kỷ luật
🔐 Secret (model keys / Telegram token) **chỉ trên VPS qua `nano .env`, không paste chat, không `cat`**.
🔁 1 nguồn sự thật = GitHub: dev ở local → push → VPS `git pull` + `pm2 restart`. Không sửa thẳng 2 nơi.
🧠 Reindex galaxy/recall = `pm2 restart lucy-coordinator` (KHÔNG phải bridge/hub).
