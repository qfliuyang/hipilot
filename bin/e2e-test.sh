#!/bin/bash
# HiPilot E2E Test Runner with Timestamped Directories
# Usage: ./bin/e2e-test.sh [test_name]

set -e

HIPILOT_DIR="${HIPILOT_DIR:-/home/EDA/hipilot_test}"
TEST_NAME="${1:-e2e}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_DIR="${HIPILOT_DIR}/test_${TIMESTAMP}"

# Create test directory structure
mkdir -p "${TEST_DIR}"/{evidence,logs,screenshots,recordings}

# Create README
cat > "${TEST_DIR}/README.txt" << EOF
HiPilot E2E Test Session
========================
Test Name: ${TEST_NAME}
Timestamp: ${TIMESTAMP}
Created: $(date)
Hostname: $(hostname)
User: $(whoami)
EOF

echo "Test directory created: ${TEST_DIR}"
