#!/usr/bin/env python3
"""Lucy Bridge — Telegram <-> Claude Code (claude -p) TRỰC TIẾP. KHÔNG Hermes.

Mỗi tin Telegram của chủ nhân -> `claude -p` (brain thật: tool + memory + web riêng) -> trả về Telegram.
Giữ phiên qua --resume (map chat_id -> session_id). Persona qua --append-system-prompt-file.

Chạy: pip install requests ; cp .env.example .env ; (điền .env) ; set -a; . .env; set +a ; python3 lucy_bridge.py
Always-on: pm2 start lucy_bridge.py --name lucy-bridge --interpreter python3
"""
import os
import re
import json
import time
import threading
import subprocess
import concurrent.futures
import requests

try:
    import telegramify_markdown        # convert markdown -> Telegram MarkdownV2 (pip install telegramify-markdown)
    _HAS_TGMD = True
except Exception:
    _HAS_TGMD = False

TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = str(os.environ.get("LUCY_ALLOWED_USER_ID", "")).strip()   # khóa chỉ chủ nhân
WORKDIR = os.path.expanduser(os.environ.get("LUCY_WORKDIR", "~/lucy-workspace"))
CLAUDE  = os.environ.get("CLAUDE_BIN", "claude")
# TRÍ NHỚ: vault = não DUY NHẤT của Lucy. Mọi claude -p PHẢI --add-dir vault, không thì Lucy mù vault
# → ghi nhầm vào auto-memory built-in của Claude Code (2 não đánh nhau — bug 2026-06-11).
VAULT   = os.environ.get("LUCY_VAULT", os.path.expanduser("~/lucy/lucy-vault"))
PERSONA = os.path.expanduser(os.environ.get("LUCY_PERSONA", "~/lucy/bridge/persona.md"))
TIMEOUT = int(os.environ.get("LUCY_CLAUDE_TIMEOUT", "900"))          # claude có thể chạy lâu
SESS    = os.path.expanduser("~/.lucy-bridge-sessions.json")
PREFS   = os.path.expanduser("~/.lucy-bridge-prefs.json")   # Đợt A: model/persona/think theo chat_id
API     = f"https://api.telegram.org/bot{TOKEN}"
# Đợt A: coordinator (agent-machine) = nơi chạy llm-lane cho chat đa-model. Bridge gọi qua HTTP.
COORD_URL   = os.environ.get("AM_COORD_URL", "http://127.0.0.1:8780")
COORD_TOK   = os.environ.get("AM_TOKEN", "")
PERSONA_DIR = os.path.expanduser(os.environ.get("LUCY_PERSONA_DIR", "~/lucy/agent-machine/config/personas"))

os.makedirs(WORKDIR, exist_ok=True)

LAST_MODEL = None                                       # model thật của lần claude gần nhất (từ modelUsage)
try:
    CLAUDE_VER = subprocess.run([CLAUDE, "--version"], capture_output=True,
                                text=True, timeout=15).stdout.strip()
except Exception:
    CLAUDE_VER = "?"


def _load():
    try:
        return json.load(open(SESS))
    except Exception:
        return {}


def _save(s):
    try:
        json.dump(s, open(SESS, "w"))
    except Exception:
        pass


# ── Đợt A: prefs (model/persona/think) theo chat_id ──
def _load_prefs():
    try:
        return json.load(open(PREFS))
    except Exception:
        return {}


def _save_prefs(p):
    try:
        json.dump(p, open(PREFS, "w"))
    except Exception:
        pass


def _coord(path, body=None):
    """Gọi coordinator (POST nếu có body, GET nếu không). Trả dict; lỗi → {'error':...}."""
    headers = {"x-worker-token": COORD_TOK} if COORD_TOK else {}
    try:
        if body is None:
            r = requests.get(f"{COORD_URL}{path}", headers=headers, timeout=120)
        else:
            r = requests.post(f"{COORD_URL}{path}", json=body, headers=headers, timeout=180)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def _catalog_keys():
    """Key model lane hợp lệ (cache nhẹ mỗi gọi — catalog nhỏ)."""
    d = _coord("/llm/models")
    return [m.get("key") for m in (d.get("catalog") or []) if m.get("key")]


def resolve_persona_text(pid):
    """systemPrompt của persona từ config JSON (cho cả claude-path lẫn lane). None nếu không có."""
    if not pid:
        return None
    try:
        return json.load(open(os.path.join(PERSONA_DIR, f"{pid}.json"))).get("systemPrompt")
    except Exception:
        return None


def list_personas():
    try:
        return sorted(n[:-5] for n in os.listdir(PERSONA_DIR) if n.endswith(".json"))
    except Exception:
        return []


def run_lane(prompt, model_key, persona_id=None):
    """Chat qua lane model FREE (KHÔNG tool/vault). Trả (model_thật, answer, thinking)."""
    msgs = []
    ptext = resolve_persona_text(persona_id)
    if ptext:
        msgs.append({"role": "system", "content": ptext})
    msgs.append({"role": "user", "content": prompt})
    data = _coord("/chat-lane", {"model": model_key, "messages": msgs})
    if data.get("error"):
        return None, f"❌ lane lỗi: {data['error']}", None
    return data.get("model"), (data.get("answer") or "(rỗng)"), data.get("thinking")


def send(chat_id, text):
    text = text or "(rỗng)"
    # Convert markdown -> Telegram MarkdownV2 cho dễ đọc (bold/list/code/bảng→mono). Lỗi → gửi plain.
    body, parse = text, None
    if _HAS_TGMD:
        try:
            body = telegramify_markdown.markdownify(text); parse = "MarkdownV2"
        except Exception:
            body, parse = text, None
    for i in range(0, len(body), 3800):                 # Telegram giới hạn ~4096
        chunk = body[i:i + 3800]
        payload = {"chat_id": chat_id, "text": chunk}
        if parse:
            payload["parse_mode"] = parse
        try:
            r = requests.post(f"{API}/sendMessage", json=payload, timeout=30)
            if parse and r.status_code != 200:          # parse lỗi → gửi lại plain
                requests.post(f"{API}/sendMessage",
                              json={"chat_id": chat_id, "text": text[i:i + 3800]}, timeout=30)
        except Exception as e:
            print("send err:", e)


def send_id(chat_id, text):
    """Gửi message, trả message_id (để edit làm progress)."""
    try:
        r = requests.post(f"{API}/sendMessage", json={"chat_id": chat_id, "text": text}, timeout=30)
        return r.json().get("result", {}).get("message_id")
    except Exception:
        return None


def edit(chat_id, mid, text):
    if not mid:
        return
    try:
        requests.post(f"{API}/editMessageText",
                      json={"chat_id": chat_id, "message_id": mid, "text": text}, timeout=30)
    except Exception:
        pass


def _heartbeat(chat_id, mid, stop, model):
    """Thanh progress: edit message mỗi 15s với thời gian chạy → chủ nhân biết còn sống."""
    t0 = time.time(); frames = "◐◓◑◒"; i = 0
    while not stop.wait(15):
        m, s = divmod(int(time.time() - t0), 60)
        edit(chat_id, mid, f"{frames[i % 4]} Em đang chạy ({model})… {m}m{s:02d}s")
        i += 1


def send_document(chat_id, path, caption=""):
    try:
        with open(path, "rb") as f:
            requests.post(f"{API}/sendDocument",
                          data={"chat_id": chat_id, "caption": caption[:1000]},
                          files={"document": f}, timeout=90)
    except Exception as e:
        print("doc err:", e)


def _is_richdoc(t):
    # markdown nặng / dài → không hợp gửi raw vào chat Telegram
    return len(t) > 1600 or t.count("|") >= 6 or t.count("\n#") >= 2


def reply(chat_id, text):
    """Phase transform cho Telegram: dài/có bảng -> ghi file .md + gửi kèm + tóm tắt; ngắn -> text thẳng."""
    text = text or "(rỗng)"
    if not _is_richdoc(text):
        send(chat_id, text)
        return
    path = os.path.join(WORKDIR, f"reply-{int(time.time())}.md")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
    except Exception:
        send(chat_id, text)            # ghi file fail -> gửi raw
        return
    # tóm tắt: bỏ dòng bảng, lấy ~600 ký tự đầu cho chat
    teaser = "\n".join(l for l in text.splitlines() if not l.strip().startswith("|")).strip()[:600]
    send(chat_id, "📄 Nội dung dài em gửi file kèm ạ. Tóm tắt:\n\n" + teaser)
    send_document(chat_id, path, caption="Lucy")


def run_claude(prompt, session_id, model="sonnet", persona_text=None):
    """Chạy claude -p, trả (session_id_mới, text). model: sonnet (nhanh, mặc định) | opus (sâu, chậm).
    persona_text: nếu set → overlay persona (Lucy base + role) qua file tạm (Đợt A /persona)."""
    cmd = [CLAUDE, "-p", prompt, "--output-format", "json",
           "--permission-mode", "bypassPermissions", "--model", model]
    persona_file = PERSONA
    if persona_text:
        base = ""
        try:
            base = open(PERSONA).read() if os.path.exists(PERSONA) else ""
        except Exception:
            base = ""
        persona_file = os.path.join(WORKDIR, f".persona-overlay-{os.getpid()}.md")
        try:
            with open(persona_file, "w", encoding="utf-8") as f:
                f.write(base + "\n\n--- VAI HIỆN TẠI (persona overlay) ---\n" + persona_text)
        except Exception:
            persona_file = PERSONA
    if os.path.exists(persona_file):
        cmd += ["--append-system-prompt-file", persona_file]
    if os.path.isdir(VAULT):
        cmd += ["--add-dir", VAULT]    # não vault luôn trong tầm mắt (persona dạy ghi vào đâu)
    if session_id:
        cmd += ["--resume", session_id]
    env = {**os.environ, "IS_SANDBOX": "1"}   # cho phép bypassPermissions khi chạy root (VPS)
    try:
        r = subprocess.run(cmd, cwd=WORKDIR, capture_output=True, text=True,
                           timeout=TIMEOUT, stdin=subprocess.DEVNULL, env=env)
    except subprocess.TimeoutExpired:
        return None, "⏱️ Claude chạy quá lâu (timeout). Thử chia nhỏ task ạ."
    if r.returncode != 0:
        return None, f"❌ Claude lỗi (exit {r.returncode}): {(r.stderr or r.stdout)[:600]}"
    try:
        data = json.loads(r.stdout)
        global LAST_MODEL
        LAST_MODEL = next(iter(data.get("modelUsage") or {}), None) or LAST_MODEL
        return data.get("session_id"), (data.get("result") or "(rỗng)")
    except Exception:
        return None, (r.stdout or "(không parse được output)")[:3500]


def _fan_lane(task, model):
    try:
        _, res = run_claude(task, None, model)          # mỗi lane độc lập, KHÔNG resume
        return res
    except Exception as e:
        return f"❌ lane lỗi: {e}"


def fan_out(chat_id, tasks, model="sonnet"):
    """Multi-agent: chạy nhiều claude -p SONG SONG (mỗi lane = 1 Claude agent thật, độc lập)."""
    send(chat_id, f"🚀 Fan-out {len(tasks)} lane song song ({model})…")
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(tasks))) as ex:
        futs = {ex.submit(_fan_lane, t, model): (i, t) for i, t in enumerate(tasks)}
        for fut in concurrent.futures.as_completed(futs):
            i, t = futs[fut]
            reply(chat_id, f"🔹 Lane {i + 1} — {t[:50]}\n\n{fut.result()}")
    send(chat_id, "✅ Xong tất cả lane.")


def auto_run(chat_id, goal, model="sonnet", max_iters=8):
    """Autonomous: chạy LẶP (resume) tới khi Claude báo STATUS: DONE, hoặc đạt cap an toàn."""
    mid = send_id(chat_id, f"🤖 Auto ({model}): chạy tới khi xong (cap {max_iters} vòng)…")
    stop = threading.Event()
    threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, model), daemon=True).start()
    sid = None
    try:
        for it in range(1, max_iters + 1):
            base = goal if it == 1 else "Tiếp tục cho tới khi HOÀN THÀNH mục tiêu trên."
            prompt = (base + "\n\nLàm tới khi xong. CUỐI trả lời ghi ĐÚNG 1 dòng cuối: "
                      "'STATUS: DONE' nếu đã xong toàn bộ, hoặc 'STATUS: CONTINUE' nếu còn việc.")
            new_sid, result = run_claude(prompt, sid, model)
            if new_sid:
                sid = new_sid
            up = (result or "").upper()
            reply(chat_id, f"🔁 Vòng {it}:\n{result}")
            if "STATUS: DONE" in up and up.rfind("STATUS: DONE") > up.rfind("STATUS: CONTINUE"):
                edit(chat_id, mid, f"✅ Auto XONG sau {it} vòng.")
                return
        edit(chat_id, mid, f"⏹️ Auto dừng ở cap {max_iters} vòng (an toàn). Gõ /auto lại để tiếp.")
    finally:
        stop.set()


def _parse_json_list(raw):
    """Rút JSON array các subtask từ output claude (có thể kèm ```json hay text)."""
    if not raw:
        return []
    m = re.search(r"\[.*\]", raw, re.S)
    if not m:
        return []
    try:
        arr = json.loads(m.group(0))
        return [str(x).strip() for x in arr if str(x).strip()][:6]
    except Exception:
        return []


def orch_run(chat_id, goal, model="sonnet"):
    """Orchestrator HIỆN RÕ: plan (1 agent) -> sub-agent SONG SONG -> synthesis (1 agent)."""
    mid = send_id(chat_id, "🧠 Orchestrator: đang lập kế hoạch…")
    stop = threading.Event()
    threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, "orch"), daemon=True).start()
    try:
        # 1) PLAN — chia subtask độc lập
        plan_prompt = (f"Mục tiêu: {goal}\n\nChia thành 2-5 subtask ĐỘC LẬP (chạy song song được). "
                       "CHỈ trả về JSON array các chuỗi subtask, KHÔNG giải thích. "
                       'Vd: ["phân tích BTC","phân tích ETH","check vàng"]')
        _, plan_raw = run_claude(plan_prompt, None, "sonnet")
        subtasks = _parse_json_list(plan_raw)
        if not subtasks:
            stop.set(); edit(chat_id, mid, "⚠️ Không lập được plan → chạy thẳng goal.")
            _, r = run_claude(goal, None, model); reply(chat_id, r); return
        send(chat_id, "📋 Plan:\n" + "\n".join(f"  {i+1}. {t}" for i, t in enumerate(subtasks)))

        # 2) SUB-AGENT song song
        send(chat_id, f"🔧 {len(subtasks)} sub-agent chạy song song…")
        done = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(subtasks))) as ex:
            futs = {ex.submit(_fan_lane, t, model): (i, t) for i, t in enumerate(subtasks)}
            for fut in concurrent.futures.as_completed(futs):
                i, t = futs[fut]; done[i] = (t, fut.result())
        results = [done[i] for i in sorted(done)]

        # 3) SYNTHESIS — gộp thành báo cáo hoàn chỉnh
        combined = "\n\n".join(f"### Subtask {i+1}: {t}\n{r}" for i, (t, r) in enumerate(results))
        synth_prompt = (f"Mục tiêu gốc: {goal}\n\nKết quả các sub-agent:\n{combined}\n\n"
                        "Tổng hợp thành 1 báo cáo HOÀN CHỈNH, gọn rõ, cho mục tiêu trên.")
        _, final = run_claude(synth_prompt, None, model)
        stop.set(); edit(chat_id, mid, f"✅ Orchestrator xong ({len(subtasks)} sub-agent).")
        reply(chat_id, "🧩 TỔNG HỢP:\n\n" + final)
    finally:
        stop.set()


def handle(msg, sessions):
    chat_id = msg["chat"]["id"]
    uid = str(msg.get("from", {}).get("id", ""))
    text = (msg.get("text") or "").strip()
    if ALLOWED and uid != ALLOWED:
        send(chat_id, "⛔ Không có quyền.")
        return
    if not text:
        return
    if text == "/new":
        sessions.pop(str(chat_id), None); _save(sessions)
        send(chat_id, "✨ Phiên mới — em quên ngữ cảnh cũ ạ.")
        return
    if text == "/id":
        send(chat_id, f"chat_id={chat_id} · user_id={uid}")
        return
    if text == "/info":
        sid = sessions.get(str(chat_id))
        _pf = _load_prefs().get(str(chat_id), {})
        send(chat_id,
             "🔎 Lucy đang chạy bằng gì:\n"
             "• Engine: claude -p (Claude Code CLI) — TRỰC TIẾP, KHÔNG qua Hermes\n"
             f"• Chat model (pref): {_pf.get('model', 'claude:sonnet')} · persona: {_pf.get('persona') or 'Lucy'} · think: {'on' if _pf.get('think') else 'off'}\n"
             f"• Model: {LAST_MODEL or 'chưa rõ (gửi 1 tin trước đã)'}\n"
             f"• claude CLI: {CLAUDE_VER}\n"
             "• Quyền: bypassPermissions (em tự chạy tool: Read/Write/Bash/Web…)\n"
             f"• Khóa chủ nhân: uid={ALLOWED or '(mở!)'}\n"
             f"• Workdir: {WORKDIR}\n"
             f"• Persona: {'có' if os.path.exists(PERSONA) else 'KHÔNG'} ({PERSONA})\n"
             f"• Timeout: {TIMEOUT}s\n"
             f"• Phiên hiện tại: {sid or 'mới (chưa có)'}")
        return
    if text.startswith("/fan"):
        tasks = [l.strip() for l in text[4:].splitlines() if l.strip()]
        if len(tasks) < 2:
            send(chat_id, "Cú pháp: /fan rồi MỖI DÒNG 1 task (>=2). Vd:\n/fan\nphân tích BTC\nphân tích ETH\ncheck vàng XAU")
            return
        threading.Thread(target=fan_out, args=(chat_id, tasks, "sonnet"), daemon=True).start()
        return
    if text.startswith("/auto"):
        goal = text[5:].strip()
        if not goal:
            send(chat_id, "Cú pháp: /auto <mục tiêu>. Em chạy LẶP tới khi xong (cap 8 vòng). Việc khó thêm 'opus' vào goal.")
            return
        m = "opus" if "opus" in goal.lower()[:12] else "sonnet"
        threading.Thread(target=auto_run, args=(chat_id, goal, m), daemon=True).start()
        return
    if text.startswith("/orch"):
        goal = text[5:].strip()
        if not goal:
            send(chat_id, "Cú pháp: /orch <mục tiêu>. Em: lập plan → nhiều sub-agent song song → tổng hợp. (thêm 'opus' đầu goal cho việc khó)")
            return
        m = "opus" if "opus" in goal.lower()[:12] else "sonnet"
        threading.Thread(target=orch_run, args=(chat_id, goal, m), daemon=True).start()
        return

    # ── Đợt A: /model — đổi model chat (claude:sonnet|claude:opus | <lane-key> | auto) ──
    prefs = _load_prefs()
    cur = prefs.get(str(chat_id), {})
    if text.startswith("/model"):
        arg = text[6:].strip()
        if not arg:
            keys = _catalog_keys()
            now = cur.get("model", "claude:sonnet")
            send(chat_id,
                 f"🧬 Model hiện tại: *{now}*\n\nĐổi: `/model <key>`\n"
                 "• `claude:sonnet` / `claude:opus` — não thật (tool+vault), mặc định\n"
                 "• `auto` — smart-router tự chọn model theo task\n"
                 "• lane (chat thuần, KHÔNG tool): " + (", ".join(keys) if keys else "(coordinator chưa sẵn)"))
            return
        if arg not in (["auto", "claude:sonnet", "claude:opus", "sonnet", "opus"] + _catalog_keys()):
            send(chat_id, f"❌ Key lạ: `{arg}`. Gõ `/model` để xem danh sách.")
            return
        if arg in ("sonnet", "opus"):
            arg = "claude:" + arg
        cur["model"] = arg
        prefs[str(chat_id)] = cur; _save_prefs(prefs)
        note = "có tool+vault (não thật)" if arg.startswith("claude") else ("smart-router chọn" if arg == "auto" else "chat thuần, KHÔNG sửa file/đọc vault")
        send(chat_id, f"✅ Đã đổi model → *{arg}* ({note}).")
        return
    # ── Đợt A: /persona — đổi vai ──
    if text.startswith("/persona"):
        arg = text[8:].strip()
        if not arg:
            now = cur.get("persona") or "(Lucy mặc định)"
            send(chat_id, f"🎭 Persona hiện tại: *{now}*\nĐổi: `/persona <id>` · bỏ: `/persona default`\nCó: " + ", ".join(list_personas()))
            return
        if arg in ("default", "lucy", "none"):
            cur.pop("persona", None); prefs[str(chat_id)] = cur; _save_prefs(prefs)
            send(chat_id, "✅ Về persona Lucy mặc định.")
            return
        if arg not in list_personas():
            send(chat_id, f"❌ Không có persona `{arg}`. Có: " + ", ".join(list_personas()))
            return
        cur["persona"] = arg; prefs[str(chat_id)] = cur; _save_prefs(prefs)
        send(chat_id, f"✅ Đổi vai → *{arg}* (overlay lên Lucy).")
        return
    # ── Đợt A: /think on|off — hiện block suy nghĩ (lane model có reasoning) ──
    if text.startswith("/think"):
        arg = text[6:].strip().lower()
        if arg in ("on", "1", "bật"):
            cur["think"] = True
        elif arg in ("off", "0", "tắt"):
            cur["think"] = False
        else:
            send(chat_id, f"💭 Hiện thinking: {'BẬT' if cur.get('think') else 'tắt'}. Gõ `/think on` hoặc `/think off`.")
            return
        prefs[str(chat_id)] = cur; _save_prefs(prefs)
        send(chat_id, f"✅ Thinking → {'BẬT' if cur['think'] else 'tắt'}.")
        return

    pmodel = cur.get("model", "claude:sonnet")          # mặc định = não thật, sonnet
    ppersona = cur.get("persona")
    pthink = bool(cur.get("think"))
    low = text.lower()
    force_opus = False
    if low.startswith("!o ") or low.startswith("!opus "):
        force_opus = True                                # ép Opus 1 lượt (đè pref)
        text = text.split(" ", 1)[1].strip() if " " in text else ""
    if not text:
        return

    # ── Đợt A A3: auto = smart-router quyết claude(tool) vs lane(free) ──
    if pmodel == "auto" and not force_opus:
        dec = _coord("/route", {"brief": text})
        if dec.get("error") or dec.get("needsTools", True):
            why = dec.get("reason", "cần tool / router lỗi → an toàn về claude")
            send(chat_id, f"🧭 auto → claude (não thật): {why}")
            pmodel = "claude:sonnet"
        else:
            mk = dec.get("modelKey")
            send(chat_id, f"🧭 auto → lane *{mk}* ({dec.get('role')}): {dec.get('reason','')}")
            pmodel = mk

    # ── LANE-PATH: model free, chat thuần (không tool) ──
    if not pmodel.startswith("claude") and not force_opus:
        mid = send_id(chat_id, f"🤔 Em xử lý ạ… (lane {pmodel})")
        stop = threading.Event()
        threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, pmodel), daemon=True).start()
        try:
            real, answer, thinking = run_lane(text, pmodel, ppersona)
        finally:
            stop.set()
        edit(chat_id, mid, f"✅ Xong (lane {real or pmodel}).")
        if pthink and thinking:
            send(chat_id, "💭 (suy nghĩ)\n" + thinking[:1500])
        reply(chat_id, answer)
        return

    # ── CLAUDE-PATH: não thật (tool+vault), giữ phiên --resume ──
    model = "opus" if force_opus else pmodel.split(":")[-1]
    mid = send_id(chat_id, f"🤔 Em xử lý ạ… ({model})")
    stop = threading.Event()
    threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, model), daemon=True).start()
    try:
        new_sid, result = run_claude(text, sessions.get(str(chat_id)), model, resolve_persona_text(ppersona))
    finally:
        stop.set()
    edit(chat_id, mid, f"✅ Xong ({model}).")
    if new_sid:
        sessions[str(chat_id)] = new_sid; _save(sessions)
    reply(chat_id, result)


def main():
    sessions = _load()
    offset = None
    print("Lucy bridge online (Telegram <-> claude -p).")
    while True:
        try:
            r = requests.get(f"{API}/getUpdates",
                             params={"timeout": 50, "offset": offset}, timeout=60)
            for upd in r.json().get("result", []):
                offset = upd["update_id"] + 1
                if "message" in upd:
                    handle(upd["message"], sessions)
        except Exception as e:
            print("loop err:", e)
            time.sleep(3)


if __name__ == "__main__":
    main()
