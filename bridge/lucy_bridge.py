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
import subprocess
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


def run_claude(prompt, session_id):
    """Chạy claude -p, trả (session_id_mới, text). bypassPermissions để autonomous (chỉ chủ nhân gọi được)."""
    cmd = [CLAUDE, "-p", prompt, "--output-format", "json", "--permission-mode", "bypassPermissions"]
    if os.path.exists(PERSONA):
        cmd += ["--append-system-prompt-file", PERSONA]
    if session_id:
        cmd += ["--resume", session_id]
    try:
        r = subprocess.run(cmd, cwd=WORKDIR, capture_output=True, text=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return None, "⏱️ Claude chạy quá lâu (timeout). Thử chia nhỏ task ạ."
    if r.returncode != 0:
        return None, f"❌ Claude lỗi (exit {r.returncode}): {(r.stderr or r.stdout)[:600]}"
    try:
        data = json.loads(r.stdout)
        return data.get("session_id"), (data.get("result") or "(rỗng)")
    except Exception:
        return None, (r.stdout or "(không parse được output)")[:3500]


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

    send(chat_id, "🤔 Em xử lý ạ…")
    new_sid, result = run_claude(text, sessions.get(str(chat_id)))
    if new_sid:
        sessions[str(chat_id)] = new_sid; _save(sessions)
    send(chat_id, result)


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
