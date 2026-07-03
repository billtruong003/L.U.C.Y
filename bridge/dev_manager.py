#!/usr/bin/env python3
"""
dev_manager.py — Autonomous Dev Manager (SCAFFOLD, DRY-RUN).
Plan gốc: /reports/lucy-autonomous-manager-plan.html

Vòng thiết kế: CN plan tuần → mỗi đêm execute 1 task → audit → verify → gate → host → sáng report.
BẢN NÀY = scaffold an toàn: đọc project queue, chọn task đêm nay theo priority, IN/BÁO kế hoạch.
KHÔNG execute, KHÔNG git, KHÔNG host — phần đó là task DM-2..DM-5 (trong queue) sẽ tự build.

Chạy:  python3 dev_manager.py plan      # in plan đêm nay (dry-run)
       python3 dev_manager.py report    # gửi Telegram tóm tắt trạng thái rebuild
An toàn: flag LUCY_DEVMGR (mặc định OFF) — chưa bật thì chỉ plan/report, tuyệt đối không tự chạy code.
"""
import os, re, glob, sys, json, urllib.request

ROOT = "/root/lucy"
PROJ = os.path.join(ROOT, "tasks", "projects", "rebuild-2026-07")
DEVMGR_ON = str(os.environ.get("LUCY_DEVMGR", "")).strip() in ("1", "true", "on")

# allowlist scope được phép auto-host (khi bật). Ngoài list = human-gate.
HOST_ALLOWLIST = {"ui", "reports", "docs"}


def _load_env():
    p = os.path.join(ROOT, "bridge", ".env")
    if os.path.exists(p):
        for ln in open(p):
            ln = ln.strip()
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def parse_fm(path):
    meta = {"id": os.path.basename(path)[:-3], "priority": 99, "status": "queued", "scope": "?", "model": "sonnet", "title": ""}
    txt = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---", txt, re.S)
    if m:
        for ln in m.group(1).splitlines():
            if ":" in ln:
                k, v = ln.split(":", 1)
                meta[k.strip()] = v.strip()
    try:
        meta["priority"] = int(meta["priority"])
    except Exception:
        meta["priority"] = 99
    return meta


def load_queue():
    files = glob.glob(os.path.join(PROJ, "queue", "*.md"))
    tasks = [parse_fm(f) for f in files if not os.path.basename(f).startswith("_")]
    return sorted(tasks, key=lambda t: t["priority"])


def tg(text):
    _load_env()
    tok = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    uid = os.environ.get("LUCY_ALLOWED_USER_ID", "")
    if not tok or not uid:
        print("[tg] thiếu token/uid, bỏ gửi"); return
    proxy = os.environ.get("LUCY_TG_PROXY", "")
    data = urllib.parse.urlencode({"chat_id": uid, "text": text}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{tok}/sendMessage", data=data)
    try:
        if proxy:
            import requests
            requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                          data={"chat_id": uid, "text": text},
                          proxies={"https": proxy, "http": proxy}, timeout=15)
        else:
            urllib.request.urlopen(req, timeout=15)
        print("[tg] sent")
    except Exception as e:
        print("[tg] fail", str(e)[:80])


def cmd_plan():
    q = load_queue()
    done = len(glob.glob(os.path.join(PROJ, "done", "*.md")))
    print(f"=== Dev Manager · rebuild-2026-07 · DRY-RUN (LUCY_DEVMGR={'ON' if DEVMGR_ON else 'OFF'}) ===")
    print(f"queue: {len(q)} task chờ · done: {done}")
    if not q:
        print("Hết task — mẻ rebuild xong."); return
    nxt = q[0]
    print(f"\n▸ Đêm nay (priority cao nhất): [{nxt['id']}] {nxt['title']}")
    print(f"  model={nxt['model']} scope={nxt['scope']} "
          f"→ auto-host {'ĐƯỢC' if nxt['scope'] in HOST_ALLOWLIST else 'KHÔNG (human-gate)'}")
    print("\n5 task kế:")
    for t in q[1:6]:
        print(f"  · [{t['id']}] p{t['priority']} {t['title'][:60]} ({t['scope']})")
    if not DEVMGR_ON:
        print("\n⚠️ LUCY_DEVMGR chưa bật → scaffold chỉ PLAN, không execute/host. Bật khi Bill duyệt dry-run vài đêm.")


def cmd_report():
    q = load_queue()
    done = len(glob.glob(os.path.join(PROJ, "done", "*.md")))
    ui = [t for t in q if t["scope"] == "ui"]
    infra = [t for t in q if t["scope"] == "infra"]
    nxt = q[0] if q else None
    msg = (f"🛠️ Dev Manager · rebuild-2026-07\n"
           f"Còn {len(q)} task ({len(ui)} UI · {len(infra)} infra) · xong {done}\n"
           + (f"Đêm nay: [{nxt['id']}] {nxt['title'][:50]}\n" if nxt else "Hết task — xong mẻ 🎉\n")
           + f"Mode: {'LIVE' if DEVMGR_ON else 'DRY-RUN (chưa host)'}\n"
           "Plan: /reports/lucy-autonomous-manager-plan.html")
    print(msg)
    tg(msg)


if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if c == "report":
        cmd_report()
    else:
        cmd_plan()
