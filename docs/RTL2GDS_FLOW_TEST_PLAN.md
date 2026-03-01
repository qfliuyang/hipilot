# HiPilot RTL2GDS Flow Execution Test Plan

> **Goal**: Launch EDA tools and complete the full RTL-to-GDS flow on the Ibex design
> **Test Strategy**: End-to-end flow execution with stage-by-stage verification

---

## Test Philosophy

1. **Goal-Driven**: Single objective - complete RTL2GDS flow from start to finish
2. **Stage Gates**: Each stage must pass before proceeding to the next
3. **Evidence-Based**: Screenshots, logs, and QoR metrics at each stage
4. **Auto-Execution**: Commands execute immediately (approval system removed)
5. **Black-Box Testing**: HiTestBot uses HiPilot exactly as a human would

---

## Test Overview

### Target Flow

```
RTL → Synthesis → Design Init → Floorplan → Power Plan → Placement → CTS → Post-CTS Opt → Routing → Chip Finish → GDS
```

### Test Design

| Attribute | Value |
|-----------|-------|
| **Design** | Ibex RISC-V CPU (lowRISC) |
| **Technology** | Skywater 130nm HD |
| **Complexity** | ~7,000 cells |
| **Target Clock** | 100 MHz |
| **Source** | `/home/EDA/ibex_work_upload/` |
| **Expected Duration** | 45-60 minutes |

### Success Criteria (Flow Completion)

| Stage | Success Indicator |
|-------|-------------------|
| Synthesis | Netlist generated, WNS reported |
| Design Init | Innovus loads without errors |
| Floorplan | Core utilization 60-80% |
| Power Plan | VDD/VSS connectivity verified |
| Placement | WNS improved, congestion < 5% |
| CTS | Clock skew < 10% of clock period |
| Post-CTS Opt | Setup WNS ≥ 0 or within 5% |
| Routing | 100% routed, DRC = 0 |
| Chip Finish | GDS file generated |
| **Final** | GDS exists, timing reports generated |

---

## Pre-Test Setup

### 1. Environment Isolation

```bash
# Generate unique test ID
export TEST_ID="rtl2gds_$(date +%Y%m%d_%H%M%S)"
export TEST_WORK_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}"
export TEST_EVIDENCE_DIR="/tmp/hipilot-test-evidence/${TEST_ID}"

# Create isolated directories
mkdir -p "${TEST_WORK_DIR}"/design "${TEST_EVIDENCE_DIR}"

# Copy design
cp -r /home/EDA/ibex_work_upload "${TEST_WORK_DIR}"/design/ibex
```

### 2. Process Cleanup

```bash
# Kill all stale processes
pkill -9 -f "innovus|icc2_shell|pt_shell|dc_shell|claude|ffmpeg" 2>/dev/null || true
tmux -L hipilot kill-server 2>/dev/null || true
sleep 2

# Verify clean state
ps aux | grep -E "(innovus|icc2_shell|pt_shell|claude|ffmpeg)" | grep -v grep
# Should return NOTHING
```

### 3. Deploy HiPilot

```bash
node src/hitestbot/infra/deploy_hipilot.js \
  --destination "${TEST_WORK_DIR}/hipilot" \
  --test-id "${TEST_ID}"
```

---

## Test Execution: The 10 Stages

### Command to Test

```
/rtl2gds
```

HiTestBot types this command in the left pane and observes Claude Code executing the full flow.

---

## Stage 1: Synthesis (Design Compiler)

**Goal**: RTL → Gate-level netlist

### What HiTestBot Observes

1. **Left Pane**: Claude Code receives `/rtl2gds` command
2. **Right Pane**: `dc_shell` launches (if synthesis needed)
3. **Activity**: Synthesis runs, generates netlist

### Verification Points

| Check | Method |
|-------|--------|
| dc_shell launches | Right pane shows `dc_shell>` prompt |
| Synthesis completes | Log shows "Compilation completed" |
| Netlist exists | `result/syn/data/ibex_core.syn.v` exists |
| QoR reported | Left pane shows WNS, area, cell count |

### Success Criteria

- [ ] Synthesis completes without fatal errors
- [ ] Netlist file generated
- [ ] WNS reported in left pane
- [ ] Area within reasonable bounds (~45k um²)

### Evidence Required

- Screenshot: dc_shell running in right pane
- Screenshot: QoR reported in left pane
- Log: `result/syn/log/synthesis.log`

---

## Stage 2: Design Initialization (Innovus)

**Goal**: Load netlist, LEF, MMMC into Innovus

### What HiTestBot Observes

1. **Left Pane**: Claude starts Innovus
2. **Right Pane**: Innovus loads, shows `innovus 1>` prompt
3. **Activity**: Design initialization commands execute

### Verification Points

| Check | Method |
|-------|--------|
| Innovus launches | Right pane shows `innovus 1>` prompt |
| LEF loads | No "missing LEF" errors |
| MMMC setup | Timing views created |
| Design initialized | `init_design` completes |

### Success Criteria

- [ ] Innovus prompt appears in right pane
- [ ] No missing library errors
- [ ] Design loads successfully
- [ ] Initial timing report generated

### Evidence Required

- Screenshot: Innovus prompt visible
- Screenshot: Initialization complete message
- Log: `result/pr/log/init_design.log`

---

## Stage 3: Floorplan

**Goal**: Define die area, place IO pins

### What HiTestBot Observes

1. **Right Pane**: Floorplan commands execute
2. **Activity**: `createFloorplan`, `place_io` commands

### Verification Points

| Check | Method |
|-------|--------|
| Floorplan created | `createFloorplan` completes |
| IO placed | `place_io` completes |
| Utilization reported | Left pane shows utilization % |

### Success Criteria

- [ ] Floorplan completes without errors
- [ ] Core utilization 60-80%
- [ ] IO pins placed

### Evidence Required

- Screenshot: Floorplan commands executed
- Screenshot: Utilization report

---

## Stage 4: Power Planning

**Goal**: Create VDD/VSS power grid

### What HiTestBot Observes

1. **Right Pane**: Power planning commands execute
2. **Activity**: `addRing`, `addStripe` commands

### Verification Points

| Check | Method |
|-------|--------|
| Power rings added | `addRing` completes |
| Power stripes added | `addStripe` completes |
| Connectivity verified | `verifyConnectivity` passes |

### Success Criteria

- [ ] Power grid created
- [ ] No connectivity errors
- [ ] VDD/VSS properly routed

### Evidence Required

- Screenshot: Power planning complete

---

## Stage 5: Placement

**Goal**: Place standard cells

### What HiTestBot Observes

1. **Right Pane**: `place_opt_design` runs
2. **Activity**: Placement optimization (may take 5-10 minutes)
3. **Left Pane**: Progress updates from Claude

### Verification Points

| Check | Method |
|-------|--------|
| Placement starts | `place_opt_design` begins |
| Placement completes | Command finishes, prompt returns |
| Timing reported | WNS/TNS in left pane |
| Congestion acceptable | < 5% global congestion |

### Success Criteria

- [ ] Placement completes successfully
- [ ] WNS improved from synthesis
- [ ] No major congestion issues
- [ ] All cells legally placed

### Evidence Required

- Screenshot: Placement running
- Screenshot: Placement complete with QoR
- Log: `result/pr/report/placement_timing/`

---

## Stage 6: Clock Tree Synthesis (CTS)

**Goal**: Build balanced clock tree

### What HiTestBot Observes

1. **Right Pane**: `ccopt_design` runs
2. **Activity**: Clock tree synthesis and optimization

### Verification Points

| Check | Method |
|-------|--------|
| CTS starts | `create_ccopt_clock_tree_spec` runs |
| CTS completes | `ccopt_design` finishes |
| Skew reported | Clock skew < 10% of clock period |
| Latency reasonable | Clock latency < 500ps |

### Success Criteria

- [ ] CTS completes without errors
- [ ] Clock skew within target
- [ ] Clock tree balanced

### Evidence Required

- Screenshot: CTS running
- Screenshot: Clock skew report
- Log: `result/pr/report/cts_timing/`

---

## Stage 7: Post-CTS Optimization

**Goal**: Fix timing with propagated clocks

### What HiTestBot Observes

1. **Right Pane**: Optimization commands run
2. **Activity**: Setup/hold fixing

### Verification Criteria

| Check | Method |
|-------|--------|
| Optimization runs | `optDesign` commands execute |
| Setup WNS ≥ 0 or close | Timing report in left pane |
| Hold violations noted | Hold WNS reported |

### Success Criteria

- [ ] Post-CTS opt completes
- [ ] Setup WNS ≥ 0 or within 5% of clock period
- [ ] Hold violations identified (may be fixed in routing)

### Evidence Required

- Screenshot: Post-CTS timing report

---

## Stage 8: Routing

**Goal**: Route all signal nets

### What HiTestBot Observes

1. **Right Pane**: `routeDesign` runs (longest stage, ~15 min)
2. **Activity**: Global routing → Detail routing
3. **Left Pane**: Progress updates

### Verification Points

| Check | Method |
|-------|--------|
| Routing starts | `routeDesign` begins |
| Global routing | Progress messages |
| Detail routing | Via insertion, DRC fixing |
| 100% routed | `report_route_status` shows 0 unrouted |

### Success Criteria

- [ ] All nets routed (100%)
- [ ] DRC violations = 0 or minimal
- [ ] Timing still clean

### Evidence Required

- Screenshot: Routing in progress
- Screenshot: Route status report (100% routed)
- Log: `result/pr/report/routing_timing/`

---

## Stage 9: Chip Finalization

**Goal**: Generate final outputs (GDS, netlist, SDF)

### What HiTestBot Observes

1. **Right Pane**: Chip finish commands execute
2. **Activity**: GDS generation, netlist export

### Verification Points

| Check | Method |
|-------|--------|
| GDS generated | `streamOut` completes |
| Netlist exported | Verilog netlist written |
| SDF generated | SDF file created |

### Success Criteria

- [ ] GDS file exists: `result/pr/gds/ibex.gds`
- [ ] Netlist exists: `result/pr/netlist/ibex.v`
- [ ] SDF exists: `result/pr/sdf/ibex.sdf`

### Evidence Required

- Screenshot: Chip finish complete
- File listing: GDS and netlist files

---

## Stage 10: Signoff (Optional but Recommended)

**Goal**: PrimeTime STA, DRC, LVS

### What HiTestBot Observes

1. **Right Pane**: PrimeTime launches (if included)
2. **Activity**: Static timing analysis

### Verification Points

| Check | Method |
|-------|--------|
| PrimeTime runs | `pt_shell>` prompt appears |
| STA complete | Setup/hold reports generated |
| DRC run (if Calibre) | DRC report generated |

### Success Criteria

- [ ] PrimeTime STA completes
- [ ] Final timing clean (Setup WNS ≥ 0, Hold WNS ≥ 0)
- [ ] DRC = 0 (if run)

### Evidence Required

- Screenshot: PrimeTime results
- Screenshot: Final timing report

---

## Test Completion Criteria

### PASS Criteria

All required stages (1-9) complete successfully:

| Stage | Required | Pass Criteria |
|-------|----------|---------------|
| 1. Synthesis | ✓ | Netlist generated |
| 2. Design Init | ✓ | Innovus loads, no errors |
| 3. Floorplan | ✓ | Completed |
| 4. Power Plan | ✓ | Completed |
| 5. Placement | ✓ | Completed, timing reported |
| 6. CTS | ✓ | Completed, skew reported |
| 7. Post-CTS Opt | ✓ | Completed |
| 8. Routing | ✓ | 100% routed |
| 9. Chip Finish | ✓ | GDS generated |
| 10. Signoff | Optional | STA clean |

### Scoring (L1-L5)

| Level | Criteria | Weight |
|-------|----------|--------|
| **L1** | Claude responds to `/rtl2gds` | 1.0 |
| **L2** | Claude understands RTL2GDS intent, mentions stages | 1.0 |
| **L3** | Claude uses MCP tools (`eda.*`, `knowledge.*`) | 1.0 |
| **L4** | EDA tools launch and execute stages | 2.0 |
| **L5** | QoR reported (WNS/TNS at each stage) | 1.0 |

**Maximum Score**: 6.0

**Graduation**: Score ≥ 5.0 and all required stages complete

---

## Evidence Collection

### Required Evidence

For each stage, collect:

1. **Screenshot** - Both panes showing stage execution
2. **Pane logs** - Full scrollback from both panes
3. **QoR snapshot** - Timing/area metrics
4. **EDA logs** - Tool-specific log files

### Evidence Directory Structure

```
test-evidence/${TEST_ID}/
├── test_metadata.json           # Test configuration
├── FLOW_REPORT.md               # L1-L5 scores
├── video.mp4                    # Full desktop recording
├── screenshots/
│   ├── 00_launch.png
│   ├── 01_synthesis.png
│   ├── 02_init_design.png
│   ├── 03_floorplan.png
│   ├── 04_power_plan.png
│   ├── 05_placement.png
│   ├── 06_cts.png
│   ├── 07_post_cts.png
│   ├── 08_routing.png
│   ├── 09_chip_finish.png
│   └── 10_final_gds.png
├── pane_logs/
│   ├── claude_pane.log
│   └── eda_pane.log
├── mcp_calls.jsonl
├── timeline.jsonl
└── outputs/                     # Copied from design directory
    ├── synthesis.rpt
    ├── placement.rpt
    ├── final_gds/
    │   └── ibex.gds
    └── timing/
        └── final_timing.rpt
```

---

## Running the Test

### Single Command Execution

```bash
# Run complete RTL2GDS flow test
bin/hitestbot-eda \
  --test-id "rtl2gds_$(date +%Y%m%d_%H%M%S)" \
  --command "/rtl2gds" \
  --design "/home/EDA/ibex_work_upload" \
  --timeout 3600 \
  --evidence-dir "test-evidence"
```

### Step-by-Step Execution

```bash
# 1. Setup
export TEST_ID="rtl2gds_$(date +%Y%m%d_%H%M%S)"

# 2. Clean and deploy
ssh EDA@192.168.112.163 "
  pkill -9 -f 'innovus|dc_shell|claude' 2>/dev/null || true
  tmux -L hipilot kill-server 2>/dev/null || true
  mkdir -p /home/EDA/hipilot_test/runs/${TEST_ID}
  cp -r /home/EDA/ibex_work_upload /home/EDA/hipilot_test/runs/${TEST_ID}/design/ibex
"

# 3. Deploy
node src/hitestbot/infra/deploy_hipilot.js \
  --destination "/home/EDA/hipilot_test/runs/${TEST_ID}/hipilot" \
  --test-id "${TEST_ID}"

# 4. Run test
HIPILOT_SESSION="${TEST_ID}" \
HIPILOT_WORK_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}" \
  bin/hitestbot-eda \
    --command "/rtl2gds" \
    --max-wait 3600

# 5. Pull evidence
bin/hitestbot-pull --test-id "${TEST_ID}"

# 6. Verify
ls -la test-evidence/${TEST_ID}/
cat test-evidence/${TEST_ID}/FLOW_REPORT.md
```

---

## Expected Results

### Typical Flow Timeline

| Stage | Duration | Key Output |
|-------|----------|------------|
| Synthesis | 5 min | WNS: -0.15ns, Area: 45k um² |
| Design Init | 2 min | Innovus loaded |
| Floorplan | 2 min | Util: 72% |
| Power Plan | 2 min | Power grid complete |
| Placement | 8 min | WNS: -0.08ns |
| CTS | 3 min | Skew: 35ps |
| Post-CTS Opt | 5 min | WNS: +0.02ns |
| Routing | 15 min | 100% routed |
| Chip Finish | 5 min | GDS generated |
| **Total** | **~45 min** | **Ready for tapeout** |

### Final Deliverables

Upon successful completion:

1. **GDS file**: `result/pr/gds/ibex.gds`
2. **Netlist**: `result/pr/netlist/ibex.v`
3. **SDF**: `result/pr/sdf/ibex.sdf`
4. **Timing reports**: `result/*/report/*.rpt`
5. **Final QoR**: WNS ≥ 0, TNS = 0, DRC = 0

---

## Troubleshooting Common Issues

### Issue: Synthesis Fails

**Symptoms**: dc_shell errors, no netlist generated
**Diagnosis**: Check RTL syntax, constraint file
**Fix**: Review `result/syn/log/synthesis.log`

### Issue: Innovus Won't Start

**Symptoms**: No `innovus 1>` prompt
**Diagnosis**: Check license, library paths
**Fix**: Verify `innovus_setup.sh` sourced

### Issue: Physical-Only Mode

**Symptoms**: "No constrained timing paths", CTS fails
**Diagnosis**: Missing timing libraries during init
**Fix**: Ensure MMMC setup with Liberty files

### Issue: Routing Congestion

**Symptoms**: High congestion, routing fails
**Diagnosis**: Check utilization, floorplan
**Fix**: Increase die size, adjust placement

### Issue: Timing Not Met

**Symptoms**: Negative WNS after optimization
**Diagnosis**: Check constraint feasibility
**Fix**: May need constraint relaxation

---

## Test Report Template

Upon completion, generate:

```markdown
# RTL2GDS Flow Test Report

**Test ID**: rtl2gds_20260227_143022
**Date**: 2026-02-27
**Duration**: 47 minutes
**Result**: PASS

## Stage Summary

| Stage | Status | Duration | Notes |
|-------|--------|----------|-------|
| Synthesis | ✓ PASS | 5:23 | WNS: -0.12ns |
| Design Init | ✓ PASS | 1:45 | No errors |
| Floorplan | ✓ PASS | 2:10 | Util: 71% |
| Power Plan | ✓ PASS | 1:55 | Clean |
| Placement | ✓ PASS | 8:34 | WNS: -0.07ns |
| CTS | ✓ PASS | 3:12 | Skew: 38ps |
| Post-CTS Opt | ✓ PASS | 4:48 | WNS: +0.01ns |
| Routing | ✓ PASS | 14:22 | 100% routed |
| Chip Finish | ✓ PASS | 4:56 | GDS generated |

## QoR Summary

| Metric | Value |
|--------|-------|
| Final WNS | +0.01ns |
| Final TNS | 0 |
| Cell Count | 6,847 |
| Die Area | 500x500 um |
| DRC Violations | 0 |

## L1-L5 Scores

- L1 (Response): 1.0/1.0
- L2 (Understanding): 1.0/1.0
- L3 (MCP Usage): 1.0/1.0
- L4 (EDA Execution): 2.0/2.0
- L5 (QoR Report): 1.0/1.0

**Total**: 6.0/6.0

## Artifacts

- GDS: `result/pr/gds/ibex.gds` (2.3 MB)
- Netlist: `result/pr/netlist/ibex.v` (1.8 MB)
- Video: `video.mp4` (45 min)

## Conclusion

RTL2GDS flow completed successfully. Design ready for tapeout.
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial revision - focused on RTL2GDS flow execution |

---

*Document Version: 1.0*
*Target: Launch EDA tools and complete RTL2GDS flow*
