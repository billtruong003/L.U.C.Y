# lucy-hub — Hermes dashboard plugin (Local Hub)

Plugin cho **Hermes web dashboard** = nền của **Local Hub** (xem [../docs/LOCAL_HUB.md](../docs/LOCAL_HUB.md)).
Drop-in, không fork, **share community được**.

## Có gì (v0)
- **Inject API** (`plugin_api.py`): app/game ngoài POST data về → hub chia theo **field**.
  - `POST /api/plugins/lucy-hub/ingest`  body `{field, type, data, source?}` → ghi `~/.hermes/lucy-hub/events/<field>.jsonl`
  - `GET  /api/plugins/lucy-hub/fields`  → list field + event gần nhất (cho UI)
  - `GET  /api/plugins/lucy-hub/fields/{field}` · `DELETE /api/plugins/lucy-hub/fields/{field}`
- **Tab "Lucy Hub"** (`dist/index.js`): poll `/fields` → render mỗi field 1 card + event live.
- **Theme `lucy-cockpit`** (`theme/`): look sci-fi neon cockpit.

## Cài (local Windows hoặc VPS)
```bash
# plugin (lưu ý subfolder dashboard/)
mkdir -p ~/.hermes/plugins/lucy-hub/dashboard/dist
cp manifest.json   ~/.hermes/plugins/lucy-hub/dashboard/
cp plugin_api.py   ~/.hermes/plugins/lucy-hub/dashboard/
cp dist/index.js   ~/.hermes/plugins/lucy-hub/dashboard/dist/
# theme
mkdir -p ~/.hermes/dashboard-themes
cp theme/lucy-cockpit.yaml ~/.hermes/dashboard-themes/
# restart dashboard (plugin API mount lúc startup)
hermes dashboard
```
(Windows: `%USERPROFILE%\.hermes\...`. Nhớ fix MIME .js nếu trang trắng — xem [../docs/DEPLOY.md](../docs/DEPLOY.md) §E.)

## Bảo mật inject API 🔴
Route plugin **bỏ qua** auth dashboard. Khi mở ra ngoài (reverse-SSH tunnel): **bắt buộc** set env
`LUCY_INGEST_KEY=<random>` → caller phải gửi header `X-Ingest-Key`. Không set = dev no-auth (chỉ localhost).

## Ví dụ app/game inject
```bash
curl -X POST http://127.0.0.1:9119/api/plugins/lucy-hub/ingest \
  -H 'content-type: application/json' -H 'x-ingest-key: <key>' \
  -d '{"field":"arena","type":"login","source":"arena-game","data":{"user":"bill","lvl":42}}'
```
→ hiện ngay trong tab Lucy Hub dưới field `arena`. Mỗi app/game = 1 field.

## Roadmap (H2/H3 — xem LOCAL_HUB)
Thêm tab: Research/Money · Delegate console · Logs · Cost · Memory · Artifacts · Brain-viz (three.js, H3).
