# HiPilot Three-Brain + Team Mode Test Plan

**Version:** 1.0
**Date:** 2026-03-14
**Status:** Active
**Scope:** ASIC-Brain, EDA-Brain, Project-Brain, Team Mode (6 Agents)

---

## 1. Executive Summary

This test plan validates HiPilot's Three-Brain Architecture and Team Mode through progressive certification. Each layer must pass before advancing to the next.

### Test Pyramid

```
┌─────────────────────────────────────────┐
│  Layer 5: E2E Flow Certification        │ ← Full RTL2GDS with team
│  (1 test, 45-90 min)                    │
├─────────────────────────────────────────┤
│  Layer 4: Team Mode Integration         │ ← 6-agent orchestration
│  (8 tests, 20 min)                      │
├─────────────────────────────────────────┤
│  Layer 3: Three-Brain Integration       │ ← Brain-to-brain communication
│  (12 tests, 15 min)                     │
├─────────────────────────────────────────┤
│  Layer 2: Individual Brain Unit Tests   │ ← ASIC, EDA, Project brains
│  (24 tests, 10 min)                     │
├─────────────────────────────────────────┤
│  Layer 1: Infrastructure & MCP          │ ← Server startup, connectivity
│  (6 tests, 5 min)                       │
└─────────────────────────────────────────┘
```

### Progress Dashboard

| Layer | Tests | Passed | Failed | Status | Blocker |
|-------|-------|--------|--------|--------|---------|
| L1: Infrastructure | 6 | ⬜ | ⬜ | 🔘 Not Started | - |
| L2: Brain Units | 24 | ⬜ | ⬜ | 🔘 Not Started | - |
| L3: Brain Integration | 12 | ⬜ | ⬜ | 🔘 Not Started | - |
| L4: Team Mode | 8 | ⬜ | ⬜ | 🔘 Not Started | - |
| L5: E2E Flow | 1 | ⬜ | ⬜ | 🔘 Not Started | - |

**Overall Progress:** 0/51 tests (0%)

---

## 2. Layer 1: Infrastructure Tests (5 min)

**Objective:** Verify MCP servers start and communicate correctly.

### Test 1.1: MCP Server Startup
```bash
# Test command
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js | head -20

# Pass criteria: Returns valid JSON with tool list
# Expected time: < 2 seconds
```

### Test 1.2: Knowledge MCP Three-Brain Export
```bash
# Verify all three brains export required functions
node -e "
const asic = await import('./servers/knowledge/asic-brain/index.js');
const eda = await import('./servers/knowledge/eda-brain/index.js');
const project = await import('./servers/knowledge/project-brain/index.js');
console.log('ASIC exports:', Object.keys(asic).slice(0, 5));
console.log('EDA exports:', Object.keys(eda).slice(0, 5));
console.log('Project exports:', Object.keys(project).slice(0, 5));
"

# Pass criteria: All brains export without errors
```

### Test 1.3: Team Module Load
```bash
# Verify team module imports correctly
node -e "await import('./src/team/index.js')" && echo "PASS: Team module loads"

# Pass criteria: No import errors
```

### Test 1.4: Tmux Socket Creation
```bash
# Test team mode workspace creation
bin/hipilot-team --no-terminal
tmux -L hipilot-team list-panes 2>/dev/null | grep -c "pane"
tmux -L hipilot-team kill-session 2>/dev/null

# Pass criteria: 7 panes created
```

### Test 1.5: Settings.json Validation
```bash
# Validate MCP configuration
cat ~/.claude/settings.json | python3 -c "import json,sys; json.load(sys.stdin)" && echo "Valid JSON"

# Pass criteria: Valid JSON structure
```

### Test 1.6: Environment Variable Propagation
```bash
export HIPILOT_DESIGN_DIR=/tmp/test_design
bin/hipilot-team --no-terminal
tmux -L hipilot-team show-environment HIPILOT_DESIGN_DIR 2>/dev/null
tmux -L hipilot-team kill-session 2>/dev/null

# Pass criteria: Environment variable visible in session
```

**Layer 1 Progress:** ⬜⬜⬜⬜⬜⬜ (0/6)

---

## 3. Layer 2: Individual Brain Unit Tests (10 min)

### 3.1 ASIC-Brain Tests (8 tests)

| Test | Function | Input | Expected Output | Status |
|------|----------|-------|-----------------|--------|
| 2.1.1 | `generateTcl` | `{intent: "floorplan", tool: "innovus"}` | Valid Tcl string | ⬜ |
| 2.1.2 | `sanitizeScript` | `"set x [bad cmd`" | Fixed/sanitized Tcl | ⬜ |
| 2.1.3 | `parseOutput` | `"WNS: -0.123 ns"` | `{wns: -0.123}` | ⬜ |
| 2.1.4 | `FlowContext` | Create instance | Object with `completedStages` | ⬜ |
| 2.1.5 | `validateIntent` | `"synthesis"` stage | `{valid: true}` | ⬜ |
| 2.1.6 | `getStageDefinition` | `"placement"` | Stage config object | ⬜ |
| 2.1.7 | `extractQoR` | Innovus timing report | WNS/TNS extracted | ⬜ |
| 2.1.8 | `autoFix` | Common Tcl error | Fixed script + confidence | ⬜ |

### 3.2 EDA-Brain Tests (8 tests)

| Test | Function | Input | Expected Output | Status |
|------|----------|-------|-----------------|--------|
| 2.2.1 | `getCommandInfo` | `"report_timing"` | Command metadata | ⬜ |
| 2.2.2 | `matchErrorPattern` | `"IMPLF-53"` error | Pattern match + fix | ⬜ |
| 2.2.3 | `validateSyntax` | Valid Innovus Tcl | `{valid: true}` | ⬜ |
| 2.2.4 | `validateSyntax` | Invalid syntax | `{valid: false, errors: [...]}` | ⬜ |
| 2.2.5 | `getToolInfo` | `"innovus"` | Tool metadata | ⬜ |
| 2.2.6 | `getBestPractices` | `"cts"` | Best practice array | ⬜ |
| 2.2.7 | `findCommand` | `"place"` partial | Matching commands | ⬜ |
| 2.2.8 | `ERROR_PATTERNS` | Check all patterns | All have regex + fix | ⬜ |

### 3.3 Project-Brain Tests (8 tests)

| Test | Function | Input | Expected Output | Status |
|------|----------|-------|-----------------|--------|
| 2.3.1 | `ProjectBrain.remember` | category, key, value | Stored successfully | ⬜ |
| 2.3.2 | `ProjectBrain.recall` | Existing key | Retrieved value | ⬜ |
| 2.3.3 | `ProjectBrain.recall` | Missing key | `null` | ⬜ |
| 2.3.4 | `recordQoR` | WNS/TNS data | QoR snapshot saved | ⬜ |
| 2.3.5 | `recordError` | Error pattern | Error logged with context | ⬜ |
| 2.3.6 | `search` | Query string | Matching memories | ⬜ |
| 2.3.7 | `getContext` | Stage number | Context object | ⬜ |
| 2.3.8 | Persistence | Write + reload | Data persists | ⬜ |

**Layer 2 Progress:** ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ (0/24)

---

## 4. Layer 3: Three-Brain Integration Tests (15 min)

**Objective:** Verify brains communicate and share context correctly.

### Test 3.1: ASIC → EDA Brain Chain
```javascript
// Test: Tcl generation → Validation
const asic = createASICBrain();
const eda = createEDABrain();
const tcl = asic.generateTcl("floorplan", "innovus", {});
const validation = eda.validateSyntax(tcl, "innovus");
// Pass: validation.valid === true
```

### Test 3.2: EDA Error → ASIC Fix Chain
```javascript
// Test: Error pattern → Auto-fix
const error = "IMPLF-53: layer referenced in pin";
const pattern = eda.matchErrorPattern(error);
const fix = asic.autoFix({error, pattern});
// Pass: fix.script !== null && fix.confidence > 0.5
```

### Test 3.3: Project Brain Context Injection
```javascript
// Test: Historical context informs generation
project.remember("error_patterns", "IMPLF-53", {resolution: "..."});
const context = project.getContext(2); // floorplan stage
const tcl = asic.generateTcl("floorplan", "innovus", context);
// Pass: tcl includes LEF order fix from memory
```

### Test 3.4: Full Three-Brain Loop
```javascript
// Test: Generate → Execute (sim) → Parse → Learn
const tcl = asic.generateTcl("placement", "innovus", {});
const exec = simulateExecution(tcl); // Mock execution
const qor = asic.parseOutput(exec.output);
project.recordQoR("placement", qor);
const lesson = learner.analyze(project.getHistory());
// Pass: QoR extracted, history recorded, lesson generated
```

### Test 3.5: Cross-Brain State Consistency
```javascript
// Test: All brains agree on current stage
const asicStage = asic.flowContext.getCurrentStage();
const projectStage = project.getCurrentStage();
const edaTool = eda.getRecommendedTool(projectStage);
// Pass: asicStage === projectStage, edaTool matches
```

### Test 3.6: Error Recovery Integration
```javascript
// Test: Error flows through all three brains
const error = simulateError("placement");
const edaPattern = eda.matchErrorPattern(error);
const asicFix = asic.recommendFix(edaPattern);
const projectHistory = project.recall("error_patterns", edaPattern.id);
// Pass: Complete chain from error → pattern → fix → history
```

### Test 3.7: QoR Trend Analysis
```javascript
// Test: Multi-stage QoR tracking
project.recordQoR("synthesis", {wns: 0.1, tns: 0});
project.recordQoR("placement", {wns: -0.5, tns: -100});
project.recordQoR("cts", {wns: -0.2, tns: -50});
const trend = project.getQoRTrend();
// Pass: trend shows improvement from placement to cts
```

### Test 3.8: Checkpoint Resume
```javascript
// Test: Flow resumes from checkpoint
project.setStage(5); // Post-CTS
const plan = asic.planStage("post_cts_opt", project.getContext());
// Pass: plan.stages_to_run starts from correct checkpoint
```

### Test 3.9: Concurrent Brain Access
```javascript
// Test: Multiple brains used in parallel
const results = await Promise.all([
  asic.generateTcl("floorplan", "innovus", {}),
  eda.getBestPractices("floorplan"),
  project.getContext(2)
]);
// Pass: All three complete without race conditions
```

### Test 3.10: Brain Reinitialization
```javascript
// Test: Brains can be recreated with same state
const project1 = new ProjectBrain("/design");
project1.remember("test", "key", "value");
const project2 = new ProjectBrain("/design");
const value = project2.recall("test", "key");
// Pass: value === "value" (persistent storage works)
```

### Test 3.11: Invalid Cross-Brain Requests
```javascript
// Test: Brains handle invalid inter-brain requests
try {
  eda.validateSyntax("invalid_tcl", "nonexistent_tool");
} catch (e) {
  // Pass: Error thrown or graceful fallback
}
```

### Test 3.12: Memory Cleanup
```javascript
// Test: Brains don't leak memory on repeated operations
const initial = process.memoryUsage().heapUsed;
for (let i = 0; i < 100; i++) {
  asic.generateTcl("floorplan", "innovus", {});
}
const final = process.memoryUsage().heapUsed;
// Pass: (final - initial) < 10MB growth
```

**Layer 3 Progress:** ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ (0/12)

---

## 5. Layer 4: Team Mode Integration Tests (20 min)

**Objective:** Verify 6-agent orchestration works correctly.

### Test 4.1: Agent Registry Validation
```javascript
// Test: All 6 agents defined with correct properties
const registry = require('./src/team/index.js').AGENT_REGISTRY;
const required = ['supervisor', 'knowledge', 'planner', 'executor', 'memory', 'learner'];
// Pass: All required agents exist with capabilities, responsibilities
```

### Test 4.2: Team Manager Initialization
```javascript
// Test: TeamManager creates all agents
const team = new TeamManager({
  name: "test_team",
  design_dir: "/tmp/test",
  agents: ['supervisor', 'knowledge', 'planner', 'executor', 'memory', 'learner']
});
await team.initialize();
// Pass: team.agents has 6 entries, all initialized
```

### Test 4.3: Sequential Phase Execution
```javascript
// Test: Phases execute in order
const executionOrder = [];
team.on('phase_start', (phase) => executionOrder.push(phase));
await team.start();
// Pass: Order is ['supervisor', 'knowledge', 'planner', 'execution', 'memory', 'learning']
```

### Test 4.4: Parallel Agent Execution
```javascript
// Test: Memory + Learning run in parallel
const startTimes = {};
team.on('agent_start', (agent) => startTimes[agent] = Date.now());
team.on('agent_complete', (agent) => {
  if (agent === 'memory' || agent === 'learning') {
    const parallel = Math.abs(startTimes.memory - startTimes.learning) < 100;
    // Pass: parallel === true
  }
});
```

### Test 4.5: Error Recovery with Retry
```javascript
// Test: Failed agent retries with backoff
let attempts = 0;
const mockAgent = {
  name: 'test_agent',
  execute: async () => {
    attempts++;
    if (attempts < 3) throw new Error("Transient error");
    return {success: true};
  }
};
// Pass: attempts === 3, final result success
```

### Test 4.6: Human Escalation
```javascript
// Test: Failed retries escalate to human
const team = new TeamManager({
  strategy: { max_retries: 2, escalate_on_failure: true }
});
// Mock agent that always fails
try {
  await team.executeAgent('failing_agent');
} catch (e) {
  // Pass: Escalation file created, team.state === 'escalated'
}
```

### Test 4.7: Knowledge Agent Three-Brain Query
```javascript
// Test: Knowledge agent queries all three brains
const knowledge = await team.runKnowledgeAgent({stage: 2});
// Pass: knowledge has asic_context, eda_context, project_context
```

### Test 4.8: Team Status Reporting
```javascript
// Test: Team reports comprehensive status
const status = team.getStatus();
// Pass: status has progress, agents, phases, current_stage, errors
```

**Layer 4 Progress:** ⬜⬜⬜⬜⬜⬜⬜⬜ (0/8)

---

## 6. Layer 5: End-to-End Flow Certification (90 min)

**Objective:** Complete RTL2GDS flow with team mode.

### Test 5.1: Modular Stage-by-Stage Flow Certification

**Approach:** Test each stage independently using modular slash commands, not monolithic `/rtl2gds`.

#### Prerequisites
- EDA server accessible
- Ibex design available
- 90 minutes available

#### Stage Test Sequence

| Order | Stage | Command | Test Focus | Timeout |
|-------|-------|---------|------------|---------|
| 1 | Synthesis | `/synthesis` | dc_shell, netlist generation | 15 min |
| 2 | Design Init | `/design-init` | Load netlist, MMMC setup | 5 min |
| 3 | Floorplan | `/floorplan` | Die area, IO placement | 10 min |
| 4 | Power Plan | `/powerplan` | VDD/VSS rings, stripes | 10 min |
| 5 | Placement | `/placement` | Cell placement, WNS | 15 min |
| 6 | CTS | `/cts` | Clock tree, skew | 15 min |
| 7 | Post-CTS Opt | `/postcts-opt` | Setup/hold fixing | 10 min |
| 8 | Routing | `/routing` | Global + detail route | 15 min |
| 9 | Route Opt | `/routeopt` | DRC cleanup, timing | 10 min |
| 10 | Chip Finish | `/chipfinish` | Filler, GDS export | 10 min |

#### Execution Steps

```bash
# 1. Launch HiPilot (standard or team mode)
bin/hipilot --no-terminal

# 2. Run stages sequentially with verification
# Type in left pane: /synthesis
# Wait: Check synthesis completes, checkpoint saved
# Type: /design-init
# Wait: Check Innovus loads design successfully
# Continue through all stages...
```

#### Per-Stage Success Criteria

Each stage must:
1. **Start correctly** - Tool launches (innovus/dc_shell), no init errors
2. **Complete Tcl execution** - All commands execute without errors
3. **Save checkpoint** - `.enc` file created for next stage
4. **Report QoR** - WNS/TNS reported explicitly (L5 requirement)
5. **Exit cleanly** - Tool exits, returns to bash prompt

#### Stage Checkpoint Verification

```bash
# After each stage, verify checkpoint exists
ls -lh result/*/data/*.enc

# Verify QoR recorded
cat result/*/report/*_timing.rpt | grep -E "(WNS|TNS)"
```

#### Pass Criteria
- All 10 stages complete independently
- Checkpoints chain correctly (each stage loads previous)
- GDS file generated at end (> 10MB)
- No stage failures (or recovered via retry)
- Final QoR meets targets (WNS > -0.5ns)
- Team agents (if using team mode) coordinated successfully

**Layer 5 Progress:** ⬜ (0/1)

---

## 7. Test Execution Workflow

### Daily Test Cycle

```
08:00 - Run L1 (5 min)     → Must pass before proceeding
08:05 - Run L2 (10 min)    → Fix any unit test failures
08:15 - Run L3 (15 min)    → Fix integration issues
08:30 - Run L4 (20 min)    → Fix team mode bugs
08:50 - Run L5 (90 min)    → Full certification (daily or on demand)
```

### Fix-and-Retest Loop

When a test fails:

1. **Log the failure**
   ```bash
   echo "$(date): L2.1.3 failed - parseOutput returned null" >> test_failures.log
   ```

2. **Create fix task**
   ```bash
   # Create GitHub issue or task
   cat > .test_fix_task.md << 'EOF'
   ## Fix Required
   Layer: L2.1.3
   Function: parseOutput
   Issue: WNS extraction fails on Innovus output
   Expected: {wns: -0.123}
   Actual: null
   EOF
   ```

3. **Implement fix**
   - Fix the code
   - Add regression test

4. **Retest affected layers**
   - Run failed test
   - Run full layer
   - Run dependent layers (L3+ if L2 fixed)

5. **Update progress dashboard**

### Progress Reporting

**Console Output:**
```
═══════════════════════════════════════════════════════════
HiPilot Test Run: 2026-03-14 08:00:00
═══════════════════════════════════════════════════════════

Layer 1: Infrastructure      [██████░░░░]  4/6  PASS (1 fail)
  ✓ 1.1 MCP Server Startup
  ✓ 1.2 Knowledge MCP Export
  ✗ 1.3 Team Module Load - IMPORT ERROR
  ✓ 1.4 Tmux Socket Creation
  ✓ 1.5 Settings.json Validation
  ⏸ 1.6 Environment Variable Propagation - SKIPPED

Layer 2: Brain Units         [░░░░░░░░░░]  0/24 NOT STARTED
Layer 3: Brain Integration   [░░░░░░░░░░]  0/12 NOT STARTED
Layer 4: Team Mode           [░░░░░░░░░░]  0/8  NOT STARTED
Layer 5: E2E Flow            [░░░░░░░░░░]  0/1  NOT STARTED

═══════════════════════════════════════════════════════════
Overall: 4/51 tests (8%) | Blocked by: L1.3
═══════════════════════════════════════════════════════════
```

---

## 8. Test Automation Scripts

### Run All Tests
```bash
#!/bin/bash
# test/run_all.sh

set -e

echo "═══════════════════════════════════════════════════════════"
echo "HiPilot Test Suite - $(date)"
echo "═══════════════════════════════════════════════════════════"

# L1
npm run test:l1 || { echo "L1 FAILED"; exit 1; }

# L2
npm run test:l2 || { echo "L2 FAILED"; exit 1; }

# L3
npm run test:l3 || { echo "L3 FAILED"; exit 1; }

# L4
npm run test:l4 || { echo "L4 FAILED"; exit 1; }

# L5 (only if L1-L4 pass)
npm run test:l5 || { echo "L5 FAILED"; exit 1; }

echo "═══════════════════════════════════════════════════════════"
echo "ALL TESTS PASSED"
echo "═══════════════════════════════════════════════════════════"
```

### Run Single Layer
```bash
# test/run_layer.sh <layer_number>
LAYER=$1

case $LAYER in
  1) node --test test/l1_*.test.js ;;
  2) node --test test/l2_*.test.js ;;
  3) node --test test/l3_*.test.js ;;
  4) node --test test/l4_*.test.js ;;
  5) node test/l5_e2e.test.js ;;
esac
```

---

## 9. Success Criteria Summary

### Minimum Viable Product (MVP)
- L1: 5/6 tests pass (infrastructure stable)
- L2: 18/24 tests pass (75% unit test coverage)
- L3: 9/12 tests pass (basic integration works)
- L4: 6/8 tests pass (team mode functional)
- L5: 0/1 required for MVP

**MVP Threshold:** 38/51 tests (75%)

### Production Ready
- L1: 6/6 tests pass (100%)
- L2: 24/24 tests pass (100%)
- L3: 12/12 tests pass (100%)
- L4: 8/8 tests pass (100%)
- L5: 1/1 test passes (full flow works)

**Production Threshold:** 51/51 tests (100%)

---

## 10. Appendix: Test Data

### Sample Design
- **Name:** ibex_core
- **Technology:** Skywater 130nm
- **Cells:** ~7,000
- **Clocks:** 1 (clk_i)
- **Target:** 100MHz (10ns period)

### Expected QoR Targets
| Stage | WNS Target | TNS Target | Status |
|-------|------------|------------|--------|
| Synthesis | > 0ns | 0 | ⬜ |
| Placement | > -0.5ns | > -200 | ⬜ |
| CTS | > -0.3ns | > -100 | ⬜ |
| Route | > -0.2ns | > -50 | ⬜ |

---

**Document Control:**
- Version: 1.0
- Last Updated: 2026-03-14
- Owner: HiPilot Team
- Review Cycle: Weekly during development
