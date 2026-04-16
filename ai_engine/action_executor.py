import asyncio
from typing import Optional
from loguru import logger
from integrations.thehive_client import TheHiveClient
from integrations.cortex_client import CortexClient
from integrations.misp_client import MISPClient
from incident_response.report_generator import ReportGenerator


class ActionExecutor:

    def __init__(self):
        self.thehive = TheHiveClient()
        self.cortex = CortexClient()
        self.misp = MISPClient()
        self.report_gen = ReportGenerator()

    async def execute_all(self, analysis: dict, original_alert: dict) -> dict:
        results = {
            "alert_id": analysis["alert_id"],
            "actions_executed": [],
            "actions_failed": [],
            "thehive_case_id": None,
            "ioc_enrichments": [],
            "misp_event_id": None,
            "report_path": None,
        }

        actions = analysis.get("actions", [])
        logger.info(f"[EXECUTOR] {len(actions)} actions queued for {analysis['alert_id']}")

        if "create_thehive_case" in actions:
            try:
                case = await self.thehive.create_case(analysis, original_alert)
                results["thehive_case_id"] = case.get("id") or case.get("_id")
                results["actions_executed"].append("create_thehive_case")
                logger.info(f"[EXECUTOR] TheHive case created: {results['thehive_case_id']}")

                if results["thehive_case_id"]:
                    mitre_str = ", ".join(analysis.get("mitre_techniques", []))
                    note = (
                        f"**AI Analysis**\n\n"
                        f"Severity: {analysis['severity']}\n"
                        f"Decision: {analysis['decision']}\n"
                        f"MITRE: {mitre_str}\n\n"
                        f"{analysis['investigation_notes']}"
                    )
                    await self.thehive.add_task_log(results["thehive_case_id"], note)
            except Exception as e:
                logger.error(f"[EXECUTOR] TheHive failed: {e}")
                results["actions_failed"].append(f"create_thehive_case: {e}")

        if "enrich_ioc_cortex" in actions:
            iocs = analysis.get("iocs", {})
            # Flatten all IOC types into (type, value) pairs
            ioc_list = (
                [("ip", ip) for ip in iocs.get("ips", [])]
                + [("domain", d) for d in iocs.get("domains", [])]
                + [("hash", h) for h in iocs.get("hashes", [])]
            )
            # Cap at 5 to avoid hammering Cortex — TODO: make this configurable per severity
            for ioc_type, value in ioc_list[:5]:
                try:
                    enrichment = await self.cortex.analyze_ioc(ioc_type, value)
                    results["ioc_enrichments"].append(enrichment)
                except Exception as e:
                    logger.error(f"[EXECUTOR] Cortex enrichment failed for {value}: {e}")

            if results["ioc_enrichments"]:
                results["actions_executed"].append("enrich_ioc_cortex")

        if "push_misp" in actions:
            try:
                iocs = analysis.get("iocs", {})
                misp_event = await self.misp.create_threat_event(analysis, iocs)
                results["misp_event_id"] = misp_event.get("Event", {}).get("id")
                results["actions_executed"].append("push_misp")
            except Exception as e:
                logger.error(f"[EXECUTOR] MISP push failed: {e}")
                results["actions_failed"].append(f"push_misp: {e}")

        if "generate_report" in actions:
            try:
                report_path = await self.report_gen.generate(
                    analysis=analysis,
                    original_alert=original_alert,
                    ioc_enrichments=results["ioc_enrichments"],
                    thehive_case_id=results["thehive_case_id"]
                )
                results["report_path"] = report_path
                results["actions_executed"].append("generate_report")
            except Exception as e:
                logger.error(f"[EXECUTOR] Report generation failed: {e}")
                results["actions_failed"].append(f"generate_report: {e}")

        results["case_status"] = await self._finalize_case(analysis, results["thehive_case_id"])
        logger.info(f"[EXECUTOR] Finished {analysis['alert_id']} -> status={results['case_status']}")
        return results

    async def _finalize_case(self, analysis: dict, thehive_case_id: Optional[str]) -> str:
        decision = analysis.get("decision", "escalate")

        if decision == "close":
            reason = analysis.get("close_reason", "Closed by AI — low severity")
            if thehive_case_id:
                try:
                    await self.thehive.close_case(thehive_case_id, reason)
                except Exception as e:
                    logger.error(f"[EXECUTOR] Failed to close TheHive case: {e}")
            return "closed"

        if decision == "escalate":
            if thehive_case_id:
                try:
                    await self.thehive.update_case_status(thehive_case_id, "InProgress")
                except Exception as e:
                    logger.error(f"[EXECUTOR] Failed to escalate TheHive case: {e}")
            return "escalated"

        return "monitoring"
