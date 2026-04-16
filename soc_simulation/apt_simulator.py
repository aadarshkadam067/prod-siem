import json, time, random, argparse, os, sys
from datetime import datetime
from loguru import logger
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Realistic enterprise mix — most alerts are LOW/MEDIUM, few are HIGH/CRITICAL
EVENTS = [
    # LOW — normal noise
    {"event_type":"auth_success","severity":"LOW","source_ip":"10.10.1.15","host":"WORKSTATION-01","user":"jsmith","raw_log":"Successful RDP login from internal workstation — normal hours"},
    {"event_type":"file_access","severity":"LOW","source_ip":"10.10.1.22","host":"FILE01","user":"adavis","raw_log":"User accessed shared drive \\\\FILE01\\HR — routine access"},
    {"event_type":"dns_query","severity":"LOW","source_ip":"10.10.1.30","host":"WORKSTATION-07","user":"mwilson","raw_log":"DNS query to microsoft.com — normal traffic"},
    {"event_type":"software_install","severity":"LOW","source_ip":"10.10.1.44","host":"LAPTOP-EXEC01","user":"rjohnson","raw_log":"Chrome 120.0 update installed via SCCM"},
    {"event_type":"auth_success","severity":"LOW","source_ip":"10.10.1.18","host":"WORKSTATION-03","user":"svc_backup","raw_log":"Backup service authenticated successfully — scheduled task"},
    {"event_type":"network_scan","severity":"LOW","source_ip":"10.10.1.5","host":"DC01","user":"svc_scan","raw_log":"Nessus vulnerability scan from IT scanner — authorized"},
    {"event_type":"password_change","severity":"LOW","source_ip":"10.10.1.12","host":"WORKSTATION-02","user":"jsmith","raw_log":"User password changed — routine 90-day policy reset"},
    {"event_type":"usb_connect","severity":"LOW","source_ip":"10.10.1.44","host":"LAPTOP-EXEC01","user":"rjohnson","raw_log":"USB storage device connected — company-issued encrypted drive"},

    # MEDIUM — worth watching
    {"event_type":"auth_fail","severity":"MEDIUM","source_ip":"10.10.1.15","host":"DC01","user":"adavis","raw_log":"5 failed login attempts for adavis — possibly mistyped password"},
    {"event_type":"rdp_external","severity":"MEDIUM","source_ip":"203.0.113.45","host":"JUMP-SERVER","user":"admin","raw_log":"RDP connection from external IP 203.0.113.45 — outside business hours"},
    {"event_type":"powershell_exec","severity":"MEDIUM","source_ip":"10.10.1.33","host":"WORKSTATION-09","user":"mwilson","raw_log":"PowerShell script executed — Get-ADUser enumeration command"},
    {"event_type":"new_admin_account","severity":"MEDIUM","source_ip":"10.10.1.5","host":"DC01","user":"admin","raw_log":"New local admin account created: helpdesk_temp — ticket #4421"},
    {"event_type":"firewall_rule_change","severity":"MEDIUM","source_ip":"10.10.1.5","host":"FW01","user":"netadmin","raw_log":"Firewall rule modified — port 3389 opened for subnet 10.10.2.0/24"},
    {"event_type":"email_phishing","severity":"MEDIUM","source_ip":"198.51.100.22","host":"MAIL-SERVER-01","user":"jsmith","raw_log":"Suspicious email flagged: sender domain corp-invoices-2024.com — 3 recipients"},
    {"event_type":"auth_fail","severity":"MEDIUM","source_ip":"185.220.101.10","host":"VPN-GW","user":"rjohnson","raw_log":"12 VPN login failures from 185.220.101.10 — possible credential stuffing"},
    {"event_type":"process_unusual","severity":"MEDIUM","source_ip":"10.10.1.28","host":"WORKSTATION-06","user":"adavis","raw_log":"certutil.exe executed with -decode flag — potential LOLBin abuse"},

    # HIGH — needs investigation
    {"event_type":"brute_force","severity":"HIGH","source_ip":"185.220.101.45","host":"DC01","user":"admin","raw_log":"47 failed SSH logins in 5 minutes from 185.220.101.45 — Tor exit node"},
    {"event_type":"smb_access","severity":"HIGH","source_ip":"10.10.1.42","host":"DC01","user":"adavis","raw_log":"ADMIN$ share accessed from non-admin workstation using domain creds"},
    {"event_type":"powershell_encoded","severity":"HIGH","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"powershell -EncodedCommand JABjAGwAaQBlAG4AdAA... — encoded payload detected"},
    {"event_type":"scheduled_task","severity":"HIGH","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"Scheduled task created at SYSTEM level — WindowsUpdateHelper running at logon"},
    {"event_type":"registry_modification","severity":"HIGH","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"HKCU\\Run key modified — persistence mechanism via update.exe"},
    {"event_type":"dns_tunneling","severity":"HIGH","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"847 DNS TXT queries to telemetry-corp.xyz — avg subdomain length 68 chars"},
    {"event_type":"file_access_bulk","severity":"HIGH","source_ip":"10.10.1.5","host":"FILE01","user":"adavis","raw_log":"312 files accessed in \\\\FILE01\\Finance in 4 minutes — possible bulk collection"},

    # CRITICAL — immediate action
    {"event_type":"credential_dump","severity":"CRITICAL","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"LSASS process accessed with 0x1fffff rights by powershell.exe — Mimikatz indicators"},
    {"event_type":"lateral_movement","severity":"CRITICAL","source_ip":"10.10.1.42","host":"DC01","user":"adavis","raw_log":"WMI remote execution on DC01 — cmd.exe spawned, downloading stage2.exe from 45.142.212.100"},
    {"event_type":"large_upload","severity":"CRITICAL","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"234MB data uploaded to 194.165.16.78:443 over 14 minutes — suspected exfiltration"},
    {"event_type":"c2_beacon","severity":"CRITICAL","source_ip":"10.10.1.42","host":"WORKSTATION-42","user":"jsmith","raw_log":"Outbound HTTPS beacon to 45.142.212.100 — 60s interval, low data volume, JA3 matches Cobalt Strike"},
    {"event_type":"ransomware_indicator","severity":"CRITICAL","source_ip":"10.10.1.55","host":"WORKSTATION-12","user":"mwilson","raw_log":"Mass file rename with .encrypted extension — 847 files affected in C:\\Users in 2 minutes"},
]

def run(verbose=False):
    base = "http://localhost:8000"
    random.shuffle(EVENTS)
    total = 0

    logger.info(f"[SIM] Injecting {len(EVENTS)} realistic enterprise alerts...")

    for event in EVENTS:
        try:
            httpx.post(f"{base}/api/v1/alerts/ingest", json={
                "source": "siem-sim",
                "event_type": event["event_type"],
                "severity": event["severity"],
                "source_ip": event["source_ip"],
                "raw_log": event["raw_log"],
                "metadata": {"host": event.get("host"), "user": event.get("user")}
            }, timeout=10)
            if verbose:
                sev = event['severity']
                pad = ' ' * (8 - len(sev))
                logger.info(f"  [{sev}]{pad}{event['event_type']} — {event['host']}")
            total += 1
        except Exception as e:
            logger.error(f"  Failed: {e}")
        time.sleep(0.3)

    counts = {}
    for e in EVENTS:
        counts[e['severity']] = counts.get(e['severity'], 0) + 1

    logger.success(f"[SIM] Done — {total} alerts injected")
    logger.info(f"  CRITICAL: {counts.get('CRITICAL',0)} | HIGH: {counts.get('HIGH',0)} | MEDIUM: {counts.get('MEDIUM',0)} | LOW: {counts.get('LOW',0)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv()
    run(args.verbose)
