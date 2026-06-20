#!/usr/bin/env python3
"""
fitcity-task3-watcher.py — Theo dõi cascade TASK 3 (T3.4/T3.5/T3.6) chạy trên lucy-autotask.
Khi cả 3 task đã rời queue+doing (vào done/failed) → gửi Telegram tóm tắt kết quả cho chủ nhân rồi thoát.
Telegram đi qua proxy WARP (socks5h) vì IP VPS bị chặn Bot API.
Chạy: python3 /root/lucy/fitcity-task3-watcher.py   (nền)
Log:  /root/lucy/fitcity-task3-watcher.log   (không bao giờ ghi secret)
"""
import os, time, json, glob, subprocess
import requests

TASKS = "/root/lucy/tasks"
LOG = "/root/lucy/fitcity-task3-watcher.log"
# (spec-filename prefix dạng dash, tên người đọc)
WATCH = [
    ("FITCITY-UI-3", "Wire HẾT 50 slot ảnh vào CMS"),
]
POLL = 60          # giây/lần kiểm
MAX_WAIT = 5 * 3600  # trần an toàn 5h


def logline(s):
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {s}\n")
    except Exception:
        pass


def read_env(path):
    e = {}
    try:
        for ln in open(path, encoding="utf-8"):
            ln = ln.strip()
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1)
                e[k] = v.strip()
    except Exception:
        pass
    return e


ENV = read_env("/root/lucy/bridge/.env")
TOKEN = ENV.get("TELEGRAM_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT = ENV.get("LUCY_ALLOWED_USER_ID") or os.environ.get("LUCY_ALLOWED_USER_ID", "")
PROXY = ENV.get("LUCY_TG_PROXY") or os.environ.get("LUCY_TG_PROXY") or "socks5h://127.0.0.1:40000"
PROXIES = {"http": PROXY, "https": PROXY} if PROXY else None


def send_tg(text):
    if not TOKEN or not CHAT:
        logline("THIẾU token/chat — không gửi được")
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            json={"chat_id": CHAT, "text": text[:3900]},
            timeout=30, proxies=PROXIES,
        )
        ok = r.ok
        logline(f"send_tg ok={ok} status={r.status_code}")
        return ok
    except Exception as e:
        logline(f"send_tg error: {e}")
        return False


def loc(prefix):
    """Task đang ở thư mục nào: done|failed|queue|doing|None."""
    for d in ("done", "failed", "queue", "doing"):
        if glob.glob(f"{TASKS}/{d}/{prefix}*.md"):
            return d
    return None


def result_text(prefix):
    """Lấy tóm tắt kết quả: ưu tiên file -output.md (id dạng dot), fallback đuôi file spec trong done/failed."""
    dot = prefix.replace("FITCITY-3-", "FITCITY-3.")  # FITCITY-3-4 -> FITCITY-3.4
    for d in ("done", "failed"):
        outs = glob.glob(f"{TASKS}/{d}/{dot}*-output.md")
        if outs:
            try:
                return open(outs[0], encoding="utf-8").read().strip()[-500:]
            except Exception:
                pass
    for d in ("done", "failed"):
        specs = [p for p in glob.glob(f"{TASKS}/{d}/{prefix}*.md") if "-output" not in p]
        if specs:
            try:
                t = open(specs[0], encoding="utf-8").read()
                i = t.rfind("## Kết quả")
                return (t[i:] if i >= 0 else t[-500:]).strip()[:500]
            except Exception:
                pass
    return ""


def autotask_online():
    try:
        out = subprocess.run(["pm2", "jlist"], capture_output=True, text=True, timeout=20).stdout
        for p in json.loads(out):
            if p.get("name") == "lucy-autotask":
                return p.get("pm2_env", {}).get("status") == "online"
    except Exception:
        pass
    return False


def main():
    logline("watcher START")
    t0 = time.time()
    while time.time() - t0 < MAX_WAIT:
        pending = [p for p, _ in WATCH if loc(p) in ("queue", "doing")]
        if not pending and not autotask_online():
            break
        time.sleep(POLL)

    done = [(p, n) for p, n in WATCH if loc(p) == "done"]
    failed = [(p, n) for p, n in WATCH if loc(p) == "failed"]

    lines = ["🏁 Cascade TASK 3 (Blog → Admin → Provision) đã chạy xong."]
    lines.append(f"✅ Done: {', '.join(n for _, n in done) or '—'}")
    if failed:
        lines.append(f"⚠️ Cần xem (failed/NEEDS_HUMAN): {', '.join(n for _, n in failed)}")
    for p, n in WATCH:
        r = result_text(p)
        if r:
            lines.append(f"\n— {n} ({loc(p)}):\n{r[:380]}")
    lines.append("\n🛑 Còn T3.7 (deploy Cloudflare Pages) — chờ CF API token (D1+Pages) + chủ nhân duyệt.")
    lines.append("Lucy sẽ verify lại toàn bộ rồi báo chi tiết.")
    send_tg("\n".join(lines))
    logline("watcher DONE, đã gửi tổng kết")


if __name__ == "__main__":
    main()
