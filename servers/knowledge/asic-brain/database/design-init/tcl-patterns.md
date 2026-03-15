# Design Init Tcl Patterns

Common Tcl snippets for design initialization stage.

## Full Timing Setup (Recommended)

### Innovus MMMC Setup

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

## Skywater 130nm Example

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

## Physical-Only Setup (Limited)

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

## Verification Commands

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

### Save Checkpoint

```tcl
# Save initialized design
saveDesign result/pr/data/init.enc
```

## ICC2 Equivalent

```tcl
# ICC2 design initialization
read_lef {tech.lef cells.lef}
read_verilog design.v
link_design

# MMMC setup
create_library_set -name libs_tt -timing {sky130.lib}
create_rc_corner -name rc_tt
create_delay_corner -name delay_tt -library_set libs_tt -rc_corner rc_tt
create_constraint_mode -name const_mode -sdc_files {constraints.sdc}
create_analysis_view -name view_tt -constraint_mode const_mode -delay_corner delay_tt
set_analysis_view -setup {view_tt} -hold {view_tt}

# Initialize
initialize_design
```
