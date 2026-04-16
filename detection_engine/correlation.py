import json
from datetime import datetime
from loguru import logger
import redis
import os


class CorrelationEngine:

    def __init__(self):
        try:
            self.redis_client = redis.Redis.from_url(
                os.getenv("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True
            )
        except Exception:
            self.redis_client = None

        # Rolling window for lateral movement tracking (1 hour)
        self.window = 3600

    def ingest_event(self, event: dict) -> list:
        alerts = []
        if not self.redis_client:
            return alerts

        source_ip = event.get("source_ip", "unknown")
        event_type = event.get("event_type", "")
        host = event.get("host", "unknown")

        try:
            if event_type == "auth_fail":
                key = f"corr:fail:{source_ip}"
                self.redis_client.rpush(key, "1")
                self.redis_client.expire(key, 300)  # 5-minute window
                count = self.redis_client.llen(key)
                # 20 failures in 5 min is a reasonable brute-force threshold
                # before flagging — lower causes too many FPs on misconfigured services
                if count >= 20:
                    alerts.append(self._make_alert(
                        "BRUTE_FORCE", "HIGH", source_ip,
                        f"Brute force: {count} failures in 5 min from {source_ip}",
                        ["T1110"], event
                    ))

            if event_type in ("smb_access", "rdp_connect", "wmi_exec"):
                key = f"corr:lateral:{source_ip}"
                self.redis_client.sadd(key, host)
                self.redis_client.expire(key, self.window)
                unique_hosts = self.redis_client.scard(key)
                # 4+ distinct hosts in an hour = strong lateral movement signal
                if unique_hosts >= 4:
                    alerts.append(self._make_alert(
                        "LATERAL_MOVEMENT", "CRITICAL", source_ip,
                        f"Lateral movement detected: {unique_hosts} hosts reached from {source_ip}",
                        ["T1021"], event
                    ))

            if event_type == "large_upload":
                mb = event.get("bytes_sent", 0) / (1024 * 1024)
                alerts.append(self._make_alert(
                    "DATA_EXFILTRATION", "CRITICAL", source_ip,
                    f"Large upload {mb:.1f}MB from {source_ip}",
                    ["T1041", "T1048"], event
                ))

            # TODO: add C2 beacon detection (periodic small outbound connections)
            # TODO: add privilege escalation correlation (low user -> admin in short window)

        except Exception as e:
            logger.error(f"[CORR] Ingestion error: {e}")

        return alerts

    def _make_alert(self, alert_type, severity, source_ip, desc, mitre, raw):
        return {
            "id": f"{alert_type}-{int(datetime.utcnow().timestamp())}",
            "type": alert_type,
            "severity": severity,
            "source_ip": source_ip,
            "description": desc,
            "mitre_techniques": mitre,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "correlation_engine",
            "raw_event": raw,
            "status": "new"
        }
