# HiPilot Test Evidence Reports

## Latest Test Run: 2026-03-08

### Test Summary
- **Command:** `/rtl2gds`
- **Score:** 5.5/6.0 (92%)
- **GPA:** 3.58/4.0 (A-)
- **Status:** PASS

### Layer Scores

| Layer | Score | Detail |
|-------|-------|--------|
| L1 Prompt Delivery | 1.0 | Claude responded to the command |
| L2 Intent Recognition | 1.0 | Claude understood the task (mentions: design, innovus, flow, placement, routing, cts) |
| L3 MCP Tool Usage | 1.0 | MCP tools used (4719 calls: eda.detect_tool, eda.start_tool, knowledge.get_skill), EDA tool active |
| L3b Process Validation | 1.0 | Correct process: synthesis used dc_shell as expected |
| L4 EDA Execution | 1.0 | EDA tool completed successfully |
| L5 QoR Assessment | 0.5 | Claude discussed metrics (timing, pass) but no WNS/TNS numbers |

### Academic Transcript

| Subject | Score | Grade | Weight | Status |
|---------|-------|-------|--------|--------|
| Communication | 100% | A+ | 1x | PASS |
| Methodology | 100% | A+ | 1.5x | PASS |
| Process | 100% | A+ | 2x | PASS |
| Execution | 100% | A+ | 1.5x | PASS |
| Results | 50% | F | 1x | PARTIAL |
| Human-Like | 100% | A+ | 2.5x | PASS |

### Key Achievement

**L3b Process Validation now passes** - The critical fix for `dc_shell` support in `eda.start_tool` is working correctly. Synthesis stage properly uses dc_shell instead of innovus.

### Fix Applied

**File:** `servers/eda/index.js`

1. Added `dc_shell: 'DesignCompiler'` to toolMap (line 2217)
2. Added `dc_shell -no_gui` launch command (lines 2231-2232)
3. Added `dc_shell` to inputSchema enum (line 981)

### Files

- `FLOW_REPORT.md` - Detailed certification report
- `stage_scorecards.json` - Machine-readable score data
- `flow_progress.json` - Flow progress tracking
