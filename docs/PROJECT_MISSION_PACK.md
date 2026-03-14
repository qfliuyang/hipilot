# Project Mission Pack

## Overview

The **Project Mission Pack** is a configuration file that defines what HiPilot should do for a specific design. It contains all design-specific details, allowing HiPilot to be completely design-agnostic while still handling any project effectively.

The mission pack serves as the **single source of truth** for project configuration, enabling:
- Design-agnostic HiPilot core (no hardcoded paths)
- Portable project definitions (shareable, version-controlled)
- Reproducible flows (same inputs = same outputs)
- Multi-project support (switch designs by switching mission packs)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project Mission Pack                          │
│                     (hipilot-mission.yaml)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Project   │  │    Design   │  │    Flow     │             │
│  │   Identity  │  │   Structure │  │  Definition │             │
│  │             │  │             │  │             │             │
│  │ - name      │  │ - rtl files │  │ - stages    │             │
│  │ - version   │  │ - constraints│ │ - targets   │             │
│  │ - author    │  │ - libraries │  │ - recipes   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Technology  │  │   Tool      │  │   Custom    │             │
│  │    Setup    │  │  Overrides  │  │   Scripts   │             │
│  │             │  │             │  │             │             │
│  │ - PDK       │  │ - Innovus   │  │ - Pre-hook  │             │
│  │ - libraries │  │ - DC        │  │ - Post-hook │             │
│  │ - LEF/DEF   │  │ - PT        │  │ - Tcl lib   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Three-Brain System                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   ASIC-Brain    │   EDA-Brain     │       Project-Brain         │
│  (Methodology)  │  (Tool Knowl.)  │      (Learned Memory)       │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Team Mode Agents                             │
│  Supervisor → Knowledge → Planner → Executor → Memory → Learning │
└─────────────────────────────────────────────────────────────────┘
```

## Mission Pack Schema

### 1. Project Identity (`project`)

```yaml
project:
  name: "ibex_core"                    # Design name (matches top module)
  description: "Ibex RISC-V Core"       # Human-readable description
  version: "1.0.0"                      # Mission pack version
  author: "Engineer Name"               # Who created this pack
  created: "2026-03-14"                 # Creation date
  license: "Apache-2.0"                 # License (optional)
```

### 2. Design Structure (`design`)

```yaml
design:
  # RTL Sources
  rtl:
    top_module: "ibex_core"             # Top-level module name
    language: "systemverilog"           # verilog | systemverilog | vhdl
    files:                              # List of RTL files
      - "rtl/ibex_core.sv"
      - "rtl/ibex_alu.sv"
      - "rtl/ibex_decoder.sv"
    include_dirs:                       # Include search paths
      - "rtl/include"
    defines:                            # Verilog defines
      - "SYNTHESIS"
      - "RV32I"

  # Constraints
  constraints:
    sdc:
      - "constraints/ibex_core.sdc"     # Timing constraints
    upf:                                # Power intent (optional)
      - "constraints/ibex_core.upf"

  # Floorplan (optional - can be auto-generated)
  floorplan:
    die_area: [1000, 1000]              # [width, height] in microns
    core_utilization: 0.70              # Target utilization
    aspect_ratio: 1.0                   # width/height ratio
    core_margin: [10, 10, 10, 10]       # [left, bottom, right, top]

  # Library Setup
  libraries:
    target:                             # Target libraries (priority order)
      - "lib/sky130_ff_1v95_125c.lib"
      - "lib/sky130_ss_1v60_100c.lib"
    link:                               # Link libraries
      - "lib/sky130_ff_1v95_125c.lib"
    lef:                                # Physical libraries
      - "lef/sky130_fd_sc_hd.tlef"      # Tech LEF first!
      - "lef/sky130_fd_sc_hd.lef"
    gds:                                # GDS for DRC/LVS
      - "gds/sky130_fd_sc_hd.gds"
    pdk_root: "/path/to/pdk"            # PDK root directory
```

### 3. Flow Definition (`flow`)

```yaml
flow:
  # Stages to execute (in order)
  stages:
    - synthesis
    - design_init
    - floorplan
    - powerplan
    - placement
    - cts
    - post_cts_opt
    - routing
    - route_opt
    - chip_finish

  # Skip specific stages (optional)
  skip_stages: []

  # Target metrics (QoR targets)
  targets:
    timing:
      wns: 0.0                          # Worst Negative Slack target (ns)
      tns: 0.0                          # Total Negative Slack target (ns)
      freq: 100.0                       # Target frequency (MHz)
    area:
      max_utilization: 0.75             # Maximum utilization
      max_area: 100000.0                # Maximum area (um^2)
    power:
      max_leakage: 10.0                 # Max leakage power (mW)
      max_dynamic: 100.0                # Max dynamic power (mW)

  # Stage-specific recipes
  recipes:
    synthesis:
      effort: "high"                    # low | medium | high
      strategy: "area"                  # area | timing | power | balanced
      enable_dft: true                  # Enable scan insertion
    placement:
      effort: "high"
      optimization: "timing"            # timing | congestion | power
    cts:
      target_skew: 100.0                # Target clock skew (ps)
      target_latency: 500.0             # Target latency (ps)
```

### 4. Technology Setup (`technology`)

```yaml
technology:
  node: "130nm"                         # Process node
  foundry: "skywater"                   # Foundry name
  process: "sky130"                     # Process name

  # Metal stack configuration
  metal_layers:
    count: 6
    preferred_directions:               # Preferred routing directions
      M1: "vertical"
      M2: "horizontal"
      M3: "vertical"
      M4: "horizontal"
      M5: "vertical"
      M6: "horizontal"
    pitch: [0.46, 0.68, 0.46, 0.68, 0.68, 0.68]  # Layer pitches

  # Power domains
  power:
    vdd:
      net: "VDD"
      voltage: 1.8
    vss:
      net: "VSS"
      voltage: 0.0

  # Corner definitions for MMMC
  corners:
    typical:
      temperature: 25
      voltage: 1.8
      lib: "lib/sky130_typ_1v80_25c.lib"
    fast:
      temperature: 125
      voltage: 1.95
      lib: "lib/sky130_ff_1v95_125c.lib"
    slow:
      temperature: 100
      voltage: 1.60
      lib: "lib/sky130_ss_1v60_100c.lib"
```

### 5. Tool Overrides (`tools`)

```yaml
tools:
  # Tool-specific settings
  innovus:
    version: "20.10"                    # Expected tool version
    common_tcl: |
      # Tcl code to run at tool start
      setDesignMode -process 130
      setMultiCpuUsage -localCpu 8
    stage_tcl:                          # Stage-specific Tcl
      floorplan: |
        # Additional floorplan commands
      placement: |
        # Additional placement commands

  design_compiler:
    version: "T-2022.03"
    common_tcl: |
      set_app_var target_library $TARGET_LIB
      set_app_var link_library $LINK_LIB
    compile_options: "-gate_clock -retime"

  prime_time:
    version: "T-2022.03"
    common_tcl: |
      set_app_var svr_enable_vpp true
```

### 6. Custom Scripts (`custom`)

```yaml
custom:
  # Pre-stage hooks (run before each stage)
  pre_hooks:
    synthesis: |
      echo "Starting synthesis for $DESIGN_NAME"
      # Custom preprocessing

  # Post-stage hooks (run after each stage)
  post_hooks:
    synthesis: |
      echo "Synthesis complete"
      # Custom analysis

  # Tcl library files to source
  tcl_libraries:
    - "scripts/utilities.tcl"
    - "scripts/procedures.tcl"

  # Environment variables to set
  environment:
    CUSTOM_VAR: "custom_value"
    PDK_ROOT: "/path/to/pdk"
```

## Usage

### Loading a Mission Pack

HiPilot loads the mission pack from (in order of priority):
1. `HIPILOT_MISSION_PACK` environment variable (path to file)
2. `${HIPILOT_DESIGN_DIR}/hipilot-mission.yaml`
3. `${HIPILOT_DESIGN_DIR}/hipilot-mission.json`

### Mission Pack API

```javascript
// Load mission pack
const { loadMissionPack } = require('./src/mission-pack');
const mission = loadMissionPack('/path/to/design');

// Access configuration
console.log(mission.project.name);           // "ibex_core"
console.log(mission.design.rtl.top_module);  // "ibex_core"
console.log(mission.flow.stages);            // ['synthesis', ...]

// Get tool configuration for current stage
const toolConfig = mission.getToolConfig('innovus', 'floorplan');

// Get libraries for specific corner
const libs = mission.getLibraries('fast');

// Validate mission pack
const validation = mission.validate();
// => { valid: true } or { valid: false, errors: [...] }
```

### Integration with Three-Brain Architecture

| Brain | Uses Mission Pack For |
|-------|----------------------|
| **ASIC-Brain** | Flow stages, recipes, target metrics, methodology |
| **EDA-Brain** | Tool configurations, Tcl snippets, version requirements |
| **Project-Brain** | Design name, structure, learned data storage |

### Integration with Team Mode

| Agent | Uses Mission Pack For |
|-------|----------------------|
| **Supervisor** | Overall flow definition, stage sequencing |
| **Knowledge** | Library locations, PDK setup, tool versions |
| **Planner** | Stage recipes, target metrics, constraints |
| **Executor** | Tool commands, Tcl snippets, file paths |
| **Memory** | Design identity, checkpoint locations |
| **Learning** | Target QoR metrics for optimization |

## Example: Minimal Mission Pack

```yaml
project:
  name: "simple_design"
  description: "A simple example design"

design:
  rtl:
    top_module: "top"
    files:
      - "rtl/top.v"
  constraints:
    sdc:
      - "top.sdc"
  libraries:
    target:
      - "tech.lib"
    lef:
      - "tech.tlef"
      - "cells.lef"

flow:
  stages:
    - synthesis
    - design_init
    - floorplan
    - placement
    - cts
    - routing
    - chip_finish
```

## Example: Complete Mission Pack (Ibex)

See `examples/mission-packs/ibex-mission.yaml` for a complete example.

## Migration from Legacy Setup

Projects that don't have a mission pack can be auto-detected:

```yaml
# Auto-generated mission pack from legacy setup
design:
  rtl:
    top_module: "auto_detected"  # Detected from directory structure
    files: []                     # Will scan for *.v, *.sv files
    auto_detect: true

  libraries:
    auto_detect: true             # Search for *.lib, *.lef files
```

## Implementation

The mission pack system is implemented in:
- `src/mission-pack/index.js` - Core mission pack loader
- `src/mission-pack/validator.js` - Schema validation
- `src/mission-pack/auto-detect.js` - Auto-detection for legacy projects
