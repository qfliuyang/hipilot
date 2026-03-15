# Design Compiler Workflow Patterns

Extracted from Synopsys Design Compiler example Tcl scripts.

---

## Standard Synthesis Script Structure

### Description
The standard DC synthesis flow follows a hierarchical compile approach with initial compilation, characterization, and recompilation phases.

### Code Pattern
```tcl
# Main run.tcl - Top-level orchestration
# Initial compile with estimated constraints
source "${script_path}initial_compile.tcl"

current_design ChipLevel
write -hierarchy -out "${db_path}ChipLevel_init.db"

# Characterize and write_script for all modules
source "${script_path}characterize.tcl"

# Recompile all modules using write_script constraints
remove_design -all
source "${script_path}recompile.tcl"

current_design ChipLevel
write -hierarchy -out "${db_path}ChipLevel_final.db"
```

### Usage Context
- Top-level synthesis script that orchestrates the complete flow
- Uses variable-based paths for portability (`script_path`, `db_path`)
- Separates concerns into modular Tcl files

### Related Patterns
- [Initial Compile Pattern](#initial-compile-pattern)
- [Characterization Pattern](#characterization-pattern)
- [Recompile Pattern](#recompile-pattern)

---

## Initial Compile Pattern

### Description
Initial compilation sets up the design environment with estimated constraints before detailed characterization.

### Code Pattern
```tcl
# initial_compile.tcl
source "${script_path}read.tcl"

current_design ChipLevel
source "${script_path}defaults.con"

# Source module-specific constraint files
source "${script_path}adder16.tcl"
source "${script_path}cascademod.tcl"
source "${script_path}comp16.tcl"
source "${script_path}mult8.tcl"
source "${script_path}mult16.tcl"
source "${script_path}muxmod.tcl"
source "${script_path}pathseg.tcl"
```

### Usage Context
- First pass synthesis with estimated constraints
- Loads all design files and default constraints
- Sources individual module constraint scripts

### Related Patterns
- [Design Reading Pattern](#design-reading-pattern)
- [Module Constraint Pattern](#module-constraint-pattern)

---

## Design Reading Pattern

### Description
Standard pattern for reading Verilog source files into Design Compiler.

### Code Pattern
```tcl
# read.tcl - Read all design files
read_verilog ChipLevel.v
read_verilog Adder16.v
read_verilog CascadeMod.v
read_verilog Adder8.v
read_verilog Counter.v
read_verilog Comparator.v
read_verilog Multiply8x8.v
read_verilog Multiply16x16.v
read_verilog MuxMod.v
read_verilog PathSegment.v
```

### Usage Context
- Always use `read_verilog` for RTL files
- Read top-level first, then submodules
- Alternative: `read_file -format verilog` for explicit format control

### Related Patterns
- [Initial Compile Pattern](#initial-compile-pattern)

---

## Module Constraint Pattern

### Description
Standard template for constraining individual modules with environment and timing constraints.

### Code Pattern
```tcl
# Script file for constraining a module
set rpt_file "adder16.rpt"
set design "adder16"

current_design Adder16
source "${script_path}defaults.con"

# Define design environment
set_load 2.2 sout
set_load 1.5 cout
set_driving_cell -cell FD1 [all_inputs]
set_drive 0 $clk_name

# Define design constraints
set_input_delay 1.35 -clock $clk_name {ain bin}
set_input_delay 3.5 -clock $clk_name cin
set_max_area 0

compile
write -f db -hierarchy -o "${db_path}${design}.db"
source "${script_path}report.tcl"
```

### Usage Context
- Each module has its own constraint script
- Sets loading, driving cells, and timing constraints
- Always includes `set_max_area 0` for area optimization
- Generates reports after compilation

### Related Patterns
- [Design Environment Pattern](#design-environment-pattern)
- [Timing Constraints Pattern](#timing-constraints-pattern)
- [Report Generation Pattern](#report-generation-pattern)

---

## Design Environment Pattern

### Description
Configures the electrical environment for input/output ports.

### Code Pattern
```tcl
# Output loading
set_load 2.2 sout
set_load 2.5 [all_outputs]

# Input driving cells
set_driving_cell -cell FD1 [all_inputs]
set_driving_cell -cell FD1P [all_inputs]

# Clock driving (ideal clock, no drive)
set_drive 0 $clk_name

# Wire load model override
set_wire_load_model -name "05x05"
set_wire_load_mode enclosed
```

### Usage Context
- Set output capacitive loading for accurate delay calculation
- Use `set_driving_cell` to model input transition times
- Clock inputs should have `set_drive 0` for ideal clock
- Wire load models can be explicitly set or auto-selected

### Related Patterns
- [Module Constraint Pattern](#module-constraint-pattern)

---

## Timing Constraints Pattern

### Description
Sets up timing constraints including input/output delays and multicycle paths.

### Code Pattern
```tcl
# Input delays with clock reference
set_input_delay 1.35 -clock $clk_name {ain bin}
set_input_delay 3.5 -clock $clk_name cin
set_input_delay 4.5 -clock $clk_name {rst start}

# Output delays
set_output_delay 5.5 -clock $clk_name comp_out
set_output_delay 5.1 -clock $clk_name {cp_out}

# Multicycle paths for complex operations
set_multicycle_path 2 -from [all_inputs] \
   -to [all_registers -data_pins -edge_triggered]
set_multicycle_path 2 -to mult/product*

# Design rules
set_max_fanout 6 {S1 S2}
set_max_area 0
```

### Usage Context
- Input delays define when data arrives relative to clock
- Output delays define when data must be stable before clock
- Multicycle paths relax timing for complex operations (multipliers)
- Area constraint of 0 means optimize for minimum area

### Related Patterns
- [Module Constraint Pattern](#module-constraint-pattern)

---

## Hierarchical Compile Pattern

### Description
Compile strategy using dont_touch and uniquify for hierarchical designs.

### Code Pattern
```tcl
# Compile-once, dont_touch approach for submodules
set_dont_touch u12

# Uniquify instances for independent optimization
uniquify -cell {u10 u11}

# Compile with ungrouping for flattening
compile -ungroup_all
```

### Usage Context
- `set_dont_touch` preserves pre-compiled modules
- `uniquify` creates unique instances for separate optimization
- `compile -ungroup_all` flattens hierarchy for QoR

### Related Patterns
- [Module Constraint Pattern](#module-constraint-pattern)

---

## DesignWare Handling Pattern

### Description
Automatic ungrouping of DesignWare synthetic components.

### Code Pattern
```tcl
# Ungroup DesignWare parts
set designware_cells [get_cells -filter "@is_oper==true" *]
if {[sizeof_collection $designware_cells] > 0} {
   set_ungroup $designware_cells true
}
```

### Usage Context
- DesignWare components are identified by `is_oper` attribute
- Ungrouping allows better optimization across module boundaries
- Always check collection size before operations

### Related Patterns
- [Module Constraint Pattern](#module-constraint-pattern)

---

## Path Segmentation Pattern

### Description
Creates a separate design level for complex paths to enable multi-cycle constraints.

### Code Pattern
```tcl
# Perform path segmentation for multiplier
group -design mult -cell mult U100
set_input_delay 10 -clock $clk_name mult/product*
set_output_delay 5 -clock $clk_name mult/product*
set_multicycle_path 2 -to mult/product*
```

### Usage Context
- Groups complex logic into a virtual hierarchy
- Allows separate timing constraints for internal paths
- Useful for pipelined multipliers and complex arithmetic

### Related Patterns
- [Timing Constraints Pattern](#timing-constraints-pattern)

---

## Characterization Pattern

### Description
Characterizes submodules in context and generates constraint scripts for recompilation.

### Code Pattern
```tcl
# Characterize and write_script for all modules
current_design ChipLevel

characterize u1
current_design Adder16
write_script > "${script_path}adder16.wtcl"

current_design ChipLevel
characterize u2
current_design CascadeMod
write_script -format dctcl > "${script_path}cascademod.wtcl"

# Alternative: Echo to build script incrementally
current_design ChipLevel
characterize u7
current_design PathSegment
echo "current_design PathSegment" > "${script_path}pathseg.wtcl"
echo "group -design mult -cell mult U100" >> "${script_path}pathseg.wtcl"
write_script -format dctcl >> "${script_path}pathseg.wtcl"
```

### Usage Context
- `characterize` captures constraints in the parent context
- `write_script` generates a Tcl constraint file for the submodule
- Use `-format dctcl` for Design Compiler Tcl format
- Must switch to submodule before write_script

### Related Patterns
- [Recompile Pattern](#recompile-pattern)

---

## Recompile Pattern

### Description
Recompiles modules using constraints generated from characterization.

### Code Pattern
```tcl
# Recompile all modules using write_script constraints
source "${script_path}read.tcl"

current_design ChipLevel
source "${script_path}defaults.con"

# Compile each module with characterized constraints
source "${script_path}adder16.wtcl"
compile
write -f db -hier -o "${db_path}adder16_wtcl.db"
set rpt_file adder16_wtcl.rpt
source "${script_path}report.tcl"

# With dont_touch for hierarchical preservation
source "${script_path}cascademod.wtcl"
dont_touch u12
uniquify
compile
write -f db -hier -o "${db_path}cascademod_wtcl.db"
set rpt_file cascade_wtcl.rpt
source "${script_path}report.tcl"

# With ungrouping for flat optimization
source "${script_path}mult16.wtcl"
compile -ungroup_all
write -f db -hier -o "${db_path}mult16_wtcl.db"
set rpt_file mult16_wtcl.rpt
source "${script_path}report.tcl"
report_timing_requirements -ignore \
   >> "${log_path}${rpt_file}"
```

### Usage Context
- Second pass compilation using characterized constraints
- Each module compiled independently with its own reports
- Preserves or flattens hierarchy based on design needs

### Related Patterns
- [Characterization Pattern](#characterization-pattern)
- [Report Generation Pattern](#report-generation-pattern)

---

## Report Generation Pattern

### Description
Comprehensive reporting template for design analysis.

### Code Pattern
```tcl
# report.tcl - Creates reports for all modules
set maxpaths 15

check_design > "${log_path}${rpt_file}"
report_area >> "${log_path}${rpt_file}"
report_design >> "${log_path}${rpt_file}"
report_cell >> "${log_path}${rpt_file}"
report_reference >> "${log_path}${rpt_file}"
report_port -verbose >> "${log_path}${rpt_file}"
report_net >> "${log_path}${rpt_file}"
report_compile_options >> "${log_path}${rpt_file}"
report_constraint -all_violators -verbose \
   >> "${log_path}${rpt_file}"
report_timing -path end >> "${log_path}${rpt_file}"
report_timing -max_path $maxpaths \
   >> "${log_path}${rpt_file}"
```

### Usage Context
- Standard report template sourced after each compile
- Captures design checks, area, timing, and constraints
- Uses variable for report file name for flexibility
- Reports timing violations and path details

### Related Patterns
- [Module Constraint Pattern](#module-constraint-pattern)
- [Recompile Pattern](#recompile-pattern)

---

## Database Write Pattern

### Description
Standard patterns for writing design databases.

### Code Pattern
```tcl
# Write hierarchical database
current_design ChipLevel
write -hierarchy -out "${db_path}ChipLevel_init.db"

# Write with explicit format
write -f db -hier -o "${db_path}adder16_wtcl.db"
write -f db -hierarchy -o "${db_path}${design}.db"
```

### Usage Context
- Always use `-hierarchy` or `-hier` to include submodules
- Explicit format with `-f db` for clarity
- Use variables for path management

### Related Patterns
- [Module Constraint Pattern](#module-constraint-pattern)
