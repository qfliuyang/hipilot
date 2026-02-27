# HiPilot Test Plan

> Progressive testing on the EDA server to achieve full RTL-to-GDS flow.

## How to Run Each Test

Every test is one command. HiTestBot launches HiPilot, types the command, watches, scores.

```bash
# From dev machine (SSH to EDA server):
bin/hitestbot-eda "<command>"

# Download evidence:
bin/hitestbot-pull
```

Evidence appears in `test-evidence/<timestamp>/`.

## Pre-Test Checklist

Before each test, verify on the EDA server:

```bash
# 1. Kill stale processes
pkill -9 -f "innovus|icc2_shell|pt_shell|ffmpeg" 2>/dev/null; tmux -L hipilot kill-server 2>/dev/null

# 2. Verify design files exist
ls /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v
ls /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef

# 3. Verify HiPilot is deployed
ls /home/EDA/hipilot/current/bin/hipilot
ls /home/EDA/hipilot/current/servers/eda/index.js

# 4. Verify Claude Code settings
cat ~/.claude/settings.json | python -m json.tool | head -5
```

---

## Phase 0: Infrastructure (5 min)

**Goal:** HiPilot launches, Claude Code responds.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P0-1 | `hello` | Claude responds to a simple message | L1 ≥ 1.0 |

**Known issues from previous testing:**
- Claude Code shows "Quick safety check" trust prompt — `bin/hipilot` handles this (polls and sends "1")
- Claude Code shows "bypass permissions" prompt — `bin/hipilot` handles this (Tab + Space + Enter)
- If MCP feature gate is disabled (v2.1.59), Claude falls back to Bash workaround

**Exit:** Claude responds → proceed to Phase 1.

---

## Phase 1: EDA Tool Detection (10 min)

**Goal:** Claude uses MCP to check system status.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P1-1 | `check if any EDA tool is running` | Claude calls `eda.detect_tool` or `eda.get_status` | L3 ≥ 0.5 (MCP used) |

**What to look for in evidence:**
- Left pane shows MCP tool call (e.g., `eda.detect_tool` or Bash workaround with `node servers/eda/index.js`)
- Result shows "No EDA tool detected" or tool name
- Claude reports the result to the user

**Exit:** MCP tool call succeeded → proceed to Phase 2.

---

## Phase 2: Tcl Generation (10 min)

**Goal:** Claude generates Tcl from a template.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P2-1 | `generate a timing report for Innovus` | Claude calls `eda.generate_tcl` | L3 ≥ 0.5, sees `[✓ Template]` in output |

**What to look for in evidence:**
- Left pane shows `generate_tcl` call with `operation: "report_timing"`
- Response includes `[✓ Template]` badge
- Tcl content is visible (from `cadence/innovus_report_timing.tcl`)

**Exit:** Template Tcl generated → proceed to Phase 3.

---

## Phase 3: Start EDA Tool (15 min)

**Goal:** Claude starts Innovus in the right pane via MCP.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P3-1 | `start innovus for the ibex design` | Claude calls `eda.start_tool`, Innovus prompt appears in right pane | L4 ≥ 0.5 (right pane has `innovus 1>`) |

**This is the critical test.** If Claude uses Bash instead of MCP, Innovus starts in the WRONG pane. The CLAUDE.md explains why MCP is needed (sends to right pane through tmux).

**What to look for in evidence:**
- Left pane shows `eda.start_tool` call (or Bash workaround calling `node servers/eda/index.js`)
- Right pane shows Innovus startup messages and `innovus 1>` prompt
- NOT: Innovus running in the left pane (that means Bash was used directly)

**Known blocker (P6-002):** `eda.start_tool` via Bash workaround may be permission-denied. If so, check `settings.json` permissions.allow patterns.

**Exit:** `innovus 1>` in right pane → proceed to Phase 4.

---

## Phase 4: Execute Single Stage (15 min)

**Goal:** Claude executes one Tcl stage in Innovus.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P4-1 | `run the design init stage for ibex` | Claude loads skill, sends init Tcl, Innovus processes it | L4 ≥ 0.5 (right pane shows Innovus output) |

**What to look for in evidence:**
- Claude loads `ibex-rtl2gds-flow` skill
- Claude sends the Stage 1 Tcl (MMMC + init_design)
- Right pane shows Innovus processing (LEF files loaded, design initialized)
- `checkDesign` and `timeDesign` output visible
- `saveDesign result/pr/data/init_design.enc` succeeds
- Innovus exits cleanly

**Exit:** Design initialized, checkpoint saved → proceed to Phase 5.

---

## Phase 5: Multi-Stage Flow (30-60 min)

**Goal:** Claude executes multiple sequential stages with checkpoint chain.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P5-1 | `/rtl2gds` | Claude drives stages 1-4 (init → floorplan → power → placement) | ≥3 stages complete, L4 ≥ 0.5 |

**Each stage should:**
1. Start fresh Innovus: `innovus -no_gui -files stage.tcl`
2. Load previous checkpoint: `source result/pr/data/previous.enc`
3. Run stage commands
4. Save new checkpoint: `saveDesign result/pr/data/current.enc`
5. Exit: `exit`

**Checkpoint chain:**
```
init_design.enc → floor_plan.enc → powerplan.enc → placement.enc
```

**What to look for:**
- Each stage starts a new Innovus (right pane shows startup each time)
- Each checkpoint file gets created on the EDA server
- Claude reports QoR after timing-sensitive stages (placement)
- If a stage fails, Claude calls `diagnose_error` and retries

**Exit:** ≥4 stages complete → proceed to Phase 6.

---

## Phase 6: Full RTL2GDS Flow (60-90 min)

**Goal:** Complete 9-stage flow produces GDS.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P6-1 | `/rtl2gds` | All 9 stages complete, GDS file exists | L4 ≥ 0.5 on ≥7 stages, GDS exists |

**Stages and expected outputs:**

| # | Stage | Output checkpoint | Key verification |
|---|-------|------------------|-----------------|
| 1 | Init + MMMC | init_design.enc | `checkDesign` passes |
| 2 | Floorplan | floor_plan.enc | Rows created, DEF exported |
| 3 | Power Planning | powerplan.enc | `verifyConnectivity` passes |
| 4 | Placement | placement.enc | `place_opt_design` completes, WNS reported |
| 5 | CTS | cts.enc | `ccopt_design` completes, clock tree built |
| 6 | Post-CTS Opt | post_cts_opt.enc | `optDesign -postCTS -hold` completes |
| 7 | Routing | routing.enc | `routeDesign -globalDetail` completes |
| 8 | Route Opt | routing_opt.enc | `optDesign -postRoute -setup` completes |
| 9 | Chip Finish | chip_done.enc + ibex_core.gds | GDS file exported |

**Verify on EDA server after test:**
```bash
ls -la /home/EDA/ibex_work_upload/result/pr/data/*.enc
ls -la /home/EDA/ibex_work_upload/result/pr/data/ibex_core.gds
```

**Exit:** GDS exists → Phase 6 PASS.

---

## Phase 7: Error Recovery (15 min)

**Goal:** Claude handles errors gracefully.

| Test | Command | What to check | Pass criteria |
|------|---------|--------------|---------------|
| P7-1 | `run placement` (without init) | Claude detects missing checkpoint, reports error | Error detected and reported |
| P7-2 | `run invalid tcl command xyz123` | Claude detects Innovus error, calls diagnose_error | Error diagnosed |

---

## Evidence Review Checklist

After each test, review `test-evidence/<timestamp>/`:

- [ ] `FLOW_REPORT.md` — L1-L5 scores, failure classification
- [ ] `screenshot_workspace_visible.png` — HiPilot layout visible (2 panes, status bar)
- [ ] `screenshot_after_type.png` — command typed in left pane
- [ ] `screenshot_after_flow.png` — final state of both panes
- [ ] `logs/claude_full.log` — complete left pane scrollback (Claude's actions)
- [ ] `logs/eda_full.log` — complete right pane scrollback (EDA tool output)
- [ ] `recordings/test_recording.mp4` — desktop video
- [ ] `timeline.jsonl` — correlated timeline (video ↔ panes ↔ MCP)
- [ ] `test_metadata.json` — test ID, duration, score, result

## Scoring Reference

| Score | Meaning |
|-------|---------|
| ≥ 4.0/5 | PASS |
| 2.0-3.9 | PARTIAL — some layers succeeded |
| < 2.0 | FAIL |

| Layer | What it measures |
|-------|-----------------|
| L1 | Did Claude respond at all? |
| L2 | Did Claude understand the task? |
| L3 | Did Claude use MCP tools (not just Bash)? |
| L4 | Did the EDA tool run successfully? |
| L5 | Did Claude report QoR (WNS/TNS)? |

## Known Issues

| ID | Description | Workaround |
|----|-------------|-----------|
| P6-001 | Claude Code v2.1.59 MCP feature gate disables native MCP tools | Bash workaround: Claude calls MCP servers via `node servers/eda/index.js` |
| P6-002 | `eda.start_tool` Bash workaround permission-denied | Broaden `permissions.allow` patterns in settings.json |
| P6-003 | "bypass permissions" prompt not dismissible programmatically | `bin/hipilot` attempts Tab+Space+Enter sequence |
