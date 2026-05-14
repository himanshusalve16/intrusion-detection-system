# Packet Pipeline Documentation — Part 2: Live Packet Capture & Collection

> **Prerequisite:** Read [Part 1 (Overview)](packet_pipeline_part1_overview.md) first.

---

## 1. What Is a Network Packet?

A **packet** is a small chunk of data sent over a network. When you load a webpage, your computer sends and receives hundreds or thousands of packets.

Every packet has two parts:

| Part | Contains | Analogy |
|------|----------|---------|
| **Header** | Source/destination IP, ports, protocol, flags, TTL | The envelope of a letter (address, stamp, return address) |
| **Payload** | The actual data (HTML, image bytes, file content) | The letter inside the envelope |

For intrusion detection, we mostly care about the **header** and **flow-level statistics** (how many packets, how many bytes, how long the connection lasted). We do NOT inspect encrypted payloads.

---

## 2. How Do We Access Network Traffic?

Before we can capture packets, our machine needs to **see** them. By default, a computer only sees packets meant for itself. We need special access.

### Option A — Mirror Port (SPAN Port)

A **mirror port** is a feature on managed network switches. You configure the switch to copy all traffic from one or more ports to a designated monitoring port where your IDPS machine is connected.

```
    Switch
  ┌─────────┐
  │ Port 1  │ ← Server A
  │ Port 2  │ ← Server B
  │ Port 3  │ ← Client C
  │ Port 4  │ ← MIRROR → copies of all traffic from Ports 1-3
  └─────────┘
       │
       ▼
  IDPS Machine (our system)
```

**Pros:** No extra hardware needed, easy to configure on most enterprise switches.
**Cons:** Can drop packets under heavy load, limited by switch capacity.

### Option B — Network TAP

A **TAP** (Test Access Point) is a physical device inserted between two network devices. It passively copies all traffic.

**Pros:** Never drops packets, doesn't affect network performance.
**Cons:** Requires physical hardware, costs money.

### Option C — Promiscuous Mode (For Testing)

For development/testing, you can put your network interface card (NIC) into **promiscuous mode** — this tells it to capture ALL packets on the local network segment, not just packets addressed to your machine.

```bash
# Linux: enable promiscuous mode on interface eth0
sudo ip link set eth0 promisc on
```

### Option D — Virtual Network (For Lab/Dev)

For safe testing without touching a real network, use virtual machines:
- Set up VMs in VirtualBox/VMware with a shared virtual network
- Generate traffic between VMs
- Capture on the host or a dedicated monitor VM

**Recommendation for our project:** Start with Option C or D during development. Move to Option A (mirror port) for real deployment.

---

## 3. Packet Capture Tools

### 3.1 tcpdump — The Basic Catcher

**What:** Command-line packet capture tool. It's the simplest and most widely available tool on Linux.

**What it produces:** Raw `.pcap` files (binary packet captures).

```bash
# Capture all traffic on interface eth0, save to file
sudo tcpdump -i eth0 -w /data/raw/capture_$(date +%s).pcap

# Capture only TCP traffic on port 80
sudo tcpdump -i eth0 tcp port 80 -w /data/raw/http_traffic.pcap

# Capture with rotation: new file every 100MB, keep max 10 files
sudo tcpdump -i eth0 -w /data/raw/capture.pcap -C 100 -W 10

# Capture with time rotation: new file every 60 seconds
sudo tcpdump -i eth0 -w /data/raw/capture_%Y%m%d_%H%M%S.pcap -G 60
```

**Key flags explained:**

| Flag | Meaning |
|------|---------|
| `-i eth0` | Listen on interface named `eth0` |
| `-w file.pcap` | Write captured packets to this file |
| `-C 100` | Rotate file after 100 MB |
| `-W 10` | Keep maximum 10 rotated files |
| `-G 60` | Rotate file every 60 seconds |
| `tcp port 80` | Only capture TCP packets on port 80 (a BPF filter) |

### 3.2 tshark — The Smart Catcher

**What:** Command-line version of Wireshark. Can capture AND decode packets.

```bash
# Capture and display live traffic
sudo tshark -i eth0

# Capture to pcap file
sudo tshark -i eth0 -w /data/raw/capture.pcap

# Read a pcap file and output as JSON
tshark -r capture.pcap -T json > capture.json

# Extract specific fields
tshark -r capture.pcap -T fields -e ip.src -e ip.dst -e tcp.port
```

**When to use tshark over tcpdump:** When you need to decode protocols or extract specific fields from packets. For just capturing, tcpdump is simpler.

### 3.3 Zeek — The Intelligent Analyzer (Most Important)

**What:** Zeek (formerly called Bro) is a **network analysis framework**. It doesn't just capture packets — it understands network protocols and generates structured log files.

**Why Zeek is critical for our project:** Our ML models need structured features like "bytes sent," "connection duration," "number of packets." Zeek produces exactly these features automatically.

**Zeek's output logs:**

| Log File | Contains | Why We Need It |
|----------|----------|---------------|
| `conn.log` | Every connection: IPs, ports, protocol, duration, bytes, packets | **Primary data source** for ML features |
| `http.log` | HTTP requests: method, URI, status code, user-agent | Detecting web attacks |
| `dns.log` | DNS queries and responses | Detecting DNS tunneling, DGA domains |
| `ssl.log` | TLS handshake details: SNI, certificate info | Detecting suspicious encrypted connections |
| `files.log` | File transfers detected in traffic | Detecting malware downloads |
| `notice.log` | Zeek's built-in alerts | Supplementary detection signals |

**Installing Zeek on Ubuntu:**

```bash
# Add Zeek repository
sudo apt-get install -y curl gnupg
echo 'deb http://download.opensuse.org/repositories/security:/zeek/xUbuntu_22.04/ /' | \
  sudo tee /etc/apt/sources.list.d/zeek.list
curl -fsSL https://download.opensuse.org/repositories/security:/zeek/xUbuntu_22.04/Release.key | \
  sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/zeek.gpg

sudo apt-get update
sudo apt-get install -y zeek

# Add Zeek to PATH
export PATH="/opt/zeek/bin:$PATH"
echo 'export PATH="/opt/zeek/bin:$PATH"' >> ~/.bashrc
```

**Running Zeek in live mode:**

```bash
# Monitor interface eth0 in real time
sudo zeek -i eth0

# Monitor with specific scripts
sudo zeek -i eth0 local "Log::default_rotation_interval = 1 hr"
```

**Running Zeek on a saved pcap file (for testing):**

```bash
# Analyze a saved pcap file — generates logs in current directory
zeek -r /data/raw/capture.pcap
```

**Sample conn.log output (tab-separated):**

```
#fields ts      uid     id.orig_h  id.orig_p  id.resp_h  id.resp_p  proto  service  duration  orig_bytes  resp_bytes  ...
1684234567.123  CYnvWc  10.0.0.5   49312      93.184.216.34  80   tcp    http     1.234     512         8934        ...
```

Each row = one network connection. This is exactly what our Preprocessor needs.

---

## 4. The Collector Module — How To Build It

### 4.1 Architecture

```
Network Interface (eth0)
        │
        ├──→ tcpdump (writes rotating .pcap files to /data/raw/)
        │         └── backup / forensic archive
        │
        └──→ Zeek (generates conn.log, http.log, dns.log in real time)
                  │
                  ▼
           Zeek Log Parser (Python script)
                  │
                  ▼ JSON flow records
           Redis Queue (channel: flows:raw)
```

### 4.2 File Structure

```
service/collector/
├── capture.py           # Wrapper: starts tcpdump for raw pcap archival
├── zeek_runner.py       # Wrapper: starts Zeek in live mode
├── zeek_log_parser.py   # Reads conn.log, converts to JSON, pushes to Redis
├── flow_streamer.py     # Continuously watches for new Zeek log entries
├── config.py            # Interface name, paths, rotation settings
└── requirements.txt     # redis, watchdog, pandas
```

### 4.3 Zeek Log Parser — Simplified Example

```python
"""
zeek_log_parser.py — Reads Zeek conn.log and pushes flow records to Redis.

What this does in simple terms:
1. Watches the conn.log file for new lines
2. Parses each line into a dictionary (key-value pairs)
3. Pushes the dictionary as JSON to a Redis channel
4. The Preprocessor is listening on that channel and picks it up
"""

import json
import time
import redis

def parse_conn_log_line(line: str, field_names: list) -> dict:
    """Convert one line of conn.log into a Python dictionary."""
    if line.startswith('#'):
        return None  # Skip comment lines
    
    values = line.strip().split('\t')
    record = {}
    for name, value in zip(field_names, values):
        if value == '-':
            record[name] = None
        else:
            record[name] = value
    return record

def stream_conn_log(log_path: str, redis_host: str = 'localhost', redis_port: int = 6379):
    """Continuously read new lines from conn.log and push to Redis."""
    r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
    
    field_names = []  # Will be read from the #fields header line
    
    with open(log_path, 'r') as f:
        # Move to end of file (we only want NEW entries)
        f.seek(0, 2)
        
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.1)  # Wait briefly, then check again
                continue
            
            # Parse the #fields header to know column names
            if line.startswith('#fields'):
                field_names = line.strip().split('\t')[1:]
                continue
            
            record = parse_conn_log_line(line, field_names)
            if record:
                r.publish('flows:raw', json.dumps(record))
                print(f"Published flow: {record.get('id.orig_h')} → {record.get('id.resp_h')}")
```

### 4.4 BPF Filters — Catching Only What You Need

**BPF** (Berkeley Packet Filter) is a mini language that lets you specify which packets to capture. This reduces noise and saves resources.

```bash
# Only TCP traffic
sudo tcpdump -i eth0 tcp

# Only traffic on port 80 or 443
sudo tcpdump -i eth0 'port 80 or port 443'

# Exclude SSH traffic (so your own connection doesn't pollute captures)
sudo tcpdump -i eth0 'not port 22'

# Only traffic from a specific subnet
sudo tcpdump -i eth0 'src net 192.168.1.0/24'
```

---

## 5. What About Snort and Suricata Here?

### Why We Are NOT Using Snort/Suricata as the Primary Capture Tool

The architecture from your ideas was:
```
network traffic → Snort → Elasticsearch → Logstash → AI model → Kibana
```

This has some issues:

1. **Snort is signature-based** — It detects known attacks using rules. Our ML models detect unknown attacks. Using Snort as the sole data source means we only get alerts Snort already knows about — defeating the purpose of ML.

2. **Snort doesn't produce ML-ready flow features** — It produces alerts (matched rules), not the raw flow features (bytes, duration, packet counts) that our ML model needs.

3. **Zeek is better for ML-based IDS** — Zeek produces structured connection records that directly map to the features our models were trained on (from UNSW-NB15 dataset).

### How Snort/Suricata CAN Fit In (Optional, Complementary)

```
Network Traffic
      │
      ├──→ Zeek ──→ ML Pipeline (our system, catches UNKNOWN attacks)
      │
      └──→ Suricata ──→ Known-attack alerts (catches KNOWN attacks)
                │
                └──→ Same Dashboard (combined view)
```

This is called a **hybrid detection approach**: signature-based + ML-based. This is the gold standard in modern IDS design, but implement the ML pipeline first, then add Suricata later as an enhancement.

---

## 6. Generating Your Own Traffic for Testing

Before connecting to a real network, you need test traffic. Here are safe ways to generate it:

### Method 1 — Replay Existing PCAP Files

Download publicly available pcap files and replay them:

```bash
# Download a sample pcap
wget https://www.netresec.com/files/sample.pcap

# Replay the pcap on a local interface using tcpreplay
sudo apt install tcpreplay
sudo tcpreplay -i eth0 --speed=1 sample.pcap
```

### Method 2 — Generate Traffic Between VMs

Set up two VMs on the same virtual network and generate traffic:

```bash
# On VM1: start a simple web server
python3 -m http.server 8080

# On VM2: send requests
curl http://vm1-ip:8080
wget http://vm1-ip:8080

# Simulate attack traffic with hping3
sudo apt install hping3
sudo hping3 -S -p 80 --flood vm1-ip  # SYN flood (DoS simulation)
```

### Method 3 — Use the UNSW-NB15 PCAP Files

The UNSW-NB15 dataset (which our models are trained on) includes original pcap files. You can replay these through Zeek to generate the exact same kind of flow data our models expect.

---

## 7. Key Decisions and Assumptions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Primary capture tool | Zeek | Produces structured flow data ideal for ML |
| Backup capture | tcpdump | Raw pcap archival for forensics |
| Data transport | Redis pub/sub | Fast, decoupled, well-supported in Python |
| Operating system | Ubuntu 22.04 LTS | Best support for Zeek, tcpdump, and ML tools |
| Network access | Mirror port or promiscuous mode | Non-inline, fail-open (doesn't break network if our system fails) |
| Traffic for dev/testing | pcap replay + VM traffic | Safe, reproducible |

---

## 8. Summary — What Happens in the Collector

```
1. Network traffic flows through switch/router
2. Mirror port sends a copy to our IDPS machine
3. Zeek monitors the interface and generates conn.log entries
4. Our Python parser reads new conn.log entries in real time
5. Each entry is converted to JSON and published to Redis (channel: flows:raw)
6. The Preprocessor (Part 3) picks up these records from Redis
```

**Time budget:** From packet arriving at the interface to JSON in Redis should take **< 2 seconds** under normal load.

---

**Next:** [Part 3 — Preprocessing, Feature Engineering & ML Prediction](packet_pipeline_part3_processing_ml.md)

---

*Document version: 1.0 — KodeMapper IDPS Project — Packet Pipeline Documentation (Part 2 of 4)*
