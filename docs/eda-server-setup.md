# EDA Server Setup Guide

**Configuring the EDA Environment for HiPilot**

---

## Server Information

| Attribute | Value |
|-----------|-------|
| **Host** | 192.168.112.163 |
| **User** | EDA |
| **Password** | eda2020 |
| **Root Password** | 2020 |
| **OS** | CentOS 7.9.2009 |
| **glibc** | 2.17 |
| **Workspace** | `/home/EDA/hipilot_test/` |

---

## Connection Methods

### Interactive SSH

```bash
ssh EDA@192.168.112.163
# Password: eda2020
```

### Non-Interactive SSH (for automation)

```bash
# Install sshpass if not available
# macOS: brew install sshpass
# Linux: apt install sshpass

# Define alias
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Run commands
$SSH "echo 'Connected'"
$SSH "ls /home/EDA/hipilot_test/"
```

### SSH with X11 Forwarding (for GUI)

```bash
sshpass -p 'eda2020' ssh -X EDA@192.168.112.163
```

---

## Node.js Setup

### Required Version

CentOS 7 uses glibc 2.17, which requires a special Node.js build.

**Location:** `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/`

### Setup

```bash
# Add to PATH (add to ~/.bashrc for persistence)
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Verify
node --version  # Should output: v20.18.3
npm --version   # Should output: 10.8.2
```

### Common Mistakes

❌ **Wrong:** Using standard Node.js build
```bash
# This requires glibc 2.28+ and will fail
node-v20.18.3-linux-x64.tar.xz
```

✅ **Correct:** Using glibc-217 compatible build
```bash
node-v20.18.3-linux-x64-glibc-217.tar.xz
```

---

## tmux Setup

### Required Version

HiPilot requires tmux 1.8+ (3.4+ recommended for best compatibility).

### Check Version

```bash
tmux -V
```

### Building tmux 3.4 from Source (CentOS 7)

```bash
# Install dependencies
sudo yum install -y gcc automake libevent-devel ncurses-devel

# Download and build
cd /tmp
git clone https://github.com/tmux/tmux.git
cd tmux
git checkout 3.4
sh autogen.sh
./configure --prefix=$HOME/.local
make
make install

# Add to PATH
export PATH=$HOME/.local/bin:$PATH
```

---

## EDA Tools

### Available Tools

| Tool | Vendor | Version | Location |
|------|--------|---------|----------|
| Innovus | Cadence | v20.10-p004_1 | `/opt/cadence/INNOVUS20.10/` |
| PrimeTime | Synopsys | T-2022.03 | `/opt/synopsys/prime_2022.03/` |
| ICC2 | Synopsys | T-2022.03 | `/opt/synopsys/icc2_2022.03/` |
| Design Compiler | Synopsys | T-2022.03 | `/opt/synopsys/syn_2022.03/` |
| Calibre | Mentor | Latest | `/opt/mentor/calibre/` |
| StarRC | Synopsys | Latest | `/opt/synopsys/starrc/` |
| Voltus | Cadence | Latest | `/opt/cadence/voltus/` |

### Starting Tools

```bash
# Innovus (no GUI)
innovus -nowin

# Innovus (with GUI)
innovus

# PrimeTime
pt_shell

# Design Compiler
dc_shell-topo

# ICC2
icc2_shell
```

---

## HiPilot Installation

### Directory Structure

```
/home/EDA/hipilot_test/
├── node-v20.18.3-linux-x64-glibc-217/  # Node.js
├── hipilot/                            # HiPilot installation
│   ├── bin/hipilot
│   ├── servers/
│   ├── skills/
│   └── scripts/
├── ibex_work_upload/                   # Ibex design
│   ├── Makefile
│   ├── rtl/
│   ├── scripts/
│   └── result/
└── recordings/                         # Demo recordings
```

### Install HiPilot

```bash
# Navigate to workspace
cd /home/EDA/hipilot_test

# Clone or copy HiPilot
git clone https://github.com/qfliuyang/hipilot.git
cd hipilot

# Install dependencies
npm run install:all
```

---

## Claude Code Setup

### Install Claude Code

```bash
# Install globally
npm install -g @anthropic/claude-code

# Verify
claude --version
```

### Configure MCP Servers

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "eda": {
      "command": "node",
      "args": ["/home/EDA/hipilot_test/hipilot/servers/eda/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot"
      }
    },
    "tmux": {
      "command": "node",
      "args": ["/home/EDA/hipilot_test/hipilot/servers/tmux/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot"
      }
    },
    "knowledge": {
      "command": "node",
      "args": ["/home/EDA/hipilot_test/hipilot/servers/knowledge/index.js"]
    }
  }
}
```

### Start Claude Code

```bash
# Set Node path
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Navigate to HiPilot
cd /home/EDA/hipilot_test/hipilot

# Start Claude Code
claude --dangerously-skip-permissions
```

---

## Workspace Setup

### Create tmux Workspace

```bash
# Kill old sessions
pkill -u EDA tmux

# Create new session
tmux new-session -d -s hipilot -x 240 -y 60

# Split into two panes
tmux split-window -h -t hipilot:0

# Start Innovus in right pane
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload" C-m
tmux send-keys -t hipilot:0.1 "innovus -nowin" C-m

# Start Claude Code in left pane (wait for Innovus)
sleep 10
tmux send-keys -t hipilot:0.0 "cd /home/EDA/hipilot_test/hipilot" C-m
tmux send-keys -t hipilot:0.0 "claude --dangerously-skip-permissions" C-m

# Attach to session
tmux attach -t hipilot
```

### Workspace Layout

```
┌────────────────────────────────┬────────────────────────────────┐
│         Pane 0 (Left)          │         Pane 1 (Right)         │
│                                │                                │
│     Claude Code (HiPilot)      │     EDA Tool (Innovus)         │
│                                │                                │
│     - Send commands            │     - Execute Tcl              │
│     - View results             │     - Generate reports         │
│                                │                                │
└────────────────────────────────┴────────────────────────────────┘
```

---

## Ibex Design Setup

### Design Information

| Attribute | Value |
|-----------|-------|
| **Name** | Ibex Core |
| **Type** | 32-bit RISC-V CPU (RV32IMC) |
| **Technology** | Skywater 130nm HD |
| **Target Frequency** | 100 MHz |
| **Location** | `/home/EDA/hipilot_test/ibex_work_upload/` |

### Directory Structure

```
ibex_work_upload/
├── Makefile                    # Flow targets
├── config.mk                   # Configuration
├── rtl/                        # RTL source
├── scripts/
│   ├── syn/                    # Synthesis scripts
│   └── pr/                     # P&R scripts
├── designs/
│   └── sky130hd/               # PDK and constraints
│       ├── pdk/
│       │   ├── lef/
│       │   ├── lib/
│       │   └── gds/
│       └── ibex/
│           └── constraint_for_pr.sdc
└── result/
    ├── syn/                    # Synthesis outputs
    └── pr/                     # P&R outputs
```

### Run Flow via Makefile

```bash
cd /home/EDA/hipilot_test/ibex_work_upload

# Synthesis
make syn

# P&R stages
make init           # Init design
make floor_plan     # Floorplan
make place_io       # IO placement
make power_plan     # Power network
make placement      # Cell placement
make cts            # Clock tree
make post_cts_opt   # Post-CTS optimization
make routing        # Routing
make routing_opt    # Route optimization
make chip_done      # Final outputs

# STA
make run_pt

# Verification
make drc
make lvs
```

---

---

## Screen Recording

### Setup Recording

```bash
# Start recording
DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p /tmp/demo.mp4 &

# Stop recording
pkill ffmpeg

# Transfer to local machine
scp EDA@192.168.112.163:/tmp/demo.mp4 ./
```

---

## Troubleshooting

### Node.js Command Not Found

```bash
# Add to PATH
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Verify
which node
```

### tmux Protocol Version Mismatch

```bash
# Kill all tmux servers
pkill -u EDA tmux

# Create fresh session
tmux new-session -d -s hipilot
```

### EDA Tool License Issues

```bash
# Check license
lmstat -c /tools/license/license.dat

# Verify tool is in PATH
which innovus
which dc_shell
```

### MCP Servers Not Connecting

1. Check paths in `~/.claude/settings.json`
2. Verify Node.js v20 is in PATH
3. Test server directly:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
```

---

## Quick Reference Card

```bash
# SSH alias
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Node.js setup
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Check versions
node --version    # v20.18.3
tmux -V           # 3.4

# Start workspace
tmux new-session -d -s hipilot -x 240 -y 60
tmux split-window -h -t hipilot:0

# Start tools
innovus -nowin    # Innovus
pt_shell          # PrimeTime
dc_shell-topo     # Design Compiler

# Navigate design
cd /home/EDA/hipilot_test/ibex_work_upload
make syn          # Run synthesis
```

---

**Last Updated:** 2026-02-24
