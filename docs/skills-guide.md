# HiPilot Skills Guide

**Complete Reference for All 35 Skills**

---

## Overview

HiPilot includes 35 built-in skills covering the complete RTL-to-GDS physical design flow. Each skill is a Markdown file with YAML frontmatter that defines triggers, tools, and QoR metrics.

---

## Skill Categories

| Category | Count | Description |
|----------|-------|-------------|
| **RTL-to-GDS Flow** | 12 | Complete physical design flow |
| **Timing Analysis** | 5 | Timing reports and fixes |
| **Design Management** | 5 | Checkpoints, loading, saving |
| **DRC/LVS** | 3 | Physical verification |
| **Analysis** | 4 | QoR comparison, debugging |
| **Utilities** | 6 | Progress tracking, recovery |

---

## RTL-to-GDS Flow Skills

### 1. synthesis

**File:** `skills/synthesis.md`

**Triggers:** "run synthesis", "synthesize", "compile", "elaborate design"

**Tools:** dc_shell, dc_shell-topo, genus

**Description:** RTL synthesis with Design Compiler or Genus. Covers library setup, constraint application, optimization strategies, and timing/area QoR analysis.

**Key Commands:**
```tcl
analyze -format verilog [glob rtl/*.v]
elaborate $DESIGN_NAME
compile_ultra
write -format verilog -hierarchy -output netlist/${DESIGN_NAME}.v
```

---

### 2. design-init

**File:** `skills/design-init.md`

**Triggers:** "init design", "load design", "initialize innovus"

**Tools:** innovus, icc2_shell

**Description:** Initialize design in P&R tool with netlist, LEF, and constraints.

**Key Commands:**
```tcl
set init_verilog result/syn/data/design.syn.v
set init_lef_file {tech.lef cells.lef}
init_design
```

---

### 3. floorplan

**File:** `skills/floorplan.md`

**Triggers:** "floorplan", "create floorplan", "place io", "die area"

**Tools:** innovus, icc2_shell

**Description:** Die/core area definition, IO placement, macro placement, power grid creation.

**Key Commands:**
```tcl
floorPlan -site unithd -r 1.0 0.70 10 10 10 10
loadIoFile io/constraints.io
addRing -nets {VDD VSS} ...
```

---

### 4. power-planning

**File:** `skills/power-planning.md`

**Triggers:** "power plan", "power grid", "add stripes", "sroute"

**Tools:** innovus, icc2_shell

**Description:** Power grid creation including global net connections, rings, stripes, and rail routing.

**Key Commands:**
```tcl
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
addStripe -nets {VSS VDD} -layer met4 -direction vertical
sroute -connect {corePin} -nets {VDD VSS}
```

---

### 5. placement

**File:** `skills/placement.md`

**Triggers:** "place cells", "run placement", "place_opt_design"

**Tools:** innovus, icc2_shell

**Description:** Standard cell placement with timing-driven optimization and congestion analysis.

**Key Commands:**
```tcl
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
place_opt_design
```

---

### 6. cts (Clock Tree Synthesis)

**File:** `skills/cts.md`

**Triggers:** "cts", "clock tree", "run ccopt", "build clock tree"

**Tools:** innovus, icc2_shell

**Description:** Clock tree synthesis with buffer selection, skew optimization, and timing analysis.

**Key Commands:**
```tcl
set_ccopt_property use_inverters true
create_ccopt_clock_tree_spec -file clk.spec
ccopt_design -cts
```

---

### 7. post-cts-opt

**File:** `skills/post-cts-opt.md`

**Triggers:** "post cts optimization", "optDesign postCTS", "fix setup hold"

**Tools:** innovus, icc2_shell

**Description:** Post-CTS optimization for setup and hold timing after clock propagation.

**Key Commands:**
```tcl
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold
```

---

### 8. route-design

**File:** `skills/route-design.md`

**Triggers:** "route design", "run routing", "nanoRoute"

**Tools:** innovus, icc2_shell

**Description:** Global and detail routing with timing-driven optimization.

**Key Commands:**
```tcl
setNanoRouteMode -routeWithTimingDriven true
routeDesign -globalDetail
```

---

### 9. routing-opt

**File:** `skills/routing-opt.md`

**Triggers:** "post route optimization", "optDesign postRoute"

**Tools:** innovus, icc2_shell

**Description:** Post-routing optimization for timing and DRC fixing.

**Key Commands:**
```tcl
setOptMode -fixDrc true -usefulSkew true
optDesign -postRoute -setup
optDesign -postRoute -hold
```

---

### 10. chip-finish

**File:** `skills/chip-finish.md`

**Triggers:** "chip finish", "export gds", "output def", "save netlist"

**Tools:** innovus, icc2_shell

**Description:** Final chip finishing and output generation (DEF, GDS, netlists).

**Key Commands:**
```tcl
defOut -floorplan -netlist -routing design.def
saveNetlist design.vg
streamOut design.gds -mapFile gds.map
```

---

### 11. sta (PrimeTime)

**File:** `skills/sta.md`

**Triggers:** "run sta", "prime time", "pt shell", "timing signoff"

**Tools:** pt_shell

**Description:** Static Timing Analysis with PrimeTime for signoff.

**Key Commands:**
```tcl
read_verilog netlist/design.vg
read_spef design.spef
read_sdc constraints/design.sdc
report_timing -max_paths 50
```

---

### 12. verification (DRC/LVS)

**File:** `skills/verification.md`

**Triggers:** "run drc", "run lvs", "calibre drc", "physical verification"

**Tools:** calibre, icv, pvs

**Description:** Physical verification with Calibre for DRC and LVS.

**Key Commands:**
```bash
calibre -drc -hier -turbo 4 rules/drc.rules
calibre -lvs -hier rules/lvs.rules
```

---

## Master Flow Skill

### ibex-rtl2gds-flow

**File:** `skills/ibex-rtl2gds-flow.md`

**Triggers:** "run rtl2gds", "ibex flow", "complete flow"

**Description:** Complete RTL2GDS flow for Ibex design using MCP commands. Replicates the original Makefile-based flow.

**Flow Stages:**
1. Design Initialization
2. Floorplan
3. Power Planning
4. Placement
5. CTS
6. Post-CTS Optimization
7. Routing
8. Routing Optimization
9. Chip Finish

---

## Timing Analysis Skills

### report-timing

**Triggers:** "timing report", "report timing"

**Description:** Generate timing reports with path analysis.

### report-power

**Triggers:** "power report", "report power"

**Description:** Generate power analysis reports.

### report-area

**Triggers:** "area report", "report area"

**Description:** Generate area utilization reports.

### fix-setup-timing

**Triggers:** "fix setup", "setup violations"

**Description:** Fix setup timing violations with multiple strategies.

### fix-hold-timing

**Triggers:** "fix hold", "hold violations"

**Description:** Fix hold timing violations with delay insertion.

---

## Design Management Skills

### save-design

**Triggers:** "save design", "checkpoint", "saveDesign"

**Description:** Save design checkpoint for recovery.

### read-design

**Triggers:** "read design", "load design", "restoreDesign"

**Description:** Load design from checkpoint.

### create-checkpoint

**Triggers:** "create checkpoint", "save state"

**Description:** Create named checkpoint with metadata.

### resume-work

**Triggers:** "resume", "continue work"

**Description:** Resume work from last checkpoint.

### compare-qor

**Triggers:** "compare qor", "qor comparison"

**Description:** Compare QoR metrics between runs.

---

## DRC/LVS Skills

### run-drc

**Triggers:** "run drc", "drc check"

**Description:** Run design rule check.

### lvs-check

**Triggers:** "run lvs", "lvs check"

**Description:** Run layout vs schematic check.

### auto-fix-drc

**Triggers:** "fix drc", "auto fix drc"

**Description:** Automatically fix DRC violations.

---

## Analysis Skills

### compare-implementations

**Triggers:** "compare implementations"

**Description:** Compare different implementation runs.

### debug-failure

**Triggers:** "debug failure", "analyze failure"

**Description:** Analyze and debug flow failures.

### track-progress

**Triggers:** "track progress", "show progress"

**Description:** Track flow progress and metrics.

### auto-recover

**Triggers:** "auto recover", "recover from error"

**Description:** Automatic recovery from errors.

---

## Utility Skills

### auto-fix-timing

**Triggers:** "auto fix timing"

**Description:** Automatic timing violation fixing.

### run-eco-flow

**Triggers:** "eco flow", "run eco"

**Description:** Engineering change order flow.

### run-cts-flow

**Triggers:** "cts flow"

**Description:** Complete CTS flow execution.

### rtl2gds-flow

**Triggers:** "rtl2gds", "rtl to gds"

**Description:** Generic RTL-to-GDS flow.

---

## Skill File Format

Each skill follows this structure:

```markdown
---
name: skill-name
description: >
  Multi-line description of the skill.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [stage_name]
  triggers:
    - "trigger phrase 1"
    - "trigger phrase 2"
  qor_metrics: [WNS, TNS, Area]
  risk_level: low|moderate|high
  typical_duration: "X minutes"
---

# Skill Title

## Quick Reference

## When to Use This Skill

## Workflow

## MCP Commands

## Common Issues

## Related Skills

## Checklist
```

---

## Using Skills

### Method 1: Natural Language

```
"Fix the setup timing violations"
"Run CTS and report skew"
"Export the final GDS"
```

### Method 2: Slash Command

```
/fix-setup-timing
/cts
/chip-finish
```

### Method 3: MCP Direct

```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "report_timing -max_paths 10"
}'
```

---

## Creating Custom Skills

1. **Create file:** `skills/my-skill.md`

2. **Add frontmatter:**
```yaml
---
name: my-skill
description: My custom skill
hipilot:
  vendors: [cadence]
  triggers:
    - "my trigger"
---
```

3. **Add content:**
```markdown
# My Skill

## MCP Commands
\`\`\`bash
bash ... send_to_terminal '{"tcl": "..."}'
\`\`\`
```

4. **Test:**
```
"my trigger"
```

---

## Skill Quick Reference Card

| Stage | Skill | Command |
|-------|-------|---------|
| Synthesis | `/synthesis` | dc_shell compile |
| Init | `/design-init` | init_design |
| Floorplan | `/floorplan` | floorPlan |
| Power | `/power-planning` | addStripe, sroute |
| Place | `/placement` | place_opt_design |
| CTS | `/cts` | ccopt_design |
| Post-CTS | `/post-cts-opt` | optDesign -postCTS |
| Route | `/route-design` | routeDesign |
| Route Opt | `/routing-opt` | optDesign -postRoute |
| Finish | `/chip-finish` | defOut, saveNetlist |
| STA | `/sta` | report_timing |
| DRC/LVS | `/verification` | calibre |

---

**Total Skills:** 35
**Last Updated:** 2026-02-24
