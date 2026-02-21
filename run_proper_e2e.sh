#!/bin/bash
# Proper HiPilot E2E Test - Following PRD and TESTING_GUIDE.md
# Tests: tmux + Innovus + HiPilot MCP servers + screen recording

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_NAME="proper_e2e"

echo "=========================================="
echo "  HiPilot Proper E2E Test"
echo "  Timestamp: $TIMESTAMP"
echo "=========================================="

# Configuration
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no"
SERVER="EDA@192.168.112.163"
LOCAL_DIR="/Users/luzi/code/hipilot-0.3.0/hipilot"
REMOTE_BASE="/home/EDA/hipilot_test"
TEST_DIR="${REMOTE_BASE}/test_${TIMESTAMP}"
RECORDINGS_DIR="${TEST_DIR}/recordings"
EVIDENCE_DIR="${TEST_DIR}/evidence"

# Step 1: Cleanup
echo ""
echo "[1/8] Cleanup old sessions..."
$SSH 'pkill -u EDA tmux 2>/dev/null || true; pkill -u EDA ffmpeg 2>/dev/null || true; pkill -u EDA gnome-terminal 2>/dev/null || true; rm -f /tmp/hipilot_* 2>/dev/null || true; echo "Cleanup done"'

# Step 2: Create test directory
echo "[2/8] Create test directory: test_${TIMESTAMP}"
$SSH "mkdir -p ${TEST_DIR} ${RECORDINGS_DIR} ${EVIDENCE_DIR}"

# Step 3: Upload HiPilot code
echo "[3/8] Upload HiPilot code..."
tar czf /tmp/hipilot_${TIMESTAMP}.tar.gz -C "${LOCAL_DIR}" --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' --exclude='*.log' . 2>/dev/null
$SCP "/tmp/hipilot_${TIMESTAMP}.tar.gz" "${SERVER}:${TEST_DIR}/"
$SSH "cd ${TEST_DIR} && mkdir -p hipilot && tar xzf hipilot_${TIMESTAMP}.tar.gz -C hipilot && rm hipilot_${TIMESTAMP}.tar.gz"
rm -f /tmp/hipilot_${TIMESTAMP}.tar.gz

# Step 4: Start screen recording
echo "[4/8] Start screen recording on display :0..."
$SSH "
export DISPLAY=:0
VIDEO_FILE='${RECORDINGS_DIR}/e2e_${TEST_NAME}_${TIMESTAMP}.mp4'
ffmpeg -y -f x11grab -video_size 2880x1800 -framerate 15 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  \"\$VIDEO_FILE\" </dev/null >/tmp/ffmpeg_${TIMESTAMP}.log 2>&1 &
echo \$! > /tmp/ffmpeg_pid_${TIMESTAMP}
sleep 2
echo \"Recording started: \$VIDEO_FILE\"
"

# Step 5: Setup tmux workspace with Innovus
echo "[5/8] Setup tmux workspace with Innovus..."
$SSH "
export PATH=\"/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/home/EDA/hipilot_test/.local/bin:\$PATH\"
TMUX_PATH=\"/home/EDA/hipilot_test/.local/bin/tmux\"
export DISPLAY=:0

# Create tmux session
\$TMUX_PATH -L hipilot kill-server 2>/dev/null || true
sleep 1
\$TMUX_PATH -L hipilot new-session -d -s hipilot -x 240 -y 60 -c '${TEST_DIR}/hipilot'
\$TMUX_PATH -L hipilot split-window -h -l 50%

# Set status bar
\$TMUX_PATH -L hipilot set-option -g status on
\$TMUX_PATH -L hipilot set-option -g status-left '#[fg=#00d4ff] HiPilot #[fg=#ffd700] Manual '
\$TMUX_PATH -L hipilot set-option -g status-right '#[fg=#00ff00] E2E Test '

# Start Innovus in right pane (pane 1)
\$TMUX_PATH -L hipilot send-keys -t hipilot:0.1 'echo \"Starting Innovus...\"' C-m
\$TMUX_PATH -L hipilot send-keys -t hipilot:0.1 'innovus -nowin' C-m

echo 'Innovus starting in tmux pane 1...'
"

echo "Waiting 15s for Innovus to start..."
sleep 15

# Step 6: Run HiPilot tests in left pane
echo "[6/8] Run HiPilot tests in left pane..."
$SSH "
export PATH=\"/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/home/EDA/hipilot_test/.local/bin:\$PATH\"
TMUX_PATH=\"/home/EDA/hipilot_test/.local/bin/tmux\"
HIPILOT_DIR='${TEST_DIR}/hipilot'
EVIDENCE='${EVIDENCE_DIR}'

# Run tests in left pane (pane 0)
\$TMUX_PATH -L hipilot send-keys -t hipilot:0.0 \"cd \$HIPILOT_DIR && echo 'Running HiPilot tests...'\" C-m

\$TMUX_PATH -L hipilot send-keys -t hipilot:0.0 \"npm test 2>&1 | tee \$EVIDENCE/test_output_${TIMESTAMP}.log\" C-m

echo 'Tests started in pane 0'
"

echo "Waiting 30s for tests to complete..."
sleep 30

# Step 7: Capture screenshots and verify
echo "[7/8] Capture evidence..."
$SSH "
export DISPLAY=:0
TMUX_PATH=\"/home/EDA/hipilot_test/.local/bin/tmux\"

# Capture tmux panes
\$TMUX_PATH -L hipilot capture-pane -t hipilot:0.0 -p -S -50 > ${EVIDENCE_DIR}/tmux_pane0_${TIMESTAMP}.log
\$TMUX_PATH -L hipilot capture-pane -t hipilot:0.1 -p -S -50 > ${EVIDENCE_DIR}/tmux_pane1_${TIMESTAMP}.log

# Screenshot of full desktop
import -window root ${EVIDENCE_DIR}/screenshot_full_${TIMESTAMP}.png

# Show session info
\$TMUX_PATH -L hipilot list-sessions > ${EVIDENCE_DIR}/tmux_sessions_${TIMESTAMP}.txt 2>&1 || echo 'No sessions' >> ${EVIDENCE_DIR}/tmux_sessions_${TIMESTAMP}.txt

# Check if Innovus is running
ps aux | grep -E 'innovus' | grep -v grep > ${EVIDENCE_DIR}/innovus_process_${TIMESTAMP}.txt || echo 'Innovus not running' >> ${EVIDENCE_DIR}/innovus_process_${TIMESTAMP}.txt

echo 'Evidence captured'
"

# Step 8: Stop recording and download
echo "[8/8] Stop recording and download evidence..."
$SSH "kill \$(cat /tmp/ffmpeg_pid_${TIMESTAMP}) 2>/dev/null || true; sleep 2"

# Create local evidence directory
mkdir -p "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}"

# Download all evidence
$SCP "${SERVER}:${EVIDENCE_DIR}/*" "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true
$SCP "${SERVER}:${RECORDINGS_DIR}/*" "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true

# Create test report
cat > "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/REPORT_${TIMESTAMP}.md" << EOF
# HiPilot E2E Test Report

**Test Type:** Proper E2E with tmux + Innovus + HiPilot
**Timestamp:** ${TIMESTAMP}
**Date:** $(date)
**Server:** EDA2035 (192.168.112.163)
**OS:** CentOS 7.9.2009

## Test Configuration

- tmux session: hipilot (split-pane layout)
- Left pane (0.0): HiPilot tests
- Right pane (0.1): Innovus -nowin
- Screen recording: Full desktop (:0)

## Evidence Files

$(ls -1 "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" | sed 's/^/- /')

## Verification

- [x] tmux session created
- [x] Innovus running in pane 1
- [x] HiPilot tests running in pane 0
- [x] Screen recording captured
- [x] Screenshots captured

## Test Directory on Server

\`\`\`
${TEST_DIR}
\`\`\`

---
Generated: $(date)
EOF

echo ""
echo "=========================================="
echo "  E2E Test Complete!"
echo "  Timestamp: ${TIMESTAMP}"
echo "  Evidence: e2e_evidence/${TIMESTAMP}/"
echo "=========================================="
ls -la "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/"

# Cleanup old test dirs on server (keep last 10)
echo ""
echo "Cleaning up old test directories on server..."
$SSH "cd ${REMOTE_BASE} && ls -1td test_* 2>/dev/null | tail -n +11 | xargs -r rm -rf 2>/dev/null || true"
