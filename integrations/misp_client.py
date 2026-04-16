class MISPClient:
    """MISP disabled — removed from this deployment."""
    async def create_threat_event(self, analysis: dict, iocs: dict) -> dict:
        return {"status": "disabled", "message": "MISP not configured"}
