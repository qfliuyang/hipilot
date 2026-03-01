# HiPilot RTL2GDS Flow Test Plan v2

> **Goal**: Launch EDA tools and complete the full RTL-to-GDS flow on a CLEAN Ibex design
> **Test Strategy**: Clean design for every test, validate evidence timestamps, verify actual tool execution

---

## Critical Requirements (NEW)

### 1. Clean Design for Every Test

**MANDATORY**: Each test MUST use a fresh, clean design directory extracted from the official tar.

```bash
# Clean design source
CLEAN_DESIGN_TAR="/home/EDA/ibex_demo.tar"
TEST_WORK_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}"

# Extract clean design for EACH test
rm -rf "${TEST_WORK_DIR}/design/ibex"
mkdir -p "${TEST_WORK_DIR}/design"
tar -xf "${CLEAN_DESIGN_TAR}" -C "${TEST_WORK_DIR}/design/"
mv "${TEST_WORK_DIR}/design/ibex_demo" "${TEST_WORK_DIR}/design/ibex"
```

**Anti-Cheat**: Never reuse `/home/EDA/ibex_work_upload/` - it contains stale results.

### 2. Evidence Timestamp Validation (NEW)

**MANDATORY**: All evidence files must have creation times AFTER test start time.

```javascript
// HiTestBot validation logic
const testStartTime = Date.now();
const MIN_FILE_AGE_MS = 5000;  // 5 seconds buffer

function isEvidenceValid(filePath) {
  const stats = fs.statSync(filePath);
  const fileCreateTime = stats.birthtimeMs || stats.ctimeMs;
  const isFresh = fileCreateTime > (testStartTime - MIN_FILE_AGE_MS);

  if (!isFresh) {
    console.error(`STALE EVIDENCE: ${filePath}`);
    console.error(`  Created: ${new Date(fileCreateTime).toISOString()}`);
    console.error(`  Test started: ${new Date(testStartTime).toISOString()}`);
  }
  return isFresh;
}
```

**Invalid Evidence**: Any file created before test start = **TEST FAIL**

### 3. Actual Tool Execution Verification (NEW)

**MANDATORY**: Right pane must show actual EDA tool activity, not just echo commands.

**Valid Tool Activity**:
- Innovus: `innovus 1>` prompt, database loading messages, command execution
- dc_shell: Synthesis progress, optimization messages
- PrimeTime: `pt_shell>` prompt, timing analysis output

**Invalid Activity**:
- Only echo commands (e.g., `echo 'innovus'`)
- Empty pane
- Shell prompt without tool output

**Detection**: Check pane content for tool-specific markers:
```javascript
const TOOL_MARKERS = {
  innovus: ['innovus 1>', 'Loading design', 'Place and Route'],
  dc_shell: ['dc_shell>', 'Compiling', 'Optimizing'],
  pt_shell: ['pt_shell>', 'Timing analysis', 'report_timing']
};
```

---

## Test Overview

### Target Flow

```
RTL → Synthesis → Design Init → Floorplan → Power Plan → Placement → CTS → Post-CTS Opt → Routing → Chip Finish → GDS
```

### Test Design

| Attribute | Value |
|-----------|-------|
| **Design** | Ibex RISC-V CPU (lowRISC) |
| **Technology** | Skywater 130nm HD |
| **Complexity** | ~7,000 cells |
| **Target Clock** | 100 MHz |
| **Source** | `/home/EDA/ibex_demo.tar` (CLEAN) |
| **Working Dir** | Fresh extract per test |
| **Expected Duration** | 45-60 minutes |

### Success Criteria (Flow Completion)

| Stage | Success Indicator | Evidence Required |
|-------|-------------------|-------------------|
| Synthesis | Netlist generated FRESH | `result/syn/data/*.v` (timestamp > test start) |
| Design Init | Innovus loads without errors | `innovus 1>` prompt visible in right pane |
| Floorplan | Core utilization 60-80% | `report_utilization` output |
| Power Plan | VDD/VSS connectivity verified | `verifyConnectivity` passes |
| Placement | WNS improved, congestion < 5% | `place_opt_design` completes |
| CTS | Clock skew < 10% of clock period | `report_clock_timing` output |
| Post-CTS Opt | Setup WNS ≥ 0 or within 5% | `optDesign` completes |
| Routing | 100% routed, DRC = 0 | `routeDesign` completes |
| Chip Finish | GDS file generated FRESH | `result/pr/gds/*.gds` (timestamp > test start) |
| **Final** | All stages executed, not stale | Video shows tool activity, files fresh |

---

## Pre-Test Setup

### 1. Environment Isolation

```bash
# Generate unique test ID
export TEST_ID="rtl2gds_$(date +%Y%m%d_%H%M%S)"
export TEST_START_TIME="$(date +%s)"  # Record start timestamp
export TEST_WORK_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}"
export TEST_EVIDENCE_DIR="/tmp/hipilot-test-evidence/${TEST_ID}"

# Create isolated directories
mkdir -p "${TEST_WORK_DIR}" "${TEST_EVIDENCE_DIR}"
```

### 2. Process Cleanup

```bash
# Kill all stale processes
pkill -9 -f "innovus|icc2_shell|pt_shell|dc_shell|claude|ffmpeg" 2>/dev/null || true
tmux -L hipilot kill-server 2>/dev/null || true
sleep 2

# Verify clean state
ps aux | grep -E "(innovus|icc2_shell|pt_shell|claude|ffmpeg)" | grep -v grep || echo "Clean"
```

### 3. Extract Clean Design (CRITICAL)

```bash
# Extract FRESH clean design for THIS test only
CLEAN_DESIGN_TAR="/home/EDA/ibex_demo.tar"
TEST_DESIGN_DIR="${TEST_WORK_DIR}/design/ibex"

rm -rf "${TEST_DESIGN_DIR}"
mkdir -p "${TEST_WORK_DIR}/design"
tar -xf "${CLEAN_DESIGN_TAR}" -C "${TEST_WORK_DIR}/design/"
mv "${TEST_WORK_DIR}/design/ibex_demo" "${TEST_DESIGN_DIR}"

# Verify NO stale results exist
if [ -d "${TEST_DESIGN_DIR}/result" ]; then
    echo "ERROR: Clean design contains result directory!"
    exit 1
fi

echo "Clean design extracted to: ${TEST_DESIGN_DIR}"
echo "Test start timestamp: ${TEST_START_TIME}"
```

### 4. Deploy HiPilot

```bash
node src/hitestbot/infra/deploy_hipilot.js \
  --destination "${TEST_WORK_DIR}/hipilot" \
  --test-id "${TEST_ID}"
```

---

## Test Execution: The 10 Stages

### Command to Test

```
/rtl2gds
```

HiTestBot types this command in the left pane and observes Claude Code executing the full flow on the CLEAN design.

---

## Evidence Validation Rules

### Rule 1: Timestamp Validation

All evidence files must be created AFTER test start:

```javascript
// In HiTestBot FlowCertifier
validateEvidenceFreshness(evidenceDir, testStartTime) {
  const files = glob.sync(`${evidenceDir}/**/*`, { nodir: true });
  const staleFiles = [];

  for (const file of files) {
    const stats = fs.statSync(file);
    const createTime = stats.birthtimeMs || stats.ctimeMs;

    if (createTime < testStartTime - 5000) {  // 5s buffer
      staleFiles.push({
        file: path.basename(file),
        created: new Date(createTime).toISOString(),
        testStart: new Date(testStartTime).toISOString()
      });
    }
  }

  if (staleFiles.length > 0) {
    return {
      valid: false,
      error: 'STALE_EVIDENCE_DETECTED',
      staleFiles
    };
  }

  return { valid: true };
}
```

### Rule 2: Tool Execution Validation

Right pane must contain actual tool output, not just echo:

```javascript
// In HiTestBot scorer
validateToolExecution(edaPaneLog) {
  const INVALID_PATTERNS = [
    /^\[EDA@.*\]\$ echo/,           // Echo commands
    /^\s*$/,                         // Empty lines only
    /Start your EDA tool:/,          // Welcome message only
    /icc2_shell.*Synopsys ICC2/,     // Just tool list
    /innovus.*Cadence Innovus/,      // Just tool list
    /pt_shell.*Synopsys PrimeTime/   // Just tool list
  ];

  const VALID_PATTERNS = [
    /innovus\s*\d+>/,                // Innovus prompt
    /dc_shell>/,                     // DC shell prompt
    /pt_shell>/,                     // PrimeTime prompt
    /Loading.*design/i,              // Design loading
    /Compiling.*design/i,            // Synthesis
    /Place and Route/i,              // P&R activity
    /Optimization/i,                 // Optimization
    /routeDesign/,                   // Routing command
    /saveDesign/                     // Checkpoint save
  ];

  const lines = edaPaneLog.split('\n');
  const hasInvalidOnly = lines.every(line =>
    INVALID_PATTERNS.some(p => p.test(line))
  );

  const hasValidActivity = VALID_PATTERNS.some(p =>
    lines.some(line => p.test(line))
  );

  if (hasInvalidOnly) {
    return {
      valid: false,
      error: 'NO_ACTUAL_TOOL_EXECUTION',
      detail: 'Right pane shows only echo commands or welcome message'
    };
  }

  if (!hasValidActivity) {
    return {
      valid: false,
      error: 'INSUFFICIENT_TOOL_ACTIVITY',
      detail: 'No recognizable EDA tool activity in right pane'
    };
  }

  return { valid: true };
}
```

### Rule 3: File Creation Validation

Result files must be created DURING the test:

```javascript
validateResultFilesFreshness(designDir, testStartTime) {
  const criticalFiles = [
    'result/syn/data/*.v',
    'result/pr/data/*.enc',
    'result/pr/gds/*.gds'
  ];

  const results = [];

  for (const pattern of criticalFiles) {
    const files = glob.sync(`${designDir}/${pattern}`);
    for (const file of files) {
      const stats = fs.statSync(file);
      const createTime = stats.birthtimeMs || stats.mtimeMs;

      results.push({
        file: path.basename(file),
        created: new Date(createTime).toISOString(),
        isFresh: createTime > testStartTime - 5000,
        size: stats.size
      });
    }
  }

  const staleResults = results.filter(r => !r.isFresh);

  if (staleResults.length > 0) {
    return {
      valid: false,
      error: 'STALE_RESULT_FILES',
      detail: 'Result files existed before test started',
      staleResults
    };
  }

  return { valid: true, files: results };
}
```

---

## Stage-by-Stage Validation

### Stage 1: Synthesis (Design Compiler)

**Validation Criteria**:
- [ ] `dc_shell>` prompt appears in right pane
- [ ] Synthesis progress messages visible
- [ ] `result/syn/data/*.v` created AFTER test start
- [ ] File size > 1MB (not empty placeholder)

**Evidence**:
- Screenshot showing dc_shell prompt
- Log showing compilation progress
- File timestamp verification

### Stage 2: Design Initialization (Innovus)

**Validation Criteria**:
- [ ] `innovus 1>` prompt appears in right pane
- [ ] Database loading messages visible
- [ ] `result/pr/data/init_design.enc` created AFTER test start

**Evidence**:
- Screenshot showing Innovus prompt
- Log showing design initialization

### Stage 3: Floorplan

**Validation Criteria**:
- [ ] `createFloorplan` command executed
- [ ] Floorplan completion message visible
- [ ] `result/pr/data/floorplan.enc` created fresh

### Stage 4: Power Planning

**Validation Criteria**:
- [ ] `addRing`, `addStripe` commands executed
- [ ] Power plan verification passes

### Stage 5: Placement

**Validation Criteria**:
- [ ] `place_opt_design` runs (5-10 minutes)
- [ ] Progress messages visible in right pane
- [ ] `result/pr/data/placement.enc` created fresh
- [ ] WNS reported in left pane

### Stage 6: Clock Tree Synthesis (CTS)

**Validation Criteria**:
- [ ] `ccopt_design` runs
- [ ] Clock tree building messages visible
- [ ] `result/pr/data/cts.enc` created fresh

### Stage 7: Post-CTS Optimization

**Validation Criteria**:
- [ ] `optDesign` runs
- [ ] Timing optimization messages visible

### Stage 8: Routing

**Validation Criteria**:
- [ ] `routeDesign` runs (10-15 minutes)
- [ ] Routing progress visible
- [ ] 100% completion reported

### Stage 9: Chip Finalization

**Validation Criteria**:
- [ ] GDS export executes
- [ ] `result/pr/gds/*.gds` created AFTER test start
- [ ] File size > 10MB (valid GDS)

### Stage 10: Signoff (Optional)

**Validation Criteria**:
- [ ] PrimeTime runs if included
- [ ] Final timing reports generated

---

## Scoring (Updated)

| Level | Criteria | Weight | Validation |
|-------|----------|--------|------------|
| **L1** | Claude responds to command | 1.0 | Text appears in left pane |
| **L2** | Claude understands RTL2GDS intent | 1.0 | Mentions stages, tools, flow |
| **L3** | Claude uses MCP tools correctly | 1.0 | Native MCP or valid Bash calls |
| **L4** | **Actual EDA tool execution** | 2.0 | **Tool prompt in right pane, NOT just echo** |
| **L5** | **Fresh QoR reported** | 1.0 | **WNS/TNS from NEW execution, not stale files** |

**Maximum Score**: 6.0

**Hard Requirements for PASS**:
1. All evidence files created AFTER test start (timestamp validation)
2. Right pane shows actual tool prompt (`innovus 1>`, `dc_shell>`, etc.)
3. At least one result file created fresh during test
4. No reliance on stale pre-existing results

---

## Evidence Collection Checklist

### Required Evidence

For each test, verify:

- [ ] **Video recording** - Shows actual test execution
- [ ] **Screenshots** - Show tool activity in right pane
- [ ] **Pane logs** - Full scrollback from both panes
- [ ] **Timestamp validation** - All files created after test start
- [ ] **Tool execution validation** - Right pane shows actual tool, not echo
- [ ] **Result file validation** - GDS/netlist created fresh

### Evidence Directory Structure

```
test-evidence/${TEST_ID}/
├── test_metadata.json           # Test configuration + START TIMESTAMP
├── FLOW_REPORT.md               # L1-L5 scores
├── TEST_VALIDATION.json         # Timestamp + tool execution validation
├── video.mp4                    # Full desktop recording
├── screenshots/
│   ├── 00_launch.png
│   ├── 01_synthesis.png         # Must show dc_shell> prompt
│   ├── 02_innovus_start.png     # Must show innovus 1> prompt
│   └── ...
├── pane_logs/
│   ├── claude_pane.log
│   └── eda_pane.log             # Must show actual tool output
├── validation/
│   ├── timestamp_check.json     # File creation times
│   └── tool_execution.json      # Tool activity analysis
└── outputs/                     # Copied from design directory
    └── gds/
        └── ibex.gds             # Must be fresh
```

---

## Running the Test

### Full Test with Validation

```bash
# 1. Generate test ID and record start time
export TEST_ID="rtl2gds_$(date +%Y%m%d_%H%M%S)"
export TEST_START_TIME="$(date +%s)000"  # milliseconds

# 2. Setup clean environment on EDA server
ssh EDA@192.168.112.163 "
  # Kill stale processes
  pkill -9 -f 'innovus|dc_shell|claude' 2>/dev/null || true
  tmux -L hipilot kill-server 2>/dev/null || true

  # Create test directories
  mkdir -p /home/EDA/hipilot_test/runs/${TEST_ID}
  mkdir -p /tmp/hipilot-test-evidence/${TEST_ID}

  # Extract CLEAN design
  tar -xf /home/EDA/ibex_demo.tar -C /home/EDA/hipilot_test/runs/${TEST_ID}/
  mv /home/EDA/hipilot_test/runs/${TEST_ID}/ibex_demo \
     /home/EDA/hipilot_test/runs/${TEST_ID}/design/ibex

  # Verify no stale results
  if [ -d /home/EDA/hipilot_test/runs/${TEST_ID}/design/ibex/result ]; then
    echo 'ERROR: Clean design has results!'
    exit 1
  fi

  echo 'Test start timestamp: ${TEST_START_TIME}'
"

# 3. Deploy HiPilot
node src/hitestbot/infra/deploy_hipilot.js \
  --destination "/home/EDA/hipilot_test/runs/${TEST_ID}/hipilot" \
  --test-id "${TEST_ID}"

# 4. Run test with extended timeout (2 hours)
HIPILOT_SESSION="${TEST_ID}" \
HIPILOT_WORK_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}" \
HIPILOT_TEST_START_TIME="${TEST_START_TIME}" \
  bin/hitestbot-eda \
    --command "/rtl2gds" \
    --timeout 7200 \
    --validate-timestamps \
    --design-dir "/home/EDA/hipilot_test/runs/${TEST_ID}/design/ibex"

# 5. Pull evidence
bin/hitestbot-pull --test-id "${TEST_ID}"

# 6. Validate evidence
node src/hitestbot/infra/validate_evidence.js \
  --evidence-dir "test-evidence/${TEST_ID}" \
  --test-start-time "${TEST_START_TIME}"
```

---

## Test Failure Modes

### Failure: Stale Evidence Detected

**Symptoms**: Evidence files created before test start
**Cause**: Reused old test directory or design with existing results
**Fix**: Use fresh test ID, extract clean design

### Failure: No Actual Tool Execution

**Symptoms**: Right pane shows only `echo` commands, welcome message
**Cause**: Claude didn't actually start EDA tool, or tool failed silently
**Fix**: Check MCP tool availability, verify tool launch sequence

### Failure: Empty Result Files

**Symptoms**: Result files exist but size = 0 or very small
**Cause**: Tool crashed or command failed
**Fix**: Check EDA tool logs, verify license availability

### Failure: Timeout

**Symptoms**: Test hits timeout before completion
**Cause**: Flow takes longer than expected, or tool stuck
**Fix**: Increase timeout, check for license issues

---

## Success Criteria Summary

For a **VALID PASS**, ALL must be true:

| Check | Method |
|-------|--------|
| Clean design used | Extracted from `ibex_demo.tar` |
| No stale results | `result/` directory did not exist at start |
| Evidence fresh | All files created after test start time |
| Tool executed | Right pane shows `innovus 1>` or `dc_shell>` prompt |
| Activity visible | Tool progress messages in right pane |
| Results fresh | GDS/netlist created during test |
| Stages complete | All 10 stages reported complete |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial revision |
| 2.0 | 2026-02-27 | Added clean design requirement, timestamp validation, tool execution validation |

---

*Document Version: 2.0*
*Target: Launch EDA tools and complete RTL2GDS flow with VALID evidence*
