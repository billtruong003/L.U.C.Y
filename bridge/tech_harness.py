#!/usr/bin/env python3
"""
Tech Digest — Python Checkpoint Harness
Thay thế cron_tech.sh (bash dễ vỡ) bằng checkpoint chain.
Mỗi checkpoint = 1 lần claude -p nhỏ, retry + timeout riêng.
Gửi Telegram + Web UI sau khi hoàn thành.
"""

import os, sys, json, subprocess, time, shutil, re, urllib.request, urllib.parse
from datetime import datetime, date
from pathlib import Path

# === CONFIG ===
WORKDIR = Path("/root/lucy-workspace")
BRIDGE_DIR = Path("/root/lucy/bridge")
WEB_ROOT = Path("/var/www/lucy-reports")
ARCHIVE_DIR = WEB_ROOT / "archive"
PUBLIC_BASE = "http://14.225.255.73/reports"
CLAUDE_BIN = "/root/.local/bin/claude"
PERSONA_FILE = str(BRIDGE_DIR / "persona.md")
TELEGRAM_BOT_TOKEN = "8732706974:AAFWFChwBu1rwZOlf4-y_1YCeShevU7_VpQ"
TELEGRAM_CHAT_ID = "6603021156"
TIMEOUT = 180
MAX_RETRIES = 2
TODAY = date.today().isoformat()
TODAY_SHORT = datetime.now().strftime("%d/%m/%Y")
LOG_FILE = WORKDIR / f"tech-digest-{TODAY}.log"

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def send_telegram(message):
    """Gửi message qua Telegram Bot API."""
    api = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": TELEGRAM_CHAT_ID,
        "parse_mode": "Markdown",
        "text": message[:3800]
    }).encode()
    try:
        req = urllib.request.Request(api, data=data, method="POST")
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        log(f"Telegram send error: {e}")
        return False

def send_telegram_file(filepath, caption=""):
    """Gửi file qua Telegram."""
    import http.client
    import mimetypes
    boundary = "----LucyFormBoundary" + str(int(time.time()))
    body = []
    body.append(f"--{boundary}")
    body.append(f'Content-Disposition: form-data; name="chat_id"')
    body.append("")
    body.append(TELEGRAM_CHAT_ID)
    if caption:
        body.append(f"--{boundary}")
        body.append(f'Content-Disposition: form-data; name="caption"')
        body.append("")
        body.append(caption[:1000])
    body.append(f"--{boundary}")
    fname = os.path.basename(filepath)
    body.append(f'Content-Disposition: form-data; name="document"; filename="{fname}"')
    body.append("Content-Type: text/markdown")
    body.append("")
    with open(filepath, "rb") as f:
        body.append(f.read().decode("utf-8", errors="replace"))
    body.append(f"--{boundary}--")
    data = "\r\n".join(body)
    try:
        conn = http.client.HTTPSConnection("api.telegram.org", timeout=20)
        conn.request("POST", f"/bot{TELEGRAM_BOT_TOKEN}/sendDocument",
                     body=data.encode("utf-8"),
                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        conn.getresponse()
        return True
    except Exception as e:
        log(f"Telegram file send error: {e}")
        return False

# === CHECKPOINT DEFINITIONS ===
CHECKPOINTS = [
    {
        "id": "ai",
        "label": "AI / LLM",
        "prompt": f"""Hôm nay là {TODAY}. Research tin AI/LLM NÓNG NHẤT trong 24h qua từ các nguồn: Hugging Face trending (model mới, benchmark), Arxiv cs.AI/cs.LG, r/LocalLLaMA (top hot), blog OpenAI/Anthropic/Google DeepMind/Meta AI.

LỌC MẠNH — chỉ lấy tin thực sự đáng chú ý (model mới, breakthrough, kỹ thuật, agent, tooling, MCP). Bỏ tin PR/quảng cáo/vibe coding.

Viết 3-5 bullet ngắn, mỗi bullet: 
• **[Tiêu đề]** — tóm tắt 1 câu + tại sao quan trọng. [link]

NẾU KHÔNG CÓ GÌ NỔI BẬT: ghi "Hôm nay không có tin AI nổi bật."

GHI KẾT QUẢ vào file /tmp/td-ai-{TODAY}.md""",
        "output_file": f"/tmp/td-ai-{TODAY}.md"
    },
    {
        "id": "dev",
        "label": "Software Dev",
        "prompt": f"""Hôm nay là {TODAY}. Đã đọc /tmp/td-ai-{TODAY}.md để biết đã có gì.

Research tin SOFTWARE DEV nóng nhất 24h qua: Hacker News (top + Show HN), Lobsters, GitHub Trending, r/programming.

Focus: ngôn ngữ mới, framework, database, dev tools, backend, engineering blogs. LỌC MẠNH — ưu tiên thứ có impact thực tế.

Viết 3-5 bullet:
• **[Tiêu đề]** — tóm tắt + tại sao đáng đọc. [link]

NẾU KHÔNG CÓ GÌ NỔI BẬT: ghi "Hôm nay không có tin dev nổi bật."

GHI KẾT QUẢ vào file /tmp/td-dev-{TODAY}.md""",
        "output_file": f"/tmp/td-dev-{TODAY}.md"
    },
    {
        "id": "game",
        "label": "Game Dev + News",
        "prompt": f"""Hôm nay là {TODAY}. Đã đọc /tmp/td-ai-{TODAY}.md và /tmp/td-dev-{TODAY}.md.

Research tin GAME nóng nhất 24h qua: r/gamedev (top), PC Gamer, GameDeveloper.com, Engadget Gaming.

Focus: engine mới (Unreal/Unity/Godot update), kỹ thuật dev, postmortem, tựa game lớn ra mắt, sự kiện ngành.

Viết 2-4 bullet:
• **[Tiêu đề]** — tóm tắt + link. [link]

NẾU KHÔNG CÓ GÌ: ghi "Hôm nay không có tin game nổi bật."

GHI KẾT QUẢ vào file /tmp/td-game-{TODAY}.md""",
        "output_file": f"/tmp/td-game-{TODAY}.md"
    },
    {
        "id": "bigtech",
        "label": "Big Tech",
        "prompt": f"""Hôm nay là {TODAY}. Đã đọc các file checkpoint trước.

Research tin BIG TECH nóng nhất 24h qua: TechCrunch, The Verge, Ars Technica, Bloomberg tech.

Focus: Apple, Google, Meta, Microsoft, OpenAI, Anthropic, Nvidia, SpaceX. Chỉ lấy động thái CHIẾN LƯỢC (M&A, policy, sản phẩm lớn, kiện tụng). Bỏ tin lặt vặt.

Viết 2-4 bullet:
• **[Tiêu đề]** — tóm tắt + link. [link]

NẾU KHÔNG CÓ GÌ: ghi "Hôm nay không có tin Big Tech nổi bật."

GHI KẾT QUẢ vào file /tmp/td-bigtech-{TODAY}.md""",
        "output_file": f"/tmp/td-bigtech-{TODAY}.md"
    }
]

def check_deps(cp):
    """Viết fallback nếu dependency files không tồn tại."""
    deps_map = {
        "dev": ["ai"],
        "game": ["ai", "dev"],
        "bigtech": ["ai", "dev", "game"]
    }
    for dep in deps_map.get(cp["id"], []):
        dep_file = f"/tmp/td-{dep}-{TODAY}.md"
        if not os.path.exists(dep_file):
            with open(dep_file, "w") as f:
                f.write(f"(checkpoint {dep} không chạy được)\n")

def run_claude(prompt, timeout=TIMEOUT):
    """Gọi claude -p với prompt. Trả (success, text)."""
    try:
        proc = subprocess.run(
            [CLAUDE_BIN, "-p", prompt,
             # claude 2.1.173+ CẤM bypassPermissions khi chạy ROOT → allowedTools (như cron_brief.sh)
             "--allowedTools", "Bash WebSearch WebFetch Read Glob Grep",
             "--output-format", "json",
             "--append-system-prompt-file", PERSONA_FILE],
            capture_output=True, text=True,
            timeout=timeout,
            env={**os.environ, "IS_SANDBOX": "1"}
        )
        if proc.returncode == 0:
            try:
                data = json.loads(proc.stdout)
                content = (data.get("result") or "").strip()
                if content and len(content) > 30:
                    return True, content
            except json.JSONDecodeError:
                pass
        raw = (proc.stdout or "").strip() or (proc.stderr or "").strip()
        if raw and len(raw) > 30:
            return True, raw
        return False, f"Lỗi rc={proc.returncode}"
    except subprocess.TimeoutExpired:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)

def run_checkpoint(cp):
    """Chạy 1 checkpoint với retry."""
    cp_id = cp["id"]
    out_file = cp["output_file"]
    
    log(f"  🚀 [{cp_id}] {cp['label']}")
    check_deps(cp)
    
    for attempt in range(1, MAX_RETRIES + 1):
        log(f"    Lần {attempt}/{MAX_RETRIES}...")
        ok, output = run_claude(cp["prompt"])
        if ok and len(output) > 50:
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(output + "\n")
            lines = len(output.split("\n"))
            log(f"    ✅ OK ({len(output)} chars, {lines} lines)")
            return True
        log(f"    ⚠️ Lỗi: {output[:120]}")
        if attempt < MAX_RETRIES:
            time.sleep(8)
    
    with open(out_file, "w") as f:
        f.write(f"({cp['label']} — không lấy được tin hôm nay)\n")
    log(f"    ⚠️ Fallback — ghi file rỗng")
    return False

def build_top3():
    """Đọc các checkpoint → extract top 3 items."""
    all_bullets = []
    header_map = {"ai": "🤖 AI", "dev": "💻 Dev", "game": "🎮 Game", "bigtech": "🏢 BigTech"}
    for cp in CHECKPOINTS:
        f = cp["output_file"]
        if os.path.exists(f):
            with open(f) as fh:
                content = fh.read()
            # Tìm bullet lines: • nội dung ... (dạng • *Title* — desc)
            lines = content.split("\n")
            for line in lines:
                line = line.strip()
                if line.startswith("•") and len(line) > 15:
                    # Clean up
                    clean = re.sub(r'\*+', '', line)  # bỏ * markdown
                    clean = re.sub(r'\s+', ' ', clean).strip()[:200]
                    prefix = header_map.get(cp['id'], '')
                    all_bullets.append(f"• {prefix}: {clean.lstrip('• ')}")
                    if len([b for b in all_bullets if b.startswith(f"• {prefix}")]) >= 2:
                        break
    return all_bullets[:3]

def assemble_digest():
    """Tổng hợp các checkpoint → digest hoàn chỉnh."""
    sections = []
    header_map = {
        "ai": "🤖 AI / LLM",
        "dev": "💻 SOFTWARE DEV",
        "game": "🎮 GAME (DEV + NEWS)",
        "bigtech": "🏢 BIG TECH"
    }
    for cp in CHECKPOINTS:
        out = cp["output_file"]
        content = ""
        if os.path.exists(out):
            with open(out) as f:
                content = f.read().strip()
        sections.append(f"## {header_map[cp['id']]}\n{content}\n")
    
    top3 = build_top3()
    top3_text = "\n".join(top3) if top3 else "• (chưa có tin nổi bật hôm nay)"
    
    digest = f"""# 📅 Tech Digest • {TODAY_SHORT}

🔥 **TOP 3 ĐỌC NGAY**
{top3_text}

---
{sections[0]}
{sections[1]}
{sections[2]}
{sections[3]}
---
*Tech Digest tự động bởi Lucy • {datetime.now().strftime("%H:%M %d/%m/%Y")}*
"""
    return digest

def generate_html(digest_md):
    """Ghi digest vào file markdown và tạo HTML."""
    md_file = WORKDIR / f"tech-{TODAY}.md"
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(digest_md)
    
    html_file = WORKDIR / f"tech-{TODAY}.html"
    html_archive = ARCHIVE_DIR / f"tech-{TODAY}.html"
    
    # Dùng gen_brief.mjs để render HTML
    gen_script = BRIDGE_DIR / "gen_brief.mjs"
    if os.path.exists(gen_script):
        try:
            proc = subprocess.run(
                ["node", str(gen_script), "report", str(md_file), str(html_file), TODAY],
                capture_output=True, text=True, timeout=30,
                env={**os.environ, "LUCY_WEB_ROOT": str(WEB_ROOT)}
            )
            if os.path.exists(html_file) and os.path.getsize(html_file) > 100:
                shutil.copy2(html_file, html_archive)
                # Update index
                subprocess.run(
                    ["node", str(gen_script), "index"],
                    capture_output=True, timeout=30,
                    env={**os.environ, "LUCY_WEB_ROOT": str(WEB_ROOT)}
                )
                return f"{PUBLIC_BASE}/archive/tech-{TODAY}.html"
        except Exception as e:
            log(f"HTML gen error: {e}")
    return None

def main():
    log(f"{'='*50}")
    log(f"🔬 TECH DIGEST — {TODAY}")
    log(f"{'='*50}")
    
    start = time.time()
    
    # === STEP 1-4: Run checkpoints ===
    success_count = 0
    for cp in CHECKPOINTS:
        if run_checkpoint(cp):
            success_count += 1
    
    log(f"✅ Checkpoints: {success_count}/{len(CHECKPOINTS)} thành công")
    
    # === STEP 5: Assemble digest ===
    log(f"📝 Assembling digest...")
    digest = assemble_digest()
    md_file = WORKDIR / f"tech-{TODAY}.md"
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(digest)
    log(f"✅ Digest saved: {md_file}")
    
    # === STEP 6: Generate HTML ===
    log(f"🌐 Generating HTML...")
    html_url = generate_html(digest)
    if html_url:
        log(f"✅ HTML: {html_url}")
    
    # === STEP 7: Send Telegram ===
    elapsed = time.time() - start
    top3 = build_top3()
    top3_text = "\n".join(f"  {b}" for b in top3[:3]) if top3 else "  (không có tin nổi bật)"
    
    telegram_msg = f"""📅 **Tech Digest • {TODAY_SHORT}** ✅

🔥 **TOP 3 HÔM NAY**
{top3_text}

📊 {success_count}/{len(CHECKPOINTS)} sections OK | ⏱ {elapsed:.0f}s
🔗 Xem đầy đủ: {html_url or 'đang cập nhật'}"""

    log(f"📨 Sending Telegram...")
    send_telegram(telegram_msg)
    
    # Gửi file markdown đầy đủ
    send_telegram_file(str(md_file), caption=f"📄 Tech Digest {TODAY_SHORT} — đầy đủ")
    
    total = time.time() - start
    log(f"{'='*50}")
    log(f"🏁 HOÀN THÀNH — {total:.0f}s")
    log(f"{'='*50}")
    
    return 0 if success_count > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
