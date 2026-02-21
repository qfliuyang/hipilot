#!/bin/bash
# HiPilot Human-Like E2E Test with VIDEO Recording
# Run this to get a complete video of the E2E test

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no"
LOCAL_DIR="/Users/luzi/code/hipilot-0.3.0/hipilot"

echo "========================================"
echo "  HiPilot VIDEO E2E Test"
echo "  Timestamp: $TIMESTAMP"
echo "========================================"

# Step 1: Create directory and START VIDEO FIRST
$SSH "mkdir -p /home/EDA/hipilot_test/test_${TIMESTAMP}/{recordings,evidence,hipilot}"

echo "[1/6] Starting VIDEO recording..."
$SSH "
export DISPLAY=:0
pkill -f 'ffmpeg.*x11grab' 2>/dev/null || true
sleep 1
ffmpeg -y -f x11grab -video_size 2880x1800 -framerate 30 -i :0 \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
  /home/EDA/hipilot_test/test_${TIMESTAMP}/recordings/e2e_${TIMESTAMP}.mp4 \
  </dev/null >/dev/null 2>&1 &
echo \$! > /tmp/ffmpeg_${TIMESTAMP}.pid
sleep 3
echo 'VIDEO RECORDING STARTED'
"

echo "[2/6] Upload code..."
tar czf /tmp/hipilot_${TIMESTAMP}.tar.gz -C "$LOCAL_DIR" \
  --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' . 2>/dev/null
$SCP "/tmp/hipilot_${TIMESTAMP}.tar.gz" "EDA@192.168.112.163:/home/EDA/hipilot_test/test_${TIMESTAMP}/hipilot/"
$SSH "cd /home/EDA/hipilot_test/test_${TIMESTAMP}/hipilot && tar xzf hipilot_${TIMESTAMP}.tar.gz && rm hipilot_${TIMESTAMP}.tar.gz && find . -name '._*' -delete"
rm -f /tmp/hipilot_${TIMESTAMP}.tar.gz

echo "[3/6] Setup tmux with Innovus..."
$SSH "
export DISPLAY=:0
export PATH=/home/EDA/hipilot_test/.local/bin:\$PATH
\$HOME/.local/bin/tmux -L hipilot kill-server 2>/dev/null || true
sleep 1
cd /home/EDA/hipilot_test/test_${TIMESTAMP}/hipilot
\$HOME/.local/bin/tmux -L hipilot new-session -d -s hipilot -x 240 -y 60
\$HOME/.local/bin/tmux -L hipilot split-window -h -l 50%
\$HOME/.local/bin/tmux -L hipilot set-option -g status on
\$HOME/.local/bin/tmux -L hipilot set-option -g status-left '#[fg=#00d4ff] HiPilot #[fg=#ffd700]| VIDEO E2E '
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.1 'innovus -nowin' C-m
"

echo "[4/6] Open VISIBLE terminal..."
$SSH "
export DISPLAY=:0
export PATH=/home/EDA/hipilot_test/.local/bin:\$PATH
gnome-terminal --title='HiPilot VIDEO Test - ${TIMESTAMP}' --geometry=220x60+50+50 \
  -- \$HOME/.local/bin/tmux -L hipilot attach -t hipilot &
"

echo "Waiting 25s for Innovus to start..."
sleep 25

echo "[5/6] Run tests..."
$SSH "
export DISPLAY=:0
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/home/EDA/hipilot_test/.local/bin:\$PATH
cd /home/EDA/hipilot_test/test_${TIMESTAMP}/hipilot
npm install >/dev/null 2>&1
\$HOME/.local/bin/tmux -L hipilot send-keys -t hipilot:0.0 'npm test 2>&1 | head -50' C-m
"

echo "Tests running (45s)..."
sleep 45

echo "[6/6] Stop recording..."
$SSH "
FFMPEG_PID=\$(cat /tmp/ffmpeg_${TIMESTAMP}.pid)
kill -INT \$FFMPEG_PID 2>/dev/null || true
sleep 3
ls -lh /home/EDA/hipilot_test/test_${TIMESTAMP}/recordings/
"

echo "Downloading video..."
mkdir -p "$LOCAL_DIR/e2e_evidence/${TIMESTAMP}"
$SCP "EDA@192.168.112.163:/home/EDA/hipilot_test/test_${TIMESTAMP}/recordings/*" \
  "$LOCAL_DIR/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true

echo ""
echo "========================================"
echo "  VIDEO E2E COMPLETE"
echo "  Timestamp: $TIMESTAMP"
echo "  Video: e2e_evidence/${TIMESTAMP}/"
echo "========================================"
ls -lh "$LOCAL_DIR/e2e_evidence/${TIMESTAMP}/"
