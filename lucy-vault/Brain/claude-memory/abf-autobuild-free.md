---
name: abf-autobuild-free
description: "⭐ABF-1→ABF-8 ALL DONE 2026-06-18; /root/lucy/auto-build-free.py + pm2 lucy-autobuild-free; puppeteer=full pkg (bundled Chrome ~/.cache/puppeteer/chrome/linux-148); OPENCODE_ZEN_API_KEY đọc từ coordinator /proc (chưa trong .env); chạy: python3 auto-build-free.py --plan-only / --dry / full sprint"
metadata:
  node_type: memory
  type: project
---

`auto-build-free.py` — bộ build thứ 3, song sinh với auto-build (Sonnet) và auto-task.

**Trạng thái: ABF-1→ABF-8 TẤT CẢ XONG ✅ (2026-06-18, Sonnet, ~$2.24)**

Kiến trúc: Sonnet plan → mimo/ds-flash-free execute code nhỏ → Sonnet escalate khó → mimo vision QA (Puppeteer).

- File: `/root/lucy/auto-build-free.py`
- PM2: `lucy-autobuild-free --no-autorestart` (default args=--self-test an toàn)
- Tools: `/root/lucy/tools/puppeteer-screenshot.js` (puppeteer full pkg, bundled Chrome)
- llm-lane: `mimo-v2.5-free` + `ds-v4-flash-free` (minimax-m3-free hết free 2026-06-18)
- Vision QA: `_zen_key()` đọc OPENCODE_ZEN_API_KEY từ env→.env→coordinator /proc
- ⚠️ Cần Bill restart coordinator để catalog nạp mimo mới vào /chat-lane-agentic

Env: `AUTOBUILD_FREE_MODEL_CODE` (mimo-v2.5-free), `AUTOBUILD_FREE_QA_URL`, `AUTOBUILD_FREE_FOCUS`.

Next: YTM-1→19 (mục 18 MASTER-SPEC) — kick auto-build-free khi Bill chốt.
