# HiPilot Architecture Review

**Date:** 2026-02-26 | **Version:** 0.5.0 | **Status:** Critical review before EDA server validation

---

## 1. Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  EDA Server                                                         │
│                                                                     │
│  tmux session "hipilot" (launched by bin/hipilot)                   │
│  ┌────────────────────────┬────────────────────────┐               │
│  │ Pane 0 (left)          │ Pane 1 (right)         │               │
│  │                        │                        │               │
│  │  Claude Code           │  Terminal              │               │
│  │  --dangerously-skip-   │  (EDA tool runs here)  │               │
│  │  permissions           │                        │               │
│  │                        │  e.g., innovus -no_gui │               │
│  │  Reads CLAUDE.md       │  e.g., icc2_shell      │               │
│  │  Uses MCP tools        │  e.g., pt_shell        │               │
│  │  Follows skills        │                        │               │
│  └──────┬─────────────────┴────────────────────────┘               │
│         │                          ▲                                │
│         │ MCP (JSON-RPC stdio)     │ tmux send-keys / capture-pane │
│         ▼                          │                                │
│  ┌──────────────────────────────────┐                              │
│  │ 3 MCP Servers (Node.js)          │                              │
│  │                                  │                              │
│  │  hipilot-eda (49 tools)          │──── generates Tcl            │
│  │    - generate_tcl                │──── sends to right pane      │
│  │    - execute_and_verify          │──── waits for EDA prompt     │
│  │    - workflow.run                │──── captures output          │
│  │    - start_tool, detect_tool     │──── extracts QoR             │
│  │    - mode/approval system        │                              │
│  │                                  │                              │
│  │  hipilot-tmux (8 tools)          │──── pane control             │
│  │    - send_keys, capture_pane     │──── status bar               │
│  │                                  │                              │
│  │  hipilot-knowledge (7 tools)     │──── skill lookup             │
│  │    - match_skill, get_skill      │──── doc search               │
│  │    - search_docs                 │                              │
│  └──────────────────────────────────┘                              │
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐                 │
│  │ 35 Skills (.md)     │  │ 20 Templates (.tcl)  │                │
│  │ Expert workflows    │  │ Vendor-specific Tcl   │                │
│  │ Tcl examples        │  │ Nunjucks rendering    │                │
│  └─────────────────────┘  └─────────────────────┘                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ HiTestBot (observer)                                     │       │
│  │ Types in left pane → observes both panes → scores results│       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. The RTL2GDS Data Flow (Current)

When a user types `/rtl2gds` in Claude Code:

```
User types "/rtl2gds"
       │
       ▼
Claude Code reads slash command (deploy/eda-server/.claude/commands/rtl2gds.md)
       │
       ▼
Claude calls eda.detect_tool → checks if Innovus is running
       │
       ▼ (if not running)
Claude calls eda.start_tool({tool:"innovus"}) → sends "innovus -no_gui" to right pane
       │
       ▼
Claude calls eda.rtl2gds.run_full_flow({design:"ibex"})
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ WORKFLOW ENGINE takes over (Claude is out of the loop)   │
│                                                          │
│ For each of 8 hardcoded stages:                          │
│   1. Generate Tcl from operation or use inline Tcl       │
│   2. Write to temp file                                  │
│   3. Send "source /tmp/file.tcl" + C-m to right pane     │
│   4. Poll every 1s for EDA prompt (regex match)          │
│   5. Check for error patterns in output                  │
│   6. If error + on_failure="stop" → abort all            │
│   7. Extract QoR metrics                                 │
│   8. Move to next stage                                  │
│                                                          │
│ Returns final report to Claude                           │
└──────────────────────────────────────────────────────────┘
       │
       ▼
Claude presents results to user
```

---

## 3. Critical Issues

### Issue A: The Workflow Engine Bypasses Claude's Intelligence

**The core problem.** Once Claude calls `workflow.run`, the MCP server takes over and runs all 8 stages as a dumb sequential script. Claude Code — the AI brain — is completely out of the loop during execution.

| What the design says | What actually happens |
|---|---|
| Claude orchestrates each stage | Workflow engine runs all stages blindly |
| Claude uses skills to handle errors | Engine has simple stop/skip/retry(TODO) |
| Claude adapts based on QoR results | Engine doesn't adapt at all |
| Claude uses diagnose_error for failures | Engine just checks error regex patterns |
| Claude tracks QoR between stages | Engine extracts QoR but doesn't use it |

**Impact:** The workflow engine is essentially a Makefile replacement — the exact thing the architecture was designed to avoid.

### Issue B: Two Conflicting Execution Models

```
Model 1 (Skills describe):     Model 2 (Code implements):
─────────────────────────       ─────────────────────────
Claude reads skill              Claude calls workflow.run
Claude calls generate_tcl      Engine generates all Tcl
Claude calls execute_and_verify Engine executes all stages
Claude checks result            Engine checks errors
Claude decides next step        Engine moves to next stage
Claude handles errors           Engine stops or skips
Claude tracks QoR               Engine extracts QoR
```

The `/rtl2gds` slash command tells Claude to use Model 2. But the skills, CLAUDE.md rules, and architecture docs all describe Model 1. This inconsistency means:
- Skills are never actually used during `/rtl2gds`
- Claude's error diagnosis capability is never invoked
- The mode system is bypassed (engine forces auto-execute)

### Issue C: Hardcoded Ibex Paths in Workflow

The `rtl2gds` workflow has hardcoded paths:
```
def_file: '/home/EDA/ibex_work_upload/designs/sky130hd/ibex/floorplan_ibex.def'
lef_files: '/home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/...'
```

This makes the workflow Ibex-only. Any other design requires editing the MCP server source code.

### Issue D: Skills are Documentation, Not Executable

Skills are Markdown files describing workflows in prose. When Claude calls `knowledge.get_skill("placement")`, it gets a markdown document. Claude must:
1. Read and understand the markdown
2. Extract the relevant Tcl
3. Manually call `eda.generate_tcl` or `eda.execute_and_verify`
4. This works — but only if Claude is actually orchestrating (see Issue A)

### Issue E: Template Coverage Gaps

Templates exist for common operations (report_timing, fix_setup_timing, etc.) but several RTL2GDS stages have no template:
- `run_cts` → falls back to inline Tcl generation
- `optimize_design` → falls back
- `route_design` → has a template
- `read_design` → has a template

When there's no template, `generate_tcl` produces `[⚠ Unverified]` Tcl from hardcoded switch cases. This Tcl may not work for the specific design.

---

## 4. Component Health Assessment

| Component | Status | Notes |
|---|---|---|
| `bin/hipilot` | ✅ Working | Tmux launcher, 50/50 split, status bar, shortcuts |
| Claude Code integration | ⚠️ Fragile | Works when settings.json is correct; MCP connection is the single point of failure |
| EDA MCP Server | ⚠️ Overbuilt | 49 tools (many never tested with real EDA), workflow engine fights Claude |
| Tmux MCP Server | ✅ Working | 8 tools, send-keys fixed |
| Knowledge MCP Server | ✅ Working | 7 tools, skill lookup works |
| Skills (35) | ✅ Good content | Expert workflows, but not executable — Claude must interpret |
| Templates (20) | ✅ Working | Nunjucks rendering works, good coverage for common ops |
| Mode System | ✅ Working | Manual/auto with risk analysis, but workflow engine bypasses it |
| HiTestBot | ⚠️ Untested | Simplified to single mode, needs real EDA server validation |
| Deployment | ✅ Fixed | Self-contained, env preserved |
| Settings.json | ✅ Fixed | Deep-merge preserves API keys |
| Send-keys | ✅ Fixed | Uses -l and C-m consistently |

---

## 5. Recommended Architecture: Claude-Driven Orchestration

Remove the monolithic `workflow.run` from the `/rtl2gds` path. Instead, teach Claude Code to orchestrate the flow stage by stage using the tools and skills that already exist.

### Proposed flow:

```
User types "/rtl2gds"
       │
       ▼
Claude reads the /rtl2gds slash command
       │
       ▼
Claude calls eda.detect_tool → start if needed
       │
       ▼
Claude calls knowledge.get_skill("ibex-rtl2gds-flow") → reads the full workflow
       │
       ▼
For each stage in the skill:
  │
  ├─ Claude calls eda.generate_tcl({intent, operation, tool})
  │     → gets template-based Tcl with [✓ Template] badge
  │
  ├─ Claude calls eda.execute_and_verify({tcl, description, timeout})
  │     → sends to right pane, waits, captures output
  │
  ├─ Claude checks the result:
  │     ├─ Success → qor.snapshot → report to user → next stage
  │     ├─ Warning → analyze, decide to continue or fix
  │     └─ Error → eda.diagnose_error → fix → retry
  │
  └─ Claude reports stage progress to user
       │
       ▼
Claude summarizes final QoR (WNS/TNS/DRC) and outputs
```

### Why this is better:
1. **Claude uses its intelligence** — reads skills, handles errors, adapts
2. **Skills are actually used** — they guide Claude's decisions
3. **Mode system works** — each stage goes through approval if in manual mode
4. **No hardcoded paths** — Claude reads design info from skills/context
5. **Error recovery** — Claude can diagnose and retry, not just stop
6. **QoR-aware** — Claude can skip or modify stages based on metrics
7. **Multi-tool capable** — Claude can switch between Innovus, ICC2, PrimeTime as needed

### What to change:
1. **Rewrite `/rtl2gds` slash command** — instruct Claude to orchestrate stage-by-stage
2. **Keep `workflow.run`** as a utility but don't use it as the primary path
3. **Keep `execute_and_verify`** — it's well-designed for single-stage execution
4. **Keep skills and templates** — they're the knowledge Claude needs

---

## 6. Complexity Assessment: RTL2GDS Across Multiple EDA Tools

Running a complete RTL2GDS flow involves:

| Stage | Tool | Complexity | Template? |
|---|---|---|---|
| Synthesis | Design Compiler | High — not currently in flow | ❌ No |
| Design Init | Innovus or ICC2 | Medium — needs design files | ✅ Yes |
| Floorplan | Innovus or ICC2 | Medium | ⚠️ Inline only |
| Power Planning | Innovus or ICC2 | Medium | ⚠️ Inline only |
| Placement | Innovus or ICC2 | Low (single command) | ⚠️ Inline only |
| CTS | Innovus or ICC2 | High — needs clock definition | ⚠️ Partial |
| Post-CTS Opt | Innovus or ICC2 | Medium | ⚠️ Inline only |
| Routing | Innovus or ICC2 | Medium | ✅ Yes |
| Post-Route Opt | Innovus or ICC2 | Medium | ⚠️ Inline only |
| Chip Finish | Innovus or ICC2 | Low | ✅ Yes |
| Signoff STA | PrimeTime | High — different tool | ❌ Not in flow |
| Signoff DRC | Innovus or Calibre | Medium | ✅ Yes |

**Current scope:** The `/rtl2gds` flow covers stages 2-10 in Innovus only.  
**Missing:** Synthesis (stage 1) and Signoff STA (stage 11) require different tools.  
**Multi-tool gap:** No mechanism for Claude to switch between tools mid-flow.

---

## 7. What Works Today (As-Is)

Even with the architectural issues, these flows work when MCP is connected:

1. **Single-stage operations** — Claude can use `execute_and_verify` for individual Tcl commands
2. **Template-based Tcl generation** — 20 templates produce correct vendor-specific Tcl
3. **Skill browsing** — Claude can read skills and follow them manually
4. **Mode/approval** — Manual mode queues Tcl for human approval
5. **QoR extraction** — Captures timing, area, power metrics from EDA output
6. **Error diagnosis** — `diagnose_error` provides fix suggestions

The system works best when Claude orchestrates individual tool calls. The workflow engine is the weakest link.

---

## 8. Priority Fixes

| Priority | Fix | Impact |
|---|---|---|
| P0 | Rewrite `/rtl2gds` to use Claude-driven orchestration | Enables AI intelligence for the full flow |
| P0 | Validate MCP connection on EDA server | Nothing works without this |
| P1 | Add templates for missing stages (floorplan, placement, CTS, etc.) | Reduces [⚠ Unverified] Tcl |
| P1 | Make rtl2gds workflow parameterizable (design paths as arguments) | Removes Ibex-only limitation |
| P2 | Add multi-tool support (switch between Innovus/ICC2/PT mid-flow) | Enables synthesis + signoff |
| P2 | Improve HiTestBot to test stage-by-stage instead of monolithic flow | Better test coverage |
