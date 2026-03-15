# IC Compiler II Commands

Complete command reference for Synopsys IC Compiler II.

## Library and Block Management

### open_lib

Open a design library.

**Syntax:**
```tcl
open_lib <library_name>
```

**Example:**
```tcl
open_lib design.nlib
```

---

### create_lib

Create a new design library.

**Syntax:**
```tcl
create_lib <library_name> -technology <tech_file>
```

**Example:**
```tcl
create_lib design.nlib -technology tech.tf
```

---

### open_block

Open a block from the library.

**Syntax:**
```tcl
open_block <block_name>
```

**Example:**
```tcl
open_block top
open_block design.nlib:top.design
```

---

### current_design

Get or set the current design.

**Syntax:**
```tcl
current_design [<design_name>]
```

---

### save_block

Save the current block.

**Syntax:**
```tcl
save_block [-as <new_name>]
```

**Example:**
```tcl
save_block
save_block -as placed
```

---

## Design Input

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

### read_lef

Read LEF technology and cell data.

**Syntax:**
```tcl
read_lef <file>
```

---

### read_db

Read Synopsys database file.

**Syntax:**
```tcl
read_db <file>
```

---

## Floorplanning

### initialize_floorplan

Initialize the floorplan.

**Syntax:**
```tcl
initialize_floorplan -shape <shape> -side_length {<w> <h>} \
  [-core_offset {<l> <b> <r> <t>}]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-shape` | rectangular, square, etc. |
| `-side_length` | Width and height in microns |
| `-core_offset` | Core to die margins |

**Example:**
```tcl
initialize_floorplan -shape rectangular -side_length {1000 800} \
  -core_offset {10 10 10 10}
```

---

### place_io

Place IO pins.

**Syntax:**
```tcl
place_io -prefix <prefix> -side <side>
```

---

### place_macro

Place a macro instance.

**Syntax:**
```tcl
place_macro -macro <name> -location {<x> <y>} -orientation <orient>
```

**Orientations:** R0, R90, R180, R270, MX, MY, MXR90, MYR90

**Example:**
```tcl
place_macro -macro ram_0 -location {100 200} -orientation R0
```

---

### create_placement_blockage

Create placement blockage.

**Syntax:**
```tcl
create_placement_blockage -bbox {<ll_x> <ll_y> <ur_x> <ur_y>}
```

---

## Power Planning

### create_pg_mesh

Create power grid mesh.

**Syntax:**
```tcl
create_pg_mesh ...
```

---

### create_pg_ring

Create power ring around core.

**Syntax:**
```tcl
create_pg_ring -nets {<nets>} -layers {<layers>} -width <width>
```

---

### connect_pg_net

Connect power/ground nets.

**Syntax:**
```tcl
connect_pg_net -net <net> -inst <pattern> -pin <pattern>
```

**Example:**
```tcl
connect_pg_net -net VDD -pin VDD -inst *
connect_pg_net -net VSS -pin VSS -inst *
```

---

## Placement

### create_placement

Run placement (coarse + legalization).

**Syntax:**
```tcl
create_placement [-floorplan] [-effort <level>] [-timing_driven] [-congestion_driven]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-floorplan` | Re-run floorplan-aware placement |
| `-effort` | low, medium, high |
| `-timing_driven` | Enable timing-driven placement |
| `-congestion_driven` | Enable congestion-driven placement |

**Example:**
```tcl
create_placement -effort high -timing_driven -congestion_driven
```

---

### place_opt

Placement optimization.

**Syntax:**
```tcl
place_opt [-effort <level>]
```

---

### legalize_placement

Legalize cell placement.

**Syntax:**
```tcl
legalize_placement
```

---

## Clock Tree Synthesis

### clock_opt

Run clock tree synthesis and optimization.

**Syntax:**
```tcl
clock_opt [-effort <level>]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-effort` | low, medium, high |

**Example:**
```tcl
clock_opt -effort high
```

---

### create_clock_tree

Create clock tree specification.

**Syntax:**
```tcl
create_clock_tree -clock <clock_name>
```

---

### report_clock_tree

Report clock tree information.

**Syntax:**
```tcl
report_clock_tree -clock <clock_name>
```

---

## Routing

### route_auto

Automatic routing (global + detailed).

**Syntax:**
```tcl
route_auto [-effort <level>]
```

**Example:**
```tcl
route_auto
route_auto -effort high
```

---

### route_global

Global routing only.

**Syntax:**
```tcl
route_global
```

---

### route_detail

Detailed routing only.

**Syntax:**
```tcl
route_detail
```

---

### route_eco

ECO routing for small changes.

**Syntax:**
```tcl
route_eco
```

---

## Verification

### check_design

Check design for errors.

**Syntax:**
```tcl
check_design [-checks <check_list>] [-max_errors <n>]
```

**Checks:** netlist, placement, routing, timing, design_mismatch, unconnected_ports, multi_driven_nets

**Example:**
```tcl
check_design
check_design -checks {netlist timing_constraints}
```

---

### check_routes

Check routing for violations.

**Syntax:**
```tcl
check_routes [-open_net_severity <level>] [-short_severity <level>]
```

---

### verify_drc

Verify DRC compliance.

**Syntax:**
```tcl
verify_drc
```

---

## Reporting

### report_timing

Report timing analysis.

**Syntax:**
```tcl
report_timing [-max_paths <n>] [-delay_type <type>]
```

**Types:** max (setup), min (hold), min_max

**Example:**
```tcl
report_timing -max_paths 100
report_timing -delay_type min -max_paths 10
```

---

### report_design

Report design statistics.

**Syntax:**
```tcl
report_design
```

---

### report_power

Report power analysis.

**Syntax:**
```tcl
report_power
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

## ECO and Optimization

### fix_eco_timing

Fix timing violations using ECO.

**Syntax:**
```tcl
fix_eco_timing [-setup] [-hold] [-max_paths <n>] [-slack_lesser_than <slack>]
```

**Example:**
```tcl
fix_eco_timing -setup -max_paths 500
fix_eco_timing -hold -buffer_list {BUFX2 BUFX4}
```

---

### size_cell

Resize a cell (ECO).

**Syntax:**
```tcl
size_cell <cell_instance> <new_cell>
```

---

### insert_buffer

Insert buffer (ECO).

**Syntax:**
```tcl
insert_buffer <pin> <buffer_cell>
```

---

## Object Query

### get_cells

Get collection of cells.

**Syntax:**
```tcl
get_cells [<pattern>] [-hierarchical] [-filter <expression>]
```

**Example:**
```tcl
get_cells
get_cells -hierarchical -filter "is_hierarchical == false"
```

---

### get_nets

Get collection of nets.

**Syntax:**
```tcl
get_nets [<pattern>] [-hierarchical] [-filter <expression>]
```

---

### get_pins

Get collection of pins.

**Syntax:**
```tcl
get_pins [<pattern>] [-hierarchical] [-filter <expression>]
```

---

### get_ports

Get collection of ports.

**Syntax:**
```tcl
get_ports [<pattern>] [-filter <expression>]
```

---

### get_attribute

Get attribute value.

**Syntax:**
```tcl
get_attribute <object> <attribute_name> [-quiet]
```

**Example:**
```tcl
get_attribute [current_design] full_name
get_attribute [get_timing_paths -max_paths 1] slack
```

---

## Category Index

| Category | Commands |
|----------|----------|
| Library | `open_lib`, `create_lib`, `open_block`, `save_block` |
| Input | `read_verilog`, `read_sdc`, `read_lef`, `read_db` |
| Floorplan | `initialize_floorplan`, `place_macro`, `create_placement_blockage` |
| Power | `create_pg_mesh`, `create_pg_ring`, `connect_pg_net` |
| Placement | `create_placement`, `place_opt`, `legalize_placement` |
| CTS | `clock_opt`, `create_clock_tree`, `report_clock_tree` |
| Routing | `route_auto`, `route_global`, `route_detail`, `route_eco` |
| Verification | `check_design`, `check_routes`, `verify_drc` |
| Reporting | `report_timing`, `report_design`, `report_power`, `report_qor` |
| ECO | `fix_eco_timing`, `size_cell`, `insert_buffer` |
| Objects | `get_cells`, `get_nets`, `get_pins`, `get_ports`, `get_attribute` |
