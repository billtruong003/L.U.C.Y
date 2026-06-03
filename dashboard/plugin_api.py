"""Lucy Hub — backend plugin (FastAPI router).

Mount tại /api/plugins/lucy-hub/ . Cung cấp INJECT API: app/game ngoài POST data về,
hub chia theo `field`. Đây là cốt lõi "inject-API" — tương lai mỗi app/game = 1 field.

Lưu ý bảo mật: route plugin BỎ QUA session-token của dashboard (vì dashboard bind localhost).
Khi mở ra ngoài qua reverse-SSH tunnel, BẮT BUỘC tự check key: set env LUCY_INGEST_KEY,
caller gửi header `X-Ingest-Key`. Không set key = chế độ dev (cho qua) + cảnh báo.
"""
import os
import json
import time
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException

router = APIRouter()

_HOME = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
_DATA = _HOME / "lucy-hub" / "events"
_DATA.mkdir(parents=True, exist_ok=True)

_INGEST_KEY = os.environ.get("LUCY_INGEST_KEY", "")
_MAX_LINE = 64 * 1024  # chặn payload khổng lồ


def _safe_field(field: str) -> str:
    s = "".join(c for c in (field or "misc") if c.isalnum() or c in "-_.")[:64]
    return s or "misc"


def _read_jsonl(fp: Path, limit: int):
    if not fp.exists():
        return 0, []
    try:
        lines = fp.read_text(encoding="utf-8").splitlines()
    except OSError:
        return 0, []
    out = []
    for ln in lines[-limit:]:
        try:
            out.append(json.loads(ln))
        except json.JSONDecodeError:
            pass
    return len(lines), list(reversed(out))


@router.post("/ingest")
async def ingest(request: Request):
    """app/game ngoài POST: {field, type, data, source?}. Chia file theo field."""
    if _INGEST_KEY and request.headers.get("x-ingest-key") != _INGEST_KEY:
        raise HTTPException(status_code=401, detail="bad or missing X-Ingest-Key")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="body phải là JSON")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="body phải là object")

    field = _safe_field(str(body.get("field", "misc")))
    event = {
        "ts": int(time.time()),
        "type": str(body.get("type", "event"))[:64],
        "source": str(body.get("source", ""))[:128],
        "data": body.get("data", {k: v for k, v in body.items()
                                   if k not in ("field", "type", "source")}),
    }
    line = json.dumps(event, ensure_ascii=False)
    if len(line) > _MAX_LINE:
        raise HTTPException(status_code=413, detail="payload quá lớn")
    with open(_DATA / f"{field}.jsonl", "a", encoding="utf-8") as f:
        f.write(line + "\n")
    return {"ok": True, "field": field, "ts": event["ts"]}


@router.get("/fields")
async def fields(limit: int = 15):
    """Liệt kê mọi field + N event gần nhất mỗi field (cho tab Fields hiển thị)."""
    out = []
    for fp in sorted(_DATA.glob("*.jsonl")):
        count, recent = _read_jsonl(fp, limit)
        out.append({"field": fp.stem, "count": count, "recent": recent})
    return {"fields": out, "auth_enabled": bool(_INGEST_KEY)}


@router.get("/fields/{field}")
async def field_events(field: str, limit: int = 100):
    fp = _DATA / f"{_safe_field(field)}.jsonl"
    count, events = _read_jsonl(fp, limit)
    return {"field": _safe_field(field), "count": count, "events": events}


@router.delete("/fields/{field}")
async def clear_field(field: str):
    fp = _DATA / f"{_safe_field(field)}.jsonl"
    if fp.exists():
        fp.unlink()
    return {"ok": True, "field": _safe_field(field)}
