# HiPilot Project Status

**Last Updated:** 2026-02-21

## Current Status: Visual Demonstration Complete

The HiPilot project has successfully completed the visual demonstration test, capturing a 21-minute recording showing multi-tool orchestration.

---

## Completed Work

### 1. RTL-to-GDS Test Plan (Iterations 1-10)

All 10 test iterations completed successfully:
- Synthesis with Design Compiler
- Design initialization in Innovus
- Floorplanning, placement, CTS, routing
- PrimeTime STA
- Physical verification (DRC/LVS)

**Key improvements made to skills:**
- Added Design Compiler PATH setup instructions
- Added Innovus v20.10 syntax compatibility
- Added timing library prerequisite documentation
- Added PrimeTime STA section with .db requirements
- Created new `design-init.md` skill for proper MMMC setup

### 2. Visual Demonstration (Iteration 11)

**Recording:** `hipilot/recordings/hipilot_demo_20260220_232127.mp4`
- Size: 25 MB
- Duration: 21 minutes
- Format: H.264 MP4

**Demonstrated capabilities:**
- Tmux workspace with 50/50 split layout
- Claude Code generating Tcl scripts
- Multi-tool orchestration (Innovus → PrimeTime)
- AI + EDA tool feedback loop (debug → fix → re-run)

---

## Skills Updated

| Skill | Changes |
|-------|---------|
| `synthesis.md` | Added PATH setup, troubleshooting section |
| `floorplan.md` | Added Innovus v20.10 syntax |
| `cts.md` | Added timing library prerequisites |
| `report-timing.md` | Added PrimeTime STA section |
| `rtl2gds-flow.md` | Added physical-only mode documentation |
| `design-init.md` | NEW - Proper Innovus initialization with MMMC |

---

## Key Learnings

### Innovus v20.10
- `floorPlan -site unithd -r 1.0 0.7 5 5 5 5` (aspectRatio, rowDensity, margins)
- Site names from LEF: `unithd`, `unithddbl` (not `core`)
- `dbget top.fPlan.dieRect` (not `dieBox`)

### PrimeTime
- Requires `.db` libraries (not `.lib`)
- SDC should not contain `current_design` command
- Use `get_ports -filter` instead of `all_inputs -no_clock`

### Physical-Only Mode
- Occurs when design initialized without timing libraries
- CTS cannot be performed
- Timing analysis shows "No constrained timing paths"
- Solution: Initialize with MMMC setup (see `design-init.md`)

---

## File Locations

| Item | Location |
|------|----------|
| Test Plan | `docs/RTL2GDS_TEST_PLAN.md` |
| Recording | `hipilot/recordings/hipilot_demo_20260220_232127.mp4` |
| PRD | `.omc/plans/prd-visual-demo-iteration11.md` |
| Skills | `hipilot/skills/*.md` |

---

## Next Steps

1. **Create highlight clips** - Extract 2-3 minute highlights from the 21-minute recording
2. **Update skills** - Incorporate v20.10 learnings into existing skills
3. **Run full flow** - Execute complete RTL-to-GDS with timing closure
4. **Document API** - Create skill API documentation for users

---

## Environment

| Item | Value |
|------|-------|
| EDA Server | 192.168.112.163 |
| User | EDA / eda2020 |
| Workspace | `/home/EDA/hipilot_test/` |
| Design | Ibex RISC-V CPU |
| Technology | Skywater 130nm HD |
| Target | 100 MHz |
