#!/usr/bin/env python3
"""Đăng báo cáo dài lên Discord qua radiant-bot (Aki) — tạo thread rồi post nội dung chunk.

Flow:
  1. POST /api/agent/channel {type:thread, parent, name, message:<announce>} -> thread_id
  2. Chunk file body thành <=1800 ký tự (cắt theo dòng) -> POST /api/agent/post {channel:thread_id, text} từng phần

Dùng:
  aki_discord.py <parent_channel_id> <thread_name> <announce_file> <body_file>

Env cần:
  RADIANT_BOT_API_URL      (default http://127.0.0.1:3030)
  RADIANT_BOT_AGENT_SECRET (HMAC secret, = AGENT_HMAC_SECRET bên radiant-bot)

In ra stdout: thread_id nếu OK. Exit !=0 nếu lỗi tạo thread.
"""
import sys, os, json, hmac, hashlib, urllib.request, urllib.error, time

API = os.environ.get("RADIANT_BOT_API_URL", "http://127.0.0.1:3030").rstrip("/")
SECRET = os.environ.get("RADIANT_BOT_AGENT_SECRET", "")
MAX = 1800  # chừa biên dưới mức 1900 của bot

def sign(raw: bytes) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()

def call(path: str, payload: dict) -> dict:
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API + path, data=raw, method="POST",
        headers={"content-type": "application/json", "x-lucy-signature": sign(raw)},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        raise RuntimeError(f"HTTP {e.code}: {body}") from None

def chunk_lines(text: str, limit: int = MAX):
    """Chia text thành các đoạn <=limit, ưu tiên cắt theo dòng (giữ markdown nguyên dòng)."""
    chunks, cur = [], ""
    for line in text.split("\n"):
        # dòng quá dài tự thân -> cắt cứng
        while len(line) > limit:
            if cur:
                chunks.append(cur); cur = ""
            chunks.append(line[:limit]); line = line[limit:]
        add = (("\n" if cur else "") + line)
        if len(cur) + len(add) > limit:
            chunks.append(cur); cur = line
        else:
            cur += add
    if cur.strip():
        chunks.append(cur)
    return chunks

def main():
    if len(sys.argv) < 5:
        print("usage: aki_discord.py <parent_channel> <thread_name> <announce_file> <body_file>", file=sys.stderr)
        sys.exit(2)
    if not SECRET:
        print("RADIANT_BOT_AGENT_SECRET chưa set", file=sys.stderr)
        sys.exit(3)
    parent, name, announce_file, body_file = sys.argv[1:5]

    announce = open(announce_file, encoding="utf-8").read().strip()[:1800] if os.path.exists(announce_file) else ""
    body = open(body_file, encoding="utf-8").read() if os.path.exists(body_file) else ""

    # 1. Tạo thread + tin thông báo mở thread
    res = call("/api/agent/channel", {
        "type": "thread", "parent": parent, "name": name[:90],
        "message": announce or name,
    })
    thread_id = res.get("thread_id")
    if not thread_id:
        print(f"tạo thread lỗi: {res}", file=sys.stderr)
        sys.exit(1)

    # 2. Post body chunked vào thread
    parts = chunk_lines(body) if body.strip() else []
    for i, p in enumerate(parts):
        try:
            call("/api/agent/post", {"channel": thread_id, "text": p})
        except Exception as e:
            print(f"post chunk {i+1}/{len(parts)} lỗi: {e}", file=sys.stderr)
        time.sleep(0.5)  # tránh rate limit

    print(thread_id)

if __name__ == "__main__":
    main()
