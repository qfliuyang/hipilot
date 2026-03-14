---
name: /design-init
description: >
  Run Stage 1: Design Initialization using Innovus.
  Loads synthesized netlist, LEF files, and MMMC setup.
  Uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME environment variables.
---

# /design-init

Run Stage 1: Design Initialization for the current design.

## Prerequisites

**Stage 0 (Synthesis) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
```

Required files:
- `result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v` - From Stage 0
- `tech/lef/*.lef` or `tech/lef/*.tlef` - LEF files
- `constraints/${HIPILOT_DESIGN_NAME}.sdc` - Constraints

## What You Do

### 1. Verify synthesis output exists

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;
const netlist = `${designDir}/result/syn/data/${designName}.syn.v`;

// Verify file exists before proceeding
console.log(`Loading netlist: ${netlist}`);
```

### 2. Start innovus

```javascript
eda.start_tool({tool: "innovus", design_dir: designDir});
```

### 3. Initialize design

Key steps:
1. Set LEF files (**Tech LEF first!**)
2. Set netlist path
3. Create MMMC constraint mode
4. Run `init_design`
5. Save checkpoint

### 4. Report status

```javascript
console.log(`Stage 1 Design Init: Cell Count: XXXXX`);
```

## Output

- Checkpoint: `result/pr/data/init_design.enc`

## Next Step

- Run `/floorplan` to create die area and IO placement
