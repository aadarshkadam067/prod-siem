<div align="center">

<br/>

```
██████╗ ██████╗  ██████╗ ██████╗       ███████╗██╗███████╗███╗   ███╗
██╔══██╗██╔══██╗██╔═══██╗██╔══██╗      ██╔════╝██║██╔════╝████╗ ████║
██████╔╝██████╔╝██║   ██║██║  ██║█████╗███████╗██║█████╗  ██╔████╔██║
██╔═══╝ ██╔══██╗██║   ██║██║  ██║╚════╝╚════██║██║██╔══╝  ██║╚██╔╝██║
██║     ██║  ██║╚██████╔╝██████╔╝      ███████║██║███████╗██║ ╚═╝ ██║
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═════╝       ╚══════╝╚═╝╚══════╝╚═╝     ╚═╝
```

### AI-Powered Security Operations Center — Self-Hosted, One Command

*Ingest alerts → correlate across the MITRE ATT&CK kill-chain → LLM triage with verdict + reasoning → automated SOAR response → close the case. All without a human in the loop.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.13-005571?style=for-the-badge&logo=elasticsearch&logoColor=white)](https://elastic.co)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=for-the-badge)](https://console.groq.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

---

## Table of Contents

- [The Problem](#the-problem)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Why This Stack](#why-this-stack)
- [How the Pipeline Works](#how-the-pipeline-works)
- [What the AI Actually Returns](#what-the-ai-actually-returns)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Attack Scenarios](#attack-scenarios-32-total)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [About the Project](#about-the-project)

---

## The Problem

A typical enterprise SOC receives **thousands of alerts per day**. The majority are false positives or low-severity noise. A junior analyst spends 70% of their time on the first pass of triage — reading context, correlating events, deciding severity, choosing a response playbook. That work is repetitive, rule-based, and exhausting. It is also exactly the kind of task an LLM is good at.

**prod-siem** automates that entire first pass:

1. **Ingests** raw security events from any source via REST API
2. **Correlates** them against MITRE ATT&CK kill-chain patterns in real time using Redis-backed stateful rules
3. **Sends each HIGH/CRITICAL alert to Groq's LLaMA 3.3 70B** with a structured Tier-3 SOC analyst prompt
4. **Receives** a severity verdict, confidence score, natural-language reasoning, MITRE technique mapping, extracted IOCs, and a list of SOAR actions to execute
5. **Executes those actions autonomously** — creates cases in TheHive, enriches IOCs via Cortex, pushes threat intel to MISP, generates a PDF incident report, and closes or escalates the case
6. **Streams everything live** to a 10-page React dashboard via WebSocket

A human analyst opens the dashboard and sees pre-triaged cases with full AI reasoning already attached. They spend their time on the 5% of alerts that actually need human judgment.

---

## Screenshots

> All screenshots are from a live simulation run using the built-in continuous alert generator.

| Operations Dashboard | Alert Management |
|:---:|:---:|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Alerts](docs/screenshots/02-alerts.png) |
| Live metrics, severity breakdown, 24h alert timeline, AI decision counter. | Real-time alert feed with severity tags, source IPs, status tracking, one-click AI trigger. |

| AI Decision Engine | MITRE Kill Chain Timeline |
|:---:|:---:|
| ![AI Engine](docs/screenshots/03-ai-engine.png) | ![Timeline](docs/screenshots/04-timeline.png) |
| Full LLM reasoning per alert — decision, confidence meter, MITRE mapping, IOCs, containment steps. | Interactive kill-chain visualization across all 12 ATT&CK phases. Click any phase to drill into events. |

| IOC Intelligence | System Metrics |
|:---:|:---:|
| ![IOCs](docs/screenshots/05-ioc-intel.png) | ![Metrics](docs/screenshots/06-metrics.png) |
| Aggregated IPs, domains, file hashes, URLs extracted across all AI analyses. | Live health status for all 6 services plus Elasticsearch cluster state. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                               │
│                                                                      │
│   Continuous Generator    APT Simulator       External Sources       │
│   (32 attack scenarios)   (7-stage kill-chain) (any HTTP source)     │
│         │                      │                      │              │
│         └──────────────────────┴──────────────────────┘              │
│                                │                                     │
│                    POST /api/v1/alerts/ingest                        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                        FASTAPI BACKEND                               │
│                                                                      │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  Correlation    │    │  AI Engine       │    │  Case Manager  │  │
│  │  Engine         │───▶│  (Groq LLaMA     │───▶│  (ES + TheHive)│  │
│  │  (MITRE +       │    │   3.3 70B)       │    │                │  │
│  │  kill-chain)    │    │                  │    │                │  │
│  └─────────────────┘    └──────────────────┘    └────────────────┘  │
│           │                      │                       │           │
│           ▼                      ▼                       ▼           │
│    Redis Alert Queue     Action Executor          PDF Generator      │
│                          ├─ TheHive (cases)       (ReportLab)        │
│                          ├─ Cortex (IOC enrich)                      │
│                          └─ MISP (threat intel)                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                    WebSocket broadcast on every event
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                    REACT DASHBOARD (10 Pages)                        │
│                                                                      │
│  Dashboard │ Alerts │ Cases │ AI Engine │ Kill Chain │ IOC Intel     │
│  Activity Log │ Live Logs │ Reports │ System Metrics                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why This Stack

Every major technology choice was made to solve a specific problem. Nothing here is vendor-lock-in by accident.

| Component | Why it was chosen |
|-----------|-------------------|
| **FastAPI + Uvicorn** | **Native WebSocket support** for real-time dashboard updates without polling. The async runtime means one worker can hold hundreds of concurrent WebSocket connections while still serving REST traffic. Auto-generated Swagger docs at `/docs` come free. |
| **Groq + LLaMA 3.3 70B** | **Inference speed.** A Tier-3 SOC analyst prompt returns structured JSON in under 2 seconds on Groq — orders of magnitude faster than GPT-4 or Claude API for this workload. The free tier gives 14,400 requests/day, which is enough for a real SOC's HIGH/CRITICAL queue. |
| **Elasticsearch** | **Full-text search on raw logs and case notes** is the one database feature this project can't live without. ES handles the alert index, case index, and event index with identical semantics and a single client library. |
| **Redis** | **Three jobs in one process**: the AI work queue (`BLPOP siem:alerts:pending`), the stateful correlation window (auth_fail counters, lateral-movement host sets), and the WebSocket pub/sub backbone. Replacing it would require three separate systems. |
| **React 18 + Vite + Tailwind** | **Vite's hot reload** makes dashboard iteration near-instant. Tailwind avoids the CSS sprawl that usually plagues 10-page admin UIs. Zustand handles global state without Redux ceremony. |
| **TheHive 5 + Cortex 3** | **Industry-standard IR platform.** Using real TheHive (not a mock) means the case workflow, observable types, TLP levels, and analyzer execution all match what a real SOC would expect — not a proof-of-concept shell. |
| **Separate AI daemon process** | **Isolation.** The AI engine runs as its own process (`ai_engine/decision_engine.py`) blocking on Redis. If it crashes, the FastAPI backend keeps serving alerts and dashboards. If the backend restarts, the queue waits. Each component can be scaled independently. |
| **Docker Compose (not k8s)** | **One command to boot the whole stack locally.** A recruiter should be able to `./setup.sh` and see it working in 10 minutes — not configure a cluster. Production deployment would swap this for Helm. |

---

## How the Pipeline Works

Every alert that enters the system flows through this exact sequence:

1. **Ingest.** An alert arrives at `POST /api/v1/alerts/ingest`. The API assigns a unique `ALERT-{hex}` ID and writes it to the in-memory cache (200-entry LRU) for instant dashboard visibility.

2. **Correlate.** The `CorrelationEngine` evaluates the event against stateful Redis counters:
   - `auth_fail` × 20+ from same IP within 5 min → `BRUTE_FORCE`
   - SMB/RDP/WMI access to ≥4 distinct hosts within 1 hour → `LATERAL_MOVEMENT`
   - `large_upload` event → immediate `DATA_EXFILTRATION`

   Each correlated alert gets MITRE technique IDs attached.

3. **Persist.** The alert is indexed into Elasticsearch via FastAPI `BackgroundTasks` — non-blocking, so dashboard speed is unaffected by ES load.

4. **Queue for AI.** `HIGH` and `CRITICAL` alerts are pushed to the Redis list `siem:alerts:pending`.

5. **Broadcast.** A `new_alert` WebSocket event hits every connected dashboard within ~50ms.

6. **AI analysis.** A separate daemon process (`ai_engine/decision_engine.py`) blocks on `BLPOP` reading from the Redis queue. For each alert, it calls `ClaudeSOCAnalyst.analyze_alert()` which sends the full alert context to Groq with a structured Tier-3 SOC analyst prompt (temperature 0.1, max 2048 tokens, JSON-only output enforced).

7. **Action execution.** `ActionExecutor.execute_all()` runs each action returned by the AI sequentially:
   - `create_thehive_case` → TheHive v5 API
   - `enrich_ioc_cortex` → Cortex analyzers (AbuseIPDB, VirusTotal, URLhaus)
   - `push_misp` → MISP threat event creation
   - `generate_report` → ReportLab PDF

   Each action fails gracefully without blocking the others.

8. **Persist + broadcast result.** The alert record in Elasticsearch is updated with the full AI analysis. An `ai_decision` WebSocket event is broadcast to all dashboards.

**Fallback behavior:** if the Groq API is unavailable or returns malformed JSON, `_fallback_analysis()` returns a synthetic `escalate` decision with `confidence: 0` and a flag for manual review. The pipeline never silently drops an alert.

---

## What the AI Actually Returns

Every analysis returns this exact JSON schema:

```json
{
  "severity": "CRITICAL",
  "confidence": 92,
  "decision": "escalate",
  "mitre_techniques": ["T1003.001", "T1055"],
  "attack_phase": "Credential Access",
  "threat_actor": "Unknown — consistent with commodity RAT operator",
  "iocs": {
    "ips": ["10.10.1.42"],
    "domains": [],
    "hashes": ["a3f1c2b4..."],
    "urls": [],
    "emails": []
  },
  "investigation_notes": "LSASS process accessed with 0x1fffff rights by powershell.exe. This matches Mimikatz sekurlsa::logonpasswords execution pattern. Source host has prior indicators of compromise in this session.",
  "business_impact": "Full domain credential compromise possible. All accounts on this host should be considered compromised.",
  "recommended_containment": [
    "Isolate WORKSTATION-42 from network immediately",
    "Force password reset for all accounts on affected host",
    "Revoke Kerberos tickets issued in last 4 hours"
  ],
  "actions": ["create_thehive_case", "enrich_ioc_cortex", "generate_report"],
  "escalation_reason": "Active credential theft in progress with lateral movement history"
}
```

**Decision logic enforced by the prompt:**

| Severity | Decision | Actions |
|---|---|---|
| `CRITICAL` / `HIGH` | `escalate` | All four (case + Cortex + MISP + PDF) |
| `MEDIUM` | `monitor` or `escalate` | Case + PDF |
| `LOW` | `close` with `close_reason` | None |

This means LOW-severity noise is auto-triaged and closed without analyst involvement, dropping queue depth significantly.

---

## Features

### Core Pipeline
- Real-time alert ingestion via REST API — accepts any JSON payload
- Stateful MITRE ATT&CK correlation via Redis-backed time-windowed rules
- LLM triage — LLaMA 3.3 70B verdict with confidence score, reasoning, and MITRE mapping
- Autonomous SOAR — case creation, IOC enrichment, threat intel push, PDF report, case closure
- WebSocket streaming — every event broadcasts to all dashboards within ~50ms
- In-memory caching — dashboard responsive even under Elasticsearch load
- Graceful degradation — every integration is optional; system runs even if everything except FastAPI/Redis is down

### Dashboard (10 Pages)

| Page | What It Shows |
|------|---------------|
| **Operations Dashboard** | Live metrics, severity breakdown, 24h alert timeline, attack type distribution |
| **Alert Management** | Full alert table, filters, severity badges, one-click AI trigger, inject test alerts |
| **Case Management** | Case lifecycle — view, add notes, change status, close manually |
| **AI Decision Engine** | Per-alert reasoning cards, confidence meters, MITRE tags, IOC list, containment steps |
| **Kill Chain Timeline** | Interactive MITRE ATT&CK phase visualization — click any phase to drill into events |
| **IOC Intelligence** | Aggregated indicators (IPs, domains, hashes, URLs) across all AI analyses |
| **Activity Log** | System-wide audit trail — every alert, AI decision, case action in timeline view |
| **Live Logs** | Real-time log stream with level filter and search |
| **Incident Reports** | AI-generated PDF reports — view and download per case |
| **System Metrics** | Live health status for all 6 services + Elasticsearch cluster state |

### Attack Simulation
- **Continuous generator** — 32 attack scenarios, weighted by real-world frequency (40% LOW, 35% MEDIUM, 18% HIGH, 7% CRITICAL), generates batches every 45–120 seconds
- **APT kill-chain simulator** — full 7-stage attack sequence (Initial Access → Execution → Persistence → Credential Access → Lateral Movement → Collection → Exfiltration)

### Integrations (Optional)
- **TheHive 5** — full case lifecycle: create, add observables, task logs, close
- **Cortex 3.1** — IOC enrichment via AbuseIPDB, VirusTotal, URLhaus analyzers
- **MISP** — push extracted IOCs as structured threat intelligence events

---

## Prerequisites

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| OS | Kali Linux / Ubuntu 22.04+ | Tested on both |
| RAM | 4 GB | 8 GB recommended for full SOAR stack |
| Disk | 20 GB | Elasticsearch data |
| Python | 3.11+ | Tested on 3.11, 3.12, 3.13 |
| Node.js | 18+ | For frontend dev server |
| Docker | 24+ with Compose v2 | `docker compose` not `docker-compose` |
| Groq API Key | Free | [Get one here](https://console.groq.com/keys) — 14,400 req/day free |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/aadarshkadam067/prod-siem.git
cd prod-siem
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

The only required value is `GROQ_API_KEY`. Everything else has working defaults:

```env
# Required — get free key at https://console.groq.com/keys
GROQ_API_KEY=gsk_your_key_here

# Defaults — no changes needed for local setup
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USER=elastic
ELASTICSEARCH_PASSWORD=changeme
REDIS_URL=redis://localhost:6379

# Optional — only needed for the full SOAR stack
THEHIVE_API_KEY=
CORTEX_API_KEY=
MISP_API_KEY=
```

### 3. Setup

```bash
chmod +x setup.sh run.sh health_check.sh stop.sh
./setup.sh
```

`setup.sh` handles everything: preflight checks, port conflict detection, Docker permissions, `vm.max_map_count` for Elasticsearch, Python venv, pip install, Docker images, stack startup, ES index initialization.

### 4. Open

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:5173 |
| **API Docs** | http://localhost:8000/docs |
| **Kibana** | http://localhost:5601 *(optional)* |
| **TheHive** | http://localhost:9000 *(--full only)* |
| **Cortex** | http://localhost:9001 *(--full only)* |

Alerts start generating automatically. Click **"Inject Test Alert"** on the Alerts page to trigger the full pipeline manually.

### 5. Verify

```bash
./health_check.sh
```

Expected output:
```
✔ Elasticsearch container    ✔ Redis container
✔ Elasticsearch API          ✔ FastAPI backend
✔ FastAPI health status      ✔ Redis ping
✔ Groq AI responding         ✔ Index: siem-alerts
✔ Index: siem-events         ✔ Index: siem-cases
✔ All systems operational
```

### 6. Stop

```bash
./setup.sh --stop
```

### Full SOAR Stack (optional)

```bash
./setup.sh --full   # adds TheHive + Cortex + Cassandra (~8 GB RAM)
```

---

## Trigger AI Triage Manually

```bash
# Run AI analysis on all HIGH/CRITICAL alerts in the queue
source venv/bin/activate
python3 - << 'EOF'
import httpx, time
alerts = httpx.get("http://localhost:8000/api/v1/alerts?limit=50").json().get("alerts", [])
critical = [a for a in alerts if a.get("severity") in ("CRITICAL", "HIGH")]
for a in critical:
    httpx.post(f"http://localhost:8000/api/v1/ai/analyze/{a['id']}", timeout=10)
    print(f"  Queued: {a['id']} [{a['severity']}]")
    time.sleep(2)
EOF
```

Or run the APT simulator to inject a full multi-stage attack:

```bash
python3 soc_simulation/apt_simulator.py --verbose
```

---

## API Reference

Full interactive Swagger docs at **http://localhost:8000/docs**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness + component status |
| `WS` | `/ws` | WebSocket stream — `new_alert`, `ai_decision`, `case_updated` |
| `POST` | `/api/v1/alerts/ingest` | Ingest a security alert |
| `GET` | `/api/v1/alerts` | List alerts with optional status filter |
| `POST` | `/api/v1/ai/analyze/{alert_id}` | Trigger AI triage (async) |
| `GET` | `/api/v1/cases` | List all incident cases |
| `GET` | `/api/v1/cases/{id}` | Case detail with AI analysis |
| `POST` | `/api/v1/cases/{id}/notes` | Add analyst investigation note |
| `POST` | `/api/v1/cases/{id}/close` | Close case with resolution |
| `GET` | `/api/v1/cases/{id}/report` | Download PDF incident report |
| `GET` | `/api/v1/cases/{id}/iocs` | IOCs extracted by AI for this case |
| `GET` | `/api/v1/stats` | Aggregate counts for dashboard |
| `GET` | `/api/v1/metrics` | System performance metrics |
| `GET` | `/api/v1/activity` | Recent system activity log |
| `GET` | `/api/v1/system/status` | Health of all 6 integrated services |

### Example: ingest + triage

```bash
# Ingest
ALERT_ID=$(curl -s -X POST http://localhost:8000/api/v1/alerts/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "edr",
    "event_type": "credential_dump",
    "severity": "CRITICAL",
    "source_ip": "10.10.1.42",
    "raw_log": "procdump.exe -ma lsass.exe detected on WORKSTATION-42"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['alert_id'])")

# Trigger AI triage
curl -X POST http://localhost:8000/api/v1/ai/analyze/$ALERT_ID
```

---

## Attack Scenarios (32 Total)

<details>
<summary><strong>Initial Access (6)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `email_phishing` | T1566 — Phishing |
| `auth_fail` / `auth_success` | T1078 — Valid Accounts |
| `rdp_external` | T1021.001 — Remote Desktop Protocol |
| `vpn_connect` | T1133 — External Remote Services |
| `impossible_travel` | T1078.004 — Cloud Accounts |
| `usb_connect` | T1200 — Hardware Additions |

</details>

<details>
<summary><strong>Execution (3)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `powershell_exec` | T1059.001 — PowerShell |
| `macro_blocked` | T1204.002 — Malicious File |
| `malware_detected` | T1204 — User Execution |

</details>

<details>
<summary><strong>Persistence (3)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `scheduled_task_abuse` | T1053.005 — Scheduled Task |
| `persistence_registry` | T1547.001 — Registry Run Keys |
| `software_install` | T1574 — Hijack Execution Flow |

</details>

<details>
<summary><strong>Credential Access (6)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `credential_dump` | T1003.001 — LSASS Memory |
| `password_spray` | T1110.003 — Password Spraying |
| `brute_force` | T1110 — Brute Force |
| `kerberoasting` | T1558.003 — Kerberoasting |
| `golden_ticket` | T1558.001 — Golden Ticket |
| `dcsync_attack` | T1003.006 — DCSync |

</details>

<details>
<summary><strong>Privilege Escalation & Discovery (3)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `new_local_admin` | T1136.001 — Local Account |
| `port_scan` | T1046 — Network Service Discovery |
| `scheduled_scan` | T1518 — Software Discovery |

</details>

<details>
<summary><strong>Lateral Movement (3)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `lateral_movement` | T1021 — Remote Services |
| `wmi_lateral_movement` | T1021.006 — Windows Remote Management |
| `rdp_session` | T1021.001 — Remote Desktop Protocol |

</details>

<details>
<summary><strong>Collection, C2, Exfiltration & Impact (8)</strong></summary>

| Scenario | Technique |
|----------|-----------|
| `data_staging` | T1074 — Data Staged |
| `sensitive_file_access` / `file_access` | T1005 — Data from Local System |
| `dns_query` (tunneling) | T1071.004 — DNS |
| `data_exfiltration` | T1041 — Exfiltration Over C2 Channel |
| `ransomware_indicator` | T1486 — Data Encrypted for Impact |
| `certificate_expiry` | (Operational) |

</details>

---

## Project Structure

```
prod-siem/
│
├── main.py                        # FastAPI app — 15 endpoints, WebSocket, lifespan
│
├── ai_engine/
│   ├── claude_analyst.py          # Groq LLM client — structured JSON SOC analysis
│   ├── decision_engine.py         # Redis-polling autonomous AI daemon
│   ├── action_executor.py         # Executes AI decisions: TheHive + Cortex + MISP + PDF
│   └── prompts.py                 # Tier-3 SOC analyst system prompt
│
├── detection_engine/
│   ├── correlation.py             # Stateful MITRE ATT&CK correlation (Redis-backed)
│   ├── sigma_rules/               # Sigma rule directory (extensible)
│   └── yara_rules/                # YARA rule directory (extensible)
│
├── soc_workflow/
│   └── case_manager.py            # Elasticsearch case lifecycle: create → escalate → close
│
├── soc_simulation/
│   ├── continuous_generator.py    # 32-scenario weighted realistic alert stream
│   └── apt_simulator.py           # Multi-stage APT kill chain injector
│
├── integrations/
│   ├── thehive_client.py          # TheHive 5 API: cases, observables, task logs
│   ├── cortex_client.py           # Cortex 3.1: submit IOC → poll → extract verdict
│   └── misp_client.py             # MISP: create events with attributes from IOCs
│
├── incident_response/
│   └── report_generator.py        # ReportLab PDF: summary, MITRE table, IOC table, containment
│
├── frontend/
│   ├── src/
│   │   ├── pages/                 # 10 pages (Dashboard, Alerts, Cases, AI, Timeline...)
│   │   ├── components/            # Sidebar (live service dots), Topbar (WS indicator)
│   │   ├── services/api.js        # All 15 API calls in one place
│   │   ├── store/index.js         # Zustand global state
│   │   └── hooks/
│   │       ├── usePolling.js      # Generic polling hook with configurable interval
│   │       └── useWebSocket.js    # WS connection with auto-reconnect + event routing
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── scripts/
│   └── setup_indexes.py           # Create ES indexes with proper field mappings
│
├── docker-compose.yml             # ES + Redis + (--full: TheHive + Cortex + Cassandra)
├── setup.sh                       # Full automated setup — idempotent, retry logic
├── run.sh                         # Start backend + AI daemon
├── health_check.sh                # Component-by-component verification
├── stop.sh                        # Graceful shutdown
├── requirements.txt               # Pinned Python dependencies
└── .env.example                   # Environment template with comments
```

---

## Sample End-to-End Workflow

```
1. Alert ingested          → ALERT-A9B641D5 created, cached, broadcast
2. Correlation evaluated   → No multi-event rules triggered (single event)
3. AI queue                → Pushed to siem:alerts:pending
4. AI analysis complete    → CRITICAL / ESCALATE / 94% confidence
5. TheHive case created    → CASE-A1B2C3D4 (status: New)
6. Task log added          → AI investigation notes written to case
7. IOC enriched            → 10.10.1.42 → AbuseIPDB → MALICIOUS (confidence 100)
8. PDF generated           → reports/INCIDENT_ALERT-A9B641D5_20260325_174245.pdf
9. Case status             → escalated / InProgress
10. WebSocket event        → ai_decision broadcast to all frontend clients
```

Total elapsed time: typically under 5 seconds from ingest to dashboard update.

---

## Troubleshooting

<details>
<summary><strong>Elasticsearch won't start / connection timeout</strong></summary>

```bash
# Required kernel setting for ES
sudo sysctl -w vm.max_map_count=262144

# Make permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# If low RAM (<8GB), reduce ES heap
sed -i 's/ES_JAVA_OPTS=.*/ES_JAVA_OPTS=-Xms512m -Xmx512m/' docker-compose.yml
docker compose restart elasticsearch
sleep 30
curl -u elastic:changeme http://localhost:9200/_cluster/health
```
</details>

<details>
<summary><strong>FastAPI health check fails</strong></summary>

```bash
# Check the actual error
tail -30 logs/backend.log

# Test if main.py loads without errors
source venv/bin/activate
python3 -c "import main"

# Restart cleanly
./setup.sh --stop && ./setup.sh
```
</details>

<details>
<summary><strong>Groq AI not responding</strong></summary>

```bash
source venv/bin/activate
python3 -c "
from groq import Groq; import os; from dotenv import load_dotenv; load_dotenv()
c = Groq(api_key=os.getenv('GROQ_API_KEY'))
print(c.chat.completions.create(
    model='llama-3.3-70b-versatile', max_tokens=10,
    messages=[{'role':'user','content':'ping'}]
).choices[0].message.content)
"
```
</details>

<details>
<summary><strong>TheHive returns 401 or connection refused</strong></summary>

```bash
docker logs thehive --tail=30

# TheHive takes 2-3 minutes after Cassandra starts
watch -n 10 'curl -s http://localhost:9000/api/status | python3 -m json.tool'

# Get API key from UI: http://localhost:9000 → Avatar → Settings → API Key → Create
```
</details>

<details>
<summary><strong>Full reset — wipes all data</strong></summary>

```bash
./setup.sh --stop
docker compose down -v   # WARNING: deletes all Elasticsearch data
./setup.sh --reset
```
</details>

---

## Known Limitations

This section exists because honesty about boundaries matters more than marketing language.

| Limitation | Detail |
|------------|--------|
| **No authentication** | Every API endpoint is open. Localhost use only — do not expose to a network. |
| **Single-tenant** | One org, one set of ES indexes. No multi-tenant support. |
| **No AI rate limiting** | Calling the AI endpoint in a tight loop will exhaust your Groq free quota. |
| **In-memory activity log** | Restarting the backend loses the activity log. Alerts and cases persist in ES. |
| **Single prompt template** | One system prompt for all alert types. No fine-tuning or RAG. |
| **Frontend is dev server** | Runs via `vite dev`. No production build or reverse proxy. |
| **TheHive/Cortex are optional** | AI triage and PDF reports work without them. SOAR actions gracefully degrade. |
| **No test coverage** | `tests/` directory is a placeholder. |
| **Sigma/YARA scaffolded only** | Rule directories exist but no rule evaluation engine yet. |

---

## Roadmap

- [ ] JWT auth + RBAC (analyst / admin / viewer roles)
- [ ] Production frontend build with nginx reverse proxy
- [ ] Sigma rule evaluation engine (`pySigma` integration)
- [ ] Wazuh API integration to pull real agent alerts
- [ ] Analyst feedback loop — correct/wrong verdict → prompt improvement
- [ ] Persistent activity log via Redis Streams
- [ ] Actual test suite in `tests/`
- [ ] OpenTelemetry tracing across backend → Groq → playbook
- [ ] Helm chart for Kubernetes deployment

---

## About the Project

This was built to answer a practical question: **how much of a Tier-1 and Tier-2 SOC workload can be automated with current tooling — without sacrificing decision quality or audit trail integrity?**

Based on this implementation, the answer is "substantial." The AI engine consistently makes defensible triage decisions on commodity alert types (brute force, port scanning, routine auth failures) and correctly escalates multi-stage attack sequences with accurate MITRE technique mapping. Every decision is logged, every action is traceable, and every case has a generated report — the same artifacts a human analyst would be expected to produce.

The stack is intentionally chosen to reflect real enterprise deployments: Elasticsearch for log storage, TheHive for case management, Cortex for automated enrichment. Groq was selected for its inference speed — analysis latency is typically under two seconds, which matters for a system meant to operate faster than humans.

Built as a portfolio project — not production-hardened (see Known Limitations), but every component works as described, runs locally with one command, and demonstrates the architectural patterns of a real SIEM/SOAR stack.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built by **[Aadarsh Kadam](https://github.com/aadarshkadam067)**

*If this was useful, consider leaving a ⭐*

</div>
