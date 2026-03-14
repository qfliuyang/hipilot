# Project Mission Pack

The **Project Mission Pack** is HiPilot's configuration system that defines what should be done for a specific design. It contains all design-specific details, allowing HiPilot core to remain completely design-agnostic.

## Quick Start

### 1. Create a Mission Pack

Create a `hipilot-mission.yaml` in your design directory:

```yaml
project:
  name: "my_design"
  description: "My ASIC Design"

design:
  rtl:
    top_module: "top"
    files:
      - "rtl/top.v"
  constraints:
    sdc:
      - "constraints/top.sdc"
  libraries:
    target:
      - "lib/tech.lib"
    lef:
      - "lef/tech.tlef"
      - "lef/cells.lef"

flow:
  stages:
    - synthesis
    - design_init
    - floorplan
    - placement
    - cts
    - routing
    - chip_finish
```

### 2. Use in HiPilot

```javascript
import { loadMissionPack } from './src/mission-pack/index.js';

const mission = loadMissionPack('/path/to/design');

// Get RTL files
const rtlFiles = mission.getRtlFiles();

// Get libraries
const libs = mission.getLibraries('typical');

// Get flow stages
const stages = mission.stages;
```

### 3. Auto-Detection

If no mission pack exists, HiPilot can auto-detect:

```javascript
import { canAutoDetect, autoDetectMissionPack } from './src/mission-pack/auto-detect.js';

if (canAutoDetect('/path/to/design')) {
  const missionData = autoDetectMissionPack('/path/to/design');
}
```

## File Structure

```
src/mission-pack/
├── index.js                  # Core MissionPack class and loader
├── validator.js              # Schema validation
├── auto-detect.js            # Auto-detection for legacy projects
├── three-brain-integration.js # Integration with Three-Brain architecture
└── README.md                 # This file
```

## Integration with Three-Brain Architecture

| Brain | Uses Mission Pack For |
|-------|----------------------|
| **ASIC-Brain** | Flow stages, recipes, target metrics, methodology |
| **EDA-Brain** | Tool configurations, Tcl snippets, version requirements |
| **Project-Brain** | Design name, structure, learned data storage |

```javascript
import { getMissionPackContext } from './src/mission-pack/three-brain-integration.js';

const context = getMissionPackContext('/path/to/design');

// ASIC-Brain interface
const flow = context.getFlowDefinition();
const recipe = context.getStageRecipe('synthesis');

// EDA-Brain interface
const toolConfig = context.getToolConfig('innovus', 'floorplan');
const libraries = context.getLibrariesForCorner('fast');

// Project-Brain interface
context.remember('timing_memory', 'synthesis_qor', { wns: -0.1, tns: -5.2 });
const learnings = context.recall('timing_memory', 'synthesis_qor');
```

## Mission Pack Schema

### Required Sections

- `project`: Project identity (name, description, version)
- `design`: Design structure (RTL, constraints, libraries)

### Optional Sections

- `flow`: Flow definition (stages, targets, recipes)
- `technology`: Technology setup (node, corners, power domains)
- `tools`: Tool-specific overrides
- `custom`: Custom hooks, Tcl libraries, environment variables

See [docs/PROJECT_MISSION_PACK.md](../../docs/PROJECT_MISSION_PACK.md) for complete schema documentation.

## Loading Priority

HiPilot looks for mission packs in this order:

1. `HIPILOT_MISSION_PACK` environment variable
2. `${HIPILOT_DESIGN_DIR}/hipilot-mission.yaml`
3. `${HIPILOT_DESIGN_DIR}/hipilot-mission.yml`
4. `${HIPILOT_DESIGN_DIR}/hipilot-mission.json`
5. `${HIPILOT_DESIGN_DIR}/.hipilot/mission.yaml`
6. Auto-detect (if possible)
7. Default mission pack

## Validation

```javascript
import { validateMissionPack } from './src/mission-pack/validator.js';

const result = validateMissionPack(missionPackData);
// => { valid: true } or { valid: false, errors: [...], warnings: [...] }
```

## Examples

See `examples/mission-packs/` for complete examples:
- `ibex-mission.yaml` - Ibex RISC-V Core example

## Team Mode Integration

Each agent gets specialized context from the mission pack:

```javascript
// Supervisor gets full mission pack
const supervisorContext = context.getAgentContext('supervisor');

// Planner gets flow definition
const plannerContext = context.getAgentContext('planner');

// Executor gets tool configurations
const executorContext = context.getAgentContext('executor');
```
