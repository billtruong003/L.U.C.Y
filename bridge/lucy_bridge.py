#!/usr/bin/env python3
"""Lucy Bridge — Telegram <-> Claude Code (claude -p) TRỰC TIẾP. KHÔNG Hermes.

Mỗi tin Telegram của chủ nhân -> `claude -p` (brain thật: tool + memory + web riêng) -> trả về Telegram.
Giữ phiên qua --resume (map chat_id -> session_id). Persona qua --append-system-prompt-file.

Chạy: pip install requests ; cp .env.example .env ; (điền .env) ; set -a; . .env; set +a ; python3 lucy_bridge.py
Always-on: pm2 start lucy_bridge.py --name lucy-bridge --interpreter python3
"""
import os
import re
import unicodedata
import json
import time
import threading
import subprocess
import asyncio
import concurrent.futures
import requests

# Đường B: Claude Agent SDK in-process (thay spawn claude -p). Guarded → lỗi import thì auto-fallback spawn.
try:
    from claude_agent_sdk import query as _sdk_query, ClaudeAgentOptions as _SdkOpts
    _HAS_SDK = True
except Exception:
    _HAS_SDK = False

try:
    import telegramify_markdown        # convert markdown -> Telegram MarkdownV2 (pip install telegramify-markdown)
    _HAS_TGMD = True
except Exception:
    _HAS_TGMD = False


def _load_env_file():
    """Tự nạp bridge/.env vào os.environ (pm2 start cmd KHÔNG source .env → env bền vững,
    không phụ thuộc snapshot pm2 hay --update-env hay bị mất khi stop/start)."""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    try:
        for line in open(p):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except Exception:
        pass
_load_env_file()

TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = str(os.environ.get("LUCY_ALLOWED_USER_ID", "")).strip()   # khóa chỉ chủ nhân
WORKDIR = os.path.expanduser(os.environ.get("LUCY_WORKDIR", "~/lucy-workspace"))
CLAUDE  = os.environ.get("CLAUDE_BIN", "claude")
# TRÍ NHỚ: vault = não DUY NHẤT của Lucy. Mọi claude -p PHẢI --add-dir vault, không thì Lucy mù vault
# → ghi nhầm vào auto-memory built-in của Claude Code (2 não đánh nhau — bug 2026-06-11).
VAULT   = os.environ.get("LUCY_VAULT", os.path.expanduser("~/lucy/lucy-vault"))
PERSONA = os.path.expanduser(os.environ.get("LUCY_PERSONA", "~/lucy/bridge/persona.md"))
TIMEOUT = int(os.environ.get("LUCY_CLAUDE_TIMEOUT", "900"))          # claude có thể chạy lâu
SESS    = os.path.expanduser("~/.lucy-bridge-sessions.json")
PREFS     = os.path.expanduser("~/.lucy-bridge-prefs.json")   # Đợt A: model/persona/think theo chat_id
LANE_HIST = os.path.expanduser("~/.lucy-lane-history.json")   # history lane per (chat_id, model_key)
LANE_HIST_MAX = int(os.environ.get("LUCY_LANE_HIST_MAX", "60"))  # số messages giữ lại (30 turns) — tăng vì 20 ảo ngắn
API     = f"https://api.telegram.org/bot{TOKEN}"
OFFSET_FILE = os.path.expanduser("~/.lucy-bridge-offset.json")  # lưu getUpdates offset → /restart không tự nuốt loop
# Bypass chặn ISP (VN chặn dải Bot API): nếu set, MỌI call Telegram đi qua proxy này (vd Cloudflare WARP socks5h://127.0.0.1:40000).
# KHÔNG áp cho coordinator (localhost) hay claude (spawn riêng) → an toàn, surgical.
TG_PROXY = os.environ.get("LUCY_TG_PROXY", "").strip()
_TG_PROXIES = {"https": TG_PROXY, "http": TG_PROXY} if TG_PROXY else None
# Đợt A: coordinator (agent-machine) = nơi chạy llm-lane cho chat đa-model. Bridge gọi qua HTTP.
COORD_URL   = os.environ.get("AM_COORD_URL", "http://127.0.0.1:8780")
COORD_TOK   = os.environ.get("AM_TOKEN", "")
PERSONA_DIR = os.path.expanduser(os.environ.get("LUCY_PERSONA_DIR", "~/lucy/agent-machine/config/personas"))
# F4: catalog model 1 NGUỒN — TS sinh file JSON (npm run gen:catalog); bridge đọc khi coordinator offline.
CATALOG_FILE = os.path.expanduser(os.environ.get("LUCY_CATALOG_FILE", "~/lucy/agent-machine/config/model-catalog.json"))
# PHASE 0: prefetch recall — tra memory vault trước mỗi turn rồi chèn khối gợi nhớ vào prompt. Tắt = đặt 0.
RECALL_PREFETCH = str(os.environ.get("LUCY_RECALL_PREFETCH", "1")).strip() not in ("0", "false", "off", "")
# PHASE 2: episodic — ghi turn hội thoại vào memory.db (cross-session recall). Tắt = đặt 0.
EPISODIC = str(os.environ.get("LUCY_EPISODIC", "1")).strip() not in ("0", "false", "off", "")
# PT (parity Telegram↔Hub): cộng token tiêu từ claude-path Telegram vào token-guard CHUNG
# (coordinator NGUỒN DUY NHẤT, hết double-count) + đếm cục bộ theo ngày để xem qua /token. Tắt = đặt 0.
TOKEN_REPORT = str(os.environ.get("LUCY_TOKEN_REPORT", "1")).strip() not in ("0", "false", "off", "")
TG_TOKENS = os.path.expanduser(os.environ.get("LUCY_TG_TOKENS_FILE", "~/.lucy-bridge-tokens.json"))   # đếm token Telegram theo ngày (UTC)
# CC (auto context-compression, CHỈ claude-path): theo dõi kích thước hội thoại per chat → auto-rollover khi dài
# (tóm tắt → mở session claude MỚI seed bằng summary). Lane-path có L3 compressor riêng, KHÔNG đụng.
AUTO_COMPRESS = str(os.environ.get("LUCY_AUTO_COMPRESS", "0")).strip() not in ("0", "false", "off", "")  # default OFF: claude-path để SDK gốc tự nén, tránh rollover 40-lượt ảo ngắn + double-layer
CLAUDE_HIST = os.path.expanduser(os.environ.get("LUCY_CLAUDE_HIST_FILE", "~/.lucy-claude-history.json"))  # transcript buffer + counter per chat
CLAUDE_HIST_MAX = int(os.environ.get("LUCY_CLAUDE_HIST_MAX", "80"))            # số message buffer giữ để tóm tắt (cap)
COMPRESS_TURN_MAX = int(os.environ.get("LUCY_COMPRESS_TURN_MAX", "40"))        # ≥ ngần này lượt claude → nén
COMPRESS_TOKEN_MAX = int(os.environ.get("LUCY_COMPRESS_TOKEN_MAX", "0"))       # 0 = AUTO (window−headroom); >0 = override cứng
COMPRESS_HEADROOM = int(os.environ.get("LUCY_COMPRESS_HEADROOM", "25000"))     # chừa chỗ cho output + lượt mới trước khi nén
# CM-2: tại MỌI điểm đóng phiên (/new + auto-rollover) → rolling-compact (seed_cũ ⊕ buffer) + persist note Brain/episodes/.
# MẶC ĐỊNH TẮT: khi off, bridge chạy Y HỆT hiện tại (seed in-RAM, /new xoá sạch, không rolling, không persist).
# Bật = LUCY_SESSION_SUMMARY=1 + restart bridge (đồng thời bật flag cùng tên ở coordinator để note ghi ra).
SESSION_SUMMARY = str(os.environ.get("LUCY_SESSION_SUMMARY", "0")).strip() in ("1", "true", "on")

os.makedirs(WORKDIR, exist_ok=True)

LAST_MODEL = None                                       # model thật của lần claude gần nhất (từ modelUsage)
LAST_TURN_TOK = 0                                        # CC-1: tổng token (in+out+cache) của lượt claude gần nhất
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


def _load_offset():
    try:
        return json.load(open(OFFSET_FILE)).get("offset")
    except Exception:
        return None


def _save_offset(off):
    try:
        json.dump({"offset": off}, open(OFFSET_FILE, "w"))
    except Exception:
        pass


# ── Đợt A: prefs (model/persona/think) theo chat_id ──
def _load_prefs():
    try:
        return json.load(open(PREFS))
    except Exception:
        return {}


def _save_prefs(p):
    try:
        json.dump(p, open(PREFS, "w"))
    except Exception:
        pass

# ── Lane history: per-(chat_id, model_key) — giữ context khi chat lane giữa lượt ──
def _load_lane_hist():
    try:
        return json.load(open(LANE_HIST))
    except Exception:
        return {}


def _save_lane_hist(h):
    try:
        json.dump(h, open(LANE_HIST, "w"))
    except Exception:
        pass


def _clear_lane_hist(chat_id):
    """Xoá history lane cho mọi model của 1 chat (/new)."""
    h = _load_lane_hist()
    prefix = f"{chat_id}:"
    keys = [k for k in list(h.keys()) if k.startswith(prefix)]
    for k in keys:
        del h[k]
    if keys:
        _save_lane_hist(h)


# ── CC: transcript buffer + counter per chat_id cho claude-path (auto context-compression) ──
def _load_claude_hist():
    try:
        return json.load(open(CLAUDE_HIST))
    except Exception:
        return {}


def _save_claude_hist(h):
    try:
        json.dump(h, open(CLAUDE_HIST, "w"))
    except Exception:
        pass


def _claude_hist_entry(h, chat_id):
    return h.setdefault(str(chat_id), {"buffer": [], "turns": 0, "tokens": 0, "seed": ""})


def claude_hist_append(chat_id, user_text, answer, tokens=0):
    """CC-1: append 1 lượt claude-path (user + assistant) vào buffer rolling.
    turns = cộng dồn. tokens = OCCUPANCY lượt gần nhất (KHÔNG cộng dồn)."""
    h = _load_claude_hist()
    e = _claude_hist_entry(h, chat_id)
    e["buffer"].append({"role": "user", "text": str(user_text or "")[:6000]})
    e["buffer"].append({"role": "assistant", "text": str(answer or "")[:6000]})
    if len(e["buffer"]) > CLAUDE_HIST_MAX:
        e["buffer"] = e["buffer"][-CLAUDE_HIST_MAX:]
    e["turns"] = int(e.get("turns", 0)) + 1
    # CC-1 FIX (bug compact sớm): tokens lượt = input+output+cache_read+cache_creation ≈ ĐỘ ĐẦY context window
    # hiện tại. cache_read lặp lại GẦN NGUYÊN context mỗi lượt → cộng dồn = đếm context đó N lần = rollover giả.
    # Lưu occupancy lượt gần nhất, không cộng dồn. (Giữ giá trị cũ nếu lượt này báo 0 do lỗi/thiếu usage.)
    t = max(0, int(tokens or 0))
    if t > 0:
        e["tokens"] = t
    _save_claude_hist(h)
    return e


def _window_of(model):
    """Context window THẬT của model (token). Map theo tên model-id từ modelUsage.
    Mọi Claude 4.x hiện tại = 200k (Opus/Sonnet/Haiku). Sonnet bật beta 1M = 1,000,000."""
    m = (model or "").lower()
    if "sonnet" in m and "1m" in m:
        return 1000000
    return 200000  # mặc định an toàn cho mọi model Claude hiện hành


def _compress_token_threshold():
    """Ngưỡng occupancy động = window(model) − headroom (mặc định 25k chừa chỗ output+lượt mới).
    LUCY_COMPRESS_TOKEN_MAX > 0 = override cứng (bỏ qua động)."""
    if COMPRESS_TOKEN_MAX > 0:
        return COMPRESS_TOKEN_MAX
    return max(40000, _window_of(LAST_MODEL) - COMPRESS_HEADROOM)


def should_compress(chat_id):
    """CC-1: hội thoại claude-path của chat này đã đủ ĐẦY context để auto-rollover chưa?
    True khi vượt ngưỡng lượt HOẶC occupancy (token lượt gần nhất) ≥ window−headroom
    (chỉ khi LUCY_AUTO_COMPRESS bật)."""
    if not AUTO_COMPRESS:
        return False
    e = _load_claude_hist().get(str(chat_id))
    if not e:
        return False
    return int(e.get("turns", 0)) >= COMPRESS_TURN_MAX or int(e.get("tokens", 0)) >= _compress_token_threshold()


def _take_claude_seed(chat_id):
    """CC-2: lấy + xoá seed summary đang chờ (prepend vào prompt ĐẦU của session mới sau rollover)."""
    h = _load_claude_hist()
    e = h.get(str(chat_id))
    if not e:
        return ""
    seed = e.get("seed") or ""
    if seed:
        e["seed"] = ""
        _save_claude_hist(h)
    return seed


def _clear_claude_hist(chat_id):
    """/new: xoá hẳn buffer + counter + seed claude-path của 1 chat."""
    h = _load_claude_hist()
    if str(chat_id) in h:
        del h[str(chat_id)]
        _save_claude_hist(h)


def _coord(path, body=None):
    """Gọi coordinator (POST nếu có body, GET nếu không). Trả dict; lỗi → {'error':...}."""
    headers = {"x-worker-token": COORD_TOK} if COORD_TOK else {}
    try:
        if body is None:
            r = requests.get(f"{COORD_URL}{path}", headers=headers, timeout=120)
        else:
            r = requests.post(f"{COORD_URL}{path}", json=body, headers=headers, timeout=180)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


# BẢO MẬT: scrub secret khỏi text trước khi ghi episodic turn (mirror redact.ts/scrubSecrets hub).
_SECRET_RULES = [
    (re.compile(r'\bBearer\s+[A-Za-z0-9._\-]{8,}', re.I), 'Bearer [REDACTED]'),
    (re.compile(r'\b(?:sk|rk|pk)-[A-Za-z0-9_\-]{16,}'), '[REDACTED]'),
    (re.compile(r'\bjina_[A-Za-z0-9]{16,}'), '[REDACTED]'),
    (re.compile(r'\b(?:ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}'), '[REDACTED]'),
    (re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{10,}'), '[REDACTED]'),
    (re.compile(r'\bAKIA[0-9A-Z]{16}\b'), '[REDACTED]'),
    (re.compile(r'\b([A-Za-z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|ACCESS[_-]?KEY))\s*[=:]\s*\S+', re.I), r'\1=[REDACTED]'),
]
_LONG_RE = re.compile(r'[A-Za-z0-9+/_\-]{40,}={0,2}')


def _looks_secret(t):
    has_b64 = any(c in t for c in '+/=')
    has_upper = any(c.isupper() for c in t)
    has_lower = any(c.islower() for c in t)
    has_digit = any(c.isdigit() for c in t)
    return has_b64 or (has_upper and has_lower and has_digit)


def scrub_secrets(text):
    if not text:
        return text
    s = str(text)
    for pat, repl in _SECRET_RULES:
        s = pat.sub(repl, s)
    s = _LONG_RE.sub(lambda m: '[REDACTED]' if _looks_secret(m.group(0)) else m.group(0), s)
    return s


# ── Fix #3: gate + lọc lạc đề + dedupe cho recall (tránh chèn "context xàm lồn") ──
_ACK_RE = re.compile(
    r"^(ok|oke|okay|okie|uk|um|ờ|ừ|u|uh|uhm|rồi|roi|vâng|dạ|da|yep|yes|no|ko|"
    r"đúng|dung|sai|hử|hả|haha|hihi|thôi|thoi|được|duoc|ơ|ờ|ừm)[\s\.!,]*$", re.I)


def _norm_tokens(s):
    """Bỏ dấu + lowercase → tập token nghĩa (≥4 ký tự) để so độ liên quan thô."""
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return set(re.findall(r"[a-z0-9]{4,}", s))


def recall_prefetch(text):
    """PHASE 0: tra memory vault (coordinator POST /recall) → khối '🧠 Trí nhớ liên quan' chèn đầu prompt.
    Fix #3: GATE (bỏ lệnh/tin quá ngắn/câu xác nhận trống nghĩa) + LỌC hit lạc đề (0 token chung với câu hỏi)
    + DEDUPE theo title → không chèn rác. Cap 5 hit / ~800 ký tự. Lỗi/tắt flag → trả '' (chat vẫn chạy)."""
    if not RECALL_PREFETCH or not text or not text.strip():
        return ""
    t = text.strip()
    # GATE: lệnh, câu xác nhận trống nghĩa, hoặc quá ngắn → không tra (đây là lúc recall hay lôi rác lạc đề)
    if t.startswith("/") or _ACK_RE.match(t):
        return ""
    qtok = _norm_tokens(t)
    if len(t) < 12 or len(qtok) < 2:
        return ""
    try:
        headers = {"x-worker-token": COORD_TOK} if COORD_TOK else {}
        r = requests.post(f"{COORD_URL}/recall", json={"q": text[:500], "limit": 8},
                          headers=headers, timeout=4)
        hits = (r.json() or {}).get("hits") or []
    except Exception:
        return ""
    lines, budget, seen = [], 800, set()
    for h in hits:
        title = (h.get("title") or h.get("file_path") or "").strip()
        if not title:
            continue
        key = re.sub(r"\s+", " ", title.lower())[:60]
        if key in seen:                              # DEDUPE: title trùng (vd "💬 Phiên ..." lặp)
            continue
        snip = " ".join((h.get("snippet") or "").split())[:200]
        # LỌC LẠC ĐỀ: hit phải chia sẻ ≥1 token nghĩa với câu hỏi, không thì coi như off-topic → bỏ
        if qtok.isdisjoint(_norm_tokens(title + " " + snip)):
            continue
        item = f"- {title}: {snip}" if snip else f"- {title}"
        if budget - len(item) < 0:
            break
        budget -= len(item)
        seen.add(key)
        lines.append(item)
        if len(lines) >= 5:
            break
    if not lines:
        return ""
    return ("🧠 Trí nhớ liên quan (tra tự động từ vault — dùng nếu hữu ích, bỏ qua nếu lạc đề):\n"
            + "\n".join(lines) + "\n\n")


def episodic_log(role, content, chat_id, session_id=""):
    """PHASE 2: ghi 1 turn hội thoại vào memory.db (coordinator POST /episodic) — non-blocking, fire-and-forget.
    Lỗi/timeout/tắt flag → bỏ qua (không bao giờ chặn chat)."""
    if not EPISODIC or not content or not str(content).strip():
        return
    safe = scrub_secrets(str(content))   # BẢO MẬT: giấu key/token trước khi lưu turn

    def _send():
        try:
            headers = {"x-worker-token": COORD_TOK} if COORD_TOK else {}
            requests.post(f"{COORD_URL}/episodic",
                          json={"source": "tg", "chat_id": str(chat_id), "role": role,
                                "content": safe[:8000], "session_id": session_id or ""},
                          headers=headers, timeout=4)
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


# ── PT: token-guard parity (Telegram tính chung với hub) ──
_TG_TOK_LOCK = threading.Lock()


def _today_utc():
    return time.strftime("%Y-%m-%d", time.gmtime())


def _load_tg_tokens():
    """Counter token Telegram theo ngày (UTC). Sang ngày mới → reset (mirror TokenGuard)."""
    try:
        d = json.load(open(TG_TOKENS))
    except Exception:
        d = {}
    if d.get("date") != _today_utc():
        d = {"date": _today_utc(), "inTok": 0, "outTok": 0, "costUsd": 0.0, "turns": 0}
    return d


def _sdk_usage(m):
    """Rút dict usage thô (kiểu Anthropic) từ SDK ResultMessage. None nếu không có."""
    u = getattr(m, "usage", None)
    return u if isinstance(u, dict) else None


def _report_tok(in_tok, out_tok, cost_usd=0.0, cache_read=0, cache_write=0, source="bridge", model="unknown"):
    """Lõi: ghi 1 lượt đốt token. DASH-FIX S2: gửi /spend đủ trường (source+model+cache tách). Fire-and-forget + counter cục bộ."""
    if not TOKEN_REPORT:
        return
    in_tok = max(0, int(in_tok or 0))
    out_tok = max(0, int(out_tok or 0))
    cache_read = max(0, int(cache_read or 0))
    cache_write = max(0, int(cache_write or 0))
    if in_tok <= 0 and out_tok <= 0 and cache_read <= 0 and cache_write <= 0:
        return
    # đếm cục bộ theo ngày (xem riêng phần Telegram qua /token) — inTok GỘP cache để hiện tổng đốt như cũ
    try:
        with _TG_TOK_LOCK:
            d = _load_tg_tokens()
            d["inTok"] += in_tok + cache_read + cache_write
            d["outTok"] += out_tok
            d["costUsd"] = round(d.get("costUsd", 0.0) + float(cost_usd or 0.0), 6)
            d["turns"] += 1
            json.dump(d, open(TG_TOKENS, "w"))
    except Exception:
        pass

    # ledger CHUNG (NGUỒN DUY NHẤT) qua /spend — fire-and-forget
    def _send():
        try:
            headers = {"x-worker-token": COORD_TOK} if COORD_TOK else {}
            requests.post(f"{COORD_URL}/spend",
                          json={"source": source, "model": model, "inTok": in_tok, "outTok": out_tok,
                                "cacheReadTok": cache_read, "cacheWriteTok": cache_write},
                          headers=headers, timeout=4)
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


def report_tokens(usage, cost_usd=0.0, model=None):
    """PT: report token 1 lượt claude-path. usage = dict kiểu Anthropic (input_tokens/output_tokens/cache_*).
    DASH-FIX S2: tách input 'tươi' + cache read/write riêng; source='bridge', model = LAST_MODEL (model thật)."""
    if not usage:
        return
    u = usage or {}
    global LAST_TURN_TOK   # CC-1: lưu tổng token lượt này để counter hội thoại cộng dồn
    LAST_TURN_TOK = (int(u.get("input_tokens", 0) or 0) + int(u.get("output_tokens", 0) or 0)
                     + int(u.get("cache_read_input_tokens", 0) or 0)
                     + int(u.get("cache_creation_input_tokens", 0) or 0))
    _report_tok(int(u.get("input_tokens", 0) or 0), int(u.get("output_tokens", 0) or 0), cost_usd,
                cache_read=int(u.get("cache_read_input_tokens", 0) or 0),
                cache_write=int(u.get("cache_creation_input_tokens", 0) or 0),
                source="bridge", model=model or LAST_MODEL or "unknown")


def _catalog_keys():
    """Key model lane hợp lệ. Ưu tiên coordinator (live, có discovered); offline → đọc file JSON gen từ TS (F4: 1 nguồn)."""
    d = _coord("/llm/models")
    keys = [m.get("key") for m in (d.get("catalog") or []) if m.get("key")]
    if keys:
        return keys
    # coordinator offline → fallback file JSON (cùng nguồn TS MODEL_CATALOG)
    try:
        with open(CATALOG_FILE, encoding="utf-8") as f:
            cat = json.load(f)
        return [m.get("key") for m in (cat.get("models") or []) if m.get("key")]
    except Exception:
        return []


def resolve_persona_text(pid):
    """systemPrompt của persona từ config JSON (cho cả claude-path lẫn lane). None nếu không có."""
    if not pid:
        return None
    try:
        return json.load(open(os.path.join(PERSONA_DIR, f"{pid}.json"))).get("systemPrompt")
    except Exception:
        return None


def list_personas():
    try:
        return sorted(n[:-5] for n in os.listdir(PERSONA_DIR) if n.endswith(".json"))
    except Exception:
        return []


def run_lane(prompt, model_key, chat_id=None, persona_id=None):
    """Chat qua lane model FREE với HISTORY + TOOL agentic. Trả (model_thật, answer, thinking)."""
    # System message: persona hoặc Lucy base (chatLaneAgentic nối CHAT_LANE_NOTE vào đây)
    ptext = resolve_persona_text(persona_id)
    if not ptext:
        try:
            ptext = open(PERSONA).read() if os.path.exists(PERSONA) else "Bạn là Lucy, trợ lý AI."
        except Exception:
            ptext = "Bạn là Lucy, trợ lý AI."
    # History per (chat_id, model_key)
    hist_data, hkey, history = {}, None, []
    if chat_id:
        hist_data = _load_lane_hist()
        hkey = f"{chat_id}:{model_key}"
        history = hist_data.get(hkey, [])
    # Xây message list: [system, ...history, user_now]
    msgs = [{"role": "system", "content": ptext}]
    msgs.extend(history)
    msgs.append({"role": "user", "content": prompt})
    # Gọi endpoint agentic (tool: web_search/web_fetch/read_file/bash…)
    data = _coord("/chat-lane-agentic", {"model": model_key, "messages": msgs, "maxTurns": 8})
    if data.get("error"):
        return None, f"❌ lane lỗi: {data['error']}", None
    answer = data.get("answer") or "(rỗng)"
    lu = data.get("usage") or {}   # PT: lane trả {inTok,outTok} đã gộp (coordinator KHÔNG tự cộng token-guard → an toàn)
    _report_tok(lu.get("inTok"), lu.get("outTok"), source="lane", model=data.get("model") or model_key)  # DASH-FIX S2
    # Lưu history (chỉ user+assistant text, không tool_calls)
    if hkey is not None:
        history = history + [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": answer},
        ]
        if len(history) > LANE_HIST_MAX:
            history = history[-LANE_HIST_MAX:]
        hist_data[hkey] = history
        _save_lane_hist(hist_data)
    # "Thinking" = tóm tắt trace tool (hiện khi pthink bật)
    trace = data.get("trace") or []
    thinking_str = None
    if trace:
        thinking_str = "\n".join(
            f"[{t['name']}({t['input'][:120]})]\n→ {t['result'][:200]}"
            for t in trace[:5]
        )
    return data.get("model"), answer, thinking_str


def send(chat_id, text):
    text = text or "(rỗng)"
    # Convert markdown -> Telegram MarkdownV2 cho dễ đọc (bold/list/code/bảng→mono). Lỗi → gửi plain.
    body, parse = text, None
    if _HAS_TGMD:
        try:
            body = telegramify_markdown.markdownify(text); parse = "MarkdownV2"
        except Exception:
            body, parse = text, None
    for i in range(0, len(body), 3800):                 # Telegram giới hạn ~4096
        chunk = body[i:i + 3800]
        payload = {"chat_id": chat_id, "text": chunk}
        if parse:
            payload["parse_mode"] = parse
        try:
            r = requests.post(f"{API}/sendMessage", json=payload, timeout=30, proxies=_TG_PROXIES)
            if parse and r.status_code != 200:          # parse lỗi → gửi lại plain
                requests.post(f"{API}/sendMessage",
                              json={"chat_id": chat_id, "text": text[i:i + 3800]}, timeout=30, proxies=_TG_PROXIES)
        except Exception as e:
            print("send err:", e)


def send_id(chat_id, text):
    """Gửi message, trả message_id (để edit làm progress)."""
    try:
        r = requests.post(f"{API}/sendMessage", json={"chat_id": chat_id, "text": text}, timeout=30, proxies=_TG_PROXIES)
        return r.json().get("result", {}).get("message_id")
    except Exception:
        return None


def edit(chat_id, mid, text):
    if not mid:
        return
    try:
        requests.post(f"{API}/editMessageText",
                      json={"chat_id": chat_id, "message_id": mid, "text": text}, timeout=30, proxies=_TG_PROXIES)
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
                          files={"document": f}, timeout=90, proxies=_TG_PROXIES)
    except Exception as e:
        print("doc err:", e)


# ── B4: bridge nhận ẢNH — tải file Telegram về WORKDIR để claude Read (vision native) ──
FILE_API = f"https://api.telegram.org/file/bot{TOKEN}"

def tg_download(file_id, prefix="img"):
    """Tải file Telegram (photo/document) về WORKDIR → trả path local (claude Read xem được). None nếu lỗi.
    WORKDIR = cwd của claude → Read mở ảnh trực tiếp (Claude đọc ảnh native)."""
    try:
        r = requests.get(f"{API}/getFile", params={"file_id": file_id}, timeout=30, proxies=_TG_PROXIES)
        fp = r.json().get("result", {}).get("file_path")
        if not fp:
            return None
        ext = os.path.splitext(fp)[1] or ".jpg"
        local = os.path.join(WORKDIR, f"{prefix}-{int(time.time())}-{str(file_id)[-6:]}{ext}")
        dl = requests.get(f"{FILE_API}/{fp}", timeout=120, proxies=_TG_PROXIES)
        if dl.status_code != 200 or not dl.content:
            return None
        with open(local, "wb") as f:
            f.write(dl.content)
        return local
    except Exception as e:
        print("tg_download err:", e)
        return None


def extract_image(msg):
    """Lấy ảnh từ message Telegram → path local. Hỗ trợ photo (PhotoSize lớn nhất) + document image/*."""
    photos = msg.get("photo")
    if photos:
        return tg_download(photos[-1]["file_id"], "img")
    doc = msg.get("document")
    if doc and str(doc.get("mime_type", "")).startswith("image/"):
        return tg_download(doc["file_id"], "img")
    return None


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


# ── GD: Graceful degradation — Claude hết cửa → tụt xuống lane free TỐT NHẤT còn quota (Hermes-style) ──
# Mẫu lỗi HẾT-CỬA từ claude (usage/rate limit, 429, "extra usage", quota). Chỉ kích fallback khi claude THẬT SỰ lỗi.
_EXHAUST_RE = re.compile(r'usage.?limit|rate.?limit|\b429\b|extra usage|quota', re.I)


def pick_fallback_brain():
    """GD-1: trả KEY model lane TỐT NHẤT còn cửa (provider còn key) làm NÃO dự phòng khi Claude hết token.
    Deterministic: ưu tiên routeTable agentic-code → reasoning → router → mọi model free còn lại (thứ tự catalog).
    Đọc /llm/models (live, có providers.hasKey). Hết sạch / coordinator offline → None (không lane nào chạy được)."""
    d = _coord("/llm/models")
    catalog = d.get("catalog") or []
    if not catalog:
        return None
    have = {p.get("provider") for p in (d.get("providers") or []) if p.get("hasKey")}
    if not have:
        return None
    by_key = {m.get("key"): m for m in catalog if m.get("key")}
    rt = d.get("routeTable") or {}
    order, seen = [], set()
    cands = list(rt.get("agentic-code") or []) + list(rt.get("reasoning") or [])
    if d.get("router"):
        cands.append(d["router"])
    for k in cands:
        if k and k not in seen:
            seen.add(k); order.append(k)
    for m in catalog:                       # cuối: mọi model free còn lại theo thứ tự catalog
        k = m.get("key")
        if k and m.get("free") and k not in seen:
            seen.add(k); order.append(k)
    for k in order:
        e = by_key.get(k)
        if e and e.get("provider") in have:
            return k
    return None


def _claude_exhausted(text):
    """GD-2: nhận diện result string của claude là lỗi HẾT-CỬA (usage/rate limit, 429, quota, extra usage)."""
    return bool(text) and bool(_EXHAUST_RE.search(str(text)))


def _token_guard_hard():
    """GD-2: token-guard CHUNG (coordinator NGUỒN DUY NHẤT) đã chạm hard-limit? Lỗi/chưa cấu hình → False."""
    g = _coord("/token-guard")
    try:
        return bool(g.get("configured") and (g.get("status") or {}).get("hard"))
    except Exception:
        return False


def _run_lane_fallback(chat_id, prompt_with_mem, model_key, persona_id=None, pthink=False, reason="", mid=None):
    """GD-2: Claude hết cửa → chạy tạm bằng lane model free, kèm banner báo chủ nhân (không trả lỗi trống)."""
    banner = (f"⚠️ Claude hết token, em chạy tạm bằng `{model_key}`"
              + (f" ({reason})" if reason else "") + ".")
    if mid:
        edit(chat_id, mid, banner)
    else:
        send(chat_id, banner)
    real, answer, thinking = run_lane(prompt_with_mem, model_key, chat_id=chat_id, persona_id=persona_id)
    if pthink and thinking:
        send(chat_id, "💭 (suy nghĩ)\n" + thinking[:1500])
    episodic_log("assistant", answer, chat_id)
    reply(chat_id, answer)


# ── CM-2: rút REFS nguyên văn (KHÔNG bịa) + persist ký ức xuyên phiên ──
_REF_URL = re.compile(r'https?://[^\s)>\]"\'`]+')
# path tuyệt đối/~ : chỉ nhận nếu nằm dưới root quen thuộc → tránh bắt nhầm prose "/url/lệnh".
_REF_ABS = re.compile(r'(?:~/|/)[\w.\-/]+')
# path tương đối CÓ đuôi file (vd bridge/lucy_bridge.py) → đủ đặc trưng để không phải prose.
_REF_REL = re.compile(r'\b[\w.\-]+(?:/[\w.\-]+)+\.\w{1,8}\b')
_REF_ROOTS = ('/root', '/home', '/etc', '/usr', '/var', '/tmp', '/opt', '~/')
_REF_EXT = re.compile(r'\.\w{1,8}$')


def _extract_refs(buffer):
    """CM-2: trích REFS (link/path) NGUYÊN VĂN từ transcript THẬT — chỉ lấy cái ĐÃ xuất hiện, KHÔNG bịa.
    Chỉ quét buffer (không quét seed prose đã tóm tắt → tránh dương tính giả). Path tuyệt đối phải nằm
    dưới root quen thuộc HOẶC có đuôi file; path tương đối phải có đuôi file. Trả list {type,value} dedupe, cap 30."""
    text = "\n".join(str(m.get("text", "")) for m in (buffer or []))
    out, seen = [], set()

    def _add(t, v):
        v = v.strip().rstrip('.,);:>"\'`')
        if len(v) >= 3 and v not in seen:
            seen.add(v); out.append({"type": t, "value": v})
    for m in _REF_URL.findall(text):
        _add("link", m)
    for m in _REF_ABS.findall(text):
        if m.startswith(_REF_ROOTS) or _REF_EXT.search(m):
            _add("file", m)
    for m in _REF_REL.findall(text):
        _add("file", m)
    # bỏ ref là chuỗi con của ref khác (mảnh path bắt thừa do regex overlap) → giữ bản dài/đầy đủ nhất
    vals = [r["value"] for r in out]
    out = [r for r in out if not any(r["value"] != o and r["value"] in o for o in vals)]
    return out[:30]


def _persist_session_summary(chat_id, session_id, summary, refs, done=None):
    """CM-2: đẩy block phiên đóng về coordinator POST /session-summary → append JSONL tuyến tính Brain/episodes/sessions-<chat>.jsonl.
    Fire-and-forget, không bao giờ chặn chat. Chỉ chạy khi LUCY_SESSION_SUMMARY bật (coordinator cũng phải bật)."""
    if not SESSION_SUMMARY or not summary or not str(summary).strip():
        return
    body = {"chat_id": str(chat_id), "session_id": session_id or "",
            "summary": scrub_secrets(str(summary)), "refs": refs or [],
            "done": [scrub_secrets(str(d)) for d in (done or [])]}

    def _send():
        try:
            headers = {"x-worker-token": COORD_TOK} if COORD_TOK else {}
            requests.post(f"{COORD_URL}/session-summary", json=body, headers=headers, timeout=8)
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


def _parse_summary_json(text):
    """CM-2: parse khoan dung output LLM thành (summary_prose, done_list). Lỗi/không phải JSON → coi cả text là summary."""
    s = str(text or "").strip()
    if not s:
        return "", []
    # gỡ rào ```json … ``` nếu có
    s = re.sub(r'^```(?:json)?\s*|\s*```$', '', s).strip()
    try:
        i, j = s.find("{"), s.rfind("}")
        if i != -1 and j != -1 and j > i:
            obj = json.loads(s[i:j + 1])
            summ = str(obj.get("summary") or "").strip()
            done = [str(x).strip() for x in (obj.get("done") or []) if str(x).strip()]
            if summ:
                return summ, done[:20]
    except Exception:
        pass
    return s, []   # fallback: text thô làm summary, done rỗng (không bịa)


def _summarize_transcript(buffer, seed_prev=""):
    """CC-2/CM-2: sinh (summary_prose, done_list) từ transcript buffer. Ưu tiên lane model rẻ, fallback claude (no session).
    Trả tuple: summary = ghi chú prose giữ mạch (dùng làm seed phiên mới); done = list việc đã làm (LLM rút từ transcript).
    seed_prev (CM-2 rolling): ký ức phiên TRƯỚC → gộp nối tiếp thành 1 mạch liên tục (chỉ truyền khi flag bật)."""
    convo = "\n".join(
        f"{'Chủ nhân' if m.get('role') == 'user' else 'Lucy'}: {m.get('text', '')}" for m in buffer
    )[-12000:]
    prior = ""
    if seed_prev and str(seed_prev).strip():
        prior = ("=== KÝ ỨC PHIÊN TRƯỚC (đã tóm tắt — GỘP NỐI TIẾP, đừng đánh rơi mạch cũ) ===\n"
                 + str(seed_prev)[:4000] + "\n\n")
    prompt = (
        "Tóm tắt hội thoại để Lucy giữ mạch khi mở phiên mới. CHỈ trả về MỘT object JSON, không thêm chữ nào ngoài JSON:\n"
        '{"summary": "<ghi chú prose TIẾNG VIỆT, gạch đầu dòng, ≤250 từ>", "done": ["<việc đã làm xong/đã chốt 1>", "..."]}\n'
        "- summary: nếu có 'KÝ ỨC PHIÊN TRƯỚC' thì GỘP với hội thoại hiện tại thành MỘT mạch liên tục (không lặp, không bỏ sót việc cũ còn treo); "
        "giữ chủ đề đang bàn, dữ kiện/quyết định/con số quan trọng, việc đang làm dở, sở thích/ràng buộc chủ nhân nêu. Bỏ chào hỏi rườm rà.\n"
        "- done: liệt kê NGẮN từng việc ĐÃ làm xong / đã chốt trong phiên (rút từ hội thoại THẬT, KHÔNG bịa). Không có → để [].\n\n"
        + prior + "=== HỘI THOẠI HIỆN TẠI ===\n" + convo
    )
    fb = pick_fallback_brain()        # ưu tiên lane model rẻ còn cửa
    if fb:
        try:
            _real, ans, _think = run_lane(prompt, fb)
            if ans and not str(ans).startswith("❌"):
                return _parse_summary_json(ans)
        except Exception:
            pass
    try:                              # fallback: claude no-session (KHÔNG resume)
        _sid, ans = run_claude(prompt, None, model="sonnet")
        return _parse_summary_json(ans or "")
    except Exception:
        return "", []


def _compress_conversation(chat_id, sessions):
    """CC-2 auto-rollover: tóm tắt buffer → BỎ session cũ (lần sau claude tự sinh session_id mới) →
    seed summary chờ prepend vào prompt đầu phiên mới → reset counter+buffer → báo chủ nhân nhẹ."""
    h = _load_claude_hist()
    e = h.get(str(chat_id))
    if not e or not e.get("buffer"):
        return
    buf = e.get("buffer", [])
    seed_old = e.get("seed", "") if SESSION_SUMMARY else ""   # CM-2 #3: rolling — gộp seed phiên trước
    old_sid = sessions.get(str(chat_id), "")                  # giữ session_id TRƯỚC khi pop để persist
    summary, done = _summarize_transcript(buf, seed_prev=seed_old)
    # CM-2 #1: append block phiên vào JSONL tuyến tính Brain/episodes/ (no-op khi flag off)
    _persist_session_summary(chat_id, old_sid, summary, _extract_refs(buf), done)
    # BỎ --resume cũ → lần claude kế tiếp KHÔNG resume → claude tự sinh session_id mới
    sessions.pop(str(chat_id), None); _save(sessions)
    # reset buffer + counter, giữ summary làm seed cho prompt đầu phiên mới
    h[str(chat_id)] = {"buffer": [], "turns": 0, "tokens": 0, "seed": summary or ""}
    _save_claude_hist(h)
    send(chat_id, "🗜️ em gói gọn lại hội thoại, vẫn nhớ mạch nhé.")


def _run_claude_spawn(prompt, session_id, model="sonnet", persona_text=None, thinking_sink=None):
    """[FALLBACK spawn] Chạy claude -p, trả (session_id_mới, text). model: sonnet (nhanh, mặc định) | opus (sâu, chậm).
    persona_text: nếu set → overlay persona (Lucy base + role) qua file tạm (Đợt A /persona).
    thinking_sink: list (optional) — nếu truyền → dùng stream-json, gom block 'thinking' vào đây (A4)."""
    want_thinking = thinking_sink is not None
    out_fmt = "stream-json" if want_thinking else "json"
    cmd = [CLAUDE, "-p", prompt, "--output-format", out_fmt,
           "--permission-mode", "bypassPermissions", "--model", model]
    if want_thinking:
        cmd += ["--verbose"]   # stream-json cần verbose để phát đủ event assistant/result
    persona_file = PERSONA
    if persona_text:
        base = ""
        try:
            base = open(PERSONA).read() if os.path.exists(PERSONA) else ""
        except Exception:
            base = ""
        persona_file = os.path.join(WORKDIR, f".persona-overlay-{os.getpid()}.md")
        try:
            with open(persona_file, "w", encoding="utf-8") as f:
                f.write(base + "\n\n--- VAI HIỆN TẠI (persona overlay) ---\n" + persona_text)
        except Exception:
            persona_file = PERSONA
    if os.path.exists(persona_file):
        cmd += ["--append-system-prompt-file", persona_file]
    if os.path.isdir(VAULT):
        cmd += ["--add-dir", VAULT]    # não vault luôn trong tầm mắt (persona dạy ghi vào đâu)
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
    global LAST_MODEL
    if want_thinking:
        # stream-json = NDJSON: gom block 'thinking' (event assistant) + lấy event 'result' cuối.
        sid, result = None, None
        for line in (r.stdout or "").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            t = d.get("type")
            if t == "assistant":
                for b in (d.get("message", {}).get("content") or []):
                    if b.get("type") == "thinking" and b.get("thinking"):
                        thinking_sink.append(b["thinking"])
            elif t == "result":
                sid = d.get("session_id")
                result = d.get("result")
                LAST_MODEL = next(iter(d.get("modelUsage") or {}), None) or LAST_MODEL
                report_tokens(d.get("usage"), d.get("total_cost_usd"))   # PT
        if result is not None:
            return sid, (result or "(rỗng)")
        return None, (r.stdout or "(không parse được stream)")[:3500]
    try:
        data = json.loads(r.stdout)
        LAST_MODEL = next(iter(data.get("modelUsage") or {}), None) or LAST_MODEL
        report_tokens(data.get("usage"), data.get("total_cost_usd"))   # PT
        return data.get("session_id"), (data.get("result") or "(rỗng)")
    except Exception:
        return None, (r.stdout or "(không parse được output)")[:3500]


def _persona_file(persona_text):
    """File persona dùng cho --append-system-prompt-file. persona_text set → overlay Lucy base + vai; else file mặc định."""
    if not persona_text:
        return PERSONA
    base = ""
    try:
        base = open(PERSONA).read() if os.path.exists(PERSONA) else ""
    except Exception:
        base = ""
    pf = os.path.join(WORKDIR, f".persona-overlay-{os.getpid()}.md")
    try:
        with open(pf, "w", encoding="utf-8") as f:
            f.write(base + "\n\n--- VAI HIỆN TẠI (persona overlay) ---\n" + persona_text)
        return pf
    except Exception:
        return PERSONA


def _run_claude_stream_spawn(prompt, session_id, model, persona_text, on_delta):
    """[FALLBACK spawn] claude -p stream-json partial → gọi on_delta(answer_tích_luỹ) khi có chữ mới.
    Dùng subscription (claude CLI auth OAuth). Trả (session_id_mới, answer, thinking_list)."""
    cmd = [CLAUDE, "-p", prompt, "--output-format", "stream-json",
           "--include-partial-messages", "--verbose",
           "--permission-mode", "bypassPermissions", "--model", model]
    pf = _persona_file(persona_text)
    if os.path.exists(pf):
        cmd += ["--append-system-prompt-file", pf]
    if os.path.isdir(VAULT):
        cmd += ["--add-dir", VAULT]
    if session_id:
        cmd += ["--resume", session_id]
    env = {**os.environ, "IS_SANDBOX": "1"}
    answer, thinking = [], []
    sid, final_result = None, None
    global LAST_MODEL
    try:
        proc = subprocess.Popen(cmd, cwd=WORKDIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                stdin=subprocess.DEVNULL, env=env, text=True, bufsize=1)
    except Exception as e:
        return None, f"❌ Không chạy được claude: {e}", []
    try:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            t = d.get("type")
            if t == "stream_event":
                ev = d.get("event", {})
                if ev.get("type") == "content_block_delta":
                    delta = ev.get("delta", {})
                    dt = delta.get("type")
                    if dt == "text_delta":
                        answer.append(delta.get("text", ""))
                        try:
                            on_delta("".join(answer))
                        except Exception:
                            pass
                    elif dt == "thinking_delta":
                        thinking.append(delta.get("thinking", ""))
            elif t == "result":
                sid = d.get("session_id")
                final_result = d.get("result")
                LAST_MODEL = next(iter(d.get("modelUsage") or {}), None) or LAST_MODEL
                report_tokens(d.get("usage"), d.get("total_cost_usd"))   # PT
        proc.wait(timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        proc.kill()
        return sid, ("".join(answer) or "⏱️ Claude chạy quá lâu (timeout)."), thinking
    except Exception as e:
        return sid, ("".join(answer) or f"❌ Lỗi stream: {e}"), thinking
    return sid, (final_result or "".join(answer) or "(rỗng)"), thinking


# ── Đường B (Claude Agent SDK in-process) ──────────────────────────────────────────
def _persona_append(persona_text):
    """Chuỗi append vào system prompt claude_code preset = đúng hành vi --append-system-prompt-file cũ."""
    base = ""
    try:
        base = open(PERSONA).read() if os.path.exists(PERSONA) else ""
    except Exception:
        base = ""
    if persona_text:
        return base + "\n\n--- VAI HIỆN TẠI (persona overlay) ---\n" + persona_text
    return base

def _sdk_opts(model, session_id, persona_text, partial):
    return _SdkOpts(
        model=model, permission_mode="bypassPermissions", cwd=WORKDIR,
        system_prompt={"type": "preset", "preset": "claude_code", "append": _persona_append(persona_text)},
        add_dirs=[VAULT] if os.path.isdir(VAULT) else [],
        env={**os.environ, "IS_SANDBOX": "1"},
        resume=session_id or None,
        include_partial_messages=partial,
    )

def _run_claude_sdk(prompt, session_id, model="sonnet", persona_text=None, thinking_sink=None):
    """SDK: trả (sid, text). thinking_sink (list) → gom ThinkingBlock từ AssistantMessage (A4)."""
    global LAST_MODEL
    async def go():
        sid = None; result = None
        async for m in _sdk_query(prompt=prompt, options=_sdk_opts(model, session_id, persona_text, False)):
            cn = type(m).__name__
            if cn == "AssistantMessage" and thinking_sink is not None:
                for b in (m.content or []):
                    if type(b).__name__ == "ThinkingBlock" and getattr(b, "thinking", None):
                        thinking_sink.append(b.thinking)
            elif cn == "ResultMessage":
                sid = m.session_id; result = m.result
                mu = getattr(m, "model_usage", None)
                if mu:
                    try: globals().__setitem__("LAST_MODEL", next(iter(mu), None) or LAST_MODEL)
                    except Exception: pass
                report_tokens(_sdk_usage(m), getattr(m, "total_cost_usd", 0) or 0)   # PT
        return sid, (result or "(rỗng)")
    try:
        return asyncio.run(asyncio.wait_for(go(), TIMEOUT))
    except asyncio.TimeoutError:
        return None, "⏱️ Claude chạy quá lâu (timeout). Thử chia nhỏ task ạ."
    except Exception as e:
        return None, f"❌ Claude lỗi (SDK): {str(e)[:600]}"

def _run_claude_stream_sdk(prompt, session_id, model, persona_text, on_delta):
    """SDK Đường A: stream text delta qua on_delta(answer_tích_luỹ). Trả (sid, answer, thinking_list)."""
    global LAST_MODEL
    async def go():
        answer = []; thinking = []; sid = None; final_result = None
        async for m in _sdk_query(prompt=prompt, options=_sdk_opts(model, session_id, persona_text, True)):
            cn = type(m).__name__
            if cn == "StreamEvent":
                ev = m.event or {}
                if ev.get("type") == "content_block_delta":
                    d = ev.get("delta", {})
                    if d.get("type") == "text_delta":
                        answer.append(d.get("text", ""))
                        try: on_delta("".join(answer))
                        except Exception: pass
                    elif d.get("type") == "thinking_delta":
                        thinking.append(d.get("thinking", ""))
            elif cn == "ResultMessage":
                sid = m.session_id; final_result = m.result
                mu = getattr(m, "model_usage", None)
                if mu:
                    try: globals().__setitem__("LAST_MODEL", next(iter(mu), None) or LAST_MODEL)
                    except Exception: pass
                report_tokens(_sdk_usage(m), getattr(m, "total_cost_usd", 0) or 0)   # PT
        return sid, (final_result or "".join(answer) or "(rỗng)"), thinking
    try:
        return asyncio.run(asyncio.wait_for(go(), TIMEOUT))
    except asyncio.TimeoutError:
        return None, "⏱️ Claude chạy quá lâu (timeout).", []
    except Exception as e:
        return None, ("❌ Lỗi stream (SDK): " + str(e)[:300]), []

# ── Dispatcher: chọn engine. Mặc định SDK; LUCY_BRIDGE_ENGINE=spawn → fallback claude -p (rollback tức thì). ──
_ENGINE = os.environ.get("LUCY_BRIDGE_ENGINE", "sdk").lower()
_USE_SDK = _HAS_SDK and _ENGINE != "spawn"

def run_claude(prompt, session_id, model="sonnet", persona_text=None, thinking_sink=None):
    if _USE_SDK:
        return _run_claude_sdk(prompt, session_id, model, persona_text, thinking_sink)
    return _run_claude_spawn(prompt, session_id, model, persona_text, thinking_sink)

def run_claude_stream(prompt, session_id, model, persona_text, on_delta):
    if _USE_SDK:
        return _run_claude_stream_sdk(prompt, session_id, model, persona_text, on_delta)
    return _run_claude_stream_spawn(prompt, session_id, model, persona_text, on_delta)


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


def _parse_json_list(raw):
    """Rút JSON array các subtask từ output claude (có thể kèm ```json hay text)."""
    if not raw:
        return []
    m = re.search(r"\[.*\]", raw, re.S)
    if not m:
        return []
    try:
        arr = json.loads(m.group(0))
        return [str(x).strip() for x in arr if str(x).strip()][:6]
    except Exception:
        return []


def orch_run(chat_id, goal, model="sonnet"):
    """Orchestrator HIỆN RÕ: plan (1 agent) -> sub-agent SONG SONG -> synthesis (1 agent)."""
    mid = send_id(chat_id, "🧠 Orchestrator: đang lập kế hoạch…")
    stop = threading.Event()
    threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, "orch"), daemon=True).start()
    try:
        # 1) PLAN — chia subtask độc lập
        plan_prompt = (f"Mục tiêu: {goal}\n\nChia thành 2-5 subtask ĐỘC LẬP (chạy song song được). "
                       "CHỈ trả về JSON array các chuỗi subtask, KHÔNG giải thích. "
                       'Vd: ["phân tích BTC","phân tích ETH","check vàng"]')
        _, plan_raw = run_claude(plan_prompt, None, "sonnet")
        subtasks = _parse_json_list(plan_raw)
        if not subtasks:
            stop.set(); edit(chat_id, mid, "⚠️ Không lập được plan → chạy thẳng goal.")
            _, r = run_claude(goal, None, model); reply(chat_id, r); return
        send(chat_id, "📋 Plan:\n" + "\n".join(f"  {i+1}. {t}" for i, t in enumerate(subtasks)))

        # 2) SUB-AGENT song song
        send(chat_id, f"🔧 {len(subtasks)} sub-agent chạy song song…")
        done = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(subtasks))) as ex:
            futs = {ex.submit(_fan_lane, t, model): (i, t) for i, t in enumerate(subtasks)}
            for fut in concurrent.futures.as_completed(futs):
                i, t = futs[fut]; done[i] = (t, fut.result())
        results = [done[i] for i in sorted(done)]

        # 3) SYNTHESIS — gộp thành báo cáo hoàn chỉnh
        combined = "\n\n".join(f"### Subtask {i+1}: {t}\n{r}" for i, (t, r) in enumerate(results))
        synth_prompt = (f"Mục tiêu gốc: {goal}\n\nKết quả các sub-agent:\n{combined}\n\n"
                        "Tổng hợp thành 1 báo cáo HOÀN CHỈNH, gọn rõ, cho mục tiêu trên.")
        _, final = run_claude(synth_prompt, None, model)
        stop.set(); edit(chat_id, mid, f"✅ Orchestrator xong ({len(subtasks)} sub-agent).")
        reply(chat_id, "🧩 TỔNG HỢP:\n\n" + final)
    finally:
        stop.set()


def handle(msg, sessions):
    chat_id = msg["chat"]["id"]
    uid = str(msg.get("from", {}).get("id", ""))
    text = (msg.get("text") or "").strip()
    if ALLOWED and uid != ALLOWED:
        send(chat_id, "⛔ Không có quyền.")
        return
    # ── B4: ẢNH → tải về WORKDIR, ép claude-path (vision), bake hướng dẫn Read vào prompt ──
    image_path = None
    doc_path = None
    if msg.get("photo") or msg.get("document"):
        if msg.get("photo") or str(msg.get("document", {}).get("mime_type", "")).startswith("image/"):
            mid_dl = send_id(chat_id, "🖼️ Em đang tải ảnh xuống ạ…")
            image_path = extract_image(msg)
            if not image_path:
                edit(chat_id, mid_dl, "❌ Không tải được ảnh (Telegram getFile lỗi). Thử gửi lại giúp em ạ.")
                return
            edit(chat_id, mid_dl, "🖼️ Có ảnh rồi — em xem nhé…")
            cap = (msg.get("caption") or "").strip()
            text = ((cap + "\n\n") if cap else "") + \
                f"[Chủ nhân vừa gửi 1 ẢNH. Dùng Read tool mở file ảnh này để xem rồi trả lời: {image_path}]"
        else:
            # ── B5: DOCUMENT (không phải ảnh) → tải về WORKDIR, ép claude-path, bake hướng dẫn đọc theo loại ──
            doc = msg.get("document", {})
            fname = (doc.get("file_name") or "").strip()
            mid_dl = send_id(chat_id, f"📎 Em đang tải file <{fname or 'document'}> xuống ạ…")
            doc_path = tg_download(doc.get("file_id"), "doc")
            if not doc_path:
                edit(chat_id, mid_dl, "❌ Không tải được file (Telegram getFile lỗi). Thử gửi lại giúp em ạ.")
                return
            edit(chat_id, mid_dl, f"📎 Có file <{fname or os.path.basename(doc_path)}> rồi — em mở xem nhé…")
            cap = (msg.get("caption") or "").strip()
            text = ((cap + "\n\n") if cap else "") + (
                f"[Chủ nhân vừa gửi FILE: «{fname or os.path.basename(doc_path)}» lưu tại: {doc_path}\n"
                "Hãy MỞ và xử lý theo loại file (dùng tool, KHÔNG bịa nội dung):\n"
                "• .txt/.md/.csv/.json/.log → Read trực tiếp.\n"
                "• .pdf → Read trực tiếp (Read xem được cả chữ lẫn ẢNH trong từng trang).\n"
                "• .xlsx/.xls → Bash chạy python `openpyxl` (load_workbook, duyệt sheet→rows) để đọc dữ liệu.\n"
                "• .docx → Bash chạy python `docx` (Document(path), duyệt paragraphs+tables) để lấy text.\n"
                "• Nếu PDF/DOCX có ẢNH nhúng và chủ nhân hỏi về ảnh → giải nén/trích ảnh ra file rồi Read ảnh đó.\n"
                "Đọc xong, trả lời đúng yêu cầu của chủ nhân (nếu chỉ gửi file không kèm câu hỏi → tóm tắt nội dung gọn).]"
            )
    if not text:
        return
    if text == "/new":
        # CM-2 #2: TRƯỚC khi xoá → gộp (seed_cũ ⊕ buffer) thành 1 ký ức + persist note (no-op khi flag off → xoá thẳng như cũ).
        if SESSION_SUMMARY:
            _e = _load_claude_hist().get(str(chat_id))
            if _e and _e.get("buffer"):
                _buf = _e.get("buffer", [])
                _summary, _done = _summarize_transcript(_buf, seed_prev=_e.get("seed", ""))
                _persist_session_summary(chat_id, sessions.get(str(chat_id), ""), _summary, _extract_refs(_buf), _done)
        sessions.pop(str(chat_id), None); _save(sessions)
        _clear_lane_hist(chat_id)
        _clear_claude_hist(chat_id)   # CC: xoá luôn buffer + counter + seed claude-path
        send(chat_id, "✨ Phiên mới — em quên ngữ cảnh cũ ạ.")
        return
    if text == "/id":
        send(chat_id, f"chat_id={chat_id} · user_id={uid}")
        return
    if text == "/info":
        sid = sessions.get(str(chat_id))
        _pf = _load_prefs().get(str(chat_id), {})
        send(chat_id,
             "🔎 Lucy đang chạy bằng gì:\n"
             "• Engine: claude -p (Claude Code CLI) — TRỰC TIẾP, KHÔNG qua Hermes\n"
             f"• Chat model (pref): {_pf.get('model', 'claude:sonnet')} · persona: {_pf.get('persona') or 'Lucy'} · think: {'on' if _pf.get('think') else 'off'}\n"
             f"• Model: {LAST_MODEL or 'chưa rõ (gửi 1 tin trước đã)'}\n"
             f"• claude CLI: {CLAUDE_VER}\n"
             "• Quyền: bypassPermissions (em tự chạy tool: Read/Write/Bash/Web…)\n"
             f"• Khóa chủ nhân: uid={ALLOWED or '(mở!)'}\n"
             f"• Workdir: {WORKDIR}\n"
             f"• Persona: {'có' if os.path.exists(PERSONA) else 'KHÔNG'} ({PERSONA})\n"
             f"• Timeout: {TIMEOUT}s\n"
             f"• Phiên hiện tại: {sid or 'mới (chưa có)'}")
        return
    if text in ("/token", "/tokens"):
        d = _load_tg_tokens()
        lines = [f"📊 Token hôm nay ({d['date']} UTC):",
                 f"• Telegram (claude-path): vào {d['inTok']:,} · ra {d['outTok']:,} · "
                 f"~${d['costUsd']:.4f} · {d['turns']} lượt"]
        g = _coord("/token-guard")
        if not g.get("error") and g.get("configured") and g.get("status"):
            s = g["status"]
            lines.append(f"• Token-guard CHUNG (hub+telegram+autopilot): dùng {s.get('used', 0):,}"
                         f"/{s.get('hardLimit', 0):,} (soft {s.get('softLimit', 0):,})"
                         + (" ⚠️HARD" if s.get('hard') else " ⚠️soft" if s.get('soft') else ""))
        elif g.get("error"):
            lines.append("• Token-guard chung: coordinator chưa sẵn")
        else:
            lines.append("• Token-guard chung: chưa cấu hình (đặt AM_DAY_TOKEN_SOFT/HARD)")
        send(chat_id, "\n".join(lines))
        return
    # ── B3: /prompt <ngữ cảnh> — Prompt Architect (coordinator) tinh prompt tối ưu, trả về để copy ──
    if text.startswith("/prompt"):
        ctx = text[len("/prompt"):].strip()
        # Cú pháp tùy chọn: "/prompt for=claude <ngữ cảnh>" → chỉ định model đích.
        target = None
        if ctx.startswith("for=") or ctx.startswith("target="):
            head, _, rest = ctx.partition(" ")
            target = head.split("=", 1)[1].strip() or None
            ctx = rest.strip()
        if not ctx:
            send(chat_id, "🧱 Cú pháp: `/prompt <việc bạn muốn làm>` — em tinh thành prompt tối ưu.\n"
                          "Vd: `/prompt viết email xin nghỉ phép lịch sự`\n"
                          "Chỉ định model đích: `/prompt for=claude <ngữ cảnh>`")
            return
        mid = send_id(chat_id, "🧱 Em đang tinh prompt ạ…")
        body = {"context": ctx, "chatId": str(chat_id)}
        if target:
            body["targetModel"] = target
        d = _coord("/prompt-architect", body)
        if d.get("off"):
            edit(chat_id, mid, "⚠️ Prompt Architect đang TẮT (cần đặt LUCY_PROMPT_ARCHITECT=1 ở coordinator).")
            return
        if d.get("error"):
            edit(chat_id, mid, f"❌ Lỗi: {d['error']}")
            return
        fp = (d.get("finalPrompt") or "").strip()
        ans = (d.get("answer") or "").strip()
        if d.get("clarifying") or not fp:
            # Đang hỏi làm-rõ (ngữ cảnh mơ hồ) → trả nguyên câu hỏi của architect.
            edit(chat_id, mid, "🧱 Cần làm rõ:")
            reply(chat_id, ans or "(architect không trả lời)")
            return
        sc = d.get("scorecard") or {}
        score = f" · điểm {sc.get('total')}/100" if sc.get("total") is not None else ""
        edit(chat_id, mid, f"🧱 Prompt tối ưu ({d.get('laneModel','?')}{score}) — copy ở dưới ạ:")
        reply(chat_id, fp)
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
    if text.startswith("/orch"):
        goal = text[5:].strip()
        if not goal:
            send(chat_id, "Cú pháp: /orch <mục tiêu>. Em: lập plan → nhiều sub-agent song song → tổng hợp. (thêm 'opus' đầu goal cho việc khó)")
            return
        m = "opus" if "opus" in goal.lower()[:12] else "sonnet"
        threading.Thread(target=orch_run, args=(chat_id, goal, m), daemon=True).start()
        return

    # ── Đợt A: /model — đổi model chat (claude:sonnet|claude:opus | <lane-key> | auto) ──
    prefs = _load_prefs()
    cur = prefs.get(str(chat_id), {})
    if text.startswith("/model"):
        arg = text[6:].strip()
        if not arg:
            keys = _catalog_keys()
            now = cur.get("model", "claude:sonnet")
            send(chat_id,
                 f"🧬 Model hiện tại: *{now}*\n\nĐổi: `/model <key>`\n"
                 "• `claude:sonnet` / `claude:opus` — não thật (tool+vault), mặc định\n"
                 "• `auto` — smart-router tự chọn model theo task\n"
                 "• lane (có tool web+file+bash + history, đổi model = reset context): " + (", ".join(keys) if keys else "(coordinator chưa sẵn)"))
            return
        if arg not in (["auto", "claude:sonnet", "claude:opus", "sonnet", "opus"] + _catalog_keys()):
            send(chat_id, f"❌ Key lạ: `{arg}`. Gõ `/model` để xem danh sách.")
            return
        if arg in ("sonnet", "opus"):
            arg = "claude:" + arg
        cur["model"] = arg
        prefs[str(chat_id)] = cur; _save_prefs(prefs)
        note = "có tool+vault (não thật)" if arg.startswith("claude") else ("smart-router chọn" if arg == "auto" else "chat thuần, KHÔNG sửa file/đọc vault")
        send(chat_id, f"✅ Đã đổi model → *{arg}* ({note}).")
        return
    # ── Đợt A: /persona — đổi vai ──
    if text.startswith("/persona"):
        arg = text[8:].strip()
        if not arg:
            now = cur.get("persona") or "(Lucy mặc định)"
            send(chat_id, f"🎭 Persona hiện tại: *{now}*\nĐổi: `/persona <id>` · bỏ: `/persona default`\nCó: " + ", ".join(list_personas()))
            return
        if arg in ("default", "lucy", "none"):
            cur.pop("persona", None); prefs[str(chat_id)] = cur; _save_prefs(prefs)
            send(chat_id, "✅ Về persona Lucy mặc định.")
            return
        if arg not in list_personas():
            send(chat_id, f"❌ Không có persona `{arg}`. Có: " + ", ".join(list_personas()))
            return
        cur["persona"] = arg; prefs[str(chat_id)] = cur; _save_prefs(prefs)
        send(chat_id, f"✅ Đổi vai → *{arg}* (overlay lên Lucy).")
        return
    # ── Đợt A: /think on|off — hiện block suy nghĩ (lane model có reasoning) ──
    if text.startswith("/think"):
        arg = text[6:].strip().lower()
        if arg in ("on", "1", "bật"):
            cur["think"] = True
        elif arg in ("off", "0", "tắt"):
            cur["think"] = False
        else:
            send(chat_id, f"💭 Hiện thinking: {'BẬT' if cur.get('think') else 'tắt'}. Gõ `/think on` hoặc `/think off`.")
            return
        prefs[str(chat_id)] = cur; _save_prefs(prefs)
        send(chat_id, f"✅ Thinking → {'BẬT' if cur['think'] else 'tắt'}.")
        return

    pmodel = cur.get("model", "claude:sonnet")          # mặc định = não thật, sonnet
    ppersona = cur.get("persona")
    pthink = bool(cur.get("think"))
    low = text.lower()
    force_opus = False
    if low.startswith("!o ") or low.startswith("!opus "):
        force_opus = True                                # ép Opus 1 lượt (đè pref)
        text = text.split(" ", 1)[1].strip() if " " in text else ""
    if not text:
        return
    # ── B4/B5: ảnh + file cần não thật (Read vision / tool đọc file) — lane free không làm được → ép claude ──
    if (image_path or doc_path) and not pmodel.startswith("claude"):
        pmodel = "claude:sonnet"

    # PHASE 0: tra memory liên quan 1 lần → chèn vào prompt của đường được chọn (lane hoặc claude).
    mem = recall_prefetch(text)
    # PHASE 2: ghi turn người dùng (async, không chặn).
    episodic_log("user", text, chat_id, sessions.get(str(chat_id), ""))

    # ── Đợt A A3: auto = smart-router quyết claude(tool) vs lane(free) ──
    if pmodel == "auto" and not force_opus:
        dec = _coord("/route", {"brief": text})
        if dec.get("error") or dec.get("needsTools", True):
            why = dec.get("reason", "cần tool / router lỗi → an toàn về claude")
            send(chat_id, f"🧭 auto → claude (não thật): {why}")
            pmodel = "claude:sonnet"
        else:
            mk = dec.get("modelKey")
            send(chat_id, f"🧭 auto → lane *{mk}* ({dec.get('role')}): {dec.get('reason','')}")
            pmodel = mk

    # ── LANE-PATH: model free, có history + tool agentic (web/file/bash) ──
    if not pmodel.startswith("claude") and not force_opus:
        mid = send_id(chat_id, f"🤔 Em xử lý ạ… (lane {pmodel})")
        stop = threading.Event()
        threading.Thread(target=_heartbeat, args=(chat_id, mid, stop, pmodel), daemon=True).start()
        try:
            real, answer, thinking = run_lane(mem + text, pmodel, chat_id=chat_id, persona_id=ppersona)
        finally:
            stop.set()
        edit(chat_id, mid, f"✅ Xong (lane {real or pmodel}).")
        if pthink and thinking:
            send(chat_id, "💭 (suy nghĩ)\n" + thinking[:1500])
        episodic_log("assistant", answer, chat_id)   # PHASE 2: ghi trả lời lane
        reply(chat_id, answer)
        return

    # ── GD: token-guard CHUNG chạm hard-limit → Claude coi như hết cửa, tụt thẳng xuống lane (khỏi gọi claude phí) ──
    if _token_guard_hard():
        fb = pick_fallback_brain()
        if fb:
            _run_lane_fallback(chat_id, mem + text, fb, persona_id=ppersona, pthink=pthink,
                               reason="token-guard chạm hard-limit")
            return
        # không lane nào còn cửa → vẫn thử claude (đường thường) như cũ

    # ── CLAUDE-PATH: não thật (tool+vault) — Đường A: STREAMING (chữ chạy realtime trên Telegram) ──
    model = "opus" if force_opus else pmodel.split(":")[-1]
    mid = send_id(chat_id, f"🤔 Em xử lý ạ… ({model})")
    st = {"last": 0.0, "shown": ""}                      # throttle edit (Telegram ~1 edit/giây)
    def _on_delta(acc):
        now = time.time()
        preview = ("…" + acc[-3400:]) if len(acc) > 3400 else acc
        if now - st["last"] >= 0.9 and preview and preview != st["shown"]:
            st["last"] = now; st["shown"] = preview
            edit(chat_id, mid, preview)
    # CC-2: nếu vừa rollover, prepend seed summary vào prompt ĐẦU của session mới (giữ mạch hội thoại)
    seed = _take_claude_seed(chat_id)
    seed_prefix = ""
    if seed:
        seed_prefix = ("[NGỮ CẢNH HỘI THOẠI TRƯỚC — em đã gói gọn để khỏi tràn bộ nhớ, vẫn giữ mạch]\n"
                       + seed + "\n[HẾT NGỮ CẢNH — tiếp tục trả lời tin nhắn mới của chủ nhân bên dưới]\n\n")
    new_sid, result, thinking = run_claude_stream(
        seed_prefix + mem + text, sessions.get(str(chat_id)), model, resolve_persona_text(ppersona), _on_delta)
    if new_sid:
        sessions[str(chat_id)] = new_sid; _save(sessions)
    if pthink and thinking:
        send(chat_id, "💭 (suy nghĩ)\n" + ("".join(thinking))[:1500])
    # Chốt: bảng / CỰC dài (>7600) → file đẹp. Còn lại (kể cả vừa-dài) → hiện THẲNG trong chat, chia nhiều tin,
    # KHÔNG cắt cụt (trước đây >1600 đã quăng file + teaser 600 → người dùng tưởng "cụt").
    res = result or "(rỗng)"
    # ── GD: claude trả lỗi HẾT-CỬA (usage/rate-limit/429/quota) → tụt xuống lane free + banner, không trả lỗi trống ──
    if not new_sid and _claude_exhausted(res):
        fb = pick_fallback_brain()
        if fb:
            _run_lane_fallback(chat_id, mem + text, fb, persona_id=ppersona, pthink=pthink,
                               reason="Claude báo hết token/usage-limit", mid=mid)
            return
        # hết sạch lane còn cửa → để nguyên lỗi claude hiển thị (đường thường)
    episodic_log("assistant", res, chat_id, sessions.get(str(chat_id), ""))   # PHASE 2: ghi trả lời claude
    if res.count("|") >= 6 or res.count("\n#") >= 2 or len(res) > 7600:
        edit(chat_id, mid, f"✅ Xong ({model}) — nội dung dài/bảng, em gửi file ạ.")
        reply(chat_id, res)
    else:
        edit(chat_id, mid, res[:3900])
        if len(res) > 3900:
            send(chat_id, res[3900:])   # phần dư → send() tự chunk 3800/tin, đọc đủ trong chat

    # ── CC: theo dõi kích thước hội thoại claude-path + auto-rollover khi quá dài ──
    if new_sid:   # chỉ tính lượt claude THÀNH CÔNG (lỗi/fallback đã return sớm)
        claude_hist_append(chat_id, text, res, tokens=LAST_TURN_TOK)
        if AUTO_COMPRESS and should_compress(chat_id):
            _compress_conversation(chat_id, sessions)


import queue as _queue
# ── STOP + chống spam-queue (2026-06-16): poll KHÔNG block (worker/chat) → /stop nghe tức thì + xoá hàng đợi ──
CHAT_Q = {}   # chat_id -> queue.Queue các tin chờ xử lý (FIFO, không mất tin)
STOP_WORDS = {"/stop", "stop", "/dung", "/dừng", "dừng", "dung",
              "/huy", "/huỷ", "huỷ", "huy", "/cancel", "/ngung", "/ngừng"}
RESTART_WORDS = {"/restart", "restart", "/reload", "/khoidong", "khởi động lại"}

def _worker(chat_id, sessions):
    q = CHAT_Q[chat_id]
    while True:
        msg = q.get()
        try:
            if msg is not None:
                handle(msg, sessions)
        except Exception as e:
            print("handle err:", e)
        finally:
            q.task_done()

def _clear_queue(chat_id):
    q = CHAT_Q.get(chat_id)
    n = 0
    if q:
        try:
            while True:
                q.get_nowait(); q.task_done(); n += 1
        except _queue.Empty:
            pass
    return n

def main():
    sessions = _load()
    offset = _load_offset()   # khôi phục offset → KHÔNG xử lại backlog cũ sau restart (tránh loop /restart)
    print("Lucy bridge online (Telegram <-> claude · poll non-block + /stop).")
    while True:
        try:
            r = requests.get(f"{API}/getUpdates",
                             params={"timeout": 50, "offset": offset}, timeout=60, proxies=_TG_PROXIES)
            for upd in r.json().get("result", []):
                offset = upd["update_id"] + 1
                _save_offset(offset)   # xác nhận đã nuốt update này → restart KHÔNG xử lại (chống loop /restart)
                if "message" not in upd:
                    continue
                m = upd["message"]
                cid = m["chat"]["id"]
                uid = str(m.get("from", {}).get("id", ""))
                txt = (m.get("text") or "").strip().lower()
                # /stop: bắt NGAY trong poll (không qua queue) → xoá việc đang chờ
                if txt in STOP_WORDS and (not ALLOWED or uid == ALLOWED):
                    n = _clear_queue(cid)
                    send(cid, f"🛑 Đã dừng — xoá {n} việc đang chờ."
                              + ("" if n else " (không có việc nào trong hàng đợi.)")
                              + " Việc đang chạy dở sẽ tự xong.")
                    continue
                # /restart: tự restart bridge qua pm2 (chỉ chủ nhân) → khỏi SSH lên VPS
                if txt in RESTART_WORDS and (not ALLOWED or uid == ALLOWED):
                    _clear_queue(cid)
                    send(cid, "♻️ Em restart lại đây… vài giây nữa quay lại ạ.")
                    try:
                        subprocess.Popen(["/usr/bin/pm2", "restart", "lucy-bridge"],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    except Exception as e:
                        send(cid, f"❌ Restart lỗi: {e}")
                    continue
                # còn lại → đẩy vào worker theo chat (poll không bị block)
                if cid not in CHAT_Q:
                    CHAT_Q[cid] = _queue.Queue()
                    threading.Thread(target=_worker, args=(cid, sessions), daemon=True).start()
                CHAT_Q[cid].put(m)
        except Exception as e:
            print("loop err:", e)
            time.sleep(3)


if __name__ == "__main__":
    main()
