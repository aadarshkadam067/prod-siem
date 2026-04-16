import os, sys
from elasticsearch import Elasticsearch
from dotenv import load_dotenv

load_dotenv()

es = Elasticsearch(
    os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
    basic_auth=(
        os.getenv("ELASTICSEARCH_USER", "elastic"),
        os.getenv("ELASTICSEARCH_PASSWORD", "changeme")
    )
)

INDEXES = {
    "siem-alerts": {
        "mappings": {"properties": {
            "id": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "source": {"type": "keyword"},
            "event_type": {"type": "keyword"},
            "type": {"type": "keyword"},
            "severity": {"type": "keyword"},
            "status": {"type": "keyword"},
            "source_ip": {"type": "ip"},
            "raw_log": {"type": "text"},
            "ai_analysis": {"type": "object", "enabled": True},
            "analyzed_at": {"type": "date"}
        }}
    },
    "siem-events": {
        "mappings": {"properties": {
            "timestamp": {"type": "date"},
            "event_type": {"type": "keyword"},
            "source_ip": {"type": "ip"},
            "destination_ip": {"type": "ip"},
            "user": {"type": "keyword"},
            "host": {"type": "keyword"},
            "severity": {"type": "keyword"},
            "source": {"type": "keyword"},
            "attack_phase": {"type": "keyword"},
            "threat_actor": {"type": "keyword"}
        }}
    },
    "siem-cases": {
        "mappings": {"properties": {
            "id": {"type": "keyword"},
            "alert_id": {"type": "keyword"},
            "title": {"type": "text"},
            "status": {"type": "keyword"},
            "severity": {"type": "keyword"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
            "source_ip": {"type": "ip"},
            "mitre_techniques": {"type": "keyword"},
            "assigned_to": {"type": "keyword"},
            "ai_analysis": {"type": "object", "enabled": True}
        }}
    }
}

for name, config in INDEXES.items():
    if es.indices.exists(index=name):
        print(f"[=] Index already exists: {name}")
        continue
    es.indices.create(index=name, **config)
    print(f"[+] Index created: {name}")

print("[✔] Done")
