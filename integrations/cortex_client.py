import os
import asyncio
import httpx
from loguru import logger

ANALYZER_MAP = {"ip": "AbuseIPDB_1_0", "domain": "URLhaus_2_0", "hash": "VirusTotal_GetReport_3_1", "url": "URLhaus_2_0"}


class CortexClient:

    def __init__(self):
        self.base_url = os.getenv("CORTEX_URL", "http://localhost:9001")
        self.api_key = os.getenv("CORTEX_API_KEY", "")
        self.headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def analyze_ioc(self, ioc_type: str, value: str) -> dict:
        analyzer = ANALYZER_MAP.get(ioc_type)
        if not analyzer:
            return {"ioc_type": ioc_type, "value": value, "error": "No analyzer"}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{self.base_url}/api/analyzer/{analyzer}/run",
                    json={"data": value, "dataType": ioc_type, "tlp": 2},
                    headers=self.headers
                )
                if r.status_code == 200:
                    job = r.json()
                    return await self._wait_result(job["id"], ioc_type, value)
                return {"ioc_type": ioc_type, "value": value, "error": f"HTTP {r.status_code}"}
        except Exception as e:
            return {"ioc_type": ioc_type, "value": value, "error": str(e)}

    async def _wait_result(self, job_id: str, ioc_type: str, value: str) -> dict:
        for _ in range(24):
            await asyncio.sleep(5)
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.get(f"{self.base_url}/api/job/{job_id}", headers=self.headers)
                    job = r.json()
                    if job["status"] in ("Success", "Failure"):
                        return {"ioc_type": ioc_type, "value": value, "status": job["status"],
                                "report": job.get("report", {}), "malicious": False, "tags": []}
            except Exception:
                pass
        return {"ioc_type": ioc_type, "value": value, "error": "Timeout"}
