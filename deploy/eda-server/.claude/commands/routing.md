---
name: /routing
description: >
  Run Stage 7: Routing using Innovus.
  Performs global and detail routing with DRC cleanup.
  Reports WNS/TNS after routing (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /routing

Run Stage 7: Global and Detail Routing for the current design.

## Prerequisites

**Stage 6 (Post-CTS Opt) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

## What You Do

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/post_cts_opt.enc`, description: "Load post-CTS checkpoint"});
eda.await_idle({timeout: 60});
```

### 2. Run routing

```javascript
eda.send_tcl_nonblocking({tcl: "route_design", description: "Run routing"});
eda.await_idle({timeout: 1200}); // Longest stage
```

### 3. Check and fix DRC violations

```javascript
eda.send_tcl_nonblocking({tcl: "verify_drc", description: "Check DRC"});
eda.await_idle({timeout: 60});
```

### 4. Report QoR (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get routing timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 7 Routing: WNS: X.XXX ns, TNS: Y.YYY ns, DRC Violations: N`);

qor.snapshot({name: "routing_complete", description: "QoR after routing"});
```

## Output

- Checkpoint: `result/pr/data/routing.enc`
- QoR: WNS/TNS and DRC status reported

## Next Step

- Run `/routeopt` for post-route optimization
