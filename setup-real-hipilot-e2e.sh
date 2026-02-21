#!/bin/bash
# REAL HiPilot E2E Test Setup
# Sets up Claude Code + HiPilot MCP servers + Innovus

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_NAME="real_hipilot"
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no"
SERVER="EDA@192.168.112.163"
LOCAL_DIR="/Users/luzi/code/hipilot-0.3.0/hipilot"
REMOTE_BASE="/home/EDA/hipilot_test"
TEST_DIR="${REMOTE_BASE}/test_${TIMESTAMP}"
VIDEO_FILE="${TEST_DIR}/recordings/${TEST_NAME}_${TIMESTAMP}.mp4"

echo "=========================================="
echo "  REAL HiPilot E2E Test Setup"
echo "  Timestamp: $TIMESTAMP"
echo "=========================================="

# Step 0: Cleanup old sessions
echo ""
echo "[0] Cleanup old sessions..."
$SSH 'pkill -9 ffmpeg 2>/dev/null || true; pkill -9 tmux 2>/dev/null || true; sleep 2; echo "Cleanup done"'

# Step 1: Create test directory
echo "[1] Create test directory..."
$SSH "mkdir -p ${TEST_DIR}/{recordings,evidence,hipilot} && echo '${TIMESTAMP}' > ${TEST_DIR}/START_TIME.txt"

# Step 2: START VIDEO RECORDING FIRST
echo "[2] Start VIDEO recording..."
$SSH "
export DISPLAY=:0
# Use correct screen size for EDA server
ffmpeg -y -f x11grab -video_size 2560x1558 -framerate 20 -i :0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  '${VIDEO_FILE}' \
  < /dev/null > /tmp/ffmpeg_${TIMESTAMP}.log 2>&1 &
echo \$! > /tmp/ffmpeg_${TIMESTAMP}.pid
sleep 3
if ps -p \$(cat /tmp/ffmpeg_${TIMESTAMP}.pid) > /dev/null; then
    echo 'VIDEO RECORDING STARTED'
    ls -lh '${VIDEO_FILE}'
else
    echo 'ERROR: Failed to start recording'
    exit 1
fi
"

# Step 3: Upload HiPilot code
echo "[3] Upload HiPilot code..."
tar czf /tmp/hipilot_${TIMESTAMP}.tar.gz -C "${LOCAL_DIR}" \
  --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' \
  --exclude='*.log' --exclude='.DS_Store' . 2>/dev/null
$SCP "/tmp/hipilot_${TIMESTAMP}.tar.gz" "${SERVER}:${TEST_DIR}/hipilot/"
$SSH "cd ${TEST_DIR}/hipilot && tar xzf hipilot_${TIMESTAMP}.tar.gz && rm hipilot_${TIMESTAMP}.tar.gz && find . -name '._*' -delete && find . -name '.DS_Store' -delete"
rm -f /tmp/hipilot_${TIMESTAMP}.tar.gz
echo "Code uploaded"

# Step 4: Setup MCP servers in user settings
echo "[4] Configure MCP servers for Claude Code..."
$SSH "
# Create Claude Code user settings with HiPilot MCP servers
cat > ~/.claude/settings.json << 'MCPJSON'
{
  \"env\": {
    \"ANTHROPIC_AUTH_TOKEN\": \"sk-ktvGyYvYbR440z4r0e2f6dCfDeE6487d62b8b86Dc6cFf47\",
    \"ANTHROPIC_BASE_URL\": \"https://open.bigmodel.cn/api/anthropic\",
    \"API_TIMEOUT_MS\": \"3000000\"
  },
  \"skipDangerousModePermissionPrompt\": true,
  \"mcpServers\": {
    \"hipilot-eda\": {
      \"command\": \"/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node\",
      \"args\": [\"${TEST_DIR}/hipilot/servers/eda/index.js\"],
      \"env\": {\"HIPILOT_SESSION\": \"hipilot\"}
    },
    \"hipilot-tmux\": {
      \"command\": \"/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node\",
      \"args\": [\"${TEST_DIR}/hipilot/servers/tmux/index.js\"],
      \"env\": {\"HIPILOT_SESSION\": \"hipilot\"}
    },
    \"hipilot-knowledge\": {
      \"command\": \"/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node\",
      \"args\": [\"${TEST_DIR}/hipilot/servers/knowledge/index.js\"],
      \"env\": {}
    }
  }
}
MCPJSON
echo 'MCP settings configured'
"

# Step 5: Install npm dependencies
echo "[5] Install npm dependencies..."
$SSH "
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:\$PATH
cd ${TEST_DIR}/hipilot
npm install > /tmp/npm_install.log 2>&1
echo 'npm install complete'
"

# Step 6: Setup tmux workspace
echo "[6] Setup tmux workspace..."
$SSH "
export PATH=/home/EDA/hipilot_test/.local/bin:\$PATH
cd ${TEST_DIR}/hipilot

# Kill old tmux
\$HOME/.local/bin/tmux -L hipilot kill-server 2>/dev/null || true
sleep 2

# Create new session
\$HOME/.local/bin/tmux -L hipilot new-session -d -s hipilot -x 240 -y 60
\$HOME/.local/bin/tmux -L hipilot split-window -h -l 50%

# Configure status bar
\$HOME/.local/bin/tmux -L hipilot set-option -g status on
\$HOME/.local/bin/tmux -L hipilot set-option -g status-style 'bg=#1a1a2e,fg=#00d4ff'
\$HOME/.local/bin/tmux -L hipilot set-option -g status-left '#[fg=#00d4ff,bold] HiPilot #[fg=#ffd700]| ${TIMESTAMP} #[default]| '
\$HOME/.local/bin/tmux -L hipilot set-option -g status-right '#[fg=#00ff00]%H:%M#[default]'

# Start Innovus in right pane (pane 1)
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.1 'echo "=== Starting Innovus ==="' C-m
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.1 'export PATH=/opt/cadence/INNOVUS20.10/bin:\$PATH && innovus -nowin' C-m

echo 'tmux workspace created'
"

echo "Waiting 20s for Innovus to start..."
sleep 20

# Step 7: Start Claude Code in left pane
echo "[7] Start Claude Code with HiPilot in left pane..."
$SSH "
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/home/EDA/hipilot_test/.local/bin:\$PATH
cd ${TEST_DIR}/hipilot

# Start Claude Code in left pane (pane 0)
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.0 'echo "=== Starting Claude Code with HiPilot ==="' C-m
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.0 'claude --dangerously-skip-permissions' C-m

echo 'Claude Code starting...'
"

echo "Waiting 45s for Claude Code to initialize..."
sleep 45

# Step 8: Send a prompt to Claude Code via tmux
echo "[8] Send HiPilot prompt to Claude Code..."
$SSH "
export PATH=/home/EDA/hipilot_test/.local/bin:\$PATH

# Send prompt to Claude Code
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.0 '' C-m
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.0 'list all HiPilot skills' C-m

echo 'Prompt sent to Claude Code'
"

echo "Waiting 30s for Claude Code response..."
sleep 30

# Step 9: Open visible terminal
echo "[9] Open VISIBLE terminal showing the workspace..."
$SSH "
export DISPLAY=:0
export PATH=/home/EDA/hipilot_test/.local/bin:\$PATH

# Open gnome-terminal attached to tmux session
gnome-terminal --title='REAL HiPilot E2E - ${TIMESTAMP}' --geometry=220x60+50+50 \
  -- \$HOME/.local/bin/tmux -L hipilot attach -t hipilot &

echo 'Visible terminal opened'
"

echo "Waiting 20s for visual confirmation..."
sleep 20

# Step 10: Capture evidence
echo "[10] Capture evidence..."
$SSH "
export PATH=/home/EDA/hipilot_test/.local/bin:\$PATH
export DISPLAY=:0

# Capture tmux panes
\$HOME/.local/bin/tmux -L hipilot capture-pane -t hipilot:0.0 -p -S -50 > ${TEST_DIR}/evidence/claude_pane.log
\$HOME/.local/bin/tmux -L hipilot capture-pane -t hipilot:0.1 -p -S -30 > ${TEST_DIR}/evidence/innovus_pane.log

# Screenshot
import -window root ${TEST_DIR}/evidence/screenshot_final.png

# List sessions
\$HOME/.local/bin/tmux -L hipilot list-sessions > ${TEST_DIR}/evidence/tmux_sessions.txt

echo 'Evidence captured'
"

# Step 11: Stop recording and download
echo "[11] Stop recording and download..."
$SSH "
FFMPEG_PID=\$(cat /tmp/ffmpeg_${TIMESTAMP}.pid)
kill -INT \$FFMPEG_PID 2>/dev/null || true
sleep 3
ls -lh '${VIDEO_FILE}'
"

# Download everything
echo "Downloading evidence..."
mkdir -p "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}"
$SCP "${SERVER}:${TEST_DIR}/evidence/*" "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true
$SCP "${SERVER}:${VIDEO_FILE}" "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  REAL HiPilot E2E SETUP COMPLETE"
echo "  Timestamp: ${TIMESTAMP}"
echo "=========================================="
echo ""
echo "Setup:"
echo "  - Left pane: Claude Code with HiPilot MCP servers"
echo "  - Right pane: Innovus v20.10"
echo "  - Video: e2e_evidence/${TIMESTAMP}/"
echo ""
ls -lh "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/"
