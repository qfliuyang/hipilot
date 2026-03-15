# Project Mission Pack

The **Project Mission Pack** is HiPilot's configuration system that defines what should be done for a specific design. It is a **human-written Markdown document** where engineers describe their design in natural language.

## Quick Start

### 1. Create a Mission Pack

Create a `hipilot-mission.md` in your design directory and write naturally:

```markdown
# Mission Pack: My CPU Design

## Project Overview

I want to run RTL-to-GDS for my **RISC-V CPU** using the **Skywater 130nm PDK**.
Target frequency is 100 MHz. The design has about 10,000 cells.

## Design Files

### RTL Source
- `rtl/cpu_top.v` - Top module `cpu_top`
- `rtl/alu.v` - ALU
- `rtl/control.v` - Control unit

Use `SYNTHESIS` define during synthesis.

### Constraints
Timing constraints: `constraints/cpu_top.sdc`

### Libraries
- LEF: `lef/sky130.tlef`, `lef/sky130.lef`
- Liberty: `lib/sky130.lib`

## Flow Requirements

Run synthesis through chip finish:
Synthesis → Design Init → Floorplan → Placement → CTS → Routing → Chip Finish

Enable DFT scan insertion. Target 70% utilization.

## Target QoR

100 MHz clock. WNS must be positive. Max area 500x500 microns.
```

### 2. How HiPilot Reads It

The Knowledge Agent parses the natural language mission pack and extracts:
- Project name and description
- RTL file paths and top module
- Library paths (LEF, Liberty, GDS)
- Flow stages to execute
- Target QoR metrics
- Special instructions

### 3. Loading Priority

HiPilot looks for mission packs in this order:

1. `HIPILOT_MISSION_PACK` environment variable
2. `${HIPILOT_DESIGN_DIR}/hipilot-mission.md`
3. `${HIPILOT_DESIGN_DIR}/hipilot-mission.yaml` (legacy YAML support)
4. Auto-detect (if no mission pack exists)

## File Structure

```
src/mission-pack/
├── index.js                  # Core MissionPack class and loader
├── parser.js                 # Natural language Markdown parser
├── validator.js              # Schema validation
├── auto-detect.js            # Auto-detection for legacy projects
├── three-brain-integration.js # Integration with Three-Brain architecture
└── README.md                 # This file
```

## Writing a Mission Pack

### Natural Language Format

Write in Markdown with these sections:

| Section | What to Include |
|---------|-----------------|
| `# Mission Pack: Name` | Project title |
| `## Project Overview` | Design name, PDK, goals, cell count |
| `## Design Files` | RTL files, top module, constraints |
| `## Libraries` | LEF, Liberty, GDS file paths |
| `## Flow Requirements` | Stages to run, special settings |
| `## Target QoR` | Timing, area, power targets |
| `## Special Instructions` | Tool versions, custom Tcl, hooks |

### Tips for Best Results

1. **Be explicit about file paths** - Use relative paths from design directory
2. **Specify the top module** - "The top module is `ibex_core`"
3. **List all RTL files** - Or say "all files in `rtl/` directory"
4. **Include tech LEF first** - "Tech LEF must be first: `tech.tlef`"
5. **State target frequency** - "Target 100 MHz" or "10ns clock period"
6. **Mention PDK/process** - "Skywater 130nm" or "tsmc65`

### Example Excerpts

**Specifying RTL:**
```markdown
The RTL is in SystemVerilog. Top module is `cpu_top`.
Files: `rtl/cpu_top.sv`, `rtl/alu.sv`, `rtl/control.sv`
```

**Specifying Libraries:**
```markdown
Libraries:
- Tech LEF: `lef/sky130_fd_sc_hd.tlef` (load this first!)
- Cell LEF: `lef/sky130_fd_sc_hd.lef`
- Timing: `lib/sky130_tt.lib`
```

**Specifying Flow:**
```markdown
Run full RTL-to-GDS: synthesis, floorplan, placement, CTS, routing, chip finish.
Use Innovus v20.10. Enable scan insertion. Target 68% utilization.
```

**Specifying Targets:**
```markdown
Target 100 MHz (10ns period). WNS must be >= 0. Max area 450x450 microns.
```

## Integration with Three-Brain Architecture

The Knowledge Agent parses the mission pack and routes information to the appropriate brain:

| Brain | Extracted From Mission Pack |
|-------|----------------------------|
| **ASIC-Brain** | Flow stages, target metrics, methodology |
| **EDA-Brain** | Tool versions, configurations, file paths |
| **Project-Brain** | Design name, structure, checkpoint locations |

## Integration with Team Mode

Each agent queries the Knowledge Agent for mission pack information:

| Agent | Uses Mission Pack For |
|-------|----------------------|
| **Supervisor** | Overall flow definition, stage sequencing |
| **Knowledge** | Parsing and distributing to 3 brains |
| **Planner** | Target metrics, constraints, strategy |
| **Executor** | Tool configs, file paths, recipes |
| **Archivist** | Design identity, QoR targets |

## Legacy YAML Support

For backward compatibility, YAML mission packs are still supported:
- `hipilot-mission.yaml` or `hipilot-mission.yml`
- Same information in structured YAML format
- Markdown is preferred for human readability

See `docs/PROJECT_MISSION_PACK.md` for complete documentation.
