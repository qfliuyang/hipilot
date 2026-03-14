# Modular RTL2GDS Architecture

## Problem Statement

The current `ibex-rtl2gds-flow.md` skill is 42KB+ and attempts to document all 10 stages of the RTL-to-GDS flow in one file. This creates several issues:

1. **Context Overload**: HiTestBot struggles with large skills (>15KB)
2. **Poor Composability**: Cannot run individual stages independently
3. **Hard to Maintain**: One change requires editing a massive file
4. **No Reusability**: Ibex-specific paths hardcoded throughout
5. **Recovery Complexity**: Resumption logic mixed with execution logic

## Solution: Conductor + Stage Skills Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                             │
│              "Run RTL2GDS on Ibex design"                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Skill: rtl2gds-conductor                       │
│         (Orchestrator - knows WHAT to do)                   │
│  - Maintains stage sequence                                 │
│  - Handles checkpoint recovery                              │
│  - Delegates execution to stage skills                      │
│  - Aggregates QoR across stages                             │
└─────────────────────┬───────────────────────────────────────┘
                      │  For each stage:
                      ▼
        ┌───────────────────────────────┐
        │   Stage Skill (ibex-*-stage)  │
        │    (Worker - knows HOW)       │
        │  - Ibex-specific Tcl          │
        │  - Stage-specific timeout     │
        │  - Single responsibility      │
        └───────────────┬───────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │  Checkpoint File  │
              │  (.enc, .v, etc)  │
              └───────────────────┘
```

## Skill Hierarchy

### Level 1: Conductor (Orchestrator)
**File**: `skills/rtl2gds-conductor.md`
- **Purpose**: Drive the complete flow by sequencing stage skills
- **Size**: ~5KB (just orchestration logic)
- **Knowledge**: Stage sequence, checkpoint names, recovery logic
- **Delegates**: All actual work to stage skills

### Level 2: Design-Specific Stage Skills
**Files**: `skills/ibex-{stage}-stage.md` (e.g., `ibex-synthesis-stage.md`)
- **Purpose**: Execute ONE stage with design-specific parameters
- **Size**: ~8-12KB each (focused, manageable)
- **Knowledge**: Tcl commands, paths, tool-specific settings for that stage
- **Interface**: Standard input/output contract

### Level 3: Generic Skills (Existing)
**Files**: `skills/synthesis.md`, `skills/floorplan.md`, etc.
- **Purpose**: Reference documentation, methodology
- **Used by**: Both conductor (for patterns) and users (for learning)

## Standard Stage Interface

Every stage skill MUST implement this contract:

### Input (YAML Frontmatter)
```yaml
---
name: ibex-{stage}-stage
description: Execute Stage X for Ibex RTL2GDS
hipilot:
  stage_number: 0  # 0-9
  stage_name: "Synthesis"
  tool: "dc_shell"  # or "innovus", "pt_shell"
  input_checkpoint: null  # or path pattern
  output_checkpoint: "result/syn/data/ibex_core.syn.v"
  timeout: 600
  prior_stages: []  # stage numbers that must complete first
  triggers:
    - "ibex stage 0"
    - "ibex synthesis"
---
```

### Execution Pattern
```javascript
// Standard stage execution pattern (documented in each skill)
// 1. Verify prerequisites (prior checkpoints exist)
// 2. Start correct tool
// 3. Send Tcl
// 4. Wait with await_idle
// 5. Verify output checkpoint
// 6. Report QoR (WNS/TNS - L5 requirement)
```

### Output (Required)
- **Checkpoint file**: Must exist on success
- **QoR Report**: Explicit WNS/TNS numbers (for L5 scoring)
- **Status**: Success/failure with clear message

## Checkpoint Recovery Logic

The conductor maintains a stage state machine:

```javascript
const STAGES = [
  { num: 0, name: "Synthesis", skill: "ibex-synthesis-stage", checkpoint: "result/syn/data/ibex_core.syn.v" },
  { num: 1, name: "Design Init", skill: "ibex-design-init-stage", checkpoint: "result/pr/data/init_design.enc" },
  // ... etc
];

// Recovery: Find highest completed stage
function findResumeStage() {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (checkpointExists(STAGES[i].checkpoint)) {
      return i + 1; // Resume from next stage
    }
  }
  return 0; // Start from beginning
}
```

## Conductor Execution Flow

```javascript
// Pseudo-code from rtl2gds-conductor skill

// 1. Detect resumption point
const startStage = findResumeStage();
if (startStage > 0) {
  report(`Resuming from Stage ${startStage} (checkpoints found)`);
}

// 2. Execute each stage sequentially
for (let i = startStage; i < STAGES.length; i++) {
  const stage = STAGES[i];

  // Delegate to stage skill
  const result = await executeStageSkill(stage.skill);

  if (!result.success) {
    report(`Stage ${i} (${stage.name}) FAILED`);
    report(result.error);
    break; // Stop on failure
  }

  // Capture QoR snapshot
  qor.snapshot({name: `stage_${i}`, description: `After ${stage.name}`});

  report(`Stage ${i} (${stage.name}) COMPLETE ✓`);
}

// 3. Final report
reportFlowSummary();
```

## Benefits of Modular Architecture

| Aspect | Monolithic (Current) | Modular (Proposed) |
|--------|---------------------|-------------------|
| **Skill Size** | 42KB (too large) | 5KB + 10×10KB (manageable) |
| **HiTestBot L2** | Poor (too much context) | Good (focused skills) |
| **Stage Recovery** | Complex logic in one file | Simple state machine |
| **Individual Stages** | Cannot run standalone | Each is a standalone skill |
| **Maintenance** | Edit 42KB file | Edit focused 10KB file |
| **Reusability** | Ibex-only | Pattern reusable for other designs |
| **Testing** | All-or-nothing | Test stages independently |

## Migration Path

### Phase 1: Create Infrastructure
1. Create `rtl2gds-conductor.md` (orchestrator)
2. Create `ibex-synthesis-stage.md` (Stage 0)
3. Create `ibex-design-init-stage.md` (Stage 1)
4. Test with HiTestBot

### Phase 2: Complete Stage Skills
5. Create remaining stage skills (2-9)
6. Update conductor to use all stages
7. Deprecate `ibex-rtl2gds-flow.md`

### Phase 3: Generic Pattern
8. Document pattern for other designs
9. Create template stage skills
10. Update documentation

## File Structure

```
skills/
├── rtl2gds-conductor.md          # NEW: Orchestrator
├── ibex-synthesis-stage.md       # NEW: Stage 0
├── ibex-design-init-stage.md     # NEW: Stage 1
├── ibex-floorplan-stage.md       # NEW: Stage 2
├── ibex-powerplan-stage.md       # NEW: Stage 3
├── ibex-placement-stage.md       # NEW: Stage 4
├── ibex-cts-stage.md             # NEW: Stage 5
├── ibex-postcts-stage.md         # NEW: Stage 6
├── ibex-routing-stage.md         # NEW: Stage 7
├── ibex-routeopt-stage.md        # NEW: Stage 8
├── ibex-chipfinish-stage.md      # NEW: Stage 9
├── synthesis.md                  # EXISTING: Generic reference
├── floorplan.md                  # EXISTING: Generic reference
├── cts.md                        # EXISTING: Generic reference
├── ibex-rtl2gds-flow.md          # DEPRECATED: Keep for reference
└── rtl2gds-flow.md               # EXISTING: Generic reference
```

## Success Criteria

HiTestBot must achieve:
- **L1**: Conductor responds to `/rtl2gds` ✓
- **L2**: Understands it's orchestrating stages ✓
- **L3**: Uses `knowledge.get_skill` to load stage skills ✓
- **L3b**: Correct tool per stage (dc_shell for 0, innovus for 1-9) ✓
- **L4**: Each stage executes without errors ✓
- **L5**: QoR reported after each stage ✓
- **Human-Like**: Incremental, observable progress
