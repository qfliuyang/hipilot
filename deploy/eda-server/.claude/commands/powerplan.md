---
name: /powerplan
description: >
  Run Stage 3: Power Planning using Innovus.
  Adds power rings, stripes, and rail routing for VDD/VSS.
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /powerplan

Run Stage 3: Power Planning for the current design.

## Prerequisites

**Stage 2 (Floorplan) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

## What You Do

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/floor_plan.enc`, description: "Load floorplan"});
eda.await_idle({timeout: 60});
```

### 2. Run power planning

Key steps:
1. Connect global nets (VDD, VSS)
2. Add power ring around core
3. Add power stripes (vertical/horizontal)
4. Route power rails to standard cells
5. Verify power connectivity
6. Save checkpoint

### 3. Report status

```javascript
console.log(`Stage 3 Power Planning: Rings, Stripes, Rails added`);
```

## Output

- Checkpoint: `result/pr/data/powerplan.enc`

## Next Step

- Run `/placement` for standard cell placement
