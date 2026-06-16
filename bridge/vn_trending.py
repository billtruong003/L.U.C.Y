#!/usr/bin/env python3
"""
Vietnam Trending Agent
Thu thập trend VN hôm nay → Claude phân tích → gợi ý content → Telegram + Web UI.
Chạy mỗi sáng sau tech digest.
"""

import os, sys, json, subprocess, time, re, shutil, urllib.request, urllib.parse, textwrap
from datetime import datetime, date
from pathlib import Path

# === CONFIG ===
WORKDIR = Path("/root/lucy-workspace")
BRIDGE_DIR = Path("/root/lucy/bridge")
WEB_ROOT = Path("/var/www/lucy-reports")
PUBLIC_BASE = "http://14.225.255.73/reports"
CLAUDE_BIN = "/root/.local/bin/claude"
PERSONA_FILE = str(BRIDGE_DIR / "persona.md")
TELEGRAM_BOT_TOKEN = "8732706974:AAFWFChwBu1rwZOlf4-y_1YCeShevU7_VpQ"
TELEGRAM_CHAT_ID = "6603021156"
TODAY = date.today().isoformat()
TODAY_SHORT = datetime.now().strftime("%d/%m/%Y")
LOG_FILE = WORKDIR / f"vn-trending-{TODAY}.log"

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def send_telegram(message):
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
        log(f"Telegram error: {e}")
        return False

def fetch_google_trends_vn():
    """Lấy Google Trends Vietnam RSS."""
    trends = []
    try:
        import feedparser
        urls = [
            "https://trends.google.com/trending/rss?geo=VN",
            "https://trends.google.com/trends/trendingsearches/daily/rss?geo=VN"
        ]
        for url in urls:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:10]:
                    title = entry.get("title", "").strip()
                    if title and len(title) > 3:
                        trends.append(f"• {title}")
            except:
                pass
        log(f"  Google Trends: {len(trends)} items")
    except ImportError:
        log(f"  feedparser not installed, skip Google Trends")
    except Exception as e:
        log(f"  Google Trends error: {e}")
    return trends

def fetch_bao_moi():
    """Lấy tin nóng từ Báo Mới RSS."""
    items = []
    try:
        import feedparser
        feed = feedparser.parse("https://baomoi.com/rss/tin-moi.rss")
        for entry in feed.entries[:10]:
            title = entry.get("title", "").strip()
            if title:
                items.append(f"• {title}")
        log(f"  Báo Mới: {len(items)} items")
    except:
        log(f"  Báo Mới: không lấy được")
    return items

def fetch_vnexpress():
    """Lấy tin nóng từ VNExpress RSS."""
    items = []
    try:
        import feedparser
        feed = feedparser.parse("https://vnexpress.net/rss/tin-moi-nhat.rss")
        for entry in feed.entries[:10]:
            title = entry.get("title", "").strip()
            if title:
                items.append(f"• {title}")
        log(f"  VNExpress: {len(items)} items")
    except:
        log(f"  VNExpress: không lấy được")
    return items

def fetch_youtube_trending_vn():
    """Lấy YouTube trending VN."""
    items = []
    try:
        import feedparser
        feed = feedparser.parse("https://www.youtube.com/feeds/videos.xml?playlist_id=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf")
        for entry in feed.entries[:8]:
            title = entry.get("title", "").strip()
            if title:
                items.append(f"• {title}")
        log(f"  YouTube: {len(items)} items")
    except:
        log(f"  YouTube: không lấy được")
    return items

def run_claude(prompt, timeout=180):
    """Gọi claude -p."""
    try:
        proc = subprocess.run(
            [CLAUDE_BIN, "-p", prompt,
             "--permission-mode", "bypassPermissions",
             "--output-format", "json",
             "--append-system-prompt-file", PERSONA_FILE],
            capture_output=True, text=True, timeout=timeout
        )
        if proc.returncode == 0:
            try:
                data = json.loads(proc.stdout)
                content = (data.get("result") or "").strip()
                if content and len(content) > 50:
                    return content
            except:
                pass
        raw = (proc.stdout or "").strip() or (proc.stderr or "").strip()
        return raw if len(raw) > 50 else None
    except subprocess.TimeoutExpired:
        log(f"  ⚠️ Claude timeout")
        return None
    except Exception as e:
        log(f"  ⚠️ Claude error: {e}")
        return None

def main():
    log(f"{'='*50}")
    log(f"🔥 VIETNAM TRENDING — {TODAY}")
    log(f"{'='*50}")
    
    start = time.time()
    
    # === STEP 1: Thu thập raw data ===
    log(f"📡 Collecting trending data...")
    
    google_trends = fetch_google_trends_vn()
    bao_moi = fetch_bao_moi()
    vnexpress = fetch_vnexpress()
    youtube = fetch_youtube_trending_vn()
    
    all_raw = []
    if google_trends:
        all_raw.append("## Google Trends VN")
        all_raw.extend(google_trends)
    if bao_moi:
        all_raw.append("\n## Báo Mới - Tin nóng")
        all_raw.extend(bao_moi)
    if vnexpress:
        all_raw.append("\n## VNExpress")
        all_raw.extend(vnexpress)
    if youtube:
        all_raw.append("\n## YouTube Trending VN")
        all_raw.extend(youtube)
    
    raw_text = "\n".join(all_raw) if all_raw else "(không lấy được dữ liệu trending hôm nay)"
    
    log(f"📊 Total raw items: {len(all_raw)}")
    
    # Lưu raw data
    raw_file = WORKDIR / f"_vn-raw-{TODAY}.txt"
    with open(raw_file, "w", encoding="utf-8") as f:
        f.write(raw_text)
    
    # === STEP 2: Claude phân tích trend ===
    log(f"🧠 Claude analyzing trends...")
    
    analysis_prompt = f"""Hôm nay là {TODAY}. Dưới đây là dữ liệu trend thô từ VN hôm nay:

{raw_text}

Phân tích:
1. **3 trend nóng nhất** đang thịnh hành ở VN hôm nay — mô tả ngắn, vì sao hot?
2. **Format content nào** đang ăn view trên các nền tảng (TikTok, YouTube Shorts, Facebook, Threads)?
3. **Xu hướng cảm xúc** chủ đạo (vui, lo lắng, giải trí, học tập...)?

Viết gọn trong 5-7 câu, dễ đọc trên Telegram."""
    
    analysis = run_claude(analysis_prompt)
    if not analysis:
        analysis = "(Không phân tích được trend hôm nay)"
    
    log(f"  ✅ Analysis done ({len(analysis)} chars)")
    
    # === STEP 3: Claude gợi ý content ideas ===
    log(f"💡 Claude generating content ideas...")
    
    ideas_prompt = f"""Dựa trên phân tích trend VN hôm nay:

{analysis}

Gợi ý **3 ý tưởng content cụ thể** cho người làm content (chủ của em):
- Mỗi idea gồm: concept ngắn + format (Short/TikTok/Reel/Blog) + góc nhìn riêng
- Ưu tiên ý tưởng dễ làm, ít tốn production nhưng vẫn viral
- Viết ngắn, mỗi idea 2-3 câu"""
    
    ideas = run_claude(ideas_prompt)
    if not ideas:
        ideas = "(Không gợi ý được content ideas hôm nay)"
    
    log(f"  ✅ Ideas done ({len(ideas)} chars)")
    
    # === STEP 4: Ghi kết quả ===
    log(f"📝 Writing report...")
    
    report = f"""# 🔥 Vietnam Trending • {TODAY_SHORT}

## 📡 Raw Data
{raw_text}

## 🧠 Phân Tích
{analysis}

## 💡 Content Ideas
{ideas}

---
*Tự động bởi Lucy • {datetime.now().strftime("%H:%M %d/%m/%Y")}*
"""
    
    report_file = WORKDIR / f"vn-trending-{TODAY}.md"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report)
    
    # === STEP 5: Telegram notification ===
    elapsed = time.time() - start
    log(f"📨 Sending Telegram...")
    
    # Extract ngắn gọn cho Telegram (không đổ hết report)
    analysis_short = re.sub(r'\*+', '', analysis)[:500].strip()
    ideas_short = re.sub(r'\*+', '', ideas)[:400].strip()
    
    telegram_msg = f"""🔥 **VN Trending • {TODAY_SHORT}**

🧠 **Trend nóng:**
{textwrap.shorten(analysis_short, width=400, placeholder='...')}

💡 **Gợi ý content:**
{textwrap.shorten(ideas_short, width=400, placeholder='...')}

📊 {len(all_raw)} nguồn | ⏱ {elapsed:.0f}s
📄 Chi tiết: {PUBLIC_BASE}/archive/vn-trending-{TODAY}.html"""

    send_telegram(telegram_msg)
    
    # === STEP 6: Generate HTML via gen_brief.mjs (consistent with other reports) ===
    log(f"🌐 Generating HTML via gen_brief.mjs...")
    html_file = WORKDIR / f"vn-trending-{TODAY}.html"
    html_archive = WEB_ROOT / "archive" / f"vn-trending-{TODAY}.html"
    
    # Build summary
    analysis_lines = [l.strip() for l in (analysis or '').split('\n') if l.strip()]
    ideas_lines = [l.strip() for l in (ideas or '').split('\n') if l.strip()]
    summary_text = f"🔥 **3 Trend nóng:** {analysis_lines[0][:200] if analysis_lines else '(chưa có)'}\n\n💡 **Content Idea nổi bật:** {ideas_lines[0][:200] if ideas_lines else '(chưa có)'}"
    
    summary_file = WORKDIR / f"_vn_summary_{TODAY}.txt"
    with open(summary_file, "w", encoding="utf-8") as f:
        f.write(summary_text[:3000])
    
    gen_script = BRIDGE_DIR / "gen_brief.mjs"
    md_file = WORKDIR / f"vn-trending-{TODAY}.md"
    
    proc = subprocess.run(
        ["node", str(gen_script), "report", str(md_file), str(summary_file), str(html_file), TODAY],
        capture_output=True, text=True, timeout=30,
        env={**os.environ, "LUCY_WEB_ROOT": str(WEB_ROOT)}
    )
    
    if proc.returncode == 0 and os.path.exists(html_file) and os.path.getsize(html_file) > 100:
        # Copy to archive
        os.makedirs(os.path.dirname(str(html_archive)), exist_ok=True)
        shutil.copy2(html_file, html_archive)
        log(f"  ✅ HTML generated: {PUBLIC_BASE}/archive/vn-trending-{TODAY}.html")
    else:
        log(f"  ⚠️ gen_brief.mjs failed (rc={proc.returncode}), fallback to simple HTML")
        # Fallback: simple HTML
        analysis_html = analysis.replace(chr(9642), "<li>").replace(chr(10), "<br>") if analysis else ""
        ideas_html = ideas.replace(chr(9642), "<li>").replace(chr(10), "<br>") if ideas else ""
        simple_html = f"""<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🔥 VN Trending • {TODAY_SHORT}</title>
<link rel="stylesheet" href="../assets/theme.css">
<link rel="stylesheet" href="../assets/report.css">
</head><body>
<div class="progress-bar"></div>
<div class="header sticky"><div class="header-top">
<div class="brand"><div class="brand-icon">🔥</div><div><div class="brand-name">Lucy VN Trending</div>
<div class="brand-sub">Daily Content Trend Intelligence</div></div></div>
<div class="header-tools"><a class="icon-btn" href="../index.html">📚</a>
<button class="icon-btn" data-action="theme">◑</button>
<div class="header-date"><div class="date">{TODAY_SHORT}</div>
<div class="time">{datetime.now().strftime("%H:%M")}</div></div></div></div>
<div class="header-title"><h1>🔥 VN Trending Hàng Ngày</h1>
<div class="subtitle">Trending topics · Viral content · Data-driven insights</div></div></div>
<div class="container">
<div class="summary-box"><div class="summary-label">⚡ Tóm tắt nhanh</div>
<div class="summary-text content"><p>{summary_text[:500]}</p></div></div>
<div class="section" data-collapsible><div class="section-header">
<span class="section-icon">📋</span><span class="section-title">Báo cáo đầy đủ</span>
<span class="section-caret">▾</span></div>
<div class="section-body"><div class="content full-report">
{analysis_html}
<br><br><b>💡 Content Ideas:</b><br>{ideas_html}
</div></div></div></div>
<button class="to-top">↑</button>
<div class="footer">Báo cáo tự động bởi Lucy • {TODAY_SHORT}</div>
<script src="../assets/report.js"></script>
</body></html>"""
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(simple_html)
        os.makedirs(os.path.dirname(str(html_archive)), exist_ok=True)
        shutil.copy2(html_file, html_archive)
    
    total = time.time() - start
    log(f"{'='*50}")
    log(f"🏁 DONE — {total:.0f}s")
    log(f"📄 Markdown: {report_file}")
    log(f"🌐 HTML: {PUBLIC_BASE}/archive/vn-trending-{TODAY}.html")
    log(f"{'='*50}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
