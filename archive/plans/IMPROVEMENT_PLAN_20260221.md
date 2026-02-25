# HiPilot Improvement Plan

**Date:** 2026-02-21
**Author:** User-Driven Analysis
**Goal:** Make HiPilot feel like a senior colleague, not a tool

---

## Executive Summary

**Current State:** ~85% complete (GAP_ANALYSIS.md incorrectly states ~65%)

**User Pain Points (from real-world perspective):**
1. "Too many steps" - Quick commands exist but aren't wired to Claude Code
2. "I don't trust it" - Reasoning is hidden, badges don't prove anything
3. "Will this break things?" - No proactive side-effect analysis
4. "What worked last time?" - Skills exist but discovery is poor

**This Plan:** Focus on **friction reduction** and **trust building**, not new features.

---

## Phase 1: Frictionless Workflow (1-2 Days)

### Goal: One command, done. No manual steps.

### 1.1 Wire Quick Commands to Claude Code ⚡ PRIORITY

**Problem:** `src/lib/quick-commands.js` exists, `eda.quick` MCP tool exists, but typing `/timing` in Claude Code does nothing.

**Solution:** Create `.claude/commands/` directory with slash command definitions.

**Files to Create:**
```
.claude/commands/
├── timing.md    # /timing [path_group] - Run timing report and analyze
├── drc.md       # /drc - Run DRC check and summarize
├── power.md     # /power - Power analysis
├── area.md      # /area - Area/utilization report
├── compare.md   # /compare [baseline] - Compare QoR
└── history.md   # /history - Show Tcl commands this session
```

**Command Template:**
```markdown
# /timing

Run timing analysis and provide actionable insights.

## Usage
/timing [path_group]

## Examples
- `/timing` - Analyze all path groups
- `/timing reg2reg` - Focus on register-to-register paths
- `/timing in2out` - Focus on input-to-output paths

## What It Does
1. Detects running EDA tool (ICC2/Innovus/PrimeTime)
2. Generates appropriate `report_timing` Tcl from templates
3. Executes in EDA terminal pane
4. Captures output and extracts key metrics (WNS, TNS, violations)
5. Analyzes results and highlights critical issues

## MCP Tool
Calls `eda.quick` with `operation: "timing"`

## Parameters
- `path_group` (optional): Specific path group to analyze
```

**Effort:** 2-4 hours
**Impact:** 🟢 Critical - This unlocks the entire quick command system

---

### 1.2 Auto-Submit Report Analysis to Claude

**Problem:** `eda.analyze_report()` generates an LLM prompt but expects the user to manually ask Claude to analyze it.

**Current Workflow:**
```
User: eda.analyze_report()
HiPilot: "Here's the prompt, ask Claude to analyze it"
User: (copy-paste) "Please analyze this report: [prompt]"
```

**Desired Workflow:**
```
User: /timing
HiPilot: [Automatically analyzes and shows insights]
```

**Solution:** Modify slash commands to return analysis directly to Claude's context, not just the prompt.

**Implementation:**
1. Update `.claude/commands/*.md` to include analysis instructions
2. The command should capture report → return to Claude → Claude analyzes automatically

**Effort:** 2-3 hours
**Impact:** 🟢 Critical - Removes the manual "analyze this" step

---

### 1.3 One-Command Timing Fix Flow

**Problem:** User says "fix setup timing" and gets a workflow, not a solution.

**Current:**
```
User: "fix setup timing"
HiPilot: "Run /timing first, then I'll help you fix it"
User: /timing
HiPilot: "Now run /fix-setup"
... (too many steps)
```

**Desired:**
```
User: "fix setup timing on PCIe"
HiPilot: 
  1. [Auto-runs timing report]
  2. [Analyzes violations]
  3. "Found 47 violations. Root cause: undersized clock buffer clk_buf_2.
     Here's the Tcl to fix the top 20 paths. Run? [y/n]"
```

**Solution:** Create composite skill that chains timing analysis → diagnosis → fix generation.

**Files:**
- `skills/fix-setup-timing-one-shot.md` - New skill with embedded timing report

**Effort:** 4-6 hours
**Impact:** 🟢 High - This is the "senior colleague" experience

---

## Phase 2: Trust Through Transparency (2-3 Days)

### Goal: Show reasoning, not badges. Prove the output is correct.

### 2.1 Replace Trust Badges with Evidence

**Problem:** Current output shows `[✓ Template]` which is meaningless to users.

**Current:**
```
[✓ Template] fix_setup_timing.tcl.j2
# Generated Tcl
size_cell u_clk/buf_2 BUF_X8
```

**Desired:**
```
## Analysis
- Found 47 setup violations (WNS: -0.52ns)
- 34 share the same root cause: undersized clock buffer clk_buf_2
- Library shows BUF_X8 has 2x drive strength of current BUF_X4
- Expected improvement: ~0.3ns slack recovery per path

## Source
- Template: fix_setup_timing.tcl.j2
- Based on: Synopsys CTS Methodology Guide, Section 4.3
- Similar fix worked on: DDR4 controller (2026-01-15)

## Generated Tcl
size_cell u_clk/buf_2 BUF_X8  # Upsize clock buffer
size_cell u_clk/buf_3 BUF_X8  # Cascade fix for downstream
```

**Implementation:**
1. Enhance `eda.generate_tcl` return format
2. Add `evidence` field with analysis breakdown
3. Add `similar_fixes` field from skill history
4. Update output formatting in EDA MCP server

**Files:**
- `servers/eda/index.js` - Enhance `generateTcl()` return
- `src/lib/evidence-formatter.js` - New file for formatting

**Effort:** 1 day
**Impact:** 🟢 High - Trust = adoption

---

### 2.2 Proactive Side-Effect Analysis

**Problem:** User fixes setup timing, unknowingly causes hold violations.

**Desired Behavior:**
```
HiPilot: "I've generated the setup fix Tcl. Before you run it:
         
⚠️  Warning: Upsizing these 8 cells may cause:
   - 3 hold violations on receiving flip-flops (CLK_DOMAIN_2)
   - 0.02ns increase in clock tree latency
   
Recommend: After running, execute /timing --hold to verify.
Ready to proceed? [y/n]"
```

**Implementation:**
1. Add `analyzeSideEffects()` function to risk analyzer
2. Check for common side effects:
   - Setup fix → hold violations
   - Buffer insertion → clock skew changes
   - Cell resizing → DRC antenna violations
3. Show warnings before execution in manual mode

**Files:**
- `src/lib/risk-analyzer.js` - Add `analyzeSideEffects()`
- `servers/eda/index.js` - Call before `sendToTerminal()`

**Effort:** 1-2 days
**Impact:** 🟢 High - Prevents "HiPilot broke my design" incidents

---

### 2.3 Explain Mode for Every Tcl Command

**Problem:** Generated Tcl is opaque. Junior engineers don't learn.

**Desired:**
```
## Generated Tcl (with explanations)

report_timing -max_paths 50 -slack_lesser_than 0 \
  -input_pins -nets -transition_time -capacitance
# ↑ Reports up to 50 violating paths with full pin/net details
# ↑ -input_pins shows driver pins for sizing decisions
# ↑ -nets helps identify long nets needing buffering
# ↑ -transition_time and -capacitance identify drive strength issues
```

**Implementation:**
1. Add `--explain` flag to Tcl generation
2. Template comments with educational content
3. Skill files include `explanations` section

**Files:**
- `templates/*.tcl.j2` - Add comment blocks
- `servers/eda/index.js` - Add `explain: true` option

**Effort:** 1 day
**Impact:** 🟡 Medium - Helps junior engineers, optional for seniors

---

## Phase 3: Knowledge Capture & Discovery (2-3 Days)

### Goal: Remember what worked. Surface relevant patterns.

### 3.1 Skill Usage Tracking

**Problem:** Skills exist but we don't know which ones work.

**Desired:**
```
User: "fix hold timing"
HiPilot: "I found 2 relevant skills:
         
1. fix-hold-timing.md
   Last used: 2026-02-18 on PCIe design
   Success rate: 100% (3/3 uses)
   Average improvement: +0.15ns hold slack
   
2. fix-hold-timing-conservative.md
   Never used on this design
   From: Team methodology guide
   
Recommend: Option 1 (proven on similar designs)"
```

**Implementation:**
1. Track skill invocations in `.hipilot/skill-history.json`
2. Record: timestamp, design context, QoR before/after
3. Surface success rates in skill matching

**Files:**
- `src/lib/skill-tracker.js` - New file
- `servers/knowledge/index.js` - Enhance `match_skill`

**Effort:** 1-2 days
**Impact:** 🟡 Medium - Builds knowledge base over time

---

### 3.2 Similar Design Pattern Matching

**Problem:** I solved this problem 3 weeks ago, but I forgot how.

**Desired:**
```
User: "fix CTS skew on DDR domain"
HiPilot: "I found a similar fix from 2026-01-28:

On the DDR4 controller, you:
1. Identified clock tree imbalance in CLK_DDR domain
2. Added clock buffers to balance latency
3. Result: Skew reduced from 120ps to 45ps

The current DDR5 design has similar topology.
Want me to apply the same pattern?"
```

**Implementation:**
1. Index past Tcl commands with design context
2. Semantic matching on problem description
3. Offer to reuse proven solutions

**Files:**
- `src/lib/pattern-matcher.js` - New file
- `data/fix-history.json` - Store past fixes

**Effort:** 2-3 days
**Impact:** 🟡 Medium - Knowledge capture value

---

### 3.3 Team Skill Sharing

**Problem:** Senior engineer creates a skill, team doesn't know it exists.

**Desired:**
```
User: "how do I fix antenna violations"
HiPilot: "Your teammate Sarah created a skill for this:

antenna-fix.md (added 2026-02-10)
'Fixes antenna violations by inserting diodes 
near high-ratio metal gates. Uses sky130 diode cells.'

Use it? [y/n]"
```

**Implementation:**
1. Add `skill.list_team_skills` MCP tool
2. Show team skills prominently in `/help`
3. Notify when new skills are added

**Files:**
- `servers/knowledge/index.js` - Add tool
- `src/index.js` - Show in CLI

**Effort:** 1 day
**Impact:** 🟡 Medium - Team collaboration

---

## Phase 4: Documentation & Cleanup (1 Day)

### Goal: Accurate docs, easy onboarding.

### 4.1 Fix GAP_ANALYSIS.md

**Problem:** Document says 65% complete, reality is 85%.

**Updates Required:**
- Quick Commands: 🔴 Missing → 🟢 95% (only UI bridge needed)
- AI Report Comprehension: 🔴 Partial → 🟢 Complete
- Edit Before Run: 🔴 Missing → 🟢 Complete
- Save Tcl: 🔴 Missing → 🟢 Complete
- `/skill-gen`: 🔴 Missing → 🟢 Complete

**Effort:** 30 minutes
**Impact:** 🟢 High - Accurate planning

---

### 4.2 Update Misleading Comments

**Problem:** `report-analyzer.js` line 333 says "Actual LLM call happens in the MCP server" but MCP servers don't call LLMs.

**Fix:**
```javascript
// OLD: Note: Actual LLM call happens in the MCP server; this prepares the prompt
// NEW: Returns prompt for Claude to analyze. Claude Code (not MCP) handles LLM calls.
```

**Files:**
- `src/lib/report-analyzer.js` - Line 333
- Any similar misleading comments

**Effort:** 15 minutes
**Impact:** 🟢 High - Prevents confusion

---

### 4.3 User Onboarding Flow

**Problem:** New user doesn't know where to start.

**Desired:**
```
$ hipilot

╔════════════════════════════════════════════════════════╗
║         HiPilot - VLSI Physical Design Copilot         ║
║                    v0.4.0                              ║
╚════════════════════════════════════════════════════════╝

✓ Dependencies installed
✓ MCP servers registered: eda, tmux, knowledge
✓ 18 skills loaded
✓ 24 templates available

🚀 Quick Start:
   1. hipilot workspace     Launch 50/50 terminal split
   2. Start your EDA tool (innovus, icc2_shell, etc.)
   3. Try: "fix setup timing" or /timing

📚 Commands:
   /timing [group]    Run timing analysis
   /drc               Check design rules
   /power             Power analysis
   /history           Show commands this session

💡 Tip: Say "help me with [task]" and I'll find the right skill.
```

**Implementation:**
1. Enhance `cmdStatus()` in `src/index.js`
2. Add quick start examples
3. Show relevant commands based on context

**Effort:** 2-3 hours
**Impact:** 🟡 Medium - First impression matters

---

## HiTestBot Integration

Every improvement MUST have a HiTestBot test with video evidence.

### HiTestBot Test Suite

```
src/hitestbot/tests/
├── QuickCommandsTest.js      # Phase 1.1: /timing, /drc work in Claude Code
├── AutoAnalysisTest.js       # Phase 1.2: Reports auto-analyzed by Claude
├── OneShotFixTest.js         # Phase 1.3: "fix setup timing" in one command
├── EvidenceOutputTest.js     # Phase 2.1: Output shows reasoning + sources
├── SideEffectTest.js         # Phase 2.2: Warnings before execution
├── SkillTrackingTest.js      # Phase 3.1: Skill usage is tracked
└── PatternMatchingTest.js    # Phase 3.2: Similar fixes are suggested
```

### Test Evidence Requirements

Each test produces:
- 📹 Video recording (MP4, 20fps, full desktop)
- 📸 Screenshots (before/after key actions)
- 📝 Pane captures (Claude + EDA terminal output)
- 📋 Test report (HITESTBOT_REPORT.md)

### Running Tests

```bash
# Run all HiTestBot tests (on EDA server)
npm run hitestbot

# Run specific test
node src/hitestbot/tests/QuickCommandsTest.js

# Run with custom config
node src/hitestbot/tests/QuickCommandsTest.js --server 192.168.112.163
```

---

## Implementation Priority Matrix

| Phase | Task | Effort | HiTestBot Test | Impact | Priority |
|-------|------|--------|----------------|--------|----------|
| 1.1 | Wire quick commands | 2-4h | `QuickCommandsTest.js` | 🟢 Critical | **P0** |
| 1.2 | Auto-submit analysis | 2-3h | `AutoAnalysisTest.js` | 🟢 Critical | **P0** |
| 4.1 | Fix GAP_ANALYSIS | 30m | N/A (docs) | 🟢 High | **P0** |
| 4.2 | Fix misleading comments | 15m | N/A (docs) | 🟢 High | **P0** |
| 2.1 | Evidence-based output | 1d | `EvidenceOutputTest.js` | 🟢 High | P1 |
| 2.2 | Side-effect analysis | 1-2d | `SideEffectTest.js` | 🟢 High | P1 |
| 1.3 | One-command fix flow | 4-6h | `OneShotFixTest.js` | 🟢 High | P1 |
| 4.3 | Onboarding flow | 2-3h | `OnboardingTest.js` | 🟡 Medium | P1 |
| 2.3 | Explain mode | 1d | `ExplainModeTest.js` | 🟡 Medium | P2 |
| 3.1 | Skill tracking | 1-2d | `SkillTrackingTest.js` | 🟡 Medium | P2 |
| 3.2 | Pattern matching | 2-3d | `PatternMatchingTest.js` | 🟡 Medium | P2 |
| 3.3 | Team skill sharing | 1d | `TeamSharingTest.js` | 🟡 Medium | P3 |

---

## Success Metrics

| Metric | Current | Target (Phase 1) | Target (All Phases) |
|--------|---------|------------------|---------------------|
| Commands to fix timing | 5+ | 1-2 | 1 |
| User trusts first suggestion | ~50% | ~70% | ~90% |
| Setup to first useful command | 30+ min | 5 min | 2 min |
| Skills successfully used | 0 tracked | Tracked | Recommended |
| Adoption (daily active users) | 0 | 1 | Team |

---

## HiTestBot Test Specifications

### Test 1: QuickCommandsTest.js

**Purpose:** Verify `/timing`, `/drc`, `/power`, `/area` work in Claude Code

**Test Flow:**
```javascript
class QuickCommandsTest extends TestRunner {
  async execute() {
    await this.step('Setup Workspace', () => this.setupWorkspace());
    await this.step('Test /timing', () => this.testTiming());
    await this.step('Test /drc', () => this.testDrc());
    await this.step('Test /history', () => this.testHistory());
    await this.step('Verify Evidence', () => this.verifyEvidence());
  }

  async testTiming() {
    // Send /timing command to Claude Code
    await this.tmux.sendKeys('hipilot:0.0', '/timing', false);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    
    // Wait for Claude to process
    await this.sleep(45000);
    
    // Capture output
    const output = await this.tmux.capturePane('hipilot:0.0');
    
    // Assertions
    TestUtils.assertContains(output, 'timing', 'No timing output found');
    TestUtils.assertContains(output, 'WNS|TNS|slack', 'No metrics extracted');
    
    // Verify Tcl was sent to EDA pane
    const edaOutput = await this.tmux.capturePane('hipilot:0.1');
    TestUtils.assertContains(edaOutput, 'report_timing', 'Tcl not sent to EDA');
  }
}
```

**Success Criteria:**
- [ ] `/timing` generates timing report Tcl
- [ ] Tcl is sent to EDA pane (Innovus/ICC2)
- [ ] Claude receives and displays timing metrics
- [ ] Video shows complete workflow

---

### Test 2: AutoAnalysisTest.js

**Purpose:** Verify reports are auto-analyzed without manual "analyze this" step

**Test Flow:**
```javascript
class AutoAnalysisTest extends TestRunner {
  async execute() {
    await this.step('Setup Workspace', () => this.setupWorkspace());
    await this.step('Run Timing Report', () => this.runTimingReport());
    await this.step('Verify Auto-Analysis', () => this.verifyAutoAnalysis());
  }

  async verifyAutoAnalysis() {
    const output = await this.tmux.capturePane('hipilot:0.0');
    
    // Should see analysis WITHOUT user asking "analyze this"
    TestUtils.assertContains(output, 'violations', 'No violation analysis');
    TestUtils.assertContains(output, 'Root cause|root cause', 'No root cause identified');
    TestUtils.assertContains(output, 'Recommend|Suggest', 'No recommendations');
    
    // Should NOT see manual prompt instruction
    TestUtils.assert(!output.includes('ask Claude to analyze'), 
      'Still shows manual prompt instruction');
  }
}
```

**Success Criteria:**
- [ ] Analysis appears automatically after report
- [ ] No "ask Claude to analyze" prompt shown
- [ ] Root causes are identified
- [ ] Recommendations are provided

---

### Test 3: EvidenceOutputTest.js

**Purpose:** Verify output shows reasoning + sources, not just badges

**Test Flow:**
```javascript
class EvidenceOutputTest extends TestRunner {
  async execute() {
    await this.step('Setup Workspace', () => this.setupWorkspace());
    await this.step('Generate Tcl', () => this.generateTcl('fix setup timing'));
    await this.step('Verify Evidence Format', () => this.verifyEvidenceFormat());
  }

  async verifyEvidenceFormat() {
    const output = await this.tmux.capturePane('hipilot:0.0');
    
    // Should show reasoning, not just badge
    TestUtils.assertContains(output, 'Found|Identified|Analysis', 
      'No analysis section');
    TestUtils.assertContains(output, 'violations|WNS|root cause', 
      'No evidence of analysis');
    
    // Should show source attribution
    TestUtils.assertContains(output, 'Template:|Based on:|Source:', 
      'No source attribution');
    
    // Should show expected impact
    TestUtils.assertContains(output, 'improvement|slack|recovery', 
      'No expected impact shown');
  }
}
```

**Success Criteria:**
- [ ] Output has "Analysis" section with findings
- [ ] Source is attributed (template name, doc reference)
- [ ] Expected impact is quantified
- [ ] No bare `[✓ Template]` badges

---

### Test 4: SideEffectTest.js

**Purpose:** Verify warnings appear before dangerous operations

**Test Flow:**
```javascript
class SideEffectTest extends TestRunner {
  async execute() {
    await this.step('Setup Workspace', () => this.setupWorkspace());
    await this.step('Generate Setup Fix', () => this.generateSetupFix());
    await this.step('Verify Warning', () => this.verifyWarning());
    await this.step('Verify Approval Flow', () => this.verifyApprovalFlow());
  }

  async verifyWarning() {
    const output = await this.tmux.capturePane('hipilot:0.0');
    
    // Should show side effect warning
    TestUtils.assertContains(output, 'Warning|⚠|may cause', 
      'No side effect warning');
    TestUtils.assertContains(output, 'hold|Hold', 
      'No hold violation warning');
    
    // Should ask for confirmation
    TestUtils.assertContains(output, 'proceed|confirm|\\[y/n\\]', 
      'No confirmation prompt');
  }

  async verifyApprovalFlow() {
    // In manual mode, should NOT have executed yet
    const edaOutput = await this.tmux.capturePane('hipilot:0.1');
    TestUtils.assert(!edaOutput.includes('size_cell'), 
      'Tcl executed without approval');
  }
}
```

**Success Criteria:**
- [ ] Setup fix shows hold violation warning
- [ ] User must approve before execution
- [ ] Tcl is NOT sent until approved
- [ ] Warning includes specific impact details

---

### Test 5: OneShotFixTest.js

**Purpose:** Verify "fix setup timing" works in one command

**Test Flow:**
```javascript
class OneShotFixTest extends TestRunner {
  async execute() {
    await this.step('Setup Workspace', () => this.setupWorkspace());
    await this.step('One Command Fix', () => this.oneCommandFix());
    await this.step('Verify Complete Flow', () => this.verifyCompleteFlow());
  }

  async oneCommandFix() {
    // Single command should trigger full flow
    await this.tmux.sendKeys('hipilot:0.0', 
      'fix setup timing on the PCIe domain', false);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    
    // Wait for complete flow (may take a while)
    await this.sleep(120000);
  }

  async verifyCompleteFlow() {
    const output = await this.tmux.capturePane('hipilot:0.0');
    const edaOutput = await this.tmux.capturePane('hipilot:0.1');
    
    // Should have run timing report
    TestUtils.assertContains(edaOutput, 'report_timing', 
      'Timing report not run');
    
    // Should have identified violations
    TestUtils.assertContains(output, 'violations|WNS', 
      'Violations not identified');
    
    // Should have generated fix Tcl
    TestUtils.assertContains(output, 'size_cell|insert_buffer', 
      'No fix Tcl generated');
    
    // Should show approval prompt (if manual mode)
    // OR show results (if auto mode)
    const hasApproval = output.includes('[y/n]') || output.includes('proceed');
    const hasResults = output.includes('executed') || output.includes('complete');
    TestUtils.assert(hasApproval || hasResults, 
      'Neither approval prompt nor results shown');
  }
}
```

**Success Criteria:**
- [ ] One user command triggers complete flow
- [ ] Timing report auto-generated and analyzed
- [ ] Fix Tcl auto-generated
- [ ] Results shown (or approval requested)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Slash commands don't work with Claude Code | HiTestBot `QuickCommandsTest` verifies immediately. Fallback: direct MCP calls |
| Side-effect analysis gives false positives | HiTestBot `SideEffectTest` validates warnings. Start conservative |
| Users ignore skill recommendations | HiTestBot `PatternMatchingTest` A/B tests placement |
| Team doesn't share skills | HiTestBot `TeamSharingTest` validates discovery flow |
| Regression in existing features | Run full HiTestBot suite before any merge |

---

## Conclusion

**The gap isn't features - it's friction.**

HiPilot has 85% of the infrastructure needed. What's missing:
1. **The UI bridge** - Slash commands that make existing tools accessible
2. **The trust layer** - Evidence and reasoning, not badges
3. **The proactive layer** - Warnings about side effects
4. **The knowledge layer** - Remembering what worked

**Phase 1 alone (1-2 days) will transform HiPilot from "promising but frustrating" to "genuinely useful."**

---

## 🛠️ Implementation Schedule (HiTestBot-Driven)

```
Day 1 Morning:  
  [1.1] Create .claude/commands/*.md files (2h)
  [1.1] Create QuickCommandsTest.js (1h)
  [1.1] Run test → verify → iterate (1h)

Day 1 Afternoon:
  [4.1] Fix GAP_ANALYSIS.md (30m)
  [4.2] Fix misleading comments (15m)
  [1.2] Create AutoAnalysisTest.js (1h)
  [1.2] Implement auto-submit (1h)
  [1.2] Run test → verify (30m)

Day 2 Morning:
  [2.1] Create EvidenceOutputTest.js (1h)
  [2.1] Implement evidence format (3h)
  [2.1] Run test → verify (1h)

Day 2 Afternoon:
  [2.2] Create SideEffectTest.js (1h)
  [2.2] Implement side-effect analysis (3h)
  [2.2] Run test → verify (1h)

Day 3:
  [1.3] Create OneShotFixTest.js (1h)
  [1.3] Implement one-command flow (3h)
  [1.3] Run test → verify (1h)
  [4.3] Create OnboardingTest.js + implement (2h)
```

**By end of Day 2:** HiPilot feels like a senior colleague, not a tool.
**By end of Day 3:** All P0-P1 improvements have HiTestBot tests with video evidence.

---

## HiTestBot-Driven Development Workflow

### For Each Improvement:

```
1. IMPLEMENT
   ↓ Write the code
   
2. CREATE TEST
   ↓ Write HiTestBot test in src/hitestbot/tests/
   
3. RUN TEST
   ↓ npm run hitestbot or node src/hitestbot/tests/XxxTest.js
   
4. VERIFY EVIDENCE
   ↓ Check e2e_evidence/ for video + screenshots + logs
   
5. ITERATE
   ↓ Fix issues, re-run until test passes
   
6. COMMIT
   ✓ Code + Test committed together
```

### Test-First Approach (Recommended):

For critical features, write the test FIRST:

```bash
# 1. Create test file
cat > src/hitestbot/tests/QuickCommandsTest.js << 'EOF'
// Test that /timing works in Claude Code
class QuickCommandsTest extends TestRunner { ... }
EOF

# 2. Run test (will FAIL - feature not implemented)
node src/hitestbot/tests/QuickCommandsTest.js

# 3. Implement feature until test passes
# ... create .claude/commands/*.md files ...

# 4. Run test again (should PASS)
node src/hitestbot/tests/QuickCommandsTest.js

# 5. Review evidence
open e2e_evidence/20260221_*/QuickCommandsTest.mp4
```

### Evidence Review Checklist:

- [ ] Video shows complete user flow
- [ ] Claude Code pane shows command and response
- [ ] EDA pane shows Tcl execution
- [ ] No errors in either pane
- [ ] Test report shows all steps passed
- [ ] Screenshots captured at key moments

---

## Appendix: User Stories

### Story 1: Junior Engineer On First Day
```
"I need to check timing but I don't know the commands.
 I type /timing and HiPilot does everything.
 It even explains what each violation means."
```

### Story 2: Senior Engineer Under Deadline
```
"Setup violations appeared in post-route.
 I say 'fix setup timing' and HiPilot:
 1. Runs timing report
 2. Finds the root cause
 3. Generates the fix Tcl
 4. Warns me about potential hold issues
 I review and run. Done in 5 minutes."
```

### Story 3: Team Lead Sharing Knowledge
```
"I solved a tricky CTS issue.
 I run /skill-gen, paste my email explanation.
 Now anyone on the team can say 'fix CTS skew'
 and get my exact solution."
```

---

**This plan prioritizes the user experience over feature completeness.**
**Because features don't matter if users don't use them.**
