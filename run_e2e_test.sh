#!/bin/bash
# HiPilot E2E Test Script - Following TESTING_GUIDE.md
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no"
SERVER="EDA@192.168.112.163"

LOCAL_DIR="/Users/luzi/code/hipilot-0.3.0/hipilot"
REMOTE_BASE="/home/EDA/hipilot_test"
REMOTE_DIR="${REMOTE_BASE}/test_${TIMESTAMP}/hipilot"
RECORDINGS_DIR="${REMOTE_BASE}/test_${TIMESTAMP}/recordings"
EVIDENCE_DIR="${REMOTE_BASE}/test_${TIMESTAMP}/evidence"

echo "[1/6] Cleaning up old sessions..."
$SSH 'pkill -u EDA tmux 2>/dev/null || true; pkill -u EDA ffmpeg 2>/dev/null || true; pkill -u EDA gnome-terminal 2>/dev/null || true; rm -f /tmp/hipilot_*.tcl /tmp/hipilot_mode 2>/dev/null || true; echo "manual" > /tmp/hipilot_mode; sleep 2; echo "Cleanup complete."'

echo "[2/6] Creating test directory..."
$SSH "mkdir -p ${REMOTE_DIR} ${RECORDINGS_DIR} ${EVIDENCE_DIR}; echo 'Test: ${TIMESTAMP}' > ${REMOTE_BASE}/test_${TIMESTAMP}/README.txt"

echo "[3/6] Uploading code..."
tar czf /tmp/hipilot_e2e_${TIMESTAMP}.tar.gz -C "${LOCAL_DIR}" --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' --exclude='*.log' .
$SCP "/tmp/hipilot_e2e_${TIMESTAMP}.tar.gz" "${SERVER}:${REMOTE_DIR}/"
$SSH "cd ${REMOTE_DIR} && tar xzf hipilot_e2e_${TIMESTAMP}.tar.gz && rm hipilot_e2e_${TIMESTAMP}.tar.gz"
rm -f /tmp/hipilot_e2e_${TIMESTAMP}.tar.gz

echo "[4/6] Starting screen recording..."
$SSH "VIDEO_FILE='${RECORDINGS_DIR}/e2e_demo_${TIMESTAMP}.mp4'; DISPLAY=:0 ffmpeg -y -f x11grab -video_size 2880x1800 -framerate 15 -i :0 -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \"\$VIDEO_FILE\" < /dev/null > /tmp/ffmpeg_${TIMESTAMP}.log 2>&1 &; echo \$VIDEO_FILE > /tmp/ffmpeg_video_file_${TIMESTAMP}; echo \$! > /tmp/ffmpeg_pid_${TIMESTAMP}; sleep 2; echo \"Recording started\""

echo "[5/6] Running E2E tests..."
$SSH "export PATH=\"/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:\$PATH\"; cd ${REMOTE_DIR}; npm test 2>&1 | tee ${EVIDENCE_DIR}/unit_test_${TIMESTAMP}.log; import -window root ${EVIDENCE_DIR}/screenshot_${TIMESTAMP}.png"

echo "[6/6] Stopping recording and downloading evidence..."
$SSH "kill \$(cat /tmp/ffmpeg_pid_${TIMESTAMP}) 2>/dev/null || true; sleep 2"

mkdir -p "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}"
$SCP "${SERVER}:${EVIDENCE_DIR}/*" "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true
$SCP "${SERVER}:${RECORDINGS_DIR}/*" "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || true

echo ""
echo "=========================================="
echo "E2E Test Complete! Timestamp: ${TIMESTAMP}"
echo "Evidence: e2e_evidence/${TIMESTAMP}/"
echo "=========================================="
ls -la "${LOCAL_DIR}/e2e_evidence/${TIMESTAMP}/" 2>/dev/null || echo "No evidence downloaded"
