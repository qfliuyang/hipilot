---
name: /postcts-opt
description: >
  Run Stage 6: Post-CTS Optimization using Innovus.
  Fixes setup and hold violations after clock tree synthesis.
  Reports WNS/TNS after optimization (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /postcts-opt

Run Stage 6: Post-CTS Optimization for the current design.

## Prerequisites

**Stage 5 (CTS) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

## What You Do

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/cts.enc`, description: "Load CTS checkpoint"});
eda.await_idle({timeout: 60});
```

### 2. Run post-CTS optimization

Key steps:
1. Run `optDesign -postCTS` for setup fixing
2. Run `optDesign -postCTS -hold` for hold fixing
3. Report timing

```javascript
eda.send_tcl_nonblocking({tcl: "optDesign -postCTS", description: "Post-CTS setup opt"});
eda.await_idle({timeout: 300});

eda.send_tcl_nonblocking({tcl: "optDesign -postCTS -hold", description: "Post-CTS hold opt"});
eda.await_idle({timeout: 300});
```

### 3. Report QoR (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get post-CTS timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 6 Post-CTS Opt: WNS: X.XXX ns, TNS: Y.YYY ns, Hold Violations: N`);

qor.snapshot({name: "postcts_complete", description: "QoR after post-CTS opt"});
```

## Output

- Checkpoint: `result/pr/data/post_cts_opt.enc`
- QoR: Setup and hold timing reported

## Next Step

- Run `/routing` for global and detail routing
