# EDA Tools Knowledge Base

> Comprehensive working knowledge of Cadence Innovus and Synopsys Design Compiler
> Based on original scripts from ibex_demo.tar and official documentation

---

## Table of Contents

1. [Innovus (Cadence) - Physical Implementation](#innovus-cadence)
2. [Design Compiler (Synopsys) - Synthesis](#design-compiler-synopsys)
3. [Checkpoint/Database Management](#checkpoint-management)
4. [Common Errors and Solutions](#common-errors)
5. [Tool Detection and State Management](#tool-detection)

---

## Innovus (Cadence)

### Overview
Innovus is a digital implementation tool for place and route (P&R). It takes a gate-level netlist from synthesis and produces a physical layout (GDS).

### Key Commands

#### Design Initialization
```tcl
# Set up design variables BEFORE init_design
set init_verilog <path_to_netlist>
set init_top_cell <top_module_name>
set init_lef_file [list <tlef> <lef>]
set init_mmmc_file <mmmc_view_file>
set init_gnd_net VSS
set init_pwr_net VDD

# Initialize the design
init_design
```

#### MMMC (Multi-Mode Multi-Corner) Setup
```tcl
# Create RC corners
create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05

# Create library sets
create_library_set -name lib_max -timing <lib_file>

# Create constraint modes
create_constraint_mode -name func -sdc_files <sdc_file>

# Create delay corners
create_delay_corner -name dc_max -library_set lib_max -rc_corner rc_max

# Create analysis views
create_analysis_view -name av_max -constraint_mode func -delay_corner dc_max

# Activate views
set_analysis_view -setup av_max -hold av_min
```

#### Floorplanning
```tcl
# Create floorplan
floorPlan -site <site_name> -su 1 <density> 1 1 1 1

# Place IO pins
loadIoFile <io_file>
# OR use Tcl commands to place pins
```

#### Power Planning
```tcl
# Connect power/ground nets globally
globalNetConnect VDD -type pgpin -pin VPWR -inst *
globalNetConnect VDD -type tiehi -pin VPWR -inst *
globalNetConnect VSS -type pgpin -pin VGND -inst *
globalNetConnect VSS -type tielo -pin VGND -inst *

# Add power stripes
addStripe -nets {VSS VDD} -layer M4 -direction vertical \
  -width 2 -spacing 2 -set_to_set_distance 40

# Route power rails
sroute -connect {corePin} -nets {VDD VSS}

# Verify
verifyConnectivity -type special -noAntenna -noWeakConnect
verify_PG_short
```

#### Placement
```tcl
# Load previous checkpoint
source <checkpoint>.enc

# Load scan chain DEF (from synthesis)
defIn <scan_def_file>

# Set timing derate
set_timing_derate -delay_corner dc_max -early 0.97 -late 1.03 -clock

# Set analysis mode
setAnalysisMode -cppr both

# Configure path groups
reset_path_groups -all
set reg [filter_collection [all_registers] "is_integrated_clock_gating_cell != true"]
group_path -name reg2reg -from $reg -to $reg
group_path -name in2reg -from [all_inputs]
group_path -name reg2out -to [all_outputs]

# Placement settings
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false

# Run placement
place_opt_design
reportCongestion -overflow

# Timing analysis
timeDesign -preCTS -idealClock -pathReports -slackReports
```

#### Clock Tree Synthesis (CTS)
```tcl
# CCOpt settings
set_ccopt_property use_inverters true
set_ccopt_property inverter_cells [get_lib_cells "clkbuf_*"]

# Create clock tree spec
create_ccopt_clock_tree_spec -file clk.spec
source clk.spec

# Run CTS
ccopt_design -cts
report_ccopt_skew_groups

# Post-CTS timing
timeDesign -postCTS
```

#### Routing
```tcl
# Configure router
setNanoRouteMode -routeWithTimingDriven true
setNanoRouteMode -drouteEndIteration 70
setNanoRouteMode -drouteFixAntenna true

# Run routing
routeDesign -globalDetail

# Post-route optimization
optDesign -postRoute -setup

# Post-route timing
timeDesign -postRoute
```

#### Final Export
```tcl
# Write GDS
streamOut <output>.gds -mapFile <map_file> -libName DesignLib

# Write DEF
defOut -floorplan -netlist -routing <output>.def

# Write netlist
saveNetlist <output>.vg
saveNetlist -includePowerGround <output>_pg.vg
```

### Innovus Prompt Patterns
```
innovus 1>           # Initial prompt
innovus 2>           # After first command
innovus 3>           # After second command
...
```

---

## Design Compiler (Synopsys)

### Overview
Design Compiler is the industry-standard logic synthesis tool. It converts RTL (Verilog/VHDL) into a gate-level netlist using a target technology library.

### Key Commands

#### Library Setup
```tcl
# Target library - the actual cells to use
set target_library "sky130_fd_sc_hd__tt_025C_1v80.db"

# Link library - includes target + memory + IP libraries
set link_library "* $target_library dw_foundation.sldb"

# Symbol library (for GUI)
set symbol_library "sky130_fd_sc_hd.sdb"
```

#### Reading Design
```tcl
# Method 1: read_file (single step)
read_file -format sverilog <verilog_file>

# Method 2: analyze + elaborate (two-step, allows generics/parameters)
analyze -format sverilog <verilog_file>
elaborate <top_module_name>

# Set current design
current_design <top_module_name>
link
```

#### Design Constraints (SDC)
```tcl
# Read SDC constraints
source <constraints>.sdc

# Or define inline
create_clock -name clk -period 10 [get_ports clk_i]
set_input_delay -clock clk 2 [get_ports data_in]
set_output_delay -clock clk 2 [get_ports data_out]
```

#### Path Groups
```tcl
remove_path_group -all
set reg [filter_collection [all_registers] "is_clock_gate != true"]
group_path -name reg2reg -weight 50 -from $reg -to $reg
group_path -name in2reg -weight 10 -from [all_inputs] -to $reg
group_path -name reg2out -weight 10 -from $reg -to [all_outputs]
```

#### Compilation
```tcl
# Basic compile (DC Expert)
compile

# High-effort compile (DC Ultra)
compile_ultra -timing_high_effort_script

# Test-ready compile (with scan insertion)
compile_ultra -scan
```

#### DFT (Scan Chain) Commands
```tcl
# DFT configuration
set_dft_insertion_configuration -preserve_design_name true

# Define DFT signals
set_dft_signal -view existing_dft -type ScanClock -timing {45 55} -port {clk_i}
set_dft_signal -view existing_dft -port rst_ni -type Reset -active_state 0
set_dft_signal -view existing_dft -port test_en_i -type ScanEnable -active_state 1

# Create test protocol
create_test_protocol -infer_async -infer_clock

# Preview scan insertion
preview_dft -show all -verbose

# Insert scan chains
insert_dft

# Incremental compile after scan insertion
compile_ultra -scan -incremental
```

#### Writing Outputs
```tcl
# Verilog netlist
write_file -format verilog -hierarchy -output <output>.v

# SDC constraints
write_sdc <output>.sdc

# Scan DEF for P&R
write_scan_def -output <output>.scan.def

# Test protocol
write_test_protocol -output <output>.spf
```

#### Reporting
```tcl
report_timing -max_paths 50 > timing.rpt
report_area > area.rpt
report_qor > qor.rpt
report_power > power.rpt
report_constraint -all_violators > violators.rpt
```

### Design Compiler Prompt Pattern
```
dc_shell>              # Standard prompt
dc_shell-top>          # When design is loaded
dc_shell-rtln>         # When in RTL mode
```

---

## Checkpoint Management

### Innovus Checkpoints (.enc files)

**IMPORTANT**: Innovus `.enc` files are Tcl scripts, not binary databases!

When you call `saveDesign checkpoint.enc`, Innovus creates:
1. `checkpoint.enc` - Tcl script with restore commands
2. `checkpoint.enc.dat/` - Directory with binary data

```tcl
# Content of .enc file (example):
###############################################################
# Generated by: Cadence Innovus 20.10
# Command: saveDesign checkpoint.enc
###############################################################
if {[is_common_ui_mode]} {
  read_db checkpoint.enc.dat
} else {
  restoreDesign checkpoint.enc.dat <top_cell>
}
```

To load a checkpoint:
```tcl
source checkpoint.enc    # This sources the Tcl script
# Which internally calls restoreDesign/read_db
```

### Design Compiler Checkpoints

```tcl
# Save design
write_file -format ddc -output checkpoint.ddc

# Load design
read_file -format ddc checkpoint.ddc
```

---

## Common Errors and Solutions

### Error: "bash: <command>: command not found"
**Cause**: Tcl command sent to bash shell (Innovus not running)
**Solution**:
- Check if tool is running: `ps aux | grep innovus`
- Verify tool prompt before sending commands
- Do NOT use bash prompt as "idle" indicator for EDA tools

### Error: "Cannot restore design - file not found"
**Cause**: Checkpoint path is wrong or file doesn't exist
**Solution**:
- Verify checkpoint exists: `file exists <checkpoint>.enc`
- Check that `.enc.dat` directory exists alongside `.enc` file
- Use absolute paths

### Error: "Library cell not found"
**Cause**: LEF/library not loaded correctly
**Solution**:
- Verify `init_lef_file` is set before `init_design`
- Check library paths are correct

### Error: "No clock defined"
**Cause**: SDC constraints not loaded
**Solution**:
- Load SDC before timing analysis
- Verify SDC file exists and has create_clock commands

---

## Tool Detection and State Management

### How to Detect Which Tool is Running

```bash
# Check process list
pgrep -f innovus      # Returns PID if running
pgrep -f dc_shell     # Returns PID if running
pgrep -f pt_shell     # Returns PID if running
```

### Prompt-Based Detection

| Tool | Prompt Pattern | Example |
|------|---------------|---------|
| Innovus | `innovus \d+>` | `innovus 1>` |
| DC Shell | `dc_shell>` | `dc_shell>` |
| PrimeTime | `pt_shell>` | `pt_shell>` |
| Bash | `\[.*\]$` | `[user@host dir]$` |

**CRITICAL**: Bash prompt `[user@host dir]$` should NEVER be treated as "EDA tool idle". It means the tool crashed or exited.

### Correct await_idle Implementation

```javascript
// Pseudo-code for await_idle
async function await_idle({timeout, expected_tool}) {
  while (time < timeout) {
    const output = capture_pane();
    const last_line = get_last_line(output);

    // Check for specific tool prompt
    const tool_prompts = {
      'innovus': /innovus\s*\d+>/i,
      'dc_shell': /dc_shell>/i,
      'pt_shell': /pt_shell>/i
    };

    // Check for bash prompt (ERROR condition)
    const bash_prompt = /\[.*@.*\].*\$/;
    if (bash_prompt.test(last_line) && expected_tool !== 'bash') {
      return {error: "Tool crashed to bash"};
    }

    // Check for expected tool prompt
    if (tool_prompts[expected_tool]?.test(last_line)) {
      return {idle: true, tool: expected_tool};
    }

    await sleep(500);
  }
}
```

---

## RTL2GDS Flow Summary

### Stage 0: Synthesis (Design Compiler)
- **Tool**: dc_shell
- **Input**: RTL (Verilog), constraints (SDC)
- **Output**: Gate-level netlist (.v), scan DEF (.scan.def)
- **Key commands**: analyze, elaborate, compile_ultra, insert_dft

### Stage 1: Design Init (Innovus)
- **Tool**: innovus
- **Input**: Netlist, LEF, MMMC view
- **Output**: init_design.enc
- **Key commands**: init_design, timeDesign

### Stage 2: Floorplan (Innovus)
- **Tool**: innovus
- **Input**: init_design.enc
- **Output**: floor_plan.enc
- **Key commands**: floorPlan, loadIoFile

### Stage 3: Power Planning (Innovus)
- **Tool**: innovus
- **Input**: floor_plan.enc
- **Output**: powerplan.enc
- **Key commands**: globalNetConnect, addStripe, sroute

### Stage 4: Placement (Innovus)
- **Tool**: innovus
- **Input**: powerplan.enc, scan.def
- **Output**: placement.enc
- **Key commands**: place_opt_design, timeDesign

### Stage 5: CTS (Innovus)
- **Tool**: innovus
- **Input**: placement.enc
- **Output**: cts.enc
- **Key commands**: create_ccopt_clock_tree_spec, ccopt_design

### Stage 6: Post-CTS Optimization (Innovus)
- **Tool**: innovus
- **Input**: cts.enc
- **Output**: post_cts_opt.enc
- **Key commands**: optDesign

### Stage 7: Routing (Innovus)
- **Tool**: innovus
- **Input**: post_cts_opt.enc
- **Output**: routing.enc
- **Key commands**: routeDesign

### Stage 8: Routing Optimization (Innovus)
- **Tool**: innovus
- **Input**: routing.enc
- **Output**: routing_opt.enc
- **Key commands**: optDesign -postRoute

### Stage 9: Chip Finish (Innovus)
- **Tool**: innovus
- **Input**: routing_opt.enc
- **Output**: chip_done.enc, GDS, DEF, netlist
- **Key commands**: streamOut, defOut, saveNetlist

---

## References

1. Cadence Innovus User Guide (v20.10)
2. Synopsys Design Compiler User Guide (L-2016.03-SP2)
3. Original scripts from ibex_demo.tar (Skywater 130nm Ibex demo)
