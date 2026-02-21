# RTL-to-GDS Flow Test Plan

**Goal:** Improve HiPilot skills until Claude Code can autonomously run the complete RTL-to-GDS flow on the Ibex design, like an intern.

**Date Created:** 2026-02-20
**Last Updated:** 2026-02-21
**Status:** Iteration 11 Completed - Visual Demonstration Recording Available

## Test Progress Summary

| Iteration | Description | Status | Date |
|-----------|-------------|--------|------|
| 1-10 | RTL-to-GDS flow stages | ✅ Completed | 2026-02-20 |
| 11 | Visual Demonstration | ✅ Completed | 2026-02-20 |

**Latest Recording:** `hipilot/recordings/hipilot_demo_20260220_232127.mp4` (25 MB, 21 min)

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

### Iteration 9: Complete Physical Design Flow (60+ minutes)

**Goal:** Run complete physical design flow from design init through routing

**Prerequisites:**
- Synthesis completed (Iteration 1)
- Netlist available at: `result/syn/data/ibex_core.syn.v`

**Flow Stages:**

#### Stage 1: Design Initialization (5 minutes)
```bash
# Load synthesized netlist into Innovus
$SSH 'tmux send-keys -t hipilot:0.0 "Load the synthesized Ibex design into Innovus. Use init_design with the netlist at result/syn/data/ibex_core.syn.v and LEF files from designs/sky130hd/pdk/lef/" C-m'
sleep 60

# Verify design loaded
$SSH 'tmux send-keys -t hipilot:0.1 "puts \"Instances: [sizeof_collection [get_cells *]]\"" C-m'
```

**Pass Criteria:**
- [ ] Design loads without crash
- [ ] Instance count matches synthesis (~7,000+ cells)
- [ ] No fatal errors

#### Stage 2: Floorplanning (10 minutes)
```bash
# Create floorplan with 70% utilization
$SSH 'tmux send-keys -t hipilot:0.0 "Create floorplan for Ibex with 70% utilization, core-to-left 10, core-to-right 10, core-to-top 10, core-to-bottom 10" C-m'
sleep 90

# Check floorplan
$SSH 'tmux send-keys -t hipilot:0.1 "report_utilization" C-m'
sleep 5
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -30 | grep -E "(utilization|core|die)"'
```

**Pass Criteria:**
- [ ] Floorplan created
- [ ] Utilization ~70%
- [ ] Core area reasonable for design size

#### Stage 3: Power Planning (5 minutes)
```bash
# Create power network
$SSH 'tmux send-keys -t hipilot:0.0 "Create power rings and stripes for VDD and VSS. Use metal layers met4 and met5." C-m'
sleep 60

# Verify power network
$SSH 'tmux send-keys -t hipilot:0.1 "report_power_network" C-m'
```

**Pass Criteria:**
- [ ] Power rings created
- [ ] Power stripes routed
- [ ] No opens in power network

#### Stage 4: Placement (15 minutes)
```bash
# Run placement
$SSH 'tmux send-keys -t hipilot:0.0 "Run placement optimization with target density 0.75 and timing-driven placement enabled" C-m'
sleep 180

# Check placement quality
$SSH 'tmux send-keys -t hipilot:0.1 "report_timing -max_paths 5" C-m'
sleep 10
$SSH 'tmux send-keys -t hipilot:0.1 "report_congestion" C-m'
```

**Pass Criteria:**
- [ ] Placement completes
- [ ] WNS > -0.5ns (acceptable pre-CTS)
- [ ] Congestion < 5% overflow

#### Stage 5: Clock Tree Synthesis (10 minutes)
```bash
# Run CTS
$SSH 'tmux send-keys -t hipilot:0.0 "Run clock tree synthesis targeting 100ps skew and 500ps max latency" C-m'
sleep 120

# Check CTS results
$SSH 'tmux send-keys -t hipilot:0.1 "report_clock_timing -type summary" C-m'
sleep 5
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -40 | grep -E "(skew|latency|clock)"'
```

**Pass Criteria:**
- [ ] CTS completes
- [ ] Clock skew < 100ps
- [ ] Max latency < 500ps

#### Stage 6: Post-CTS Optimization (10 minutes)
```bash
# Optimize timing after CTS
$SSH 'tmux send-keys -t hipilot:0.0 "Run post-CTS optimization to fix setup and hold violations" C-m'
sleep 120

# Check timing
$SSH 'tmux send-keys -t hipilot:0.1 "report_timing -max_paths 10" C-m'
sleep 10
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -50 | grep -E "(WNS|TNS|slack)"'
```

**Pass Criteria:**
- [ ] Setup WNS > -0.1ns
- [ ] Hold WNS > -0.05ns

#### Stage 7: Routing (20 minutes)
```bash
# Run routing
$SSH 'tmux send-keys -t hipilot:0.0 "Run global routing followed by detail routing. Fix any DRC violations automatically." C-m'
sleep 300

# Check routing status
$SSH 'tmux send-keys -t hipilot:0.1 "report_route_status" C-m'
sleep 5
$SSH 'tmux send-keys -t hipilot:0.1 "report_drc" C-m'
sleep 10
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -50 | grep -E "(routed|DRC|violation)"'
```

**Pass Criteria:**
- [ ] 100% nets routed
- [ ] DRC violations < 100

#### Stage 8: Post-Route Optimization (10 minutes)
```bash
# Final optimization
$SSH 'tmux send-keys -t hipilot:0.0 "Run post-route optimization to fix any remaining timing and DRC issues" C-m'
sleep 120

# Final timing check
$SSH 'tmux send-keys -t hipilot:0.1 "report_timing -max_paths 20" C-m'
sleep 10
```

**Pass Criteria:**
- [ ] Setup WNS ≥ 0
- [ ] Hold WNS ≥ 0
- [ ] DRC violations minimized

#### Stage 9: RC Extraction (10 minutes)
```bash
# Extract parasitics
$SSH 'tmux send-keys -t hipilot:0.0 "Run RC extraction using the extraction tool and generate SPEF file" C-m'
sleep 120

# Verify extraction
$SSH 'tmux send-keys -t hipilot:0.1 "report_parasitics" C-m'
sleep 5
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -30'
```

**Pass Criteria:**
- [ ] SPEF file generated
- [ ] Parasitics annotated

#### Stage 10: Static Timing Analysis (15 minutes)
```bash
# Run STA with extracted parasitics
$SSH 'tmux send-keys -t hipilot:0.0 "Run static timing analysis with extracted parasitics. Report setup and hold across all corners." C-m'
sleep 180

# Get final timing summary
$SSH 'tmux send-keys -t hipilot:0.1 "report_timing -max_paths 50 -delay max" C-m'
sleep 10
$SSH 'tmux send-keys -t hipilot:0.1 "report_timing -max_paths 50 -delay min" C-m'
sleep 10
$SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -60 | grep -E "(WNS|TNS|slack|MET)"'
```

**Pass Criteria:**
- [ ] Setup timing clean (WNS ≥ 0)
- [ ] Hold timing clean (WNS ≥ 0)
- [ ] All paths meet timing

---

### Iteration 10: Full Autonomous RTL-to-GDS Flow (2+ hours)

**Goal:** Complete autonomous flow execution from RTL to final outputs

```bash
# Start recording (optional)
$SSH 'DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 -c:v libx264 -preset fast -crf 23 /tmp/rtl2gds_demo.mp4 &'

# Request full flow
$SSH 'tmux send-keys -t hipilot:0.0 "Run the complete RTL to GDS flow on the Ibex design:
1. Synthesize the design using Design Compiler
2. Initialize the design in Innovus with the synthesized netlist
3. Create floorplan with 70% utilization
4. Build power network
5. Run timing-driven placement
6. Perform clock tree synthesis targeting 100ps skew
7. Optimize post-CTS
8. Route the design
9. Extract parasitics (RC extraction)
10. Run STA with extracted parasitics
11. Fix any timing/DRC issues
12. Generate final reports and outputs

Report progress at each stage." C-m'

# Monitor progress (check every 5 minutes)
for i in {1..24}; do
    sleep 300
    echo "=== Check $i at $(date) ==="
    $SSH 'tmux capture-pane -t hipilot:0.0 -e -p -S -20 | tail -10'
    $SSH 'tmux capture-pane -t hipilot:0.1 -e -p -S -10 | tail -5'
done

# Stop recording
$SSH 'pkill ffmpeg'
```

**Pass Criteria:**
- [ ] All 12 stages execute successfully
- [ ] Synthesis: WNS ≥ 0, Area reported
- [ ] Floorplan: Utilization ~70%
- [ ] Placement: No congestion issues
- [ ] CTS: Skew < 100ps
- [ ] Routing: 100% nets routed
- [ ] RC Extraction: SPEF generated
- [ ] STA: Setup & Hold WNS ≥ 0
- [ ] DRC: All violations fixed
- [ ] Final outputs generated

---

### Iteration 11: Visual Demonstration with Live Recording (30 minutes)

**Goal:** Create a professional recording showing HiPilot's layout and Claude Code controlling multiple EDA tools

**Purpose:** Visually demonstrate HiPilot's multi-tool orchestration capability for documentation, training, and demos

#### Prerequisites
- Completed Iteration 1 (synthesis works)
- X11 display available on server (DISPLAY=:0)
- ffmpeg installed for recording

#### Recording Setup

```bash
# From local machine
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"

# 1. Clean up and create fresh workspace
$SSH 'pkill -u EDA tmux'
$SSH 'export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH'

# 2. Create tmux workspace with proper size for recording
$SSH 'tmux new-session -d -s hipilot -x 240 -y 60'
$SSH 'tmux split-window -h -t hipilot:0'

# 3. Start recording FIRST (before tools so we capture startup)
$SSH 'DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p /tmp/hipilot_demo_$(date +%Y%m%d_%H%M%S).mp4 &'

# Record the PID for later
RECORD_PID=$($SSH 'pgrep -n ffmpeg')
echo "Recording PID: $RECORD_PID"
```

#### Demo Script: Multi-Tool Orchestration

This demo shows Claude Code controlling **three different tools** in sequence:

```bash
# ============================================
# SCENE 1: Show the workspace layout (~30 seconds)
# ============================================
# The recording should capture:
# - Left pane (50%): Claude Code interface
# - Right pane (50%): EDA tool terminal
# - Status bar showing session name "hipilot"

# Attach to tmux to show layout (optional, for live demo)
$SSH 'tmux attach -t hipilot'

# ============================================
# SCENE 2: Start Innovus in right pane (~30 seconds)
# ============================================
$SSH 'tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload" C-m'
$SSH 'tmux send-keys -t hipilot:0.1 "source /tools/cadence/innovus_setup.sh && innovus -nowin" C-m'
sleep 10  # Wait for Innovus startup

# Verify Innovus is running
$SSH 'tmux capture-pane -t hipilot:0.1 -p -S -5 | grep "innovus"'

# ============================================
# SCENE 3: Start Claude Code in left pane (~30 seconds)
# ============================================
$SSH 'tmux send-keys -t hipilot:0.0 "cd /home/EDA/hipilot_test/hipilot" C-m'
$SSH 'tmux send-keys -t hipilot:0.0 "claude --dangerously-skip-permissions" C-m'
sleep 20  # Wait for Claude Code startup

# ============================================
# SCENE 4: Claude Code loads design into Innovus (~2 minutes)
# ============================================
# Send command to Claude Code to load design
$SSH 'tmux send-keys -t hipilot:0.0 "Load the synthesized Ibex design into Innovus. The netlist is at result/syn/data/ibex_core.syn.v and LEF files are in designs/sky130hd/pdk/lef/" C-m'

# Watch both panes - Claude generates Tcl, Innovus executes
sleep 60

# Capture the interaction
$SSH 'tmux capture-pane -t hipilot:0.0 -p -S -30'  # Claude's response
$SSH 'tmux capture-pane -t hipilot:0.1 -p -S -30'  # Innovus output

# ============================================
# SCENE 5: Claude Code runs floorplan (~2 minutes)
# ============================================
$SSH 'tmux send-keys -t hipilot:0.0 "Create a floorplan with 70% utilization" C-m'
sleep 60

# ============================================
# SCENE 6: Claude Code runs placement (~2 minutes)
# ============================================
$SSH 'tmux send-keys -t hipilot:0.0 "Run placement" C-m'
sleep 60

# ============================================
# SCENE 7: Switch to PrimeTime for STA (shows multi-tool) (~3 minutes)
# ============================================
# This demonstrates Claude Code switching between tools
$SSH 'tmux send-keys -t hipilot:0.1 "exit" C-m'  # Exit Innovus
sleep 2
$SSH 'tmux send-keys -t hipilot:0.1 "pt_shell" C-m'  # Start PrimeTime
sleep 5

# Claude runs PrimeTime commands
$SSH 'tmux send-keys -t hipilot:0.0 "Run PrimeTime STA on the synthesized netlist using the .db library at designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db" C-m'
sleep 60

# ============================================
# SCENE 8: Summary and cleanup (~30 seconds)
# ============================================
$SSH 'tmux send-keys -t hipilot:0.0 "Summarize what we accomplished" C-m'
sleep 30

# Stop recording
$SSH 'pkill ffmpeg'
```

#### Recording Quality Guidelines

| Setting | Recommended Value | Purpose |
|---------|------------------|---------|
| Resolution | 2560x1558 | Full HD, shows both panes clearly |
| Framerate | 25 fps | Smooth playback |
| CRF | 20 | High quality (lower = better) |
| Preset | fast | Good balance of speed/quality |
| Format | MP4 (H.264) | Universal compatibility |

#### Post-Recording Steps

```bash
# 1. List recordings
$SSH 'ls -la /tmp/hipilot_demo_*.mp4'

# 2. Transfer to local machine
sshpass -p 'eda2020' scp EDA@192.168.112.163:/tmp/hipilot_demo_*.mp4 ./hipilot_recordings/

# 3. Optional: Create a shorter highlight clip
ffmpeg -i hipilot_demo_full.mp4 -ss 00:01:00 -t 00:05:00 -c copy hipilot_demo_highlights.mp4
```

#### Demo Script Checklist

Before recording:
- [ ] X11 display confirmed working (test with `xterm`)
- [ ] ffmpeg installed and tested
- [ ] Sufficient disk space (~500MB for 10 min recording)
- [ ] Synthesis pre-completed (netlist exists)
- [ ] tmux session size matches recording resolution

During recording:
- [ ] Capture tool startup sequences
- [ ] Show Claude Code receiving prompts
- [ ] Show Tcl commands being generated
- [ ] Show EDA tool executing commands
- [ ] Show timing/area reports
- [ ] Demonstrate tool switching

After recording:
- [ ] Verify video plays correctly
- [ ] Check audio is not needed (usually silent)
- [ ] Create timestamped highlights if needed
- [ ] Archive original recording

#### Expected Demo Length

| Section | Duration | Content |
|---------|----------|---------|
| Workspace Setup | 1 min | tmux layout, pane split |
| Tool Startup | 1 min | Innovus/Claude Code startup |
| Design Load | 2 min | Loading netlist, LEF files |
| Floorplan | 2 min | Creating floorplan |
| Placement | 2 min | Running placement |
| Tool Switch | 2 min | Switching to PrimeTime |
| STA | 2 min | Running timing analysis |
| Summary | 1 min | Results recap |
| **Total** | **~13 min** | Full demo |

#### Iteration 11 Results (2026-02-20)

**Status:** ✅ COMPLETED

**Recording:** `hipilot/recordings/hipilot_demo_20260220_232127.mp4`
- **Size:** 25 MB
- **Duration:** 21 minutes (1267 seconds)
- **Format:** H.264 MP4

**What Was Demonstrated:**

| Scene | Status | Content |
|-------|--------|---------|
| 1-3 | ✅ | Tmux workspace setup (50/50 split), Innovus v20.10 + Claude Code v2.1.47 startup |
| 4-6 | ✅ | Claude Code generated Tcl scripts, debugged floorPlan syntax, fixed site names |
| 7 | ✅ | Tool switch from Innovus to PrimeTime (pt_shell) |
| 8 | ✅ | Summary request and recording cleanup |

**Key Learnings Captured:**
1. Innovus v20.10 uses different `floorPlan` syntax than documented
2. Site names come from LEF files (`unithd` for sky130hd, not `core`)
3. `floorPlan -r` uses `aspectRatio rowDensity margins`, not utilization directly
4. PrimeTime requires proper environment setup for `.db` libraries

**Scripts Created by Claude Code:**
- `hipilot-v0.3.0/load_ibex_synthesized.tcl` - Design loading script
- `hipilot-v0.3.0/create_ibex_floorplan.tcl` - Floorplan creation script

**Multi-Tool Orchestration Demonstrated:**
- Claude Code controlled Innovus for design loading and floorplan
- Claude Code switched to PrimeTime for STA commands
- AI + EDA tool feedback loop captured (debug → fix → re-run)

---

## Flow Stage Reference

### Quick Commands for Each Stage

```bash
# === SYNTHESIS (Design Compiler) ===
# Run synthesis
$SSH 'cd /home/EDA/hipilot_test/ibex_work_upload && make syn'

# Check synthesis results
$SSH 'cat /home/EDA/hipilot_test/ibex_work_upload/result/syn/report/*.rpt | grep -E "WNS|TNS|Area"'

# === DESIGN INIT (Innovus) ===
$SSH 'tmux send-keys -t hipilot:0.1 "
set init_verilog /home/EDA/hipilot_test/ibex_work_upload/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_lef_file {
  /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
  /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
}
init_design" C-m'

# === FLOORPLAN ===
$SSH 'tmux send-keys -t hipilot:0.1 "floorPlan -coreMarginsByDie -coreToLeft 10 -coreToRight 10 -coreToTop 10 -coreToBottom 10 -site unithd -utilization 0.7" C-m'

# === POWER PLAN ===
$SSH 'tmux send-keys -t hipilot:0.1 "
addRing -nets {VDD VSS} -type core_rings -layer {top met5 bottom met5 left met4 right met4}
addStripe -nets {VDD VSS} -layer met5 -direction horizontal" C-m'

# === PLACEMENT ===
$SSH 'tmux send-keys -t hipilot:0.1 "place_opt_design -effort high" C-m'

# === CTS ===
$SSH 'tmux send-keys -t hipilot:0.1 "create_ccopt_clock_tree_spec; ccopt_design" C-m'

# === ROUTING ===
$SSH 'tmux send-keys -t hipilot:0.1 "routeDesign -globalDetailRoute" C-m'

# === RC EXTRACTION ===
$SSH 'tmux send-keys -t hipilot:0.1 "rc_extraction -spef_file result/ibex_core.spef" C-m'

# === STA ===
$SSH 'tmux send-keys -t hipilot:0.1 "
read_spef result/ibex_core.spef
report_timing -max_paths 50 -delay max > result/timing_setup.rpt
report_timing -max_paths 50 -delay min > result/timing_hold.rpt" C-m'
```

---

## Success Criteria Summary

| Iteration | Goal | Time | Key Metric |
|-----------|------|------|------------|
| 0 | Environment check | 5 min | All 4 tests pass |
| 1 | Manual synthesis | 10 min | WNS ≥ 0 |
| 2 | Workspace setup | 5 min | Both panes running |
| 3 | Simple command | 5 min | Claude uses MCP |
| 4 | Timing report | 10 min | Tcl runs in Innovus |
| 5 | Design load | 10 min | Design loaded |
| 6 | Floorplan | 10 min | Util ~70% |
| 7 | CTS | 10 min | Skew < 100ps |
| 8 | Multi-stage | 30 min | 3+ stages |
| 9 | Complete Physical Design Flow | 90 min | All 10 stages pass |
| 10 | Full RTL-to-GDS Flow | 2+ hrs | Signoff clean |

## Detailed Stage Metrics

### Iteration 9: Physical Design Flow Stages

| Stage | Command | Time | Success Criteria |
|-------|---------|------|------------------|
| 1. Design Init | `init_design` | 5 min | ~7,000+ instances loaded |
| 2. Floorplan | `floorPlan` | 10 min | Utilization 70% |
| 3. Power Plan | `addRing/addStripe` | 5 min | No opens in power |
| 4. Placement | `place_opt_design` | 15 min | WNS > -0.5ns, Congestion < 5% |
| 5. CTS | `ccopt_design` | 10 min | Skew < 100ps, Latency < 500ps |
| 6. Post-CTS Opt | `optDesign` | 10 min | Setup WNS > -0.1ns |
| 7. Routing | `routeDesign` | 20 min | 100% routed, DRC < 100 |
| 8. Post-Route Opt | `optDesign` | 10 min | Setup/Hold WNS ≥ 0 |
| 9. RC Extraction | `rc_extraction` | 10 min | SPEF generated |
| 10. STA | `report_timing` | 15 min | All paths MET |

### Final Signoff Criteria

| Check | Tool | Pass Criteria |
|-------|------|---------------|
| Setup Timing | Innovus/PrimeTime | WNS ≥ 0 |
| Hold Timing | Innovus/PrimeTime | WNS ≥ 0 |
| DRC | Calibre/Innovus | 0 violations |
| LVS | Calibre | CORRECT |
| Area | Innovus | Within budget |
| Power | Voltus | Within budget |

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
**Document Version:** 4.0
**Changes:**
- Added complete physical design flow (Iteration 9)
- Added full autonomous RTL-to-GDS flow (Iteration 10)
- Added RC extraction and STA stages
- Added quick command reference for all stages
- Added detailed stage metrics table
- Updated success criteria with signoff requirements
- **NEW (v4.0):** Added Iteration 11 for visual demonstration with live recording
- **NEW (v4.0):** Added multi-tool orchestration demo script (Innovus + PrimeTime)
- **NEW (v4.0):** Added recording quality guidelines and checklist
- **NEW (v4.0):** Added demo script for showing HiPilot layout and workflow
