#!/bin/bash
# HiPilot EDA Integration Tests
# Tests MCP server functionality without full E2E

HIPILOT_DIR="${HIPILOT_DIR:-/home/EDA/hipilot_test/hipilot}"
TEST_LOG="/tmp/hipilot-integration-$(date +%Y%m%d-%H%M%S).log"
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

log "HiPilot EDA Integration Tests"
log "Started: $(date)"
log "Log: $TEST_LOG"
log "HIPILOT_DIR: $HIPILOT_DIR"

# Test 1: MCP Server Tools
test_start "MCP Server Tool Registration"

if [ -f "$HIPILOT_DIR/servers/eda/index.js" ]; then
  EDA_TOOLS=$(grep -c "name: 'eda\." "$HIPILOT_DIR/servers/eda/index.js" 2>/dev/null || echo "0")
  TMUX_TOOLS=$(grep -c "name: 'tmux\." "$HIPILOT_DIR/servers/tmux/index.js" 2>/dev/null || echo "0")
  KNOWLEDGE_TOOLS=$(grep -c "name: 'knowledge\." "$HIPILOT_DIR/servers/knowledge/index.js" 2>/dev/null || echo "0")

  TOTAL_TOOLS=$((EDA_TOOLS + TMUX_TOOLS + KNOWLEDGE_TOOLS))

  if [ "$TOTAL_TOOLS" -ge 25 ]; then
    test_pass "Total MCP tools: $TOTAL_TOOLS (EDA: $EDA_TOOLS, Tmux: $TMUX_TOOLS, Knowledge: $KNOWLEDGE_TOOLS)"
  else
    test_fail "Only $TOTAL_TOOLS tools found (expected 25+)"
  fi
else
  test_fail "MCP server files not found"
fi

# Test 2: Tcl Generation
test_start "Tcl Generation"

cd "$HIPILOT_DIR" || exit 1

# Test template-based generation
GEN_RESULT=$(node -e "
import('./servers/eda/index.js').then(m => {
  // Test generateTcl function indirectly via checking templates
  const fs = require('fs');
  const path = require('path');
  const templates = fs.readdirSync(path.join('$HIPILOT_DIR', 'templates/synopsys'))
    .filter(f => f.endsWith('.tcl'));
  console.log('Templates found:', templates.length);
  process.exit(templates.length >= 5 ? 0 : 1);
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
" 2>/dev/null)

if [ $? -eq 0 ]; then
  test_pass "Tcl templates available for generation"
else
  test_fail "Tcl generation test failed"
fi

# Test 3: Mode System
test_start "Mode System (Manual/Auto)"

MODE_TEST=$(node -e "
import('./src/lib/mode.js').then(m => {
  const mode1 = m.getMode();
  m.setMode('auto');
  const mode2 = m.getMode();
  m.setMode('manual');
  const mode3 = m.getMode();

  if (mode1 === 'manual' && mode2 === 'auto' && mode3 === 'manual') {
    console.log('Mode toggle working');
    process.exit(0);
  } else {
    console.log('Mode toggle failed:', mode1, mode2, mode3);
    process.exit(1);
  }
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
" 2>/dev/null)

if [ $? -eq 0 ]; then
  test_pass "Mode system toggle works correctly"
else
  test_fail "Mode system test failed"
fi

# Test 4: Risk Analysis
test_start "Risk Analysis"

RISK_TEST=$(node -e "
import('./src/lib/risk-analyzer.js').then(m => {
  // Test safe command
  const safe = m.analyzeRisk('report_timing');
  // Test dangerous command
  const dangerous = m.analyzeRisk('delete_cell');
  // Test critical command
  const critical = m.analyzeRisk('save_design');

  if (safe.category === 0 && dangerous.category >= 2 && critical.category >= 2) {
    console.log('Risk categorization working');
    process.exit(0);
  } else {
    console.log('Risk categorization failed:', safe.category, dangerous.category, critical.category);
    process.exit(1);
  }
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
" 2>/dev/null)

if [ $? -eq 0 ]; then
  test_pass "Risk analysis categorizes commands correctly"
else
  test_fail "Risk analysis test failed"
fi

# Test 5: Activity Feed
test_start "Activity Feed"

ACTIVITY_TEST=$(node -e "
import('./src/lib/activity.js').then(m => {
  m.clearActivityLog();
  const entry = m.addActivity('test', 'Test activity', 'success', { test: true });
  const activities = m.getRecentActivities(10);

  if (activities.length === 1 && activities[0].type === 'test') {
    console.log('Activity feed working');
    process.exit(0);
  } else {
    console.log('Activity feed failed:', activities.length);
    process.exit(1);
  }
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
" 2>/dev/null)

if [ $? -eq 0 ]; then
  test_pass "Activity feed records and retrieves entries"
else
  test_fail "Activity feed test failed"
fi

# Test 6: Path Management
test_start "Path Management"

PATH_TEST=$(node -e "
import('./src/lib/paths.js').then(m => {
  const paths = m.getHipilotPaths();

  if (paths.baseDir && paths.modeFile && paths.pendingFile) {
    console.log('Paths generated:', paths.baseDir);
    process.exit(0);
  } else {
    console.log('Paths incomplete');
    process.exit(1);
  }
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
" 2>/dev/null)

if [ $? -eq 0 ]; then
  test_pass "Path management generates user-specific paths"
else
  test_fail "Path management test failed"
fi

# Test 7: Syntax Highlighting
test_start "Tcl Syntax Highlighting"

HIGHLIGHT_TEST=$(node -e "
import('./src/lib/tcl-highlighter.js').then(m => {
  const code = 'report_timing -max_paths 10';
  const highlighted = m.highlightTcl(code);

  if (highlighted && highlighted.length > 0) {
    console.log('Syntax highlighting applied');
    process.exit(0);
  } else {
    console.log('Syntax highlighting failed');
    process.exit(1);
  }
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
" 2>/dev/null)

if [ $? -eq 0 ]; then
  test_pass "Tcl syntax highlighting works"
else
  test_fail "Syntax highlighting test failed"
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
  log "🎉 All integration tests passed!"
  exit 0
else
  log ""
  log "⚠️  Some tests failed. Check the log for details."
  exit 1
fi
