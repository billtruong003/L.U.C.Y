#!/usr/bin/env python3
"""
auto-task.py — Lucy TỰ ĐỘNG LÀM VIỆC theo task spec rời (/root/lucy/tasks/queue/).
Song sinh auto-build: auto-build cày CODE theo MASTER-SPEC; auto-task LÀM VIỆC tổng quát
(research nhẹ, soạn nháp, tóm tắt, dọn vault) theo task spec riêng từ queue/.

Triết lý: lane model rẻ lo việc dễ (phần lớn task), Claude(Sonnet) lo việc khó.
An toàn: kế thừa nguyên guard DANGER của auto-build (chặn git push / rm -rf / pm2-bridge).

Chạy:  pm2 start /root/lucy/auto-task.py --name lucy-autotask --interpreter python3 --no-autorestart
Dừng:  touch /root/lucy/.autotask-stop   (êm, sau task đang chạy)  ·  hoặc  pm2 delete lucy-autotask
Log:   /root/lucy/auto-task.log
Env:   AUTOTASK_MODEL(claude-sonnet-5) · AUTOTASK_MAX_ITERS(6) · AUTOTASK_TIMEOUT(2400)
       LUCY_LANEMODEL · AM_COORD_URL · AM_TOKEN · LUCY_TOKEN_REPORT(1)
"""
import os, re, sys, shutil, asyncio, datetime, json as _json
from claude_agent_sdk import query, ClaudeAgentOptions, PermissionResultAllow, PermissionResultDeny

REPO      = "/root/lucy"
TASKS_DIR = f"{REPO}/tasks"
VAULT     = os.environ.get("LUCY_VAULT", "/root/lucy/lucy-vault")
PERSONA   = os.environ.get("LUCY_PERSONA", "/root/lucy/bridge/persona.md")
MODEL     = os.environ.get("AUTOTASK_MODEL", "claude-sonnet-5")
LANEMODEL = os.environ.get("LUCY_LANEMODEL", "")
MAX_ITERS = int(os.environ.get("AUTOTASK_MAX_ITERS", "6"))
TIMEOUT   = int(os.environ.get("AUTOTASK_TIMEOUT", "5400"))
STOP_FILE = f"{REPO}/.autotask-stop"
LOG       = f"{REPO}/auto-task.log"
INBOX_DIR    = os.path.join(VAULT, "Brain", "inbox")
INBOX_SEEN   = os.path.join(TASKS_DIR, ".inbox-seen")
PROJECTS_DIR = os.path.join(TASKS_DIR, "projects")  # ATH-1: per-project dirs

# ─── Helpers ────────────────────────────────────────────────────────────────

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

def report_tok(usage, source="autotask", model=None):
    """Ghi token vào token-guard CHUNG (coordinator /spend). Synchronous."""
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
            data=_json.dumps({"source": source, "model": model or MODEL,
                              "inTok": in_tok, "outTok": out_tok,
                              "cacheReadTok": cache_read, "cacheWriteTok": cache_write}).encode(),
            headers={"content-type": "application/json",
                     **({"x-worker-token": tok} if tok else {})})
        urllib.request.urlopen(req, timeout=5)
        log(f"report_tok: source={source} model={model or MODEL} in={in_tok} out={out_tok}")
    except Exception as e:
        log(f"report_tok fail: {e}")

def _estimate_usd(model, in_tok, out_tok, cache_read=0, cache_write=0):
    """Ước tính USD từ token count (gần đúng; coordinator tính chính xác qua pricing.ts)."""
    m = (model or "").lower()
    if "sonnet" in m:
        p_in, p_out, p_cr, p_cw = 3, 15, 0.3, 3.75
    elif "opus" in m:
        p_in, p_out, p_cr, p_cw = 5, 25, 0.5, 6.25
    elif "haiku" in m:
        p_in, p_out, p_cr, p_cw = 1, 5, 0.1, 1.25
    else:
        return 0.0  # lane model rẻ/free
    M = 1_000_000
    return (in_tok * p_in + out_tok * p_out + cache_read * p_cr + cache_write * p_cw) / M

# Guard — copy nguyên từ auto-build.py, KHÔNG nới lỏng
DANGER = [r"rm\s+-rf\s+(/|~|\$HOME|\*)",
          # git push kể cả qua global flag: git -C <dir> push / --git-dir=... push / -c k=v push
          r"\bgit\b(?:\s+(?:-C\s+\S+|--git-dir=\S+|--work-tree=\S+|-c\s+\S+))*\s+push\b",
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
                    return PermissionResultDeny(message=f"auto-task CHẶN lệnh nguy hiểm (match {p}).")
    except Exception: pass
    return PermissionResultAllow()

def _sys_prompt():
    try:
        if os.path.exists(PERSONA):
            return {"type": "preset", "preset": "claude_code", "append": open(PERSONA, encoding="utf-8").read()}
    except Exception: pass
    return {"type": "preset", "preset": "claude_code"}

# ─── Queue helpers ───────────────────────────────────────────────────────────

def _parse_frontmatter(path):
    """Parse YAML frontmatter từ file .md bằng regex đơn giản."""
    meta = {"id": os.path.basename(path)[:-3], "title": "", "tier": "auto",
            "priority": 5, "model": "sonnet", "max_lane_turns": 12, "status": "queued"}
    body = ""
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)", content, re.DOTALL)
        if m:
            fm_text, body = m.group(1), m.group(2)
            for line in fm_text.splitlines():
                kv = re.match(r"^(\w+):\s*(.+)$", line.strip())
                if kv:
                    k, v = kv.group(1), kv.group(2).strip().strip('"\'')
                    if k == "priority":
                        try: meta[k] = int(v)
                        except ValueError: pass
                    elif k == "max_lane_turns":
                        try: meta[k] = int(v)
                        except ValueError: pass
                    else:
                        meta[k] = v
        else:
            body = content
    except Exception as e:
        log(f"parse frontmatter fail {path}: {e}")
    meta["path"] = path
    meta["body"] = body.strip()
    return meta

def load_queue():
    """Đọc tasks/queue/*.md, parse frontmatter, sort priority tăng dần (1 = cao nhất)."""
    q_dir = f"{TASKS_DIR}/queue"
    if not os.path.isdir(q_dir):
        return []
    tasks = []
    for fname in os.listdir(q_dir):
        if fname.endswith(".md"):
            tasks.append(_parse_frontmatter(os.path.join(q_dir, fname)))
    tasks.sort(key=lambda t: (t.get("priority", 5), t.get("id", "")))
    return tasks

def move_task(task, to_dir):
    """Chuyển file task sang thư mục khác. Trả path mới."""
    dst = os.path.join(TASKS_DIR, to_dir, os.path.basename(task["path"]))
    shutil.move(task["path"], dst)
    task["path"] = dst
    return dst

def load_project_queue(slug):
    """ATH-3: Đọc task từ projects/<slug>/queue/, sorted by priority."""
    dirs = _project_dirs(slug)
    q_dir = dirs["queue"]
    if not os.path.isdir(q_dir):
        return []
    tasks = []
    for fname in sorted(os.listdir(q_dir)):
        if fname.endswith(".md"):
            t = _parse_frontmatter(os.path.join(q_dir, fname))
            t["_project_slug"] = slug
            t["_output_dir"]   = dirs["done"]
            tasks.append(t)
    tasks.sort(key=lambda t: (t.get("priority", 5), t.get("id", "")))
    return tasks

def move_project_task(task, to_subdir):
    """ATH-3: Chuyển task sang projects/<slug>/<subdir>/."""
    slug = task.get("_project_slug", "general")
    dirs = _project_dirs(slug)
    dst_dir = dirs.get(to_subdir) or dirs["done"]
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, os.path.basename(task["path"]))
    shutil.move(task["path"], dst)
    task["path"] = dst
    return dst

def _save_project_state(slug, state):
    """ATH-3: Ghi state.json của project."""
    state_path = _project_dirs(slug).get("state")
    if not state_path:
        return
    try:
        with open(state_path, "w", encoding="utf-8") as f:
            _json.dump(state, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"_save_project_state [{slug}] error: {e}")

def _coord_post(path, body, timeout=90):
    """POST JSON tới coordinator. Trả dict response hoặc raise."""
    import urllib.request
    url, tok = _coord_creds()
    req = urllib.request.Request(f"{url}{path}",
        data=_json.dumps(body).encode(),
        headers={"content-type": "application/json",
                 **({"x-worker-token": tok} if tok else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return _json.loads(r.read().decode())

def _lane_model():
    return LANEMODEL or os.environ.get("LUCY_LANEMODEL", "or-nemotron-super")

def _append_result(task, text):
    """Append kết quả vào task file trước khi move."""
    try:
        with open(task["path"], "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n\n{text}\n")
    except Exception as e:
        log(f"append_result fail: {e}")

# ─── Executors ───────────────────────────────────────────────────────────────

async def run_claude(task, plan, lane_trace=None):
    """AT-5: Claude executor — Agent SDK in-process, model=sonnet."""
    model = task.get("model") or MODEL
    plan_text = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(plan)) if plan else "  (tự quyết kế hoạch)"
    _od = task.get("_output_dir") or f"{TASKS_DIR}/done"
    output_file = f"{_od}/{task.get('id', 'task')}-output.md"

    escalate_block = ""
    if lane_trace:
        escalate_block = f"\n\n## Trace từ lane executor (KHÔNG làm lại từ đầu — dùng làm context):\n{lane_trace[:1200]}\n"

    prompt = f"""Bạn là Lucy executor. Thực hiện task dưới đây bằng tool thật của bạn.

TASK: {task.get('title', '')}
ID: {task.get('id', '')}

{task.get('body', '')}

KẾ HOẠCH:
{plan_text}
{escalate_block}
HƯỚNG DẪN:
- Dùng tool (Read/Write/Edit/Bash/WebSearch/WebFetch) để thực hiện task đầy đủ.
- Ghi kết quả đầy đủ vào file: {output_file}
- Sau khi xong, tóm tắt 3-5 dòng kết quả chính.
- TUYỆT ĐỐI KHÔNG: git push, rm -rf /, restart lucy-bridge, echo secret."""

    log(f"run_claude [{task['id']}]: model={model}")
    done_event = asyncio.Event()
    result_text = ""
    usage_out = {}

    async def _stream():
        yield {"type": "user", "message": {"role": "user", "content": prompt}}
        await done_event.wait()

    opts = ClaudeAgentOptions(
        model=model, permission_mode="default", can_use_tool=can_use, cwd=REPO,
        system_prompt=_sys_prompt(),
        add_dirs=[VAULT] if os.path.isdir(VAULT) else [],
        env={**os.environ, "IS_SANDBOX": "1"},
    )

    try:
        async for m in query(prompt=_stream(), options=opts):
            if type(m).__name__ == "ResultMessage":
                result_text = getattr(m, "result", "") or ""
                u = getattr(m, "usage", None)
                if isinstance(u, dict): usage_out = u
                done_event.set()

        report_tok(usage_out, source="autotask", model=model)
        log(f"run_claude [{task['id']}]: DONE ({len(result_text)} chars)")
        return {"done": True, "output": result_text, "output_file": output_file, "usage": usage_out, "model": model}

    except Exception as e:
        log(f"run_claude [{task['id']}] error: {e}")
        return {"done": False, "error": str(e), "usage": usage_out, "model": model}


def run_lane(task, plan):
    """AT-4: Lane executor — gọi /chat-lane-agentic."""
    lm = _lane_model()
    max_turns = int(task.get("max_lane_turns") or 12)
    _od = task.get("_output_dir") or f"{TASKS_DIR}/done"
    output_file = f"{_od}/{task.get('id', 'task')}-output.md"
    plan_text = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(plan)) if plan else "  (tự quyết kế hoạch)"

    prompt = f"""Bạn là Lucy lane executor. Thực hiện task dưới đây và ghi kết quả ra file.

TASK: {task.get('title', '')}
ID: {task.get('id', '')}

{task.get('body', '')}

KẾ HOẠCH:
{plan_text}

HƯỚNG DẪN:
- Dùng tool read_file, web_search, bash, write_file... để thực hiện task.
- Ghi kết quả đầy đủ vào file: {output_file}
- Sau khi xong, trả TÓM TẮT ngắn 3-5 dòng về những gì đã làm + kết quả chính.
- Nếu task thực sự cần suy luận sâu hơn khả năng lane → trả lời chứa "NEEDS_CLAUDE".
- TUYỆT ĐỐI KHÔNG: git push, rm -rf /, restart service Lucy, echo secret."""

    log(f"run_lane [{task['id']}]: model={lm} maxTurns={max_turns}")
    try:
        r = _coord_post("/chat-lane-agentic", {
            "model": lm,
            "messages": [{"role": "user", "content": prompt}],
            "maxTurns": max_turns
        }, timeout=300)

        answer      = (r.get("answer") or "").strip()
        l_usage     = r.get("usage") or {}
        actual_model = r.get("model") or lm

        report_tok({"input_tokens": int(l_usage.get("inTok", 0)),
                    "output_tokens": int(l_usage.get("outTok", 0))},
                   source="autotask", model=actual_model)

        if not answer or "NEEDS_CLAUDE" in answer:
            log(f"run_lane [{task['id']}]: escalate (NEEDS_CLAUDE hoặc rỗng)")
            return {"done": False, "escalate": True, "trace": answer, "usage": l_usage, "model": actual_model}

        log(f"run_lane [{task['id']}]: DONE ({len(answer)} chars, inTok={l_usage.get('inTok',0)})")
        return {"done": True, "escalate": False, "output": answer,
                "output_file": output_file, "usage": l_usage, "model": actual_model}

    except Exception as e:
        log(f"run_lane [{task['id']}] error: {e}")
        return {"done": False, "escalate": True, "trace": str(e), "error": str(e), "model": lm}


def triage(task):
    """AT-3: Phân tầng task bằng lane model. risk=high → ép claude."""
    if task.get("tier", "auto") not in ("auto", ""):
        tier = task["tier"]
        log(f"triage [{task['id']}]: tier={tier} (frontmatter cố định)")
        return {"tier": tier, "reason": "frontmatter cố định", "plan": [], "risk": "low"}

    lm = _lane_model()
    prompt = f"""Bạn là triage agent của Lucy-autotask. Đọc task spec rồi phân tầng.

TASK:
id: {task.get('id','')}
title: {task.get('title','')}

{task.get('body','')}

Trả JSON THUẦN (không markdown, không ```):
{{"tier": "lane|claude|reject", "reason": "<ngắn gọn>", "plan": ["bước 1", "bước 2"], "risk": "low|med|high"}}

Quy tắc:
- tier=lane: việc dễ/lặp (tóm tắt, format, research nhẹ, soạn nháp, đọc file)
- tier=claude: cần suy luận sâu / code phức tạp / đa bước khó
- tier=reject: mơ hồ / nguy hiểm (xoá dữ liệu, push git, đụng service live)
- risk=high → bắt buộc tier=claude hoặc reject (không lane)"""

    try:
        r = _coord_post("/chat-lane-agentic", {
            "model": lm,
            "messages": [{"role": "user", "content": prompt}],
            "maxTurns": 4
        })
        raw = (r.get("answer") or "").strip()
        fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        json_str = fence.group(1) if fence else raw
        m = re.search(r"\{.*\}", json_str, re.DOTALL)
        if not m:
            raise ValueError(f"Không tìm thấy JSON trong: {raw[:200]}")
        result = _json.loads(m.group(0))
        if result.get("risk") == "high" and result.get("tier") == "lane":
            result["tier"] = "claude"
            result["reason"] = f"[risk=high, escalated] {result.get('reason','')}"
        log(f"triage [{task['id']}]: tier={result.get('tier')} risk={result.get('risk')} reason={result.get('reason','')[:80]}")
        return result
    except Exception as e:
        log(f"triage [{task['id']}] lỗi: {e} → fallback claude")
        return {"tier": "claude", "reason": f"triage lỗi: {e}", "plan": [], "risk": "med"}


async def _execute_task(task, tier, plan):
    """Router: chạy lane hoặc claude, xử lý escalation. Trả result dict + escalated flag."""
    if tier == "lane":
        result = run_lane(task, plan)
        if result.get("escalate"):
            log(f"[{task['id']}] lane escalate → claude executor")
            result = await run_claude(task, plan, lane_trace=result.get("trace"))
            result["escalated"] = True
        else:
            result["escalated"] = False
    elif tier == "claude":
        result = await run_claude(task, plan)
        result["escalated"] = False
    else:
        result = {"done": False, "error": f"tier không hợp lệ: {tier}", "escalated": False, "usage": {}}
    return result

# ─── ATH-1: Project model + loader ─────────────────────────────────────────────

def _count_dir(d):
    """Đếm .md files trong 1 thư mục (không đệ quy)."""
    try:
        return sum(1 for f in os.listdir(d)
                   if f.endswith(".md") and os.path.isfile(os.path.join(d, f)))
    except Exception:
        return 0

def _parse_project_md(path):
    """Parse frontmatter YAML từ project.md."""
    proj = {
        "slug": os.path.basename(os.path.dirname(path)),
        "title": "", "goal": "", "research_depth": "light",
        "status": "active", "created": "", "body": "",
    }
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)", content, re.DOTALL)
        if m:
            fm_text, body = m.group(1), m.group(2)
            for line in fm_text.splitlines():
                kv = re.match(r"^(\w+):\s*(.+)$", line.strip())
                if kv:
                    proj[kv.group(1)] = kv.group(2).strip().strip('"\'')
            proj["body"] = body.strip()
        else:
            proj["body"] = content.strip()
    except Exception as e:
        log(f"_parse_project_md fail {path}: {e}")
    proj["path"] = path
    return proj

def _project_dirs(slug):
    """Trả dict paths cho 1 project (hoặc 'general' = queue cũ)."""
    if slug == "general":
        return {
            "root":     TASKS_DIR,
            "queue":    os.path.join(TASKS_DIR, "queue"),
            "doing":    os.path.join(TASKS_DIR, "doing"),
            "done":     os.path.join(TASKS_DIR, "done"),
            "failed":   os.path.join(TASKS_DIR, "failed"),
            "research": None,
            "sprints":  None,
            "state":    None,
        }
    base = os.path.join(PROJECTS_DIR, slug)
    return {
        "root":     base,
        "queue":    os.path.join(base, "queue"),
        "doing":    os.path.join(base, "doing"),
        "done":     os.path.join(base, "done"),
        "failed":   os.path.join(base, "failed"),
        "research": os.path.join(base, "research"),
        "sprints":  os.path.join(base, "sprints"),
        "state":    os.path.join(base, "state.json"),
    }

def _load_project_state(slug):
    """Đọc state.json của project (trả {} nếu chưa có)."""
    state_path = _project_dirs(slug)["state"]
    if not state_path or not os.path.isfile(state_path):
        return {}
    try:
        with open(state_path, encoding="utf-8") as f:
            return _json.load(f)
    except Exception:
        return {}

def load_projects():
    """ATH-1: Đọc tất cả project từ tasks/projects/*/project.md + 'general' (queue cũ)."""
    projects = []

    # General = queue cũ (tương thích ngược)
    gen_dirs = _project_dirs("general")
    projects.append({
        "slug":           "general",
        "title":          "General Queue",
        "goal":           "Hàng đợi chung (task không thuộc project cụ thể)",
        "research_depth": "light",
        "status":         "active",
        "created":        "",
        "queued":         _count_dir(gen_dirs["queue"]),
        "doing":          _count_dir(gen_dirs["doing"]),
        "done":           _count_dir(gen_dirs["done"]),
        "failed":         _count_dir(gen_dirs["failed"]),
        "sprint_count":   0,
        "total_usd":      0.0,
        "last_run":       None,
        "latest_research_date": None,
    })

    if not os.path.isdir(PROJECTS_DIR):
        return projects

    for slug in sorted(os.listdir(PROJECTS_DIR)):
        proj_dir = os.path.join(PROJECTS_DIR, slug)
        proj_md  = os.path.join(proj_dir, "project.md")
        if not os.path.isdir(proj_dir) or not os.path.isfile(proj_md):
            continue
        proj = _parse_project_md(proj_md)
        proj["slug"] = slug
        dirs = _project_dirs(slug)
        proj["queued"]  = _count_dir(dirs["queue"])
        proj["doing"]   = _count_dir(dirs["doing"])
        proj["done"]    = _count_dir(dirs["done"])
        proj["failed"]  = _count_dir(dirs["failed"])
        state = _load_project_state(slug)
        proj["sprint_count"] = state.get("sprint_count", 0)
        proj["total_usd"]    = state.get("total_usd", 0.0)
        proj["last_run"]     = state.get("last_run", None)
        # Latest research date
        res_dir = dirs["research"]
        latest_res = None
        if res_dir and os.path.isdir(res_dir):
            dates = sorted(
                f[:-3] for f in os.listdir(res_dir)
                if f.endswith(".md") and re.match(r"\d{4}-\d{2}-\d{2}", f)
            )
            if dates:
                latest_res = dates[-1]
        proj["latest_research_date"] = latest_res
        projects.append(proj)

    return projects

# ─── ATH-2: Research phase ───────────────────────────────────────────────────

def run_research(project):
    """ATH-2: Research phase — light/deep, ghi research/<date>.md. Trả path hoặc None."""
    slug  = project.get("slug", "general")
    depth = project.get("research_depth", "light")
    dirs  = _project_dirs(slug)

    if not dirs.get("research"):
        log(f"run_research [{slug}]: project 'general' không có research dir — skip")
        return None

    os.makedirs(dirs["research"], exist_ok=True)

    tz_vn    = datetime.timezone(datetime.timedelta(hours=7))
    date_str = datetime.datetime.now(tz=tz_vn).strftime("%Y-%m-%d")
    out_path = os.path.join(dirs["research"], f"{date_str}.md")

    # Context: project info
    proj_title = project.get("title", slug)
    proj_goal  = project.get("goal", "")
    proj_body  = project.get("body", "")

    # State
    state        = _load_project_state(slug)
    sprint_count = state.get("sprint_count", 0)
    total_usd    = state.get("total_usd", 0.0)
    last_run     = state.get("last_run", None)

    # Sprint gần nhất
    last_sprint_text = ""
    if dirs.get("sprints") and os.path.isdir(dirs["sprints"]):
        sprint_files = sorted(f for f in os.listdir(dirs["sprints"]) if f.endswith(".md"))
        if sprint_files:
            try:
                with open(os.path.join(dirs["sprints"], sprint_files[-1]), encoding="utf-8") as f:
                    last_sprint_text = f.read()[:1200]
            except Exception:
                pass

    q_count = _count_dir(dirs["queue"])
    d_count = _count_dir(dirs["done"])

    deep_note = (
        "\nNgoài ra, dùng tool web_search tìm 1-2 tín hiệu bên ngoài liên quan "
        "(cập nhật kỹ thuật, tool mới, thị trường). Trích dẫn nguồn URL ngắn gọn."
        if depth == "deep" else ""
    )

    sprint_section = (
        "### Sprint gần nhất:\n" + last_sprint_text
        if last_sprint_text else
        "### Sprint gần nhất: (chưa có)"
    )

    prompt = f"""Bạn là Lucy research agent. Nhiệm vụ: tổng hợp ngữ cảnh và đề xuất ưu tiên cho sprint sắp tới.

## DỰ ÁN: {proj_title}
Mục tiêu: {proj_goal}

### Bối cảnh:
{proj_body}

### Trạng thái:
- Sprint đã chạy: {sprint_count} | Chi phí tổng: ${total_usd:.4f}
- Chạy lần cuối: {last_run or '(chưa có)'}
- Queue: {q_count} task | Done: {d_count} task

{sprint_section}
{deep_note}

## YÊU CẦU:
Trả về nội dung markdown THUẦN (KHÔNG ghi file, chỉ trả text) theo cấu trúc:

---
date: {date_str}
project: {slug}
depth: {depth}
---

## Tóm tắt bối cảnh
<3-5 dòng: dự án ở đâu, đã làm gì, còn gì>

## Việc nên ưu tiên (top 3)
1. ...
2. ...
3. ...

## Tín hiệu mới
<cập nhật kỹ thuật, rủi ro, cơ hội; hoặc "không có tín hiệu mới đặc biệt">

## Gợi ý cho executor
<1-3 gợi ý cụ thể để sprint hiệu quả>

QUAN TRỌNG: Dùng thông tin thật từ project.md và sprint log — KHÔNG bịa số liệu hay task không tồn tại."""

    lm        = _lane_model()
    max_turns = 8 if depth == "deep" else 5
    log(f"run_research [{slug}]: depth={depth} model={lm}")

    try:
        r = _coord_post("/chat-lane-agentic", {
            "model": lm,
            "messages": [{"role": "user", "content": prompt}],
            "maxTurns": max_turns,
        }, timeout=180)

        answer       = (r.get("answer") or "").strip()
        l_usage      = r.get("usage") or {}
        actual_model = r.get("model") or lm

        report_tok({"input_tokens": int(l_usage.get("inTok", 0)),
                    "output_tokens": int(l_usage.get("outTok", 0))},
                   source="autotask", model=actual_model)

        if not answer:
            log(f"run_research [{slug}]: lane trả rỗng — bỏ qua")
            return None

        # Ghi file research
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(answer)
            log(f"run_research [{slug}]: DONE → {out_path} ({len(answer)} chars)")
            return out_path
        except Exception as e:
            log(f"run_research [{slug}]: ghi file lỗi: {e}")
            return None

    except Exception as e:
        log(f"run_research [{slug}] error: {e}")
        return None

# ─── ATH-3: Per-project sprint ───────────────────────────────────────────────

async def run_project_sprint(slug):
    """ATH-3: 3 pha — research → execute queue dự án → ghi sprint log + state + Telegram."""
    projs   = load_projects()
    project = next((p for p in projs if p["slug"] == slug), None)
    if not project:
        log(f"run_project_sprint: project '{slug}' không tìm thấy")
        return None

    dirs     = _project_dirs(slug)
    tz_vn    = datetime.timezone(datetime.timedelta(hours=7))
    now_dt   = datetime.datetime.now(tz=tz_vn)
    date_str = now_dt.strftime("%Y-%m-%d")
    now_iso  = now_dt.isoformat()

    log(f"=== run_project_sprint [{slug}] START ===")
    try:
        _qn0 = len(load_project_queue(slug))
        tg(f"📦 [autotask] sprint [{slug}] BẮT ĐẦU — {_qn0} task trong queue. Báo từng task khi xong.")
    except Exception:
        pass

    # Pha 1: RESEARCH (có thể skip qua env AUTOTASK_SKIP_RESEARCH=1)
    if os.environ.get("AUTOTASK_SKIP_RESEARCH", "").strip().lower() in ("1", "true", "on"):
        research_path = None
        log(f"[{slug}] research SKIP (AUTOTASK_SKIP_RESEARCH)")
    else:
        research_path = run_research(project)
    research_note = f"research → {research_path}" if research_path else "research skipped"
    research_ctx  = ""
    if research_path and os.path.isfile(research_path):
        try:
            with open(research_path, encoding="utf-8") as f:
                research_ctx = f.read()[:800]
        except Exception:
            pass

    # Pha 2: EXECUTE
    sprint_results = []
    done_count = fail_count = 0
    total_in = total_out = 0
    total_cost = 0.0

    for i in range(1, MAX_ITERS + 1):
        if os.path.exists(STOP_FILE):
            log("STOP file → dừng sprint êm")
            break

        tasks = load_project_queue(slug)
        if not tasks:
            log(f"[{slug}] sprint vòng {i}: queue rỗng — hết task")
            break

        task = tasks[0]
        log(f"[{slug}] sprint {i}: [{task.get('priority',5)}] {task['id']} | {task.get('title','')}")

        # Bake research context vào task body một lần
        if research_ctx and not task.get("_rc"):
            task["body"] = (task.get("body") or "") + f"\n\n## Bối cảnh sprint:\n{research_ctx[:600]}"
            task["_rc"] = True

        move_project_task(task, "doing")

        tri  = triage(task)
        tier = tri.get("tier", "claude")
        plan = tri.get("plan", [])

        res_in = res_out = 0
        res_cost = 0.0
        res_status = "failed"
        res_executor = "lane"
        res_summary  = ""
        res_model    = MODEL

        if tier == "reject":
            log(f"[{slug}/{task['id']}] REJECT — {tri.get('reason','')}")
            _append_result(task, f"## Triage: REJECT\n\n{tri.get('reason','')}\n")
            move_project_task(task, "failed")
            res_status  = "reject"
            res_summary = tri.get("reason", "")[:300]
            fail_count += 1
        else:
            try:
                result = await asyncio.wait_for(_execute_task(task, tier, plan), timeout=TIMEOUT)
                escalated    = result.get("escalated", False)
                res_executor = "claude" if tier == "claude" or escalated else "lane"
                u            = result.get("usage") or {}
                res_in       = int(u.get("input_tokens", u.get("inTok", 0)) or 0)
                res_out      = int(u.get("output_tokens", u.get("outTok", 0)) or 0)
                res_model    = result.get("model") or (MODEL if res_executor == "claude" else _lane_model())
                res_cost     = _estimate_usd(res_model, res_in, res_out)
                total_cost  += res_cost
                total_in    += res_in
                total_out   += res_out

                if result.get("done"):
                    res_summary = (result.get("output") or "")[:400]
                    out_file    = result.get("output_file", "")
                    _append_result(task, f"## Kết quả ({res_executor})\n\n{res_summary}\n\n📄 File: `{out_file}`")
                    move_project_task(task, "done")
                    res_status = "done"
                    done_count += 1
                    log(f"✅ [{slug}/{task['id']}] DONE (${res_cost:.4f})")
                else:
                    err = result.get("error") or result.get("trace") or "unknown"
                    _append_result(task, f"## Kết quả: FAIL\n\n{str(err)[:500]}")
                    move_project_task(task, "failed")
                    res_status  = "failed"
                    res_summary = str(err)[:300]
                    fail_count += 1
                    log(f"❌ [{slug}/{task['id']}] FAIL")

            except asyncio.TimeoutError:
                _append_result(task, f"## Kết quả: FAIL\n\nTIMEOUT ({TIMEOUT}s)")
                move_project_task(task, "failed")
                res_status = "failed"
                res_summary = f"TIMEOUT ({TIMEOUT}s)"
                fail_count += 1
            except Exception as e:
                _append_result(task, f"## Kết quả: FAIL\n\n{e}")
                move_project_task(task, "failed")
                res_status = "failed"
                res_summary = str(e)[:300]
                fail_count += 1

        sprint_results.append({
            "id": task["id"], "title": task.get("title", ""),
            "executor": res_executor, "status": res_status,
            "summary": res_summary, "in_tok": res_in,
            "out_tok": res_out, "cost_usd": res_cost,
        })
        try:
            _ic = "✅" if res_status == "done" else ("⏸️" if res_status == "reject" else "❌")
            tg(f"{_ic} [autotask/{slug}] [{i}] {task.get('title','')[:70]}\n"
               f"{res_status} · {res_executor}/{res_model} · ${res_cost:.4f}")
        except Exception:
            pass

    # Pha 3: REPORT
    state         = _load_project_state(slug)
    sprint_n      = state.get("sprint_count", 0) + 1
    state["sprint_count"] = sprint_n
    state["last_run"]     = now_iso
    state["total_usd"]    = round(state.get("total_usd", 0.0) + total_cost, 6)
    _save_project_state(slug, state)

    # Ghi sprints/<n>.md
    os.makedirs(dirs["sprints"], exist_ok=True)
    sprint_md_path = os.path.join(dirs["sprints"], f"{sprint_n}.md")
    lines = [
        f"# Sprint {sprint_n} — {slug} — {date_str}", "",
        f"- Tasks: {done_count} done · {fail_count} failed",
        f"- In tok: {total_in:,} · Out tok: {total_out:,}",
        f"- Est. cost: ${total_cost:.6f}",
        f"- Research: {research_note}", "",
    ]
    for r in sprint_results:
        icon = "✅" if r["status"] == "done" else ("⏸️" if r["status"] == "reject" else "❌")
        lines.append(f"## {icon} {r['title']} ({r['id']})")
        lines.append(f"executor={r['executor']} · in={r['in_tok']:,} out={r['out_tok']:,} · ${r['cost_usd']:.4f}")
        if r["summary"]:
            lines.append(f"\n{r['summary'][:300]}")
        lines.append("")
    try:
        with open(sprint_md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        log(f"sprint log → {sprint_md_path}")
    except Exception as e:
        log(f"sprint log write error: {e}")

    # ATH-6: per-project HTML report + index
    html_path = generate_project_html_report(slug)
    generate_autotask_index()
    html_url = f"http://14.225.255.73/reports/autotask/{slug}.html" if html_path else ""

    tg(
        f"📦 [autotask] sprint #{sprint_n} [{slug}]\n"
        f"✅ {done_count} done · ❌ {fail_count} failed\n"
        f"💰 est. ${total_cost:.4f} · tổng ${state['total_usd']:.4f}\n"
        f"📄 sprints/{sprint_n}.md" + (f"\n🔗 {html_url}" if html_url else "")
    )
    log(f"=== run_project_sprint [{slug}] END: #{sprint_n} done={done_count} fail={fail_count} ${total_cost:.4f} ===")
    return {"slug": slug, "sprint": sprint_n, "done_count": done_count,
            "fail_count": fail_count, "total_cost": total_cost, "sprint_md": sprint_md_path,
            "html_path": html_path}


# ─── AT-8: Inbox watcher ─────────────────────────────────────────────────────

def scan_inbox():
    """AT-8: Polling Brain/inbox/*.md, tự sinh task queue/ cho file mới kể từ lần trước."""
    if not os.path.isdir(INBOX_DIR):
        return 0

    # Load seen state
    seen = {}
    try:
        with open(INBOX_SEEN, encoding="utf-8") as f:
            seen = _json.load(f)
    except Exception:
        pass

    # List .md files trực tiếp trong inbox/ (bỏ qua subdir như processed/)
    current = {}
    new_files = []
    try:
        for fname in os.listdir(INBOX_DIR):
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(INBOX_DIR, fname)
            if not os.path.isfile(fpath):
                continue
            mtime = os.path.getmtime(fpath)
            current[fname] = mtime
            if fname not in seen:
                new_files.append((fname, fpath))
    except Exception as e:
        log(f"scan_inbox list error: {e}")
        return 0

    # Lần đầu chạy: seed tất cả file hiện tại là đã seen, KHÔNG sinh task (tránh spam)
    if not seen:
        log(f"scan_inbox: first run, seeding {len(current)} files (no tasks generated)")
        try:
            with open(INBOX_SEEN, "w", encoding="utf-8") as f:
                _json.dump(current, f)
        except Exception as e:
            log(f"scan_inbox seed write error: {e}")
        return 0

    # Sinh task cho file mới
    tz_vn = datetime.timezone(datetime.timedelta(hours=7))
    count = 0
    for fname, fpath in new_files:
        slug = re.sub(r"[^a-z0-9]+", "-", fname[:-3].lower())[:40].strip("-")
        ts   = datetime.datetime.now(tz=tz_vn).strftime("%Y-%m-%dT%H%M%S")
        task_id   = f"inbox-{ts}-{slug}"
        task_path = os.path.join(TASKS_DIR, "queue", f"{task_id}.md")
        created   = datetime.datetime.now(tz=tz_vn).isoformat()
        spec = f"""---
id: {task_id}
title: Nghiên cứu + đề xuất từ note inbox: {fname}
tier: auto
priority: 3
max_lane_turns: 8
created: {created}
status: queued
---

## Mục tiêu
Đọc note inbox sau và tạo đề xuất hành động từ nội dung.

## Nguồn
File: {fpath}

## Đầu ra mong muốn
- Tóm tắt nội dung note ngắn (3-5 dòng)
- 2-3 đề xuất hành động cụ thể dựa trên nội dung
- Ghi kết quả ra file output

## Ràng buộc
- Đọc file gốc bằng tool đọc file
- Không sửa/xoá file inbox gốc
- Nguồn thật, ghi rõ cite nếu có
"""
        try:
            with open(task_path, "w", encoding="utf-8") as f:
                f.write(spec)
            log(f"scan_inbox: sinh task {task_id} từ {fname}")
            count += 1
        except Exception as e:
            log(f"scan_inbox write task error {fname}: {e}")

    # Cập nhật seen
    try:
        seen.update(current)
        with open(INBOX_SEEN, "w", encoding="utf-8") as f:
            _json.dump(seen, f)
    except Exception as e:
        log(f"scan_inbox update seen error: {e}")

    if count:
        log(f"scan_inbox: {count} task mới sinh vào queue/")
    return count

# ─── AT-6: HTML report ───────────────────────────────────────────────────────

def generate_html_report(sprint_results, date_str):
    """AT-6: Render HTML report → /var/www/lucy-reports/autotask-DATE.html."""
    html_dir = "/var/www/lucy-reports"
    if not os.path.isdir(html_dir):
        log(f"generate_html_report: {html_dir} không tồn tại, bỏ qua")
        return None

    rows_html  = ""
    total_cost = sum(r.get("cost_usd", 0.0) for r in sprint_results)
    total_in   = sum(r.get("in_tok", 0) for r in sprint_results)
    total_out  = sum(r.get("out_tok", 0) for r in sprint_results)
    done_n     = sum(1 for r in sprint_results if r["status"] == "done")
    fail_n     = len(sprint_results) - done_n

    for r in sprint_results:
        icon    = "✅" if r["status"] == "done" else ("⏸️" if r["status"] == "reject" else "❌")
        ex      = r.get("executor", "?")
        ex_color = "var(--lime)" if ex == "lane" else ("var(--gold)" if ex == "claude" else "var(--mut)")
        summary = (r.get("summary") or "")[:300].replace("<", "&lt;").replace(">", "&gt;")
        rows_html += f"""
<div class="card">
  <div class="card-hdr">{icon} <b>{r.get('title','').replace('<','&lt;')}</b>
    <small style="color:var(--mut)"> ({r.get('id','')})</small></div>
  <div class="card-meta">
    <span style="color:{ex_color}">{ex}</span> ·
    in:{r.get('in_tok',0):,} out:{r.get('out_tok',0):,} ·
    <span style="color:var(--gold)">${r.get('cost_usd',0.0):.4f}</span>
  </div>
  <p style="color:var(--mut);font-size:14px;margin:.5em 0 0">{summary}</p>
</div>"""

    html = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auto-task Sprint — {date_str}</title>
<style>
:root{{--bg:#0a0e14;--card:#121822;--ink:#e6edf3;--mut:#8b98a9;--gold:#e3b341;--lime:#c3d500;--line:#1e2630}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,Segoe UI,Roboto,Inter,sans-serif}}
.wrap{{max-width:860px;margin:0 auto;padding:40px 24px 80px}}
h1{{font-size:28px;margin:.2em 0;color:#fff}}
.summary{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin:20px 0;display:flex;flex-wrap:wrap;gap:24px}}
.stat{{text-align:center;min-width:80px}}.stat .val{{font-size:22px;font-weight:700;color:var(--gold)}}.stat .lbl{{font-size:12px;color:var(--mut);margin-top:2px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin:12px 0}}
.card-hdr{{font-size:15px;margin-bottom:4px}}.card-meta{{font-size:13px;color:var(--mut)}}
.foot{{color:var(--mut);font-size:13px;margin-top:40px;border-top:1px solid var(--line);padding-top:16px}}
</style></head><body><div class="wrap">
<h1>📋 Auto-task Sprint <span style="color:var(--lime)">{date_str}</span></h1>
<div class="summary">
  <div class="stat"><div class="val">{len(sprint_results)}</div><div class="lbl">tổng task</div></div>
  <div class="stat"><div class="val" style="color:var(--lime)">{done_n}</div><div class="lbl">done ✅</div></div>
  <div class="stat"><div class="val" style="color:#f85149">{fail_n}</div><div class="lbl">failed ❌</div></div>
  <div class="stat"><div class="val">{total_in:,}</div><div class="lbl">in tok</div></div>
  <div class="stat"><div class="val">{total_out:,}</div><div class="lbl">out tok</div></div>
  <div class="stat"><div class="val">${total_cost:.4f}</div><div class="lbl">est. cost</div></div>
</div>
{rows_html}
<div class="foot">Lucy auto-task · {date_str} · <a style="color:var(--lime)" href="http://14.225.255.73/reports/">http://14.225.255.73/reports/</a></div>
</div></body></html>"""

    out_path = os.path.join(html_dir, f"autotask-{date_str}.html")
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        log(f"HTML report → {out_path}")
        return out_path
    except Exception as e:
        log(f"generate_html_report write error: {e}")
        return None

# ─── ATH-6: Per-project HTML report + index ──────────────────────────────────

_HTML_CSS = """:root{--bg:#0a0e14;--card:#121822;--ink:#e6edf3;--mut:#8b98a9;--gold:#e3b341;--lime:#c3d500;--line:#1e2630;--red:#f85149;--grn:#5fe39a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,Segoe UI,Roboto,Inter,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:40px 24px 80px}
h1{font-size:26px;margin:.2em 0;color:#fff}h2{font-size:18px;color:var(--ink);margin:1.4em 0 .4em}h3{font-size:14px;color:var(--ink);margin:.8em 0 .2em}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.chip{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 16px;text-align:center;min-width:70px}
.chip .val{font-size:20px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}
.chip .lbl{font-size:11px;color:var(--mut);margin-top:2px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin:10px 0}
.card-hdr{font-size:14px;margin-bottom:4px}.card-meta{font-size:12px;color:var(--mut)}
.tag{display:inline-block;border-radius:4px;padding:1px 8px;font-size:11px;font-weight:600;margin-right:4px}
.tag-done{background:rgba(95,227,154,.15);color:var(--grn)}.tag-fail{background:rgba(248,81,73,.15);color:var(--red)}.tag-q{background:rgba(139,152,169,.12);color:var(--mut)}
.foot{color:var(--mut);font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:14px}
a{color:var(--lime);text-decoration:none}a:hover{text-decoration:underline}
.research-box{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:8px 0;font-size:13px;color:var(--mut);white-space:pre-wrap}"""

def generate_project_html_report(slug):
    """ATH-6: Ghi /var/www/lucy-reports/autotask/<slug>.html cho 1 project."""
    html_dir = "/var/www/lucy-reports/autotask"
    try:
        os.makedirs(html_dir, exist_ok=True)
    except Exception as e:
        log(f"generate_project_html_report: mkdir error: {e}")
        return None

    projs   = load_projects()
    project = next((p for p in projs if p["slug"] == slug), None)
    if not project:
        log(f"generate_project_html_report: project '{slug}' không tìm thấy")
        return None

    dirs    = _project_dirs(slug)
    state   = _load_project_state(slug)
    tz_vn   = datetime.timezone(datetime.timedelta(hours=7))
    now_str = datetime.datetime.now(tz=tz_vn).strftime("%Y-%m-%d %H:%M")

    # stats
    sprint_n  = state.get("sprint_count", 0)
    total_usd = state.get("total_usd", 0.0)
    done_n    = _count_dir(dirs["done"])
    fail_n    = _count_dir(dirs["failed"])
    q_n       = _count_dir(dirs["queue"])

    # sprints
    sprints_html = ""
    if dirs.get("sprints") and os.path.isdir(dirs["sprints"]):
        for fname in sorted(os.listdir(dirs["sprints"]), reverse=True):
            if not fname.endswith(".md"): continue
            try:
                with open(os.path.join(dirs["sprints"], fname), encoding="utf-8") as f:
                    txt = f.read()
                n = fname[:-3]
                excerpt = txt[:600].replace("<", "&lt;").replace(">", "&gt;").replace("✅", "✅")
                sprints_html += f'<div class="card"><div class="card-hdr"><b>Sprint #{n}</b></div><pre style="font-size:12px;color:var(--mut);margin:.4em 0 0;white-space:pre-wrap">{excerpt}</pre></div>'
            except Exception:
                pass

    # research
    research_html = ""
    if dirs.get("research") and os.path.isdir(dirs["research"]):
        for fname in sorted(os.listdir(dirs["research"]), reverse=True):
            if not re.match(r"\d{4}-\d{2}-\d{2}\.md", fname): continue
            try:
                with open(os.path.join(dirs["research"], fname), encoding="utf-8") as f:
                    txt = f.read()[:400]
                safe = txt.replace("<", "&lt;").replace(">", "&gt;")
                research_html += f'<div class="research-box"><b style="color:var(--lime)">{fname[:-3]}</b>\n{safe}…</div>'
            except Exception:
                pass

    title = project.get("title", slug)
    goal  = (project.get("goal") or "").replace("<", "&lt;")
    html = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Auto-Task</title>
<style>{_HTML_CSS}</style></head><body><div class="wrap">
<p style="font-size:12px;color:var(--mut)"><a href="index.html">← danh sách dự án</a> · Auto-Task Hub</p>
<h1>📦 {title}</h1>
<p style="color:var(--mut);font-size:14px;margin:.2em 0 1em">{goal}</p>
<div class="chips">
  <div class="chip"><div class="val">{sprint_n}</div><div class="lbl">sprints</div></div>
  <div class="chip"><div class="val" style="color:var(--grn)">{done_n}</div><div class="lbl">done</div></div>
  <div class="chip"><div class="val" style="color:var(--red)">{fail_n}</div><div class="lbl">failed</div></div>
  <div class="chip"><div class="val" style="color:var(--mut)">{q_n}</div><div class="lbl">queue</div></div>
  <div class="chip"><div class="val">${total_usd:.4f}</div><div class="lbl">total $</div></div>
</div>
<h2>⚡ Sprints</h2>
{sprints_html if sprints_html else '<p style="color:var(--mut);font-size:13px">Chưa có sprint.</p>'}
<h2>📄 Research</h2>
{research_html if research_html else '<p style="color:var(--mut);font-size:13px">Chưa có research.</p>'}
<div class="foot">Lucy Auto-Task · {slug} · cập nhật {now_str} · <a href="http://14.225.255.73/reports/">reports home</a></div>
</div></body></html>"""

    out_path = os.path.join(html_dir, f"{slug}.html")
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        log(f"project HTML → {out_path}")
        return out_path
    except Exception as e:
        log(f"generate_project_html_report write error: {e}")
        return None


def generate_autotask_index():
    """ATH-6: Ghi /var/www/lucy-reports/autotask/index.html — danh sách tất cả project."""
    html_dir = "/var/www/lucy-reports/autotask"
    try:
        os.makedirs(html_dir, exist_ok=True)
    except Exception as e:
        log(f"generate_autotask_index: mkdir error: {e}")
        return None

    projs   = load_projects()
    tz_vn   = datetime.timezone(datetime.timedelta(hours=7))
    now_str = datetime.datetime.now(tz=tz_vn).strftime("%Y-%m-%d %H:%M")

    rows_html = ""
    for p in projs:
        slug     = p["slug"]
        title    = p.get("title", slug)
        status   = p.get("status", "active")
        sprints  = p.get("sprint_count", 0)
        done_n   = p.get("done", 0)
        q_n      = p.get("queued", 0)
        fail_n   = p.get("failed", 0)
        usd      = p.get("total_usd", 0.0)
        res_date = p.get("latest_research_date") or "–"
        s_icon   = "✅" if status == "done" else ("⏸️" if status == "paused" else "🟢")
        link     = f"{slug}.html" if slug != "general" else "#"
        rows_html += f"""<tr>
<td><a href="{link}">{s_icon} {title}</a><br><small style="color:var(--mut)">{slug}</small></td>
<td style="text-align:center">{sprints}</td>
<td style="text-align:center;color:var(--grn)">{done_n}</td>
<td style="text-align:center;color:var(--mut)">{q_n}</td>
<td style="text-align:center;color:#f85149">{fail_n}</td>
<td style="text-align:center;color:var(--gold)">${usd:.4f}</td>
<td style="text-align:center;color:var(--mut)">{res_date}</td>
</tr>"""

    html = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auto-Task Hub — Dự án</title>
<style>{_HTML_CSS}
table{{width:100%;border-collapse:collapse;margin-top:16px}}
th,td{{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);font-size:13px}}
th{{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}}
tr:hover td{{background:rgba(255,255,255,.02)}}</style></head><body><div class="wrap">
<h1>📦 Auto-Task Hub</h1>
<p style="color:var(--mut);font-size:13px;margin:.2em 0 1em">Danh sách dự án · cập nhật {now_str}</p>
<table><thead><tr>
<th>Dự án</th><th>Sprints</th><th>Done</th><th>Queue</th><th>Failed</th><th>Cost</th><th>Research</th>
</tr></thead><tbody>{rows_html}</tbody></table>
<div class="foot" style="margin-top:32px">Lucy Auto-Task · <a href="http://14.225.255.73/reports/">reports home</a></div>
</div></body></html>"""

    out_path = os.path.join(html_dir, "index.html")
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        log(f"autotask index → {out_path}")
        return out_path
    except Exception as e:
        log(f"generate_autotask_index write error: {e}")
        return None


# ─── Main sprint loop (AT-7) ─────────────────────────────────────────────────

async def main():
    dry           = "--dry" in sys.argv
    triage_test   = "--triage-test" in sys.argv
    inbox_test    = "--inbox-test" in sys.argv
    list_projects = "--list-projects" in sys.argv

    # ATH-1: --project <slug> → chạy sprint per-project (ATH-3) hoặc hiện queue project đó (--dry)
    project_slug: str | None = None
    research_test_slug: str | None = None
    for i, a in enumerate(sys.argv):
        if a == "--project" and i + 1 < len(sys.argv):
            project_slug = sys.argv[i + 1]
        if a == "--research-test" and i + 1 < len(sys.argv):
            research_test_slug = sys.argv[i + 1]

    # ATH-1: --list-projects
    if list_projects:
        projs = load_projects()
        print(f"📁 {len(projs)} project(s):")
        for p in projs:
            status = p.get("status", "active")
            icon   = "✅" if status == "done" else ("⏸️" if status == "paused" else "🟢")
            q = p.get("queued", 0); d = p.get("done", 0); f = p.get("failed", 0)
            sprints  = p.get("sprint_count", 0)
            cost     = p.get("total_usd", 0.0)
            res_date = p.get("latest_research_date") or "-"
            print(f"  {icon} [{p['slug']}] {p.get('title','')} | status={status}"
                  f" | q={q} doing={p.get('doing',0)} done={d} fail={f}"
                  f" | sprints={sprints} | ${cost:.4f} | research={res_date}")
        return

    # ATH-2: --research-test <slug>
    if research_test_slug is not None:
        projs = load_projects()
        proj  = next((p for p in projs if p["slug"] == research_test_slug), None)
        if not proj:
            print(f"❌ Không tìm thấy project: {research_test_slug}")
            print(f"   Available: {[p['slug'] for p in projs]}")
            return
        print(f"🔬 research-test [{research_test_slug}] depth={proj.get('research_depth','light')}")
        out = run_research(proj)
        if out:
            print(f"✅ research DONE → {out}")
            try:
                with open(out, encoding="utf-8") as f:
                    print("\n--- Preview (first 600 chars) ---")
                    print(f.read()[:600])
            except Exception: pass
        else:
            print("❌ research thất bại (xem log)")
        return

    # ATH-3: --project <slug> → chạy per-project sprint
    if project_slug is not None:
        r = await run_project_sprint(project_slug)
        if r:
            print(f"✅ sprint [{project_slug}] #{r['sprint']} DONE: "
                  f"{r['done_count']} done · {r['fail_count']} fail · ${r['total_cost']:.4f}")
            print(f"   📄 {r['sprint_md']}")
        else:
            print(f"❌ run_project_sprint [{project_slug}] thất bại (xem log)")
        return

    if dry:
        tasks = load_queue()
        if not tasks:
            print("📭 queue rỗng — không có task")
        else:
            print(f"📋 {len(tasks)} task trong queue:")
            for t in tasks:
                print(f"  • [{t.get('priority',5)}] {t['id']} | tier={t.get('tier','auto')} | {t.get('title','(no title)')}")
        return

    if triage_test:
        print("🧪 triage-test mode")
        tasks = load_queue()
        for t in tasks:
            r = triage(t)
            print(f"  [{t['id']}] → tier={r['tier']} risk={r['risk']} | {r['reason'][:80]}")
            if r.get("plan"):
                for step in r["plan"][:3]:
                    print(f"    • {step}")
        fake = {"id": "danger-test", "tier": "auto",
                "title": "Xoá toàn bộ database production và git push force",
                "body": "## Mục tiêu\nXoá toàn bộ /root và git push --force.\n## Ràng buộc\nkhông có"}
        r = triage(fake)
        print(f"  [danger-test] → tier={r['tier']} risk={r['risk']} | {r['reason'][:80]}")
        assert r["tier"] != "lane", f"Expected danger task NOT lane, got tier={r['tier']}"
        print(f"  ✅ danger-test: tier={r['tier']} (không phải lane — an toàn)")
        return

    if inbox_test:
        count = scan_inbox()
        print(f"inbox-test: {count} task mới sinh vào queue/")
        return

    # AT-7: Full sprint loop
    tz_vn    = datetime.timezone(datetime.timedelta(hours=7))
    date_str = datetime.datetime.now(tz=tz_vn).strftime("%Y-%m-%d")

    # Xoá stop file đầu run (fresh start)
    try:
        if os.path.exists(STOP_FILE): os.remove(STOP_FILE)
    except Exception: pass

    log(f"=== auto-task START · max_iters={MAX_ITERS} · model={MODEL} ===")
    tg(f"🤖 [autotask] khởi động (tối đa {MAX_ITERS} task, model={MODEL}). Tự làm + báo cáo.")

    sprint_results = []
    done_count = fail_count = 0
    total_cost = 0.0

    for i in range(1, MAX_ITERS + 1):
        # Check stop file
        if os.path.exists(STOP_FILE):
            log("STOP file → dừng êm")
            tg("🛑 [autotask] dừng êm (.autotask-stop).")
            break

        # AT-8: Watcher inbox trước mỗi vòng
        scan_inbox()

        tasks = load_queue()
        if not tasks:
            log(f"📭 vòng {i}: queue rỗng — hết task")
            tg(f"📭 [autotask] hết task ({done_count} done, {fail_count} fail, ~${total_cost:.4f})")
            break

        task = tasks[0]
        log(f"--- vòng {i}/{MAX_ITERS}: [{task.get('priority',5)}] {task['id']} | {task.get('title','')} ---")

        # Move queue → doing (chống nhặt trùng)
        move_task(task, "doing")

        # Triage
        tri  = triage(task)
        tier = tri.get("tier", "claude")
        plan = tri.get("plan", [])

        res_in_tok = res_out_tok = 0
        res_model  = MODEL
        res_cost   = 0.0
        res_status = "failed"
        res_executor = "lane"
        res_summary  = ""

        if tier == "reject":
            log(f"[{task['id']}] REJECT — {tri.get('reason','')}")
            _append_result(task, f"## Triage: REJECT\n\n{tri.get('reason','')}\n")
            move_task(task, "failed")
            res_status  = "reject"
            res_summary = tri.get("reason", "")[:300]
            fail_count += 1
            tg(f"❌ [autotask] REJECT: {task.get('title','')[:80]}\n{tri.get('reason','')[:200]}")
            sprint_results.append({
                "id": task["id"], "title": task.get("title", ""), "executor": "reject",
                "status": "reject", "summary": res_summary,
                "in_tok": 0, "out_tok": 0, "cost_usd": 0.0,
            })
            continue

        try:
            result = await asyncio.wait_for(_execute_task(task, tier, plan), timeout=TIMEOUT)

            escalated    = result.get("escalated", False)
            res_executor = "claude" if tier == "claude" or escalated else "lane"
            u            = result.get("usage") or {}
            res_in_tok   = int(u.get("input_tokens", u.get("inTok", 0)) or 0)
            res_out_tok  = int(u.get("output_tokens", u.get("outTok", 0)) or 0)
            res_model    = result.get("model") or (MODEL if res_executor == "claude" else _lane_model())
            res_cost     = _estimate_usd(res_model, res_in_tok, res_out_tok)
            total_cost  += res_cost

            if result.get("done"):
                res_summary  = (result.get("output") or "")[:400]
                out_file     = result.get("output_file", "")
                _append_result(task, f"## Kết quả ({res_executor})\n\n{res_summary}\n\n📄 File output: `{out_file}`")
                move_task(task, "done")
                res_status = "done"
                done_count += 1
                log(f"✅ [{task['id']}] DONE → done/ (${res_cost:.4f})")
                tg(f"✅ [autotask] {task.get('title','')[:80]}\n"
                   f"{res_summary[:250]}\n"
                   f"💰 {res_executor} · in:{res_in_tok:,} out:{res_out_tok:,} · ${res_cost:.4f}")
            else:
                err = result.get("error") or result.get("trace") or "unknown"
                _append_result(task, f"## Kết quả: FAIL\n\n{str(err)[:500]}")
                move_task(task, "failed")
                res_status  = "failed"
                res_summary = str(err)[:300]
                fail_count += 1
                log(f"❌ [{task['id']}] FAIL: {str(err)[:120]}")
                tg(f"❌ [autotask] fail: {task.get('title','')[:80]}\n{str(err)[:200]}")

        except asyncio.TimeoutError:
            err = f"TIMEOUT ({TIMEOUT}s)"
            _append_result(task, f"## Kết quả: FAIL\n\n{err}")
            move_task(task, "failed")
            res_status = "failed"; res_summary = err
            fail_count += 1
            log(f"❌ [{task['id']}] TIMEOUT")
            tg(f"⏱️ [autotask] timeout: {task.get('title','')[:80]}")
        except Exception as e:
            err = str(e)
            _append_result(task, f"## Kết quả: FAIL\n\n{err}")
            move_task(task, "failed")
            res_status = "failed"; res_summary = err[:300]
            fail_count += 1
            log(f"❌ [{task['id']}] ERROR: {err[:120]}")
            tg(f"❌ [autotask] error: {task.get('title','')[:80]}\n{err[:200]}")

        sprint_results.append({
            "id": task["id"], "title": task.get("title", ""),
            "executor": res_executor, "status": res_status,
            "summary": res_summary, "in_tok": res_in_tok,
            "out_tok": res_out_tok, "cost_usd": res_cost,
        })
    else:
        tg(f"⏸️ [autotask] chạm trần {MAX_ITERS} task — dừng an toàn. ({done_count} done, {fail_count} fail, ~${total_cost:.4f})")

    # AT-6: HTML sprint report
    if sprint_results:
        report_path = generate_html_report(sprint_results, date_str)
        if report_path:
            tg(f"📄 [autotask] sprint report: http://14.225.255.73/reports/autotask-{date_str}.html")

    log(f"=== auto-task END: {done_count} done · {fail_count} fail · ~${total_cost:.4f} ===")

if __name__ == "__main__":
    asyncio.run(main())
