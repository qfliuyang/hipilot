# RTL-to-GDS Flow Test Plan

**Goal:** Improve HiPilot skills until Claude Code can autonomously run the complete RTL-to-GDS flow on the Ibex design, like an intern.

**Date Created:** 2026-02-20
**Status:** Skills Created, Ready for Testing

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [How to SSH](#how-to-ssh)
3. [How to Use HiPilot](#how-to-use-hipilot)
4. [How to Interact with Panes](#how-to-interact-with-panes)
5. [How to Check Results](#how-to-check-results)
6. [Test Iterations](#test-iterations)
7. [Success Criteria](#success-criteria)

---

## Environment Setup

### Test Environment

**EDA Server:**
| Item | Value |
|------|-------|
| Host | 192.168.112.163 |
| User | EDA |
| Password | eda2020 |
| Root Password | 2020 |
| Workspace | `/home/EDA/hipilot_test/` |

**Design:**
| Item | Value |
|------|-------|
| Name | Ibex RISC-V CPU (RV32IMC) |
| Technology | Skywater 130nm HD |
| Location | `/home/EDA/hipilot_test/ibex_work_upload/` |
| Target Frequency | 100 MHz (10ns period) |

**Tools Available:**
- Synopsys Design Compiler (synthesis)
- Cadence Innovus (place & route)
- Synopsys PrimeTime (STA)
- Mentor Calibre (DRC/LVS)

---

## How to SSH

### From Local Machine (Non-interactive)

```bash
# Define SSH alias for convenience
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Run single command
$SSH "ls /home/EDA/hipilot_test/"

# Run multiple commands
$SSH "cd /home/EDA/hipilot_test/ibex_work_upload && ls Makefile"

# Copy files TO server
sshpass -p 'eda2020' scp file.txt EDA@192.168.112.163:~/hipilot_test/

# Copy files FROM server
sshpass -p 'eda2020' scp EDA@192.168.112.163:~/hipilot_test/report.txt ./
```

### Interactive SSH Session

```bash
# Start interactive session
sshpass -p 'eda2020' ssh EDA@192.168.112.163

# Once logged in, set up environment
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Navigate to workspace
cd /home/EDA/hipilot_test/
```

### SSH with X11 Forwarding (for GUI)

```bash
sshpass -p 'eda2020' ssh -X EDA@192.168.112.163
```

---

## How to Use HiPilot

### HiPilot Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        tmux session: hipilot                    │
├──────────────────────────────┬──────────────────────────────────┤
│     Pane 0 (Left 50%)        │      Pane 1 (Right 50%)          │
│                              │                                  │
│   ┌────────────────────┐     │   ┌────────────────────────┐     │
│   │                    │     │   │                        │     │
│   │   Claude Code      │     │   │   EDA Tool             │     │
│   │   (HiPilot)        │     │   │   (Innovus/ICC2/PT)    │     │
│   │                    │     │   │                        │     │
│   │   - Reads skills   │     │   │   - Runs Tcl           │     │
│   │   - Generates Tcl  │     │   │   - Produces reports   │     │
│   │   - Sends commands │─────┼──▶│   - Shows QoR          │     │
│   │   - Reads output   │◀────┼───│                        │     │
│   │                    │     │   │                        │     │
│   └────────────────────┘     │   └────────────────────────┘     │
│                              │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

### Starting HiPilot Workspace

```bash
# Step 1: SSH to server
sshpass -p 'eda2020' ssh EDA@192.168.112.163

# Step 2: Clean up old sessions (IMPORTANT!)
pkill -u EDA tmux

# Step 3: Set up Node.js path
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Step 4: Create tmux session with proper size
tmux new-session -d -s hipilot -x 240 -y 60

# Step 5: Split into two panes (50/50)
tmux split-window -h -t hipilot:0

# Step 6: Start EDA tool in right pane (Pane 1)
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload" C-m
tmux send-keys -t hipilot:0.1 "source /tools/cadence/innovus_setup.sh" C-m
tmux send-keys -t hipilot:0.1 "innovus -nowin" C-m
# Wait 5-10 seconds for Innovus to start

# Step 7: Start Claude Code in left pane (Pane 0)
tmux send-keys -t hipilot:0.0 "cd /home/EDA/hipilot_test/hipilot" C-m
tmux send-keys -t hipilot:0.0 "claude --dangerously-skip-permissions" C-m
# Wait 15-20 seconds for Claude Code to start

# Step 8: Attach to see both panes
tmux attach -t hipilot
```

### HiPilot MCP Tools

HiPilot provides these MCP tools for Claude Code:

| Tool | Purpose | Example |
|------|---------|---------|
| `eda.get_status()` | Check EDA tool state | Is Innovus ready? |
| `eda.generate_tcl()` | Create Tcl from intent | Generate timing report Tcl |
| `eda.send_to_terminal()` | Send Tcl to EDA pane | Execute the commands |
| `eda.get_risk_analysis()` | Check command risk level | Is this safe to run? |
| `eda.approve_pending()` | Approve pending commands | User said yes |
| `eda.extract_qor()` | Parse QoR metrics | Get WNS from report |

---

## How to Interact with Panes

### Pane Reference

| Pane | Purpose | Contains |
|------|---------|----------|
| `hipilot:0.0` | Left pane | Claude Code (HiPilot) |
| `hipilot:0.1` | Right pane | EDA Tool (Innovus) |

### Sending Commands to Claude Code Pane (From Local Machine)

```bash
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Send a prompt to Claude Code
# NOTE: Use C-m not Enter for tmux send-keys!
$SSH 'tmux send-keys -t hipilot:0.0 "check timing on the design" C-m'

# Wait for Claude to respond (30-60 seconds typical)
sleep 45

# Read Claude's response
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -200 | strings | grep -v "^$" | tail -50'
```

### Sending Commands to EDA Pane (For Manual Testing)

```bash
# Send Tcl command to Innovus
$SSH 'tmux send-keys -t hipilot:0.1 "report_timing -max_paths 5" C-m'

# Wait for result
sleep 3

# Read EDA output
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -100 | strings | grep -v "^$" | tail -30'
```

### Reading Pane Output

```bash
# Read last 100 lines from Claude Code pane
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -100'

# Read last 100 lines from EDA pane
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -100'

# Save output to file for analysis
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -500 > /tmp/eda_output.txt'
```

### Key tmux Commands

```bash
# Inside tmux session:
Ctrl+b 0    # Switch to pane 0 (Claude Code)
Ctrl+b 1    # Switch to pane 1 (EDA Tool)
Ctrl+b o    # Switch to next pane
Ctrl+b d    # Detach from session (keeps running)
Ctrl+b z    # Toggle pane zoom (fullscreen)

# From outside tmux:
tmux attach -t hipilot     # Reattach to session
tmux list-sessions         # List all sessions
tmux kill-session -t hipilot  # Kill session
```

---

## How to Check Results

### Check EDA Tool Status

```bash
# Is Innovus running?
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -20 | grep -E "(innovus|icc2|pt_shell)"'

# Check for errors
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -50 | grep -iE "(error|fail|cannot)"'

# Check if tool is idle (ready for commands)
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -5 | tail -1'
# Look for prompt like "innovus 1>" or "icc2_shell>"
```

### Check Synthesis Results

```bash
# View synthesis timing report
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/syn/report/*.rpt | grep -E "(WNS|TNS|Area)"'

# Check for synthesis errors
$SSH 'grep -i error /home/EDA/hipilot_test/ibex_work_upload/result/syn/log/*.log'
```

### Check P&R Results

```bash
# Check timing after placement
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/*timing*.rpt | head -50'

# Check CTS results
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/cts*.rpt | grep -E "(Skew|Latency)"'

# Check routing status
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/*route*.rpt | grep -E "(routed|unrouted)"'
```

### Check Signoff Results

```bash
# PrimeTime timing
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/sta/report/*.rpt | grep -E "(slack|WNS|TNS)"'

# DRC results
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/drc/*.rpt | grep -E "(TOTAL|violation)"'

# LVS results
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/lvs/*.rpt | grep -E "(CORRECT|INCORRECT)"'
```

### Monitor Progress in Real-time

```bash
# Watch EDA pane output (updates every 2 seconds)
watch -n 2 '$SSH "tmux capture-pane -t hipilot:0.1 -e -p -S -30"'

# Tail log file
$SSH 'tail -f /home/EDA/hipilot_test/ibex_work_upload/result/syn/log/*.log'
```

---

## Test Iterations

### Iteration 0: Environment Verification (5 minutes)

**Goal:** Verify everything is set up correctly

```bash
# From local machine
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Test 0.1: SSH connection
$SSH "echo 'SSH OK'"
# Expected: "SSH OK"

# Test 0.2: Node.js available
$SSH "export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:\$PATH && node --version"
# Expected: v20.18.3

# Test 0.3: Ibex design exists
$SSH "ls /home/EDA/hipilot_test/ibex_work_upload/Makefile"
# Expected: file exists

# Test 0.4: EDA tools available
$SSH "which innovus || echo 'innovus not in PATH, check setup scripts'"
$SSH "which dc_shell || echo 'dc_shell not in PATH, check setup scripts'"
```

**Pass Criteria:** All 4 tests return expected output

---

### Iteration 1: Manual Stage Test - Synthesis (10 minutes)

**Goal:** Run synthesis manually via Makefile to verify design flow

```bash
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Start fresh terminal
$SSH "cd /home/EDA/hipilot_test/ibex_work_upload && make syn"
# Wait 5-10 minutes for synthesis

# Check results
$SSH "cat /home/EDA/hipilot_test/ibex_work_upload/result/syn/report/*.rpt | grep -E 'WNS|TNS|Area' | head -10"
```

**Pass Criteria:**
- [ ] Synthesis completes without errors
- [ ] WNS > -1ns (acceptable for P&R)
- [ ] Area reported

---

### Iteration 2: HiPilot Workspace Setup (5 minutes)

**Goal:** Start tmux workspace with Claude Code + Innovus

```bash
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# Kill old sessions
$SSH "pkill -u EDA tmux"

# Create workspace
$SSH 'export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH && \
tmux new-session -d -s hipilot -x 240 -y 60 && \
tmux split-window -h -t hipilot:0 && \
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload && source /tools/cadence/innovus_setup.sh && innovus -nowin" C-m'

# Wait for Innovus to start
sleep 10

# Start Claude Code
$SSH 'export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH && \
tmux send-keys -t hipilot:0.0 "cd /home/EDA/hipilot_test/hipilot && claude --dangerously-skip-permissions" C-m'

# Wait for Claude Code to start
sleep 20

# Verify both are running
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -5 | tail -2'
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -5 | tail -2'
```

**Pass Criteria:**
- [ ] tmux session "hipilot" exists
- [ ] Claude Code running in pane 0
- [ ] Innovus running in pane 1

---

### Iteration 3: Simple Command Test (5 minutes)

**Goal:** Send a simple command via Claude Code and verify it reaches EDA tool

```bash
# Send prompt to Claude Code
$SSH 'tmux send-keys -t hipilot:0.0 "What is the current design status? Use eda.get_status to check." C-m'

# Wait for Claude to respond
sleep 45

# Check Claude's response
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -100 | tail -50'

# Check if any Tcl was sent to EDA pane
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -20 | tail -10'
```

**Pass Criteria:**
- [ ] Claude Code responds
- [ ] Claude uses MCP tool (eda.get_status)
- [ ] Command reaches Innovus (visible in pane 1)

---

### Iteration 4: Timing Report Test (10 minutes)

**Goal:** Have HiPilot generate and run a timing report

```bash
# Send timing report request
$SSH 'tmux send-keys -t hipilot:0.0 "Run a timing report on the current design with max_paths 5" C-m'

# Wait for generation and execution
sleep 60

# Check Claude's response (should show Tcl generated)
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -150 | tail -80'

# Check EDA output (should show timing results)
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -100 | tail -50'
```

**Pass Criteria:**
- [ ] Claude generates correct Tcl
- [ ] Tcl runs in Innovus
- [ ] Timing results visible

---

### Iteration 5: Design Load Test (10 minutes)

**Goal:** Load the synthesized Ibex design into Innovus via HiPilot

```bash
# Request to load design
$SSH 'tmux send-keys -t hipilot:0.0 "Load the synthesized Ibex design from result/syn/data/" C-m'

# Wait for load
sleep 60

# Check if design loaded
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -50 | grep -E "(Design|loaded|cells)"'
```

**Pass Criteria:**
- [ ] Design loads successfully
- [ ] Cell count reported
- [ ] No errors

---

### Iteration 6: Floorplan Test (10 minutes)

**Goal:** Create floorplan via HiPilot

```bash
# Request floorplan
$SSH 'tmux send-keys -t hipilot:0.0 "Create a floorplan with 70% utilization" C-m'

sleep 60

# Check floorplan result
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -50 | grep -E "(utilization|core|die)"'
```

**Pass Criteria:**
- [ ] Floorplan created
- [ ] Utilization ~70%
- [ ] No DRC errors

---

### Iteration 7: CTS Test (10 minutes)

**Goal:** Run clock tree synthesis via HiPilot

```bash
# Request CTS
$SSH 'tmux send-keys -t hipilot:0.0 "Run clock tree synthesis and report skew" C-m'

sleep 90

# Check CTS result
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -80 | grep -E "(skew|latency|clock)"'
```

**Pass Criteria:**
- [ ] CTS completes
- [ ] Skew < 100ps
- [ ] Latency reasonable

---

### Iteration 8: Multi-Stage Flow Test (30 minutes)

**Goal:** Run multiple stages in sequence via HiPilot

```bash
# Request multi-stage flow
$SSH 'tmux send-keys -t hipilot:0.0 "Run the flow from placement through CTS and report timing at each stage" C-m'

# This will take longer - monitor progress
sleep 120

# Check progress
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -100 | tail -50'
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -50 | tail -30'
```

**Pass Criteria:**
- [ ] Multiple stages execute
- [ ] QoR reported at each stage
- [ ] No blocking errors

---

### Iteration 9: Full RTL-to-GDS Flow (60+ minutes)

**Goal:** Complete autonomous flow execution

```bash
# Start recording (optional)
$SSH 'DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 -c:v libx264 -preset fast -crf 23 /tmp/rtl2gds_demo.mp4 &'

# Request full flow
$SSH 'tmux send-keys -t hipilot:0.0 "Run the complete RTL to GDS flow on the Ibex design. Start from synthesis and go through signoff." C-m'

# Monitor progress (check every 5 minutes)
for i in {1..12}; do
    sleep 300
    echo "=== Check $i at $(date) ==="
    $SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -20 | tail -10'
    $SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -10 | tail -5'
done

# Stop recording
$SSH 'pkill ffmpeg'
```

**Pass Criteria:**
- [ ] All 10 stages execute
- [ ] Timing clean (WNS ≥ 0)
- [ ] DRC: 0 violations
- [ ] LVS: CORRECT
- [ ] GDS generated

---

## Success Criteria Summary

| Iteration | Goal | Time | Key Metric |
|-----------|------|------|------------|
| 0 | Environment check | 5 min | All 4 tests pass |
| 1 | Manual synthesis | 10 min | WNS > -1ns |
| 2 | Workspace setup | 5 min | Both panes running |
| 3 | Simple command | 5 min | Claude uses MCP |
| 4 | Timing report | 10 min | Tcl runs in Innovus |
| 5 | Design load | 10 min | Design loaded |
| 6 | Floorplan | 10 min | Util ~70% |
| 7 | CTS | 10 min | Skew < 100ps |
| 8 | Multi-stage | 30 min | 3+ stages |
| 9 | Full flow | 60 min | GDS + signoff clean |

---

## Troubleshooting

### Problem: tmux session not created

```bash
# Check for existing sessions
$SSH "tmux list-sessions"

# Kill all and retry
$SSH "pkill -u EDA tmux"
# Then recreate workspace
```

### Problem: Claude Code not starting

```bash
# Check Node.js path
$SSH "which node"
# Should be: /home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node

# Check if claude is installed
$SSH "which claude"

# Check MCP settings
$SSH "cat ~/.claude/settings.json | grep -A5 mcpServers"
```

### Problem: Innovus not starting

```bash
# Check license
$SSH "lmstat -c /tools/cadence/license/license.dat"

# Check setup script
$SSH "cat /tools/cadence/innovus_setup.sh"

# Try starting manually
$SSH "source /tools/cadence/innovus_setup.sh && innovus -nowin"
```

### Problem: Commands not being sent to EDA pane

```bash
# Check if Claude is using Bash instead of MCP
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -50 | grep -i "tmux send-keys"'

# If using Bash, remind Claude:
$SSH 'tmux send-keys -t hipilot:0.0 "Remember to use eda.send_to_terminal MCP tool, not Bash commands" C-m'
```

### Problem: EDA tool seems stuck

```bash
# Check last output
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -20'

# Check for error messages
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -100 | grep -iE "(error|fail|hang)"'

# May need to restart EDA tool
$SSH 'tmux send-keys -t hipilot:0.1 C-c'  # Ctrl+C
sleep 2
$SSH 'tmux send-keys -t hipilot:0.1 "innovus -nowin" C-m'
```

---

## Recording Demos

### Start Recording

```bash
# On EDA server (must have display)
$SSH 'DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p /tmp/hipilot_demo.mp4 &'

# Record just the tmux window (better quality)
$SSH 'DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -i :0+0,0 \
  -c:v libx264 -preset fast -crf 20 /tmp/hipilot_demo.mp4 &'
```

### Stop Recording

```bash
$SSH 'pkill ffmpeg'

# Or gracefully
$SSH 'kill -SIGINT $(pgrep ffmpeg)'
```

### Transfer Video

```bash
sshpass -p 'eda2020' scp EDA@192.168.112.163:/tmp/hipilot_demo.mp4 ./
```

---

## Quick Reference Card

```bash
# === ALIASES (copy-paste these first) ===
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp"

# === WORKSPACE ===
$SSH "pkill -u EDA tmux"                                    # Kill old sessions
$SSH "...create tmux workspace..."                          # See Iteration 2

# === SEND COMMANDS ===
$SSH 'tmux send-keys -t hipilot:0.0 "your prompt" C-m'     # To Claude Code
$SSH 'tmux send-keys -t hipilot:0.1 "tcl command" C-m'     # To EDA tool

# === READ OUTPUT ===
$SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -100'      # Claude Code
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -100'      # EDA tool

# === CHECK FILES ===
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/syn/report/*.rpt'

# === RECORDING ===
$SSH 'DISPLAY=:0 ffmpeg -y -f x11grab ... /tmp/demo.mp4 &' # Start
$SSH 'pkill ffmpeg'                                         # Stop
$SCP EDA@192.168.112.163:/tmp/demo.mp4 ./                   # Transfer
```

---

**Last Updated:** 2026-02-20
**Document Version:** 2.0
