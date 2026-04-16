import json
import asyncio
import os
from loguru import logger
from groq import Groq
from .prompts import SYSTEM_PROMPT, build_alert_analysis_prompt, build_case_summary_prompt


def _parse_llm_json(raw: str) -> dict:
    """Model sometimes wraps output in ```json fences despite instructions. Strip them."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


class ClaudeSOCAnalyst:

    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = "llama-3.3-70b-versatile"
        logger.info(f"[AI ENGINE] Initialized with {self.model}")

    async def analyze_alert(self, alert: dict) -> dict:
        prompt = build_alert_analysis_prompt(alert)
        try:
            # Groq SDK is sync-only, so we push it off the event loop
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model=self.model,
                    max_tokens=2048,
                    temperature=0.1,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ]
                )
            )
            analysis = _parse_llm_json(response.choices[0].message.content)
            analysis["alert_id"] = alert.get("id", "unknown")
            analysis["analyzed_by"] = self.model
            logger.info(
                f"[AI] {alert.get('id')} -> {analysis['severity']} / {analysis['decision']} "
                f"({analysis.get('confidence', 0)}% confidence)"
            )
            return analysis
        except Exception as e:
            logger.error(f"[AI] Analysis failed for {alert.get('id')}: {e}")
            return self._fallback_analysis(alert, str(e))

    async def generate_case_summary(self, case_data: dict, ioc_enrichments: list) -> dict:
        prompt = build_case_summary_prompt(case_data, ioc_enrichments)
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.chat.completions.create(
                model=self.model,
                max_tokens=2048,
                temperature=0.1,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ]
            )
        )
        return _parse_llm_json(response.choices[0].message.content)

    async def write_investigation_note(self, context: str) -> str:
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.chat.completions.create(
                model=self.model,
                max_tokens=256,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Write a 2-3 sentence SOC investigation note: {context}"}
                ]
            )
        )
        return response.choices[0].message.content.strip()

    def _fallback_analysis(self, alert: dict, error: str) -> dict:
        # AI unavailable — safe defaults that force manual escalation
        return {
            "severity": "HIGH",
            "confidence": 0,
            "decision": "escalate",
            "mitre_techniques": [],
            "iocs": {"ips": [], "domains": [], "hashes": [], "emails": [], "urls": []},
            "threat_actor": "Unknown",
            "attack_phase": "Unknown",
            "business_impact": "Unknown — AI analysis unavailable",
            "investigation_notes": f"AI analysis failed: {error}. Manual review required.",
            "actions": ["create_thehive_case", "generate_report"],
            "close_reason": None,
            "escalation_reason": "AI unavailable — defaulting to escalation",
            "recommended_containment": [],
            "evidence_collected": [],
            "alert_id": alert.get("id", "unknown"),
            "analyzed_by": "fallback",
            "error": error
        }
