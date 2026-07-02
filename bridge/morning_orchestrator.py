#!/usr/bin/env python3
"""
Morning Orchestrator — chạy TOÀN BỘ flow buổi sáng trong 1 lượt, TUẦN TỰ.
Thay 4 cron rời rạc (brief / tech / vn / vn_trending) bằng 1 script:
  - 4 stage nội dung chạy lần lượt, mỗi stage 1× claude opus (hết đè nhau)
  - Filter 2 tầng: tầng 1 trong từng prompt, tầng 2 ở bước synthesis
  - Update web + ghi data 1 lần, gửi 1 Telegram "Morning Card" duy nhất
  - Telegram parse_mode=HTML + fallback plain (hết lỗi 'can't parse entities')

Dùng:  python3 morning_orchestrator.py [morning|afternoon]
"""

import os, sys, json, subprocess, time, re, shutil, html, hmac, hashlib
import urllib.request, urllib.parse
from datetime import datetime, date
from pathlib import Path

# ============================== CONFIG ==============================
BRIDGE_DIR = Path("/root/lucy/bridge")
WORKDIR    = Path(os.environ.get("LUCY_WORKDIR", "/root/lucy-workspace"))
WEB_ROOT   = Path("/var/www/lucy-reports")
ARCHIVE    = WEB_ROOT / "archive"
PUBLIC_BASE = "http://14.225.255.73/reports"
GEN_BRIEF  = str(BRIDGE_DIR / "gen_brief.mjs")
LUCY_DATA  = str(BRIDGE_DIR / "lucy_data.mjs")

def load_env():
    """Đọc .env (KEY=VALUE) vào os.environ — không ghi đè biến đã có."""
    envf = BRIDGE_DIR / ".env"
    if not envf.exists():
        return
    for line in envf.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)

load_env()

CLAUDE_BIN   = os.environ.get("CLAUDE_BIN", "/root/.local/bin/claude")
PERSONA_FILE = os.environ.get("LUCY_PERSONA", str(BRIDGE_DIR / "persona.md"))
TG_TOKEN     = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_CHAT      = os.environ.get("LUCY_ALLOWED_USER_ID", "")
TIMEOUT      = int(os.environ.get("LUCY_CLAUDE_TIMEOUT", "420"))   # 7 phút/stage cho sonnet + websearch
MAX_RETRIES  = 2

# Nhúng vào mọi stage để báo cáo đọc tự nhiên, không lộ giọng AI (skill humanizer-vi).
HUMANIZER = (
    "\n\n=== VIẾT NHƯ NGƯỜI, KHÔNG GIỌNG AI ===\n"
    "- Phân tích phải CỤ THỂ: nêu số + lý do nhân-quả thật, đừng gắn đuôi rỗng "
    "'góp phần/thể hiện/phản ánh/qua đó tạo nên/mang lại'.\n"
    "- Cấm sáo rỗng: vô cùng, đáng chú ý (rỗng), không thể phủ nhận, trong bối cảnh, "
    "bức tranh tổng thể, đầy biến động, tâm điểm.\n"
    "- Cấm bộ ba nhồi cho đủ và cấm 'không chỉ... mà còn...'. Cắt danh từ hóa thừa "
    "(sự/việc/tính/một cách) khi câu vẫn rõ.\n"
    "- Cấm gạch ngang dài (— và –) trong văn; thay bằng dấu phẩy, chấm hoặc ngoặc. "
    "Đừng rào đón chồng chất 'có lẽ phần nào có thể'.\n"
    "- Câu dài ngắn xen kẽ. Nhận định phải có chính kiến rõ + rủi ro thật, đừng kết "
    "kiểu 'triển vọng tươi sáng' chung chung.\n"
    "- In đậm CHỈ cho số/mức giá quan trọng, đừng bôi tràn lan. Emoji chỉ ở header mục.\n"
)

SESSION = (sys.argv[1] if len(sys.argv) > 1 else "morning").lower()
IS_PM   = SESSION in ("afternoon", "chieu", "pm")
SLUG    = "pm" if IS_PM else "am"
TODAY       = date.today().isoformat()
TODAY_SHORT = datetime.now().strftime("%d/%m/%Y")
LOG_FILE = WORKDIR / f"morning-orch-{TODAY}-{SLUG}.log"

WORKDIR.mkdir(parents=True, exist_ok=True)
ARCHIVE.mkdir(parents=True, exist_ok=True)


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# ============================== INFRA ==============================
def wait_claude_free(max_wait=600):
    """Chờ claude rảnh (≤1 process) trước khi bắt đầu, tránh đè cron khác."""
    waited = 0
    while waited < max_wait:
        try:
            n = int(subprocess.run(["pgrep", "-c", "claude"], capture_output=True,
                                   text=True).stdout.strip() or "0")
        except Exception:
            n = 0
        if n <= 1:
            return True
        time.sleep(15); waited += 15
    log(f"⚠️ claude vẫn bận sau {max_wait}s — chạy luôn (best effort)")
    return False


def run_claude(prompt, timeout=TIMEOUT):
    """1 lần gọi claude sonnet. Trả (ok, text)."""
    try:
        proc = subprocess.run(
            [CLAUDE_BIN, "-p", prompt + HUMANIZER,
             "--model", "claude-sonnet-4-6",
             # claude 2.1.173+ CẤM bypassPermissions khi chạy ROOT → dùng --allowedTools (như cron_brief.sh).
             "--allowedTools", "Bash WebSearch WebFetch Read Glob Grep",
             "--output-format", "json",
             "--append-system-prompt-file", PERSONA_FILE],
            capture_output=True, text=True, timeout=timeout, stdin=subprocess.DEVNULL
        )
        if proc.returncode == 0:
            try:
                data = json.loads(proc.stdout)
                content = (data.get("result") or "").strip()
                if content and len(content) > 40:
                    return True, content
            except json.JSONDecodeError:
                pass
        raw = (proc.stdout or "").strip() or (proc.stderr or "").strip()
        if raw and len(raw) > 40:
            return True, raw
        return False, f"rc={proc.returncode}"
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except Exception as e:
        return False, str(e)


def run_claude_retry(prompt, label):
    for attempt in range(1, MAX_RETRIES + 1):
        log(f"    🧠 [{label}] lần {attempt}/{MAX_RETRIES} (sonnet)...")
        ok, out = run_claude(prompt)
        if ok and len(out) > 80:
            log(f"    ✅ [{label}] {len(out)} chars")
            return out
        log(f"    ⚠️ [{label}] lỗi: {out[:100]}")
        if attempt < MAX_RETRIES:
            time.sleep(8)
    return None


def split_report(full):
    """Tách @@DATA, MD hiển thị, và bản Telegram (bỏ bảng)."""
    data_lines = [l.strip() for l in full.split("\n") if l.strip().startswith("@@DATA")]
    data_line = data_lines[-1] if data_lines else ""
    md = "\n".join(l for l in full.split("\n")
                   if not l.strip().startswith("@@DATA")).strip()
    tg = "\n".join(l for l in md.split("\n") if not re.match(r"^\s*\|", l))
    return md, data_line, tg.strip()


def record_data(data_line):
    if not data_line:
        return
    args = re.sub(r"^@@DATA\s*", "", data_line).split()
    args = [a for a in args if "=" in a]
    if not args:
        return
    try:
        subprocess.run(["node", LUCY_DATA, "record", "--date", TODAY,
                        "--session", SLUG, "--set", *args],
                       capture_output=True, text=True, timeout=30,
                       env={**os.environ, "LUCY_WEB_ROOT": str(WEB_ROOT)})
        log(f"    📈 data: {' '.join(args)}")
    except Exception as e:
        log(f"    ⚠️ record data lỗi: {e}")


def gen_html(md_text, summary_text, basename):
    """MD → HTML qua gen_brief.mjs, copy vào archive. Trả public URL hoặc ''."""
    md_file   = WORKDIR / f"{basename}.md"
    summ_file = WORKDIR / f"_summ_{basename}.txt"
    html_file = WORKDIR / f"{basename}.html"
    md_file.write_text(md_text, encoding="utf-8")
    summ_file.write_text(summary_text[:3000], encoding="utf-8")
    try:
        subprocess.run(["node", GEN_BRIEF, "report", str(md_file), str(summ_file),
                        str(html_file), TODAY],
                       capture_output=True, text=True, timeout=40,
                       env={**os.environ, "LUCY_WEB_ROOT": str(WEB_ROOT)})
    except Exception as e:
        log(f"    ⚠️ gen_brief lỗi: {e}")
    if html_file.exists() and html_file.stat().st_size > 200:
        shutil.copy2(html_file, ARCHIVE / f"{basename}.html")
        return f"{PUBLIC_BASE}/archive/{basename}.html"
    return ""


def regen_index():
    try:
        subprocess.run(["node", GEN_BRIEF, "index"], capture_output=True, text=True,
                       timeout=40, env={**os.environ, "LUCY_WEB_ROOT": str(WEB_ROOT)})
        log("📚 index regenerated")
    except Exception as e:
        log(f"⚠️ index lỗi: {e}")


def md_to_tg_html(text):
    """Markdown → HTML an toàn cho Telegram (escape trước, rồi gắn tag tối thiểu)."""
    t = html.escape(text)                                   # & < > an toàn
    t = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)",       # [text](url) → link
               lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = re.sub(r"\*\*([^*\n]+)\*\*", r"<b>\1</b>", t)        # **bold**
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<b>\1</b>", t)  # *bold*
    t = re.sub(r"^#{1,6}\s*", "", t, flags=re.MULTILINE)    # bỏ # heading
    return t


def send_telegram(text_html):
    """Gửi HTML; nếu Telegram từ chối thì fallback plain text (luôn tới được)."""
    if not (TG_TOKEN and TG_CHAT):
        log("⚠️ thiếu TELEGRAM token/chat — bỏ qua gửi")
        return False
    api = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    for mode, payload in (("HTML", text_html),
                          (None, re.sub(r"<[^>]+>", "", text_html))):
        data = {"chat_id": TG_CHAT, "text": payload[:4090],
                "disable_web_page_preview": "true"}
        if mode:
            data["parse_mode"] = mode
        try:
            req = urllib.request.Request(api, data=urllib.parse.urlencode(data).encode(),
                                         method="POST")
            resp = json.load(urllib.request.urlopen(req, timeout=20))
            if resp.get("ok"):
                log(f"📨 Telegram OK ({mode or 'plain'})")
                return True
            log(f"⚠️ Telegram từ chối ({mode}): {resp.get('description')}")
        except Exception as e:
            log(f"⚠️ Telegram lỗi ({mode}): {e}")
    return False


# ============================== TRENDING RSS ==============================
def fetch_rss(url, n=10, prefix="•"):
    out = []
    try:
        import feedparser
        feed = feedparser.parse(url)
        for e in feed.entries[:n]:
            title = (e.get("title") or "").strip()
            if title and len(title) > 3:
                out.append(f"{prefix} {title}")
    except Exception:
        pass
    return out


def collect_trends():
    log("  📡 thu thập RSS trending...")
    raw = []
    g = []
    for u in ("https://trends.google.com/trending/rss?geo=VN",
              "https://trends.google.com/trends/trendingsearches/daily/rss?geo=VN"):
        g += fetch_rss(u, 10)
    if g: raw.append("## Google Trends VN"); raw += g[:12]
    vne = fetch_rss("https://vnexpress.net/rss/tin-moi-nhat.rss", 10)
    if vne: raw.append("\n## VnExpress mới nhất"); raw += vne
    # Báo Mới RSS hay chết — thử nhiều endpoint
    bm = (fetch_rss("https://baomoi.com/rss/tin-moi.rss", 10) or
          fetch_rss("https://baomoi.com/rss/trang-chu.rss", 10))
    if bm: raw.append("\n## Báo Mới"); raw += bm
    dt = fetch_rss("https://dantri.com.vn/rss/home.rss", 8)
    if dt: raw.append("\n## Dân Trí"); raw += dt
    log(f"  📊 RSS items: {len([r for r in raw if r.startswith('•')])}")
    return "\n".join(raw) if raw else "(không lấy được RSS — để model tự web-search)"


# ============================== STAGES ==============================
def market_note():
    if IS_PM:
        return ("Đây là BÁO CÁO CHIỀU (chốt phiên). Nhấn mạnh diễn biến trong phiên hôm nay so với sáng, "
                "biến động đáng chú ý, định hướng cho phiên tối/đêm (US session). ")
    return ("Đây là BÁO CÁO SÁNG (mở ngày). Nhấn mạnh bức tranh tổng thể đầu ngày, "
            "so với hôm qua, và kế hoạch theo dõi trong ngày. ")


def vn_note():
    if IS_PM:
        return ("Đây là BÁO CÁO CHIỀU (chốt phiên chứng khoán VN). Nhấn mạnh DIỄN BIẾN trong phiên: "
                "VN-Index đóng cửa, thanh khoản, khối ngoại mua/bán ròng, nhóm ngành dẫn dắt, tin doanh nghiệp nổi bật. ")
    return ("Đây là BÁO CÁO SÁNG (mở đầu ngày). Nhấn mạnh tin kinh tế VN và định hướng thị trường đầu ngày: "
            "lịch sự kiện, tin vĩ mô/quốc tế ảnh hưởng phiên VN, nhóm ngành dự kiến dẫn dắt, vùng hỗ trợ/kháng cự VN-Index. ")


def build_stages():
    mnote, vnote = market_note(), vn_note()
    label = "chiều" if IS_PM else "sáng"

    market_prompt = f"""Làm BÁO CÁO THỊ TRƯỜNG hôm nay ({TODAY}), CHI TIẾT, CHUYÊN NGHIỆP, GÓC TRADER. \
LỌC NHIỄU MẠNH TAY — ưu tiên thứ thực sự tác động giá/danh mục, BỎ tin shill/PR. Số liệu THẬT từ web/API (ghi rõ nguồn + giờ lấy). {mnote}\
=== CÔNG CỤ NHANH (dùng TRƯỚC khi browse cho số crypto) === \
'bash ~/lucy/tools/crypto.sh bitcoin ethereum solana binancecoin ripple' lấy giá/%24h/7d/30d/mcap; \
'bash ~/lucy/tools/global.sh' lấy total mcap + BTC dominance. \
=== PHÂN TẦNG === \
TẦNG 1 (LUÔN báo nếu có data): CRYPTO (BTC, ETH + 2-3 top mover: giá, %24h/7d, mcap, hỗ trợ/kháng cự, funding/OI nếu có); \
VÀNG (XAU/USD + SJC + chênh trong-ngoài); CK VN (VN-Index điểm/%/thanh khoản/khối ngoại/nhóm dẫn dắt); \
CK Mỹ (S&P500, Nasdaq điểm/%/nhóm dẫn dắt). \
TẦNG 2 (chỉ khi BOM TẤN): Macro — Fed/FOMC, CPI/PCE, NFP, DXY, dầu, địa chính trị, dòng tiền ETF. Bình thường gộp ngắn. \
TẦNG 3 (chỉ khi có sóng): altcoin/cổ phiếu lẻ. Không có thì BỎ. \
=== QUY TẮC === Mỗi tài sản: xu hướng + kháng cự/hỗ trợ gần + 'KHI NÀO NÊN VÀO' (điều kiện) + RỦI RO. \
Mỗi mục kèm LÝ DO 'tại sao đáng chú ý'. Mảng nào không nổi bật → nói thẳng, ĐỪNG nhồi. \
=== ĐỊNH DẠNG (markdown cho web) === Mở '### 🔥 TOP 3 (chú ý nhất hôm nay)'; heading ### từng mảng; \
**bảng markdown** cho số liệu; **đậm** số quan trọng; nguồn = [Tên](URL). \
Mục '### 🗓️ Radar sự kiện' (Fed/CPI/NFP/earnings + đáo hạn phái sinh VN, còn bao lâu). \
Mục cuối '### 🎯 Góc nhìn Lucy' (nhận định + 1-2 kèo + cảnh báo rủi ro). \
=== DÒNG DỮ LIỆU (DÒNG CUỐI, sau tất cả) === In ĐÚNG 1 dòng '@@DATA ' + các cặp KEY=VALUE (số thuần, không đơn vị/ký hiệu/dấu phẩy). \
Key: BTC ETH SOL BNB XRP=giá USD; BTCDOM=%; TOTALMC=nghìn tỷ USD; XAU=USD/oz; SJC=triệu/lượng; VNINDEX SP500 NASDAQ=điểm; DXY; OIL=WTI. \
Chỉ ghi key có SỐ THẬT; không có thì BỎ HẲN, KHÔNG bịa. Ví dụ: @@DATA BTC=66200 ETH=3520 XAU=2318 VNINDEX=1281 \
=== OUTPUT === In TOÀN BỘ báo cáo (đúng format) ra stdout. Xưng em, gọi chủ nhân. KHÔNG bịa số — không lấy được thì ghi 'chưa lấy được'."""

    vn_prompt = f"""Làm BÁO CÁO THỊ TRƯỜNG VIỆT NAM + TIN KINH TẾ VN trong 24h qua ({TODAY}). \
CHI TIẾT, CHUYÊN NGHIỆP, GÓC NHÀ ĐẦU TƯ CÁ NHÂN. LỌC NHIỄU MẠNH — ưu tiên thứ tác động thị trường/danh mục, BỎ tin PR/giật tít. \
Số liệu THẬT từ web (nguồn + giờ lấy). {vnote}\
=== CẤU TRÚC === \
📰 TIN NỔI BẬT (CafeF, Vietstock, VnExpress KD, FireAnt): tin vĩ mô/chính sách (NHNN, đầu tư công, XNK, FDI, lạm phát, lãi suất, tỷ giá USD/VND); \
tin doanh nghiệp (KQKD, cổ tức, phát hành, niêm yết); tin ngành (bank, chứng, BĐS, thép, bán lẻ, công nghệ, năng lượng). Mỗi tin 1 dòng 'tại sao đáng chú ý' + [link]. \
📊 DIỄN BIẾN CK VN: VN-Index (điểm, % so hôm qua, thanh khoản, độ rộng); VN30 (top tăng/giảm); HNX/UPCOM; khối ngoại (mua/bán ròng bao nhiêu tỷ, mã nào); nhóm ngành dẫn dắt; mã bất thường. \
🔮 NHẬN ĐỊNH: xu hướng ngắn hạn VN-Index (hỗ trợ/kháng cự gần); dòng tiền vào nhóm nào; kế hoạch theo dõi. \
=== QUY TẮC === Mỗi mục + nguồn + giờ; mỗi tin/mã + lý do; không nổi bật thì nói thẳng; link [Tên](URL). \
=== ĐỊNH DẠNG === emoji header; **bảng markdown** nếu cần; **đậm** số quan trọng. KHÔNG bịa số. \
=== DÒNG DỮ LIỆU (DÒNG CUỐI) === In ĐÚNG 1 dòng '@@DATA ' + KEY=VALUE (số thuần). \
Key VN: VNINDEX=điểm; VN30=điểm; HNX=điểm; DXY; DONG=tỷ giá USD/VND. Chỉ ghi key có số thật. Ví dụ: @@DATA VNINDEX=1281 VN30=1357 DONG=25450 \
In TOÀN BỘ ra stdout. Xưng em, gọi chủ nhân."""

    tech_prompt = f"""Làm TECH DIGEST hôm nay ({TODAY}) — tin công nghệ NÓNG NHẤT 24h qua. \
Chủ nhân là GAME DEV + TECHNICAL ARTIST (Unity/VR/shader) mê AI tooling — ưu tiên thứ liên quan. \
LỌC MẠNH: bỏ PR/quảng cáo/vibe coding/giật tít, chỉ lấy thứ có IMPACT thực tế hoặc xài được. \
=== 4 MẢNG (mỗi mảng 2-4 bullet '• **[Tiêu đề]** — tóm tắt 1 câu + tại sao quan trọng. [link]') === \
### 🤖 AI / LLM — Hugging Face trending, Arxiv cs.AI/cs.LG, r/LocalLLaMA, blog OpenAI/Anthropic/Google DeepMind/Meta (model mới, breakthrough, agent, tooling, MCP). \
### 💻 Software Dev — Hacker News (top + Show HN), Lobsters, GitHub Trending, r/programming (ngôn ngữ/framework/db/dev tools có impact). \
### 🎮 Game Dev — r/gamedev, GameDeveloper.com, PC Gamer (engine update Unreal/Unity/Godot, kỹ thuật shader/rendering/VR, postmortem, game lớn ra mắt). \
### 🏢 Big Tech — TechCrunch, The Verge, Ars Technica (chỉ động thái CHIẾN LƯỢC: M&A, policy, sản phẩm lớn, kiện tụng; bỏ lặt vặt). \
Mảng nào không có gì nổi bật → ghi 'Hôm nay không có tin <mảng> nổi bật.' \
Mở đầu '### ⭐ Đáng chú ý nhất' (1-2 tin top trong ngày). In TOÀN BỘ ra stdout, markdown. Xưng em, gọi chủ nhân."""

    trends_raw = collect_trends()
    trend_prompt = f"""Hôm nay {TODAY}. Dữ liệu trend thô VN (RSS):
{trends_raw}

NGOÀI dữ liệu trên, HÃY WEB-SEARCH thêm trending THẬT trên: TikTok VN (TikTok Creative Center / hashtag nổi), YouTube Trending VN, Threads/Facebook VN, Google Trends VN. \
LỌC MẠNH: bỏ tin giật gân/drama vô bổ, ưu tiên trend có thể KHAI THÁC LÀM CONTENT. \
\
Viết báo cáo markdown gồm: \
### 🔥 3 Trend nóng nhất — mỗi trend: tên + vì sao hot + nền tảng nào đang đẩy + còn 'sống' bao lâu. \
### 📈 Format đang ăn view — dạng content/độ dài/hook nào đang viral (TikTok, Shorts, Reels, Threads). \
### 💡 3 Ý tưởng content cho chủ nhân — chủ nhân là GAME DEV + TECHNICAL ARTIST làm content về Unity/shader/VR/AI tooling/gamedev. \
Mỗi idea: concept ngắn + format (Short/TikTok/Reel/Blog) + góc nhìn riêng GẮN với niche gamedev/tech-art, ưu tiên dễ làm ít production nhưng vẫn bắt trend. \
\
Ngắn gọn, dễ đọc. In TOÀN BỘ ra stdout. Xưng em, gọi chủ nhân."""

    return [
        {"id": "market", "label": f"Market {label}", "emoji": "📊",
         "name": "Thị trường", "basename": f"brief-{TODAY}-{SLUG}",
         "prompt": market_prompt, "data": True},
        {"id": "vn", "label": f"VN {label}", "emoji": "📍",
         "name": "Thị trường VN", "basename": f"vn-{TODAY}-{SLUG}",
         "prompt": vn_prompt, "data": True},
        {"id": "tech", "label": "Tech Digest", "emoji": "🔬",
         "name": "Tech Digest", "basename": f"tech-{TODAY}",
         "prompt": tech_prompt, "data": False},
        {"id": "trend", "label": "VN Trending", "emoji": "🔥",
         "name": "VN Trending", "basename": f"vn-trending-{TODAY}",
         "prompt": trend_prompt, "data": False},
    ]


# ============================== MAIN ==============================
def main():
    start = time.time()
    log("=" * 56)
    log(f"☀️  MORNING ORCHESTRATOR — {TODAY} [{SLUG}]")
    log("=" * 56)

    wait_claude_free()

    # Buổi chiều: chỉ chạy market + VN (tech/trending là việc buổi sáng)
    stages = build_stages()
    if IS_PM:
        stages = [s for s in stages if s["id"] in ("market", "vn")]

    results = []   # {stage, md, tg, url}
    for st in stages:
        log(f"▶ STAGE [{st['id']}] {st['label']}")
        out = run_claude_retry(st["prompt"], st["label"])
        if not out:
            log(f"  ⛔ [{st['id']}] bỏ qua (không lấy được nội dung)")
            results.append({"stage": st, "md": "", "tg": "", "url": ""})
            continue
        md, data_line, tg = split_report(out)
        if st["data"]:
            record_data(data_line)
        summary = tg[:600]
        url = gen_html(md, summary, st["basename"])
        log(f"  🌐 [{st['id']}] {url or 'HTML fail'}")
        results.append({"stage": st, "md": md, "tg": tg, "url": url})

    # ---------- PHASE 2: SYNTHESIS (filter tầng 2) ----------
    log("▶ SYNTHESIS — đúc Morning Card")
    digest_src = "\n\n".join(
        f"### {r['stage']['emoji']} {r['stage']['name']}\n{r['tg'][:1400]}"
        for r in results if r["tg"]
    )
    greet = "Chiều anh ơi" if IS_PM else "Sáng anh ơi"
    synth_prompt = f"""Dưới đây là 4 báo cáo {('chiều' if IS_PM else 'sáng')} hôm nay ({TODAY}) của em:

{digest_src}

Hãy đúc thành 1 "MORNING CARD" CỰC GỌN gửi Telegram cho chủ nhân — đây là thứ ĐẦU TIÊN anh ấy đọc trong ngày. \
Mở đầu bằng "{greet}," rồi: \
1. **TOP 3-5 điều CẦN LƯU Ý HÔM NAY** xuyên suốt cả 4 mảng (thị trường + VN + tech + trend) — chọn thứ TÁC ĐỘNG/ĐÁNG HÀNH ĐỘNG nhất, mỗi dòng 1 ý kèm emoji. \
2. Nếu có **liên hệ chéo đáng chú ý** (vd vàng tăng + DXY giảm, hay 1 tin tech ăn khớp 1 ý tưởng content) → nêu 1-2 câu. \
3. 1 câu chốt 'việc nên làm hôm nay'. \
LỌC TINH: bỏ thứ nhàn nhạt, chỉ giữ tín hiệu mạnh. Tổng dưới 1500 ký tự. Markdown nhẹ (**đậm**, bullet). Xưng em, gọi anh. KHÔNG bịa."""
    card = run_claude_retry(synth_prompt, "synthesis") or \
           f"{greet}, hôm nay em đã chuẩn bị xong các báo cáo bên dưới — anh xem chi tiết qua link nhé."

    # ---------- PHASE 3: OUTPUT 1 LẦN ----------
    regen_index()

    links = []
    for r in results:
        if r["url"]:
            links.append(f"{r['stage']['emoji']} <b>{html.escape(r['stage']['name'])}</b>: {r['url']}")
    links_block = "\n".join(links)
    head = "🌆" if IS_PM else "☀️"
    msg = (f"{head} <b>Morning Card • {TODAY_SHORT}</b>\n\n"
           f"{md_to_tg_html(card)}\n\n"
           f"━━━━━━━━━━━━━\n{links_block}\n"
           f"📚 Tất cả: {PUBLIC_BASE}/")
    send_telegram(msg)

    total = time.time() - start
    ok_n = sum(1 for r in results if r["url"])
    log("=" * 56)
    log(f"🏁 DONE — {total:.0f}s | {ok_n}/{len(results)} report OK")
    log("=" * 56)
    return 0


if __name__ == "__main__":
    sys.exit(main())
