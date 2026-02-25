# HiPilot Improvement Plan 2026-02-21
## Ralph-Loop Ready Development & Test Plan

**Status:** Ready for Ralph-loop iteration
**Version:** 1.0
**Target Completion:** All P0 gaps closed, E2E verified on EDA server

---

## Ralph-Loop Structure

This plan is designed for ralph-loop execution:
- Each Phase is an iteration boundary
- Each Task has verifiable completion criteria
- Architect verification required at each Phase
- State tracked in `.omc/hipilot-progress.json`

```
Ralph Iteration Flow:
  Iteration 1 → Phase 1 (Foundation)
  Iteration 2 → Phase 2 (Core Gaps - Part 1)
  Iteration 3 → Phase 2 (Core Gaps - Part 2)
  Iteration 4 → Phase 3 (UI/UX)
  Iteration 5 → Phase 4 (Testing Infrastructure)
  Iteration 6 → Phase 5 (Advanced Features - Optional)
  Final → Architect Verification + E2E Demo
```

---

## Phase 1: Foundation (Iteration 1)
**Goal:** Fix critical blocking issues
**Success Criteria:** All tests pass, version consistent, security hardened

### Task 1.1: Version Consistency
**Priority:** P0
**Effort:** 2 hours
**Files:** `src/lib/version.js` (new), `src/index.js`, `package.json`, `servers/*/index.js`

**Current State:**
- package.json: 0.1.2
- src/index.js: 0.1.0
- README.md: 0.2.1
- servers: mixed 0.1.2/0.2.1

**Completion Criteria:**
- [ ] Single source file: `src/lib/version.js` exports VERSION constant
- [ ] All files import version from this source
- [ ] Running `hipilot version` shows consistent version
- [ ] All MCP servers report same version in initialization

**Verification:**
```bash
grep -r "0.1.0\|0.1.2\|0.2.1" src/ servers/ | grep -v node_modules
# Should show only imports from version.js, not hardcoded strings
```

### Task 1.2: Secure Temp File Paths
**Priority:** P0
**Effort:** 4 hours
**Files:** `src/lib/mode.js`, `servers/eda/index.js`, `src/lib/paths.js` (new)

**Current State:**
```javascript
export const MODE_FILE = '/tmp/hipilot_mode';
export const PENDING_FILE = '/tmp/hipilot_pending.tcl';
```

**Completion Criteria:**
- [ ] Create `src/lib/paths.js` with user-specific temp directory
- [ ] Use `os.tmpdir()` + `os.userInfo().username` + `hipilot/`
- [ ] Update all hardcoded `/tmp/hipilot_*` references
- [ ] Ensure atomic file operations where possible

**Verification:**
```javascript
// Test: paths should include username
const paths = getHipilotPaths();
assert(paths.modeFile.includes(os.userInfo().username));
assert(paths.pendingFile.includes(os.userInfo().username));
```

### Task 1.3: Error Handling & Logging
**Priority:** P0
**Effort:** 6 hours
**Files:** `src/lib/logger.js` (new), all server files

**Current State:** Empty catch blocks, silent failures

**Completion Criteria:**
- [ ] Create `src/lib/logger.js` with levels: error, warn, info, debug
- [ ] Replace all empty catch blocks with appropriate logging
- [ ] Add structured error context (file, line, operation)
- [ ] Log to `~/.hipilot/logs/hipilot-YYYY-MM-DD.log`

**Verification:**
```bash
# After running hipilot commands
cat ~/.hipilot/logs/hipilot-$(date +%Y-%m-%d).log
# Should show info messages, not empty
```

### Phase 1 Verification (Architect Required)
- [ ] `npm test` passes (new unit tests for logger, paths)
- [ ] No hardcoded versions found in source
- [ ] No hardcoded `/tmp/hipilot_*` paths
- [ ] All catch blocks have logging
- [ ] Code review: Security, error handling patterns

---

## Phase 2: Core Functionality Gaps (Iterations 2-3)
**Goal:** Implement missing P0 PRD requirements
**Success Criteria:** All major breakthroughs work end-to-end

### Task 2.1: Quick Commands System
**Priority:** P0
**Effort:** 1 day
**Files:** `.claude/commands/*.md`, `src/lib/quick-commands.js` (new)

**PRD Requirement:** FR-4 Quick Commands

**Commands to Implement:**
- `/timing [group]` - Generate timing report Tcl
- `/drc` - Generate DRC check Tcl
- `/power` - Generate power report Tcl
- `/area` - Generate area report Tcl
- `/compare` - Compare with baseline (placeholder)

**Completion Criteria:**
- [ ] Create `.claude/commands/timing.md`
- [ ] Create `.claude/commands/drc.md`
- [ ] Create `.claude/commands/power.md`
- [ ] Create `.claude/commands/area.md`
- [ ] Each command calls `eda.quick()` with appropriate operation
- [ ] Commands show in Claude Code command palette

**Verification (E2E):**
```bash
# In Claude Code with HiPilot
type "/timing" → should generate timing Tcl
# Check EDA pane: timing report should appear
```

### Task 2.2: AI Report Comprehension Pipeline
**Priority:** P0
**Effort:** 2 days
**Files:** `servers/eda/index.js` (new tool), `src/lib/report-analyzer.js` (new)

**PRD Requirement:** FR-3 Report Comprehension (THE MAJOR BREAKTHROUGH)

**Completion Criteria:**
- [ ] New tool: `eda.capture_and_analyze()`
- [ ] Captures EDA pane output via `tmux.capture_pane`
- [ ] Sends output to Claude with analysis prompt
- [ ] Returns: identified issues, metrics, suggested fixes
- [ ] Works for timing reports, DRC reports, QoR summaries

**Verification (E2E - Critical):**
```bash
# Full feedback loop test:
1. Generate timing Tcl → Send to EDA
2. Wait for execution
3. "capture_and_analyze" the output
4. Claude should identify WNS/TNS/violations
5. Claude should suggest fixes
```

### Task 2.3: Edit Action
**Priority:** P0
**Effort:** 4 hours
**Files:** `servers/eda/index.js`, `src/lib/editor.js` (new)

**PRD Requirement:** FR-2.2 Edit Action

**Completion Criteria:**
- [ ] New tool: `eda.edit_tcl()`
- [ ] Opens Tcl in `$EDITOR` (vi/vim/nano fallback)
- [ ] Waits for user to save and exit
- [ ] Reads edited content back
- [ ] Integrates into approval flow: "edit before execute"

**Verification:**
```bash
# In approval prompt:
# "Say 'yes' to execute, 'edit' to modify, 'no' to cancel"
type "edit" → $EDITOR opens → modify → save → updated Tcl shown
```

### Task 2.4: Save to Project Scripts
**Priority:** P1
**Effort:** 3 hours
**Files:** `servers/eda/index.js`

**PRD Requirement:** FR-2.3 Save Action

**Completion Criteria:**
- [ ] New tool: `eda.save_tcl()`
- [ ] Saves to `./scripts/` or configured path
- [ ] Generates meaningful filename with timestamp
- [ ] Returns saved path

**Verification:**
```bash
ls ./scripts/hipilot_*.tcl
# Should exist after save action
```

### Phase 2 Verification (Architect Required)
- [ ] All 5 quick commands work in E2E test
- [ ] Report comprehension loop works (critical breakthrough)
- [ ] Edit action opens editor and preserves changes
- [ ] Save action creates files in correct location
- [ ] E2E test on EDA server: `/timing` → approval → execution → capture → analysis

---

## Phase 3: UI/UX Improvements (Iteration 4)
**Goal:** Make it beautiful and intuitive
**Success Criteria:** Visual polish matches PRD vision

### Task 3.1: Enhanced Status Bar
**Priority:** P0
**Effort:** 6 hours
**Files:** `src/lib/ui.js`, `servers/tmux/index.js`

**Completion Criteria:**
- [ ] Design new status format with visual sections
- [ ] Mode-specific colors (manual=yellow, auto=green)
- [ ] Live QoR metrics (WNS, TNS, violation counts)
- [ ] Dynamic updates without manual refresh

**Visual Target:**
```
┌─ HiPilot v0.2.1 ─────────────────────────────────────────────┐
│ 🔒 MANUAL  │  ⚡ Innovus 20.10  │  📊 WNS: -0.23ns  │  ⏳ 1 pending │
└──────────────────────────────────────────────────────────────┘
```

### Task 3.2: Syntax Highlighted Tcl Display
**Priority:** P0
**Effort:** 1 day
**Files:** `src/lib/ui.js`, `src/lib/tcl-highlighter.js` (new)

**Completion Criteria:**
- [ ] Regex-based Tcl syntax highlighter
- [ ] Comments: dim gray
- [ ] Keywords: cyan (report_timing, set_app_options, etc.)
- [ ] Flags: yellow (-max_paths, -delay_type)
- [ ] Strings: green
- [ ] Variables: magenta

**Verification:**
```bash
hipilot generate tcl "timing report"
# Output should show color-coded Tcl
```

### Task 3.3: Activity Feed
**Priority:** P1
**Effort:** 2 days
**Files:** `src/lib/activity.js` (new), `src/lib/ui.js`

**Completion Criteria:**
- [ ] Activity log data structure with timestamps
- [ ] Visual feed showing recent operations
- [ ] Status indicators: [✓] success, [⏳] pending, [✗] failed
- [ ] Persist across operations

### Task 3.4: Risk-Level Visual Polish
**Priority:** P0
**Effort:** 4 hours
**Files:** `src/lib/ui.js`, `servers/eda/index.js`

**Completion Criteria:**
- [ ] Color-coded risk panels (🟢🟡🟠🔴)
- [ ] Clear action buttons in approval prompts
- [ ] Confirmation text requirements displayed prominently
- [ ] Warning icons for dangerous operations

### Phase 3 Verification (Architect Required)
- [ ] Status bar shows live mode/tool/metrics
- [ ] Tcl output has syntax highlighting
- [ ] Activity feed shows operation history
- [ ] Risk panels are visually distinct
- [ ] UI consistency across all commands

---

## Phase 4: Testing Infrastructure (Iteration 5)
**Goal:** Reliable, repeatable verification
**Success Criteria:** Automated tests run on EDA server

### Task 4.1: Unit Tests
**Priority:** P0
**Effort:** 3 days
**Files:** `test/` directory

**Test Coverage Required:**
- [ ] `test/mode.test.js` - get/set/toggle, pending queue, file operations
- [ ] `test/risk-analyzer.test.js` - categorization, patterns, confirmation
- [ ] `test/paths.test.js` - temp path generation, security
- [ ] `test/ui.test.js` - component rendering, colors
- [ ] `test/tcl-highlighter.test.js` - syntax detection

**Completion Criteria:**
- [ ] All tests pass: `npm test`
- [ ] >80% code coverage for core libraries
- [ ] Mock fs for file operation tests

### Task 4.2: Integration Test Suite
**Priority:** P0
**Effort:** 3 days
**Files:** `test/eda-integration.sh`, `test/helpers/`

**Test Infrastructure:**
- [ ] `test/helpers/tmux.js` - Send keys, capture, parse
- [ ] `test/helpers/innovus.js` - Mock responses for local testing
- [ ] `test/eda-integration.sh` - Full E2E test runner

**Integration Tests:**
- [ ] MCP server registration (30+ tools)
- [ ] Tcl generation (template + inline)
- [ ] Mode system (manual/auto toggle)
- [ ] Send to EDA (tmux bridge)
- [ ] Capture and analyze (feedback loop)
- [ ] Risk analysis blocking

### Task 4.3: E2E Test Script
**Priority:** P0
**Effort:** 1 day
**Files:** `test/e2e-breakthroughs.sh`

**Tests the 7 Major Breakthroughs:**
1. MCP Server Registration & Tool Discovery
2. Tcl Generation & Template Rendering
3. Mode System (Manual Approval)
4. Risk Analysis & Dangerous Operation Blocking
5. **AI + EDA Feedback Loop** (THE CRITICAL ONE)
6. Skill System Execution
7. Knowledge System Integration

**Completion Criteria:**
- [ ] Script runs on EDA server without errors
- [ ] Each breakthrough has pass/fail criteria
- [ ] Generates test report with evidence

### Phase 4 Verification (Architect Required)
- [ ] `npm test` passes with >80% coverage
- [ ] Integration tests pass against real Innovus
- [ ] E2E script runs successfully on EDA server
- [ ] All 7 breakthroughs verified
- [ ] Test artifacts captured (screenshots/logs)

---

## Phase 5: Advanced Features (Iteration 6 - Optional)
**Goal:** Knowledge capture and skill generation
**Success Criteria:** Auto-generation works

### Task 5.1: Document Indexing
**Priority:** P1
**Effort:** 3 days
**Files:** `src/lib/doc-indexer.js`

**Completion Criteria:**
- [ ] SQLite + FTS5 index
- [ ] PDF text extraction
- [ ] HTML parsing
- [ ] Search interface in Knowledge MCP

### Task 5.2: Skill Auto-Generation
**Priority:** P1
**Effort:** 4 days
**Files:** `src/lib/skill-generator.js`

**Completion Criteria:**
- [ ] Parse text (email/wiki) for workflow patterns
- [ ] Extract parameters and examples
- [ ] Generate YAML frontmatter
- [ ] Preview before saving

### Task 5.3: QoR Checkpoints
**Priority:** P1
**Effort:** 2 days
**Files:** `src/lib/checkpoint.js`

**Completion Criteria:**
- [ ] Save QoR metrics to JSON
- [ ] Compare checkpoints with delta
- [ ] `/compare` quick command

---

## Test Plan Summary

### Unit Tests (Local)
```bash
npm test
# Tests: mode, risk-analyzer, paths, ui, tcl-highlighter
# Coverage: >80%
```

### Integration Tests (EDA Server)
```bash
ssh EDA@192.168.112.163
cd /home/EDA/hipilot_test/hipilot
./test/eda-integration.sh
# Tests: MCP, Tcl gen, mode, tmux bridge, feedback loop
```

### E2E Breakthrough Tests (EDA Server)
```bash
./test/e2e-breakthroughs.sh
# Tests: All 7 major breakthroughs
# Output: /tmp/hipilot-e2e-report.txt
```

### Manual Verification Checklist
- [ ] `/timing` command generates valid Innovus Tcl
- [ ] Manual mode queues for approval
- [ ] Auto mode executes immediately
- [ ] Dangerous operations require confirmation
- [ ] AI can capture and analyze EDA output
- [ ] Status bar shows live information
- [ ] Tcl has syntax highlighting

---

## Ralph-Loop State Tracking

Create `.omc/hipilot-progress.json`:
```json
{
  "planVersion": "2026-02-21",
  "currentPhase": 1,
  "currentIteration": 1,
  "completedTasks": [],
  "inProgressTask": null,
  "verificationStatus": {
    "phase1": { "passed": false, "architectApproved": false },
    "phase2": { "passed": false, "architectApproved": false },
    "phase3": { "passed": false, "architectApproved": false },
    "phase4": { "passed": false, "architectApproved": false },
    "phase5": { "passed": false, "architectApproved": false }
  },
  "e2eResults": {
    "breakthrough1": { "tested": false, "passed": false },
    "breakthrough2": { "tested": false, "passed": false },
    "breakthrough3": { "tested": false, "passed": false },
    "breakthrough4": { "tested": false, "passed": false },
    "breakthrough5": { "tested": false, "passed": false },
    "breakthrough6": { "tested": false, "passed": false },
    "breakthrough7": { "tested": false, "passed": false }
  }
}
```

---

## Completion Criteria (Final)

Before declaring complete:

- [ ] All P0 tasks from Phases 1-4 completed
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass on EDA server
- [ ] All 7 breakthroughs verified in E2E test
- [ ] Architect verification passed (STANDARD tier)
- [ ] Screen recording of full workflow completed
- [ ] `/oh-my-claudecode:cancel` run for cleanup

---

## Ready for Ralph-Loop

This plan is structured for iteration:
1. **Phase boundaries** = Ralph iteration boundaries
2. **Each task** has clear completion criteria
3. **Verification** required at each phase
4. **State tracking** via `.omc/hipilot-progress.json`
5. **E2E tests** validate the major breakthroughs

Start with **Phase 1, Task 1.1** (Version Consistency).
