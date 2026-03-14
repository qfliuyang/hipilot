---
name: /routeopt
description: >
  Run Stage 8: Route Optimization using Innovus.
  Post-route timing and DRC optimization.
  Reports final WNS/TNS before chip finish (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /routeopt

Run Stage 8: Post-Route Optimization for the current design.

## Prerequisites

**Stage 7 (Routing) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

## What You Do

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/routing.enc`, description: "Load routing checkpoint"});
eda.await_idle({timeout: 60});
```

### 2. Run post-route optimization

```javascript
eda.send_tcl_nonblocking({tcl: "optDesign -postRoute", description: "Post-route opt"});
eda.await_idle({timeout: 300});
```

### 3. Final DRC check

```javascript
eda.send_tcl_nonblocking({tcl: "verify_drc", description: "Final DRC check"});
eda.await_idle({timeout: 60});
```

### 4. Report QoR (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 10", description: "Get final timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 8 Route Opt: WNS: X.XXX ns, TNS: Y.YYY ns, DRC Clean: YES/NO`);

qor.snapshot({name: "routeopt_complete", description: "QoR after route opt"});
```

## Output

- Checkpoint: `result/pr/data/routing_opt.enc`
- QoR: Final pre-GDS timing reported

## Next Step

- Run `/chipfinish` for GDS export and final outputs
