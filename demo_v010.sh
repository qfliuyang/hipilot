#!/bin/bash
# HiPilot v0.1.0 Demo Script
# Records the real desktop at :0

export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
export DISPLAY=:0
cd /home/EDA/hipilot_test/hipilot-v0.1.0

clear
echo ""
echo "============================================================"
echo "                                                            "
echo "   HiPilot v0.1.0 Demo                                     "
echo "   VLSI Physical Design Copilot                             "
echo "                                                            "
echo "   Node.js $(node -v) on CentOS 7                          "
echo "                                                            "
echo "============================================================"
echo ""
sleep 3

# 1. CLI Status
echo "------------------------------------------------------------"
echo "  STEP 1: HiPilot Status Check"
echo "------------------------------------------------------------"
echo ""
sleep 1
node src/index.js status
sleep 4

# 2. Skills
echo ""
echo "------------------------------------------------------------"
echo "  STEP 2: Available Skills (10 PD workflows)"
echo "------------------------------------------------------------"
echo ""
sleep 1
node src/index.js skills
sleep 4

# 3. MCP Servers
echo ""
echo "------------------------------------------------------------"
echo "  STEP 3: MCP Servers (EDA, Tmux, Knowledge)"
echo "------------------------------------------------------------"
echo ""
sleep 1
echo "Starting EDA server..."
timeout 2 node servers/eda/index.js 2>&1 || true
echo ""
echo "Starting Knowledge server..."
timeout 2 node servers/knowledge/index.js 2>&1 || true
echo ""
echo "Starting Tmux server..."
timeout 2 node servers/tmux/index.js 2>&1 || true
sleep 3

# 4. Templates
echo ""
echo "------------------------------------------------------------"
echo "  STEP 4: Tcl Templates (20 total)"
echo "------------------------------------------------------------"
echo ""
sleep 1
echo "  Synopsys ICC2 Templates:"
for f in templates/synopsys/*.tcl; do
    echo "    + $(basename "$f")"
done
echo ""
echo "  Cadence Innovus Templates:"
for f in templates/cadence/*.tcl; do
    echo "    + $(basename "$f")"
done
sleep 4

# 5. Slash Commands
echo ""
echo "------------------------------------------------------------"
echo "  STEP 5: Claude Code Slash Commands"
echo "------------------------------------------------------------"
echo ""
sleep 1
for f in .claude/commands/*.md; do
    name=$(basename "$f" .md)
    echo "    /project:$name"
done
sleep 3

# 6. Sample Tcl Generation
echo ""
echo "------------------------------------------------------------"
echo "  STEP 6: Sample Tcl Template (ICC2 Fix Setup Timing)"
echo "------------------------------------------------------------"
echo ""
sleep 1
head -50 templates/synopsys/icc2_fix_setup_timing.tcl
sleep 5

# 7. Tmux Workspace
echo ""
echo "------------------------------------------------------------"
echo "  STEP 7: Tmux Workspace Layout"
echo "------------------------------------------------------------"
echo ""
sleep 1

# Kill any existing hipilot session
tmux kill-session -t hipilot 2>/dev/null || true
sleep 0.5

# Create the hipilot workspace
tmux new-session -d -s hipilot -x 200 -y 50
tmux split-window -h -t hipilot
tmux select-pane -t hipilot:0.0

tmux send-keys -t hipilot:0.0 "echo '  HiPilot Chat Pane'" Enter
sleep 0.3
tmux send-keys -t hipilot:0.0 "echo '  Claude Code runs here'" Enter
sleep 0.3
tmux send-keys -t hipilot:0.0 "echo ''" Enter
tmux send-keys -t hipilot:0.0 "echo '  Quick commands:'" Enter
sleep 0.3
tmux send-keys -t hipilot:0.0 "echo '    /project:timing  - Run timing analysis'" Enter
tmux send-keys -t hipilot:0.0 "echo '    /project:drc      - Check DRC violations'" Enter
tmux send-keys -t hipilot:0.0 "echo '    /project:power    - Power analysis'" Enter
tmux send-keys -t hipilot:0.0 "echo '    /project:compare  - Compare QoR'" Enter
sleep 0.5

tmux send-keys -t hipilot:0.1 "echo '  EDA Terminal Pane'" Enter
sleep 0.3
tmux send-keys -t hipilot:0.1 "echo '  Innovus / ICC2 runs here'" Enter
sleep 0.3
tmux send-keys -t hipilot:0.1 "echo ''" Enter
tmux send-keys -t hipilot:0.1 "echo '  EDA tools available on this server:'" Enter
sleep 0.3
tmux send-keys -t hipilot:0.1 "echo '    Cadence Innovus v20.10'" Enter
tmux send-keys -t hipilot:0.1 "echo '    Synopsys ICC2 T-2022.03'" Enter
tmux send-keys -t hipilot:0.1 "echo '    Synopsys PrimeTime T-2022.03'" Enter

echo "  Tmux session 'hipilot' created with split layout"
echo "  Left pane: Chat (Claude Code)"
echo "  Right pane: EDA Terminal"
sleep 2

# Capture the tmux layout
echo ""
echo "  Capturing workspace layout..."
echo ""
echo "  LEFT PANE (Chat):"
tmux capture-pane -t hipilot:0.0 -p | head -12 | sed 's/^/    /'
echo ""
echo "  RIGHT PANE (EDA):"
tmux capture-pane -t hipilot:0.1 -p | head -12 | sed 's/^/    /'
sleep 5

# 8. Help
echo ""
echo "------------------------------------------------------------"
echo "  STEP 8: CLI Help"
echo "------------------------------------------------------------"
echo ""
sleep 1
node src/index.js help
sleep 4

# Done
echo ""
echo "============================================================"
echo "                                                            "
echo "   Demo Complete                                            "
echo "                                                            "
echo "   HiPilot v0.1.0 is ready for use.                        "
echo "   10 skills  -  20 templates  -  3 MCP servers             "
echo "   Synopsys ICC2 + Cadence Innovus                          "
echo "                                                            "
echo "============================================================"
echo ""
sleep 5

# Cleanup
tmux kill-session -t hipilot 2>/dev/null || true
