# HiPilot Test Plan (v2)

> Progressive testing with latest code improvements. Each test is one command.

## What Changed Since Last Test

| Fix | Impact on testing |
|---|---|
| `_capturePane` tries 3 capture methods | HiTestBot can now see Claude Code's full output (was 2 lines) |
| `waitForClaudeReady` searches anywhere for ❯/Welcome | Claude ready detection no longer times out at 120s |
| `eda.peek` new tool | Claude can watch right pane during long operations |
| `eda.send_tcl_nonblocking` new tool | Claude can send Tcl without blocking |
| `eda.get_status` includes pane snapshots | Claude has "eyes" on both panes |
| Deny patterns fixed | `Bash(*innovus*)` → `Bash(innovus *)` — Bash workaround no longer blocked |
| `HIPILOT_TEST_LOG` in settings.json | MCP calls now logged for evidence collection |
| L4 scoring fixed | Welcome message scores 0.0 (was 0.5) |
| Window sizing: 80% desktop | gnome-terminal --geometry calculated from screen resolution |
| Idle detection: prompt-based | No fixed timeout — waits for ❯ prompt or EDA tool prompt |
| CLAUDE.md: action sequence | "detect → start → skill → execute. DO NOT overthink." |
| CLAUDE.md: progressive disclosure | Teaches Claude to use peek for long-running commands |
| Ibex skill: standalone stages | Each stage has `source checkpoint.enc` + `exit` |

## How to Run

```bash
# From dev machine:
bin/hitestbot-eda "<command>"

# Download evidence:
bin/hitestbot-pull

# Evidence at: test-evidence/<timestamp>/
```

## Pre-Test on EDA Server

```bash
# Kill stale processes
pkill -9 -f "innovus|icc2_shell|pt_shell|dc_shell|ffmpeg" 2>/dev/null
tmux -L hipilot kill-server 2>/dev/null

# Deploy latest code
node src/hitestbot/infra/deploy_hipilot.js

# Verify design tarball exists (for clean start)
ls -la /home/EDA/ibex_demo.tar

# Verify HiPilot deployed
ls /home/EDA/hipilot/current/servers/eda/index.js
```

## Clean Start Rule

**Every test starts with a fresh design copy.** HiTestBot automatically:
1. Extracts `/home/EDA/ibex_demo.tar` into `/home/EDA/hipilot_test/runs/<timestamp>/`
2. Each test gets its own isolated copy — no leftover results from previous runs
3. If the tarball doesn't exist, logs a warning but continues (uses existing design location)

This prevents false positives: old `result/syn/data/ibex_core.syn.v` from a previous run could make Claude skip synthesis and claim success.

## Real Tools Only

**NEVER mock or fake EDA tools.** All tests MUST use real EDA tools:
- `dc_shell` for synthesis (Synopsys Design Compiler)
- `innovus` for P&R (Cadence Innovus)
- `pt_shell` for signoff STA (Synopsys PrimeTime)

If a test cannot use real tools (e.g., license unavailable), it must be marked as SKIPPED, not faked with `puts` or `echo` commands.

---

## Phase 0: Claude Responds (5 min)

```bash
bin/hitestbot-eda "hello"
```

| Check | Expected |
|---|---|
| Claude Code starts | ❯ prompt appears within 120s |
| Trust/bypass prompt handled | bin/hipilot auto-sends "1" and Tab+Space+Enter |
| Claude responds to "hello" | Left pane shows a response |
| L1 score | ≥ 1.0 |

**Pass:** Claude responds → Phase 1.

---

## Phase 1: MCP Tool Call (10 min)

```bash
bin/hitestbot-eda "check what EDA tools are available"
```

| Check | Expected |
|---|---|
| Claude uses MCP (native or Bash workaround) | `eda.detect_tool` or `eda.get_status` called |
| Result shows tool status | "No tool detected" or tool name |
| Right pane shows nothing new | Still welcome message (no tool started yet) |
| L3 score | ≥ 0.5 |

**New check:** MCP log at `/tmp/hipilot_test_mcp.jsonl` should have entries.

**Pass:** MCP tool call succeeded → Phase 2.

---

## Phase 2: Start Innovus (15 min)

```bash
bin/hitestbot-eda "start innovus for the ibex design at /home/EDA/ibex_work_upload"
```

| Check | Expected |
|---|---|
| Claude calls `eda.start_tool` | Via native MCP or Bash workaround |
| Right pane shows Innovus starting | Startup messages, license checkout |
| Right pane shows prompt | `innovus 1>` appears |
| L4 score | ≥ 0.5 |

**This was the blocker in the last test.** The deny pattern `Bash(*innovus*)` blocked the Bash workaround because the JSON payload contained "innovus". Fixed: now `Bash(innovus *)` only blocks direct execution.

**If it fails again:** Check `settings.json` permissions on EDA server:
```bash
cat ~/.claude/settings.json | python -m json.tool | grep -A30 permissions
```

**Pass:** `innovus 1>` in right pane → Phase 3.

---

## Phase 3: Generate and Execute Tcl (15 min)

```bash
bin/hitestbot-eda "generate a timing report and execute it in innovus"
```

| Check | Expected |
|---|---|
| Claude generates Tcl | `[✓ Template]` badge |
| Claude executes Tcl | `eda.execute_and_verify` or non-blocking send + peek |
| Right pane shows Innovus output | Timing report results visible |
| L5 score | ≥ 0.5 (WNS/TNS in Claude's response) |

**Pass:** Tcl executed, QoR reported → Phase 4.

---

## Phase 4: Single P&R Stage (20 min)

```bash
bin/hitestbot-eda "load the ibex-rtl2gds-flow skill and run stage 1 (design init)"
```

| Check | Expected |
|---|---|
| Claude loads skill | `knowledge.get_skill` called |
| Claude sends Stage 1 Tcl | MMMC setup + init_design |
| Innovus processes Tcl | Right pane shows LEF/netlist loading |
| Checkpoint saved | `result/pr/data/init_design.enc` created |
| Innovus exits | Stage is standalone (source + run + save + exit) |
| L4 score | ≥ 0.5 |

**New behavior:** Claude may use `eda.send_tcl_nonblocking` + `eda.peek` for progress monitoring.

**Pass:** `init_design.enc` exists on EDA server → Phase 5.

---

## Phase 5: Multi-Stage Flow (60 min)

```bash
bin/hitestbot-eda "/rtl2gds"
```

| Check | Expected |
|---|---|
| Claude runs ≥4 stages | init → floorplan → power → placement |
| Each stage is standalone | Fresh Innovus start, source checkpoint, save, exit |
| Checkpoints created | `init_design.enc`, `floor_plan.enc`, `powerplan.enc`, `placement.enc` |
| QoR reported after placement | WNS/TNS numbers in Claude's output |
| Claude uses peek for progress | `eda.peek` calls between stages (progressive disclosure) |

**Verify on EDA server:**
```bash
ls -la /home/EDA/ibex_work_upload/result/pr/data/*.enc
```

**Pass:** ≥4 checkpoints exist → Phase 6.

---

## Phase 6: Full Flow to GDS (90 min)

```bash
bin/hitestbot-eda "/rtl2gds"
```

| # | Stage | Checkpoint | Verify |
|---|-------|-----------|--------|
| 1 | Init + MMMC | init_design.enc | `checkDesign` passes |
| 2 | Floorplan | floor_plan.enc | Rows created |
| 3 | Power | powerplan.enc | `verifyConnectivity` passes |
| 4 | Placement | placement.enc | WNS reported |
| 5 | CTS | cts.enc | Clock tree built |
| 6 | Post-CTS | post_cts_opt.enc | Hold violations fixed |
| 7 | Routing | routing.enc | `routeDesign` completes |
| 8 | Route Opt | routing_opt.enc | `optDesign` completes |
| 9 | Chip Finish | chip_done.enc + ibex_core.gds | GDS exported |

**Verify:**
```bash
ls -la /home/EDA/ibex_work_upload/result/pr/data/ibex_core.gds
```

**Pass:** GDS exists.

---

## Evidence Review After Each Test

```
test-evidence/<timestamp>/
├── FLOW_REPORT.md          ← L1-L5 scores (verify against raw logs!)
├── test_metadata.json      ← score, duration, result
├── run_log.txt             ← HiTestBot's actions (verify state detection works)
├── logs/
│   ├── claude_full.log     ← Claude's complete output (verify MCP calls visible)
│   ├── eda_full.log        ← EDA pane complete output (verify tool ran)
│   └── mcp_calls.jsonl     ← MCP call log (NEW — should have entries now)
├── screenshots/            ← Verify window is 80% of desktop
├── recordings/             ← Verify video captures the workspace
└── timeline.jsonl          ← Cross-reference video timestamps with MCP calls
```

**Cross-reference checklist:**
- [ ] `claude_full.log` shows more than 2 lines (capture fix working)
- [ ] `mcp_calls.jsonl` exists and has entries (HIPILOT_TEST_LOG working)
- [ ] L4 score is 0.0 when EDA pane only has welcome message (scoring fix)
- [ ] HiTestBot detected Claude ready within 30s (not 120s timeout)
- [ ] No "Both panes idle" premature termination (prompt-based detection)

## Known Upstream Issues

| ID | Issue | Status | Impact |
|----|-------|--------|--------|
| P6-001 | MCP feature gate disabled in Claude Code v2.1.59 | UPSTREAM | Forces Bash workaround |
| P6-003 | "bypass permissions" prompt not dismissible | UPSTREAM | May interfere with tool calls |
