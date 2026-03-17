# /team-mode — Activate Multi-Agent Team Coordination

Enable 5-agent team mode with native Claude Code Team API coordination.

## Usage

```
/team-mode
/team-mode status
/team-mode shutdown
```

## What It Does

Activates team coordination using Claude Code's native Team API:

1. **Creates team** using `TeamCreate("hipilot-team")`
2. **Spawns 5 agents** using `Task` with specialized preambles
3. **Establishes SendMessage routing** for agent communication
4. **HiPilot (Supervisor)** becomes Team Lead and coordinator

## External Interface: Supervisor Only

**HiTestBot and human engineers interact ONLY with Supervisor (Pane 0).**

```
HiTestBot/Human → Supervisor (Pane 0) → [coordinates other agents]
                        ↓
              SendMessage to Knowledge, Planner, Executor, Archivist
                        ↓
              Executor (Pane 3) → EDA Pane (Pane 5)
```

**Rules:**
- External input ONLY goes to Supervisor (Pane 0)
- Supervisor delegates to other agents via SendMessage
- Other agents report back to Supervisor
- Executor is the ONLY agent that touches EDA pane

## Agent Roles & Communication

| Agent | Pane | Role | External Input | EDA Control | Communication |
|-------|------|------|----------------|-------------|---------------|
| **supervisor** | 0 | **Team Lead** | ✅ **ONLY** | ❌ | Coordinates all agents |
| **knowledge** | 1 | Brain interface | ❌ | ❌ | Answers brain queries |
| **planner** | 2 | Strategist | ❌ | ❌ | Creates execution plans |
| **executor** | 3 | **EDA Controller** | ❌ | ✅ **ONLY** | Executes Tcl via MCP |
| **archivist** | 4 | Recorder | ❌ | ❌ | Records QoR metrics |

## Communication Protocol

All agents communicate via `SendMessage`:

```javascript
// Query knowledge agent
SendMessage({
  to: "knowledge",
  message: {
    type: "query_brain",
    brain: "eda",
    query: "floorplan best practices"
  }
})

// Request Tcl execution (supervisor/planner/archivist → executor)
SendMessage({
  to: "executor",
  message: {
    type: "execute_tcl",
    tcl: "floorPlan -site ...",
    description: "Initialize floorplan",
    requester: "planner"
  }
})

// Report execution completion (executor → requester)
SendMessage({
  to: "planner",
  message: {
    type: "tcl_complete",
    success: true,
    output: "Floorplan created: 100x100um",
    requester: "planner"
  }
})

// Request phase approval
SendMessage({
  to: "supervisor",
  message: {
    type: "request_approval",
    phase: "floorplan",
    evidence: { duration: 450, eda_activity: {...} }
  }
})

// Report status
SendMessage({
  to: "supervisor",
  message: {
    type: "report_status",
    status: "working",
    progress: 75
  }
})
```

## Activation Sequence

When you type `/team-mode`:

1. **TeamCreate** - Create "hipilot-team" with you (Supervisor) as lead
2. **TaskCreate x5** - Create tasks for each agent:
   - supervisor: Coordinate RTL2GDS flow
   - knowledge: Handle brain queries
   - planner: Create stage strategies
   - executor: Execute Tcl in EDA pane
   - archivist: Record QoR and learnings
3. **Agent.spawn x5** - Launch each agent with preamble
4. **Message routing** - Activate SendMessage coordination

## How Agents Work Together

**Example: Running Floorplan Stage**

1. **Supervisor** validates prerequisites (design_init checkpoint exists)
2. **Supervisor** SendMessage to **Planner**: "Create floorplan strategy"
3. **Planner** SendMessage to **Knowledge**: "Query floorplan best practices"
4. **Knowledge** responds with strategy
5. **Planner** SendMessage to **Executor**: "Execute floorplan Tcl"
6. **Executor** runs Tcl in EDA pane (Pane 5) via MCP
7. **Executor** SendMessage to **Planner**: "Floorplan complete"
8. **Executor** SendMessage to **Archivist**: "Record QoR metrics"
9. **Planner** SendMessage to **Supervisor**: "Phase complete, request approval"
10. **Supervisor** validates and approves

## Rules

1. **ONLY Executor** (Pane 3) controls EDA pane via MCP tools
2. **Other agents** SendMessage to Executor for EDA actions
3. **All communication** via SendMessage, no direct MCP calls except Executor
4. **Supervisor** coordinates overall workflow
5. **Agents wait** for messages, don't act without instruction

## Shortcuts

| Key | Pane | Agent |
|-----|------|-------|
| Alt+1 | 0 | Supervisor (Team Lead) |
| Alt+2 | 1 | Knowledge |
| Alt+3 | 2 | Planner |
| Alt+4 | 3 | Executor (EDA Control) |
| Alt+5 | 4 | Archivist |
| Alt+0 | 5 | EDA Tool Pane |

## Status Commands

```
/team-mode status    - Show team status and agent states
/team-mode shutdown  - Gracefully shutdown all agents
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTERFACE                         │
│  HiTestBot / Human Engineer → ONLY Supervisor (Pane 0)         │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    hipilot-team                                │
├────────────────────────────────────────────────────────────────┤
│  Supervisor (Pane 0) - Team Lead                               │
│  ├── Receives external input (HiTestBot/Human)                 │
│  ├── Delegates to agents via SendMessage                       │
│  └── Coordinates overall workflow                              │
├────────────────────────────────────────────────────────────────┤
│  Knowledge (Pane 1) ←── Brain queries via SendMessage          │
│  Planner   (Pane 2) ←── Strategy requests via SendMessage      │
│  Executor  (Pane 3) ←── Tcl execution requests via SendMessage │
│  Archivist (Pane 4) ←── Data recording via SendMessage         │
├────────────────────────────────────────────────────────────────┤
│  Executor (Pane 3) ──MCP──→ EDA Pane (Pane 5)                  │
│  ☝️ ONLY Executor controls EDA pane                            │
└────────────────────────────────────────────────────────────────┘
```

## Implementation

Team coordination is handled by `src/team/TeamCoordinator.js`:

```javascript
// Initialize team
import { createTeamCoordinator } from './src/team/TeamCoordinator.js';
const coordinator = createTeamCoordinator({ teamName: 'hipilot-team' });
await coordinator.initialize();

// Get agent spawn config
const executorConfig = coordinator.getAgentSpawnConfig('executor');
// Use with: Task({ teamName: 'hipilot-team', name: 'executor', ... })

// Handle incoming messages
await coordinator.handleMessage('planner', {
  type: 'execute_tcl',
  tcl: 'floorPlan ...',
  description: 'Initialize floorplan'
});
```
