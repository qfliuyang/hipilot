# PrimeTime Commands

Complete command reference for Synopsys PrimeTime.

## Design Input

### read_db

Read Synopsys database file.

**Syntax:**
```tcl
read_db <file>
```

**Example:**
```tcl
read_db design.db
```

---

### read_verilog

Read Verilog netlist.

**Syntax:**
```tcl
read_verilog <file>
```

**Example:**
```tcl
read_verilog design.v
```

---

### read_lib

Read technology library.

**Syntax:**
```tcl
read_lib <file>
```

**Example:**
```tcl
read_lib tech.lib
```

---

### read_sdc

Read SDC constraints.

**Syntax:**
```tcl
read_sdc <file>
```

**Example:**
```tcl
read_sdc constraints.sdc
```

---

### read_parasitics

Read parasitic data (SPEF).

**Syntax:**
```tcl
read_parasitics <file> [-format SPEF]
```

**Example:**
```tcl
read_parasitics design.spef
```

---

### link_design

Link the design.

**Syntax:**
```tcl
link_design [<top_cell>]
```

**Example:**
```tcl
link_design top
```

---

### current_design

Set or get current design.

**Syntax:**
```tcl
current_design [<design_name>]
```

---

## Timing Analysis

### update_timing

Update timing analysis.

**Syntax:**
```tcl
update_timing [-full]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-full` | Full timing update (not incremental) |

**Example:**
```tcl
update_timing
```

---

### report_timing

Report timing paths.

**Syntax:**
```tcl
report_timing [-max_paths <n>] [-delay_type <type>] [-from <pins>] [-to <pins>]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-max_paths <n>` | Number of paths to report |
| `-delay_type` | max (setup), min (hold), min_max |
| `-from` | Start points |
| `-to` | End points |
| `-through` | Through points |
| `-slack_lesser_than` | Filter by slack |

**Example:**
```tcl
report_timing -max_paths 100
report_timing -delay_type min -max_paths 10
report_timing -from [get_ports clk] -to [get_ports data_out]
```

---

### report_constraint

Report constraint violations.

**Syntax:**
```tcl
report_constraint -all_violators [-verbose]
```

**Example:**
```tcl
report_constraint -all_violators
```

---

### report_clock

Report clock information.

**Syntax:**
```tcl
report_clock [-skew] [-attributes]
```

**Example:**
```tcl
report_clock
report_clock -skew
```

---

### report_analysis_coverage

Report timing analysis coverage.

**Syntax:**
```tcl
report_analysis_coverage
```

---

## Constraints

### create_clock

Create clock constraint.

**Syntax:**
```tcl
create_clock -name <name> -period <period> <ports_or_pins>
```

**Example:**
```tcl
create_clock -name clk -period 10.0 [get_ports clk]
```

---

### create_generated_clock

Create generated clock.

**Syntax:**
```tcl
create_generated_clock -name <name> -source <source> -divide_by <n> <pin>
```

**Example:**
```tcl
create_generated_clock -name clk_div2 -source [get_ports clk] \
  -divide_by 2 [get_pins div_reg/Q]
```

---

### set_input_delay

Set input delay.

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

Set output delay.

**Syntax:**
```tcl
set_output_delay <delay> -clock <clock> <ports>
```

---

### set_clock_uncertainty

Set clock uncertainty.

**Syntax:**
```tcl
set_clock_uncertainty <uncertainty> <clock>
```

**Example:**
```tcl
set_clock_uncertainty 0.5 [get_clocks clk]
```

---

### set_false_path

Set false path exception.

**Syntax:**
```tcl
set_false_path -from <points> -to <points>
```

**Example:**
```tcl
set_false_path -from [get_ports reset_n]
```

---

### set_multicycle_path

Set multicycle path exception.

**Syntax:**
```tcl
set_multicycle_path <n> -setup -from <points> -to <points>
```

**Example:**
```tcl
set_multicycle_path 2 -setup -from [get_pins reg1/CP] -to [get_pins reg2/D]
```

---

## ECO Commands

### fix_eco_timing

Generate ECO fixes for timing.

**Syntax:**
```tcl
fix_eco_timing -setup|-hold [-methods <methods>]
```

**Methods:** sizing, buffer_insertion, cell_degradation

**Example:**
```tcl
fix_eco_timing -setup -methods {sizing buffer_insertion}
```

---

### report_eco

Report ECO changes.

**Syntax:**
```tcl
report_eco
```

---

### write_changes

Write ECO changes to file.

**Syntax:**
```tcl
write_changes -format <format> -output <file>
```

**Formats:** ptsh, dctcl, icc2tcl, verilog

**Example:**
```tcl
write_changes -format dctcl -output eco.tcl
```

---

## Reporting

### report_qor

Report QoR summary.

**Syntax:**
```tcl
report_qor
```

---

### report_power

Report power analysis.

**Syntax:**
```tcl
report_power [-analysis_effort <level>]
```

---

### report_design

Report design information.

**Syntax:**
```tcl
report_design
```

---

### report_cell_usage

Report cell usage statistics.

**Syntax:**
```tcl
report_cell_usage
```

---

### report_reference

Report reference statistics.

**Syntax:**
```tcl
report_reference [-hierarchy]
```

---

## Object Query

### get_cells

Get cells in design.

**Syntax:**
```tcl
get_cells [<pattern>] [-hierarchical] [-filter <expression>]
```

---

### get_pins

Get pins in design.

**Syntax:**
```tcl
get_pins [<pattern>] [-hierarchical] [-filter <expression>]
```

---

### get_ports

Get ports in design.

**Syntax:**
```tcl
get_ports [<pattern>] [-filter <expression>]
```

---

### get_nets

Get nets in design.

**Syntax:**
```tcl
get_nets [<pattern>] [-hierarchical] [-filter <expression>]
```

---

### get_clocks

Get clocks in design.

**Syntax:**
```tcl
get_clocks [<pattern>]
```

---

### get_timing_paths

Get timing paths.

**Syntax:**
```tcl
get_timing_paths [-max_paths <n>] [-delay_type <type>] [-slack_lesser_than <slack>]
```

**Example:**
```tcl
get_timing_paths -max_paths 10 -slack_lesser_than 0
```

---

### get_attribute

Get object attribute.

**Syntax:**
```tcl
get_attribute <object> <attribute_name>
```

**Example:**
```tcl
get_attribute [get_cell u1] ref_name
```

---

## Variation Analysis

### read_aocvm

Read AOCV derate tables.

**Syntax:**
```tcl
read_aocvm <file>
```

---

### set_delay_calculation

Set delay calculation method.

**Syntax:**
```tcl
set_delay_calculation -prerecurse <method>
```

---

### report_ocvm

Report OCV analysis.

**Syntax:**
```tcl
report_ocvm
```

---

## Output

### write_sdf

Write SDF file.

**Syntax:**
```tcl
write_sdf <file>
```

---

### write_sdc

Write SDC constraints.

**Syntax:**
```tcl
write_sdc <file>
```

---

### save_session

Save PrimeTime session.

**Syntax:**
```tcl
save_session <directory>
```

---

### restore_session

Restore PrimeTime session.

**Syntax:**
```tcl
restore_session <directory>
```

---

## Category Index

| Category | Commands |
|----------|----------|
| Input | `read_db`, `read_verilog`, `read_lib`, `read_sdc`, `read_parasitics` |
| Link | `link_design`, `current_design` |
| Timing | `update_timing`, `report_timing`, `report_constraint` |
| Clocks | `create_clock`, `create_generated_clock`, `report_clock` |
| Constraints | `set_input_delay`, `set_output_delay`, `set_false_path`, `set_multicycle_path` |
| ECO | `fix_eco_timing`, `report_eco`, `write_changes` |
| Reporting | `report_qor`, `report_power`, `report_design`, `report_analysis_coverage` |
| Objects | `get_cells`, `get_pins`, `get_ports`, `get_nets`, `get_clocks`, `get_timing_paths` |
| Variation | `read_aocvm`, `set_delay_calculation`, `report_ocvm` |
| Output | `write_sdf`, `write_sdc`, `save_session`, `restore_session` |
