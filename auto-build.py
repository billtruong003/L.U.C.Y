#!/usr/bin/env python3
"""
auto-build.py — Lucy TỰ ĐỘNG BUILD theo docs/MASTER-SPEC.md, chạy NỀN (sống độc lập session).
Engine = Claude Agent SDK (claude_agent_sdk, in-process, NHẤT QUÁN với Hub/bridge/runner) — control hơn `claude -p`:
message có cấu trúc, đo cost/usage, và `can_use_tool` CHẶN lệnh nguy hiểm khi không có người.

Mỗi vòng: 1 query() làm ĐÚNG 1 task auto-able → smoke/fix/deploy → cập nhật spec → in dòng cuối
`AUTOBUILD: DONE|NEEDS_HUMAN|ALL_DONE`. Script đọc dòng đó → đi tiếp hay DỪNG + báo Telegram.

Chạy:  pm2 start /root/lucy/auto-build.py --name lucy-autobuild --interpreter python3 --no-autorestart
Dừng:  touch /root/lucy/.autobuild-stop   (êm, sau task đang chạy)  ·  hoặc  pm2 delete lucy-autobuild
Log:   /root/lucy/auto-build.log   ·  Env: AUTOBUILD_MODEL(sonnet|opus) · AUTOBUILD_MAX_ITERS(8) · AUTOBUILD_TIMEOUT(2400)
"""
import os, re, asyncio, datetime
from claude_agent_sdk import query, ClaudeAgentOptions, PermissionResultAllow, PermissionResultDeny

REPO    = "/root/lucy"
VAULT   = os.environ.get("LUCY_VAULT", "/root/lucy/lucy-vault")
PERSONA = os.environ.get("LUCY_PERSONA", "/root/lucy/bridge/persona.md")
MODEL   = os.environ.get("AUTOBUILD_MODEL", "sonnet")
MAX_ITERS = int(os.environ.get("AUTOBUILD_MAX_ITERS", "8"))
TIMEOUT = int(os.environ.get("AUTOBUILD_TIMEOUT", "2400"))   # 40 phút/task
STOP_FILE = f"{REPO}/.autobuild-stop"
LOG = f"{REPO}/auto-build.log"

def log(msg):
    line = f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f: f.write(line + "\n")
    except Exception: pass

def _read_env_file(path):
    env = {}
    try:
        with open(path) as f:
            for ln in f:
                if "=" in ln and not ln.strip().startswith("#"):
                    k, v = ln.strip().split("=", 1); env[k] = v
    except Exception: pass
    return env

def tg(text):
    try:
        env = _read_env_file(f"{REPO}/bridge/.env")
        token, chat = env.get("TELEGRAM_BOT_TOKEN"), env.get("LUCY_ALLOWED_USER_ID")
        if not token or not chat: return
        import urllib.request, urllib.parse
        data = urllib.parse.urlencode({"chat_id": chat, "text": text[:3800]}).encode()
        urllib.request.urlopen(f"https://api.telegram.org/bot{token}/sendMessage", data=data, timeout=20)
    except Exception as e:
        log(f"tg fail: {e}")

# B1 — token consolidation: cộng token mỗi query() vào token-guard CHUNG (NGUỒN DUY NHẤT ở coordinator).
# Fire-and-forget, lỗi/coordinator off → bỏ qua (KHÔNG chặn vòng build). Tắt = LUCY_TOKEN_REPORT=0.
_TOKEN_REPORT = os.environ.get("LUCY_TOKEN_REPORT", "1").strip().lower() not in ("0", "false", "off")
def _coord_creds():
    # ưu tiên env tiến trình; fallback hub/server/.env (giữ token thật 48-ký-tự, không hardcode).
    url = os.environ.get("AM_COORD_URL", "")
    tok = os.environ.get("AM_TOKEN", "")
    if not url or not tok:
        he = _read_env_file(f"{REPO}/hub/server/.env")
        url = url or he.get("AM_COORD_URL", "http://127.0.0.1:8780")
        tok = tok or he.get("AM_TOKEN", "")
    return url.rstrip("/"), tok

def report_tok(usage):
    """usage = dict kiểu Anthropic (input_tokens/output_tokens/cache_*). inTok gồm cache (parity hub/bridge)."""
    if not _TOKEN_REPORT or not isinstance(usage, dict): return
    in_tok = (int(usage.get("input_tokens", 0) or 0)
              + int(usage.get("cache_read_input_tokens", 0) or 0)
              + int(usage.get("cache_creation_input_tokens", 0) or 0))
    out_tok = int(usage.get("output_tokens", 0) or 0)
    if in_tok <= 0 and out_tok <= 0: return
    def _send():
        try:
            import urllib.request, json as _json
            url, tok = _coord_creds()
            req = urllib.request.Request(f"{url}/token-guard/add",
                data=_json.dumps({"inTok": in_tok, "outTok": out_tok}).encode(),
                headers={"content-type": "application/json", **({"x-worker-token": tok} if tok else {})})
            urllib.request.urlopen(req, timeout=4)
        except Exception: pass
    import threading
    threading.Thread(target=_send, daemon=True).start()

# can_use_tool: chặn lệnh nguy hiểm khi chạy KHÔNG NGƯỜI (defense cho unattended). Còn lại auto-allow.
DANGER = [r"rm\s+-rf\s+(/|~|\$HOME|\*)", r"\bgit\s+push", r"pm2\s+(restart|stop|delete|reload)\s+\S*bridge",
          r"\bmkfs", r"\bdd\s+if=", r":\(\)\s*\{", r">\s*/dev/sd", r"chmod\s+-R?\s*777\s+/", r"\b(shutdown|reboot|halt)\b",
          r"rm\s+-rf\s+/root/lucy\b", r"\bcurl[^|]*\|\s*(ba)?sh"]
async def can_use(tool_name, tool_input, ctx):
    try:
        if tool_name == "Bash":
            cmd = (tool_input or {}).get("command", "") or ""
            for p in DANGER:
                if re.search(p, cmd):
                    log(f"BLOCK bash: {cmd[:120]} (match {p})")
                    return PermissionResultDeny(message=f"auto-build CHẶN lệnh nguy hiểm (match {p}). Đổi cách khác.")
    except Exception: pass
    return PermissionResultAllow()

PROMPT = """Bạn là Lucy đang TỰ ĐỘNG BUILD dự án theo /root/lucy/docs/MASTER-SPEC.md (Phần V — THỨ TỰ BUILD). \
Đây là 1 VÒNG tự động do script gọi (KHÔNG có người bên cạnh).

LÀM ĐÚNG, CHỈ 1 TASK vòng này:
1. Đọc MASTER-SPEC.md Phần V → xác định TASK ⏳ TIẾP THEO chưa làm (bỏ mục ✅).
2. Nếu task đó cần QUYẾT ĐỊNH THIẾT KẾ/SẢN PHẨM (vd Jarvis UI layout/UX lớn), HOẶC đụng KHÓ ĐẢO/hệ LIVE rủi ro \
(engine bridge Telegram, xoá nhiều, radiant-bot), HOẶC cần thông tin chỉ chủ nhân biết → BỎ QUA (để dành chủ nhân), \
CHỌN task ⏳ AUTO-ABLE kế tiếp (kỹ thuật rõ ràng: L4 catalog scrape, L3 compressor, F dọn smoke/CI/tách file, follow-up đã có hướng). \
CHỈ khi KHÔNG còn task auto-able nào → dòng cuối: AUTOBUILD: NEEDS_HUMAN — <liệt kê task còn lại cần chủ nhân + lý do>
3. Nếu hết task ⏳ → dòng cuối: AUTOBUILD: ALL_DONE — <ghi chú>
4. Ngược lại IMPLEMENT đầy đủ task: đọc code liên quan, bám convention, dệt vào "MỘT Lucy". Rồi SMOKE + tsc \
(agent-machine: `npx tsc --noEmit` + smoke liên quan; hub: tsc + build). CÒN BUG → FIX tới SẠCH (không bỏ dở). \
Clean code, bỏ dup. Deploy: `pm2 restart` service liên quan (TUYỆT ĐỐI KHÔNG restart lucy-bridge). Verify live. \
Cập nhật ✅ MASTER-SPEC.md. Ghi memory nếu đáng. Dòng cuối: AUTOBUILD: DONE — <task> — <tóm tắt + đã verify gì>

QUY TẮC: chỉ 1 task/vòng. Dòng "AUTOBUILD:" là DÒNG CUỐI CÙNG. Không git push, không xoá ngoài repo, không echo secret, \
không restart lucy-bridge. Smoke fail không fix nổi → AUTOBUILD: NEEDS_HUMAN — <task> — smoke fail: <chi tiết>."""

def _sys_prompt():
    try:
        if os.path.exists(PERSONA):
            return {"type": "preset", "preset": "claude_code", "append": open(PERSONA, encoding="utf-8").read()}
    except Exception: pass
    return {"type": "preset", "preset": "claude_code"}

# GROUP MODE (AUTOBUILD_GROUP=1): làm 1 NHÓM 2-3 task ⏳ liên quan/vòng (tiết kiệm warm-up).
GROUP_PROMPT = """Bạn là Lucy đang TỰ ĐỘNG BUILD theo /root/lucy/docs/MASTER-SPEC.md (Phần V). Vòng tự động, KHÔNG có người.

LÀM 1 NHÓM 2-3 TASK ⏳ LIÊN QUAN (cùng vùng) vòng này:
1. Đọc MASTER-SPEC Phần V → chọn NHÓM task ⏳ AUTO-ABLE kế tiếp CÙNG VÙNG (vd nhóm F: F3 tách engine.ts + F4 catalog 1 nguồn + F5 e2e; hoặc nhóm BH: BH-D routing tự học + BH-B galaxy node→điểm thật + BH-G replay/explainability). BỎ QUA task cần thiết kế/Bill (N Jarvis UI, K4 persona UI, set ngưỡng watcher).
2. Implement TẤT CẢ task trong nhóm: đọc code liên quan trước, bám convention, dệt vào "MỘT Lucy".
3. SMOKE + tsc CHUNG cho cả nhóm (agent-machine: `npx tsc --noEmit` + smoke liên quan; hub: tsc + build). CÒN BUG → FIX tới SẠCH (không bỏ dở).
4. Clean code, bỏ dup. Deploy: `pm2 restart` service liên quan (TUYỆT ĐỐI KHÔNG restart lucy-bridge). Verify live. Cập nhật ✅ TỪNG task trong MASTER-SPEC.md. Ghi memory nếu đáng.
5. Dòng cuối: AUTOBUILD: DONE — <nhóm + các task đã làm> — <tóm tắt + verify gì>
   Nếu KHÔNG còn nhóm auto-able → AUTOBUILD: ALL_DONE — <ghi chú>. Nếu chỉ còn task cần Bill → AUTOBUILD: NEEDS_HUMAN — <liệt kê task còn lại + lý do>.

QUY TẮC: dòng "AUTOBUILD:" là DÒNG CUỐI CÙNG. Không git push, không xoá ngoài repo, không echo secret, không restart lucy-bridge. Smoke fail không fix nổi → AUTOBUILD: NEEDS_HUMAN — <task> — smoke fail: <chi tiết>."""

ACTIVE_PROMPT = GROUP_PROMPT if os.environ.get("AUTOBUILD_GROUP") == "1" else PROMPT
_focus = os.environ.get("AUTOBUILD_FOCUS", "").strip()
if _focus:
    ACTIVE_PROMPT += f"\n\n⭐ ƯU TIÊN ĐỢT NÀY (làm các task này trước, theo đúng thứ tự, mỗi vòng 1 nhóm): {_focus}\nNếu các task ưu tiên đã xong hết → AUTOBUILD: ALL_DONE."

async def run_iter():
    done = asyncio.Event()

    async def _stream():
        # GIỮ stream MỞ tới khi có ResultMessage. Kênh permission (can_use_tool) đi
        # CHUNG stream này — đóng sớm (yield 1 msg rồi return) → lúc agent gọi Write/Bash
        # cần round-trip permission là gãy "Error: Stream closed". done.set() ở dưới mới đóng.
        yield {"type": "user", "message": {"role": "user", "content": ACTIVE_PROMPT}}
        await done.wait()

    opts = ClaudeAgentOptions(
        model=MODEL, permission_mode="default", can_use_tool=can_use, cwd=REPO,
        system_prompt=_sys_prompt(), add_dirs=[VAULT] if os.path.isdir(VAULT) else [],
        env={**os.environ, "IS_SANDBOX": "1"},
    )
    result, cost = "", 0.0
    async for m in query(prompt=_stream(), options=opts):
        if type(m).__name__ == "ResultMessage":
            result = getattr(m, "result", "") or ""
            cost = getattr(m, "total_cost_usd", 0.0) or 0.0
            u = getattr(m, "usage", None)
            if isinstance(u, dict): report_tok(u)   # B1: token vòng build → token-guard CHUNG
            done.set()  # cho _stream() kết thúc → query đóng sạch sau ResultMessage (hết aclose-while-running)
    mm = re.findall(r"AUTOBUILD:\s*(DONE|NEEDS_HUMAN|ALL_DONE|ERROR)\s*[—-]*\s*(.*)", result)
    if not mm: return "UNKNOWN", result[-400:], cost
    return mm[-1][0], mm[-1][1].strip()[:600], cost

async def main():
    log(f"=== auto-build START · SDK · model={MODEL} · max_iters={MAX_ITERS} ===")
    tg(f"🤖 Auto-build KHỞI ĐỘNG (Agent SDK, {MODEL}, tối đa {MAX_ITERS} task). Em tự build theo MASTER-SPEC; xong/đụng việc cần chủ nhân sẽ báo.")
    total_cost = 0.0
    for i in range(1, MAX_ITERS + 1):
        if os.path.exists(STOP_FILE):
            log("STOP file → dừng."); tg("🛑 Auto-build dừng (.autobuild-stop)."); break
        log(f"--- vòng {i}/{MAX_ITERS} ---")
        try:
            status, detail, cost = await asyncio.wait_for(run_iter(), timeout=TIMEOUT)
        except asyncio.TimeoutError:
            tg(f"⚠️ Auto-build vòng {i} TIMEOUT ({TIMEOUT}s) — dừng để chủ nhân xem."); break
        except Exception as e:
            tg(f"⚠️ Auto-build vòng {i} lỗi SDK: {str(e)[:200]} — dừng."); log(f"err: {e}"); break
        total_cost += cost
        log(f"vòng {i} → {status}: {detail} (${cost:.3f})")
        if status == "DONE":
            tg(f"✅ Auto-build task {i} XONG (${cost:.2f}): {detail}"); await asyncio.sleep(5); continue
        if status == "NEEDS_HUMAN":
            tg(f"⏸️ Auto-build DỪNG — cần chủ nhân:\n{detail}\n\n(task tự động đã xong, tổng ~${total_cost:.2f}. Reply để tiếp.)"); break
        if status == "ALL_DONE":
            tg(f"🎉 Auto-build XONG HẾT task tự động (~${total_cost:.2f}): {detail}"); break
        tg(f"⚠️ Auto-build vòng {i} ({status}): {detail} — dừng để chủ nhân xem."); break
    else:
        tg(f"⏸️ Auto-build chạm trần {MAX_ITERS} task (~${total_cost:.2f}) — dừng an toàn. Reply 'chạy tiếp' để làm tiếp.")
    log(f"=== auto-build END (tổng ~${total_cost:.2f}) ===")

if __name__ == "__main__":
    asyncio.run(main())
