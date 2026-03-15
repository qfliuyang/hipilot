# ICC2 Power Grid Patterns

Extracted from Synopsys ICC2 example Tcl scripts for power network synthesis (PNS).

---

## Simple Mesh Pattern

### Description
Basic power mesh creation with vertical and horizontal layers.

### Code Pattern
```tcl
create_pg_mesh_pattern mesh_pattern \
   -layers {{{vertical_layer: M6} {width: 0.6}\
             {pitch: 20} {offset: 20}}\
            {{horizontal_layer: M5} {width: 0.6}\
             {pitch: 20} {offset: 20}}}

set_pg_strategy M5M6_mesh \
   -pattern {{name: mesh_pattern} \
             {nets: VDD1 VSS1 VDD2 VSS2}} -core

compile_pg -strategies M5M6_mesh
```

### Usage Context
- Creates a regular mesh on two layers (M5 horizontal, M6 vertical)
- Pitch and offset control strap spacing and alignment
- Multiple power nets can be specified

### Related Patterns
- [Multi-Layer Mesh Pattern](#multi-layer-mesh-pattern)
- [Mesh with Via Rules Pattern](#mesh-with-via-rules-pattern)

---

## Multi-Layer Mesh Pattern

### Description
Complex mesh with multiple metal layers and built-in via rules.

### Code Pattern
```tcl
create_pg_mesh_pattern mesh_pattern -layers { \
      {{vertical_layer: M5} {width: 0.28} {spacing: interleaving} {pitch: 5.6}}  \
      {{horizontal_layer: M8} {width: 0.756} {spacing: interleaving} {pitch: 6.24}} \
      {{vertical_layer: M9} {width: 0.756} {spacing: interleaving} {pitch: 6.24}} \
      {{vertical_layer: M10} {width: 2.4} {spacing: interleaving} {pitch: 6.24}} \
      {{horizontal_layer: M11} {width: 2.4} {spacing: interleaving} {pitch: 6.24}} } \
      -via_rule { \
         {{layers: M5} {layers: M8} {via_master: default}} \
         {{layers: M8} {layers: M9} {via_master: default}} \
         {{layers: M9} {layers: M10} {via_master: default} {between_parallel:true}} \
         {{layers: M10} {layers: M11} {via_master: default}} \
         {{intersection: undefined} {via_master: NIL}} \
      }

set_pg_strategy mesh_strategy -core -pattern \
       {{name: mesh_pattern} {nets: {VDD VSS}}} -extension {{stop: design_boundary}}

set_pg_strategy_via_rule mesh_via_rule -via_rule { \
       {{{strategies: mesh_strategy} {layers: M5}} \
        {{existing: std_conn} {layers: M2}} {via_master: default}} \
       {{intersection: undefined} {via_master: NIL}} \
      }

compile_pg -strategies {mesh_strategy} -via_rule mesh_via_rule
```

### Usage Context
- Use for advanced nodes with multiple power grid layers
- `spacing: interleaving` for alternating VDD/VSS straps
- Via rules define connections between mesh layers
- Extension controls strap termination at boundaries

### Related Patterns
- [Simple Mesh Pattern](#simple-mesh-pattern)
- [Strategy Via Rule Pattern](#strategy-via-rule-pattern)

---

## Three-Layer Mesh with Rails

### Description
Combines mesh straps with standard cell rail connections using custom via masters.

### Code Pattern
```tcl
create_pg_mesh_pattern mesh_pattern \
   -layers {{{vertical_layer: M6} {width: 4}\
             {pitch: 40} {offset: 20}} \
            {{vertical_layer: M4} {width: 2}\
             {pitch: 35} {offset: 20}} \
            {{horizontal_layer: M5} {width:  3}\
             {pitch: 40} {offset: 15}}}

set_pg_strategy M6M5M4_mesh -core \
   -pattern {{name: mesh_pattern} {nets: VDD VSS}}

create_pg_std_cell_conn_pattern rail_pattern -layers M1

set_pg_strategy M1_rails -core \
   -pattern {{name: rail_pattern}{nets: VDD VSS}}

set_pg_via_master_rule VIA_6x1 -via_array_dimension {6 1}

set_pg_strategy_via_rule via_rule  -via_rule {\
    {{{strategies: M6M5M4_mesh} {layers: M4}} \
     {{strategies: M1_rails} {layers: M1}} \
     {via_master: VIA_6x1}} \
       {{intersection: undefined}{via_master: NIL}} \
}

compile_pg -strategies {M6M5M4_mesh M1_rails} -via_rule {via_rule}
```

### Usage Context
- Connects high-level mesh to standard cell rails
- Custom via master rules control via array dimensions
- Multiple vertical layers in same mesh pattern

### Related Patterns
- [Standard Cell Rail Pattern](#standard-cell-rail-pattern)
- [Custom Via Master Pattern](#custom-via-master-pattern)

---

## Standard Cell Rail Pattern

### Description
Creates power/ground rails connecting to standard cell pins.

### Code Pattern
```tcl
# Single layer rails
create_pg_std_cell_conn_pattern rail_pattern -layers M1

set_pg_strategy M1_rails -core \
   -pattern {{name: rail_pattern}{nets: VDD VSS}}

compile_pg -strategies M1_rails

# Multi-layer rails with via rules
create_pg_std_cell_conn_pattern rail_pat -layers {M1 M2}

set_pg_strategy rail_strategy -core -pattern {{name: rail_pat} {nets: {VDD VSS}}}

set_pg_strategy_via_rule rail_via_rule -via_rule \
                         {{intersection: all} {via_master: NIL}}

compile_pg -strategies {rail_strategy} -via_rule rail_via_rule
```

### Usage Context
- M1 rails connect to standard cell power pins
- Can extend to M2 for additional routing resources
- Via rules connect rails to upper layer straps

### Related Patterns
- [Multi-Layer Mesh Pattern](#multi-layer-mesh-pattern)
- [Strategy Via Rule Pattern](#strategy-via-rule-pattern)

---

## Power Ring Pattern

### Description
Creates a power ring around the core or specific regions.

### Code Pattern
```tcl
create_pg_ring_pattern ring_pattern -horizontal_layer M7 \
   -horizontal_width {5} -horizontal_spacing {2} \
   -vertical_layer M8 -vertical_width {5} -vertical_spacing {2}

set_pg_strategy core_ring \
   -pattern {{name: ring_pattern} \
   {nets: {VDD VSS VDD VSS}} {offset: {3 3}}} -core

compile_pg -strategies core_ring
```

### Usage Context
- Rings provide low-resistance power distribution at boundaries
- Can be placed at core boundary or around macros
- Offset controls distance from boundary

### Related Patterns
- [Macro Ring Pattern](#macro-ring-pattern)

---

## Composite Pattern with Parallel Vias

### Description
Advanced pattern combining wire patterns, mesh, and custom via rules.

### Code Pattern
```tcl
create_pg_std_cell_conn_pattern rail_pattern -layers {M1 M2}

set_pg_strategy M1M2_rails -core \
   -pattern {{name: rail_pattern}{nets: VDD VSS}}

create_pg_wire_pattern M3_v \
 -layer M3 -direction vertical -trim false \
 -width 0.24 -pitch {1.0 5.76} \
 -low_end_reference_point 0 -high_end_reference_point 0.16

create_pg_composite_pattern m3p -nets {VDD VSS} -add_patterns {\
 {{pattern: M3_v}{nets: VDD}{offset:  0.0 -0.08}} \
 {{pattern: M3_v}{nets: VSS}{offset: 0.0 2.80}} \
}

set_pg_strategy strategy_M3 -core \
    -pattern {{pattern: m3p}{nets: VDD VSS}} -blockage {{macros: all}}

create_pg_mesh_pattern pg_mesh_M4 \
       -layers { \
         {{horizontal_layer: M4} {width: 0.16} {spacing: interleaving} \
          {pitch: 5.76} {offset: 0} {trim: false}} \
}

set_pg_strategy pg_mesh_strategy_M4 -core \
         -pattern {{pattern: pg_mesh_M4} {nets: {VDD VSS}} } \
         -blockage {{ nets:VDD VSS}{macros:all}}

set_pg_via_master_rule VIA34_1cut -contact_code {VIA34} -via_array_dimension {1 1}

set_pg_via_master_rule VIA23_1cut -contact_code {VIA23} -via_array_dimension {1 1}

set_pg_strategy_via_rule via34_rule  -via_rule {\
    {{{strategies: strategy_M3} {layers: M3}} \
     {{strategies: pg_mesh_strategy_M4} {layers: M4}} \
     {via_master: VIA34_1cut}} \
       {{intersection: undefined}{via_master: NIL}} \
}

set_pg_strategy_via_rule via23_rule  -via_rule {\
    {{{strategies: std_cell_rail_strategy_M2} {layers: M2}} \
     {{strategies: strategy_M3} {layers: M3}} \
     {via_master: VIA23_1cut}} \
       {{intersection: undefined}{via_master: NIL}} \
}

compile_pg -strategies {pg_mesh_strategy_M4 strategy_M3 M1M2_rails} \
       -via_rule {via34_rule via23_rule}
```

### Usage Context
- Complex designs requiring multiple pattern types
- Wire patterns for fine-pitch layers
- Mesh for upper layer distribution
- Blockages prevent straps over macros

### Related Patterns
- [Wire Pattern](#wire-pattern)
- [Strategy Via Rule Pattern](#strategy-via-rule-pattern)

---

## Wire Pattern

### Description
Creates individual wire patterns for specific layers and directions.

### Code Pattern
```tcl
create_pg_wire_pattern M3_v \
 -layer M3 -direction vertical -trim false \
 -width 0.24 -pitch {1.0 5.76} \
 -low_end_reference_point 0 -high_end_reference_point 0.16
```

### Usage Context
- Fine control over individual strap layers
- Used within composite patterns
- Reference points control strap extent

### Related Patterns
- [Composite Pattern with Parallel Vias](#composite-pattern-with-parallel-vias)

---

## Strategy Via Rule Pattern

### Description
Defines via connections between strategies and layers.

### Code Pattern
```tcl
# Simple via rule
set_pg_strategy_via_rule rail_via_rule -via_rule \
                         {{intersection: all} {via_master: NIL}}

# Complex inter-strategy via rule
set_pg_strategy_via_rule via34_rule  -via_rule {\
    {{{strategies: strategy_M3} {layers: M3}} \
     {{strategies: pg_mesh_strategy_M4} {layers: M4}} \
     {via_master: VIA34_1cut}} \
       {{intersection: undefined}{via_master: NIL}} \
}

# Via rule connecting to existing shapes
set_pg_strategy_via_rule mesh_via_rule -via_rule { \
       {{{strategies: mesh_strategy} {layers: M5}} \
        {{existing: std_conn} {layers: M2}} {via_master: default}} \
       {{intersection: undefined} {via_master: NIL}} \
      }
```

### Usage Context
- Defines which vias are created at layer intersections
- `NIL` for no via, `default` for auto-selected, or custom via master
- Can connect strategies to existing shapes (std_conn, rails)

### Related Patterns
- [Custom Via Master Pattern](#custom-via-master-pattern)
- [Multi-Layer Mesh Pattern](#multi-layer-mesh-pattern)

---

## Custom Via Master Pattern

### Description
Creates custom via master rules for specific array dimensions.

### Code Pattern
```tcl
# Single cut via
set_pg_via_master_rule VIA34_1cut -contact_code {VIA34} -via_array_dimension {1 1}

# Array via
set_pg_via_master_rule VIA_6x1 -via_array_dimension {6 1}

# Staple via with multiple contact codes
set_pg_via_master_rule staple_via -contact_code {V1_0_8_3_49_VV V2_3_49_25_0_VH} \
         -allow_multiple {0.054 0} -via_array_dimension {1 1}
```

### Usage Context
- Controls via array size for different connection types
- Staple vias connect straps to standard cell pins
- Array dimensions optimize for current density

### Related Patterns
- [Strategy Via Rule Pattern](#strategy-via-rule-pattern)
- [Stapling Via Pattern](#stapling-via-pattern)

---

## Stapling Via Pattern

### Description
Creates stapling vias connecting straps to standard cell rails.

### Code Pattern
```tcl
set_app_options -name plan.pgroute.honor_std_cell_drc -value true
set_app_options -name plan.pgroute.honor_signal_route_drc -value true

set_pg_via_master_rule staple_via -contact_code {V1_0_8_3_49_VV V2_3_49_25_0_VH} \
         -allow_multiple {0.054 0} -via_array_dimension {1 1}

create_pg_vias -from_layers M3 -to_layers M1 -from_types stripe \
         -to_types lib_cell_pin_connect -nets VSS \
         -allow_parallel_objects -insert_additional_vias \
         -via_masters staple_via -mark_as std_conn -tag stv_vss

create_pg_vias -from_layers M3 -to_layers M1 -from_types  stripe \
         -to_types  lib_cell_pin_connect -nets VDD \
         -allow_parallel_objects -insert_additional_vias \
         -via_masters staple_via -mark_as std_conn -tag stv_vdd
```

### Usage Context
- Post-PG compilation via insertion
- Connects straps (M3) to standard cell pins (M1)
- Marks vias as std_conn for recognition by other tools

### Related Patterns
- [Custom Via Master Pattern](#custom-via-master-pattern)

---

## PG Straps and Vias Pattern

### Description
Direct strap creation and via generation between layers.

### Code Pattern
```tcl
create_pg_strap -layer M4 -direction vertical \
   -net VDD -width 6.0 \
   -start 20 -stop 1500 -pitch 20

create_pg_vias -nets VDD \
   -within_bbox [get_attribute [get_core_area] bbox] \
   -from_layers M5 -to_layers M4
```

### Usage Context
- Direct strap creation without patterns
- Targeted via creation in specific regions
- Useful for manual PG optimization

### Related Patterns
- [Simple Mesh Pattern](#simple-mesh-pattern)

---

## Macro Connection Pattern

### Description
Connects power to hard macros with scattered pins.

### Code Pattern
```tcl
# Scattered pin macro connection
set macros [get_cells \
   -physical_context -filter "is_hard_macro  && !is_physical_only"]
create_pg_macro_conn_pattern macro_connect_pattern \
   -pin_conn_type scattered_pin -nets {VDD VSS} \
   -width {0.3 0.3} -layers {M5 M6}

set_pg_strategy macro_connect \
   -pattern {{name: macro_connect_pattern}{nets: VDDS VSS}} \
   -macros "$macros"

compile_pg -strategies macro_connect

# IO pin connection
set_app_options -name plan.pgroute.treat_pad_as_macro -value true

create_pg_macro_conn_pattern hm_pattern -pin_conn_type scattered_pin \
               -layers {M3 M4} -nets {VSS} -pin_layers {M2}

set_pg_strategy macro_conn -macros [get_cells IO_E1VCC_0] \
               -pattern {{name: hm_pattern} {nets: {VDD VSS}}}

set_pg_strategy_via_rule macro_conn_via_rule \
              -via_rule { \
                 {{{strategies: macro_conn}}{{existing: all} {layers: M4}} \
                   {via_master: default}} \
                  {{intersection: undefined}{via_master: NIL}} \
            }

compile_pg -strategies macro_conn -via_rule macro_conn_via_rule -tag test
```

### Usage Context
- Hard macros need special connection patterns
- `scattered_pin` for irregular pin placement
- IO cells treated as macros for PG connection

### Related Patterns
- [Power Ring Pattern](#power-ring-pattern)

---

## Channel Straps Pattern

### Description
Creates straps in channels between macros.

### Code Pattern
```tcl
create_pg_special_pattern channelPattern -insert_channel_straps { \
   {layer: M1Z}{direction: vertical}{width: 2}{spacing: 2}{channel_threshold: 15} \
   {check_one_layer: true} {channel_between_objects: {macro placement_blockage}}}

set_pg_strategy s_channel -voltage_areas PD_VDD11_I \
                -pattern {{pattern: channelPattern}{nets:VSS VDD11_I}}

compile_pg -strategies s_channel -tag channel
```

### Usage Context
- Fills empty channels between macros with straps
- Threshold controls minimum channel size
- Voltage area-specific strategies

### Related Patterns
- [Blockage Pattern](#blockage-pattern)

---

## Blockage Pattern

### Description
Defines blockages to prevent PG straps in specific areas.

### Code Pattern
```tcl
# Macro blockage
set_pg_strategy strategy_M3 -core \
    -pattern {{pattern: m3p}{nets: VDD VSS}} -blockage {{macros: all}}

# Multiple blockage types
set_pg_strategy pg_mesh_strategy_M4 -core \
         -pattern {{pattern: pg_mesh_M4} {nets: {VDD VSS}} } \
         -blockage {{ nets:VDD VSS}{macros:all}}

# User-defined blockages
set_pg_strategy M8 -core \
    -pattern {{pattern: m3p}{nets: VDD VSS}} \
    -blockage "USER:voltage_areas:PD_B4CORE USER:blocks:I_ORCA_TOP/I_PCI_TOP"
```

### Usage Context
- Prevents straps over macros, blockages, or specific regions
- `macros: all` for all macros
- User-defined for specific cells or voltage areas

### Related Patterns
- [Composite Pattern with Parallel Vias](#composite-pattern-with-parallel-vias)

---

## PG Application Options

### Description
Common application options for power grid routing.

### Code Pattern
```tcl
# Standard DRC honoring
set_app_options -name plan.pgroute.honor_std_cell_drc -value true
set_app_options -name plan.pgroute.honor_signal_route_drc -value true

# Via optimization
set_app_options -name plan.pgroute.maximize_total_cut_area -value all
set_app_options -name plan.pgroute.optimize_via_when_maximize_cutarea -value true
set_app_options -name plan.pgroute.fix_via_drc_multiple_viadef -value true

# Cell handling
set_app_options -name plan.pgroute.treat_fixed_std_cell_as_macro -value true
set_app_options -name plan.pgroute.treat_pad_as_macro -value true

# Advanced options
set_app_options -name plan.pgroute.patch_via_enclosure -value false
set_app_options -name plan.pgroute.realign_straps_for_cell_gap -value true
```

### Usage Context
- Set before PG compilation for desired behavior
- DRC options ensure clean PG with standard cells
- Via optimization improves current capacity

### Related Patterns
- All PG patterns
