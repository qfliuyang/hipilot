#!/bin/bash
# HiPilot E2E Test - 7 Major Breakthroughs
# This script tests the core HiPilot functionality

HIPILOT_DIR="/home/EDA/hipilot_test/hipilot"
TEST_LOG="/tmp/hipilot-e2e-$(date +%Y%m%d-%H%M%S).log"
PASSED=0
FAILED=0

log() {
  echo "$1" | tee -a "$TEST_LOG"
}

test_start() {
  log ""
  log "═══════════════════════════════════════════════════"
  log "Testing: $1"
  log "═══════════════════════════════════════════════════"
}

test_pass() {
  log "✅ PASS: $1"
  ((PASSED++))
}

test_fail() {
  log "❌ FAIL: $1"
  ((FAILED++))
}

log "HiPilot E2E Breakthrough Tests"
log "Started: $(date)"
log "Log: $TEST_LOG"

# Test 1: MCP Server Registration (30+ tools)
test_start "Breakthrough 1: MCP Server Registration"
if [ -f "$HIPILOT_DIR/servers/eda/index.js" ]; then
  TOOL_COUNT=$(grep -c "name: 'eda\." "$HIPILOT_DIR/servers/eda/index.js" 2>/dev/null || echo "0")
  if [ "$TOOL_COUNT" -ge 30 ]; then
    test_pass "EDA MCP Server with $TOOL_COUNT tools"
  else
    test_fail "EDA MCP Server - only $TOOL_COUNT tools found (expected 30+)"
  fi
else
  test_fail "EDA MCP Server not found"
fi

# Test 2: Tcl Generation (templates)
test_start "Breakthrough 2: Tcl Generation from Templates"
if [ -d "$HIPILOT_DIR/templates" ]; then
  TEMPLATE_COUNT=$(find "$HIPILOT_DIR/templates" -name "*.tcl" -o -name "*.tcl.j2" 2>/dev/null | wc -l)
  if [ "$TEMPLATE_COUNT" -ge 5 ]; then
    test_pass "Templates available ($TEMPLATE_COUNT found)"
  else
    test_fail "Templates - only $TEMPLATE_COUNT found (expected 5+)"
  fi
else
  test_fail "Templates directory not found"
fi

# Test 3: Mode System (manual approval)
test_start "Breakthrough 3: Mode System (Manual/Auto Approval)"
if node -e "import('./src/lib/mode.js').then(m => { process.exit(m.getMode && m.MODES ? 0 : 1) }).catch(() => process.exit(1))" 2>/dev/null; then
  test_pass "Mode system functions exported"
else
  test_fail "Mode system not properly exported"
fi

# Test 4: Risk Analysis (blocking dangerous operations)
test_start "Breakthrough 4: Risk Analysis"
if node -e "import('./src/lib/risk-analyzer.js').then(m => { const r = m.analyzeRisk('delete_cell'); process.exit(r.category >= 2 ? 0 : 1) }).catch(() => process.exit(1))" 2>/dev/null; then
  test_pass "Risk analysis detects dangerous operations"
else
  test_fail "Risk analysis not working"
fi

# Test 5: AI + EDA Feedback Loop (CRITICAL)
test_start "Breakthrough 5: AI + EDA Feedback Loop"
if [ -f "$HIPILOT_DIR/servers/eda/index.js" ]; then
  if grep -q "eda.capture_and_analyze" "$HIPILOT_DIR/servers/eda/index.js" 2>/dev/null; then
    test_pass "capture_and_analyze tool exists"
  else
    test_fail "capture_and_analyze tool not found"
  fi
else
  test_fail "EDA server not found"
fi

# Test 6: Skills Execution
test_start "Breakthrough 6: Skills Execution"
if [ -d "$HIPILOT_DIR/skills" ]; then
  SKILL_COUNT=$(find "$HIPILOT_DIR/skills" -name "*.md" 2>/dev/null | wc -l)
  if [ "$SKILL_COUNT" -ge 5 ]; then
    test_pass "Skills available ($SKILL_COUNT found)"
  else
    test_fail "Skills - only $SKILL_COUNT found (expected 5+)"
  fi
else
  test_fail "Skills directory not found"
fi

# Test 7: Knowledge Integration
test_start "Breakthrough 7: Knowledge Integration"
if [ -d "$HIPILOT_DIR/.claude/commands" ]; then
  CMD_COUNT=$(find "$HIPILOT_DIR/.claude/commands" -name "*.md" 2>/dev/null | wc -l)
  if [ "$CMD_COUNT" -ge 5 ]; then
    test_pass "Quick commands available ($CMD_COUNT found)"
  else
    test_fail "Quick commands - only $CMD_COUNT found (expected 5+)"
  fi
else
  test_fail "Commands directory not found"
fi

# Summary
log ""
log "═══════════════════════════════════════════════════"
log "                    SUMMARY"
log "═══════════════════════════════════════════════════"
log "Total Tests: $((PASSED + FAILED))"
log "✅ Passed: $PASSED"
log "❌ Failed: $FAILED"
log ""
log "Log saved to: $TEST_LOG"
log "Completed: $(date)"

if [ "$FAILED" -eq 0 ]; then
  log ""
  log "🎉 All breakthrough tests passed!"
  exit 0
else
  log ""
  log "⚠️  Some tests failed. Check the log for details."
  exit 1
fi
