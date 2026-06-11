# Steal-from-Hermes — code-level findings để nâng Lucy

> **Viết 2026-06-10.** Đọc SOURCE thật của `hermes-agent` (NousResearch, Python) — rút cơ chế mạnh nhất
> để đưa vào Lucy (bridge `lucy_bridge.py` + agent-machine TS engine). Neo: [RESEARCH_HERMES_OMNIROUTE_2026.md](_outdated/RESEARCH_HERMES_OMNIROUTE_2026.md),
> [ROADMAP_TO_PEAK.md](_outdated/ROADMAP_TO_PEAK.md). Đây là input cho thiết kế hạ tầng Lucy.

> **Pattern cốt lõi xuyên suốt Hermes = "forked-agent":** spawn 1 `AIAgent` phụ trong thread, đưa prompt
> hẹp + whitelist tool + **system-prompt của cha y nguyên (để dùng chung prefix cache)**, cho ghi vào
> store chung, xong vứt. Skill-learning, curation, sub-agent đều là biến thể của 1 pattern này.

---

## 1. Skill-learning loop (agent tự giỏi dần)
**Hermes:** `agent/turn_finalizer.py` → mỗi N lượt gọi `_spawn_background_review` (`agent/background_review.py`):
fork agent (≤16 iter, quiet), whitelist `memory`+`skills`, chạy 1 trong 3 prompt hằng số
`_SKILL_REVIEW_PROMPT`/`_MEMORY_REVIEW_PROMPT`/`_COMBINED_REVIEW_PROMPT`. Prompt MỚI là "trí tuệ": ưu
tiên patch skill đang load → patch umbrella → thêm file support → cuối mới tạo skill mới; + **danh sách
KHÔNG-được-bắt** (lỗi do môi trường, lỗi transient) để agent khỏi tự nhiễm. Curator (`agent/curator.py`)
chạy khi idle: `active→stale→archived` theo thời gian (pure, no-LLM), gộp skill anh-em vào umbrella, chỉ
archive không xoá. Skill = thư mục `SKILL.md` + `references/`; telemetry ở `.usage.json`.
**Lấy cho Lucy (Dễ):** copy 3 prompt hằng số (gần như verbatim — IP nằm ở text). Thêm **stage cuối
"self-improve"** trong agent-machine: sau card, chạy `claude -p` với `_COMBINED_REVIEW_PROMPT`, chỉ cho
ghi `agents/*/SKILL.md`. Lifecycle state-machine + `.usage.json` port thẳng sang TS. Skip curator 9999-iter.

## 2. Multi-agent / sub-agent (`tools/delegate_tool.py`)
**Hermes:** `delegate_task` → con chạy `ThreadPoolExecutor` (max 3), **cha BLOCK tới khi xong, chỉ thấy
SUMMARY của con** (không thấy tool-call trung gian). Con: conversation mới, toolset = **giao của cha**
trừ `DELEGATE_BLOCKED_TOOLS` (delegate/clarify/memory/send_message), ephemeral prompt (goal+context+ws),
depth cap `MAX_DEPTH=1` (phẳng), auto-deny op nguy hiểm, có thể route con sang **model rẻ** (`override_provider`).
**Lấy cho Lucy (TB):** map ~1:1 với `/fan` `/orch` + delegate-to-child-card hiện có. Steal contract:
**cha block, chỉ summary trả về context cha, con = prompt hẹp + toolset hạn chế + session mới**. Copy cấu
trúc `_build_child_system_prompt` ("YOUR TASK/CONTEXT/WORKSPACE/summarize what you did,found,modified").
Blocklist (con không delegate tiếp/không ghi memory chung), route fan-out con sang model rẻ → hợp budget cap.

## 3. Memory & session (FTS5 — món hời nhất, zero-LLM)
**Hermes:** `hermes_state.py` `SessionDB`: bảng `sessions` (có `parent_session_id` lineage) + `messages`,
2 bảng FTS5 (unicode + **trigram cho CJK**). `tools/session_search_tool.py` = 1 tool, 3 mode suy từ args:
**DISCOVERY** (FTS5 → dedupe theo lineage → top-N session + snippet ±5 msg + "bookends" 3 đầu/3 cuối),
**SCROLL** (±window quanh msg id), **BROWSE** (session gần đây). Cross-session user model = Honcho plugin
(dialectic API, inject ≤600 char `<memory-context>` vào system prompt) — `agent/memory_manager.py` lo
prefetch/sync + scrub fence khỏi output.
**Lấy cho Lucy (Dễ, giá trị cao):** FTS5 ship sẵn trong `better-sqlite3` → drop schema + tool 3-mode vào
agent-machine cho "đã làm cái này chưa?". **Bookends + ±N window + lineage dedupe** = recall tín hiệu cao,
0 token. `MEMORY.md`/`USER.md` flat file làm memory bền (Lucy đã có MEMORY.md). Honcho (Hard) → thay rẻ:
1 pass `claude -p` định kỳ distill FTS5 → block `USER.md` ≤600 char inject mỗi prompt (80% giá trị, 0 dịch vụ ngoài).

## 4. Automation / cron (`cron/scheduler.py`)
**Hermes:** `tick()` mỗi 60s: **file-lock** cross-platform, **advance `next_run_at` TRƯỚC khi chạy** (at-most-once),
pool song song cho job độc lập + pool tuần tự cho job đụng env. `run_job`: chạy **pre-run script** sandboxed
inject stdout làm context; **wake-gate** (script in `{"wakeAgent":false}` → SKIP gọi LLM = poll rẻ không tốn
model); `context_from` (nối output job trước, cap 8K); `[SILENT]` sentinel (im khi không có tin); force-disable
tool tương tác; re-scan prompt-injection trước khi chạy.
**Lấy cho Lucy (TB):** `tick()` skeleton (lock + advance-before-run + pool split) cho `/auto` trên VPS. Steal
ngay 3 ý rẻ: **wake-gate** (short-circuit trước khi tốn `claude -p`), **`context_from` chaining**, **`[SILENT]`
sentinel**. Force-disable tool tương tác khi chạy nền + scan injection (đang chạy agent tự động trên VPS → cần).

## 5. Token / context optimization
**Hermes:** (a) **Prompt-cache parity** — mọi fork DÙNG CHUNG `_cached_system_prompt` của cha y nguyên +
pin session config → request byte-identical → trúng prefix cache. Code ghi **giảm ~26% chi phí** chỉ nhờ cái
này. (b) `agent/context_compressor.py`: `should_compress` khi `prompt_tokens ≥ 0.5×ctx`; giữ **head** (system
+ N đầu) + **tail theo token-budget** (đảm bảo giữ user-msg mới nhất), summarize GIỮA bằng **model phụ rẻ**,
`SUMMARY_PREFIX` ghi rõ "REFERENCE ONLY — msg mới nhất THẮNG" (chống summary cướp reply); không cắt giữa
cặp tool_call/result. (c) toolset hạn chế per-fork → schema nhỏ.
**Lấy cho Lucy (Dễ→ROI cao nhất):** **kỷ luật prompt-cache parity** — giữ prefix system-prompt **byte-identical**
xuyên các stage của 1 card + xuyên child card (cùng persona header, cùng cách xử lý timestamp, cùng thứ tự
tool list). 1 timestamp lỡ inject mỗi stage là bể cache. ~25% tiết kiệm gần như free. + Hạn chế tool list mỗi
persona xuống tối thiểu. Compression policy (giữ head + tail-budget + summarize-giữa bằng model rẻ + prefix
"latest wins") copy gần verbatim.

---

## TOP 5 lấy trước (xếp theo công sức)
1. **Prompt-cache parity** xuyên stage/fork (Dễ, ~25% cost) — prefix byte-identical, toolset tối thiểu.
2. **3 prompt hằng số background-review** (Dễ) — IP skill-learning nằm ở text, gồm danh sách KHÔNG-bắt.
3. **FTS5 session_search** bookends + ±N + lineage dedupe (Dễ) — recall xuyên phiên 0-token.
4. **Cron tick()**: wake-gate, `context_from`, `[SILENT]`, advance-under-lock (Dễ/TB) — cho `/auto` VPS.
5. **Forked sub-agent contract**: cha block, chỉ summary về, con prompt hẹp + toolset giao + session mới +
   depth cap + auto-deny (TB) — cho `/fan` `/orch` + delegate-to-child-card.

**File Hermes đọc kỹ khi implement:** `agent/background_review.py`, `agent/curator.py`, `tools/skill_usage.py`,
`tools/delegate_tool.py`, `tools/session_search_tool.py`, `hermes_state.py` (schema ~230–374), `cron/scheduler.py`,
`agent/context_compressor.py`, `agent/memory_manager.py`, `plugins/memory/honcho/`.

## Lucy hiện có (baseline — không thiếu nhiều)
agent-machine `engine.ts`: card→pipeline→stage, budget pause, **loop-breaker** (rework N lần → HỎI người
không đốt/không fail), depth-breaker, **delegate→child-card** (cha blocked), HITL gate/cost/decision, lease
requeue, crash recovery. `runner.ts`: `claude -p --resume` session-cache, opus/sonnet split (không hạ cấp
stage mạnh), HOUSE_SKILL + OUTCOME_CONTRACT (JSON outcome). → **Lucy đã có ~70% pattern Hermes**; thiếu =
**skill-loop tự sinh, FTS5 recall, prompt-cache parity kỷ luật, cron wake-gate**.
