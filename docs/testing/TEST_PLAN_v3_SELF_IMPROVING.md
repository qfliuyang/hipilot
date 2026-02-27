# HiPilot Self-Improving Test Plan (v3)

> **Philosophy:** Test → Find Problem → Fix → Verify → Advance
> **Runner:** HiTestBot only
> **Structure:** Staged gates - cannot advance until current stage passes
> **Critical Insight:** HiPilot's value is **multi-tool orchestration** (dc_shell → innovus → pt_shell), not single-tool wrapping
> **New:** **NEVER GIVE UP** - Claude must persist, self-correct, and keep notes
> **New:** **EXPLICIT TOOL SWITCHING** - Machine must learn ASIC flow patterns

---

## Why Multi-Tool + Persistence + Learning Matters

A human engineer knows:
- **Synthesis produces:** Netlist (.vg) + Constraints (.sdc)
- **Handoff:** P&R tool reads synthesis output
- **Tool lifecycle:** Start → Work → Save → Exit → Next tool

**The machine does NOT know this.** We must teach it through explicit tests.

---

## ASIC Design Common Sense (Teaching Scaffold)

### The RTL-to-GDS Tool Chain

```
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: SYNTHESIS (dc_shell)                                 │
│  ├── Input:  RTL (.v files)                                    │
│  ├── Work:   Logic synthesis, timing optimization              │
│  ├── Output: Netlist (.vg), SDC constraints (.sdc)             │
│  └── Save:   saveDesign checkpoint.enc                         │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 2: DESIGN INIT (innovus)                                │
│  ├── Input:  Netlist from Stage 1, SDC from Stage 1            │
│  ├── Work:   Load libraries, initialize database               │
│  ├── Output: Initialized design database                       │
│  └── Save:   saveDesign init_design.enc                        │
├─────────────────────────────────────────────────────────────────┤
│  STAGE 3: FLOORPLAN (innovus)                                  │
│  ├── Input:  init_design.enc                                   │
│  ├── Work:   Die area, core utilization, IO placement          │
│  └── Save:   saveDesign floor_plan.enc                         │
├─────────────────────────────────────────────────────────────────┤
│  ... (continue through CTS, Routing, etc.)                     │
├─────────────────────────────────────────────────────────────────┤
│  STAGE N: SIGNOFF (pt_shell)                                   │
│  ├── Input:  Final netlist, SDC                                │
│  ├── Work:   Static timing analysis                            │
│  └── Output: Timing reports, signoff validation                │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Pattern: Tool Lifecycle

Every tool execution follows this pattern:
```
1. START:   eda.start_tool({tool: "dc_shell|innovus|pt_shell", ...})
2. LOAD:    Source inputs from previous stage
3. WORK:    Run stage-specific Tcl commands
4. SAVE:    saveDesign / save_block (creates checkpoint)
5. EXIT:    exit (clean shutdown)
6. NEXT:    eda.start_tool(next_tool) using saved checkpoint
```

**The machine must learn:** You cannot start innovus without the synthesis netlist.

---

## The Persistence Protocol

Claude Code on the EDA server **MUST NEVER GIVE UP** when encountering errors:

```
ERROR DETECTED
      │
      ▼
┌─────────────┐
│ 1. Capture  │  ← Use eda.capture_and_analyze or eda.peek
│    error    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 2. Diagnose │  ← Use eda.diagnose_error
│             │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 3. Note it  │  ← Use session.add_note
│             │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────┐
│ 4. Fix &    │────▶│ SUCCESS │──▶ Continue to next stage
│    Retry    │     └─────────┘
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 5. Alternative│  ← Try different skill, different parameters
│   approach  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────┐
│ 6. Retry    │────▶│ SUCCESS │──▶ Continue to next stage
│             │     └─────────┘
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 7. After 3  │──▶ Report to engineer WITH FULL NOTES
│   attempts  │    on what was tried
└─────────────┘
```

---

## Stage Gate Rules

**Golden Rule:** You **CANNOT** advance to Stage N+1 until Stage N passes.

**Multi-Tool Rule:** Stages 8-11 explicitly test **tool switching** with save/exit/start pattern.

**Learning Rule:** Each tool-switching stage validates the machine learned the pattern.

**Persistence Rule:** If a test shows Claude giving up after first error, that's a FAILURE.

---

## Pre-Flight Checklist

Before starting Stage 1:

```bash
# 1. Clean environment on EDA server
ssh EDA@192.168.112.163 "pkill -9 -f 'innovus|icc2_shell|pt_shell|dc_shell|ffmpeg'; tmux -L hipilot kill-server 2>/dev/null; rm -f /tmp/hipilot-EDA/mcp_calls.jsonl"

# 2. Verify all tools available
ssh EDA@192.168.112.163 "which innovus dc_shell pt_shell"

# 3. Deploy latest code
node src/hitestbot/infra/deploy_hipilot.js

# 4. Verify deployment
ssh EDA@192.168.112.163 "ls -la /home/EDA/hipilot/current/servers/eda/index.js"

# 5. Reset iteration log
cat > test-iteration-log.json << 'EOF'
{
  "test_run_id": "",
  "start_time": "",
  "stages": {},
  "multi_tool_tests": {
    "synthesis_completed": false,
    "pr_completed": false,
    "signoff_completed": false,
    "handoff_verified": false
  },
  "persistence_tests": {
    "error_recovery": false,
    "note_taking": false,
    "todo_management": false,
    "multi_attempt_success": false
  },
  "tool_switching_tests": {
    "dc_to_innovus": false,
    "innovus_to_pt": false,
    "checkpoint_handoff": false
  }
}
EOF
```

---

## Stage 1: MCP Infrastructure (5 min)

**Goal:** Verify MCP servers are registered and responding

**Test Command:**
```bash
bin/hitestbot-eda "what is your current mode"
```

**Pass Criteria:**
- [ ] L1 ≥ 1.0: Claude responds within 30s
- [ ] L3 ≥ 1.0: `eda.get_mode` or `eda.get_status` appears in MCP logs

---

## Stage 2: Mode System (5 min)

**Goal:** Verify mode switching works (manual ↔ auto)

**Prerequisite:** Stage 1 passed

**Test Commands:**
```bash
# Test 2a: Get current mode
bin/hitestbot-eda "what mode are you in"

# Test 2b: Switch to auto
bin/hitestbot-eda "switch to auto mode"

# Test 2c: Verify auto mode
bin/hitestbot-eda "confirm your mode"

# Test 2d: Switch back to manual (safety)
bin/hitestbot-eda "switch to manual mode"
```

**Pass Criteria:**
- [ ] Test 2b: L4 ≥ 1.0 (status bar shows "⚡ Claude has conn")
- [ ] Test 2c: L3 ≥ 1.0 (`eda.get_mode` returns "auto")
- [ ] Test 2d: L4 ≥ 1.0 (status bar shows "🔒 Manual")

---

## Stage 3: Multi-Tool Detection (10 min)

**Goal:** Verify HiPilot can detect and identify different EDA tools

**Prerequisite:** Stage 2 passed

**Test Commands:**
```bash
# Test 3a: No tool running
bin/hitestbot-eda "check what EDA tools are available"

# Test 3b: Start dc_shell
bin/hitestbot-eda "start dc_shell for synthesis"

# Test 3c: Verify dc_shell detected
bin/hitestbot-eda "what tool is currently running"

# Test 3d: Exit dc_shell
bin/hitestbot-eda "exit dc_shell"

# Test 3e: Start innovus
bin/hitestbot-eda "start innovus"

# Test 3f: Verify innovus detected
bin/hitestbot-eda "what tool is currently running"
```

**Pass Criteria:**
- [ ] Test 3a: L4 ≥ 1.0 (reports "No tool detected")
- [ ] Test 3c: L4 ≥ 1.0 (reports "Design Compiler" or "dc_shell")
- [ ] Test 3d: L4 ≥ 1.0 (dc_shell exits cleanly)
- [ ] Test 3f: L4 ≥ 1.0 (reports "Innovus")

---

## Stage 4: Note-Taking System (10 min)

**Goal:** Claude takes notes to track work

**Prerequisite:** Stage 3 passed

**Test Commands:**
```bash
# Test 4a: Add a note
bin/hitestbot-eda "add a note: testing note-taking system for session tracking"

# Test 4b: Retrieve notes
bin/hitestbot-eda "show me my session notes"

# Test 4c: Add a todo
bin/hitestbot-eda "add a todo to check timing after placement"

# Test 4d: View todos
bin/hitestbot-eda "what are my pending todos"
```

**Pass Criteria:**
- [ ] Test 4a: L3 ≥ 1.0 (`session.add_note` called)
- [ ] Test 4b: L4 ≥ 1.0 (Note is visible in list)
- [ ] Test 4c: L3 ≥ 1.0 (`session.add_todo` called)
- [ ] Test 4d: L4 ≥ 1.0 (Todo is visible in list)

---

## Stage 5: Error Recovery - The Persistence Test (20 min)

**Goal:** Claude encounters error, diagnoses, fixes, and continues

**Prerequisite:** Stage 4 passed

**Setup:** Intentionally cause an error
```bash
# Ensure in auto mode
bin/hitestbot-eda "switch to auto mode"
```

**Test Command:**
```bash
bin/hitestbot-eda "run placement without first initializing the design"
```

**Expected Error:** "No design is loaded" or similar

**Validation - Claude MUST:**

| Step | Action | Tool Used | Evidence |
|------|--------|-----------|----------|
| 1 | Detect error | Output analysis | Error text visible in response |
| 2 | Diagnose | `eda.diagnose_error` | MCP log shows diagnose_error call |
| 3 | Take note | `session.add_note` | Note about error + fix |
| 4 | Fix and retry | New Tcl generated | Retries with design init first |
| 5 | Complete stage | Placement succeeds | Checkpoint created |
| 6 | Report with notes | Summary | Mentions error encountered and fixed |

**Pass Criteria:**
- [ ] L3 ≥ 1.0: `eda.diagnose_error` called
- [ ] L3 ≥ 1.0: `session.add_note` called (category: "error" or "fix")
- [ ] L4 ≥ 1.0: Successfully recovers from error
- [ ] L5 ≥ 1.0: Completes placement after fixing

**FAIL if:** Claude stops and asks "what should I do?" without trying to fix.

---

## Stage 6: EXPLICIT Tool Switching - dc_shell to innovus (30 min)

**Goal:** Machine learns the complete tool lifecycle: Start → Work → Save → Exit → Next Tool

**Prerequisite:** Stage 5 passed

**Teaching Prompt:** This test explicitly teaches the ASIC handoff pattern.

**Test Commands:**
```bash
# Test 6a: Start synthesis
bin/hitestbot-eda "start dc_shell for ibex synthesis. follow the complete flow: start tool, run synthesis, save checkpoint, then exit"

# Verify: dc_shell running, synthesis completes, checkpoint saved, dc_shell exits

# Test 6b: Handoff to P&R
bin/hitestbot-eda "now start innovus and load the synthesis checkpoint you just saved. remember: synthesis produces a netlist that innovus needs as input"
```

**Expected Behavior (Machine Must Learn):**

```
Step 1: dc_shell phase
├── eda.start_tool({tool: "dc_shell", ...})
├── Generate synthesis Tcl
├── execute_and_verify
├── saveDesign synthesis.enc        ← MUST SAVE
└── exit                             ← MUST EXIT

Step 2: innovus phase
├── eda.start_tool({tool: "innovus", ...})
├── Read netlist from synthesis output  ← HANDOFF
├── Read SDC from synthesis output
├── init_design
└── saveDesign init_design.enc
```

**Pass Criteria - Step by Step:**

| Step | Checkpoint | Validation |
|------|------------|------------|
| 1 | dc_shell starts | `pgrep dc_shell` shows process |
| 2 | Synthesis runs | dc_shell.log shows compile_ultra |
| 3 | **SAVE** called | `synthesis.enc` or similar exists |
| 4 | **EXIT** called | dc_shell process ends |
| 5 | innovus starts | `pgrep innovus` shows process |
| 6 | **LOAD** prev output | innovus reads netlist from synthesis dir |
| 7 | Design init completes | `init_design.enc` created |

**Critical Validations:**
- [ ] L3 ≥ 1.0: `eda.start_tool` called for BOTH dc_shell AND innovus
- [ ] L3 ≥ 1.0: `saveDesign` (dc_shell) or `save_block` before exit
- [ ] L4 ≥ 1.0: dc_shell exits cleanly (no crash)
- [ ] L4 ≥ 1.0: innovus loads synthesis output (not starting fresh)
- [ ] L4 ≥ 1.0: Checkpoint handoff verified (init uses synthesis output)

**Evidence Check:**
```bash
# Verify tool lifecycle pattern
ssh EDA@192.168.112.163 "grep -E 'start_tool|saveDesign|exit' /tmp/hipilot-EDA/mcp_calls.jsonl | tail -20"

# Verify checkpoints
ssh EDA@192.168.112.163 "ls -la /home/EDA/ibex_work_upload/result/*/data/*.enc 2>/dev/null | head -10"

# Verify handoff
ssh EDA@192.168.112.163 "grep -i 'reading.*netlist\|loading.*design' /home/EDA/ibex_work_upload/innovus.log 2>/dev/null | head -5"
```

**If This Stage Fails:**

| Failure | Root Cause | Fix |
|---------|------------|-----|
| dc_shell doesn't exit | Missing exit command in Tcl | Add `exit` to dc_shell template |
| innovus starts fresh | Doesn't load synthesis output | Check `read_design` in init skill |
| No checkpoint saved | Missing saveDesign | Add `saveDesign` to stage Tcl |
| Tool switch fails | Wrong pattern in CLAUDE.md | Add explicit START→WORK→SAVE→EXIT→NEXT pattern |

---

## Stage 7: Tool Switching - innovus to pt_shell (20 min)

**Goal:** Machine learns signoff tool handoff

**Prerequisite:** Stage 6 passed

**Test Commands:**
```bash
# Start from existing P&R checkpoint
bin/hitestbot-eda "start innovus and load the placement checkpoint"

# Run some P&R work
bin/hitestbot-eda "run routing and save final checkpoint"

# EXPLICIT handoff to signoff
bin/hitestbot-eda "exit innovus, then start pt_shell for signoff STA using the final netlist and constraints"
```

**Expected Pattern:**
```
innovus phase:
├── start_tool(innovus)
├── run routing
├── saveDesign routing.enc
├── write_netlist final.v      ← OUTPUT FOR PT
└── exit

pt_shell phase:
├── start_tool(pt_shell)
├── read_verilog final.v       ← HANDOFF
├── read_sdc constraints.sdc
├── update_timing
└── report_timing
```

**Pass Criteria:**
- [ ] L3 ≥ 1.0: innovus exits cleanly
- [ ] L3 ≥ 1.0: pt_shell starts
- [ ] L3 ≥ 1.0: pt_shell reads innovus output (netlist)
- [ ] L4 ≥ 1.0: STA completes
- [ ] L5 ≥ 1.0: Timing report generated

---

## Stage 8: Full Tool Chain with Learning Validation (90 min)

**Goal:** Complete flow with explicit tool switches at each stage

**Prerequisite:** Stages 6-7 passed

**Test Command:**
```bash
bin/hitestbot-eda "run complete rtl2gds for ibex. at each stage: start the correct tool, do the work, save checkpoint, exit cleanly, then start the next tool. remember the handoffs: synthesis output goes to P&R, P&R output goes to signoff"
```

**Expected Tool Sequence:**

| # | Stage | Tool | Input From | Output To |
|---|-------|------|------------|-----------|
| 1 | Synthesis | dc_shell | RTL | Netlist → Stage 2 |
| 2 | Design Init | innovus | Stage 1 netlist | init_design.enc → Stage 3 |
| 3 | Floorplan | innovus | Stage 2 checkpoint | floor_plan.enc → Stage 4 |
| 4 | Power | innovus | Stage 3 checkpoint | powerplan.enc → Stage 5 |
| 5 | Placement | innovus | Stage 4 checkpoint | placement.enc → Stage 6 |
| 6 | CTS | innovus | Stage 5 checkpoint | cts.enc → Stage 7 |
| 7 | Routing | innovus | Stage 6 checkpoint | routing.enc → Stage 8 |
| 8 | Signoff | pt_shell | Stage 7 netlist + SDC | Timing reports |

**Validation Per Stage:**
- [ ] Correct tool started
- [ ] Previous stage output loaded
- [ ] Work completed
- [ ] Checkpoint saved
- [ ] Tool exited cleanly

---

## Stage 9: Learning Verification - Common Mistakes (20 min)

**Goal:** Test that machine learned from previous stages and doesn't repeat mistakes

**Test Commands:**

```bash
# Test 9a: Will it try to skip synthesis?
bin/hitestbot-eda "run placement for ibex"  # No mention of synthesis

# Expected: Machine should realize it needs synthesis first
# Should either:
# - Ask if synthesis is done
# - Check for existing netlist
# - Run synthesis automatically
# - Take note about missing prerequisite
```

```bash
# Test 9b: Will it forget to save?
bin/hitestbot-eda "run CTS in innovus then exit"  # No mention of save

# Expected: Machine should save checkpoint before exit
# Should add todo: "Need to saveDesign before exit"
```

```bash
# Test 9c: Will it load the right checkpoint?
bin/hitestbot-eda "start innovus and run routing"

# Expected: Machine should check current stage
# Should load placement.enc, not start fresh
```

**Pass Criteria:**
- [ ] Demonstrates learned patterns from Stages 6-8
- [ ] Takes notes about prerequisites
- [ ] Automatically handles save/exit pattern
- [ ] Loads correct inputs for each stage

---

## Learning Evidence Collection

After each test, verify learning:

```bash
# Check if notes show learning
ssh EDA@192.168.112.163 "cat /tmp/hipilot-EDA/session_notes.jsonl 2>/dev/null | grep -E 'synthesis|handoff|checkpoint|save'"

# Check if todos show understanding
ssh EDA@192.168.112.163 "cat /tmp/hipilot-EDA/session_todos.jsonl 2>/dev/null"

# Check tool sequence in MCP logs
ssh EDA@192.168.112.163 "grep 'start_tool' /tmp/hipilot-EDA/mcp_calls.jsonl | awk -F'"tool":' '{print $2}' | cut -d'"' -f2"
# Should show: dc_shell → innovus → pt_shell sequence
```

---

## ASIC Design Patterns to Teach

Document these in `deploy/eda-server/CLAUDE.md`:

### Pattern 1: The Save-Exit-Start Pattern
```tcl
# ALWAYS end a stage with:
saveDesign <checkpoint_name>
exit

# Then start next tool:
ed.start_tool({tool: "next_tool", ...})
# Load checkpoint from previous stage
```

### Pattern 2: The Handoff Rule
```
Synthesis produces:  .vg (netlist), .sdc (constraints)
P&R produces:        .enc (checkpoints), final .gds
Signoff reads:       final netlist, final SDC
```

### Pattern 3: The Stage Order
```
RTL → Synthesis → Design Init → Floorplan → Power → Placement → CTS → Routing → Signoff
```

### Pattern 4: Tool-Specific Inputs
```
dc_shell:  Reads RTL, outputs netlist
innovus:   Reads netlist, outputs placed/routed design + GDS
pt_shell:  Reads netlist + constraints, outputs timing reports
```

---

## Exit Criteria

**Stop and Ship:**
- Stages 1-9 pass
- **Tool switching validated:** dc_shell → innovus → pt_shell sequence verified
- **Save/exit pattern:** Every stage saves checkpoint and exits cleanly
- **Handoff working:** Each tool loads previous tool's output
- **Learning demonstrated:** Notes show understanding of ASIC flow

**Continue Fixing:**
- Tool doesn't exit before next starts
- Handoff fails (wrong input loaded)
- Machine doesn't save checkpoints
- Learning not demonstrated (no relevant notes)

---

## Summary: What's New in This Version

| Feature | Description |
|---------|-------------|
| **Explicit Tool Switching** | Stage 6-7 test START→WORK→SAVE→EXIT→NEXT pattern |
| **ASIC Flow Teaching** | Documented RTL→GDS stages with inputs/outputs |
| **Handoff Validation** | Each stage verifies correct input loaded |
| **Learning Tests** | Stage 9 verifies machine learned from previous tests |
| **Checkpoint Evidence** | Verify .enc files created at each stage |
| **Pattern Documentation** | ASIC design common sense for CLAUDE.md |

---

*Test Plan Version: 3.3 - Explicit Tool Switching + Learning*
*Last Updated: 2026-02-27*
*Key Addition: Machine learns ASIC flow through explicit test stages*
