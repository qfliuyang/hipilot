# HiPilot Critical Fixes Summary

## Date: 2026-03-10

---

## 1. EDA Pane Architecture Constraint (FUNDAMENTAL)

### Problem
The EDA pane is a bash terminal, but this wasn't clearly understood. Once an EDA tool (innovus, dc_shell) is started, you enter that tool's Tcl shell. **You cannot run another EDA tool from within an EDA tool.**

### Errors Observed
- `dc_shell` being invoked from within innovus → "dc_shell: command not found"
- Tools nested inside each other causing crashes

### Root Cause
The Tcl code in skills was trying to invoke `dc_shell` as a command while innovus was already running.

### Fixes Applied

#### a) `/rtl2gds` Slash Command (`deploy/eda-server/.claude/commands/rtl2gds.md`)
- **Changed**: Removed premature `eda.start_tool({tool: "innovus"})` call
- **Reason**: Stage 0 requires dc_shell, not innovus
- **Now**: Instructs to read skill first, then start correct tool per stage

#### b) HiPilot Identity (`deploy/eda-server/CLAUDE.md`)
- **Added**: "EDA Pane Architecture (CRITICAL)" section
- **Documents**:
  - EDA pane is bash terminal
  - Tool switching requires: exit → bash → start new tool
  - Cannot nest EDA tools

#### c) Skill File (`skills/ibex-rtl2gds-flow.md`)
- **Added**: "🔴 CRITICAL: EDA Pane Architecture" warning box
- **Documents**: Tool execution hierarchy and constraints

#### d) Memory (`memory/MEMORY.md`)
- **Added**: Detailed "EDA Pane Architecture (FUNDAMENTAL)" section
- **Documents**: State transitions, common mistakes

---

## 2. Clean Design Directory Isolation

### Problem
All tests were running in `/home/EDA/ibex_work_upload`, causing:
- Test contamination between runs
- Old synthesis results affecting new runs
- File permission conflicts

### Errors Observed
- "Error: Can't open export file" (directory doesn't exist in clean design)
- Tests failing due to stale checkpoint files

### Fixes Applied

#### a) FlowCertifier.js (`src/hitestbot/core/FlowCertifier.js`)
- **Added**: `cleanDesignDir` parameter to `launchHiPilot()`
- **Sets**: `HIPILOT_DESIGN_DIR` environment variable
- **Effect**: Each test uses isolated design directory

#### b) MCP Server (`servers/eda/index.js`)
- **Changed**: Hardcoded paths to use `process.env.HIPILOT_DESIGN_DIR`
- **Location**: rtl2gds workflow definition
- **Effect**: Respects clean design directory

#### c) Skill File (`skills/ibex-rtl2gds-flow.md`)
- **Changed**: All hardcoded `/home/EDA/ibex_work_upload` paths
- **To**: `$design_dir` variable with env var fallback
- **Added**: `set design_dir` command to all Stage Tcl blocks

---

## 3. Process Validation (Tool Per Stage)

### Problem
HiTestBot was scoring 0.0 on L3b (Process Validation) because it detected innovus being used for synthesis instead of dc_shell.

### Fixes Applied

#### a) MCP Log Analysis (`src/hitestbot/core/FlowCertifier.js`)
- **Changed**: `_scoreProcessValidation()` to read MCP log
- **Now**: Detects actual tool usage from `eda.start_tool` calls
- **Fixed**: Tool name parsing (`eda.switch_tool` vs `switch_tool`)

#### b) `/rtl2gds` Command
- **Fixed**: No longer starts innovus before Stage 0
- **Now**: Stage 0 correctly starts dc_shell first

---

## 4. Batch Executor Warning

### Problem
HiPilot was calling `rtl2gds.run_full_flow` which is a batch executor that bypasses intelligence.

### Fixes Applied

#### a) Skill File (`skills/ibex-rtl2gds-flow.md`)
- **Added**: "🚫 CRITICAL: NEVER USE BATCH EXECUTOR" at top
- **Documents**: Must use manual stage-by-stage orchestration

#### b) Batch Alternative Section
- **Added**: Warning that batch mode is NOT RECOMMENDED
- **Documents**: Must run Stage 0 before Stages 1-9

---

## Files Modified

1. `deploy/eda-server/.claude/commands/rtl2gds.md` - Fixed tool startup order
2. `deploy/eda-server/CLAUDE.md` - Added EDA pane architecture docs
3. `servers/eda/index.js` - Fixed hardcoded paths
4. `skills/ibex-rtl2gds-flow.md` - Added env var support, warnings
5. `src/hitestbot/core/FlowCertifier.js` - Added clean design dir support
6. `memory/MEMORY.md` - Added architecture documentation

---

## Testing Status

- Testing active - last run achieved 5.0/6.0 score with 100% Human-Like behavior
- EDA server is operational and tests are running successfully
- Latest achievement: 5.0/6.0 (83%) with GPA 3.37/4.0, 100% Human-Like (improved from 30%)

---

## 5. Bug Fix: Tcl Fallback Path

### Problem
The fallback for `HIPILOT_DESIGN_DIR` in Tcl blocks used `"$design_dir"` which references itself, causing errors when the env var is not set.

### Fix Applied
Changed from:
```tcl
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "$design_dir"}]
```
To:
```tcl
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
```

Applied to all 10 stage Tcl blocks in the skill file.

---

## Next Steps

1. Achieve 6.0/6.0 perfect score - address remaining L4 failure (LEF file loading in Innovus)
2. Investigate PDK/environment configuration to resolve L4 EDA error
3. Continue refining LittleBrain knowledge-based orchestration for improved QoR extraction
4. Maintain 100% Human-Like behavior while improving technical score
5. Document best practices from 5.0/6.0 achievement for future runs
