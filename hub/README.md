# Lucy Hub — web command center (React + Vite + Tailwind / FastAPI)

Web để chủ nhân **login qua IP** → chat với Lucy (claude -p) + (sau) sections sci-fi. Standalone, KHÔNG Hermes.

```
Trình duyệt (IP) ──► FastAPI (server.py) ──► claude -p (brain) ──► trả về
                       login + job nền + poll          + serve SPA (web/dist)
Frontend: Vite+React+TS+Tailwind (web/) — dev proxy /api -> :8800
```

## Cấu trúc
```
hub/
├── server.py          # FastAPI: /login /api/me /api/send /api/poll + serve web/dist
├── requirements.txt   # fastapi, uvicorn
├── .env.example       # LUCY_HUB_PASSWORD ...
└── web/               # React app (Vite)
    ├── package.json   vite.config.ts  tailwind.config.js  index.html
    └── src/ (App, components/Login, components/Chat, api.ts)
```

## Chạy (dev — 2 cửa sổ)
```bash
# 1) backend
cd ~/lucy/hub && pip install -r requirements.txt
cp .env.example .env && nano .env          # đặt LUCY_HUB_PASSWORD
set -a; . .env; set +a
uvicorn server:app --host 0.0.0.0 --port 8800
# 2) frontend (dev, hot-reload) — máy có Node
cd ~/lucy/hub/web && npm install && npm run dev    # mở http://localhost:5173
```

## Chạy (prod — 1 process)
```bash
cd ~/lucy/hub/web && npm install && npm run build   # tạo web/dist
cd ~/lucy/hub && set -a; . .env; set +a
uvicorn server:app --host 0.0.0.0 --port 8800       # vào http://<IP>:8800
# always-on:
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8800" --name lucy-hub --cwd ~/lucy/hub
```

## 🔐 Bảo mật (đọc kỹ — hub điều khiển claude bypassPermissions)
- **Bind 0.0.0.0 = ai trong mạng cũng tới được** → cửa duy nhất là `LUCY_HUB_PASSWORD`. Đặt mật khẩu MẠNH.
- Mở ra Internet → **bắt buộc HTTPS** (nginx/caddy reverse-proxy) + cân nhắc **2FA** (roadmap H1.5: Telegram-approve).
- Cookie httponly. Token phiên trong RAM (restart = phải login lại).

## Roadmap
- **H1 (giờ):** login + chat + progress. ✅
- **H1.5:** 2FA Telegram-approve · markdown render · SSE progress (thay poll).
- **H2:** sections — Running tasks · Projects (board + source tree) · Logs/Cost · Inject-API (app/game POST).
- **H3:** brain-viz three.js (cục năng lượng + dây LLM, Iron Man).
