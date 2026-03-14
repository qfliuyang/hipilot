# HiPilot Team Mode Architecture

**Multi-Agent Collaboration System for Physical Design**

---

## Overview

Team Mode enables multiple specialized AI agents to collaborate on physical design tasks using a shared three-brain architecture (ASIC-Brain, EDA-Brain, Project-Brain). The system provides orchestration, parallel execution, error recovery, and self-improvement capabilities.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HiPilot Team Mode                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        SupervisorAgent                               │    │
│  │  - Validates team readiness                                          │    │
│  │  - Resolves conflicts                                                │    │
│  │  - Makes execution decisions                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        KnowledgeAgent                                │    │
│  │  - Queries all three knowledge bases                                 │    │
│  │  - Aggregates ASIC/EDA/Project brain data                            │    │
│  │  - Caches knowledge for other agents                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                         │
│                    ▼               ▼               ▼                         │
│  ┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐         │
│  │    PlannerAgent     │ │  ExecutorAgent  │ │    MemoryAgent      │         │
│  │                     │ │                 │ │                     │         │
│  │ - Flow design       │ │ - Tcl generation│ │ - QoR tracking      │         │
│  │ - Stage sequencing  │ │ - Tool execution│ │ - History recording │         │
│  │ - Checkpoint detect │ │ - Error handling│ │ - Pattern storage   │         │
│  └─────────────────────┘ └─────────────────┘ └─────────────────────┘         │
│           │                      │                      │                    │
│           └──────────────────────┼──────────────────────┘                    │
│                                  ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        LearningAgent                                 │    │
│  │  - Records success/error patterns                                    │    │
│  │  - Analyzes failures across designs                                  │
│  │  - Suggests improvements                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Three-Brain Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   ASIC-Brain    │  │    EDA-Brain    │  │  Project-Brain  │              │
│  │                 │  │                 │  │                 │              │
│  │ - Methodology   │  │ - Tool commands │  │ - Design memory │              │
│  │ - Tcl generation│  │ - Error patterns│  │ - QoR history   │              │
│  │ - Best practices│  │ - Syntax validation│ - Checkpoints  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Registry

### 1. SupervisorAgent

**Purpose:** Oversees and coordinates all agents

**Primary Brain:** meta (cross-brain decision making)

**Capabilities:**
- `asic`: plan_stage, get_best_practice
- `eda`: get_tool_info, match_error
- `project`: get_context, search, recall

**Responsibilities:**
- Coordinate agent execution order
- Resolve conflicts between agents
- Make final decisions on disputes
- Monitor agent health and progress
- Restart failed agents if needed
- Escalate to human when necessary

**Execution:** Sequential (must complete before others)

---

### 2. KnowledgeAgent

**Purpose:** Unified interface to all three knowledge bases

**Primary Brain:** all (operates all brains equally)

**Capabilities:**
- `asic`: generate_tcl, sanitize_script, parse_output, plan_stage, analyze_command, get_best_practice, record_success
- `eda`: get_tool_info, get_command, search_commands, match_error, get_suggested_fix, validate_syntax, get_tool_practices
- `project`: remember, recall, search, get_context, set_stage, record_qor, get_qor_progression, record_error, get_summary

**Responsibilities:**
- Query ASIC-Brain for methodology and Tcl generation
- Query EDA-Brain for tool commands and error patterns
- Query Project-Brain for design-specific memory
- Route knowledge requests to appropriate brain
- Synthesize answers from multiple brains
- Cache frequently accessed knowledge

**Execution:** Sequential (provides context for other agents)

---

### 3. PlannerAgent

**Purpose:** Designs the RTL2GDS flow

**Primary Brain:** asic

**Capabilities:**
- `asic`: plan_stage, generate_tcl, analyze_command
- `eda`: get_tool_info, get_tool_practices
- `project`: get_context, recall

**Responsibilities:**
- Analyze design requirements
- Determine optimal flow stages
- Check prerequisites before execution
- Select appropriate tools per stage
- Recommend stage skipping when checkpoints exist

**Execution:** Sequential

---

### 4. ExecutorAgent

**Purpose:** Runs the EDA tools

**Primary Brain:** eda

**Capabilities:**
- `asic`: generate_tcl, sanitize_script, parse_output
- `eda`: get_command, match_error, validate_syntax
- `project`: remember, set_stage

**Responsibilities:**
- Generate validated Tcl from intent
- Execute EDA tool commands
- Validate command syntax before execution
- Extract and analyze QoR metrics
- Diagnose and fix errors
- Save checkpoints after stages

**Execution:** Sequential (depends on Planner output)

**Implementation Details:**
```javascript
// Stage execution pipeline:
1. Plan stage using ASIC-Brain
2. Get best practices from EDA-Brain
3. Generate Tcl using ASIC-Brain
4. Validate Tcl syntax via EDA-Brain
5. Execute via EDA tools (MCP integration)
6. Parse output using ASIC-Brain
7. Extract QoR metrics
8. Record success in ASIC-Brain
```

---

### 5. MemoryAgent

**Purpose:** Manages design knowledge and history

**Primary Brain:** project

**Capabilities:**
- `asic`: parse_output, get_best_practice
- `eda`: match_error, get_suggested_fix
- `project`: remember, recall, search, record_qor, record_error

**Responsibilities:**
- Record stage transitions and checkpoints
- Track QoR progression across stages
- Log errors with context and resolutions
- Search historical patterns
- Provide design context to other agents

**Execution:** Parallel (with LearningAgent)

---

### 6. LearningAgent

**Purpose:** Enables self-improvement

**Primary Brain:** meta

**Capabilities:**
- `asic`: record_success, get_best_practice
- `eda`: record_error, get_suggested_fix
- `project`: search, recall, remember

**Responsibilities:**
- Record successful command sequences
- Capture error patterns and fixes
- Analyze failure modes across designs
- Suggest improvements based on history
- Transfer knowledge between designs
- Update best practices database

**Execution:** Parallel (with MemoryAgent)

---

## Execution Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Supervisor │───▶│  Knowledge  │───▶│   Planner   │───▶│   Executor  │
│   (seq)     │    │   (seq)     │    │   (seq)     │    │   (seq)     │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                  │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Parallel Phase                                   │
│  ┌─────────────────────┐              ┌─────────────────────┐            │
│  │    MemoryAgent      │◄────────────▶│    LearningAgent    │            │
│  │     (parallel)      │   Shared     │     (parallel)      │            │
│  │                     │   Results    │                     │            │
│  └─────────────────────┘              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase Details

| Phase | Agents | Dependencies | Parallel |
|-------|--------|--------------|----------|
| 1 | Supervisor | None | No |
| 2 | Knowledge | Supervisor | No |
| 3 | Planner | Knowledge | No |
| 4 | Executor | Planner | No |
| 5 | Memory, Learner | Executor | Yes |

---

## Error Recovery

### Retry Strategy

```javascript
{
  auto_recovery: true,        // Enable automatic retries
  recovery_attempts: 3,       // Maximum retry attempts
  max_parallel: 4,            // Max parallel agents
  escalate_on_failure: true,  // Escalate to human after retries
  block_on_escalation: false  // Wait for human response
}
```

### Exponential Backoff

| Attempt | Backoff Time |
|---------|--------------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| n | 2^(n-1) seconds |

### Recovery Process

1. **Error Detection:** Agent throws exception
2. **Retry Attempt:** If `auto_recovery` enabled, retry with backoff
3. **Recording:** Each retry recorded in Project-Brain
4. **Exhaustion:** After max attempts, mark agent failed
5. **Escalation:** If `escalate_on_failure`, notify human
6. **Continuation:** Team continues if error non-critical

---

## Configuration

### Default Team Config

```javascript
{
  name: "${designName}_team",
  design_dir: designDir,
  design_name: designName,
  agents: [
    { id: 'supervisor', role: 'supervisor' },
    { id: 'knowledge', role: 'knowledge' },
    { id: 'planner', role: 'planner' },
    { id: 'executor', role: 'executor' },
    { id: 'memory', role: 'memory' },
    { id: 'learner', role: 'learner' }
  ],
  strategy: {
    mode: 'sequential',
    auto_recovery: true,
    recovery_attempts: 3,
    max_parallel: 4,
    escalate_on_failure: true,
    block_on_escalation: false
  }
}
```

### Creating a Team

```javascript
import { initializeTeamMode } from './src/team/index.js';

const team = await initializeTeamMode(
  '/path/to/design',
  'ibex_core'
);

const result = await team.start();
console.log(result.success ? 'Flow completed' : 'Flow failed');
```

---

## Integration with Three-Brain Architecture

### KnowledgeAgent Brain Queries

```javascript
// ASIC-Brain queries
const asicBrain = createASICBrain(`team_${designName}`);
const flowStatus = asicBrain.getFlowStatus();
const stageDef = asicBrain.getStageDefinition(stage);

// EDA-Brain queries
const toolInfo = edaBrain.getToolInfo('innovus');
const bestPractices = edaBrain.getBestPractices('innovus');
const commands = edaBrain.getCommandsByCategory('innovus', 'design_init');

// Project-Brain queries
const context = recall('design_context', designName);
const qorHistory = recall('qor_history', designDir);
const errorPatterns = searchProjectBrain(designName, { categories: ['error_patterns'] });
```

### Knowledge Aggregation

The KnowledgeAgent synthesizes information from all three brains:

```javascript
const knowledge = {
  // ASIC-Brain contribution
  asic: {
    flow_status: flowStatus,
    stage_best_practices: stageBestPractices,
    methodology_context: { ... }
  },

  // EDA-Brain contribution
  eda: {
    tool_recommendations: toolRecommendations,
    supported_tools: supportedTools,
    command_reference: { ... }
  },

  // Project-Brain contribution
  project: {
    design_exists: !!designContext,
    current_stage: designContext?.current_stage,
    historical_qor: historicalQoR,
    known_error_patterns: knownIssues
  },

  // Aggregated recommendations
  recommendations: {
    flow: recommendedFlow,
    tools: toolRequirements,
    optimizations: suggestedOptimizations,
    warnings: knownIssues
  }
};
```

---

## Usage Examples

### Example 1: Basic Team Execution

```javascript
import { initializeTeamMode } from './src/team/index.js';

async function runFlow(designDir, designName) {
  const team = await initializeTeamMode(designDir, designName);

  console.log('Starting team execution...');
  const result = await team.start();

  if (result.success) {
    console.log('✓ All agents completed successfully');
    console.log('Results:', result.results);
  } else {
    console.error('✗ Flow failed:', result.error);
  }

  return result;
}

runFlow('/home/EDA/ibex_work', 'ibex_core');
```

### Example 2: Custom Team Configuration

```javascript
import { TeamManager, createDefaultTeamConfig } from './src/team/index.js';

const config = {
  ...createDefaultTeamConfig(designDir, designName),
  strategy: {
    mode: 'sequential',
    auto_recovery: true,
    recovery_attempts: 5,        // More retries
    max_parallel: 2,             // Less parallelism
    escalate_on_failure: true,
    block_on_escalation: true    // Wait for human
  }
};

const team = new TeamManager(config);
await team.initialize();
const result = await team.start();
```

### Example 3: Monitor Team Status

```javascript
const team = await initializeTeamMode(designDir, designName);

// Start execution
const executionPromise = team.start();

// Monitor progress
const monitorInterval = setInterval(() => {
  const status = team.getStatus();
  console.log(`Progress: ${status.progress.percent}% (${status.progress.completed}/${status.progress.total} agents)`);

  status.agents.forEach(agent => {
    console.log(`  ${agent.name}: ${agent.status}`);
  });
}, 5000);

const result = await executionPromise;
clearInterval(monitorInterval);
```

---

## API Reference

### TeamManager Class

#### Constructor
```javascript
new TeamManager(config)
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize()` | Initialize all agents | `{ success, agents }` |
| `start()` | Start execution flow | `{ success, results }` |
| `getStatus()` | Get current status | `{ name, state, agents, progress }` |
| `executeAgent(agent)` | Execute single agent | `{ success, result/error, attempts }` |
| `executePhase(role)` | Execute agent by role | `{ continue, result }` |
| `executeParallelPhase(agents, maxParallel)` | Execute agents in parallel | `{ continue, result }` |

### Configuration Helpers

| Function | Description |
|----------|-------------|
| `createDefaultTeamConfig(designDir, designName)` | Create default configuration |
| `getAvailableAgents()` | List all available agent types |
| `initializeTeamMode(designDir, designName)` | Quick initialization |

---

## Error Handling

### Agent Error Types

| Error | Description | Recovery |
|-------|-------------|----------|
| `TclGenerationError` | Failed to generate Tcl | Retry with different intent |
| `ValidationError` | Tcl syntax invalid | Auto-fix if possible |
| `ExecutionError` | EDA tool execution failed | Check error pattern, retry |
| `TimeoutError` | Stage exceeded time limit | Increase timeout, retry |
| `DependencyError` | Required checkpoint missing | Run prerequisite stages |

### Human Escalation

When an agent fails after all retries and `escalate_on_failure` is true:

1. Escalation record created in Project-Brain
2. File written to `/tmp/hipilot_escalation_{sessionId}_{role}.json`
3. Console notification logged
4. If `block_on_escalation`, team waits for human response

---

## Future Enhancements

1. **Dynamic Agent Discovery:** Auto-detect optimal agent configuration
2. **Parallel Planning:** Allow Planner and Knowledge to run in parallel
3. **Agent Specialization:** Role-specific sub-agents (e.g., TimingAgent, DRCAgent)
4. **Cross-Design Learning:** Share patterns between designs via central knowledgebase
5. **Visual Workflow Editor:** GUI for designing agent flows

---

**Last Updated:** 2026-03-14
**Version:** 1.0
**File:** `src/team/index.js` (1,331 lines)
