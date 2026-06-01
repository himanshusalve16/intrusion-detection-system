# IDPS Project — Complete Beginner's Network Security Guide

> **Written as a 20+ year Network Security Architect**
> Easy language. Real decisions. No fluff.

---

## 📌 How to Use This Document

This document solves your **3 exact problems**, in plain language. Every problem has:
- A simple explanation of **why** it is a problem
- **Multiple solutions** ranked by ease
- **Code/commands** you can copy
- A **⭐ Conclusion** that tells you exactly what to do

**Read in order the first time. After that, jump to any section you need.**

---

## 🗺️ Your Project at a Glance

You are building an **Intrusion Detection and Prevention System (IDPS)**. Here is what it does in one sentence:

> It watches all network traffic, figures out if something suspicious is happening, and either alerts you or blocks it automatically.

Your flowchart shows a 5-stage pipeline:

```
[Network Traffic]
      ↓
[Stage 1]  Collector   → tcpdump / tshark / Zeek captures raw packets
      ↓ Redis Queue
[Stage 2]  Preprocessor → extracts features, cleans, normalizes data
      ↓ Feature Vectors
[Stage 3]  ML Engine   → Random Forest / XGBoost / LSTM predicts: normal or attack?
      ↓ Prediction + Explanation
[Stage 4]  Response    → FastAPI backend + SOAR-LITE (auto blocking, alerting)
      ↓
[Stage 5]  Dashboard   → React UI, email/Slack alerts, mobile push
```

**Infrastructure underneath everything:** PostgreSQL, Redis, Docker Compose, Prometheus, Grafana, Nginx (TLS)

---

## 👥 Your 4 Roles / Machines

Before solving anything, understand who does what:

| Role | Physical Machine | Operating System | Job |
|------|-----------------|-----------------|-----|
| **Monitor** | Your main server/laptop | Ubuntu (VM or native) | Captures traffic, runs Zeek, Suricata, FastAPI, Redis, all the pipeline |
| **Machine 1** | Laptop 1 | Ubuntu or Windows | Normal user — browses, transfers files, generates "good" traffic |
| **Machine 2** | Laptop 2 | Ubuntu or Windows | Normal user — same as Machine 1 |
| **Attacker** | Laptop 3 | Kali Linux (recommended) | Generates attack traffic — port scans, brute force, DDoS simulation |

> **Simple analogy:** The Monitor is the security guard. Machine 1 and 2 are regular office employees. The Attacker is the burglar trying to break in.

---
---

# 🔴 PROBLEM 1: How to Capture Network Traffic and Give It to Zeek

## What Does "Traffic Capture" Even Mean?

Imagine your network is a highway. Every time Machine 1 sends a file to Machine 2, or opens a website, tiny "cars" called **packets** travel on this highway.

**Traffic capture** = putting a camera above this highway to photograph every car, without stopping them.

Your flowchart shows two ways to get that camera feed:
- **Mirror Port** (also called SPAN port): The switch/router makes a copy of all traffic and sends it to your monitor machine
- **TAP** (Test Access Point): A hardware device you plug inline that passively copies all packets

### The Real Problem for Your Setup

You are using a **mobile hotspot as your router**.

Mobile hotspots are "dumb" routers. They:
- Do **NOT** support SPAN/mirror ports
- Do **NOT** allow you to plug in a hardware TAP
- Actively **hide traffic** between connected devices (called "client isolation")

So you cannot use the diagram's "Mirror Port / TAP" literally. You need a **software equivalent** that achieves the same result.

Here are **all your options**, ranked from easiest to hardest:

---

## Solution 1A: Gateway Mode — Monitor IS the Highway 🏆 BEST FOR BEGINNERS

**The idea in one sentence:** Instead of watching the highway from above, YOU become the highway. All traffic passes THROUGH the Monitor, so it naturally sees 100% of it.

```
NORMAL (what you have now):
Machine1 ──→ Mobile Hotspot ──→ Internet
Machine2 ──→ Mobile Hotspot ──→ Internet
Attacker ──→ Mobile Hotspot ──→ Internet
Monitor sees NOTHING (only its own traffic)

GATEWAY MODE (what you want):
Machine1 ──→ Monitor ──→ Mobile Hotspot ──→ Internet
Machine2 ──→ Monitor ──→ Mobile Hotspot ──→ Internet
Attacker ──→ Monitor ──→ Mobile Hotspot ──→ Internet
Monitor sees EVERYTHING
```

No TAP hardware needed. No managed switch needed. The Monitor IS the TAP.

### How to Set This Up on Linux (Ubuntu VM on Monitor Machine)

**Step 1 — The Monitor machine needs 2 network connections:**
- **Interface 1 (eth0 or wlan0):** Connects to the internet (via mobile hotspot)
- **Interface 2 (eth1 or a second adapter):** Connects to Machine1/Machine2/Attacker

> **If you're using VMs (recommended for local testing):** VirtualBox handles this for you with virtual adapters. You do not need to physically add a second network card.

**Step 2 — Enable IP forwarding (tells Linux to pass packets along):**
```bash
# This tells Linux: "yes, forward packets from one interface to another"
sudo echo 1 > /proc/sys/net/ipv4/ip_forward

# To make it permanent (survives reboots):
sudo nano /etc/sysctl.conf
# Find the line: #net.ipv4.ip_forward=1
# Remove the # to uncomment it
# Save and exit, then run:
sudo sysctl -p
```

**Step 3 — Set up NAT (Network Address Translation):**
```bash
# This tells Linux: "packets coming from the internal machines,
# change their source IP to mine before sending to internet"
# Replace eth0 with your actual internet-facing interface name

sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i eth1 -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o eth1 -m state --state RELATED,ESTABLISHED -j ACCEPT
```

**Step 4 — Run Zeek on the internal interface:**
```bash
# Install Zeek
sudo apt-get update && sudo apt-get install zeek -y

# Run Zeek on the interface that faces Machine1/Machine2/Attacker
# Replace eth1 with your actual internal interface name
sudo zeek -i eth1 -C

# -C flag = don't verify checksums (important in VM environments)
```

**Step 5 — Check Zeek is working:**
```bash
# Zeek creates log files in the current directory
ls -la
# You should see: conn.log, http.log, dns.log, ssl.log, etc.

# Watch connections in real time:
tail -f conn.log
```

Now generate traffic from Machine1 (browse a website, ping something) and watch conn.log fill up.

**What Zeek logs look like in conn.log:**
```
ts          uid          id.orig_h     id.orig_p  id.resp_h    id.resp_p  proto  duration  orig_bytes
1700000001  C1234abcd    10.0.0.101    54321       8.8.8.8      53         udp    0.001     32
```
This means: at timestamp 1700000001, machine at 10.0.0.101 connected to Google DNS (8.8.8.8:53).

### Pros and Cons of Gateway Mode

| Pros | Cons |
|------|------|
| Sees 100% of all traffic | Monitor must always be on |
| Can BLOCK traffic (IPS capability!) | Single point of failure |
| No extra hardware needed | Needs 2 interfaces (or virtual equivalents) |
| Works with mobile hotspot | Adds slight latency |
| Best for learning how real firewalls work | |

---

## Solution 1B: Linux Bridge with tc Mirroring (Software TAP)

**The idea:** Create a virtual switch on Monitor that passes traffic AND copies it to Zeek. This is the closest you can get to a real TAP in software.

```
Machine1 ──→ [Bridge Interface br0] ──→ Internet
Machine2 ──→ [Bridge Interface br0] ──→ Internet
                      │
                      ↓ (tc mirrors a copy)
               [Zeek capture interface]
```

The bridge does two things at once: forwards the original packet, AND sends a copy to Zeek.

### Setup Commands

```bash
# Install bridge utilities
sudo apt-get install bridge-utils -y

# Create a bridge interface
sudo ip link add br0 type bridge
sudo ip link set br0 up

# Add your physical/virtual interfaces to the bridge
# Replace eth0, eth1 with your actual interface names
sudo ip link set eth0 master br0
sudo ip link set eth1 master br0

# Create a dummy interface for Zeek to listen on
sudo ip link add zeek0 type dummy
sudo ip link set zeek0 up

# Mirror ALL traffic on br0 to zeek0 using Traffic Control (tc)
sudo tc qdisc add dev br0 handle ffff: ingress
sudo tc filter add dev br0 parent ffff: protocol all u32 match u8 0 0 \
    action mirred egress mirror dev zeek0

# Now run Zeek on zeek0
sudo zeek -i zeek0 -C
```

### When to use this
Use this when you want the Monitor to be transparent (invisible to machines on the network). In Gateway mode, machines can see the Monitor's IP. In Bridge mode, the Monitor is invisible — it just silently copies everything.

---

## Solution 1C: Endpoint Capture Agents (Distributed Collection)

**The idea:** Instead of one central capture point, install a small capture agent on EACH machine. Each agent captures that machine's own traffic and sends logs to Monitor.

```
Machine1: [tcpdump or Zeek agent] → logs → Monitor
Machine2: [tcpdump or Zeek agent] → logs → Monitor
Attacker: [tcpdump or Zeek agent] → logs → Monitor
```

No gateway needed. Works even if machines are on different networks.

### Option C1: Filebeat + Zeek on each machine

**On Machine1 and Machine2:**
```bash
# Install Zeek
sudo apt-get install zeek -y

# Run Zeek on their local interface
sudo zeek -i eth0 -C

# Install Filebeat to ship logs to Monitor
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.0.0-amd64.deb
sudo dpkg -i filebeat-8.0.0-amd64.deb

# Configure Filebeat to send Zeek logs to Monitor's IP
# Edit /etc/filebeat/filebeat.yml:
#   filebeat.inputs:
#     - type: log
#       paths: ['/opt/zeek/logs/current/*.log']
#   output.logstash:
#     hosts: ["MONITOR_IP:5044"]
```

### Option C2: tcpdump piped over SSH to Monitor

```bash
# On Machine1, pipe tcpdump output directly to Monitor
# Replace MONITOR_IP with the actual IP
ssh user@MONITOR_IP "tcpdump -w -" | \
    sudo tcpdump -r - -w /tmp/machine1_capture.pcap

# On Monitor, run Zeek on that saved pcap
zeek -r /tmp/machine1_capture.pcap
```

### Option C3: Wazuh Agent (More Feature-Rich)

Wazuh is a full security agent. Install it on Machine1/Machine2 and it automatically:
- Monitors file integrity
- Captures network events
- Sends everything to Wazuh Server (running on Monitor)
- Provides a web dashboard for free

```bash
# On Monitor: Install Wazuh Server (follow official guide at wazuh.com)
# On Machine1/Machine2: Install Wazuh Agent
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | sudo apt-key add -
echo "deb https://packages.wazuh.com/4.x/apt/ stable main" | \
    sudo tee /etc/apt/sources.list.d/wazuh.list
sudo apt-get update && sudo apt-get install wazuh-agent -y

# Configure agent to point to Monitor's IP
sudo /var/ossec/bin/manage_agents  # Use this to register with server
```

### Pros and Cons of Endpoint Agents

| Pros | Cons |
|------|------|
| Works on any network topology | Must install software on each machine |
| Scalable (add more machines easily) | Agent could be disabled/tampered by attacker |
| No gateway bottleneck | Only sees that machine's own traffic |
| Good for deployment model | Zeek on each machine = more CPU usage |

---

## Solution 1D: Virtual Machines with Internal Network (BEST FOR PURE LOCAL TESTING)

**The idea:** Run all 4 roles as Virtual Machines on your physical laptops. In VirtualBox, you can create an "Internal Network" — a completely isolated virtual switch that only VMs can connect to. The Monitor VM is the gateway.

```
[Your Physical Laptop — Windows/Mac]
├── VM: Monitor   (Ubuntu 22.04) ← Zeek runs here
├── VM: Machine1  (Ubuntu)
├── VM: Machine2  (Ubuntu)
└── VM: Attacker  (Kali Linux)

All connected via VirtualBox "Internal Network: idps-lab"
Monitor has a second adapter bridged to your physical network (internet)
```

### VirtualBox Setup Steps

**For the Monitor VM:**
1. Open VirtualBox → Settings → Network
2. **Adapter 1:** Bridged Adapter (connects to your physical network/internet)
3. **Adapter 2:** Internal Network, name it `idps-lab`

**For Machine1, Machine2, Attacker VMs:**
1. Settings → Network
2. **Adapter 1:** Internal Network, name it `idps-lab`
3. No second adapter needed

**Inside Monitor VM (once started):**
```bash
# Check interface names
ip link show
# You'll see something like enp0s3 (internet) and enp0s8 (internal)

# Assign static IP on the internal interface
sudo ip addr add 10.0.0.1/24 dev enp0s8
sudo ip link set enp0s8 up

# Enable IP forwarding
sudo echo 1 > /proc/sys/net/ipv4/ip_forward

# NAT for internet access
sudo iptables -t nat -A POSTROUTING -o enp0s3 -j MASQUERADE
```

**Inside Machine1 VM:**
```bash
# Set IP and gateway to use Monitor as router
sudo ip addr add 10.0.0.101/24 dev enp0s3
sudo ip route add default via 10.0.0.1  # Monitor's IP
```

**Inside Machine2 VM:**
```bash
sudo ip addr add 10.0.0.102/24 dev enp0s3
sudo ip route add default via 10.0.0.1
```

**Inside Attacker VM (Kali):**
```bash
sudo ip addr add 10.0.0.200/24 dev eth0
sudo ip route add default via 10.0.0.1
```

Now run Zeek on Monitor's enp0s8 interface and it captures everything.

### Why VMs are Best for Testing

- You can take **snapshots** (save state, restore if broken)
- You can simulate attacks safely without affecting your real machines
- You get a **clean, reproducible** environment every time
- All 4 roles can run on ONE physical machine (saves you from needing all 4 laptops physically)

---

## ⭐ CONCLUSION FOR PROBLEM 1: Traffic Capture

```
IF you are doing local testing only:
    → Use VMs (Solution 1D) + Gateway Mode inside VMs (Solution 1A)
    → This is the cleanest, safest, most educational approach

IF you must use physical laptops with mobile hotspot:
    → Use ZeroTier (Problem 2 solution) + Gateway Mode (Solution 1A)
    → Configure Monitor as the ZeroTier gateway

IF you want to scale to deployment:
    → Use Endpoint Agents (Solution 1C) on physical laptops
    → Deploy Monitor on a cloud VM
    → Agents ship logs to cloud Monitor via ZeroTier

DO NOT:
    → Try to configure SPAN port on mobile hotspot (not possible)
    → Try to do this in WSL alone (packet capture is limited)
    → Buy a physical TAP before proving the software approach works
```

---
---

# 🔴 PROBLEM 2: Dynamic IPs / DHCP with Mobile Hotspot

## Why Changing IPs Break Your IDPS (Simple Explanation)

Your IDPS rules and logs rely on IP addresses to identify machines. For example:

**A Suricata rule might say:**
```
alert tcp 10.0.0.200 any -> 10.0.0.101 any (msg:"Port scan detected"; flags:S; threshold:type threshold, track by_src, count 100, seconds 10; sid:1001;)
```
Translation: "If IP 10.0.0.200 sends 100 TCP packets to Machine1 in 10 seconds, alert."

**The problem:** Tomorrow, your mobile hotspot gives Machine1 the IP `192.168.43.55` instead of `10.0.0.101`. Your rule now does nothing. Machine1 gets attacked and you don't know.

**In logs it's even worse:**
```
conn.log: 192.168.43.22 → 192.168.43.55 [attack detected]
```
Was `192.168.43.22` the attacker? Or was it Machine2? Yesterday it was Machine2. Today it's the attacker. You have no idea.

You need fixed, permanent IPs for all 4 machines.

---

## Solution 2A: ZeroTier — Virtual Overlay Network 🏆 BEST SOLUTION

**Think of ZeroTier like this:** Imagine all your devices have a secret radio. No matter where they physically are — at home, at college, using WiFi or 4G — the secret radio lets them talk to each other with the SAME fixed IP address every time.

ZeroTier creates a **virtual network on top of your real network**. It doesn't matter what IP your hotspot gives you. Your ZeroTier IP stays the same forever.

```
Physical Reality:
Monitor    → hotspot gives it: 192.168.43.10 (changes daily)
Machine1   → hotspot gives it: 192.168.43.22 (changes daily)
Machine2   → hotspot gives it: 192.168.43.30 (changes daily)
Attacker   → hotspot gives it: 192.168.43.45 (changes daily)

ZeroTier Virtual Reality (FIXED FOREVER):
Monitor    → always: 10.147.17.1
Machine1   → always: 10.147.17.2
Machine2   → always: 10.147.17.3
Attacker   → always: 10.147.17.4
```

Your Suricata rules, Zeek filters, and logs all use the ZeroTier IPs. Nothing ever breaks.

### ZeroTier Setup — Step by Step

**Step 1 — Create a free account and network:**
1. Go to `https://my.zerotier.com`
2. Create a free account (email + password)
3. Click "Create a Network"
4. You get a **Network ID** like `1c33c1ced0e43f2b` — save this

**Step 2 — Install ZeroTier on ALL 4 machines:**

On Ubuntu/Debian Linux:
```bash
curl -s https://install.zerotier.com | sudo bash
sudo systemctl enable zerotier-one
sudo systemctl start zerotier-one

# Join your network (replace with your actual Network ID)
sudo zerotier-cli join 1c33c1ced0e43f2b

# Check status
sudo zerotier-cli listnetworks
```

On Windows:
```
1. Download installer from: https://www.zerotier.com/download/
2. Run the installer
3. Right-click the ZeroTier icon in system tray
4. Click "Join New Network..."
5. Enter your Network ID
```

On Kali Linux (Attacker):
```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join 1c33c1ced0e43f2b
```

**Step 3 — Approve devices and assign fixed IPs:**
1. Go back to `https://my.zerotier.com` → your network
2. You'll see devices waiting for approval under "Members"
3. Check the checkboxes next to each device to authorize them
4. In the "Managed IPs" column, manually type the IP you want:
   - Monitor: `10.147.17.1`
   - Machine1: `10.147.17.2`
   - Machine2: `10.147.17.3`
   - Attacker: `10.147.17.4`

**Step 4 — Verify:**
```bash
# On Monitor, ping Machine1's ZeroTier IP
ping 10.147.17.2

# Should work even if you're on completely different WiFi networks
```

**Step 5 — Run Zeek on the ZeroTier interface:**
```bash
# Find the ZeroTier interface name
ip link show
# Look for something like "zt0" or "ztxxxxxx"

# Run Zeek on it
sudo zeek -i zt0 -C
```

### ZeroTier Pricing (Free for You)

| Plan | Devices | Price |
|------|---------|-------|
| Free | Up to 25 | ₹0 |
| Basic | Up to 200 | ~₹830/month |

You only have 4 machines. Free tier is perfect.

---

## Solution 2B: Tailscale — Even Simpler VPN

Tailscale is similar to ZeroTier but:
- Easier to set up (login with Google account)
- Uses WireGuard (faster, more modern protocol)
- Has built-in DNS (you can use `monitor.tailnet` instead of IPs)
- Free for up to 100 devices

### Tailscale Setup

**On Linux:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# It gives you a URL — open it in browser to authenticate with Google
```

**On Windows:**
1. Download from `https://tailscale.com/download`
2. Install and login with Google
3. Done — Tailscale auto-assigns a fixed IP like `100.64.x.x`

**Using hostnames (bonus feature):**
```bash
# With Tailscale MagicDNS, you can ping by name
ping monitor          # instead of 100.64.x.1
ping machine1         # instead of 100.64.x.2
```

### ZeroTier vs Tailscale — Direct Comparison

| Feature | ZeroTier | Tailscale |
|---------|----------|-----------|
| Free tier | 25 devices | 100 devices |
| Setup difficulty | Medium | Very Easy |
| IP assignment | You choose | Auto-assigned |
| Hostname support | No (by default) | Yes (MagicDNS) |
| Protocol | ZeroTier protocol | WireGuard |
| Speed | Good | Excellent |
| Works on hotspot | Yes | Yes |
| Works across different ISPs | Yes | Yes |
| Dashboard UI | Yes | Yes |
| Open source | Partial | Partial |

**Recommendation:** If you want control and custom IPs → ZeroTier. If you want the absolute easiest setup → Tailscale.

---

## Solution 2C: Private WiFi Router (Hardware Fix)

**The idea:** Buy a cheap WiFi router. Connect all 4 laptops to it. Mobile hotspot plugs into the router's WAN port for internet. The router manages your local network with stable IPs.

```
[Mobile Hotspot] → [Cheap TP-Link Router] → [All 4 Laptops]
                          ↑
               You control DHCP here
               You can do DHCP reservation
               IPs stay consistent
```

### Setup

1. Buy a cheap router (TP-Link TL-WR841N ≈ ₹800-1200)
2. Connect mobile hotspot to router via WiFi or ethernet (as WAN)
3. Connect all laptops to the TP-Link's WiFi network
4. In TP-Link admin panel → DHCP Reservation:
   - Find each laptop's MAC address
   - Assign a fixed IP to each MAC
   - They will always get the same IP

### Why this might be better than ZeroTier for some cases

- No software installation needed on laptops
- Better local bandwidth (traffic stays local, not routed through ZeroTier servers)
- Supports port mirroring on some TP-Link models
- Good for a permanent lab setup

### Limitation

- Still needs mobile hotspot for internet access
- Adds one more device to manage
- Does not help when machines are physically far apart

---

## Solution 2D: Manual Static IPs on Each Machine

**The idea:** Bypass DHCP entirely. Just hardcode the IP address on each machine.

**On Ubuntu:**
```bash
# Using nmcli (NetworkManager command line)
# Replace "Wi-Fi connection 1" with your actual connection name
# Find connection name: nmcli connection show

nmcli connection modify "Wi-Fi connection 1" \
    ipv4.addresses 192.168.43.100/24 \
    ipv4.gateway 192.168.43.1 \
    ipv4.dns 8.8.8.8 \
    ipv4.method manual

nmcli connection up "Wi-Fi connection 1"
```

**On Windows:**
1. Settings → Network & Internet → WiFi → [Your Network] → Edit IP assignment
2. Change to "Manual"
3. IPv4: `192.168.43.100`, Subnet: `255.255.255.0`, Gateway: `192.168.43.1`

### The Big Problem with Manual Static IPs + Mobile Hotspot

```
Today your hotspot IP range:   192.168.43.x
You set Machine1 to:           192.168.43.100

Tomorrow you turn hotspot off and on:
  New hotspot IP range:        192.168.91.x  ← DIFFERENT SUBNET
  Machine1 still has:          192.168.43.100 ← WRONG
  Machine1 cannot connect!
```

Mobile hotspots often change their subnet. Manual static IPs break every time this happens. **This is why ZeroTier is better** — it doesn't care what your physical IP is.

---

## Solution 2E: Hostnames in /etc/hosts

**The idea:** Even if IPs change, you can update one file on each machine and use names instead of IPs in your rules.

```bash
# On Monitor, edit /etc/hosts
sudo nano /etc/hosts

# Add lines for each machine:
10.147.17.1  monitor
10.147.17.2  machine1
10.147.17.3  machine2
10.147.17.4  attacker
```

**Use in Suricata rules:**
```
# Rules don't support hostnames directly in Suricata
# BUT you can use Suricata variables:

# In suricata.yaml:
vars:
  address-groups:
    MACHINE1: "10.147.17.2"   # Update only here when IP changes
    MACHINE2: "10.147.17.3"
    ATTACKER: "10.147.17.4"
```

This reduces the work of updating rules — change one variable, all rules update.

---

## ⭐ CONCLUSION FOR PROBLEM 2: Dynamic IPs

```
BEST CHOICE (use this):
    → ZeroTier (if you want control and custom IPs)
    → OR Tailscale (if you want the fastest setup)

WHY: Both give permanent virtual IPs that never change,
     work over mobile hotspot, are free, and take < 30 minutes to set up.

BACKUP CHOICE:
    → Private TP-Link router with DHCP reservation
    → Good if all machines are physically close together

AVOID:
    → Manual static IPs on mobile hotspot (breaks when hotspot subnet changes)
    → Relying on pure DHCP (IPs will change and break your logs/rules)

ACTION STEPS:
    1. Create ZeroTier account at my.zerotier.com
    2. Create a network
    3. Install ZeroTier on all 4 machines (15 min)
    4. Approve all devices, assign fixed IPs (5 min)
    5. Test ping between all machines (5 min)
    6. All future setup uses ZeroTier IPs only
```

---
---

# 🔴 PROBLEM 3: How to Connect the 4 Roles — Attacker, Monitor, Machine1, Machine2

This problem combines Problem 1 and Problem 2. Once you know how to capture traffic and fix IPs, you need to understand **how the 4 machines should be wired together** — both for local testing and for real deployment.

## Understanding What "Connected" Means Here

You need two types of connection:

1. **Network connectivity** — all machines can talk to each other (ping, SSH, HTTP)
2. **Traffic visibility** — Monitor can see the traffic BETWEEN Machine1 and Machine2, not just traffic TO/FROM Monitor

Type 1 is easy. ZeroTier handles it. Type 2 is harder. Here is the explanation:

```
WITHOUT GATEWAY MODE:
Machine1 ──ping──→ Machine2
Monitor sees nothing (not its traffic)

WITH GATEWAY MODE:
Machine1 ──→ Monitor ──→ Machine2
Monitor sees everything in the middle
```

---

## Setup Option A: Local Testing with VMs (STRONGLY RECOMMENDED for beginners)

**Run all 4 roles as VMs on 1 or 2 physical machines.**

This is the cleanest option because:
- You control everything
- No mobile hotspot interference
- Snapshots let you undo mistakes
- No extra laptops needed (all on one machine if it has enough RAM)
- You can simulate attacks safely

### Hardware Requirements

| RAM | What you can run |
|-----|-----------------|
| 8 GB | Monitor VM (2GB) + Attacker VM (2GB) — Machine1/2 as physical |
| 16 GB | All 4 VMs (Monitor 4GB, others 2GB each) |
| 32 GB | Comfortable for all 4 + development tools |

### Recommended VM Specs

| Role | OS | RAM | Storage | CPU |
|------|-----|-----|---------|-----|
| Monitor | Ubuntu 22.04 LTS | 4 GB | 40 GB | 2 cores |
| Machine1 | Ubuntu 22.04 | 2 GB | 20 GB | 1 core |
| Machine2 | Ubuntu 22.04 | 2 GB | 20 GB | 1 core |
| Attacker | Kali Linux 2024 | 2 GB | 30 GB | 2 cores |

### VirtualBox Network Configuration

```
Monitor VM:
  Adapter 1: Bridged (connects to your physical WiFi/hotspot → internet access)
  Adapter 2: Internal Network "idps-lab" (connects to other VMs)

Machine1 VM:
  Adapter 1: Internal Network "idps-lab"
  (no internet unless Monitor forwards it)

Machine2 VM:
  Adapter 1: Internal Network "idps-lab"

Attacker VM:
  Adapter 1: Internal Network "idps-lab"
  (or: NAT for internet access to download tools separately)
```

### IP Assignment (Static Inside VMs)

```
Monitor (Internal interface): 10.10.10.1
Machine1:                     10.10.10.101
Machine2:                     10.10.10.102
Attacker:                     10.10.10.200
```

Set these manually inside each VM using the commands from Problem 2.

### What Each VM Does During a Test Run

```
MACHINE1 VM:
  → Opens a browser to some website
  → Does a file transfer to Machine2
  → Represents "normal user traffic"

MACHINE2 VM:
  → Receives files from Machine1
  → Browses websites
  → Represents "normal user traffic"

ATTACKER VM:
  → Runs: nmap -sS 10.10.10.101    (port scan)
  → Runs: hping3 --flood 10.10.10.101  (flood attack)
  → Runs: hydra -l admin -P /usr/share/wordlists/rockyou.txt 10.10.10.101 ssh  (brute force)
  → Represents "malicious attacker"

MONITOR VM:
  → Zeek captures everything on 10.10.10.0/24 subnet
  → Suricata alerts on attack traffic
  → FastAPI serves alerts to dashboard
```

---

## Setup Option B: Physical Laptops + ZeroTier (Real Hardware Testing)

Use this when you want to test with actual physical laptops on mobile hotspot.

### Network Diagram

```
Physical Layer (mobile hotspot — IPs change):
[Monitor Laptop] ←→ [Hotspot] ←→ [Machine1 Laptop]
                              ←→ [Machine2 Laptop]
                              ←→ [Attacker Laptop]

ZeroTier Virtual Layer (IPs NEVER change):
Monitor:  10.147.17.1
Machine1: 10.147.17.2
Machine2: 10.147.17.3
Attacker: 10.147.17.4
```

### Making Monitor the Gateway for ZeroTier Traffic

This is how you get traffic visibility on physical laptops:

**On Monitor machine (Ubuntu VM or native):**
```bash
# Tell ZeroTier that Monitor is the gateway for this network
# 1. In ZeroTier dashboard → your network → Routes
#    Add a managed route:
#    Destination: 10.147.17.0/24
#    Via: 10.147.17.1  (Monitor's ZeroTier IP)

# 2. On Monitor, enable routing
sudo echo 1 > /proc/sys/net/ipv4/ip_forward
sudo iptables -t nat -A POSTROUTING -o zt0 -j MASQUERADE
```

**On Machine1/Machine2/Attacker:**
```bash
# Tell them to route all ZeroTier traffic through Monitor
sudo ip route add 10.147.17.0/24 via 10.147.17.1 dev zt0
```

**On Monitor, run Zeek on the ZeroTier interface:**
```bash
sudo zeek -i zt0 -C
```

Now when Attacker attacks Machine1 via ZeroTier IPs, the traffic goes through Monitor and Zeek sees it.

### Important Limitation with ZeroTier + Physical Laptops

ZeroTier creates a **peer-to-peer mesh network** by default. This means Machine1→Machine2 traffic does NOT go through Monitor unless you explicitly configure routing through Monitor.

The routing configuration above fixes this, but it requires Monitor to be running. If Monitor is off, ZeroTier still works but Monitor sees nothing.

---

## Setup Option C: Hybrid — Some VMs, Some Physical

**Best for your team:** You have 4 laptops physically. Use some as actual machines and some to host VMs.

```
[Laptop A — Windows] (Monitor Machine)
├── VirtualBox:
│   └── Ubuntu VM (Monitor) — runs Zeek, Suricata, Docker stack
│       └── Bridged to Laptop A's WiFi (ZeroTier inside the VM too)

[Laptop B] → Machine1 (physical, ZeroTier installed)

[Laptop C] → Machine2 (physical, ZeroTier installed)

[Laptop D] → Attacker (Kali Linux, physical or VM, ZeroTier installed)
```

All connected via ZeroTier. Monitor VM sees all ZeroTier traffic (with gateway routing).

---

## Setup Option D: Deployment — Cloud VM as Monitor

**For when your project is "done" and you want to run it in the real world:**

```
[Cloud VM — Oracle Always Free or AWS Free Tier]
  Ubuntu 22.04
  Docker Compose running:
  ├── zeek container
  ├── suricata container
  ├── fastapi container
  ├── redis container
  ├── postgresql container
  └── nginx container (reverse proxy, TLS)
  
  ZeroTier installed on the VM

[Your Physical Laptops]
├── Machine1 + ZeroTier
├── Machine2 + ZeroTier
└── Attacker + ZeroTier

Connection:
All laptops → ZeroTier → Cloud VM (Monitor)
Cloud VM acts as gateway for the ZeroTier network
Zeek runs on ZeroTier interface on Cloud VM
```

### Free Cloud VMs You Can Use

| Provider | Free Tier | RAM | Storage | Duration |
|---------|-----------|-----|---------|---------|
| Oracle Cloud Always Free | 4 ARM instances | 24 GB total | 200 GB | Forever |
| AWS Free Tier | 1 EC2 t2.micro | 1 GB | 30 GB | 12 months |
| Google Cloud Free | 1 f1-micro (some regions) | 0.6 GB | 30 GB | Forever |
| Azure Free | B1S VM | 1 GB | 64 GB | 12 months |

**Recommendation:** Oracle Cloud Always Free is the best — 24 GB of RAM free, forever, no credit card tricks.

---

## ⭐ CONCLUSION FOR PROBLEM 3: Connecting 4 Roles

```
FOR ABSOLUTE BEGINNERS (start here):
    → All 4 roles as VirtualBox VMs on one machine
    → Internal Network "idps-lab"
    → Monitor VM as gateway
    → Fixed IPs inside the VMs (manual static)
    → Zeek on Monitor VM's internal interface
    → This proves your pipeline works before touching real hardware

NEXT STEP — physical laptops:
    → Install ZeroTier on all 4 machines
    → Configure Monitor as ZeroTier gateway
    → Run Zeek on ZeroTier interface
    → Generates real traffic from physical machines
    → Proves the system works with real hardware

FINAL STEP — deployment:
    → Move Monitor stack to Oracle Cloud VM (free)
    → Docker Compose for all services
    → ZeroTier connects laptops to cloud Monitor
    → Nginx + TLS for dashboard access
    → This is your deployable, scalable version
```

---
---

# 🔄 Your Complete Pipeline — How Each Stage Works

Now that the 3 problems are solved, here is a full walkthrough of your flowchart — what each box does, how to implement it, and how stages connect.

---

## Stage 1: Collector Module (Traffic Capture)

**What it does:** Captures raw network packets and converts them to structured logs.

**Tools:** tcpdump, tshark, Zeek

**What Zeek produces:**

| Log File | What It Contains |
|----------|-----------------|
| `conn.log` | Every connection: who connected to whom, for how long, how many bytes |
| `http.log` | HTTP requests: URLs visited, user agents, response codes |
| `dns.log` | DNS queries: which domains were looked up |
| `ssl.log` | TLS/SSL connections: certificate info, cipher suites |
| `weird.log` | Anomalies: things Zeek considers unusual |
| `notice.log` | Zeek's own alerts |

**Running Zeek:**
```bash
# Real-time capture on interface
sudo zeek -i eth0 -C

# On a saved PCAP file (for testing with known attack traffic)
zeek -r attack_traffic.pcap

# With specific policy scripts (adds extra detection)
sudo zeek -i eth0 local.zeek
```

**Sending logs to Redis Queue:**
```python
# collector_agent.py
# This script watches Zeek's conn.log and pushes each new line to Redis

import redis
import time
import json

r = redis.Redis(host='localhost', port=6379, db=0)

def parse_zeek_conn_line(line):
    """Parse a tab-separated Zeek conn.log line"""
    if line.startswith('#'):  # Skip header lines
        return None
    
    fields = line.strip().split('\t')
    if len(fields) < 20:
        return None
    
    try:
        return {
            'ts': float(fields[0]),
            'uid': fields[1],
            'src_ip': fields[2],
            'src_port': int(fields[3]),
            'dst_ip': fields[4],
            'dst_port': int(fields[5]),
            'proto': fields[6],
            'service': fields[7],
            'duration': float(fields[8]) if fields[8] != '-' else 0.0,
            'orig_bytes': int(fields[9]) if fields[9] != '-' else 0,
            'resp_bytes': int(fields[10]) if fields[10] != '-' else 0,
            'conn_state': fields[11],
            'orig_pkts': int(fields[16]) if fields[16] != '-' else 0,
            'resp_pkts': int(fields[18]) if fields[18] != '-' else 0,
        }
    except (ValueError, IndexError):
        return None

def watch_zeek_log(log_path='/opt/zeek/logs/current/conn.log'):
    print(f"[Collector] Watching {log_path}")
    
    with open(log_path, 'r') as f:
        f.seek(0, 2)  # Jump to end of file
        
        while True:
            line = f.readline()
            
            if line:
                record = parse_zeek_conn_line(line)
                if record:
                    # Push to Redis queue named 'raw_traffic'
                    r.lpush('raw_traffic', json.dumps(record))
                    print(f"[Collector] Pushed: {record['src_ip']} → {record['dst_ip']}")
            else:
                time.sleep(0.1)  # Wait for new lines

if __name__ == '__main__':
    watch_zeek_log()
```

---

## Stage 2: Preprocessor Module

**What it does:** Takes raw Zeek log entries from Redis → extracts relevant features → scales/encodes → pushes clean feature vectors to next Redis queue.

**Why preprocessing?** ML models cannot directly read text like "tcp" or "SF". You must convert everything to numbers. Also, features with very different scales (bytes can be 0-10000000, duration 0-1.0) must be normalized.

**The preprocessor:**
```python
# preprocessor.py

import redis
import json
import numpy as np
from sklearn.preprocessing import StandardScaler
import pickle

r = redis.Redis(host='localhost', port=6379, db=0)

# Protocol encoding (text → number)
PROTO_MAP = {'tcp': 0, 'udp': 1, 'icmp': 2}
CONN_STATE_MAP = {'S0': 0, 'S1': 1, 'SF': 2, 'REJ': 3, 'S2': 4,
                  'S3': 5, 'RSTOS0': 6, 'RSTO': 7, 'RSTR': 8,
                  'SH': 9, 'RSTRH': 10, 'SHR': 11, 'OTH': 12}

def extract_features(record):
    """Convert a raw Zeek record into a feature vector"""
    
    features = {
        # Numerical features
        'duration': record.get('duration', 0.0),
        'orig_bytes': record.get('orig_bytes', 0),
        'resp_bytes': record.get('resp_bytes', 0),
        'orig_pkts': record.get('orig_pkts', 0),
        'resp_pkts': record.get('resp_pkts', 0),
        
        # Derived features (calculated from raw values)
        'bytes_ratio': (record.get('orig_bytes', 0) /
                       (record.get('resp_bytes', 1) + 1)),  # avoid div by zero
        'pkts_per_second': (record.get('orig_pkts', 0) /
                           (record.get('duration', 1) + 0.001)),
        
        # Encoded categorical features
        'proto_encoded': PROTO_MAP.get(record.get('proto', 'tcp'), 0),
        'conn_state_encoded': CONN_STATE_MAP.get(record.get('conn_state', 'SF'), 2),
        
        # Port-based features
        'dst_port': record.get('dst_port', 0),
        'is_well_known_port': 1 if record.get('dst_port', 0) < 1024 else 0,
    }
    
    return features

def normalize_features(features):
    """Scale features to similar ranges"""
    # In production, use a pre-fitted StandardScaler
    # For now, simple min-max style normalization
    
    feature_vector = [
        features['duration'],
        np.log1p(features['orig_bytes']),   # log scale for bytes
        np.log1p(features['resp_bytes']),
        np.log1p(features['orig_pkts']),
        np.log1p(features['resp_pkts']),
        features['bytes_ratio'],
        features['pkts_per_second'],
        features['proto_encoded'],
        features['conn_state_encoded'],
        features['is_well_known_port'],
    ]
    
    return feature_vector

def run_preprocessor():
    print("[Preprocessor] Running, waiting for data...")
    
    while True:
        # Pop from raw_traffic queue (blocking wait)
        _, raw_data = r.brpop('raw_traffic', timeout=30)
        
        if raw_data:
            record = json.loads(raw_data)
            
            # Extract and normalize features
            features = extract_features(record)
            feature_vector = normalize_features(features)
            
            # Package with metadata
            processed = {
                'original': record,
                'features': feature_vector,
                'feature_names': ['duration', 'orig_bytes_log', 'resp_bytes_log',
                                  'orig_pkts_log', 'resp_pkts_log', 'bytes_ratio',
                                  'pkts_per_second', 'proto', 'conn_state',
                                  'is_well_known_port']
            }
            
            # Push to next queue for ML Engine
            r.lpush('processed_traffic', json.dumps(processed))
            print(f"[Preprocessor] Processed record from {record.get('src_ip')}")

if __name__ == '__main__':
    run_preprocessor()
```

---

## Stage 3: ML Engine Module

**What it does:** Takes feature vectors, runs them through trained ML models, returns a prediction: "normal" or "attack" (and which type).

**Training (offline — done before running the system):**
```python
# train_model.py
# Run this once to train your model on a dataset

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle

# Download NSL-KDD dataset from Kaggle
# https://www.kaggle.com/datasets/hassan06/nslkdd

# Load dataset
df = pd.read_csv('KDDTrain+.csv')

# Select your feature columns
FEATURES = ['duration', 'src_bytes', 'dst_bytes', 'land',
            'wrong_fragment', 'urgent', 'hot', 'num_failed_logins',
            'logged_in', 'num_compromised', 'protocol_type', 'flag']

X = df[FEATURES]
y = df['label'].apply(lambda x: 0 if x == 'normal' else 1)  # 0=normal, 1=attack

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train Random Forest
model = RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=42)
model.fit(X_train, y_train)

# Evaluate
print(classification_report(y_test, model.predict(X_test)))

# Save model
with open('rf_model.pkl', 'wb') as f:
    pickle.dump(model, f)

print("Model saved to rf_model.pkl")
```

**Inference (online — runs continuously on live traffic):**
```python
# ml_engine.py

import redis
import json
import pickle
import numpy as np
import shap

r = redis.Redis(host='localhost', port=6379, db=0)

# Load trained model
with open('rf_model.pkl', 'rb') as f:
    model = pickle.load(f)

# SHAP explainer for interpretability
explainer = shap.TreeExplainer(model)

ATTACK_TYPES = {0: 'normal', 1: 'dos', 2: 'probe', 3: 'r2l', 4: 'u2r'}

def predict_and_explain(feature_vector):
    """Run prediction and generate SHAP explanation"""
    
    fv = np.array(feature_vector).reshape(1, -1)
    
    # Prediction
    prediction = model.predict(fv)[0]
    probabilities = model.predict_proba(fv)[0]
    confidence = float(np.max(probabilities))
    
    # SHAP explanation (shows which features contributed most to the decision)
    shap_values = explainer.shap_values(fv)
    # shap_values[1] = values for the "attack" class
    explanation = shap_values[1][0].tolist() if isinstance(shap_values, list) else shap_values[0].tolist()
    
    return {
        'prediction': int(prediction),
        'label': 'attack' if prediction == 1 else 'normal',
        'confidence': confidence,
        'probabilities': probabilities.tolist(),
        'shap_explanation': explanation
    }

def run_ml_engine():
    print("[ML Engine] Running, waiting for processed data...")
    
    while True:
        _, data = r.brpop('processed_traffic', timeout=30)
        
        if data:
            processed = json.loads(data)
            
            # Run ML prediction
            result = predict_and_explain(processed['features'])
            
            # Combine everything into one alert record
            alert = {
                **processed['original'],    # original connection info
                **result,                   # prediction and explanation
                'feature_names': processed.get('feature_names', [])
            }
            
            # Push to alerts queue (for FastAPI) and store in Redis
            r.lpush('predictions', json.dumps(alert))
            
            if result['label'] == 'attack':
                r.lpush('alerts', json.dumps(alert))
                r.expire('alerts', 86400)  # Keep alerts for 24 hours
                print(f"[ML Engine] 🚨 ATTACK DETECTED from {alert.get('src_ip')} | confidence: {result['confidence']:.2%}")
            else:
                print(f"[ML Engine] ✅ Normal traffic from {alert.get('src_ip')}")

if __name__ == '__main__':
    run_ml_engine()
```

---

## Stage 4: Backend API + SOAR-LITE

**What it does:** FastAPI serves alerts to the dashboard, handles manual actions (block/unblock), and SOAR-LITE auto-responds to high-confidence detections.

```python
# main.py — FastAPI backend

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
import subprocess
import asyncio
from datetime import datetime

app = FastAPI(title="IDPS API", version="1.0.0")

# Allow React dashboard to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

r = redis.Redis(host='localhost', port=6379, db=0)

# ─── REST Endpoints ──────────────────────────────────────────────

@app.get("/alerts")
async def get_alerts(limit: int = 50):
    """Get recent alerts"""
    alerts = r.lrange('alerts', 0, limit - 1)
    return [json.loads(a) for a in alerts]

@app.get("/stats")
async def get_stats():
    """Get traffic statistics"""
    return {
        "total_predictions": r.llen('predictions'),
        "total_alerts": r.llen('alerts'),
        "blocked_ips": list(r.smembers('blocked_ips')),
    }

@app.post("/block/{ip}")
async def block_ip(ip: str):
    """Block an IP address using iptables"""
    try:
        # Add iptables rule to drop traffic from this IP
        subprocess.run(
            ['iptables', '-A', 'INPUT', '-s', ip, '-j', 'DROP'],
            check=True
        )
        subprocess.run(
            ['iptables', '-A', 'FORWARD', '-s', ip, '-j', 'DROP'],
            check=True
        )
        
        # Track blocked IPs in Redis
        r.sadd('blocked_ips', ip)
        
        # Log the action
        log_entry = {
            'action': 'block',
            'ip': ip,
            'timestamp': datetime.utcnow().isoformat(),
            'by': 'manual'
        }
        r.lpush('audit_log', json.dumps(log_entry))
        
        return {"status": "blocked", "ip": ip}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to block IP: {e}")

@app.delete("/block/{ip}")
async def unblock_ip(ip: str):
    """Unblock an IP address"""
    subprocess.run(['iptables', '-D', 'INPUT', '-s', ip, '-j', 'DROP'])
    subprocess.run(['iptables', '-D', 'FORWARD', '-s', ip, '-j', 'DROP'])
    r.srem('blocked_ips', ip)
    return {"status": "unblocked", "ip": ip}

@app.get("/audit")
async def get_audit_log(limit: int = 100):
    """Get all auto/manual block actions"""
    entries = r.lrange('audit_log', 0, limit - 1)
    return [json.loads(e) for e in entries]

# ─── WebSocket for Real-time Alerts ─────────────────────────────

@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """Push new alerts to dashboard in real time"""
    await websocket.accept()
    
    last_seen = r.llen('alerts')
    
    try:
        while True:
            current_len = r.llen('alerts')
            
            if current_len > last_seen:
                # New alerts arrived — send them
                new_alerts = r.lrange('alerts', 0, current_len - last_seen - 1)
                for alert_data in reversed(new_alerts):
                    alert = json.loads(alert_data)
                    await websocket.send_json(alert)
                last_seen = current_len
            
            await asyncio.sleep(0.5)
    except Exception:
        pass

# ─── SOAR-LITE Auto Response ─────────────────────────────────────

CONFIDENCE_AUTO_BLOCK = 0.95    # Above this → auto block
CONFIDENCE_ALERT_ONLY = 0.70    # Above this → alert only
WHITELIST = ['10.10.10.1', '127.0.0.1']  # Never block these

async def soar_response(alert: dict):
    """Automated response based on confidence level"""
    
    ip = alert.get('src_ip')
    confidence = alert.get('confidence', 0)
    label = alert.get('label', 'normal')
    
    # Don't act on whitelisted IPs
    if ip in WHITELIST:
        return
    
    # Don't re-block already blocked IPs
    if r.sismember('blocked_ips', ip):
        return
    
    if label == 'attack':
        if confidence >= CONFIDENCE_AUTO_BLOCK:
            # HIGH confidence → auto block
            await block_ip(ip)
            log_entry = {
                'action': 'auto_block',
                'ip': ip,
                'confidence': confidence,
                'timestamp': datetime.utcnow().isoformat(),
                'by': 'SOAR'
            }
            r.lpush('audit_log', json.dumps(log_entry))
            print(f"[SOAR] Auto-blocked {ip} (confidence: {confidence:.2%})")
            
        elif confidence >= CONFIDENCE_ALERT_ONLY:
            # MEDIUM confidence → alert only, human decides
            print(f"[SOAR] Alert for {ip} (confidence: {confidence:.2%}) — awaiting approval")
```

---

## Stage 5: Dashboard (React)

A basic React dashboard that connects to your FastAPI backend:

```jsx
// App.jsx — Simple IDPS Dashboard

import { useState, useEffect } from "react";

const API_BASE = "http://10.10.10.1:8000"; // Monitor's IP

function AlertsTable({ alerts }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Time</th><th>Source IP</th><th>Dest IP</th>
          <th>Label</th><th>Confidence</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((alert, i) => (
          <tr key={i} style={{background: alert.label === 'attack' ? '#ffeeee' : '#eeffee'}}>
            <td>{new Date(alert.ts * 1000).toLocaleTimeString()}</td>
            <td>{alert.src_ip}</td>
            <td>{alert.dst_ip}</td>
            <td><b>{alert.label.toUpperCase()}</b></td>
            <td>{(alert.confidence * 100).toFixed(1)}%</td>
            <td>
              {alert.label === 'attack' && (
                <button onClick={() => fetch(`${API_BASE}/block/${alert.src_ip}`, {method: 'POST'})}>
                  Block IP
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    // Load initial alerts
    fetch(`${API_BASE}/alerts`).then(r => r.json()).then(setAlerts);
    fetch(`${API_BASE}/stats`).then(r => r.json()).then(setStats);

    // Connect WebSocket for real-time updates
    const ws = new WebSocket(`ws://10.10.10.1:8000/ws/alerts`);
    ws.onmessage = (e) => {
      const alert = JSON.parse(e.data);
      setAlerts(prev => [alert, ...prev].slice(0, 100));
    };

    return () => ws.close();
  }, []);

  return (
    <div>
      <h1>IDPS Dashboard</h1>
      <div>
        <span>Total Alerts: {stats.total_alerts}</span>
        <span>Blocked IPs: {stats.blocked_ips?.length}</span>
      </div>
      <AlertsTable alerts={alerts} />
    </div>
  );
}
```

---
---

# 📦 Complete Docker Compose Setup (For Deployment)

When you're ready to deploy everything on your server/cloud VM:

```yaml
# docker-compose.yml

version: '3.8'

services:

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: idps
      POSTGRES_USER: idps_user
      POSTGRES_PASSWORD: change_this_password
    volumes:
      - pg_data:/var/lib/postgresql/data
    restart: unless-stopped

  zeek:
    image: zeek/zeek:latest
    network_mode: host           # Needs host networking to capture packets
    volumes:
      - zeek_logs:/opt/zeek/logs
    command: zeek -i zt0 -C local.zeek    # Replace zt0 with your interface
    restart: unless-stopped
    privileged: true             # Needs root for packet capture

  collector:
    build: ./collector            # Your collector_agent.py
    depends_on:
      - redis
      - zeek
    volumes:
      - zeek_logs:/opt/zeek/logs:ro
    environment:
      - REDIS_HOST=redis
    restart: unless-stopped

  preprocessor:
    build: ./preprocessor
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
    restart: unless-stopped

  ml_engine:
    build: ./ml_engine
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
    volumes:
      - ./models:/app/models    # Your trained .pkl files
    restart: unless-stopped

  backend:
    build: ./backend             # Your FastAPI app
    ports:
      - "8000:8000"
    depends_on:
      - redis
      - postgres
    environment:
      - REDIS_HOST=redis
      - DATABASE_URL=postgresql://idps_user:change_this_password@postgres/idps
    restart: unless-stopped

  dashboard:
    build: ./dashboard           # Your React app
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - dashboard
    restart: unless-stopped

volumes:
  redis_data:
  pg_data:
  zeek_logs:
```

---
---

# 🚀 Your Action Plan — Phase by Phase

Follow this in order. Do NOT skip phases. Each phase proves the previous one works.

---

## Phase 0: Understand Your Tools (1-2 days)

Before writing a single line of code:

1. Read what Zeek does: `https://docs.zeek.org/en/master/quickstart.html`
2. Read what Suricata does: `https://docs.suricata.io/en/latest/quickstart.html`
3. Watch one YouTube video on how TCP/IP works
4. Understand what an IP packet header looks like

> **Why this matters:** You cannot debug a capture problem if you don't know what you're looking at.

---

## Phase 1: Prove Connectivity (Days 1-3)

**Goal:** All 4 machines can ping each other.

Steps:
1. Install VirtualBox on your main laptop
2. Download Ubuntu 22.04 ISO (`ubuntu.com/download`)
3. Download Kali Linux ISO (`kali.org/get-kali`)
4. Create 4 VMs (Monitor, Machine1, Machine2, Attacker)
5. Set Monitor's Adapter 2 to Internal Network "idps-lab"
6. Set Machine1/2/Attacker to Internal Network "idps-lab"
7. Assign static IPs inside each VM
8. Ping test: from Machine1, `ping 10.10.10.1` (Monitor)

**✅ Success when:** All 4 VMs can ping each other

**Common problems:**
- Firewall blocking pings: `sudo ufw disable` (in testing only)
- Wrong interface name: run `ip link show` to find the right name
- VMs on different Internal Network names: check spelling in VirtualBox settings

---

## Phase 2: Capture Traffic (Days 3-7)

**Goal:** Zeek on Monitor captures traffic from Machine1.

Steps:
1. On Monitor VM, install Zeek:
   ```bash
   sudo apt-get install zeek -y
   ```
2. Configure Monitor as gateway (IP forwarding + iptables NAT)
3. On Machine1, set default route to Monitor: `sudo ip route add default via 10.10.10.1`
4. On Monitor, run Zeek: `sudo zeek -i enp0s8 -C`
5. On Machine1, generate traffic: `curl http://example.com`
6. On Monitor, check logs: `cat conn.log`

**✅ Success when:** conn.log shows Machine1's IP (10.10.10.101) as a source

---

## Phase 3: Basic Attack Detection (Days 7-14)

**Goal:** Suricata alerts when Attacker runs nmap on Machine1.

Steps:
1. Install Suricata on Monitor:
   ```bash
   sudo apt-get install suricata -y
   ```
2. Write a simple rule in `/etc/suricata/rules/local.rules`:
   ```
   alert tcp any any -> 10.10.10.101 any (msg:"Port Scan Detected"; flags:S; threshold:type threshold, track by_src, count 20, seconds 5; sid:1000001; rev:1;)
   ```
3. Run Suricata:
   ```bash
   sudo suricata -i enp0s8 -c /etc/suricata/suricata.yaml
   ```
4. On Attacker VM (Kali), run nmap:
   ```bash
   nmap -sS 10.10.10.101
   ```
5. Check Suricata alerts:
   ```bash
   cat /var/log/suricata/fast.log
   ```

**✅ Success when:** fast.log shows "Port Scan Detected"

---

## Phase 4: Redis Pipeline (Days 14-21)

**Goal:** Zeek logs flow into Redis queue automatically.

Steps:
1. Install Redis: `sudo apt-get install redis-server -y`
2. Install Python dependencies: `pip install redis pandas scikit-learn`
3. Write and run `collector_agent.py` (code from Stage 1 above)
4. Write and run `preprocessor.py` (code from Stage 2 above)
5. Test: generate traffic from Machine1, watch Redis queues fill up
   ```bash
   redis-cli llen raw_traffic     # Should increase
   redis-cli llen processed_traffic  # Should increase
   ```

**✅ Success when:** Both Redis queues show increasing length

---

## Phase 5: ML Model (Days 21-35)

**Goal:** Model correctly labels attack vs normal traffic.

Steps:
1. Download NSL-KDD dataset from Kaggle
2. Run `train_model.py` to train Random Forest model
3. Evaluate: target at least 95% accuracy on test set
4. Write and run `ml_engine.py` (code from Stage 3 above)
5. Generate attack traffic from Attacker VM
6. Check Redis `alerts` queue: `redis-cli lrange alerts 0 5`

**✅ Success when:** Attack traffic appears in `alerts` queue with `label: attack`

---

## Phase 6: FastAPI Backend (Days 35-45)

**Goal:** REST API serves alerts to browser.

Steps:
1. Install FastAPI: `pip install fastapi uvicorn`
2. Write `main.py` (code from Stage 4 above)
3. Run: `uvicorn main:app --host 0.0.0.0 --port 8000`
4. Open browser: `http://10.10.10.1:8000/alerts`
5. Open API docs: `http://10.10.10.1:8000/docs`

**✅ Success when:** Alerts appear in browser at `/alerts`

---

## Phase 7: React Dashboard (Days 45-60)

**Goal:** Visual dashboard showing live alerts.

Steps:
1. Create React app: `npx create-react-app dashboard`
2. Write `App.jsx` (code from Stage 5 above)
3. Install axios: `npm install axios`
4. Run: `npm start`
5. Test: generate attack, see it appear on dashboard

**✅ Success when:** Dashboard shows live attack alerts with block button

---

## Phase 8: Dockerize Everything (Days 60-75)

**Goal:** One command starts the entire system.

Steps:
1. Write `Dockerfile` for each component
2. Write `docker-compose.yml` (code in deployment section above)
3. Run: `docker-compose up -d`
4. Test the complete pipeline end-to-end

**✅ Success when:** `docker-compose up` brings up everything and pipeline works

---

## Phase 9: Cloud Deployment (Days 75+)

**Goal:** System runs on cloud, accessible from anywhere.

Steps:
1. Create Oracle Cloud free account
2. Create a VM (Ubuntu 22.04, ARM, 4 GB RAM)
3. Install Docker + ZeroTier on cloud VM
4. Copy your `docker-compose.yml` to cloud VM
5. Run ZeroTier, join your network
6. Test pipeline from physical laptops via ZeroTier

**✅ Success when:** Dashboard accessible from any browser in the world

---
---

# ⚠️ Common Mistakes to Avoid

These are mistakes real beginners make. Avoid them.

| Mistake | Why it's a problem | What to do instead |
|---------|-------------------|-------------------|
| Using WSL as main IDS platform | Packet capture is severely limited in WSL | Use a full Ubuntu VM in VirtualBox |
| Jumping to ML before capture works | ML on garbage data = garbage results | Prove capture → prove detection → then add ML |
| Writing iptables rules without testing | You might lock yourself out | Always test: `iptables -nvL` first, have a console backup |
| Running Zeek without `-C` on VMs | Checksum offloading in VMs causes Zeek to drop packets | Always use `-C` flag in VM environments |
| Storing raw PCAPs forever | PCAPs are huge, you'll run out of disk fast | Use Zeek logs (much smaller) + circular buffer for PCAPs |
| Blocking Monitor's own IP | You'll cut off the pipeline | Always whitelist Monitor's IP in SOAR rules |
| Not taking VM snapshots | One bad command can break your whole setup | Snapshot after every working phase |
| Testing with only one attack type | Your model will overfit | Use diverse attacks: scan, brute force, flood, web attacks |
| Forgetting to save iptables rules | Rules disappear after reboot | `sudo iptables-save > /etc/iptables/rules.v4` |
| Opening port 8000 to the public without auth | Anyone can access your IDPS | Always put Nginx + auth in front of FastAPI |

---

# 📚 Resources and References

## Datasets for Training Your ML Model

| Dataset | Download | Size | Best For |
|---------|---------|------|---------|
| NSL-KDD | kaggle.com/datasets/hassan06/nslkdd | 24 MB | Beginner, well-documented |
| CICIDS2017 | unb.ca/cic/datasets | 50 GB | Modern attacks, realistic |
| UNSW-NB15 | unsw.edu.au/research | 100 MB | Balanced, well-labeled |
| PCAP files | malware-traffic-analysis.net | Varies | Real malware traffic |

## Tools and Their Documentation

| Tool | What it does | Link |
|------|-------------|------|
| Zeek | Deep packet inspection, flow analysis | docs.zeek.org |
| Suricata | Signature-based IDS/IPS | docs.suricata.io |
| ZeroTier | Virtual overlay network | zerotier.com/manual |
| Tailscale | Simple WireGuard VPN | tailscale.com/kb |
| FastAPI | Python REST API framework | fastapi.tiangolo.com |
| Redis | In-memory queue and cache | redis.io/docs |
| Grafana | Monitoring dashboards | grafana.com/docs |
| Prometheus | Metrics collection | prometheus.io/docs |
| Wazuh | Security agent + SIEM | documentation.wazuh.com |
| VirtualBox | Free VM software | virtualbox.org/manual |

## Attack Tools for Testing (Use Only on Your Own Lab)

| Tool | What it does | Command example |
|------|-------------|----------------|
| nmap | Port scanning | `nmap -sS -p- 10.10.10.101` |
| hping3 | Packet crafting, flood attacks | `sudo hping3 --flood -S 10.10.10.101` |
| hydra | Brute force login | `hydra -l root -P wordlist.txt 10.10.10.101 ssh` |
| Metasploit | Full exploit framework | `msfconsole` |
| scapy | Custom packet crafting | Python library |
| iperf3 | Bandwidth flooding | `iperf3 -c 10.10.10.101 -t 60` |

---

# 🏁 Final Summary — Everything in One Place

```
YOUR 3 PROBLEMS → 3 SOLUTIONS:

PROBLEM 1 (Traffic Capture):
  Solution: Run Monitor as gateway (all traffic passes through it)
  + Run Zeek on the interface facing the other machines
  + No TAP or mirror port needed

PROBLEM 2 (Dynamic IPs from Mobile Hotspot):
  Solution: Install ZeroTier on all 4 machines
  + Assign fixed virtual IPs that NEVER change
  + All rules, logs, and configs use ZeroTier IPs

PROBLEM 3 (Connecting 4 Roles):
  Testing: VMs in VirtualBox with Internal Network
  Physical: ZeroTier + Gateway Mode on Monitor
  Deployment: Cloud VM (Oracle Free) + ZeroTier + Docker Compose

YOUR RECOMMENDED STACK:
  Network:     ZeroTier (fixed IPs everywhere)
  VM Software: VirtualBox (for local testing)
  Capture:     Zeek (logs) + tcpdump (raw PCAP)
  Detection:   Suricata (signatures) + ML model (pattern-based)
  Queue:       Redis (between pipeline stages)
  Backend:     FastAPI (REST + WebSocket)
  Database:    PostgreSQL (long-term storage)
  Dashboard:   React (alerts UI)
  Deployment:  Docker Compose + Nginx + Oracle Cloud Free Tier
  VPN:         ZeroTier (connecting all machines)

YOUR BUILD ORDER:
  Phase 1  → Connectivity (all VMs ping each other)
  Phase 2  → Capture (Zeek logs traffic)
  Phase 3  → Detection (Suricata alerts on attacks)
  Phase 4  → Pipeline (Redis queue working)
  Phase 5  → ML (model predicts attack vs normal)
  Phase 6  → API (FastAPI serves alerts)
  Phase 7  → Dashboard (React shows live alerts)
  Phase 8  → Docker (one command startup)
  Phase 9  → Cloud (deployed on Oracle VM)
```

---

*This document was written for beginners who know what they want to build but need clear, practical guidance on how to actually build it. Every solution here has been chosen for: zero cost, open source tools, beginner-friendliness, and a clear path to a real deployable project.*

*Last updated: June 2026*
