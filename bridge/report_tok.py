#!/usr/bin/env python3
"""report_tok.py — B1 token consolidation cho cron `claude -p`.
Đọc file JSON output (`claude -p --output-format json`) → rút usage thật → POST coordinator
/token-guard/add {inTok,outTok} (NGUỒN DUY NHẤT). inTok gồm cache (parity hub/bridge/auto-build).
Fire-and-forget — lỗi/coordinator off → im lặng exit 0, KHÔNG làm gãy cron. Tắt = LUCY_TOKEN_REPORT=0.

Dùng:  python3 report_tok.py <result.json>
"""
import os, sys, json, urllib.request

REPO = os.environ.get("LUCY_REPO", "/root/lucy")


def _read_env_file(path):
    env = {}
    try:
        with open(path) as f:
            for ln in f:
                if "=" in ln and not ln.strip().startswith("#"):
                    k, v = ln.strip().split("=", 1)
                    env[k] = v
    except Exception:
        pass
    return env


def _coord_creds():
    url = os.environ.get("AM_COORD_URL", "")
    tok = os.environ.get("AM_TOKEN", "")
    if not url or not tok:
        he = _read_env_file(f"{REPO}/hub/server/.env")
        url = url or he.get("AM_COORD_URL", "http://127.0.0.1:8780")
        tok = tok or he.get("AM_TOKEN", "")
    return url.rstrip("/"), tok


def main():
    if os.environ.get("LUCY_TOKEN_REPORT", "1").strip().lower() in ("0", "false", "off"):
        return
    if len(sys.argv) < 2:
        return
    try:
        d = json.load(open(sys.argv[1]))
    except Exception:
        return
    u = d.get("usage") if isinstance(d, dict) else None
    if not isinstance(u, dict):
        return
    in_tok = (int(u.get("input_tokens", 0) or 0)
              + int(u.get("cache_read_input_tokens", 0) or 0)
              + int(u.get("cache_creation_input_tokens", 0) or 0))
    out_tok = int(u.get("output_tokens", 0) or 0)
    if in_tok <= 0 and out_tok <= 0:
        return
    try:
        url, tok = _coord_creds()
        req = urllib.request.Request(
            f"{url}/token-guard/add",
            data=json.dumps({"inTok": in_tok, "outTok": out_tok}).encode(),
            headers={"content-type": "application/json", **({"x-worker-token": tok} if tok else {})})
        urllib.request.urlopen(req, timeout=4)
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
