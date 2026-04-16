import asyncio
import json
import argparse
import os
import sys
import signal
from datetime import datetime
from loguru import logger
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis.asyncio as aioredis
from ai_engine.claude_analyst import ClaudeSOCAnalyst
from ai_engine.action_executor import ActionExecutor

QUEUE_KEY = "siem:alerts:pending"
PROCESSING_KEY = "siem:alerts:processing"
RESULTS_KEY = "siem:alerts:results"


class DecisionEngine:

    def __init__(self):
        self.analyst = ClaudeSOCAnalyst()
        self.executor = ActionExecutor()
        self.redis = None
        self.running = False

    async def start(self):
        self.redis = await aioredis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True
        )
        self.running = True
        logger.info(f"[AI ENGINE] Watching queue: {QUEUE_KEY}")

        while self.running:
            try:
                item = await self.redis.blpop(QUEUE_KEY, timeout=5)
                if item:
                    _, alert_json = item
                    alert = json.loads(alert_json)
                    await self._process_alert(alert)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[AI ENGINE] Queue error: {e}")
                await asyncio.sleep(5)

    async def _process_alert(self, alert: dict):
        alert_id = alert.get("id", "UNKNOWN")
        logger.info(f"[AI ENGINE] Processing {alert_id}")
        await self.redis.hset(PROCESSING_KEY, alert_id, json.dumps(alert))

        try:
            analysis = await self.analyst.analyze_alert(alert)
            results = await self.executor.execute_all(analysis, alert)

            result_data = {
                "alert_id": alert_id,
                "analysis": analysis,
                "execution": results,
                "completed_at": datetime.utcnow().isoformat()
            }
            await self.redis.hset(RESULTS_KEY, alert_id, json.dumps(result_data))
            logger.success(f"[AI ENGINE] {alert_id} -> {results['case_status']}")
        except Exception as e:
            logger.error(f"[AI ENGINE] Failed on {alert_id}: {e}")
        finally:
            await self.redis.hdel(PROCESSING_KEY, alert_id)

    def stop(self):
        self.running = False


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["daemon", "once"], default="daemon")
    args = parser.parse_args()

    engine = DecisionEngine()

    def handle_signal(signum, frame):
        engine.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    if args.mode == "daemon":
        await engine.start()
    else:
        # Drain the queue once and exit — useful for batch processing
        redis = await aioredis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True
        )
        engine.redis = redis
        queue_len = await redis.llen(QUEUE_KEY)
        logger.info(f"[AI ENGINE] Processing {queue_len} queued alerts")
        for _ in range(queue_len):
            item = await redis.lpop(QUEUE_KEY)
            if item:
                await engine._process_alert(json.loads(item))


if __name__ == "__main__":
    asyncio.run(main())
