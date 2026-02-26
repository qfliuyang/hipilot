# HiTestBot Gradual Test Plan

**Goal:** Use HiTestBot to progressively test HiPilot, exposing and fixing problems until we can run a complete RTL-to-GDS flow autonomously.

**Philosophy:** Each test level must pass consistently before advancing. Failures are opportunities to improve HiPilot.

---

## HiTestBot Testing Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                      HiTestBot Test Pyramid                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         ┌─────────────┐                             │
│                         │  Level 5    │                             │
│                         │  Full Flow  │  ← /rtl2gds (10 stages)    │
│                         │  RTL-to-GDS │                             │
│                         └──────┬──────┘                             │
│                                │                                    │
│                    ┌───────────┴───────────┐                        │
│                    │       Level 4         │                        │
│                    │   Multi-Stage Flow    │  ← 3-5 consecutive     │
│                    │   (3-5 stages)        │    stages              │
│                    └───────────┬───────────┘                        │
│                                │                                    │
│                 ┌──────────────┴──────────────┐                     │
│                 │          Level 3            │                     │
│                 │     Single-Stage Flow       │  ← Init→Floorplan   │
│                 │     (2 consecutive stages)  │    or similar       │
│                 └──────────────┬──────────────┘                     │
│                                │                                    │
│              ┌─────────────────┴─────────────────┐                   │
│              │            Level 2                │                   │
│              │       Single Commands/Skills      │  ← /timing        │
│              │       (1 MCP call expected)       │    /report-timing │
│              └─────────────────┬─────────────────┘                   │
│                                │                                    │
│    ┌───────────────────────────┴───────────────────────────┐         │
│    │                     Level 1                           │         │
│    │              Infrastructure Tests                     │         │
│    │         (No Claude Code in the loop)                  │         │
│    └───────────────────────────────────────────────────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Level 1: Infrastructure Tests

**Purpose:** Verify MCP servers work without AI in the loop.

**Environment:** Cloud VM OK (no EDA tools needed)

**Run:**
```bash
node src/hitestbot/tests/McpInfraTest.js
```

### Test Cases

| Test ID | Component | Test | Expected Result |
|---------|-----------|------|-----------------|
| L1-01 | EDA MCP | tools/list returns 52 tools | ✅ 52 tools |
| L1-02 | EDA MCP | eda.get_status returns mode | ✅ Has mode info |
| L1-03 | EDA MCP | eda.generate_tcl produces template | ✅ [✓ Template] badge |
| L1-04 | EDA MCP | eda.list_templates returns 22 | ✅ Templates listed |
| L1-05 | EDA MCP | eda.validate_tcl works | ✅ Validation OK |
| L1-06 | EDA MCP | workflow.list shows rtl2gds | ✅ Workflows listed |
| L1-07 | Knowledge | list_skills returns 36 | ✅ 36 skills |
| L1-08 | Knowledge | match_skill finds fix-setup | ✅ Matched |
| L1-09 | Knowledge | get_command_ref works | ✅ Reference OK |
| L1-10 | Logging | MCP log file created | ✅ Log exists |
| L1-11 | Logging | Log entries valid JSONL | ✅ Valid entries |
| L1-12 | Logging | Required fields present | ✅ Fields OK |

### Exit Criteria for Level 1

- [ ] All 12 tests pass
- [ ] No errors in MCP server startup
- [ ] Template rendering produces valid Tcl

**If Level 1 fails:** Fix the specific MCP server or tool that's broken. This is a HIPILOT_BUG.

---

## Level 2: Single Command/Skill Tests

**Purpose:** Test that Claude Code can execute single commands using MCP tools.

**Environment:** EDA Server (requires Innovus running)

**Run:**
```bash
bin/hitestbot-eda "/timing"
bin/hitestbot-eda "/report-timing"
bin/hitestbot-eda "/drc"
bin/hitestbot-eda "/power"
bin/hitestbot-eda "/area"
```

### Test Matrix

| Test ID | Command | Expected MCP Tool | Success Criteria (L1-L5 ≥ 3.0) |
|---------|---------|-------------------|-------------------------------|
| L2-01 | `/timing` | eda.quick({op:"timing"}) | WNS/TNS in output |
| L2-02 | `/report-timing` | eda.generate_tcl + send | Timing report generated |
| L2-03 | `/drc` | eda.quick({op:"drc"}) | DRC count reported |
| L2-04 | `/power` | eda.quick({op:"power"}) | Power numbers reported |
| L2-05 | `/area` | eda.quick({op:"area"}) | Area/util reported |
| L2-06 | "start innovus" | eda.start_tool | Innovus prompt appears |
| L2-07 | "save design" | eda.generate_tcl(save) | Checkpoint saved |
| L2-08 | "list templates" | eda.list_templates | Templates listed |

### Scoring Criteria for L2

| Layer | Score 1.0 | Score 0.5 | Score 0.0 |
|-------|-----------|-----------|-----------|
| L1 Prompt | Claude acknowledged | Partial response | No response |
| L2 Intent | Correct skill/tool selected | Wrong tool, right domain | No tool selected |
| L3 MCP Usage | MCP tool used correctly | MCP used but wrong args | Bash/tmux direct |
| L4 EDA Exec | Command executed, no errors | Executed with warnings | Failed or not sent |
| L5 QoR | Metrics captured | Partial metrics | No metrics |

### Exit Criteria for Level 2

- [ ] At least 6/8 tests pass (score ≥ 3.0)
- [ ] No AI_BEHAVIOR failures (Claude using bash instead of MCP)
- [ ] All tests use MCP tools

**If L2 fails:**
- AI_BEHAVIOR → Improve skill triggers or system prompt
- HIPILOT_BUG → Fix the MCP tool
- ENVIRONMENT → Check EDA tool status

---

## Level 3: Single-Stage Flow Tests

**Purpose:** Test that Claude Code can execute a complete flow stage (2+ MCP calls).

**Environment:** EDA Server (requires Innovus + design loaded)

### Test Matrix

| Test ID | Stage | Command | Entry Criteria | Exit Criteria |
|---------|-------|---------|----------------|---------------|
| L3-01 | Design Init | "initialize the Ibex design" | Innovus running | Design loaded, prompt returns |
| L3-02 | Floorplan | "create a floorplan" | Design initialized | Floorplan saved |
| L3-03 | Power Plan | "add power rings and stripes" | Floorplan complete | Power grid verified |
| L3-04 | Placement | "run placement" | Power plan done | Cells placed, timing reported |
| L3-05 | CTS | "build the clock tree" | Placement done | CTS complete |
| L3-06 | Routing | "route the design" | CTS/Place done | 100% routed |
| L3-07 | Post-Route | "run post-route optimization" | Routing done | Timing improved |

### Single-Stage Run Script

Create `bin/hitestbot-stage`:

```bash
#!/bin/bash
# Run HiTestBot on a single stage
STAGE=$1
if [ -z "$STAGE" ]; then
  echo "Usage: bin/hitestbot-stage <stage>"
  echo "Stages: init, floorplan, power, placement, cts, routing, postroute"
  exit 1
fi

# Map stage to command
case $STAGE in
  init)       COMMAND="initialize the Ibex design in Innovus" ;;
  floorplan)  COMMAND="create a floorplan with 70% utilization" ;;
  power)      COMMAND="add power rings and stripes to the floorplan" ;;
  placement)  COMMAND="run placement on the design" ;;
  cts)        COMMAND="build the clock tree" ;;
  routing)    COMMAND="route all signal nets" ;;
  postroute)  COMMAND="run post-route timing optimization" ;;
  *)          echo "Unknown stage: $STAGE"; exit 1 ;;
esac

bin/hitestbot-eda "$COMMAND"
```

### Exit Criteria for Level 3

- [ ] At least 4/7 stages pass (score ≥ 3.0)
- [ ] Init + Floorplan + Placement must pass
- [ ] CTS requires timing-aware init (may fail in physical-only mode)

**If L3 fails:**
- Check design state matches entry criteria
- Verify timing libraries loaded for CTS
- Check Innovus logs for specific errors

---

## Level 4: Multi-Stage Flow Tests

**Purpose:** Test that Claude Code can execute consecutive stages without human intervention.

**Environment:** EDA Server (requires Innovus + demo design)

### Test Matrix

| Test ID | Flow Segment | Stages | Expected Duration |
|---------|--------------|--------|-------------------|
| L4-01 | Init → Floorplan | 2 | ~5 min |
| L4-02 | Init → Floorplan → Power | 3 | ~8 min |
| L4-03 | Init → Floorplan → Power → Placement | 4 | ~20 min |
| L4-04 | Init → CTS (5 stages) | 5 | ~30 min |
| L4-05 | Full P&R (Init → Routing) | 7 | ~45 min |

### Multi-Stage Commands

```bash
# L4-01: Init → Floorplan
bin/hitestbot-eda "Initialize the Ibex design, then create a floorplan"

# L4-02: Init → Floorplan → Power
bin/hitestbot-eda "Initialize Ibex, create floorplan, and add power grid"

# L4-03: Init → Placement (4 stages)
bin/hitestbot-eda "Run the flow from design init through placement"

# L4-04: Init → CTS (5 stages)
bin/hitestbot-eda "Run init, floorplan, power, placement, and CTS"

# L4-05: Full P&R (7 stages)
bin/hitestbot-eda "Run the complete place and route flow"
```

### Multi-Stage Scoring

Score each stage independently, then calculate:
- **Progress:** Stages completed / Total stages
- **Total Score:** Sum of stage scores / (stages × 5)
- **Blocking Stage:** First stage with score < 2.0

### Exit Criteria for Level 4

- [ ] L4-01 passes (2-stage flow)
- [ ] L4-02 passes (3-stage flow)
- [ ] L4-03 passes (4-stage flow)
- [ ] At least 80% of stages pass in L4-05

---

## Level 5: Full RTL-to-GDS Flow

**Purpose:** Ultimate goal - complete autonomous RTL-to-GDS flow.

**Environment:** EDA Server (Innovus, PrimeTime, Calibre)

### Test Command

```bash
bin/hitestbot-eda /rtl2gds
```

### Flow Stages (10 total)

| # | Stage | Expected Duration | Key Outputs |
|---|-------|-------------------|-------------|
| 1 | Design Init | 2-3 min | Design loaded |
| 2 | Floorplan | 1-2 min | Die area, core util |
| 3 | Power Planning | 2-3 min | Power grid |
| 4 | Placement | 5-10 min | Cells placed, WNS |
| 5 | CTS | 3-5 min | Clock tree, skew |
| 6 | Post-CTS Opt | 5-8 min | Setup/hold improved |
| 7 | Routing | 10-15 min | 100% routed |
| 8 | Route Opt | 5-10 min | DRC minimized |
| 9 | Chip Finish | 3-5 min | GDS, netlist |
| 10 | Signoff | 5-10 min | DRC=0, LVS=OK |

### Graduation Criteria

The RTL-to-GDS flow is **CERTIFIED** when:

- [ ] All 10 stages reach PASS status (score ≥ 4.0 each)
- [ ] Total score ≥ 45/50
- [ ] No HIPILOT_BUG failures
- [ ] Claude used MCP tools exclusively (L3 = 1.0 for all stages)
- [ ] Final QoR: DRC = 0, LVS = CORRECT, timing clean or explained
- [ ] Complete evidence bundle with video

---

## Iterative Test-Debug Cycle

### Cycle Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test-Debug Cycle                             │
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐  │
│   │   RUN    │───▶│ ANALYZE  │───▶│  CLASSIFY │───▶│  FIX   │  │
│   │  HiTestBot│    │ Evidence │    │  Failure  │    │ Issue  │  │
│   └──────────┘    └──────────┘    └──────────┘    └────┬───┘  │
│        ▲                                                 │      │
│        │                                                 │      │
│        └─────────────────────────────────────────────────┘      │
│                          RE-RUN                                 │
└─────────────────────────────────────────────────────────────────┘
```

### After Each Test Run

1. **Review FLOW_REPORT.md** - Check stage scores and blocking issue
2. **Watch video.mp4** - See what actually happened
3. **Check MCP logs** - Verify MCP tools were called
4. **Classify the failure:**

| Category | Indicator | Who Fixes | Example Fix |
|----------|-----------|-----------|-------------|
| **HIPILOT_BUG** | MCP tool returned error for valid input | Developer | Fix tool code |
| **AI_BEHAVIOR** | Claude used bash instead of MCP | Prompt engineer | Improve skill/prompt |
| **ENVIRONMENT** | EDA tool not running, missing files | Ops | Fix setup |

5. **Fix the issue**
6. **Re-deploy:** `node src/hitestbot/infra/deploy_hipilot.js`
7. **Re-run the same test**
8. **Track progress:**

```
Date        Level   Test        Score    Blocking     Category
──────────  ──────  ──────────  ───────  ───────────  ────────────
2026-03-01  L2      /timing     2.0/5.0  L3 MCP       AI_BEHAVIOR
2026-03-02  L2      /timing     4.5/5.0  -            PASS
2026-03-02  L2      /drc        1.5/5.0  L4 EDA       ENVIRONMENT
2026-03-03  L2      /drc        4.0/5.0  -            PASS
2026-03-04  L3      init        3.5/5.0  L5 QoR       HIPILOT_BUG
...
```

---

## Test Run Commands Summary

```bash
# Level 1: Infrastructure (Cloud VM OK)
node src/hitestbot/tests/McpInfraTest.js

# Level 2: Single Commands (EDA Server)
bin/hitestbot-eda "/timing"
bin/hitestbot-eda "/drc"
bin/hitestbot-eda "/power"
bin/hitestbot-eda "/area"

# Level 3: Single Stages (EDA Server)
bin/hitestbot-eda "initialize the Ibex design"
bin/hitestbot-eda "create a floorplan"
bin/hitestbot-eda "run placement"

# Level 4: Multi-Stage (EDA Server)
bin/hitestbot-eda "initialize Ibex, then create floorplan"
bin/hitestbot-eda "run init through placement"

# Level 5: Full Flow (EDA Server)
bin/hitestbot-eda /rtl2gds

# Pull evidence to dev machine
bin/hitestbot-pull
```

---

## Expected Progression Timeline

### Week 1: Level 1-2
- [ ] Run McpInfraTest, fix any failures
- [ ] Test /timing, /drc, /power commands
- [ ] Achieve 6/8 L2 tests passing

### Week 2: Level 2-3
- [ ] All L2 tests passing
- [ ] Test init, floorplan, placement stages
- [ ] Achieve 4/7 L3 stages passing

### Week 3: Level 3-4
- [ ] All L3 core stages passing (init, fp, place)
- [ ] Test multi-stage flows
- [ ] Achieve L4-03 passing (4 stages)

### Week 4: Level 4-5
- [ ] Test 5-7 stage flows
- [ ] Debug CTS if physical-only mode issues
- [ ] First full /rtl2gds attempt

### Week 5+: Certification
- [ ] Achieve all 10 stages passing
- [ ] Verify DRC=0, LVS=CORRECT
- [ ] Document and certify

---

## Failure Classification Decision Tree

```
                    ┌─────────────────────┐
                    │  Stage Score < 3.0  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Check L4 (EDA Exec) │
                    │  Did EDA tool fail?  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
     ┌────────▼────────┐              ┌────────▼────────┐
     │ EDA ERROR FOUND │              │ NO EDA ERROR    │
     └────────┬────────┘              └────────┬────────┘
              │                                 │
   ┌──────────▼──────────┐          ┌──────────▼──────────┐
   │ Check error type:   │          │ Check L3 (MCP Tool) │
   │ - Tool not running? │          │ Did Claude use MCP? │
   │ - Missing files?    │          └──────────┬──────────┘
   │ - License error?    │                     │
   └──────────┬──────────┘          ┌──────────┴──────────┐
              │                     │                     │
    ┌─────────▼─────────┐   ┌───────▼───────┐    ┌───────▼───────┐
    │ ENVIRONMENT       │   │ MCP used?     │    │ Bash used?    │
    │ Fix: Setup/Config │   │ Check args    │    │ AI_BEHAVIOR   │
    └───────────────────┘   └───────┬───────┘    │ Fix: Prompt   │
                                    │            └───────────────┘
                          ┌─────────┴─────────┐
                          │                   │
                 ┌────────▼────────┐  ┌──────▼──────┐
                 │ MCP returned    │  │ MCP OK but  │
                 │ error for valid │  │ bad Tcl     │
                 │ input?          │  │ generated?  │
                 └────────┬────────┘  └──────┬──────┘
                          │                  │
                 ┌────────▼────────┐  ┌──────▼──────┐
                 │ HIPILOT_BUG     │  │ Template?   │
                 │ Fix: MCP code   │  │ - Yes: BUG  │
                 └─────────────────┘  │ - No: AI    │
                                      └─────────────┘
```

---

## Evidence Review Checklist

After each test run, check:

- [ ] **FLOW_REPORT.md** - Overall progress and blocking stage
- [ ] **video.mp4** - What actually happened (watch at 2x speed)
- [ ] **mcp_calls.jsonl** - Which MCP tools were called
- [ ] **claude_full.log** - Claude's complete output
- [ ] **eda_full.log** - EDA tool output
- [ ] **Screenshots** - Key moments captured

### Key Questions

1. Did Claude understand the task? (L2)
2. Did Claude use MCP tools or bash? (L3)
3. Did the EDA tool execute successfully? (L4)
4. Were QoR metrics captured? (L5)
5. What was the blocking issue?

---

## Quick Reference: Test IDs

| Level | Test ID | Description | Command |
|-------|---------|-------------|---------|
| L1 | L1-01 to L1-12 | MCP Infrastructure | `node src/hitestbot/tests/McpInfraTest.js` |
| L2 | L2-01 | /timing | `bin/hitestbot-eda "/timing"` |
| L2 | L2-02 | /report-timing | `bin/hitestbot-eda "/report-timing"` |
| L2 | L2-03 | /drc | `bin/hitestbot-eda "/drc"` |
| L2 | L2-04 | /power | `bin/hitestbot-eda "/power"` |
| L2 | L2-05 | /area | `bin/hitestbot-eda "/area"` |
| L3 | L3-01 | Init stage | `bin/hitestbot-eda "initialize Ibex"` |
| L3 | L3-02 | Floorplan | `bin/hitestbot-eda "create floorplan"` |
| L3 | L3-03 | Power plan | `bin/hitestbot-eda "add power grid"` |
| L3 | L3-04 | Placement | `bin/hitestbot-eda "run placement"` |
| L4 | L4-01 | Init→FP | `bin/hitestbot-eda "init then floorplan"` |
| L4 | L4-03 | Init→Place | `bin/hitestbot-eda "init through placement"` |
| L5 | L5-01 | Full flow | `bin/hitestbot-eda /rtl2gds` |
