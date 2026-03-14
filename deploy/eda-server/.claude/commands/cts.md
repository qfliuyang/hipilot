---
name: /cts
description: >
  Run Stage 5: Clock Tree Synthesis using Innovus.
  Builds clock tree with skew balancing and NDR rules.
  Reports WNS/TNS after CTS (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /cts

Run Stage 5: Clock Tree Synthesis for the current design.

## Prerequisites

**Stage 4 (Placement) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

## What You Do

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/placement.enc`, description: "Load placement"});
eda.await_idle({timeout: 60});
```

### 2. Run CTS

Key steps:
1. Create clock tree spec
2. Run `ccopt_design`
3. Verify clock skew
4. Report timing

```javascript
eda.send_tcl_nonblocking({tcl: "create_ccopt_clock_tree_spec", description: "Create CTS spec"});
eda.await_idle({timeout: 30});

eda.send_tcl_nonblocking({tcl: "ccopt_design", description: "Run CTS"});
eda.await_idle({timeout: 600});
```

### 3. Report QoR (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get CTS timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 5 CTS: WNS: X.XXX ns, TNS: Y.YYY ns, Clock Skew: Z.ZZZ ps`);

qor.snapshot({name: "cts_complete", description: "QoR after CTS"});
```

## Output

- Checkpoint: `result/pr/data/cts.enc`
- QoR: WNS/TNS, clock skew reported

## Next Step

- Run `/postcts-opt` for post-CTS optimization
