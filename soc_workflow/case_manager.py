import os, json, uuid
from datetime import datetime
from typing import Optional
from loguru import logger
from elasticsearch import AsyncElasticsearch, ConnectionTimeout, ConnectionError
import redis.asyncio as aioredis


class CaseManager:
    INDEX = "siem-cases"

    def __init__(self):
        self.es = AsyncElasticsearch(
            os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
            basic_auth=(
                os.getenv("ELASTICSEARCH_USER", "elastic"),
                os.getenv("ELASTICSEARCH_PASSWORD", "changeme")
            ),
            request_timeout=10,
            retry_on_timeout=True,
            max_retries=2,
            http_compress=True,
        )
        self.redis = None

    async def _get_redis(self):
        if not self.redis:
            self.redis = await aioredis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
                socket_connect_timeout=5
            )
        return self.redis

    async def create_case(self, alert: dict, analysis: dict = None) -> dict:
        case_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.utcnow().isoformat()
        case = {
            "id": case_id,
            "alert_id": alert.get("id"),
            "title": f"[{alert.get('severity', 'UNKNOWN')}] {alert.get('type', 'Alert')}",
            "status": "new",
            "severity": alert.get("severity", "MEDIUM"),
            "created_at": now,
            "updated_at": now,
            "source_ip": alert.get("source_ip"),
            "alert_type": alert.get("type"),
            "notes": [],
            "iocs": [],
            "mitre_techniques": analysis.get("mitre_techniques", []) if analysis else [],
            "ai_analysis": analysis,
            "assigned_to": "AI-SOC-Engine"
        }

        try:
            await self.es.index(index=self.INDEX, id=case_id, document=case)
            r = await self._get_redis()
            alert["case_id"] = case_id
            await r.rpush("siem:alerts:pending", json.dumps(alert))
        except (ConnectionTimeout, ConnectionError) as e:
            logger.warning(f"[CASE MGR] ES timeout on create — returning in-memory case: {e}")

        return case

    async def get_case(self, case_id: str) -> Optional[dict]:
        try:
            r = await self.es.get(index=self.INDEX, id=case_id)
            return r["_source"]
        except Exception:
            return None

    async def update_case(self, case_id: str, updates: dict) -> dict:
        updates["updated_at"] = datetime.utcnow().isoformat()
        try:
            await self.es.update(index=self.INDEX, id=case_id, doc=updates)
        except (ConnectionTimeout, ConnectionError) as e:
            logger.warning(f"[CASE MGR] ES timeout on update: {e}")
        return await self.get_case(case_id) or {}

    async def add_note(self, case_id: str, note: str, author: str = "AI-Engine") -> dict:
        case = await self.get_case(case_id)
        if not case:
            return {}
        notes = case.get("notes", [])
        entry = {"time": datetime.utcnow().isoformat(), "note": note, "author": author}
        notes.append(entry)
        await self.update_case(case_id, {"notes": notes})
        return entry

    async def close_case(self, case_id: str, reason: str, author: str = "AI-Engine") -> dict:
        return await self.update_case(case_id, {
            "status": "closed",
            "close_reason": reason,
            "closed_at": datetime.utcnow().isoformat(),
            "closed_by": author
        })

    async def list_cases(self, status: str = None, limit: int = 20) -> list:
        try:
            query = {"match_all": {}} if not status else {"match": {"status": status}}
            # Hard cap at 50 — ES pagination should be used for larger fetches
            result = await self.es.search(
                index=self.INDEX,
                query=query,
                sort=[{"created_at": {"order": "desc"}}],
                size=min(limit, 50)
            )
            return [hit["_source"] for hit in result["hits"]["hits"]]
        except (ConnectionTimeout, ConnectionError) as e:
            logger.warning(f"[CASE MGR] ES timeout listing cases: {e}")
            return []
        except Exception as e:
            logger.error(f"[CASE MGR] Error listing cases: {e}")
            return []

    async def test_connection(self) -> dict:
        try:
            info = await self.es.info()
            return {"status": "ok", "version": info["version"]["number"]}
        except Exception as e:
            return {"status": "error", "error": str(e)}
