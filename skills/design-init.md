---
name: design-init
description: >
  Proper design initialization in Innovus with timing libraries. Covers LEF loading,
  netlist reading, MMMC setup, and timing constraint application. Essential for
  enabling timing-driven placement, CTS, and full STA capabilities.

hipilot:
  vendors: [cadence]
  tools:
    cadence: [innovus]
  flow_stages: [init]
  triggers:
    - "initialize design"
    - "load design"
    - "init design"
    - "load netlist"
    - "mmmc setup"
  qor_metrics: [Instance_Count, Net_Count, Library_Status]
  risk_level: low
  typical_duration: "1-5 minutes"
---

# Design Initialization

## Quick Reference

```
User: "initialize the design"
```

HiPilot will:
1. Load technology and cell LEF files
2. Read synthesized netlist
3. Set up MMMC views (timing libraries)
4. Initialize design database
5. Apply timing constraints

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| Start of P&R flow | Initialize with full timing setup |
| Physical-only study | Initialize without timing (faster) |
| Design changes | Re-initialize from updated netlist |

**Prerequisites:**
- Synthesized netlist (Verilog)
- Technology LEF file
- Standard cell LEF file
- Timing library (Liberty .lib or .db)
- SDC constraint file

---

## Two Initialization Modes

### Mode 1: Full Timing Setup (Recommended)

Enables: Timing-driven placement, CTS, full STA

```tcl
# ==========================================
# LEF Setup
# ==========================================
set init_lef_file {
    /path/to/pdk/lef/sky130_fd_sc_hd.tlef
    /path/to/pdk/lef/sky130_fd_sc_hd_merged.lef
}

# ==========================================
# Netlist Setup
# ==========================================
set init_verilog /path/to/netlist/ibex_core.syn.v
set init_top_cell ibex_core
set init_gnd_net VSS
set init_pwr_net VDD

# ==========================================
# MMMC Setup (CRITICAL for timing-driven flow)
# ==========================================
# Create library set with timing libraries
create_library_set -name libs_tt \
    -timing {/path/to/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib}

# Create RC corner for parasitics
create_rc_corner -name rc_tt

# Create delay corner combining library and RC
create_delay_corner -name delay_tt \
    -library_set libs_tt \
    -rc_corner rc_tt

# Create constraint mode with SDC
create_constraint_mode -name const_mode \
    -sdc_files {/path/to/constraints.sdc}

# Create analysis view
create_analysis_view -name view_tt \
    -constraint_mode const_mode \
    -delay_corner delay_tt

# Set as active view
set_analysis_view -setup {view_tt} -hold {view_tt}

# ==========================================
# Initialize Design
# ==========================================
init_design
```

### Mode 2: Physical-Only Setup (Limited)

Enables: Floorplan, placement, routing (not timing-driven)

**WARNING:** CTS and timing-driven features will NOT work.

```tcl
# LEF and netlist only
set init_lef_file {
    /path/to/pdk/lef/sky130_fd_sc_hd.tlef
    /path/to/pdk/lef/sky130_fd_sc_hd_merged.lef
}
set init_verilog /path/to/netlist/ibex_core.syn.v
set init_top_cell ibex_core

# Initialize WITHOUT timing libraries
init_design

# Result: Physical-only mode
# - Cannot run CTS
# - Cannot run timing-driven placement
# - STA shows "No constrained timing paths"
```

---

## Skywater 130nm Example (Tested)

```tcl
#!/usr/bin/tclsh
# init_design.tcl - Tested on Innovus v20.10

#===========================================
# Paths (adjust for your environment)
#===========================================
set design_root /home/EDA/hipilot_test/ibex_work_upload
set pdk_root $design_root/designs/sky130hd/pdk

#===========================================
# LEF Files
#===========================================
set init_lef_file {
    $pdk_root/lef/sky130_fd_sc_hd.tlef
    $pdk_root/lef/sky130_fd_sc_hd_merged.lef
}

#===========================================
# Netlist
#===========================================
set init_verilog $design_root/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_gnd_net VSS
set init_pwr_net VDD

#===========================================
# MMMC Setup
#===========================================
create_library_set -name libs_tt \
    -timing {$pdk_root/lib/sky130_fd_sc_hd__tt_025C_1v80.lib}

create_rc_corner -name rc_tt

create_delay_corner -name delay_tt \
    -library_set libs_tt \
    -rc_corner rc_tt

create_constraint_mode -name const_mode \
    -sdc_files {$design_root/designs/sky130hd/ibex/constraint_for_pr.sdc}

create_analysis_view -name view_tt \
    -constraint_mode const_mode \
    -delay_corner delay_tt

set_analysis_view -setup {view_tt} -hold {view_tt}

#===========================================
# Initialize
#===========================================
init_design

#===========================================
# Verify
#===========================================
puts "Instances: [sizeof_collection [get_cells *]]"
puts "Nets: [sizeof_collection [get_nets *]]"
report_libs

# Expected: ~7,000 instances, ~7,700 nets
# report_libs should show sky130_fd_sc_hd library
```

---

## Verification

### Check Initialization Success

```tcl
# Report design stats
puts "Instances: [sizeof_collection [get_cells *]]"
puts "Nets: [sizeof_collection [get_nets *]]"

# Check timing libraries loaded
report_libs

# Check analysis views
report_analysis_view

# Quick timing check (should show clock)
report_clocks
```

### Common Issues

#### "Timing Library is not loaded yet"

**Cause:** MMMC not set up before init_design
**Fix:** Create library_set, delay_corner, constraint_mode, analysis_view before init

#### "No constrained timing paths found"

**Cause:** Physical-only mode (no timing libraries)
**Fix:** Re-initialize with MMMC setup, or use PrimeTime for STA

#### LEF file not found

**Cause:** Path incorrect
**Fix:** Check init_lef_file paths, use absolute paths

---

## Makefile Integration

```makefile
# Makefile - Init targets

init:
	innovus -files scripts/init_design.tcl -log logs/init.log

init_report:
	cat logs/init.log | grep -E "(Instances|Nets|Library)"
```

---

## Related Skills

- `/synthesis` - Generate netlist for init
- `/floorplan` - Create floorplan after init
- `/cts` - Requires full timing init
- `/report-timing` - Verify timing after init

---

## Checklist

Before init:
- [ ] Synthesized netlist exists
- [ ] LEF files accessible
- [ ] Timing library available
- [ ] SDC constraint file ready

After init:
- [ ] Instance count matches synthesis
- [ ] report_libs shows timing library
- [ ] report_clocks shows defined clocks
- [ ] Save checkpoint
