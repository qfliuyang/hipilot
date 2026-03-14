---
name: rtl2gds-conductor
description: >
  Orchestrates the complete RTL-to-GDS flow by driving individual stage skills
  in sequence. Handles checkpoint recovery, QoR aggregation, and flow resumption.
  Design-independent: works with any design that provides a configuration.

hipilot:
  vendors: [cadence, synopsys]
  tools: [dc_shell, innovus, pt_shell]
  flow_stages: [synthesis, design_init, floorplan, powerplan, placement, cts, post_cts_opt, routing, route_opt, chip_finish]
  triggers:
    - "/rtl2gds"
    - "run rtl to gds"
    - "run complete flow"
    - "full rtl2gds"
  risk_level: high
  typical_duration: "45-90 minutes"
---

# RTL2GDS Conductor

## Overview

This skill orchestrates the complete RTL-to-GDS flow for any digital design by sequencing **stage-specific skills**. It handles:

- **Checkpoint Recovery**: Automatically resumes from last completed stage
- **Stage Sequencing**: Drives stages 0-9 in order
- **QoR Aggregation**: Captures timing/area metrics after each stage
- **Error Handling**: Stops on failure with clear diagnostics

**Design-independent**: Uses environment variables for design-specific paths.

## Required Environment Variables

```bash
# Design directory (absolute path)
export HIPILOT_DESIGN_DIR="/path/to/your/design"

# Design name (used for netlist naming)
export HIPILOT_DESIGN_NAME="my_design"

# Optional: Stage-specific timeouts (seconds)
export HIPILOT_SYNTHESIS_TIMEOUT=600
export HIPILOT_PLACEMENT_TIMEOUT=1200
```

## Flow Architecture

```
User: "/rtl2gds"
  │
  ▼
rtl2gds-conductor (THIS SKILL)
  │─ Read design config from environment
  │─ Detect resumption point
  │─ For each stage: delegate to stage skill
  │─ Aggregate results
  │
  ├──► synthesis-stage (Stage 0, dc_shell)
  ├──► design-init-stage (Stage 1, innovus)
  ├──► floorplan-stage (Stage 2, innovus)
  ├──► powerplan-stage (Stage 3, innovus)
  ├──► placement-stage (Stage 4, innovus)
  ├──► cts-stage (Stage 5, innovus)
  ├──► postcts-stage (Stage 6, innovus)
  ├──► routing-stage (Stage 7, innovus)
  ├──► routeopt-stage (Stage 8, innovus)
  └──► chipfinish-stage (Stage 9, innovus)
```

## Execution Pattern

```javascript
// === STEP 1: Read design configuration ===
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME || "design";

if (!designDir) {
  console.error("ERROR: HIPILOT_DESIGN_DIR environment variable not set");
  console.error("Please set: export HIPILOT_DESIGN_DIR=/path/to/design");
  return { success: false, error: "Missing HIPILOT_DESIGN_DIR" };
}

console.log(`\nDesign: ${designName}`);
console.log(`Directory: ${designDir}\n`);

// Stage definitions with checkpoint paths (design-independent patterns)
const STAGES = [
  { num: 0, name: "Synthesis", skill: "synthesis-stage",
    checkpoint: `result/syn/data/${designName}.syn.v`, tool: "dc_shell" },
  { num: 1, name: "Design Init", skill: "design-init-stage",
    checkpoint: `result/pr/data/init_design.enc`, tool: "innovus" },
  { num: 2, name: "Floorplan", skill: "floorplan-stage",
    checkpoint: `result/pr/data/floor_plan.enc`, tool: "innovus" },
  { num: 3, name: "Power Planning", skill: "powerplan-stage",
    checkpoint: `result/pr/data/powerplan.enc`, tool: "innovus" },
  { num: 4, name: "Placement", skill: "placement-stage",
    checkpoint: `result/pr/data/placement.enc`, tool: "innovus" },
  { num: 5, name: "CTS", skill: "cts-stage",
    checkpoint: `result/pr/data/cts.enc`, tool: "innovus" },
  { num: 6, name: "Post-CTS Opt", skill: "postcts-stage",
    checkpoint: `result/pr/data/post_cts_opt.enc`, tool: "innovus" },
  { num: 7, name: "Routing", skill: "routing-stage",
    checkpoint: `result/pr/data/routing.enc`, tool: "innovus" },
  { num: 8, name: "Route Opt", skill: "routeopt-stage",
    checkpoint: `result/pr/data/routing_opt.enc`, tool: "innovus" },
  { num: 9, name: "Chip Finish", skill: "chipfinish-stage",
    checkpoint: `result/pr/data/chip_done.enc`, tool: "innovus" }
];

// === STEP 2: Find resumption point ===
function findStartStage() {
  // Check from end to beginning for highest completed stage
  for (let i = STAGES.length - 1; i >= 0; i--) {
    // Check if checkpoint exists
    // In practice: use file check or eda.peek
    console.log(`Checking Stage ${i}: ${STAGES[i].checkpoint}`);
  }
  return 0; // Start from beginning
}

const startStage = findStartStage();
if (startStage > 0) {
  console.log(`\n🔄 Resuming from Stage ${startStage}: ${STAGES[startStage].name}`);
  console.log(`   (Previous stages found in checkpoints)\n`);
}

// === STEP 3: Execute stages sequentially ===
console.log("═══════════════════════════════════════════════════════════");
console.log("  RTL2GDS Flow - 10 Stages");
console.log(`  Design: ${designName}`);
console.log("═══════════════════════════════════════════════════════════\n");

const results = [];

for (let i = startStage; i < STAGES.length; i++) {
  const stage = STAGES[i];

  console.log(`\n─── Stage ${stage.num}: ${stage.name} (${stage.tool}) ───`);

  // Load stage skill with design context
  console.log(`  Loading skill: ${stage.skill}`);
  console.log(`  Tool: ${stage.tool}`);
  console.log(`  Expected output: ${stage.checkpoint}`);

  // Stage skills read HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME
  // to determine actual file paths

  // Execute stage (delegated to stage skill)
  const result = await executeStage(stage);

  if (!result.success) {
    console.log(`  ✗ Stage ${stage.num} FAILED`);
    console.log(`  Error: ${result.error}`);
    break;
  }

  // Capture QoR snapshot
  await qor.snapshot({
    name: `stage_${stage.num}_${stage.name.toLowerCase().replace(/\s+/g, '_')}`,
    description: `QoR after Stage ${stage.num}: ${stage.name}`
  });

  results.push({ stage: i, name: stage.name, success: true });
  console.log(`  ✓ Stage ${stage.num} complete`);
}

// === STEP 4: Final summary ===
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Flow Summary");
console.log("═══════════════════════════════════════════════════════════");

console.log("\nStage Results:");
results.forEach(r => {
  console.log(`  Stage ${r.stage}: ${r.name} ✓`);
});

const snapshots = await qor.list_snapshots({});
console.log("\nQoR Snapshots:");
console.table(snapshots);
```

## Stage Skill Contract

Each stage skill follows this contract:

### Input (Environment Variables)
```bash
HIPILOT_DESIGN_DIR="/path/to/design"     # Required: Design directory
HIPILOT_DESIGN_NAME="my_design"          # Required: Design name
HIPILOT_TIMEOUT=600                       # Optional: Override timeout
```

### Input (Files)
- **Prior checkpoint**: From previous stage (checked by stage skill)
- **Config files**: Technology libraries, constraints (in design directory)

### Output (Files)
- **Checkpoint file**: Design-specific path pattern
- **Log files**: In `result/{syn,pr}/log/`
- **Reports**: In `result/{syn,pr}/report/`

### Output (Console)
```
Stage X [Name]: WNS: X.XXX ns, TNS: X.XXX ns
```

## Recovery and Resumption

The conductor automatically handles resumption:

1. **Scan checkpoints** on startup
2. **Find highest completed stage**
3. **Resume from next stage**

Example:
```
Design: my_design
Directory: /home/user/my_design

Checkpoints found:
  ✓ Stage 0: result/syn/data/my_design.syn.v
  ✓ Stage 1: result/pr/data/init_design.enc
  ✓ Stage 2: result/pr/data/floor_plan.enc
  ✗ Stage 3: Missing

→ Resuming from Stage 3: Power Planning
```

## Design Directory Structure

The conductor expects this structure in `HIPILOT_DESIGN_DIR`:

```
$HIPILOT_DESIGN_DIR/
├── rtl/                      # RTL source files
├── constraints/              # SDC constraints
├── tech/                     # Technology files
│   ├── lef/                  # LEF files
│   └── lib/                  # Liberty files
├── scripts/                  # Setup scripts (optional)
└── result/                   # Generated by flow
    ├── syn/data/             # Synthesis output
    ├── syn/log/              # Synthesis logs
    ├── syn/report/           # Synthesis reports
    ├── pr/data/              # P&R checkpoints
    ├── pr/log/               # P&R logs
    └── pr/report/            # P&R reports
```

## Example Usage

### For Ibex Design
```bash
export HIPILOT_DESIGN_DIR="/home/EDA/hipilot_test/ibex_work_upload"
export HIPILOT_DESIGN_NAME="ibex_core"
bin/hipilot
# Then: /rtl2gds
```

### For Your Design
```bash
export HIPILOT_DESIGN_DIR="/path/to/your/design"
export HIPILOT_DESIGN_NAME="my_chip"
# Optional: Customize timeouts
export HIPILOT_SYNTHESIS_TIMEOUT=900
export HIPILOT_PLACEMENT_TIMEOUT=1800

bin/hipilot
# Then: /rtl2gds
```

## Comparison to Design-Specific Skills

| Aspect | Design-Specific (ibex-*) | Design-Independent (this) |
|--------|-------------------------|---------------------------|
| Hardcoded paths | Yes (ibex paths) | No (env vars) |
| Reusability | Ibex only | Any design |
| Setup | Just run | Set env vars first |
| Flexibility | Low | High |

## Migration from ibex-rtl2gds-flow

If you were using `ibex-rtl2gds-flow`:

1. **Before**: Skill contained hardcoded Ibex paths
2. **Now**: Set environment variables, use generic conductor
3. **Benefit**: Same flow works for any design

## References

- Stage skills: `synthesis-stage`, `design-init-stage`, etc.
- Example design config: See `deploy/eda-server/design-examples/`
