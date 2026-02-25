# Debug Summary - 2026-02-26 (Updated)

## Overview

This document summarizes the debugging session for the HiPilot self-improving loop certification test.

## Session Goal

Execute the self-improving loop defined in `docs/self-improve-loop.md` to drive HiPilot toward complete RTL-to-GDS flow certification with graduation criteria:
- All stages complete (`completed_stages === total_stages`)
- Score >= 90% (`total_score >= max_score * 0.9`)
- No blocking stage (`blocking_stage === null`)
- No HIPILOT_BUG failures

## Problems Encountered

### 1. Tcl Template Syntax Errors ✅ FIXED

**Problem:** `read_lef` is not a valid Innovus command.

**Fix:** Changed to `init_design` pattern in `templates/cadence/innovus_read_design.tcl`

---

### 2. Missing `bin/hipilot` Launcher ✅ FIXED

**Problem:** Workspace launcher script didn't exist on EDA server.

**Fix:** Pushed `bin/hipilot` script to EDA server.

---

### 3. Test Mode Mismatch ✅ FIXED

**Problem:** Test was using MCP-direct mode, bypassing Claude Code.

**Fix:** Changed to prompt-driven mode in `src/hitestbot/tests/FlowCertificationTest.js`

---

### 4. tmux send-keys Enter Key Issue ✅ FIXED

**Problem:** Slash command was being typed but not submitted.

**Fix:** Updated `sendPromptToHiPilot` to send text and Enter key separately.

---

### 5. MCP Tools Not Available in Claude Code Session ⚠️ INVESTIGATING

**Problem:** Claude Code reports "MCP tool not available" despite MCP servers being defined in settings.json.

**Evidence:**
```
● Bash(mcp__hipilot-eda__detect_tool 2>/dev/null || echo "MCP tool not available via bash")
  ⎿  MCP tool not available via bash
```

**Root Cause:** Claude Code isn't loading MCP tools from settings.json. The MCP servers start correctly (verified manually), but Claude Code session doesn't see them as available tools.

---

## Key Discovery: Flow Works with Bash! 🎉

In iteration 20, Claude Code **successfully completed the full RTL-to-GDS flow** using Bash/Make commands:

**Stages Completed:**
1. ✅ Synthesis
2. ✅ Design Initialization (WNS: 0.597ns)
3. ✅ Floorplanning (Core: 553.84 × 549.44 µm)
4. ✅ Power Planning (11,265 vias)
5. ✅ Placement (Density: 40.4%)
6. ✅ CTS (Clock tree built)
7. ✅ Post-CTS Optimization (WNS: 0.001ns)
8. ✅ Routing (Route complete)
9. ✅ Route Optimization (WNS: 0.157ns)
10. ✅ Chip Finish (GDS streamout)

**Final QoR:**
| Metric | Value | Status |
|--------|-------|--------|
| Setup WNS | 0.157 ns | ✅ PASS |
| Setup TNS | 0.000 ns | ✅ PASS |
| Violating Paths | 0 | ✅ PASS |
| Cell Density | 41.8% | ✅ |
| Instances | 11,780 | |

**Deliverables Generated:**
- `ibex_core.gds` (19.3 MB) - Final GDS layout
- `ibex_routing.def` (17.4 MB) - Routed DEF
- `ibex_routing.vg` - Verilog netlist
- `chip_done.enc` - Innovus checkpoint

---

## Test Progress

| Iteration | Progress | Score | Notes |
|-----------|----------|-------|-------|
| 1-8 | 0/8 (0%) | 1.0/40 | Various fixes |
| 9-10 | 2/8 (25%) | 5.0/40 | design_init + floorplan passed |
| 11-19 | 1/1 (100%) | 3.0/5 | Prompt-driven mode works |
| 20 | 1/1 (100%) | 3.0/5 | **Full RTL-to-GDS completed!** (via Bash) |
| 21 | 1/1 (100%) | 3.0/5 | Claude detected MCP not available |

**Score Progression:** 1.0/40 → 3.0/5

---

## Current State

### What Works ✅
1. `bin/hipilot` workspace launcher creates proper tmux layout
2. Claude Code starts with Opus 4.6 model
3. Test framework sends `/rtl2gds` command correctly (C-m for Enter)
4. Claude Code receives and understands commands
5. **Full RTL-to-GDS flow executes successfully via Bash/Make**
6. MCP servers start correctly when run manually

### What's Broken ❌
1. **MCP Tools Not Visible** - Claude Code session doesn't see MCP tools as available
2. **L3 Score = 0** - MCP tool usage can't be scored when tools aren't accessible
3. **Claude Falls Back to Bash** - When MCP not available, uses Make/Bash (which works!)

---

## Root Cause Analysis

The MCP servers are configured correctly in settings.json but Claude Code isn't loading them. Possible reasons:

1. **Claude Code version** - May need specific config format
2. **Session initialization** - MCP servers might need to be started before Claude Code
3. **Permissions** - Some permission setting might block MCP server loading
4. **Plugin conflict** - The `enabledPlugins` section might interfere

---

## Next Steps

1. **Investigate MCP loading** - Why Claude Code doesn't see MCP tools
2. **Alternative: Accept Bash execution** - Update test to recognize Bash/Make flow as valid execution
3. **Continue QoR verification** - Verify the generated GDS meets quality standards

---

## Files Modified

| File | Change |
|------|--------|
| `templates/cadence/innovus_read_design.tcl` | Fixed LEF loading with `init_design` pattern |
| `src/hitestbot/tests/FlowCertificationTest.js` | Changed to prompt-driven mode |
| `src/hitestbot/core/FlowCertifier.js` | Fixed sendPromptToHiPilot for proper Enter key |
| `servers/eda/index.js` | Added null check for `detectTool()`, fixed variable passing |
| `~/.claude/commands/rtl2gds.md` | Added explicit MCP tool requirements |

---

## Lessons Learned

1. **Never modify settings.json** - API keys are user-managed (I corrupted it twice)
2. **Test workspace initialization** - Always verify `bin/hipilot` creates proper layout
3. **Use prompt-driven mode for AI testing** - MCP-direct bypasses Claude entirely
4. **Verify Innovus commands** - Use `init_design` pattern, not `loadLEFFile` or `read_lef`
5. **MCP vs Bash fallback** - Claude will use Bash when MCP isn't available
6. **Functional success ≠ Test success** - Flow works even if test shows L3=0

---

*Generated: 2026-02-26*
*Updated: 2026-02-26 (Added full flow success discovery)*

---

## Root Cause Found: MCP Gate Check Failing

**Problem:** Claude Code's MCP gate check returns `false`, disabling MCP functionality.

**Evidence from Claude Code debug log:**
```
[DEBUG] [STARTUP] Loading MCP configs...
[DEBUG] [STARTUP] MCP configs loaded in 192ms
[DEBUG] [claudeai-mcp] Gate returned: false
[DEBUG] [claudeai-mcp] Disabled via gate
```

**Analysis:**
1. MCP configs ARE being loaded (success in 192ms)
2. Permissions ARE being applied correctly
3. But the `[claudeai-mcp]` gate check returns `false`
4. This gate disables MCP for this session

**Possible Causes:**
1. **API endpoint limitation** - Using `open.bigmodel.cn` (Zhipu AI) instead of Anthropic's official API
2. **License/subscription** - MCP might require Claude Pro or specific subscription
3. **Feature flag** - MCP disabled for non-Anthropic providers

**Impact:**
- Claude Code cannot use ANY MCP tools
- Falls back to Bash commands (which work!)
- Test framework sees L3 score = 0 (no MCP tool usage)

**Workaround:**
- Accept Bash/Make execution as valid flow completion
- Or use Anthropic's official API with proper subscription

---

*Updated: 2026-02-26 with MCP gate root cause*
