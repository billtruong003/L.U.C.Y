#!/usr/bin/env python3
"""Lucy Bridge — Telegram <-> Claude Code (claude -p) TRỰC TIẾP. KHÔNG Hermes.

Mỗi tin Telegram của chủ nhân -> `claude -p` (brain thật: tool + memory + web riêng) -> trả về Telegram.
Giữ phiên qua --resume (map chat_id -> session_id). Persona qua --append-system-prompt-file.

Chạy: pip install requests ; cp .env.example .env ; (điền .env) ; set -a; . .env; set +a ; python3 lucy_bridge.py
Always-on: pm2 start lucy_bridge.py --name lucy-bridge --interpreter python3
"""
import os
import json
import time
import threading
import subprocess
import concurrent.futures
import requests

TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = str(os.environ.get("LUCY_ALLOWED_USER_ID", "")).strip()   # khóa chỉ chủ nhân
WORKDIR = os.path.expanduser(os.environ.get("LUCY_WORKDIR", "~/lucy-workspace"))
CLAUDE  = os.environ.get("CLAUDE_BIN", "claude")
PERSONA = os.path.expanduser(os.environ.get("LUCY_PERSONA", "~/lucy/bridge/persona.md"))
TIMEOUT = int(os.environ.get("LUCY_CLAUDE_TIMEOUT", "900"))          # claude có thể chạy lâu
SESS    = os.path.expanduser("~/.lucy-bridge-sessions.json")
API     = f"https://api.telegram.org/bot{TOKEN}"

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


def send(chat_id, text):
    text = text or "(rỗng)"
    for i in range(0, len(text), 3800):                 # Telegram giới hạn ~4096
        try:
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


def run_claude(prompt, session_id, model="sonnet"):
    """Chạy claude -p, trả (session_id_mới, text). model: sonnet (nhanh, mặc định) | opus (sâu, chậm)."""
    cmd = [CLAUDE, "-p", prompt, "--output-format", "json",
           "--permission-mode", "bypassPermissions", "--model", model]
    if os.path.exists(PERSONA):
        cmd += ["--append-system-prompt-file", PERSONA]
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
        send(chat_id,
             "🔎 Lucy đang chạy bằng gì:\n"
             "• Engine: claude -p (Claude Code CLI) — TRỰC TIẾP, KHÔNG qua Hermes\n"
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

    model = "sonnet"                                    # mặc định NHANH
    low = text.lower()
    if low.startswith("!o ") or low.startswith("!opus "):
        model = "opus"                                   # việc sâu/khó → Opus (chậm hơn)
        text = text.split(" ", 1)[1].strip() if " " in text else ""
    if not text:
        return
    mid = send_id(chat_id, f"🤔 Em xử lý ạ… ({model})")
    stop = threading.Event()
    threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, model), daemon=True).start()
    try:
        new_sid, result = run_claude(text, sessions.get(str(chat_id)), model)
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
