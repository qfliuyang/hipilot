# Design Compiler Commands

Complete command reference for Synopsys Design Compiler.

## Library Setup

### set_target_library

Set the target technology library for synthesis.

**Syntax:**
```tcl
set target_library "<library_file>"
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `library_file` | Path to technology library (.db file) |

**Example:**
```tcl
set target_library "sky130_fd_sc_hd__tt_025C_1v80.db"
```

**Related:** `set_link_library`, `list_libs`

---

### set_link_library

Set libraries for link resolution.

**Syntax:**
```tcl
set link_library "<libraries>"
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `libraries` | Space-separated list, use "*" for memory |

**Example:**
```tcl
set link_library "* sky130_fd_sc_hd__tt_025C_1v80.db"
```

**Note:** The "*" represents memory (designs in memory).

---

### list_libs

List loaded libraries.

**Syntax:**
```tcl
list_libs
```

---

## RTL Input

### analyze

Analyze RTL source files.

**Syntax:**
```tcl
analyze -format <format> <files> [-library <lib>]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-format` | verilog, sverilog, vhdl |
| `files` | List of source files or glob patterns |
| `-library` | Target library for analyzed files |

**Example:**
```tcl
analyze -format sverilog [glob rtl/*.v]
analyze -format verilog {file1.v file2.v}
```

**Related:** `elaborate`, `read_file`

---

### elaborate

Elaborate analyzed design.

**Syntax:**
```tcl
elaborate <design_name> [-library <lib>]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `design_name` | Top-level module name |
| `-library` | Library containing analyzed design |

**Example:**
```tcl
elaborate top
elaborate my_design -library WORK
```

**Related:** `analyze`, `current_design`

---

### read_file

Read design files directly.

**Syntax:**
```tcl
read_file -format <format> <file>
```

**Formats:** verilog, sverilog, vhdl, ddc, db

**Example:**
```tcl
read_file -format sverilog design.v
```

---

### current_design

Set or get current design.

**Syntax:**
```tcl
current_design [<design_name>]
```

**Example:**
```tcl
current_design top
set design [current_design]
```

---

## Synthesis

### compile_ultra

Compile with ultra optimization.

**Syntax:**
```tcl
compile_ultra [-scan] [-no_scan] [-retime] [-incremental] [-gate_clock]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-scan` | Enable scan insertion |
| `-no_scan` | Disable scan insertion |
| `-retime` | Enable retiming |
| `-incremental` | Incremental compilation |
| `-gate_clock` | Enable clock gating |

**Example:**
```tcl
compile_ultra -scan
compile_ultra -scan -retime
compile_ultra -incremental
```

**Related:** `compile`, `set_optimize_registers`

---

### compile

Standard compilation (legacy, use compile_ultra).

**Syntax:**
```tcl
compile [-map_effort low|medium|high]
```

---

### set_optimize_registers

Enable retiming optimization.

**Syntax:**
```tcl
set_optimize_registers true [-design <design>]
```

---

## Constraints

### create_clock

Create clock constraint.

**Syntax:**
```tcl
create_clock -name <name> -period <period> <ports_or_pins>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-name` | Clock name |
| `-period` | Clock period (ns) |
| `ports_or_pins` | Clock port/pin list |

**Example:**
```tcl
create_clock -name clk -period 10.0 [get_ports clk]
create_clock -name clk_fast -period 2.5 [get_ports clk]
```

**Related:** `set_clock_uncertainty`, `set_clock_transition`

---

### set_input_delay

Set input delay constraint.

**Syntax:**
```tcl
set_input_delay <delay> -clock <clock> <ports>
```

**Example:**
```tcl
set_input_delay 2.0 -clock clk [all_inputs]
```

---

### set_output_delay

Set output delay constraint.

**Syntax:**
```tcl
set_output_delay <delay> -clock <clock> <ports>
```

---

### set_max_delay

Set maximum delay constraint.

**Syntax:**
```tcl
set_max_delay <delay> -from <from_list> -to <to_list>
```

---

### remove_path_group

Remove path groups.

**Syntax:**
```tcl
remove_path_group -all
remove_path_group <group_name>
```

**Example:**
```tcl
remove_path_group -all
```

---

### group_path

Create timing path group.

**Syntax:**
```tcl
group_path -name <name> -from <from_list> -to <to_list> [-weight <w>]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-name` | Group name |
| `-from` | Start points (registers/inputs) |
| `-to` | End points (registers/outputs) |
| `-weight` | Optimization weight |

**Example:**
```tcl
group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
group_path -name reg2out -from [all_registers] -to [all_outputs]
```

**Related:** `remove_path_group`, `report_path_group`

---

### set_dont_touch

Prevent optimization of cells/nets.

**Syntax:**
```tcl
set_dont_touch <objects> <true|false>
```

---

### set_case_analysis

Set constant value for ports/pins.

**Syntax:**
```tcl
set_case_analysis <0|1> <ports_or_pins>
```

---

## DFT (Design for Test)

### set_scan_configuration

Configure scan chain parameters.

**Syntax:**
```tcl
set_scan_configuration -chain_count <n> [-style multiplexed_flip_flop]
```

**Example:**
```tcl
set_scan_configuration -chain_count 8
```

---

### compile_ultra -scan

Enable scan insertion during synthesis.

**Syntax:**
```tcl
compile_ultra -scan
```

---

### insert_dft

Insert DFT structures (after compile).

**Syntax:**
```tcl
insert_dft
```

---

## Reporting

### report_timing

Report timing analysis.

**Syntax:**
```tcl
report_timing [-max_paths <n>] [-delay_type max|min] [-from] [-to]
```

**Example:**
```tcl
report_timing -max_paths 100
report_timing -delay_type min -max_paths 10
```

---

### report_area

Report area statistics.

**Syntax:**
```tcl
report_area [-hierarchy]
```

---

### report_power

Report power analysis.

**Syntax:**
```tcl
report_power [-analysis_effort low|medium|high]
```

---

### report_constraint

Report constraint violations.

**Syntax:**
```tcl
report_constraint -all_violators
```

---

### report_qor

Report QoR summary.

**Syntax:**
```tcl
report_qor
```

---

## Output

### write_file

Write design to file.

**Syntax:**
```tcl
write_file -format <format> -output <file> <design>
```

**Formats:** verilog, ddc, db, vhdl

**Example:**
```tcl
write_file -format verilog -output design.v top
write_file -format ddc -output design.ddc top
```

---

### write_sdc

Write SDC constraints.

**Syntax:**
```tcl
write_sdc <file>
```

**Example:**
```tcl
write_sdc design.sdc
```

---

### write_scan_def

Write scan chain definition.

**Syntax:**
```tcl
write_scan_def -output <file>
```

---

## Utility

### source

Source Tcl script.

**Syntax:**
```tcl
source <script_file>
```

---

### get_ports

Get design ports.

**Syntax:**
```tcl
get_ports [<pattern>]
```

**Example:**
```tcl
get_ports
get_ports clk*
get_ports -filter "direction == in"
```

---

### get_cells

Get design cells.

**Syntax:**
```tcl
get_cells [<pattern>]
```

---

### get_nets

Get design nets.

**Syntax:**
```tcl
get_nets [<pattern>]
```

---

### all_inputs

Get all input ports.

**Syntax:**
```tcl
all_inputs
```

---

### all_outputs

Get all output ports.

**Syntax:**
```tcl
all_outputs
```

---

### all_registers

Get all register cells.

**Syntax:**
```tcl
all_registers
```

---

## Category Index

| Category | Commands |
|----------|----------|
| Libraries | `set_target_library`, `set_link_library`, `list_libs` |
| RTL Input | `analyze`, `elaborate`, `read_file`, `current_design` |
| Synthesis | `compile_ultra`, `compile`, `set_optimize_registers` |
| Constraints | `create_clock`, `set_input_delay`, `set_output_delay`, `group_path` |
| DFT | `set_scan_configuration`, `compile_ultra -scan`, `insert_dft` |
| Reporting | `report_timing`, `report_area`, `report_power`, `report_qor` |
| Output | `write_file`, `write_sdc`, `write_scan_def` |
| Objects | `get_ports`, `get_cells`, `get_nets`, `all_inputs`, `all_outputs`, `all_registers` |
