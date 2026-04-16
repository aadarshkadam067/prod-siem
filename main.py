import os, json, uuid, asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# Simple in-memory alert cache to reduce ES query load
_cache = {"alerts": [], "cases": [], "last_fetch": 0}
CACHE_TTL = 10  # seconds before we re-query ES

activity_log: list = []


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = ConnectionManager()


def add_activity(event_type, message, severity="info", metadata={}):
    entry = {
        "id": f"ACT-{int(datetime.utcnow().timestamp() * 1000)}",
        "type": event_type,
        "message": message,
        "severity": severity,
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": metadata
    }
    activity_log.insert(0, entry)
    if len(activity_log) > 500:
        activity_log.pop()
    return entry


@asynccontextmanager
async def lifespan(app: FastAPI):
    import redis.asyncio as aioredis
    from elasticsearch import AsyncElasticsearch

    app.state.es = AsyncElasticsearch(
        os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
        basic_auth=(
            os.getenv("ELASTICSEARCH_USER", "elastic"),
            os.getenv("ELASTICSEARCH_PASSWORD", "changeme")
        ),
        request_timeout=8,
        retry_on_timeout=False,
        max_retries=1,
        connections_per_node=3,
    )

    try:
        app.state.redis = await aioredis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3
        )
    except Exception as e:
        logger.warning(f"Redis unavailable: {e}")
        app.state.redis = None

    # These imports are here to avoid circular import issues at module level
    from ai_engine.claude_analyst import ClaudeSOCAnalyst
    from ai_engine.action_executor import ActionExecutor
    from detection_engine.correlation import CorrelationEngine
    from soc_workflow.case_manager import CaseManager

    app.state.analyst = ClaudeSOCAnalyst()
    app.state.executor = ActionExecutor()
    app.state.correlation = CorrelationEngine()
    app.state.case_manager = CaseManager()
    logger.info("[SIEM] Backend ready")
    yield

    try:
        await app.state.es.close()
    except Exception:
        pass
    try:
        if app.state.redis:
            await app.state.redis.aclose()
    except Exception:
        pass


app = FastAPI(title="AI SOC SIEM", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class AlertIngest(BaseModel):
    source: str
    event_type: str
    severity: str = "MEDIUM"
    source_ip: Optional[str] = None
    raw_log: str
    metadata: dict = {}


class CaseNote(BaseModel):
    note: str
    author: str = "analyst"


class CaseClose(BaseModel):
    reason: str


# ── ES helpers ─────────────────────────────────────────────────────────────────

async def es_search(state, index, query, sort, size):
    """Wraps ES search with a hard timeout. Returns empty list on any failure."""
    try:
        result = await asyncio.wait_for(
            state.es.search(index=index, query=query, sort=sort, size=size),
            timeout=6.0
        )
        return [h["_source"] for h in result["hits"]["hits"]]
    except asyncio.TimeoutError:
        logger.warning(f"[ES] Search timed out on {index}")
        return []
    except Exception as e:
        logger.warning(f"[ES] Search error ({type(e).__name__}) on {index}")
        return []


async def es_count(state, index) -> int:
    try:
        r = await asyncio.wait_for(state.es.count(index=index), timeout=4.0)
        return r["count"]
    except Exception:
        return 0


async def es_index(state, index, doc_id, document) -> bool:
    try:
        await asyncio.wait_for(
            state.es.index(index=index, id=doc_id, document=document),
            timeout=5.0
        )
        return True
    except asyncio.TimeoutError:
        logger.warning(f"[ES] Index timeout — {doc_id} not persisted")
        return False
    except Exception as e:
        logger.warning(f"[ES] Index error: {type(e).__name__}")
        return False


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    es_ok = False
    redis_ok = False
    try:
        es_ok = await asyncio.wait_for(app.state.es.ping(), timeout=3.0)
    except Exception:
        pass
    try:
        if app.state.redis:
            redis_ok = await asyncio.wait_for(app.state.redis.ping(), timeout=2.0)
    except Exception:
        pass
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "elasticsearch": "ok" if es_ok else "timeout",
        "redis": "ok" if redis_ok else "error",
        "ai_engine": "ready"
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({"event": "connected"})
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"event": "ping"})
    except Exception:
        ws_manager.disconnect(websocket)


@app.post("/api/v1/alerts/ingest")
async def ingest_alert(alert_data: AlertIngest, background_tasks: BackgroundTasks):
    # TODO: add rate limiting here — high-volume sources can flood the queue
    alert = {
        "id": f"ALERT-{uuid.uuid4().hex[:8].upper()}",
        "source": alert_data.source,
        "event_type": alert_data.event_type,
        "type": alert_data.event_type,
        "severity": alert_data.severity,
        "source_ip": alert_data.source_ip,
        "raw_log": alert_data.raw_log,
        "metadata": alert_data.metadata,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "new"
    }

    background_tasks.add_task(es_index, app.state, "siem-alerts", alert["id"], alert)

    triggered = []
    try:
        triggered = app.state.correlation.ingest_event(alert)
    except Exception:
        pass

    if alert_data.severity.upper() in ("HIGH", "CRITICAL"):
        try:
            if app.state.redis:
                await asyncio.wait_for(
                    app.state.redis.rpush("siem:alerts:pending", json.dumps(alert)),
                    timeout=2.0
                )
        except Exception:
            pass

    _cache["alerts"].insert(0, alert)
    if len(_cache["alerts"]) > 200:
        _cache["alerts"].pop()

    add_activity(
        "alert_created",
        f"New {alert_data.severity} alert: {alert_data.event_type} from {alert_data.source_ip or 'unknown'}",
        alert_data.severity.lower(),
        {"alert_id": alert["id"]}
    )

    background_tasks.add_task(ws_manager.broadcast, {"event": "new_alert", "data": alert})
    return {"alert_id": alert["id"], "triggered_alerts": len(triggered), "case_ids": []}


@app.post("/api/v1/ai/analyze/{alert_id}")
async def trigger_ai_analysis(alert_id: str, background_tasks: BackgroundTasks):
    # Check cache first, fall back to ES
    alert = next((a for a in _cache["alerts"] if a["id"] == alert_id), None)
    if not alert:
        results = await es_search(
            app.state, "siem-alerts",
            {"match": {"id": alert_id}},
            [{"timestamp": {"order": "desc"}}], 1
        )
        alert = results[0] if results else None

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    background_tasks.add_task(_run_ai_pipeline, alert, app.state)
    return {"status": "queued", "alert_id": alert_id}


async def _run_ai_pipeline(alert: dict, state):
    try:
        analysis = await state.analyst.analyze_alert(alert)
        results = await state.executor.execute_all(analysis, alert)

        alert_update = {
            **alert,
            "ai_analysis": analysis,
            "execution_results": results,
            "status": results.get("case_status", "analyzed"),
            "analyzed_at": datetime.utcnow().isoformat()
        }

        for i, a in enumerate(_cache["alerts"]):
            if a["id"] == alert["id"]:
                _cache["alerts"][i] = alert_update
                break

        # Best-effort ES update — don't crash if it fails
        try:
            await asyncio.wait_for(
                state.es.update(
                    index="siem-alerts", id=alert["id"],
                    doc={
                        "ai_analysis": analysis,
                        "status": results.get("case_status", "analyzed"),
                        "analyzed_at": datetime.utcnow().isoformat()
                    }
                ),
                timeout=5.0
            )
        except Exception:
            pass

        add_activity(
            "ai_decision",
            f"AI: {analysis.get('decision', '?').upper()} — {alert['id']} "
            f"[{analysis.get('severity', '?')}] {analysis.get('confidence', 0)}% confidence",
            analysis.get("severity", "info").lower()
        )
        await ws_manager.broadcast({
            "event": "ai_decision",
            "data": {
                "alert_id": alert["id"],
                "decision": analysis.get("decision"),
                "severity": analysis.get("severity"),
                "confidence": analysis.get("confidence")
            }
        })
    except Exception as e:
        logger.error(f"[AI PIPELINE] {e}")


@app.get("/api/v1/alerts")
async def list_alerts(status: Optional[str] = None, limit: int = 100):
    now = datetime.utcnow().timestamp()

    if now - _cache["last_fetch"] > CACHE_TTL:
        es_alerts = await es_search(
            app.state, "siem-alerts",
            {"match_all": {}}, [{"timestamp": {"order": "desc"}}], 100
        )
        if es_alerts:
            _cache["last_fetch"] = now
            es_ids = {a["id"] for a in es_alerts}
            cache_only = [a for a in _cache["alerts"] if a["id"] not in es_ids]
            _cache["alerts"] = (cache_only + es_alerts)[:200]

    alerts = _cache["alerts"]
    if status:
        alerts = [a for a in alerts if a.get("status") == status]
    return {"total": len(alerts), "alerts": alerts[:limit]}


@app.get("/api/v1/cases")
async def list_cases(status: Optional[str] = None, limit: int = 100):
    try:
        cases = await app.state.case_manager.list_cases(status, limit)
        return {"cases": cases}
    except Exception as e:
        logger.warning(f"Cases fetch error: {e}")
        return {"cases": []}


@app.get("/api/v1/cases/{case_id}")
async def get_case(case_id: str):
    case = await app.state.case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.post("/api/v1/cases/{case_id}/notes")
async def add_note(case_id: str, note_data: CaseNote):
    return await app.state.case_manager.add_note(case_id, note_data.note, note_data.author)


@app.post("/api/v1/cases/{case_id}/close")
async def close_case_route(case_id: str, close_data: CaseClose):
    return await app.state.case_manager.close_case(case_id, close_data.reason)


@app.get("/api/v1/cases/{case_id}/report")
async def get_report(case_id: str):
    case = await app.state.case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    path = case.get("report_path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report not generated yet")
    return FileResponse(path, media_type="application/pdf", filename=os.path.basename(path))


@app.get("/api/v1/cases/{case_id}/iocs")
async def get_case_iocs(case_id: str):
    case = await app.state.case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    ai = case.get("ai_analysis", {})
    return {"case_id": case_id, "iocs": ai.get("iocs", {}), "enrichments": []}


@app.get("/api/v1/stats")
async def stats():
    ac = await es_count(app.state, "siem-alerts")
    cc = await es_count(app.state, "siem-cases")
    ql = 0
    try:
        if app.state.redis:
            ql = await asyncio.wait_for(
                app.state.redis.llen("siem:alerts:pending"), timeout=2.0
            )
    except Exception:
        pass
    # Fall back to cache count if ES hasn't indexed anything yet
    if ac == 0:
        ac = len(_cache["alerts"])
    return {
        "total_alerts": ac,
        "total_cases": cc,
        "pending_ai": ql,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/v1/metrics")
async def get_metrics():
    ac = await es_count(app.state, "siem-alerts")
    cc = await es_count(app.state, "siem-cases")
    return {
        "total_alerts": max(ac, len(_cache["alerts"])),
        "total_cases": cc,
        "pending_queue": 0,
        "processing": 0,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/v1/activity")
async def get_activity(limit: int = 100):
    return {"activity": activity_log[:limit], "total": len(activity_log)}


@app.get("/api/v1/system/status")
async def system_status():
    result = {"backend": {"status": "online", "online": True}}

    try:
        h = await asyncio.wait_for(app.state.es.cluster.health(), timeout=3.0)
        result["elasticsearch"] = {"status": h.get("status", "unknown"), "online": True}
    except Exception:
        result["elasticsearch"] = {"status": "timeout", "online": False}

    try:
        if app.state.redis:
            await asyncio.wait_for(app.state.redis.ping(), timeout=2.0)
            result["redis"] = {"status": "online", "online": True}
        else:
            result["redis"] = {"status": "offline", "online": False}
    except Exception:
        result["redis"] = {"status": "offline", "online": False}

    for svc, env_key, default in [
        ("thehive", "THEHIVE_URL", "http://localhost:9000"),
        ("cortex", "CORTEX_URL", "http://localhost:9001"),
    ]:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=2) as c:
                r = await c.get(f"{os.getenv(env_key, default)}/api/status")
            result[svc] = {
                "status": "online" if r.status_code == 200 else "degraded",
                "online": r.status_code == 200
            }
        except Exception:
            result[svc] = {"status": "offline", "online": False}

    result["groq"] = {"status": "online", "online": True}
    return result
