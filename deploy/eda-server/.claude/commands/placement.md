---
name: /placement
description: >
  Run Stage 4: Placement using Innovus.
  Places standard cells with timing-driven optimization.
  Reports WNS/TNS after placement (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /placement

Run Stage 4: Standard Cell Placement for the current design.

## Prerequisites

**Stage 3 (Power Planning) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

## What You Do

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/powerplan.enc`, description: "Load powerplan"});
eda.await_idle({timeout: 60});
```

### 2. Run placement

```javascript
eda.send_tcl_nonblocking({tcl: "place_opt_design", description: "Run placement"});
eda.await_idle({timeout: 600}); // Placement takes time
```

### 3. Report QoR (L5 CRITICAL)

```javascript
// Get timing after placement
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get placement timing"});
eda.await_idle({timeout: 30});
const result = eda.get_last_result({lines: 50});

// MUST report EXACT WNS/TNS
console.log(`Stage 4 Placement: WNS: X.XXX ns, TNS: Y.YYY ns`);

// Save QoR snapshot
qor.snapshot({name: "placement_complete", description: "QoR after placement"});
```

## Output

- Checkpoint: `result/pr/data/placement.enc`
- QoR: WNS/TNS reported

## Next Step

- Run `/cts` for clock tree synthesis
