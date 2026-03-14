---
name: /floorplan
description: >
  Run Stage 2: Floorplanning using Innovus.
  Creates die area, core utilization, IO placement, and macro placement.
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /floorplan

Run Stage 2: Floorplanning for the current design.

## Prerequisites

**Stage 1 (Design Init) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

Required:
- `result/pr/data/init_design.enc` - From Stage 1

## What You Do

### 1. Verify checkpoint exists

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const checkpoint = `${designDir}/result/pr/data/init_design.enc`;
```

### 2. Start innovus and load checkpoint

```javascript
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${checkpoint}`, description: "Load checkpoint"});
eda.await_idle({timeout: 60});
```

### 3. Run floorplan

Key steps:
1. Create floorplan with target utilization
2. Place IO pins
3. Place macros (if any)
4. Add placement blockages
5. Save checkpoint

### 4. Report QoR

```javascript
console.log(`Stage 2 Floorplan: Utilization: XX%, Die Area: X.XX mm²`);
```

## Output

- Checkpoint: `result/pr/data/floor_plan.enc`

## Next Step

- Run `/powerplan` to add power rings and stripes
