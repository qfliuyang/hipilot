# RTL-to-GDS Flow Test Plan

**Goal:** Improve HiPilot skills until Claude Code can autonomously run the complete RTL-to-GDS flow on the Ibex design, like an intern.

**Date Created:** 2026-02-20
**Status:** Skills Created, Ready for Testing

---

## The Ultimate Demo

```
User: "Run RTL to GDS on the Ibex design"

HiPilot executes:
  RTL → Synthesis → Floorplan → Placement → CTS → Routing → Signoff → GDS

Like an intern, HiPilot:
  1. Runs each stage in order
  2. Checks for errors at each step
  3. Reports QoR metrics
  4. Flags issues that need human attention
  5. Proceeds only when stage is successful
```

---

## Test Environment

**EDA Server:**
- Host: 192.168.112.163
- User: EDA
- Password: eda2020
- Workspace: `/home/EDA/hipilot_test/`

**Design:**
- Name: Ibex RISC-V CPU (RV32IMC)
- Technology: Skywater 130nm HD
- Location: `/home/EDA/hipilot_test/ibex_work_upload/`
- Target: 100 MHz

**Tools Available:**
- Synopsys Design Compiler (synthesis)
- Cadence Innovus (place & route)
- Synopsys PrimeTime (STA)
- Mentor Calibre (DRC/LVS)

---

## Current Status

### Skills Created (16 total)

| # | Skill | File | Status |
|---|-------|------|--------|
| 1 | `/rtl2gds-flow` | rtl2gds-flow.md | Created - Master skill |
| 2 | `/synthesis` | synthesis.md | Created - DC/Genus |
| 3 | `/read-design` | read-design.md | Existing - Load design |
| 4 | `/floorplan` | floorplan.md | Created - Die/IO/power |
| 5 | `/cts` | cts.md | Created - Clock tree |
| 6 | `/route-design` | route-design.md | Existing - Signal routing |
| 7 | `/fix-setup-timing` | fix-setup-timing-v2.md | Created - Setup violations |
| 8 | `/fix-hold-timing` | fix-hold-timing.md | Existing - Hold violations |
| 9 | `/report-timing` | report-timing.md | Existing - Timing analysis |
| 10 | `/report-power` | report-power.md | Existing - Power analysis |
| 11 | `/report-area` | report-area.md | Existing - Area analysis |
| 12 | `/run-drc` | run-drc.md | Existing - Design rules |
| 13 | `/lvs-check` | lvs-check.md | Created - LVS verification |
| 14 | `/compare-qor` | compare-qor.md | Existing - QoR comparison |
| 15 | `/save-design` | save-design.md | Existing - Checkpoints |
| 16 | `/fix-setup-timing` | fix-setup-timing.md | Existing - Older version |

### MCP Tools Status

| Tool | Status | Notes |
|------|--------|-------|
| `eda.generate_tcl()` | Working | Generates Tcl from templates |
| `eda.send_to_terminal()` | Working | Sends to tmux pane |
| `eda.get_status()` | Working | Checks tool state |
| `eda.get_risk_analysis()` | Working | Risk categorization |
| `eda.approve_pending()` | Working | Approves commands |
| `eda.extract_qor()` | Partial | Basic metrics only |

### Known Issues

1. **Claude Code prefers Bash over MCP tools**
   - Symptom: Claude uses `tmux send-keys` directly instead of `eda.send_to_terminal()`
   - Impact: Bypasses approval system
   - Workaround: System prompt instructs MCP-first

2. **Skill loading not automatic**
   - Symptom: Claude doesn't automatically load skill context
   - Impact: May not follow skill workflows
   - Workaround: User mentions skill name explicitly

---

## Test Plan Phases

### Phase 1: Single Stage Tests (Each skill individually)

```
Test 1.1: Synthesis
  cd /home/EDA/hipilot_test/ibex_work_upload
  make syn
  Verify: WNS > -10% clock, no elaboration errors

Test 1.2: Design Init
  make data_init
  Verify: Design loads, libraries found

Test 1.3: Floorplan
  make floorplan && make place_io && make power_plan
  Verify: Util 70-75%, power connected

Test 1.4: Placement
  make placement
  Verify: No overlaps, timing improved

Test 1.5: CTS
  make cts
  Verify: Skew < 50ps, latency < 300ps

Test 1.6: Routing
  make routing && make routing_opt
  Verify: 100% routed, no opens

Test 1.7: Signoff
  make run_pt && make drc && make lvs
  Verify: Setup/hold clean, DRC 0, LVS CORRECT
```

### Phase 2: Multi-Stage Flow

```
Test 2.1: Synthesis → Floorplan
Test 2.2: Floorplan → CTS
Test 2.3: CTS → Routing
Test 2.4: Routing → Signoff
```

### Phase 3: Complete Flow

```
Test 3.1: Full RTL-to-GDS
  User: "Run RTL to GDS on Ibex"
  Expected: HiPilot runs all 10 stages autonomously
  Success: GDS generated, timing clean, LVS CORRECT
```

---

## Next Steps

### Immediate (Before Testing)

1. **Upload skills to EDA server**
   ```bash
   sshpass -p 'eda2020' scp -r hipilot/skills/*.md EDA@192.168.112.163:~/hipilot_test/hipilot-v0.2.3/hipilot/skills/
   ```

2. **Verify Ibex design is ready**
   ```bash
   ssh EDA@192.168.112.163 "ls /home/EDA/hipilot_test/ibex_work_upload/Makefile"
   ```

3. **Test MCP server connection**
   - Start Claude Code on EDA server
   - Verify MCP tools are available

### Testing Session

1. **Start tmux workspace**
   ```bash
   # On EDA server
   tmux new-session -s hipilot -x 240 -y 60
   tmux split-window -h
   # Left: Claude Code, Right: Innovus
   ```

2. **Start recording**
   ```bash
   DISPLAY=:0 ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
     -c:v libx264 -preset fast -crf 23 /tmp/rtl2gds_demo.mp4 &
   ```

3. **Run test**
   ```
   # In Claude Code pane:
   "Run synthesis on the Ibex design"
   ```

4. **Verify results**
   - Check WNS/TNS in reports
   - Check for errors in logs
   - Save checkpoints at each stage

### After Testing

1. **Document issues found**
2. **Update skills based on learnings**
3. **Record demo video**
4. **Create blog post/showcase**

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Stages completed | 10/10 | All stages run without manual intervention |
| Timing clean | Setup WNS ≥ 0, Hold WNS ≥ 0 | PrimeTime signoff |
| DRC | 0 violations | Calibre DRC |
| LVS | CORRECT | Calibre LVS |
| Time | < 60 minutes | Wall clock time |

---

## File Locations

```
hipilot-v0.2.3/
├── hipilot/
│   ├── skills/
│   │   ├── rtl2gds-flow.md      # Master skill
│   │   ├── synthesis.md         # NEW
│   │   ├── floorplan.md         # NEW
│   │   ├── cts.md               # NEW
│   │   ├── lvs-check.md         # NEW
│   │   └── ... (other skills)
│   ├── servers/eda/index.js     # MCP server
│   └── .claude/system.md        # System prompt
└── docs/
    └── RTL2GDS_TEST_PLAN.md     # This file
```

---

## Notes for Next Session

1. **Skills are thorough** - Each skill has complete Tcl scripts, success criteria, error handling
2. **Ibex design has Makefile** - All stages are push-button: `make syn`, `make floorplan`, etc.
3. **MCP tools work** - But Claude Code may prefer Bash, needs reminding
4. **Record everything** - Use ffmpeg on display :0

---

## Quick Start Commands

```bash
# Connect to EDA server
sshpass -p 'eda2020' ssh EDA@192.168.112.163

# Set up environment
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
cd /home/EDA/hipilot_test/ibex_work_upload

# Run single stage
make syn

# Run complete flow (from rtl2gds-flow.md)
make syn && make data_init && make floorplan && make place_io && \
make power_plan && make placement && make cts && make post_cts_opt && \
make routing && make routing_opt && make chip_done && \
make run_pt && make drc && make lvs
```

---

**Last Updated:** 2026-02-20
