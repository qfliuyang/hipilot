# Innovus Commands

Complete command reference for Cadence Innovus.

## Design Initialization

### init_design

Initialize design with loaded variables.

**Syntax:**
```tcl
init_design
```

**Prerequisites:**
- `init_verilog` - Verilog netlist file
- `init_lef_file` - LEF files (tech LEF first, then cell LEFs)
- `init_top_cell` - Top-level module name
- `init_mmmc_file` - MMMC setup file (optional but recommended)

**Example:**
```tcl
set init_verilog "design.v"
set init_lef_file "tech.tlef cells.lef"
set init_top_cell "top"
set init_mmc_file "mmmc.tcl"
init_design
```

**Related:** `read_lef`, `read_verilog`, `set_top_cell`

---

### read_lef

Read LEF (Library Exchange Format) files.

**Syntax:**
```tcl
read_lef <lef_file> [-tech]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `lef_file` | Path to LEF file |
| `-tech` | Specify this is the technology LEF |

**Example:**
```tcl
read_lef tech.tlef -tech
read_lef cells.lef
```

**Related:** `init_design`, `write_lef`

---

### read_verilog

Read Verilog netlist.

**Syntax:**
```tcl
read_verilog <verilog_file>
```

**Example:**
```tcl
read_verilog design.v
```

---

## Floorplanning

### floorPlan

Create floorplan with various modes.

**Syntax:**
```tcl
floorPlan -site <site> -su <ar> <density> <l> <b> <r> <t>
floorPlan -site <site> -s <width> <height> <l> <b> <r> <t>
floorPlan -site <site> -d <width> <height> <l> <b> <r> <t>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-site <site>` | Site name (e.g., unit, core) |
| `-su <ar> <density>` | Site utilization mode: aspect ratio, density (0.0-1.0) |
| `-s <w> <h>` | Specify core size in sites |
| `-d <w> <h>` | Specify die size in microns |
| `<l> <b> <r> <t>` | Margins: left, bottom, right, top (microns) |

**Example:**
```tcl
# Site utilization mode - 70% density, square aspect ratio
floorPlan -site unit -su 1.0 0.70 10 10 10 10

# Specific die size
floorPlan -site unit -d 1000 1000 10 10 10 10
```

**Related:** `createFloorplan`, `setDrawView`, `fit`

---

### placeInstance

Place a macro or instance at specific location.

**Syntax:**
```tcl
placeInstance <instance_name> <x> <y> [<orientation>]
```

**Orientations:** R0, R90, R180, R270, MX, MY, MXR90, MYR90

**Example:**
```tcl
placeInstance ram_macro_0 100.0 200.0 R0
```

---

### addHaloToBlock

Add placement halo around macro.

**Syntax:**
```tcl
addHaloToBlock <left> <bottom> <right> <top> <instance_name>
```

**Example:**
```tcl
addHaloToBlock 5 5 5 5 ram_macro_0
```

---

## Power Planning

### globalNetConnect

Connect global nets (power/ground).

**Syntax:**
```tcl
globalNetConnect <net_name> -type <type> -inst <pattern> -pin <pattern>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `net_name` | Net to connect (e.g., VDD, VSS) |
| `-type` | Connection type: pgpin, tiehi, tielo |
| `-inst` | Instance pattern (e.g., *, *RAM*) |
| `-pin` | Pin pattern (e.g., VDD, VSS, VPWR, VGND) |

**Example:**
```tcl
globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *
globalNetConnect VDD -type tiehi -inst *
globalNetConnect VSS -type tielo -inst *
```

**Related:** `addStripe`, `addRing`, `sroute`

---

### addStripe

Add power stripes (vertical/horizontal power rails).

**Syntax:**
```tcl
addStripe -nets {<nets>} -layer <layer> -direction <dir> \
  -width <w> -spacing <s> -set_to_set_distance <d> \
  -start <offset> -stop <stop>
```

**Example:**
```tcl
addStripe -nets {VDD VSS} -layer M4 -direction vertical \
  -width 2.0 -spacing 1.0 -set_to_set_distance 40.0 \
  -start_from left -start 10 -stop 990
```

---

### sroute

Standard cell power routing (connects pins to stripes).

**Syntax:**
```tcl
sroute -nets {<nets>} -connect <type>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-nets` | List of nets to route |
| `-connect` | Connection type: {corePin}, {blockPin}, {floating}, etc. |

**Example:**
```tcl
sroute -nets {VDD VSS} -connect {corePin}
sroute -nets {VDD VSS} -connect {blockPin}
```

---

## Placement

### place_opt_design

Place and optimize standard cells.

**Syntax:**
```tcl
place_opt_design [-incremental] [-optimize_flow]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-incremental` | Incremental optimization |
| `-optimize_flow` | Enable optimization flow |

**Example:**
```tcl
place_opt_design
place_opt_design -incremental
```

**Related:** `createBasicPathGroups`, `setOptMode`

---

### createBasicPathGroups

Create basic timing path groups.

**Syntax:**
```tcl
createBasicPathGroups [-expanded] [-prefix <prefix>]
```

**Example:**
```tcl
createBasicPathGroups -expanded
```

---

### setOptMode

Set optimization mode options.

**Syntax:**
```tcl
setOptMode -<option> <value>
```

**Common Options:**
| Option | Description |
|--------|-------------|
| `-effort` | low, medium, high |
| `-fixDRC` | true/false - fix DRC violations |
| `-fixCap` | true/false - fix capacitance violations |
| `-fixTran` | true/false - fix transition violations |
| `-leakageToDynamicRatio` | Ratio for power optimization |
| `-maxDensity` | Maximum placement density |

**Example:**
```tcl
setOptMode -effort high
setOptMode -fixDRC true
setOptMode -maxDensity 0.85
```

---

## Clock Tree Synthesis

### create_ccopt_clock_tree_spec

Create clock tree specification.

**Syntax:**
```tcl
create_ccopt_clock_tree_spec
```

**Example:**
```tcl
create_ccopt_clock_tree_spec
```

---

### ccopt_design

Clock tree synthesis and optimization.

**Syntax:**
```tcl
ccopt_design [-cts] [-route] [-optimize]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-cts` | Run CTS only |
| `-route` | Route clock nets |
| `-optimize` | Optimize after CTS |

**Example:**
```tcl
ccopt_design
ccopt_design -cts
```

**Related:** `create_ccopt_clock_tree_spec`, `set_ccopt_property`

---

### set_ccopt_property

Set CCOpt properties.

**Syntax:**
```tcl
set_ccopt_property <property> <value>
```

**Common Properties:**
| Property | Description |
|----------|-------------|
| `use_default_ndr` | Use non-default rules for clock |
| `target_max_trans` | Target max transition |
| `target_skew` | Target skew value |

**Example:**
```tcl
set_ccopt_property use_default_ndr false
set_ccopt_property target_max_trans 0.1
```

---

## Routing

### routeDesign

Global and detailed routing.

**Syntax:**
```tcl
routeDesign [-global] [-detail] [-opt]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-global` | Global routing only |
| `-detail` | Detailed routing only |
| `-opt` | Post-route optimization |

**Example:**
```tcl
routeDesign
routeDesign -global
routeDesign -detail
```

---

### verify_drc

Verify design rule compliance.

**Syntax:**
```tcl
verify_drc [-report <file>]
```

**Example:**
```tcl
verify_drc -report drc.rpt
```

---

### verifyConnectivity

Verify net connectivity.

**Syntax:**
```tcl
verifyConnectivity [-report <file>]
```

---

## Reporting

### report_timing

Report timing analysis.

**Syntax:**
```tcl
report_timing [-max_paths <n>] [-late] [-early] [-from <pin>] [-to <pin>]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `-max_paths <n>` | Number of paths to report |
| `-late` | Report setup (late) paths |
| `-early` | Report hold (early) paths |
| `-from` | Start point filter |
| `-to` | End point filter |

**Example:**
```tcl
report_timing -max_paths 100 -late
report_timing -max_paths 10 -early
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
report_power [-outfile <file>]
```

---

## Save/Restore

### saveDesign

Save design checkpoint.

**Syntax:**
```tcl
saveDesign <checkpoint_name>
```

**Example:**
```tcl
saveDesign placed.enc
```

---

### restoreDesign

Restore design from checkpoint.

**Syntax:**
```tcl
restoreDesign <checkpoint_name> [<top_cell>]
```

**Example:**
```tcl
restoreDesign placed.enc top
```

---

### source

Source Tcl script.

**Syntax:**
```tcl
source <script_file>
```

---

## Export

### streamOut

Export GDSII file.

**Syntax:**
```tcl
streamOut <file> [-mapFile <map>] [-stripes <layers>]
```

**Example:**
```tcl
streamOut design.gds -mapFile gds.map
```

---

### defOut

Export DEF file.

**Syntax:**
```tcl
defOut <file>
```

---

### saveNetlist

Save netlist.

**Syntax:**
```tcl
saveNetlist <file> [-includePowerGround]
```

---

## Category Index

| Category | Commands |
|----------|----------|
| Design Init | `init_design`, `read_lef`, `read_verilog` |
| Floorplan | `floorPlan`, `placeInstance`, `addHaloToBlock` |
| Power | `globalNetConnect`, `addStripe`, `addRing`, `sroute` |
| Placement | `place_opt_design`, `createBasicPathGroups`, `setOptMode` |
| CTS | `ccopt_design`, `create_ccopt_clock_tree_spec`, `set_ccopt_property` |
| Routing | `routeDesign`, `verify_drc`, `verifyConnectivity` |
| Reporting | `report_timing`, `report_design`, `report_power` |
| Save/Restore | `saveDesign`, `restoreDesign`, `source` |
| Export | `streamOut`, `defOut`, `saveNetlist` |
