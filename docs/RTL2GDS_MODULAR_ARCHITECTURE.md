# Modular Stage Architecture

## Problem Statement

The original monolithic flow skill (`ibex-rtl2gds-flow.md`) was 42KB+ and attempted to document all 10 stages of the RTL-to-GDS flow in one file. This created several issues:

1. **Context Overload**: Large skills are difficult to process and maintain
2. **Poor Composability**: Cannot run individual stages independently
3. **Hard to Maintain**: One change requires editing a massive file
4. **No Reusability**: Design-specific paths hardcoded throughout
5. **Recovery Complexity**: Resumption logic mixed with execution logic

## Solution: Team Mode + Stage Skills Pattern

The new architecture uses a 6-agent Team Mode to orchestrate the RTL-to-GDS flow, with each stage implemented as a focused, standalone skill.

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                             │
│              "Run synthesis on Ibex design"                 │
│                      or                                     │
│              "/rtl2gds" (full flow)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Team Mode (6-Agent Architecture)               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Supervisor│  │Knowledge │  │ Planner  │  │ Executor │    │
│  │  (Lead)  │  │  (Brain) │  │ (Strategy│  │ (Worker) │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│  ┌────┴─────────────┴─────────────┴─────────────┴─────┐    │
│  │                   Memory Agent                      │    │
│  │              (Checkpoint/Recovery)                  │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                 │
│              ┌────────────┴────────────┐                   │
│              │      Learning Agent      │                   │
│              │   (Pattern Recognition)   │                   │
│              └───────────────────────────┘                   │
└─────────────────────────┬───────────────────────────────────┘
                          │ For each stage:
                          ▼
        ┌───────────────────────────────┐
        │      Stage Skill (synthesis,  │
        │      floorplan, placement,   │
        │      cts, routing, etc.)     │
        │                               │
        │  - Stage-specific Tcl         │
        │  - Tool-appropriate commands  │
        │  - Checkpoint I/O contract    │
        │  - QoR extraction             │
        └───────────────┬───────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │  Checkpoint File  │
              │  (.enc, .v, .db)  │
              └───────────────────┘
```

## Skill Hierarchy

### Level 1: Team Orchestration (6 Agents)
**Agents**: Supervisor, Knowledge, Planner, Executor, Memory, Learning

- **Purpose**: Coordinate the complete flow by sequencing stage skills
- **Knowledge**: Stage sequence, checkpoint names, recovery logic
- **Delegates**: All actual work to stage skills via Executor agent

### Level 2: Stage Skills
**Files**: `skills/{stage}-stage.md` (e.g., `skills/synthesis-stage.md`)

| Stage | Skill File | Tool | Description |
|-------|------------|------|-------------|
| 0 | `synthesis-stage.md` | dc_shell | Logic synthesis |
| 1 | `design-init-stage.md` | innovus | Design initialization |
| 2 | `floorplan-stage.md` | innovus | Floorplanning |
| 3 | `powerplan-stage.md` | innovus | Power planning |
| 4 | `placement-stage.md` | innovus | Placement |
| 5 | `cts-stage.md` | innovus | Clock tree synthesis |
| 6 | `postcts-opt-stage.md` | innovus | Post-CTS optimization |
| 7 | `routing-stage.md` | innovus | Routing |
| 8 | `routeopt-stage.md` | innovus | Route optimization |
| 9 | `chipfinish-stage.md` | innovus | Chip finishing |

Each stage skill:
- **Size**: ~5-10KB (focused, manageable)
- **Knowledge**: Tcl commands, paths, tool-specific settings for that stage
- **Interface**: Standard input/output contract with checkpoint-based I/O

### Level 3: Three-Brain Knowledge System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Three-Brain Architecture                      │
├──────────────────────────────┬──────────────────────────────────┤
│         ASIC-Brain           │         EDA-Brain                │
│    (Methodology Brain)       │    (Tool Knowledge)              │
│  - Tcl generation patterns   │  - Tool commands                 │
│  - Methodology best practices│  - Error patterns                │
│  - Flow stage definitions    │  - Syntax validation             │
└──────────────────────────────┴──────────────────────────────────┘
                             │  General knowledge
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Project-Brain                             │
│              (Design-Specific, Per-Project)                     │
│  - RTL design hierarchy                                         │
│  - Physical design iterations                                   │
│  - Timing closure learnings                                     │
│  - Error patterns for THIS design                               │
└─────────────────────────────────────────────────────────────────┘
```

| Brain | Location | Purpose |
|-------|----------|---------|
| **ASIC-Brain** | `servers/knowledge/asic-brain/` | ASIC methodology, Tcl patterns, flow stages |
| **EDA-Brain** | `servers/knowledge/eda-brain/` | Tool commands, error patterns, syntax |
| **Project-Brain** | `${HIPILOT_DESIGN_DIR}/.project-brain/` | Design-specific memory, iterations, learnings |

## Checkpoint-Based Stage Execution Pattern

Each stage follows a consistent execution pattern:

```javascript
// Standard stage execution pattern
// 1. Verify prerequisites (prior checkpoints exist)
// 2. Start correct tool (dc_shell for Stage 0, innovus for Stages 1-9)
// 3. Load input checkpoint (source checkpoint.enc)
// 4. Execute stage-specific Tcl commands
// 5. Save output checkpoint (saveDesign)
// 6. Exit tool
// 7. Verify output checkpoint exists
// 8. Report QoR (WNS/TNS - L5 requirement)
```

### Checkpoint Recovery Logic

The Memory agent maintains a stage state machine:

```javascript
const STAGES = [
  { num: 0, name: "Synthesis", skill: "synthesis-stage", checkpoint: "result/syn/data/*.v" },
  { num: 1, name: "Design Init", skill: "design-init-stage", checkpoint: "result/pr/data/init_design.enc" },
  { num: 2, name: "Floorplan", skill: "floorplan-stage", checkpoint: "result/pr/data/floorplan.enc" },
  { num: 3, name: "Power Plan", skill: "powerplan-stage", checkpoint: "result/pr/data/powerplan.enc" },
  { num: 4, name: "Placement", skill: "placement-stage", checkpoint: "result/pr/data/placement.enc" },
  { num: 5, name: "CTS", skill: "cts-stage", checkpoint: "result/pr/data/cts.enc" },
  { num: 6, name: "Post-CTS Opt", skill: "postcts-opt-stage", checkpoint: "result/pr/data/postcts.enc" },
  { num: 7, name: "Routing", skill: "routing-stage", checkpoint: "result/pr/data/routing.enc" },
  { num: 8, name: "Route Opt", skill: "routeopt-stage", checkpoint: "result/pr/data/routeopt.enc" },
  { num: 9, name: "Chip Finish", skill: "chipfinish-stage", checkpoint: "result/pr/data/chipfinish.enc" },
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

## Standard Stage Interface

Every stage skill implements this contract:

### Input (YAML Frontmatter)
```yaml
---
name: {stage}-stage
description: Execute Stage X for RTL2GDS
hipilot:
  stage_number: 0  # 0-9
  stage_name: "Synthesis"
  tool: "dc_shell"  # or "innovus", "pt_shell"
  input_checkpoint: null  # or path pattern
  output_checkpoint: "result/syn/data/ibex_core.syn.v"
  timeout: 600
  prior_stages: []  # stage numbers that must complete first
  triggers:
    - "stage 0"
    - "synthesis"
---
```

### Output (Required)
- **Checkpoint file**: Must exist on success
- **QoR Report**: Explicit WNS/TNS numbers (for L5 scoring)
- **Status**: Success/failure with clear message

## Slash Command Interface

Users can invoke stages via slash commands:

| Command | Stage | Description |
|---------|-------|-------------|
| `/synthesis` | 0 | Run synthesis stage |
| `/design-init` | 1 | Initialize design |
| `/floorplan` | 2 | Floorplanning |
| `/powerplan` | 3 | Power planning |
| `/placement` | 4 | Placement |
| `/cts` | 5 | Clock tree synthesis |
| `/postcts-opt` | 6 | Post-CTS optimization |
| `/routing` | 7 | Routing |
| `/routeopt` | 8 | Route optimization |
| `/chipfinish` | 9 | Chip finishing |
| `/rtl2gds` | All | Run full flow via Team Mode |

## Team Mode Execution Flow

```javascript
// Team Mode orchestrates the complete flow

// 1. Supervisor agent detects resumption point
const startStage = findResumeStage();
if (startStage > 0) {
  report(`Resuming from Stage ${startStage} (checkpoints found)`);
}

// 2. Planner agent creates execution plan
const plan = planner.createPlan({
  startStage,
  stages: STAGES,
  designDir: process.env.HIPILOT_DESIGN_DIR
});

// 3. Executor agent runs each stage sequentially
for (let i = startStage; i < STAGES.length; i++) {
  const stage = STAGES[i];

  // Knowledge agent provides context
  const context = knowledge.getContext({ stage: i, tool: stage.tool });

  // Executor delegates to stage skill
  const result = await executor.runStage(stage.skill, context);

  if (!result.success) {
    // Learning agent analyzes failure
    const analysis = learning.analyzeError(result.error);
    report(`Stage ${i} (${stage.name}) FAILED: ${analysis.recommendation}`);
    break;
  }

  // Memory agent captures checkpoint
  memory.saveCheckpoint({ stage: i, checkpoint: stage.checkpoint });

  // Capture QoR snapshot
  qor.snapshot({name: `stage_${i}`, description: `After ${stage.name}`});

  report(`Stage ${i} (${stage.name}) COMPLETE ✓`);
}

// 4. Final report
reportFlowSummary();
```

## Benefits of Modular Architecture

| Aspect | Monolithic (Old) | Modular (New) |
|--------|------------------|---------------|
| **Skill Size** | 42KB (too large) | 5-10KB each (manageable) |
| **Composability** | Cannot run standalone | Each stage is standalone |
| **Stage Recovery** | Complex logic in one file | Simple state machine |
| **Tool Switching** | Manual | Automatic per stage |
| **Maintenance** | Edit 42KB file | Edit focused 10KB file |
| **Reusability** | Design-specific | Pattern reusable |
| **Testing** | All-or-nothing | Test stages independently |
| **Knowledge** | Inline | Three-Brain system |

## File Structure

```
skills/
├── synthesis-stage.md            # Stage 0: Synthesis
├── design-init-stage.md          # Stage 1: Design Init
├── floorplan-stage.md            # Stage 2: Floorplan
├── powerplan-stage.md            # Stage 3: Power Plan
├── placement-stage.md            # Stage 4: Placement
├── cts-stage.md                  # Stage 5: CTS
├── postcts-opt-stage.md          # Stage 6: Post-CTS Opt
├── routing-stage.md              # Stage 7: Routing
├── routeopt-stage.md             # Stage 8: Route Opt
├── chipfinish-stage.md           # Stage 9: Chip Finish
├── synthesis.md                  # Generic reference
├── floorplan.md                  # Generic reference
├── cts.md                        # Generic reference
└── ...                           # Other reference skills

deploy/eda-server/.claude/commands/
├── synthesis.md                  # /synthesis command
├── design-init.md                # /design-init command
├── floorplan.md                  # /floorplan command
├── powerplan.md                  # /powerplan command
├── placement.md                  # /placement command
├── cts.md                        # /cts command
├── postcts-opt.md                # /postcts-opt command
├── routing.md                    # /routing command
├── routeopt.md                   # /routeopt command
├── chipfinish.md                 # /chipfinish command
└── rtl2gds.md                    # /rtl2gds command (Team Mode)

servers/knowledge/
├── asic-brain/                   # ASIC methodology brain
│   └── index.js
├── eda-brain/                    # EDA tool knowledge brain
│   └── index.js
└── project-brain/                # Design-specific memory brain
    └── index.js
```

## Success Criteria

HiTestBot must achieve:
- **L1**: Slash commands respond (`/synthesis`, `/floorplan`, etc.) ✓
- **L2**: Understands stage-specific tasks ✓
- **L3**: Uses correct tool per stage (dc_shell for 0, innovus for 1-9) ✓
- **L4**: Each stage executes without errors ✓
- **L5**: QoR reported after each stage ✓
- **Human-Like**: Incremental, observable progress

## Related Documentation

- [PROJECT_BRAIN_ARCHITECTURE.md](PROJECT_BRAIN_ARCHITECTURE.md) - Three-Brain knowledge system
- `servers/knowledge/asic-brain/` - ASIC methodology brain
- `servers/knowledge/eda-brain/` - EDA tool knowledge brain
- `servers/knowledge/project-brain/` - Design-specific memory brain
