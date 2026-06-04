#!/usr/bin/env python3
"""Lucy Hub — FastAPI backend (web command center, standalone, KHÔNG Hermes).
Serve SPA (web/dist) + API: login, send (job nền), poll. Engine = claude -p.

Dev:  pip install -r requirements.txt ; (web: npm run dev, proxy /api -> :8800)
      set -a; . .env; set +a ; uvicorn server:app --host 0.0.0.0 --port 8800
Prod: cd web && npm run build  → rồi chạy uvicorn (FastAPI serve web/dist)
Always-on: pm2 start "uvicorn server:app --host 0.0.0.0 --port 8800" --name lucy-hub
"""
import os
import json
import time
import secrets
import threading
import subprocess

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

PASSWORD = os.environ.get("LUCY_HUB_PASSWORD", "")
WORKDIR  = os.path.expanduser(os.environ.get("LUCY_WORKDIR", "~/lucy/workspace"))
CLAUDE   = os.environ.get("CLAUDE_BIN", "claude")
PERSONA  = os.path.expanduser(os.environ.get("LUCY_PERSONA", "~/lucy/bridge/persona.md"))
TIMEOUT  = int(os.environ.get("LUCY_CLAUDE_TIMEOUT", "900"))
HERE     = os.path.dirname(os.path.abspath(__file__))
DIST     = os.path.join(HERE, "web", "dist")

app = FastAPI(title="Lucy Hub")
TOKENS: set[str] = set()
JOBS: dict[str, dict] = {}
os.makedirs(WORKDIR, exist_ok=True)


def _authed(req: Request) -> bool:
    return req.cookies.get("lucy_token") in TOKENS


def run_claude(prompt, session_id, model):
    cmd = [CLAUDE, "-p", prompt, "--output-format", "json",
           "--permission-mode", "bypassPermissions", "--model", model]
    if os.path.exists(PERSONA):
        cmd += ["--append-system-prompt-file", PERSONA]
    if session_id:
        cmd += ["--resume", session_id]
    env = {**os.environ, "IS_SANDBOX": "1"}
    try:
        r = subprocess.run(cmd, cwd=WORKDIR, capture_output=True, text=True,
                           timeout=TIMEOUT, stdin=subprocess.DEVNULL, env=env)
    except subprocess.TimeoutExpired:
        return None, "⏱️ Claude timeout."
    if r.returncode != 0:
        return None, f"❌ Claude lỗi: {(r.stderr or r.stdout)[:600]}"
    try:
        d = json.loads(r.stdout)
        return d.get("session_id"), (d.get("result") or "(rỗng)")
    except Exception:
        return None, (r.stdout or "(parse err)")[:3500]


def _worker(job_id, prompt, session_id, model):
    sid, res = run_claude(prompt, session_id, model)
    j = JOBS.get(job_id)
    if j:
        j.update(session_id=sid or session_id, result=res, status="done")


@app.post("/login")
async def login(req: Request):
    body = await req.json()
    if PASSWORD and body.get("password") == PASSWORD:
        tok = secrets.token_urlsafe(24); TOKENS.add(tok)
        resp = JSONResponse({"ok": True})
        resp.set_cookie("lucy_token", tok, httponly=True, samesite="lax", max_age=7 * 86400)
        return resp
    return JSONResponse({"ok": False}, status_code=401)


@app.get("/api/me")
async def me(req: Request):
    return {"authed": _authed(req)}


@app.post("/api/send")
async def send(req: Request):
    if not _authed(req):
        return JSONResponse({"error": "unauth"}, status_code=401)
    body = await req.json()
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return JSONResponse({"error": "empty"}, status_code=400)
    model = "opus" if body.get("opus") else "sonnet"
    job_id = secrets.token_urlsafe(8)
    JOBS[job_id] = {"status": "running", "result": None, "model": model,
                    "t0": time.time(), "session_id": body.get("session_id")}
    threading.Thread(target=_worker, args=(job_id, prompt, body.get("session_id"), model),
                     daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/poll/{job_id}")
async def poll(job_id: str, req: Request):
    if not _authed(req):
        return JSONResponse({"error": "unauth"}, status_code=401)
    j = JOBS.get(job_id)
    if not j:
        return JSONResponse({"error": "nojob"}, status_code=404)
    return {"status": j["status"], "result": j["result"], "model": j["model"],
            "elapsed": int(time.time() - j["t0"]), "session_id": j.get("session_id")}


# --- serve SPA (web/dist) — đặt CUỐI để /api ưu tiên ---
if os.path.isdir(DIST):
    app.mount("/", StaticFiles(directory=DIST, html=True), name="spa")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    idx = os.path.join(DIST, "index.html")
    if os.path.exists(idx):
        return FileResponse(idx)
    return JSONResponse({"error": "web chưa build — chạy: cd web && npm run build"}, status_code=503)
