# references/ — repo tham chiếu (git submodules)

> Source để **đọc-tham-khảo khi implement Lucy**. Mỗi cái là **submodule pin commit** — KHÔNG sửa ở đây.
> **Máy mới / lần đầu:** `git submodule update --init --depth 1` (kéo source về). Bỏ qua thì thư mục rỗng.

| Submodule | Là gì | Tham chiếu cho | File chính để crib |
|---|---|---|---|
| **basic-memory** | markdown + SQLite FTS5 + MCP memory | **M1** note format + FTS5 index | `src/basic_memory/markdown/plugins.py` (parser) · `models/search.py` (FTS5 DDL) · `services/search_service.py` |
| **open-second-brain** | Hermes+Obsidian memory + "dream" | **M1** consolidation tự học | `src/core/brain/dream.ts` · `computeConfidence` (Wilson) · `{signal,preference,types}.ts` |
| **hermes-agent** | Nous Hermes agent (Python) | **M1/M2** tool-mgmt, MCP, cron | `tools/tool_search.py` · `tools/mcp_tool.py` · `tools/delegate_tool.py` · `cron/scheduler.py` · `agent/context_compressor.py` |
| **OmniRoute** | AI gateway 177 provider | gateway + token-opt (đã deploy local) | routing/combo · compression |
| **last30days-skill** | research engine skill | **M3** skill pattern | SKILL.md + cấu trúc |
| **awesome-finance-skills** | finance skills (agentskills.io) | **M3** skill format chuẩn | SKILL.md frontmatter |

**Map file → việc chi tiết:** [docs/M1_MEMORY_SPEC.md](../docs/M1_MEMORY_SPEC.md) §"File nguồn để crib" · [docs/STEAL_FROM_HERMES.md](../docs/STEAL_FROM_HERMES.md) · [docs/MCP_ARCHITECTURE.md](../docs/MCP_ARCHITECTURE.md).
