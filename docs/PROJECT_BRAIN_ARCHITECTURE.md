# Project-Brain Architecture

## Overview

**Project-Brain** is a per-design, progressively disclosing knowledgebase that learns and remembers design-specific information throughout the RTL-to-GDS flow. It complements ASIC-Brain and EDA-Brain (general EDA reasoning) with project-specific context.

## Brain Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Three-Brain Architecture                      │
├──────────────────────────────┬──────────────────────────────────┤
│         ASIC-Brain           │         EDA-Brain                │
│    (Formerly LittleBrain)    │    (Tool Knowledge)              │
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
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ RTL Memory  │      │ Floorplan   │      │ Timing      │
│  (Stage 0)  │      │  Memory     │      │  Memory     │
│             │      │  (Stage 2)  │      │ (All Stages)│
│ - Hierarchy │      │             │      │             │
│ - Modules   │      │ - Die area  │      │ - WNS/TNS   │
│ - Issues    │      │ - IO issues │      │ - Violations│
└─────────────┘      └─────────────┘      └─────────────┘
```

## General vs Project-Specific Brains

| Aspect | ASIC-Brain / EDA-Brain (General) | Project-Brain (Specific) |
|--------|----------------------------------|--------------------------|
| **Scope** | All EDA designs | One specific design |
| **Lifetime** | Permanent | Project duration |
| **Content** | Tool syntax, patterns | Design hierarchy, iterations |
| **Location** | `servers/knowledge/asic-brain/`, `servers/knowledge/eda-brain/` | `${HIPILOT_DESIGN_DIR}/.project-brain/` |
| **Updates** | Rare (tool updates) | Continuous (during flow) |
| **Examples** | "How to run CTS in Innovus" | "Ibex has 15K cells, CTS took 5min" |

## Project-Brain Directory Structure

```
${HIPILOT_DESIGN_DIR}/
├── rtl/                          # RTL source
├── constraints/                  # SDC files
├── .project-brain/               # DESIGN-SPECIFIC KNOWLEDGEBASE
│   ├── index.json                # Brain metadata & manifest
│   ├── rtl-memory.json           # RTL analysis & hierarchy
│   ├── floorplan-memory.json     # Floorplan iterations
│   ├── placement-memory.json     # Placement learnings
│   ├── cts-memory.json           # Clock tree synthesis data
│   ├── routing-memory.json       # Routing iterations
│   ├── timing-memory.json        # Timing closure journey
│   ├── error-patterns.json       # Design-specific errors & fixes
│   └── drc-memory.json           # DRC issues & resolutions
└── result/                       # Flow outputs
```

## Progressive Disclosure

Project-Brain starts empty and learns progressively:

### Stage 0: Synthesis (RTL Memory)
```json
{
  "stage": 0,
  "discovered_at": "2026-03-13T10:00:00Z",
  "rtl_memory": {
    "design_name": "ibex_core",
    "hierarchy": {
      "top_module": "ibex_core",
      "sub_modules": 42,
      "total_cells": 15234,
      "clock_domains": ["clk_i"]
    },
    "critical_paths": [
      {"from": "if_stage", "to": "id_stage", "delay": "2.1ns"}
    ],
    "synthesis_issues": [
      {
        "issue": "Latch inferred in decoder",
        "location": "ibex_decoder.sv:245",
        "resolution": "Added default case",
        "fixed": true
      }
    ]
  }
}
```

### Stage 2: Floorplan (Physical Memory)
```json
{
  "stage": 2,
  "floorplan_memory": {
    "iterations": [
      {
        "attempt": 1,
        "utilization": 0.75,
        "issue": "IO congestion on east side",
        "resolution": "Rotated die, moved IOs"
      }
    ],
    "final_config": {
      "aspect_ratio": 1.0,
      "core_utilization": 0.68,
      "die_area": "450x450 um",
      "io_placement": "spread"
    }
  }
}
```

### Stage 4: Placement (Timing Memory)
```json
{
  "stage": 4,
  "placement_memory": {
    "wns_progression": [
      {"iteration": 1, "wns": -0.450, "tns": -125.3},
      {"iteration": 2, "wns": -0.320, "tns": -89.1},
      {"iteration": 3, "wns": -0.180, "tns": -45.2}
    ],
    "critical_paths": [
      {
        "path_group": "reg2reg",
        "startpoint": "reg_fetch_pc",
        "endpoint": "reg_decode_instr",
        "why_critical": "Long wire across core"
      }
    ]
  }
}
```

## Memory Types

### 1. RTL Memory (Stage 0)
Stores synthesis learnings:
- Design hierarchy and module counts
- Clock domains and reset strategies
- Synthesis warnings/latches
- Critical paths from synthesis

### 2. Floorplan Memory (Stage 2)
Stores physical constraints:
- Die size iterations
- IO placement strategies
- Macro placement (if any)
- Power grid configuration

### 3. Placement Memory (Stage 4)
Stores cell placement learnings:
- Density vs timing tradeoffs
- Critical path locations
- Congestion hotspots
- Placement optimization history

### 4. CTS Memory (Stage 5)
Stores clock tree data:
- Clock skew targets vs achieved
- CTS recipe used
- NDR (Non-Default Rules) applied
- Clock gate placement

### 5. Routing Memory (Stage 7)
Stores routing iterations:
- DRC violation patterns
- Layer usage statistics
- Congestion maps
- Via stacking strategies

### 6. Timing Memory (All Stages)
Aggregated timing journey:
- WNS/TNS progression across stages
- Timing fixes applied
- ECO history
- Signoff confidence metrics

### 7. Error Pattern Memory
Design-specific error knowledge:
```json
{
  "error_patterns": [
    {
      "pattern": "IMPLF-53",
      "message_regex": "LEF file.*not found",
      "first_seen": "2026-03-13T10:05:00Z",
      "context": "Tech LEF loaded after cell LEF",
      "resolution": "Reverse LEF order: .tlef before .lef",
      "times_encountered": 3,
      "auto_fixable": true
    },
    {
      "pattern": "TIM-11",
      "message_regex": "Clock .* has no driver",
      "context": "Missing clock definition in SDC",
      "resolution": "Add create_clock to constraint file",
      "times_encountered": 1,
      "auto_fixable": false
    }
  ]
}
```

## MCP Tools for Project-Brain

### project_brain.remember
Store information in project memory:
```javascript
mcp__hipilot-knowledge__project_brain.remember({
  category: "timing_memory",
  key: "placement_wns_iteration_3",
  value: {wns: -0.180, tns: -45.2, timestamp: "2026-03-13T10:30:00Z"},
  context: "After place_opt_design with medium effort"
})
```

### project_brain.recall
Retrieve information from project memory:
```javascript
mcp__hipilot-knowledge__project_brain.recall({
  category: "error_patterns",
  pattern: "IMPLF-53"
})
// Returns: {resolution: "Reverse LEF order...", times_encountered: 3}
```

### project_brain.search
Search across all project memories:
```javascript
mcp__hipilot-knowledge__project_brain.search({
  query: "critical path reg2reg",
  categories: ["placement_memory", "timing_memory"]
})
```

### project_brain.get_context
Get current design context for decision making:
```javascript
mcp__hipilot-knowledge__project_brain.get_context({
  stage: 4,  // Current stage
  need: ["wns_trend", "critical_paths", "previous_fixes"]
})
```

## Integration with Modular Flow

### Example: Placement Stage with Project-Brain

```javascript
// Stage 4: Placement
const designDir = process.env.HIPILOT_DESIGN_DIR;

// 1. Load project context
const context = await project_brain.get_context({
  stage: 4,
  need: ["floorplan_config", "rtl_hierarchy", "placement_attempts"]
});

console.log(`Design: ${context.rtl_memory.hierarchy.top_module}`);
console.log(`Cells: ${context.rtl_memory.hierarchy.total_cells}`);
console.log(`Previous placements: ${context.placement_memory?.iterations?.length || 0}`);

// 2. Run placement
eda.start_tool({tool: "innovus", design_dir: designDir});
// ... placement commands ...

// 3. Store results in project brain
await project_brain.remember({
  category: "placement_memory",
  key: `placement_attempt_${Date.now()}`,
  value: {
    wns: -0.180,
    tns: -45.2,
    density: 0.72,
    hotspots: ["north_east", "center"]
  }
});

// 4. Check if we need timing fix
if (context.placement_memory?.iterations?.length > 2) {
  const trend = analyzeTrend(context.placement_memory.iterations);
  if (trend.improving) {
    console.log("Timing improving, continuing...");
  } else {
    console.log("Timing stuck, trying different approach...");
  }
}
```

## Benefits

1. **Design Continuity**: Resume work with full context
2. **Error Prevention**: Remember and avoid past mistakes
3. **Optimization Learning**: Apply what worked before
4. **Debugging**: Trace issues through flow history
5. **Knowledge Transfer**: Share `.project-brain/` with team

## Comparison: Without vs With Project-Brain

| Scenario | Without Project-Brain | With Project-Brain |
|----------|-----------------------|-------------------|
| Resume flow | "Where did I leave off?" | "Resuming from Stage 4, WNS was -0.18" |
| See error | "Why is this happening?" | "This happened before, fix is X" |
| Fix timing | Try random approaches | "Last time, path_group helped" |
| Debug DRC | Start from scratch | "Same issue at north_east corner" |
| Handoff | Re-explain everything | Share `.project-brain/` directory |

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | LittleBrain restructured → Three-Brain Architecture (ASIC-Brain, EDA-Brain, Project-Brain) |
| **Phase 2** | ✅ Complete | Project-Brain infrastructure created (`servers/knowledge/project-brain/`) |
| **Phase 3** | ✅ Complete | Integrated with modular stage skills and Team Mode |
| **Phase 4** | ✅ Complete | MCP tools for memory operations available |
| **Phase 5** | 🔄 In Progress | TUI visualization planned |

## Related Documentation

- [TEAM_MODE_ARCHITECTURE.md](TEAM_MODE_ARCHITECTURE.md) - Multi-agent team mode using three-brain architecture
- [LITTLEBRAIN_PROOF.md](LITTLEBRAIN_PROOF.md) - Historical evidence and test results
- `servers/knowledge/asic-brain/` - ASIC methodology brain
- `servers/knowledge/eda-brain/` - EDA tool knowledge brain
- `servers/knowledge/project-brain/` - Design-specific memory brain
