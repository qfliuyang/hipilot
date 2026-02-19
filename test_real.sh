#!/bin/bash
# HiPilot v0.1.0 - Real Human Test
# Launches the actual workspace with Claude Code + Innovus on the real desktop
# This is what an engineer would actually see and use.

export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
export DISPLAY=:0
HIPILOT_HOME=/home/EDA/hipilot_test/hipilot-v0.1.0

# Kill any old sessions
tmux kill-session -t hipilot 2>/dev/null
sleep 1

###############################################################################
# Create the HiPilot tmux workspace
###############################################################################

tmux new-session -d -s hipilot -x 240 -y 60 -c "$HIPILOT_HOME"

# Split 50/50
tmux split-window -h -t hipilot:0 -c "$HIPILOT_HOME"

# Status bar - HiPilot branded
tmux set-option -t hipilot status on
tmux set-option -t hipilot status-style "bg=#1a1a2e,fg=#e0e0e0"
tmux set-option -t hipilot status-left "#[fg=#1a1a2e,bg=#00d4ff,bold] HiPilot #[fg=#00d4ff,bg=#1a1a2e] v0.1.0 "
tmux set-option -t hipilot status-right "#[fg=#ffd700] Innovus + Claude Code #[fg=#1a1a2e,bg=#00ff88,bold] READY "
tmux set-option -t hipilot status-left-length 30
tmux set-option -t hipilot status-right-length 40

# Pane border labels
tmux set-option -t hipilot pane-border-status top
tmux set-option -t hipilot pane-border-format " #[bold]#{pane_title} "
tmux set-option -t hipilot pane-border-style "fg=#555555"
tmux set-option -t hipilot pane-active-border-style "fg=#00d4ff"

# Set pane titles
tmux select-pane -t hipilot:0.0 -T "Chat - Claude Code"
tmux select-pane -t hipilot:0.1 -T "EDA Terminal"

###############################################################################
# Right pane: Start Innovus with the Ibex design
###############################################################################

# Start Innovus in the EDA pane
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload && innovus" Enter

###############################################################################
# Left pane: Start Claude Code from the HiPilot project directory
###############################################################################

# Give Innovus a moment to start loading
sleep 3

# Start Claude Code in the chat pane - it will auto-discover MCP servers from .claude/settings.json
tmux send-keys -t hipilot:0.0 "cd $HIPILOT_HOME && claude" Enter

###############################################################################
# Open gnome-terminal attached to the tmux session on the real desktop
###############################################################################

gnome-terminal --maximize --title="HiPilot v0.1.0 Workspace" \
  -- tmux attach-session -t hipilot &

echo "Workspace launched."
echo "  Left pane:  Claude Code (with HiPilot MCP servers)"
echo "  Right pane: Innovus (Ibex design)"
echo ""
echo "Recording will continue until stopped."
