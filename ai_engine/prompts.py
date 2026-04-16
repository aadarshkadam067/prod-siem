# Prompt templates for the Groq/LLaMA SOC analyst layer.
# Keep these concise — over-explaining the schema tends to degrade JSON quality.

SYSTEM_PROMPT = (
    "You are a Tier-3 SOC analyst with deep experience in incident response, "
    "MITRE ATT&CK, and threat hunting. Your output drives automated SOAR workflows — "
    "be precise and decisive. Respond only in valid JSON. No prose, no markdown fences."
)


def build_alert_analysis_prompt(alert: dict) -> str:
    return f"""Analyze this security alert and return your SOC assessment:

ALERT DATA:
{alert}

Return ONLY this JSON (no markdown wrapping):
{{
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL",
  "confidence": 0,
  "decision": "escalate|close|monitor",
  "mitre_techniques": ["T1078"],
  "iocs": {{
    "ips": [],
    "domains": [],
    "hashes": [],
    "emails": [],
    "urls": []
  }},
  "threat_actor": "Unknown",
  "attack_phase": "Initial Access|Execution|Persistence|Privilege Escalation|Defense Evasion|Credential Access|Discovery|Lateral Movement|Collection|Exfiltration|Command and Control|Impact",
  "business_impact": "...",
  "investigation_notes": "Detailed technical analysis",
  "actions": ["create_thehive_case", "enrich_ioc_cortex", "push_misp", "generate_report"],
  "close_reason": null,
  "escalation_reason": "...",
  "recommended_containment": ["Block IP x.x.x.x"],
  "evidence_collected": ["..."]
}}

CRITICAL/HIGH -> escalate + all 4 actions. MEDIUM -> monitor or escalate. LOW -> close and set close_reason."""


def build_case_summary_prompt(case_data: dict, ioc_enrichments: list) -> str:
    return f"""Write an incident report summary for this SOC case.

CASE DATA: {case_data}
IOC ENRICHMENTS: {ioc_enrichments}

Return ONLY this JSON:
{{
  "executive_summary": "2-3 sentences for management",
  "technical_summary": "5-7 sentence technical breakdown",
  "timeline": [{{"time": "2024-01-15 14:23:01", "event": "First detection"}}],
  "root_cause": "...",
  "affected_systems": ["system1"],
  "recommended_remediation": ["Immediate action", "Short-term fix"],
  "lessons_learned": "Detection gaps or process improvements"
}}"""
