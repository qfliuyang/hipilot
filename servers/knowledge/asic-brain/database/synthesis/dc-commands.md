# Design Compiler Commands

Reference for common Design Compiler commands.

## Environment Commands

| Command | Description | Example |
|---------|-------------|---------|
| `set search_path` | Define search path for files | `set search_path [list . ./rtl ./lib]` |
| `set target_library` | Target technology library | `set target_library "sky130hd.db"` |
| `set link_library` | Link library for resolution | `set link_library "* sky130hd.db"` |
| `set synthetic_library` | Synthetic library | `set synthetic_library "standard.sldb"` |

## Design Reading Commands

| Command | Description | Example |
|---------|-------------|---------|
| `analyze` | Analyze RTL source | `analyze -format verilog file.v` |
| `elaborate` | Elaborate design | `elaborate top_module` |
| `read_file` | Read design file | `read_file -format verilog file.v` |
| `link` | Link design | `link` |
| `current_design` | Set current design | `current_design top_module` |

## Constraint Commands

| Command | Description | Example |
|---------|-------------|---------|
| `create_clock` | Define clock | `create_clock -name clk -period 10 [get_ports clk]` |
| `set_input_delay` | Set input delay | `set_input_delay 2.0 -clock clk [all_inputs]` |
| `set_output_delay` | Set output delay | `set_output_delay 2.0 -clock clk [all_outputs]` |
| `set_load` | Set output load | `set_load 0.5 [all_outputs]` |
| `set_driving_cell` | Set driving cell | `set_driving_cell -lib_cell BUFX2 [all_inputs]` |
| `set_false_path` | Set false path | `set_false_path -from [get_ports rst]` |
| `set_multicycle_path` | Set multicycle path | `set_multicycle_path 2 -setup -from reg1 -to reg2` |
| `read_sdc` | Read SDC file | `read_sdc constraints.sdc` |

## Compile Commands

| Command | Description | Example |
|---------|-------------|---------|
| `compile` | Basic compile | `compile` |
| `compile_ultra` | Ultra compile | `compile_ultra` |
| `compile_ultra -incremental` | Incremental compile | `compile_ultra -incremental` |
| `compile_ultra -area_effort high` | Area optimization | `compile_ultra -area_effort high` |
| `compile_ultra -timing_effort high` | Timing optimization | `compile_ultra -timing_effort high` |
| `compile_ultra -gate_clock` | Clock gating | `compile_ultra -gate_clock` |

## Report Commands

| Command | Description | Example |
|---------|-------------|---------|
| `report_timing` | Timing report | `report_timing -max_paths 10` |
| `report_area` | Area report | `report_area -hierarchy` |
| `report_power` | Power report | `report_power -hierarchy` |
| `report_qor` | QoR summary | `report_qor` |
| `report_constraint` | Constraint report | `report_constraint -all_violators` |
| `report_reference` | Cell reference | `report_reference -hierarchy` |
| `report_design` | Design summary | `report_design` |

## Output Commands

| Command | Description | Example |
|---------|-------------|---------|
| `write` | Write design | `write -format verilog -hierarchy -output out.v` |
| `write_sdc` | Write SDC | `write_sdc -nosplit out.sdc` |
| `write_def` | Write DEF | `write_def -hierarchy out.def` |
| `write_spef` | Write SPEF | `write_spef out.spef` |
| `change_names` | Change naming | `change_names -rules verilog -hierarchy` |

## Check Commands

| Command | Description | Example |
|---------|-------------|---------|
| `check_design` | Check design | `check_design` |
| `check_timing` | Check timing | `check_timing` |
| `check_constraints` | Check constraints | `check_constraints` |

## Clock Gating Commands

| Command | Description | Example |
|---------|-------------|---------|
| `set_clock_gating_style` | Set CG style | `set_clock_gating_style -max_fanout 16` |
| `identify_clock_gating` | Identify CG | `identify_clock_gating` |
| `report_clock_gating` | Report CG | `report_clock_gating` |

## Common Options

### compile_ultra Options

| Option | Description |
|--------|-------------|
| `-incremental` | Incremental optimization |
| `-area_effort high` | High area optimization |
| `-timing_effort high` | High timing optimization |
| `-gate_clock` | Enable clock gating |
| `-retime` | Enable retiming |
| `-adaptive_retime` | Adaptive retiming |
| `-boundary_optimization` | Boundary optimization |
| `-leakage_optimization` | Leakage optimization |

### report_timing Options

| Option | Description |
|--------|-------------|
| `-max_paths N` | Report N paths |
| `-slack_lesser_than X` | Paths with slack < X |
| `-delay_type max` | Setup (max delay) |
| `-delay_type min` | Hold (min delay) |
| `-path_type full` | Full path details |
| `-input_pins` | Show input pins |
| `-nets` | Show nets |
| `-transition_time` | Show transition times |
