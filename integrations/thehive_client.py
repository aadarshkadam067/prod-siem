import os
import httpx
from datetime import datetime
from loguru import logger


class TheHiveClient:
    """TheHive v5 REST API client. Uses bearer token auth."""

    def __init__(self):
        self.base_url = os.getenv("THEHIVE_URL", "http://localhost:9000")
        self.api_key = os.getenv("THEHIVE_API_KEY", "")
        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def create_case(self, analysis: dict, original_alert: dict) -> dict:
        severity_map = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFORMATIONAL": 1}
        mitre_str = ", ".join(analysis.get("mitre_techniques", []))
        payload = {
            "title": f"[{analysis['severity']}] {original_alert.get('type', 'Alert')} - {original_alert.get('source_ip', 'Unknown')}",
            "description": f"AI Analysis:\n{analysis['investigation_notes']}\n\nMITRE: {mitre_str}",
            "severity": severity_map.get(analysis["severity"], 2),
            "tags": [f"severity:{analysis['severity'].lower()}", "ai-generated"],
            "status": "New",
            "startDate": int(datetime.utcnow().timestamp() * 1000),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base_url}/api/v1/case",
                json=payload,
                headers=self._headers
            )
            r.raise_for_status()
            case = r.json()
            # TheHive v5 returns _id, normalize to id for consistency
            if "_id" in case:
                case["id"] = case["_id"]
            return case

    async def add_task_log(self, case_id: str, message: str) -> dict:
        payload = {"message": message, "startDate": int(datetime.utcnow().timestamp() * 1000)}
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{self.base_url}/api/v1/case/{case_id}/log",
                json=payload,
                headers=self._headers
            )
            r.raise_for_status()
            return r.json()

    async def add_observable(self, case_id: str, ioc_type: str, value: str, tags: list, tlp: int = 2) -> dict:
        type_map = {"ip": "ip", "domain": "domain", "hash": "hash", "url": "url"}
        payload = {
            "dataType": type_map.get(ioc_type, "other"),
            "data": value,
            "tlp": tlp,
            "ioc": True,
            "tags": tags
        }
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{self.base_url}/api/v1/case/{case_id}/observable",
                json=payload,
                headers=self._headers
            )
            r.raise_for_status()
            return r.json()

    async def update_case_status(self, case_id: str, status: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.patch(
                f"{self.base_url}/api/v1/case/{case_id}",
                json={"status": status},
                headers=self._headers
            )
            r.raise_for_status()
            return r.json()

    async def close_case(self, case_id: str, reason: str) -> dict:
        payload = {
            "status": "Resolved",
            "resolutionStatus": "TruePositive",
            "summary": reason
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.patch(
                f"{self.base_url}/api/v1/case/{case_id}",
                json=payload,
                headers=self._headers
            )
            r.raise_for_status()
            return r.json()

    async def get_case(self, case_id: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base_url}/api/v1/case/{case_id}",
                headers=self._headers
            )
            r.raise_for_status()
            return r.json()
