# HiPilot Unified Test Plan v3.0

> **One test plan to rule them all.** Self-improving, evidence-based, progressive certification.

**Version:** 3.0
**Status:** Active
**Replaces:** TEST_PLAN_v2.md, TEST_PLAN_v3_*.md, RTL2GDS_TEST_PLAN_OPERATIONAL.md

---

## 1. Philosophy

### 1.1 Core Principles

| Principle | Meaning |
|-----------|---------|
| **Progress Over Pass/Fail** | 7/10 stages with detailed failure analysis > binary FAIL |
| **Evidence at Every Layer** | Logs + Screenshots + Video = Three-view correlation |
| **Test Like a Human** | HiTestBot uses HiPilot like a real engineer would |
| **Self-Improving** | Every failure feeds back into the next iteration |
| **Real Tools Only** | No mocks. Real dc_shell, innovus, pt_shell. |

### 1.2 The North Star

> **HiPilot can conduct a complete RTL-to-GDS flow driven by Claude Code, MCP tools, and skills — proving that an AI Agent can replace a human for standard flow execution.**

---

## 2. Test Architecture

### 2.1 Three-View Evidence System

```
┌─────────────────────────────────────────────────────────────────┐
│                     HiTestBot (Virtual Human)                    │
│                         ┌─────────────┐                         │
│                         │  TIMELINE   │                         │
│                         │  MERGER     │                         │
│                         └──────┬──────┘                         │
│              ┌──────────────────┼──────────────────┐            │
│              ▼                  ▼                  ▼            │
│    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│    │  VIEW 1: LOGS   │ │ VIEW 2: SCREEN  │ │ VIEW 3: VIDEO   │ │
│    │                 │ │                 │ │                 │ │
│    │ claude_full.log │ │ screenshots/    │ │ recording.mp4   │ │
│    │ eda_full.log    │ │ • launch.png    │ │                 │ │
│    │ mcp_calls.jsonl │ │ • complete.png  │ │                 │ │
│    │ timeline.jsonl  │ │                 │ │                 │ │
│    └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Disagreement between views → Human/AI observer review required. Observer judgment > programmatic score.

### 2.2 Five-Layer Scoring (L1-L5)

| Layer | Score | What | How to Verify |
|-------|-------|------|---------------|
| **L1** | 0-1.0 | Claude responds | Left pane changes from initial state |
| **L2** | 0-1.0 | Understands task | Keywords match intent (timing, route, etc.) |
| **L3** | 0-1.0 | Uses MCP tools | Tool calls visible in left pane |
| **L4** | 0-1.0 | EDA tool responds | Right pane shows tool activity |
| **L5** | 0-1.0 | Reports QoR | WNS/TNS/metrics in Claude's response |

**Stage Score** = Average of all 5 layers (0.0 to 1.0)

---

## 3. Progressive Test Phases

### Phase 0: Infrastructure (5 min)
**Goal:** HiPilot workspace creates successfully

| Check | Command | Pass Criteria | Evidence |
|-------|---------|---------------|----------|
| tmux session | `bin/hipilot --no-terminal` | Session `hipilot` created | `tmux -L hipilot list-sessions` |
| Display | gnome-terminal | Window opens, 80% desktop | Screenshot |
| Claude starts | Auto-launched | ❯ prompt within 60s | claude_full.log |
| MCP servers | Auto-registered | 3 servers in settings.json | mcp_calls.jsonl entries |

**Failure Modes:**
- `tmux` not installed → Install tmux
- `claude` not found → Check PATH
- Display unavailable → Verify :0 accessible

---

### Phase 1: Claude Responds (5 min)
**Goal:** Basic interaction works

```bash
bin/hitestbot-eda "hello"
```

| Check | Expected | Score |
|-------|----------|-------|
| L1: Claude responds | Left pane shows response | ≥ 1.0 |
| L2: Coherent | Response makes sense | ≥ 0.5 |

**Failure Modes:**
- Trust prompt not handled → Fix bin/hipilot auto-acknowledge
- Bypass permissions blocked → Check --dangerously-skip-permissions

---

### Phase 2: MCP Tool Call (10 min)
**Goal:** MCP infrastructure functional

```bash
bin/hitestbot-eda "check what EDA tools are available"
```

| Check | Expected | Score |
|-------|----------|-------|
| L3: Uses MCP | `eda.detect_tool` or `eda.get_status` called | ≥ 0.5 |
| Result | Tool status reported | Any result acceptable |

**Failure Modes:**
- MCP feature gate → Use --mcp-config workaround
- Bash deny pattern → Fix settings.json permissions

---

### Phase 3: Start EDA Tool (15 min)
**Goal:** EDA tool launches in right pane

```bash
bin/hitestbot-eda "start innovus for the ibex design"
```

| Check | Expected | Score |
|-------|----------|-------|
| L3: Tool call | `eda.start_tool` with tool="innovus" | ≥ 0.5 |
| L4: Tool responds | `innovus 1>` prompt appears | ≥ 0.5 |

**Failure Modes:**
- License unavailable → Check lmstat, restart flexlm
- Design path wrong → Verify /home/EDA/ibex_work_upload exists
- Tool crashes → Check tool setup scripts

---

### Phase 4: Generate and Execute Tcl (15 min)
**Goal:** End-to-end Tcl execution pipeline

```bash
bin/hitestbot-eda "generate a timing report and execute it"
```

| Check | Expected | Score |
|-------|----------|-------|
| L3: Tcl generated | `[✓ Template]` badge visible | ≥ 0.5 |
| L4: Tcl executed | Right pane shows report_timing output | ≥ 0.5 |
| L5: QoR reported | WNS/TNS numbers in response | ≥ 0.5 |

**Failure Modes:**
- Template not found → Check template_path in skill metadata
- Tcl syntax error → Check EDA server version compatibility
- No timing data → Design may be in physical-only mode

---

### Phase 5: Single Stage Execution (30 min)
**Goal:** One complete P&R stage (design init)

```bash
bin/hitestbot-eda "run stage 1: design init with MMMC setup"
```

| Check | Expected | Evidence |
|-------|----------|----------|
| Skill loaded | `knowledge.get_skill` called | mcp_calls.jsonl |
| Tcl sent | MMMC setup + init_design | eda_full.log |
| Checkpoint saved | `init_design.enc` exists | File check |
| Tool exits | Innovus exits cleanly | eda_full.log |

**Pass Criteria:**
- L4 ≥ 0.5 (tool ran)
- Checkpoint file exists
- No ERROR in logs

---

### Phase 6: Multi-Stage Flow (60 min)
**Goal:** 4+ stages in sequence

```bash
bin/hitestbot-eda "/rtl2gds run through placement"
```

| Stage | Checkpoint | Duration | Verify |
|-------|------------|----------|--------|
| 1. Design Init | init_design.enc | 2 min | File exists |
| 2. Floorplan | floor_plan.enc | 1 min | File exists |
| 3. Power Plan | powerplan.enc | 1 min | File exists |
| 4. Placement | placement.enc | 5 min | WNS reported |

**Pass Criteria:**
- All 4 checkpoints exist
- L5 ≥ 0.5 (QoR reported)
- No stage fails

---

### Phase 7: Full RTL2GDS to GDS (120 min)
**Goal:** Complete flow, GDS output

```bash
bin/hitestbot-eda "/rtl2gds full flow"
```

| Stage | Checkpoint | Verify |
|-------|------------|--------|
| 5. CTS | cts.enc | Clock tree built |
| 6. Post-CTS Opt | post_cts_opt.enc | Hold fixed |
| 7. Routing | routing.enc | 100% routed |
| 8. Route Opt | routing_opt.enc | DRC clean |
| 9. Chip Finish | chip_done.enc | Final checkpoint |
| 10. GDS Export | ibex_core.gds | File > 10MB |

**Graduation Criteria:**
- All 10 stages complete
- GDS file exists and > 10MB
- Final timing report generated
- Fresh evidence (timestamps after test start)

---

## 4. Self-Improvement System

### 4.1 Failure Classification

Every failure is classified into one of these categories:

| Category | Owner | Fix Type | Examples |
|----------|-------|----------|----------|
| `infrastructure` | DevOps | Environment | License, disk, network |
| `configuration` | User | Setup | Paths, constraints, settings |
| `methodology` | HiPilot Team | Code | Flow steps, Tcl commands |
| `ai_behavior` | CLAUDE.md | Prompt | Misunderstanding, wrong tool |
| `tool_bug` | Vendor | Workaround | Actual EDA tool defects |

### 4.2 Iteration Loop

```
ITERATION N:
  FOR phase 0..target:
    RUN phase test
    IF phase passes:
      MARK passed
    ELSE:
      CLASSIFY failure (category, root cause)
      RECORD fix (what changed)
      APPLY fix if automatic
      UPDATE knowledge base
      STOP (retry in next iteration)

  IF all phases passed:
    VERIFY graduation criteria
    IF verified: GRADUATE
    ELSE: CONTINUE with stricter criteria
```

### 4.3 Knowledge Base Updates

After each iteration, update:

```yaml
# test-evidence/knowledge_base.yaml
failures:
  - id: F001
    pattern: "license checkout failed"
    category: infrastructure
    fix: "Restart flexlm: lmutil lmdown && lmutil lmdown -c license.dat"
    auto_apply: true

  - id: F002
    pattern: "No paths with slack less than 0.000"
    category: configuration
    fix: "Check SDC constraints for current_design command"
    auto_apply: false

  - id: F003
    pattern: "physical-only mode"
    category: methodology
    fix: "Use init_design with MMMC, not just LEF"
    skill_update: skills/design-init.md
```

### 4.4 Skill Auto-Update

When a `methodology` failure is detected:

1. Analyze the failure pattern
2. Check if skill documentation needs update
3. Propose skill improvement PR
4. Track skill version vs failure rate

---

## 5. Evidence Standards

### 5.1 Required Evidence Structure

```
test-evidence/<test_id>/
├── FLOW_REPORT.md              # L1-L5 scores, stage-by-stage
├── test_metadata.json          # Test config, duration, result
├── run_log.txt                 # HiTestBot actions and state transitions
├── knowledge_base_updates.yaml # New failures/Fixes discovered
├── logs/
│   ├── claude_full.log         # Left pane (10000 lines)
│   ├── eda_full.log            # Right pane (10000 lines)
│   └── mcp_calls.jsonl         # MCP tool call log
├── screenshots/
│   ├── 00_launch.png
│   ├── 01_command_typed.png
│   ├── 02_during_execution.png
│   └── 03_completion.png
├── recordings/
│   └── desktop_recording.mp4   # Full test video
└── timeline.jsonl              # Synchronized event timeline
```

### 5.2 Freshness Validation

```javascript
function validateFreshness(file, testStartTime) {
  const stats = fs.statSync(file);
  const createTime = stats.birthtimeMs;

  // 5-second buffer for filesystem precision
  if (createTime < testStartTime - 5000) {
    return {
      valid: false,
      error: 'STALE_EVIDENCE',
      ageMinutes: Math.round((testStartTime - createTime) / 60000)
    };
  }
  return { valid: true };
}
```

### 5.3 Tool Execution Validation

```javascript
function validateToolExecution(edaLog) {
  const echoOnly = /^\[EDA@.*\]\$ echo/;
  const toolPatterns = [
    /innovus\s*\d+>/,
    /dc_shell>/,
    /pt_shell>/,
    /Placement completed/,
    /Routing completed/,
    /streamOut.*completed/
  ];

  const lines = edaLog.split('\n').filter(l => l.trim());

  if (lines.every(l => echoOnly.test(l))) {
    return { valid: false, error: 'ECHO_ONLY_NO_TOOL_EXECUTION' };
  }

  if (!toolPatterns.some(p => lines.some(l => p.test(l)))) {
    return { valid: false, error: 'NO_TOOL_ACTIVITY_DETECTED' };
  }

  return { valid: true };
}
```

---

## 6. Graduation Criteria

### 6.1 Flow Certification Levels

| Level | Phases Required | Evidence | Use Case |
|-------|-----------------|----------|----------|
| **Bronze** | 0-4 | MCP works, Tcl executes | Development, debugging |
| **Silver** | 0-6 | Multi-stage flow | CI/CD integration |
| **Gold** | 0-7 + GDS | Full RTL2GDS | Production release |
| **Platinum** | 0-7 + GDS, 3 consecutive passes | Reliable automation | Customer deployment |

### 6.2 Graduation Report Template

```
═══════════════════════════════════════════════════════════
  HiPilot Flow Certification: GOLD
═══════════════════════════════════════════════════════════

Test ID: hipilot_v3_20260301_120000
Total Iterations: 3
Total Time: 145 minutes
Phases Completed: 8/8
Certification Level: GOLD

Iteration History:
  Iteration 1: Phase 6 failed (congestion) → Reduced utilization 80%→70%
  Iteration 2: Phase 4 failed (license) → Restarted flexlm
  Iteration 3: ALL PHASES PASSED

Evidence Summary:
  Screenshots: 12
  Video: desktop_recording.mp4 (2.3GB)
  MCP Calls: 1,247
  Result Files:
    - ibex_core.gds: 19.3 MB ✓
    - chip_done.enc: 5.1 MB ✓
    - qor.rpt: 245 KB ✓

Quality Metrics:
  WNS: +0.01ns
  TNS: 0.00ns
  Congestion: 3.2%
  DRC Violations: 0

Knowledge Base Updates:
  + Added fix F004: "High congestion at 80% utilization"
  + Updated skill: skills/floorplan.md (utilization guidance)

Next Test Recommendation:
  Platinum certification: Run 2 more consecutive passes

Evidence Location: test-evidence/hipilot_v3_20260301_120000/
```

---

## 7. Execution Guide

### 7.1 Pre-Flight Checklist

```bash
# 1. EDA server connectivity
ssh EDA@192.168.112.163 "echo 'SSH OK'"

# 2. License server
ssh EDA@192.168.112.163 "lmutil lmstat -c 27000@localhost"

# 3. Design tarball
ssh EDA@192.168.112.163 "ls -la /home/EDA/ibex_demo.tar"

# 4. Display
ssh EDA@192.168.112.163 "DISPLAY=:0 xset q"

# 5. Clean state
ssh EDA@192.168.112.163 "pkill -f innovus; pkill -f dc_shell"
```

### 7.2 Run Test

```bash
# Bronze certification (Phases 0-4)
bin/hitestbot-eda "hello"
bin/hitestbot-eda "check what EDA tools are available"
bin/hitestbot-eda "start innovus"
bin/hitestbot-eda "generate timing report"

# Silver certification (Phases 0-6)
bin/hitestbot-eda "/rtl2gds through placement"

# Gold certification (Full flow)
bin/hitestbot-eda "/rtl2gds"

# With environment variables
export HIPILOT_TEST_LOG=/tmp/hipilot_test_mcp.jsonl
export RALPH_TARGET_PHASE=7
bin/hitestbot-eda "/rtl2gds"
```

### 7.3 Collect and Review Evidence

```bash
# Download from EDA server
bin/hitestbot-pull <test_id>

# View report
cat test-evidence/<test_id>/FLOW_REPORT.md

# Analyze timeline
cat test-evidence/<test_id>/timeline.jsonl | jq -c 'select(.type=="mcp_call")'

# Check knowledge base updates
cat test-evidence/<test_id>/knowledge_base_updates.yaml
```

---

## 8. Maintenance

### 8.1 When to Update This Plan

- New MCP tools added → Update Phase 2/3/4 expectations
- New skills added → Update Phase 5/6/7 stages
- Tool versions change → Update EDA tool versions
- New failure patterns discovered → Update Section 4.3

### 8.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2026-03-01 | Unified all test plans, added self-improvement system |
| 2.0 | 2026-02-25 | Progressive phase testing, MCP feature gate workarounds |
| 1.0 | 2026-02-20 | Initial test plan |

---

## Appendix A: Quick Reference

```bash
# Full certification run
bin/hitestbot-eda "/rtl2gds"

# Check latest test
cat test-evidence/$(ls -t test-evidence/ | head -1)/FLOW_REPORT.md

# Clean evidence
rm -rf test-evidence/

# Deploy latest code
node src/hitestbot/infra/deploy_hipilot.js
```

## Appendix B: File Locations

| File | Purpose |
|------|---------|
| `docs/testing/TEST_PLAN.md` | This document (single source of truth) |
| `docs/testing/TESTING_RULES.md` | Scoring methodology and principles |
| `src/hitestbot/core/FlowCertifier.js` | Test orchestrator |
| `skills/ibex-rtl2gds-flow.md` | Complete flow skill |
| `deploy/eda-server/.claude/commands/rtl2gds.md` | Slash command |
