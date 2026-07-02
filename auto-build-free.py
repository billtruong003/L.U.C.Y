#!/usr/bin/env python3
"""
auto-build-free.py — Lucy SONG SINH THỨ 3 (bên cạnh auto-build/Sonnet + auto-task/general).
Triết lý: Sonnet PLAN → mimo/ds-flash-free EXECUTE code nhỏ → Sonnet ESCALATE việc khó → mimo VISION QA.
Mục tiêu: giảm ~80% token Sonnet/sprint bằng cách đẩy phần lớn code nhỏ qua model FREE.
⚠️ KHÔNG dùng Opus — Sonnet đủ tốt cho plan lẫn execute khó, rẻ hơn 5-10×.

Kiến trúc đầy đủ: /root/lucy-workspace/auto-build-free-arch.md (section 2-7).
Phase:  PLAN (Sonnet) → EXECUTE (mimo/lane/sonnet theo tier) → QA (Puppeteer + mimo vision) → REPORT.

Chạy:  pm2 start /root/lucy/auto-build-free.py --name lucy-autobuild-free --interpreter python3 --no-autorestart
Dừng:  touch /root/lucy/.autobuild-free-stop   ·  hoặc  pm2 delete lucy-autobuild-free
Log:   /root/lucy/auto-build-free.log
CLI:   --self-test (banner+config, no LLM) · --plan-only (chỉ Sonnet plan) · --dry-execute (log routing, no LLM) · --dry
Env:   AUTOBUILD_FREE_MODEL_PLAN(claude-sonnet-5) · _MODEL_CODE(mimo-v2.5-free) · _MODEL_CODE_FB(ds-v4-flash-free) ·
       _MODEL_HARD(claude-sonnet-5) · _MODEL_LANE(or-nemotron-super) · _MAX_ITERS(12) · _MAX_QA_ROUNDS(3) ·
       _QA_URL · _FOCUS · AM_COORD_URL · AM_TOKEN · LUCY_TOKEN_REPORT(1)
"""
import os, re, sys, asyncio, datetime, json as _json
from claude_agent_sdk import query, ClaudeAgentOptions, PermissionResultAllow, PermissionResultDeny

REPO      = "/root/lucy"
VAULT     = os.environ.get("LUCY_VAULT", "/root/lucy/lucy-vault")
PERSONA   = os.environ.get("LUCY_PERSONA", "/root/lucy/bridge/persona.md")
SPEC      = f"{REPO}/docs/MASTER-SPEC.md"
PLAN_FILE = f"{REPO}/auto-build-free-plan.json"
STOP_FILE = f"{REPO}/.autobuild-free-stop"
LOG       = f"{REPO}/auto-build-free.log"

# Model tiers (ABF-1 config). mimo-v2.5-free verified LIVE 2026-06-18 (coordinator restarted).
MODEL_PLAN    = os.environ.get("AUTOBUILD_FREE_MODEL_PLAN", "claude-sonnet-5")
MODEL_CODE    = os.environ.get("AUTOBUILD_FREE_MODEL_CODE", "mimo-v2.5-free")
MODEL_CODE_FB = os.environ.get("AUTOBUILD_FREE_MODEL_CODE_FB", "or-nemotron-super")
MODEL_HARD    = os.environ.get("AUTOBUILD_FREE_MODEL_HARD", "claude-sonnet-5")
MODEL_LANE    = os.environ.get("AUTOBUILD_FREE_MODEL_LANE", "or-nemotron-super")
MAX_ITERS     = int(os.environ.get("AUTOBUILD_FREE_MAX_ITERS", "12"))
MAX_QA_ROUNDS = int(os.environ.get("AUTOBUILD_FREE_MAX_QA_ROUNDS", "3"))
QA_URL        = os.environ.get("AUTOBUILD_FREE_QA_URL", "").strip()
FOCUS         = os.environ.get("AUTOBUILD_FREE_FOCUS", "").strip()
TIMEOUT       = int(os.environ.get("AUTOBUILD_FREE_TIMEOUT", "1800"))

# Phase enum (ABF-1)
class Phase:
    PLAN = "PLAN"; EXECUTE = "EXECUTE"; QA = "QA"; REPORT = "REPORT"

# ─── Helpers (copy nguyên xi từ auto-task.py — MỘT Lucy, không fork logic) ─────

def log(msg):
    line = f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f: f.write(line + "\n")
    except Exception: pass

def _read_env_file(path):
    env = {}
    try:
        with open(path) as f:
            for ln in f:
                if "=" in ln and not ln.strip().startswith("#"):
                    k, v = ln.strip().split("=", 1); env[k] = v
    except Exception: pass
    return env

def tg(text):
    try:
        env = _read_env_file(f"{REPO}/bridge/.env")
        token, chat = env.get("TELEGRAM_BOT_TOKEN"), env.get("LUCY_ALLOWED_USER_ID")
        if not token or not chat: return
        proxy = env.get("LUCY_TG_PROXY", "").strip()
        try:
            import requests as _rq
            proxies = {"https": proxy, "http": proxy} if proxy else None
            _rq.post(f"https://api.telegram.org/bot{token}/sendMessage",
                     json={"chat_id": chat, "text": text[:3800]}, timeout=20, proxies=proxies)
        except ImportError:
            import urllib.request, urllib.parse
            data = urllib.parse.urlencode({"chat_id": chat, "text": text[:3800]}).encode()
            urllib.request.urlopen(f"https://api.telegram.org/bot{token}/sendMessage", data=data, timeout=20)
    except Exception as e:
        log(f"tg fail: {e}")

_TOKEN_REPORT = os.environ.get("LUCY_TOKEN_REPORT", "1").strip().lower() not in ("0", "false", "off")

def _coord_creds():
    url = os.environ.get("AM_COORD_URL", "")
    tok = os.environ.get("AM_TOKEN", "")
    if not url or not tok:
        he = _read_env_file(f"{REPO}/hub/server/.env")
        url = url or he.get("AM_COORD_URL", "http://127.0.0.1:8780")
        tok = tok or he.get("AM_TOKEN", "")
    return url.rstrip("/"), tok

def report_tok(usage, source="autobuild-free", model=None):
    """Ghi token vào token-guard CHUNG (coordinator /spend). source='autobuild-free' (DASH-FIX nguồn riêng)."""
    if not _TOKEN_REPORT or not isinstance(usage, dict): return
    in_tok      = int(usage.get("input_tokens", usage.get("inTok", 0)) or 0)
    cache_read  = int(usage.get("cache_read_input_tokens", 0) or 0)
    cache_write = int(usage.get("cache_creation_input_tokens", 0) or 0)
    out_tok     = int(usage.get("output_tokens", usage.get("outTok", 0)) or 0)
    if in_tok <= 0 and out_tok <= 0 and cache_read <= 0 and cache_write <= 0: return
    try:
        import urllib.request
        url, tok = _coord_creds()
        req = urllib.request.Request(f"{url}/spend",
            data=_json.dumps({"source": source, "model": model or MODEL_HARD,
                              "inTok": in_tok, "outTok": out_tok,
                              "cacheReadTok": cache_read, "cacheWriteTok": cache_write}).encode(),
            headers={"content-type": "application/json",
                     **({"x-worker-token": tok} if tok else {})})
        urllib.request.urlopen(req, timeout=5)
        log(f"report_tok: source={source} model={model or MODEL_HARD} in={in_tok} out={out_tok}")
    except Exception as e:
        log(f"report_tok fail: {e}")

def _coord_post(path, body, timeout=300):
    import urllib.request
    url, tok = _coord_creds()
    req = urllib.request.Request(f"{url}{path}",
        data=_json.dumps(body).encode(),
        headers={"content-type": "application/json",
                 **({"x-worker-token": tok} if tok else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return _json.loads(r.read().decode())

# Guard — copy nguyên từ auto-build.py, KHÔNG nới lỏng
DANGER = [r"rm\s+-rf\s+(/|~|\$HOME|\*)", r"\bgit\s+push",
          r"pm2\s+(restart|stop|delete|reload)\s+\S*bridge",
          r"\bmkfs", r"\bdd\s+if=", r":\(\)\s*\{", r">\s*/dev/sd",
          r"chmod\s+-R?\s*777\s+/", r"\b(shutdown|reboot|halt)\b",
          r"rm\s+-rf\s+/root/lucy\b", r"\bcurl[^|]*\|\s*(ba)?sh"]

async def can_use(tool_name, tool_input, ctx):
    try:
        if tool_name == "Bash":
            cmd = (tool_input or {}).get("command", "") or ""
            for p in DANGER:
                if re.search(p, cmd):
                    log(f"BLOCK bash: {cmd[:120]} (match {p})")
                    return PermissionResultDeny(message=f"auto-build-free CHẶN lệnh nguy hiểm (match {p}).")
    except Exception: pass
    return PermissionResultAllow()

def _sys_prompt():
    try:
        if os.path.exists(PERSONA):
            return {"type": "preset", "preset": "claude_code", "append": open(PERSONA, encoding="utf-8").read()}
    except Exception: pass
    return {"type": "preset", "preset": "claude_code"}

# ─── ABF-3: Opus planner ──────────────────────────────────────────────────────

PLANNER_PROMPT = """Bạn là Lucy build planner. Đọc MASTER-SPEC (docs/MASTER-SPEC.md) Phần V và danh sách task ⏳ còn lại.
{focus_block}
Phân tích từng task auto-able kế tiếp, annotate tier:
- tier="code-free": code rõ ràng, pattern lặp, script nhỏ, format/convert, viết CSS/HTML, REST endpoint đơn giản,
  migration script, test unit đơn giản. → mimo/minimax free đủ sức.
- tier="claude": architecture decision, multi-file refactor phức tạp, debug logic khó, integration nhiều service,
  algo phức tạp, reasoning sâu về trade-off. → Sonnet Agent SDK.
- tier="lane": research nhẹ, tóm tắt, soạn text, classify, format data. → Nemotron free.

BỎ QUA task cần thiết kế/quyết định của chủ nhân (Jarvis UI layout, persona UI, set ngưỡng watcher).
Chọn 2-{max_iters} task auto-able CÙNG VÙNG cho sprint này.

Trả về ĐÚNG 1 khối JSON (không kèm giải thích ngoài JSON):
{{
  "tasks": [
    {{"id": "ABF-x", "title": "...", "tier": "code-free|claude|lane",
      "reason": "vì sao tier này", "sub_steps": ["bước 1", "bước 2"], "estimated_tokens": 5000}}
  ],
  "sprint_note": "tóm tắt nhóm task sprint này",
  "escalation_budget": 3
}}"""

def _extract_json(text):
    """Lấy khối JSON đầu tiên cân bằng ngoặc từ output planner."""
    if not text: return None
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{": depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try: return _json.loads(text[start:i + 1])
                    except Exception: break
        start = text.find("{", start + 1)
    return None

async def _agent_query(model, prompt):
    """1 vòng Agent SDK (in-process). Trả (text, usage)."""
    done_event = asyncio.Event()
    result_text, usage_out = "", {}

    async def _stream():
        yield {"type": "user", "message": {"role": "user", "content": prompt}}
        await done_event.wait()

    opts = ClaudeAgentOptions(
        model=model, permission_mode="default", can_use_tool=can_use, cwd=REPO,
        system_prompt=_sys_prompt(),
        add_dirs=[VAULT] if os.path.isdir(VAULT) else [],
        env={**os.environ, "IS_SANDBOX": "1"},
    )
    async for m in query(prompt=_stream(), options=opts):
        if type(m).__name__ == "ResultMessage":
            result_text = getattr(m, "result", "") or ""
            u = getattr(m, "usage", None)
            if isinstance(u, dict): usage_out = u
            done_event.set()
    return result_text, usage_out

async def plan_sprint(focus=""):
    """ABF-3: Sonnet đọc MASTER-SPEC → JSON plan có tier annotation. Ghi PLAN_FILE."""
    focus_block = f"\n⭐ ƯU TIÊN ĐỢT NÀY (chỉ chọn trong nhóm này, đúng thứ tự): {focus}\n" if focus else ""
    prompt = PLANNER_PROMPT.format(focus_block=focus_block, max_iters=MAX_ITERS) + \
        "\n\nĐọc file MASTER-SPEC bằng tool Read trước khi lập plan."
    log(f"plan_sprint: model={MODEL_PLAN} focus={focus[:60] or '(none)'}")
    text, usage = await _agent_query(MODEL_PLAN, prompt)
    report_tok(usage, source="autobuild-free", model=MODEL_PLAN)
    plan = _extract_json(text)
    if not plan or not isinstance(plan.get("tasks"), list) or not plan["tasks"]:
        log("plan_sprint: KHÔNG parse được plan JSON hợp lệ")
        return None
    try:
        with open(PLAN_FILE, "w", encoding="utf-8") as f:
            _json.dump(plan, f, ensure_ascii=False, indent=2)
        log(f"plan_sprint: {len(plan['tasks'])} task → {PLAN_FILE}")
    except Exception as e:
        log(f"plan_sprint write fail: {e}")
    return plan

# ─── ABF-2 + ABF-4: Executors + dispatch ──────────────────────────────────────

_WORKSPACE_HINT = os.environ.get("AUTOBUILD_FREE_WORKSPACE", "/root/lucy-workspace/ytmusic-clone")

def _task_prompt(task, plan_tasks=None):
    steps = task.get("sub_steps") or []
    steps_text = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(steps)) if steps else "  (tự quyết kế hoạch)"
    ws = task.get("workspace") or _WORKSPACE_HINT
    return f"""Bạn là Lucy executor. Thực hiện task sau bằng tool thật.

TASK: {task.get('title', '')}
ID: {task.get('id', '')}
WORKSPACE: {ws}  ← tất cả file write vào đây

CÁC BƯỚC:
{steps_text}

TOOL CÓ SẴN (dùng đúng tên):
- read_file(path)       đọc file trong workspace
- write_file(path, content)  ghi/tạo file
- edit_file(path, old_string, new_string)  sửa file
- bash(cmd)             chạy shell (npm install, tsc, python...)
- list_dir(path)        liệt kê thư mục

QUY TẮC:
- Viết code đầy đủ, không placeholder. Dùng write_file để tạo file thật.
- Path trong write_file là relative từ workspace (ví dụ: frontend/src/pages/Home.tsx).
- Nếu task quá phức tạp (cần reasoning sâu) → trả lời CHỨA "NEEDS_CLAUDE".
- KHÔNG: git push, rm -rf /, echo secret.
- Xong → tóm tắt ngắn các file đã tạo/sửa."""

def run_mimo(task, plan_tasks=None):
    """ABF-2: code-free tier — gọi /chat-lane-agentic với model FREE (mimo). escalate nếu fail/NEEDS_CLAUDE."""
    lm = task.get("model") or MODEL_CODE
    max_turns = int(task.get("max_turns") or 8)
    prompt = _task_prompt(task, plan_tasks)
    log(f"run_mimo [{task.get('id')}]: model={lm} maxTurns={max_turns}")
    try:
        r = _coord_post("/chat-lane-agentic", {"model": lm,
            "messages": [{"role": "user", "content": prompt}], "maxTurns": max_turns}, timeout=300)
        answer = (r.get("answer") or "").strip()
        l_usage = r.get("usage") or {}
        actual = r.get("model") or lm
        report_tok({"inTok": int(l_usage.get("inTok", 0)), "outTok": int(l_usage.get("outTok", 0))},
                   source="autobuild-free", model=actual)
        # detect lỗi từ coordinator ("❌ lane lỗi:", "unknown model key", bad token...)
        is_lane_error = (not answer
                         or "NEEDS_CLAUDE" in answer
                         or "lane lỗi" in answer
                         or "unknown model key" in answer
                         or len(answer) < 20)  # output thật luôn > 20 chars
        if is_lane_error:
            log(f"run_mimo [{task.get('id')}]: escalate ({answer[:60]!r})")
            return {"done": False, "escalate": True, "trace": answer, "model": actual, "executor": "mimo"}
        log(f"run_mimo [{task.get('id')}]: DONE ({len(answer)} chars)")
        return {"done": True, "escalate": False, "output": answer, "model": actual, "executor": "mimo"}
    except Exception as e:
        log(f"run_mimo [{task.get('id')}] error: {e}")
        # mimo dead → thử fallback model free trước khi escalate Sonnet
        if lm != MODEL_CODE_FB:
            log(f"run_mimo: fallback → {MODEL_CODE_FB}")
            return run_mimo({**task, "model": MODEL_CODE_FB}, plan_tasks)
        return {"done": False, "escalate": True, "trace": str(e), "error": str(e), "model": lm, "executor": "mimo"}

def run_lane(task, plan_tasks=None):
    """lane tier — research nhẹ/text qua Nemotron free."""
    lm = task.get("model") or MODEL_LANE
    max_turns = int(task.get("max_turns") or 10)
    prompt = _task_prompt(task, plan_tasks)
    log(f"run_lane [{task.get('id')}]: model={lm} maxTurns={max_turns}")
    try:
        r = _coord_post("/chat-lane-agentic", {"model": lm,
            "messages": [{"role": "user", "content": prompt}], "maxTurns": max_turns}, timeout=300)
        answer = (r.get("answer") or "").strip()
        l_usage = r.get("usage") or {}
        actual = r.get("model") or lm
        report_tok({"inTok": int(l_usage.get("inTok", 0)), "outTok": int(l_usage.get("outTok", 0))},
                   source="autobuild-free", model=actual)
        if not answer or "NEEDS_CLAUDE" in answer:
            return {"done": False, "escalate": True, "trace": answer, "model": actual, "executor": "lane"}
        log(f"run_lane [{task.get('id')}]: DONE ({len(answer)} chars)")
        return {"done": True, "escalate": False, "output": answer, "model": actual, "executor": "lane"}
    except Exception as e:
        log(f"run_lane [{task.get('id')}] error: {e}")
        return {"done": False, "escalate": True, "trace": str(e), "error": str(e), "model": lm, "executor": "lane"}

async def run_claude(task, plan_tasks=None, lane_trace=None):
    """claude tier / escalate — Agent SDK Sonnet (việc khó)."""
    model = task.get("hard_model") or MODEL_HARD
    prompt = _task_prompt(task, plan_tasks)
    if lane_trace:
        prompt += f"\n\n## Trace từ executor free (KHÔNG làm lại từ đầu — dùng làm context):\n{str(lane_trace)[:1200]}\n"
    log(f"run_claude [{task.get('id')}]: model={model}" + (" (escalated)" if lane_trace else ""))
    try:
        text, usage = await _agent_query(model, prompt)
        report_tok(usage, source="autobuild-free", model=model)
        log(f"run_claude [{task.get('id')}]: DONE ({len(text)} chars)")
        return {"done": True, "escalate": False, "output": text, "model": model, "executor": "claude"}
    except Exception as e:
        log(f"run_claude [{task.get('id')}] error: {e}")
        return {"done": False, "escalate": False, "error": str(e), "model": model, "executor": "claude"}

# ABF-4: dispatch theo tier. Trả dict result + đếm escalation qua state.
def _route_for(tier):
    """Tên executor sẽ chạy cho 1 tier (dùng cho --dry-execute log + dispatch)."""
    return {"code-free": "mimo", "lane": "lane", "claude": "claude"}.get(tier, "mimo")

async def _execute_task_free(task, plan_tasks, state):
    tier = (task.get("tier") or "code-free").strip()
    log(f"execute [{task.get('id')}] tier={tier} → {_route_for(tier)}")
    if tier == "claude":
        return await run_claude(task, plan_tasks)
    if tier == "lane":
        r = run_lane(task, plan_tasks)
    else:  # code-free
        r = run_mimo(task, plan_tasks)
    # escalate free → Sonnet
    if not r.get("done") and r.get("escalate"):
        state["escalation_count"] = state.get("escalation_count", 0) + 1
        budget = state.get("escalation_budget", 3)
        if state["escalation_count"] > budget:
            log(f"execute [{task.get('id')}]: vượt escalation_budget ({budget}) → bỏ escalate")
            return r
        log(f"execute [{task.get('id')}]: escalate Sonnet ({state['escalation_count']}/{budget})")
        return await run_claude(task, plan_tasks, lane_trace=r.get("trace"))
    return r

# ─── ABF-5: Puppeteer wrapper ─────────────────────────────────────────────────
TOOLS_DIR = f"{REPO}/tools"
PUPPET_SCRIPT = f"{TOOLS_DIR}/puppeteer-screenshot.js"

DEFAULT_SCREENS = [
    {"name": "home",   "url": "/",  "full_page": False},
    {"name": "mobile", "url": "/",  "viewport": [375, 812], "full_page": False},
]

def run_puppeteer(base_url, screens, out_dir="/tmp/qa-screenshots"):
    """ABF-5: gọi Node puppeteer-screenshot.js → list {name, path, bytes, ok}."""
    import subprocess
    os.makedirs(out_dir, exist_ok=True)
    screens_json = _json.dumps(screens)
    try:
        r = subprocess.run(
            ["node", PUPPET_SCRIPT, base_url, screens_json, out_dir],
            capture_output=True, text=True, timeout=120, cwd=TOOLS_DIR
        )
        if r.stdout.strip():
            return _json.loads(r.stdout.strip())
        log(f"run_puppeteer stderr: {r.stderr[:300]}")
        return [{"name": s["name"], "path": "", "ok": False, "error": r.stderr[:200]} for s in screens]
    except Exception as e:
        log(f"run_puppeteer error: {e}")
        return [{"name": s["name"], "path": "", "ok": False, "error": str(e)} for s in screens]


# ─── ABF-6: Vision QA via OpenCode Zen (mimo vision) ─────────────────────────

QA_VISION_PROMPT = """Bạn là QA engineer. Xem screenshot màn hình "{screen_name}" và tìm BUG UI.

Trả về JSON:
{{
  "bugs": [
    {{
      "severity": "high|medium|low",
      "description": "mô tả bug cụ thể",
      "location": "tên component hoặc góc màn hình"
    }}
  ]
}}

Kiểm tra: layout bị vỡ, text overflow, màu sai contrast, element bị che,
missing content, responsive issues, spacing sai, icon hỏng, loading không kết thúc.
Nếu không có bug → trả {{"bugs": []}}."""


_zen_key_pool: list = []
_zen_key_idx: int = 0

def _load_zen_pool():
    """Nạp pool key từ nhiều nguồn: file .opencode-zen-keys > .env.llm CSV > agent-machine/.env > coordinator /proc."""
    global _zen_key_pool
    if _zen_key_pool:
        return

    seen: set = set()
    def _add(k):
        k = k.strip()
        if k and k not in seen:
            seen.add(k)
            _zen_key_pool.append(k)

    # 1. File key riêng (6 keys từ Bill)
    key_file = f"{REPO}/agent-machine/.opencode-zen-keys"
    try:
        with open(key_file) as f:
            for line in f:
                _add(line.strip())
    except FileNotFoundError:
        pass

    # 2. .env.llm CSV (OPENCODE_ZEN_API_KEY=k1,k2,...)
    try:
        env_llm = _read_env_file(f"{REPO}/.env.llm")
        for k in env_llm.get("OPENCODE_ZEN_API_KEY", "").split(","):
            _add(k)
    except Exception:
        pass

    # 3. agent-machine/.env
    env = _read_env_file(f"{REPO}/agent-machine/.env")
    for k in env.get("OPENCODE_ZEN_API_KEY", "").split(","):
        _add(k)

    # 4. env os (single key hoặc CSV)
    for k in os.environ.get("OPENCODE_ZEN_API_KEY", "").split(","):
        _add(k)

    # 5. Coordinator /proc fallback
    if not _zen_key_pool:
        try:
            import subprocess
            r2 = subprocess.run("pgrep -f coordinator-main | head -1", shell=True,
                                capture_output=True, text=True, timeout=3)
            pid = r2.stdout.strip()
            if pid:
                with open(f"/proc/{pid}/environ", "rb") as f:
                    env_raw = f.read()
                for entry in env_raw.split(b"\x00"):
                    if entry.startswith(b"OPENCODE_ZEN_API_KEY="):
                        for k in entry.split(b"=", 1)[1].decode().split(","):
                            _add(k)
        except Exception:
            pass

    log(f"zen pool: {len(_zen_key_pool)} keys loaded")


def _zen_key(rotate: bool = False) -> str:
    """Lấy key kế tiếp từ pool (round-robin). rotate=True sau khi 429."""
    global _zen_key_idx
    _load_zen_pool()
    if not _zen_key_pool:
        return ""
    if rotate:
        _zen_key_idx = (_zen_key_idx + 1) % len(_zen_key_pool)
    return _zen_key_pool[_zen_key_idx % len(_zen_key_pool)]


def qa_visual_sprint(project_url, screens=None):
    """ABF-6: chụp screens bằng Puppeteer → gửi PNG lên mimo vision → trả list bugs."""
    if screens is None:
        screens = DEFAULT_SCREENS
    if not project_url:
        log("qa_visual_sprint: QA_URL không set → bỏ qua"); return []
    zen_key = _zen_key()
    if not zen_key:
        log("qa_visual_sprint: OPENCODE_ZEN_API_KEY không tìm thấy → bỏ qua QA"); return []

    import base64, httpx as _httpx
    shots = run_puppeteer(project_url, screens)
    all_results = []

    for item in shots:
        if not item.get("ok") or not item.get("path"):
            log(f"qa_visual: {item['name']} screenshot FAIL ({item.get('error','?')})")
            all_results.append({"screen": item["name"], "bugs": [], "error": item.get("error")})
            continue
        try:
            with open(item["path"], "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode()
            payload = {
                "model": MODEL_CODE,
                "messages": [{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": QA_VISION_PROMPT.format(screen_name=item["name"])},
                ]}],
                "response_format": {"type": "json_object"},
                "max_tokens": 1024,
            }
            # rotate qua pool nếu 429
            zen_key = _zen_key()
            data = None
            for _attempt in range(len(_zen_key_pool) or 1):
                resp = _httpx.post(
                    "https://opencode.ai/zen/v1/chat/completions",
                    headers={"Authorization": f"Bearer {zen_key}"},
                    json=payload, timeout=60
                )
                if resp.status_code == 429:
                    log(f"qa_visual: 429 rate-limit → rotate key (attempt {_attempt+1})")
                    zen_key = _zen_key(rotate=True)
                    continue
                resp.raise_for_status()
                data = resp.json()
                break
            if data is None:
                raise Exception("qa_visual: tất cả keys đều 429")
            raw = data["choices"][0]["message"]["content"]
            content = _json.loads(raw) if isinstance(raw, str) else raw
            bugs = content.get("bugs", [])
            report_tok(data.get("usage", {}), source="autobuild-free", model=MODEL_CODE)
            log(f"qa_visual: {item['name']} → {len(bugs)} bug(s)")
            all_results.append({"screen": item["name"], "bugs": bugs})
        except Exception as e:
            log(f"qa_visual: {item['name']} error: {e}")
            all_results.append({"screen": item["name"], "bugs": [], "error": str(e)})

    return all_results


# ─── ABF-7: QA loop (sau EXECUTE, trước REPORT) ───────────────────────────────

async def _run_qa_phase(state):
    """ABF-7: QA round loop. Nếu có bug high/medium → tạo fix task → re-execute → lặp."""
    if not QA_URL:
        log("_run_qa_phase: AUTOBUILD_FREE_QA_URL không set → bỏ QA phase"); return
    qa_history = state.setdefault("qa_history", [])

    for qa_round in range(1, MAX_QA_ROUNDS + 1):
        log(f"=== QA round {qa_round}/{MAX_QA_ROUNDS} ===")
        bug_results = qa_visual_sprint(QA_URL)
        all_bugs = [b for r in bug_results for b in r.get("bugs", [])]
        high_med = [b for b in all_bugs if b.get("severity") in ("high", "medium")]
        low_n = len(all_bugs) - len(high_med)
        tg(f"🔍 QA round {qa_round}: {len(all_bugs)} bugs ({len(high_med)} high/medium · {low_n} low)")
        qa_history.append({"round": qa_round, "total": len(all_bugs), "high_med": len(high_med),
                            "results": bug_results})

        if not high_med:
            log("QA: 0 high/medium bugs → PASS"); tg("✅ QA PASS: không có bug high/medium"); break

        fix_tasks = []
        for i, bug in enumerate(high_med):
            fix_tasks.append({
                "id": f"qa-fix-r{qa_round}-{i+1}",
                "title": f"Fix QA bug: {bug.get('description','?')[:80]}",
                "tier": "code-free",
                "priority": 1,
                "reason": f"QA severity={bug.get('severity')} @ {bug.get('location','?')}",
                "sub_steps": [f"Fix: {bug.get('description','')}", "Verify UI sau fix"],
                "estimated_tokens": 3000,
            })
        log(f"QA: {len(fix_tasks)} fix task cho round {qa_round}")
        for fi, ft in enumerate(fix_tasks, 1):
            log(f"QA fix {fi}/{len(fix_tasks)}: {ft['id']}")
            try:
                r = await asyncio.wait_for(_execute_task_free(ft, fix_tasks, state), timeout=TIMEOUT)
            except asyncio.TimeoutError:
                r = {"done": False, "error": "timeout", "executor": "mimo"}
            state["results"].append({"id": ft["id"], "title": ft["title"], "tier": ft["tier"],
                                     "executor": r.get("executor"), "model": r.get("model"),
                                     "done": r.get("done")})


# ─── ABF-8: HTML report ───────────────────────────────────────────────────────

REPORT_DIR = "/var/www/lucy-reports"

def generate_html_report_free(state, sprint_num=None):
    """ABF-8: sinh HTML report → /var/www/lucy-reports/autobuild-free-DATE.html."""
    import datetime as _dt
    now = _dt.datetime.now()
    date_str = now.strftime("%Y%m%d-%H%M")
    fname = f"autobuild-free-{date_str}.html"
    out_path = os.path.join(REPORT_DIR, fname)
    os.makedirs(REPORT_DIR, exist_ok=True)

    results = state.get("results", [])
    done_n = sum(1 for r in results if r.get("done"))
    fail_n = len(results) - done_n
    esc_n = state.get("escalation_count", 0)
    qa_hist = state.get("qa_history", [])
    total_qa_bugs = sum(h.get("total", 0) for h in qa_hist)
    fixed_rounds = sum(1 for h in qa_hist if h.get("high_med", 0) == 0)

    free_executors = {"mimo", "lane"}
    free_n = sum(1 for r in results if r.get("executor") in free_executors)
    free_pct = round(free_n * 100 / len(results)) if results else 0

    rows = ""
    for r in results:
        status = "✅" if r.get("done") else "❌"
        rows += (
            f"<tr><td>{r.get('id','')}</td><td>{r.get('title','')[:60]}</td>"
            f"<td>{r.get('tier','')}</td><td>{r.get('executor','')}</td>"
            f"<td>{r.get('model','')[:20]}</td><td>{status}</td></tr>\n"
        )

    qa_rows = ""
    for h in qa_hist:
        qa_rows += (
            f"<tr><td>Round {h['round']}</td><td>{h['total']}</td>"
            f"<td>{h['high_med']}</td></tr>\n"
        )

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Auto-Build-Free {date_str}</title>
<style>
body{{font-family:monospace;background:#0d1117;color:#c9d1d9;margin:20px}}
h1{{color:#58a6ff}}h2{{color:#79c0ff;margin-top:20px}}
table{{border-collapse:collapse;width:100%}}
th{{background:#161b22;color:#8b949e;padding:8px;text-align:left}}
td{{border-top:1px solid #30363d;padding:6px 8px}}
tr:hover td{{background:#161b22}}
.ok{{color:#3fb950}}.fail{{color:#f85149}}
.stat{{display:inline-block;background:#161b22;border:1px solid #30363d;
       border-radius:6px;padding:10px 16px;margin:6px;min-width:100px;text-align:center}}
.stat-n{{font-size:1.8em;font-weight:bold;color:#58a6ff}}
.stat-l{{font-size:.8em;color:#8b949e}}
</style></head>
<body>
<h1>🆓 Auto-Build-Free Sprint — {now.strftime('%Y-%m-%d %H:%M')}</h1>
<div>
  <div class="stat"><div class="stat-n ok">{done_n}</div><div class="stat-l">Done</div></div>
  <div class="stat"><div class="stat-n fail">{fail_n}</div><div class="stat-l">Fail</div></div>
  <div class="stat"><div class="stat-n">{esc_n}</div><div class="stat-l">Escalate</div></div>
  <div class="stat"><div class="stat-n">{free_pct}%</div><div class="stat-l">Free %</div></div>
  <div class="stat"><div class="stat-n">{total_qa_bugs}</div><div class="stat-l">QA bugs</div></div>
</div>

<h2>Tasks</h2>
<table>
<tr><th>ID</th><th>Title</th><th>Tier</th><th>Executor</th><th>Model</th><th>Status</th></tr>
{rows}</table>

<h2>QA Visual History</h2>
{"<table><tr><th>Round</th><th>Total bugs</th><th>High/Med</th></tr>" + qa_rows + "</table>" if qa_hist else "<p>QA không chạy (AUTOBUILD_FREE_QA_URL chưa set).</p>"}
<p style="color:#8b949e;font-size:.85em">Generated by Lucy auto-build-free · {now.isoformat()}</p>
</body></html>"""

    try:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        log(f"generate_html_report_free: {out_path}")
        return out_path
    except Exception as e:
        log(f"generate_html_report_free error: {e}"); return None


# ─── Main sprint (PLAN → EXECUTE → QA → REPORT) ───────────────────────────────

async def run_sprint():
    log(f"=== auto-build-free SPRINT · plan={MODEL_PLAN} code={MODEL_CODE} hard={MODEL_HARD} ===")
    tg(f"🆓 Auto-Build-Free KHỞI ĐỘNG — Sonnet plan → {MODEL_CODE} execute → {MODEL_HARD} escalate. Em tự build nhóm task free, xong sẽ báo.")

    # Phase PLAN
    plan = await plan_sprint(FOCUS)
    if not plan:
        tg("⚠️ Auto-Build-Free: planner Sonnet không ra plan hợp lệ — dừng."); return
    tasks = plan["tasks"][:MAX_ITERS]
    state = {"escalation_count": 0, "escalation_budget": int(plan.get("escalation_budget", 3)), "results": []}

    # Phase EXECUTE
    log("=== Phase EXECUTE ===")
    for idx, task in enumerate(tasks, 1):
        if os.path.exists(STOP_FILE):
            log("STOP file → dừng EXECUTE."); break
        log(f"--- task {idx}/{len(tasks)}: {task.get('id')} ---")
        try:
            r = await asyncio.wait_for(_execute_task_free(task, tasks, state), timeout=TIMEOUT)
        except asyncio.TimeoutError:
            r = {"done": False, "error": "timeout", "executor": _route_for(task.get("tier"))}
        state["results"].append({"id": task.get("id"), "title": task.get("title"),
                                 "tier": task.get("tier"), "executor": r.get("executor"),
                                 "model": r.get("model"), "done": r.get("done")})

    # Phase QA (ABF-7)
    log("=== Phase QA ===")
    await _run_qa_phase(state)

    # Phase REPORT (ABF-8)
    log("=== Phase REPORT ===")
    done_n = sum(1 for r in state["results"] if r.get("done"))
    total_n = len(state["results"])
    qa_hist = state.get("qa_history", [])
    qa_bugs_fixed = sum(h.get("high_med", 0) for h in qa_hist[:-1]) if len(qa_hist) > 1 else 0
    free_executors = {"mimo", "lane"}
    free_n = sum(1 for r in state["results"] if r.get("executor") in free_executors)
    free_pct = round(free_n * 100 / total_n) if total_n else 0

    report_path = generate_html_report_free(state)
    report_url = f"http://14.225.255.73/reports/{os.path.basename(report_path)}" if report_path else ""

    log(f"=== SPRINT END: {done_n}/{total_n} done, esc={state['escalation_count']}, free={free_pct}% ===")
    tg(
        f"🆓 Auto-Build-Free sprint xong.\n"
        f"Tasks: {done_n} done / {total_n - done_n} fail.\n"
        f"QA: {qa_bugs_fixed} bug fixed.\n"
        f"Free: {free_pct}% token.\n"
        f"📄 {report_url or '(report lỗi)'}"
    )
    return state

# ─── CLI ──────────────────────────────────────────────────────────────────────

def _print_config():
    log("AUTO-BUILD-FREE KHỞI ĐỘNG")
    log(f"  plan={MODEL_PLAN} code={MODEL_CODE} code_fb={MODEL_CODE_FB} hard={MODEL_HARD} lane={MODEL_LANE}")
    log(f"  max_iters={MAX_ITERS} max_qa_rounds={MAX_QA_ROUNDS} qa_url={QA_URL or '(none)'} focus={FOCUS[:50] or '(none)'}")

async def _dry_execute():
    """ABF-4 verify: 3 task test (mỗi tier) → log executor được route, KHÔNG gọi LLM."""
    log("AUTO-BUILD-FREE --dry-execute (routing only, no LLM)")
    tests = [{"id": "T-cf", "tier": "code-free"}, {"id": "T-lane", "tier": "lane"}, {"id": "T-claude", "tier": "claude"}]
    for t in tests:
        log(f"  dry route: {t['id']} tier={t['tier']} → executor={_route_for(t['tier'])}")
    log("--dry-execute OK: code-free→mimo, lane→lane, claude→claude")

async def main():
    args = sys.argv[1:]
    if "--self-test" in args:
        _print_config()
        try:
            import claude_agent_sdk  # noqa
            log("self-test: claude_agent_sdk import OK")
        except Exception as e:
            log(f"self-test: import FAIL {e}")
        log("self-test DONE (no LLM call)"); return
    if "--dry-execute" in args:
        await _dry_execute(); return
    if "--plan-only" in args:
        _print_config()
        plan = await plan_sprint(FOCUS)
        if plan:
            print(_json.dumps(plan, ensure_ascii=False, indent=2))
            log(f"--plan-only DONE: {len(plan['tasks'])} task")
        else:
            log("--plan-only: KHÔNG ra plan")
        return
    if "--dry" in args:
        _print_config(); log("--dry: dừng trước khi chạy LLM"); return

    # --rounds N: chạy N sprint liên tục (overnight loop)
    rounds = 1
    for i, a in enumerate(args):
        if a == "--rounds" and i + 1 < len(args):
            try: rounds = max(1, int(args[i + 1]))
            except: pass

    _print_config()
    if rounds > 1:
        log(f"=== MULTI-SPRINT LOOP: {rounds} rounds ===")
        tg(f"🔁 Auto-Build-Free bắt đầu {rounds} sprint liên tục\nmodel={MODEL_CODE} / plan={MODEL_PLAN}\nfocus={FOCUS[:80] if FOCUS else '(auto)'}")
    for r in range(1, rounds + 1):
        if rounds > 1:
            log(f"─── ROUND {r}/{rounds} ───")
            tg(f"▶️ Round {r}/{rounds} bắt đầu…")
        try:
            await run_sprint()
        except Exception as e:
            log(f"sprint round {r} err: {e}"); tg(f"⚠️ Auto-Build-Free round {r} lỗi: {str(e)[:200]}")
            if rounds > 1:
                import time as _time; _time.sleep(30)  # backoff trước round kế
        if r < rounds:
            import time as _time; _time.sleep(10)  # nhỏ pause giữa rounds
    if rounds > 1:
        tg(f"🏁 Auto-Build-Free: {rounds} rounds hoàn thành")

if __name__ == "__main__":
    asyncio.run(main())
