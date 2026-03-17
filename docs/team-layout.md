# HiPilot Team Layout Specification

## Correct Architecture (Hub-and-Spoke with Team API)

```
┌─────────────────────────────────────────────────────────────┐
│                    HiPilot Team Mode                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pane 0: HiPilot (Team Lead)                        │   │
│  │  - Main user interface                              │   │
│  │  - Receives SendMessage from agents                 │   │
│  │  - Executes MCP calls (eda.*, tmux.*, knowledge.*)  │   │
│  │  - ONLY pane that controls EDA pane                 │   │
│  │                                                     │   │
│  │  [ YOU ARE HERE - Type commands here ]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pane 1: EDA Tool Terminal                          │   │
│  │  - Innovus / DC Shell / PrimeTime                   │   │
│  │  - Controlled EXCLUSIVELY by HiPilot via MCP        │   │
│  │  - Agents NEVER touch this pane directly            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                    Background Agents                        │
│  (Run as Claude Code Team API - no visible panes)           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ supervisor  │ │  knowledge  │ │   planner   │           │
│  │ (Paneless)  │ │ (Paneless)  │ │ (Paneless)  │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │                  │
│  ┌─────────────┐ ┌─────────────┐         │                  │
│  │   executor  │ │  archivist  │         │                  │
│  │ (Paneless)  │ │ (Paneless)  │         │                  │
│  └──────┬──────┘ └─────────────┘         │                  │
│         │                                │                  │
│         └────────────┬───────────────────┘                  │
│                      │                                      │
│              SendMessage to HiPilot                        │
│                      │                                      │
│         ┌────────────┴────────────┐                        │
│         │      HiPilot (Lead)     │◄── Only pane with UI   │
│         │   Executes MCP calls    │                        │
│         └────────────┬────────────┘                        │
│                      │                                      │
│         ┌────────────┴────────────┐                        │
│         │      EDA Pane (bash)    │◄── Only HiPilot        │
│         │   innovus/dc_shell/...  │    controls this       │
│         └─────────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Pane Assignment

| Pane | Content | Role | Visibility |
|------|---------|------|------------|
| **0** | HiPilot (Team Lead) | Central coordinator, executes all MCP calls | **Visible** - Main UI |
| **1** | EDA Terminal | Tool execution (innovus/dc_shell/pt_shell) | **Visible** - Tool output |
| — | supervisor agent | Validates prerequisites, requests approval | **Background** - Team API |
| — | knowledge agent | Brain interface (ASIC/EDA/Project) | **Background** - Team API |
| — | planner agent | Creates execution strategies | **Background** - Team API |
| — | executor agent | Generates Tcl, asks HiPilot to execute | **Background** - Team API |
| — | archivist agent | Records QoR to Project-Brain | **Background** - Team API |

## Why 2 Panes Instead of 6?

**Problem with 6-pane layout:**
- 5 Claude instances all trying to control 1 EDA pane
- No coordination mechanism → conflicts and race conditions
- Each Claude thinks it's in charge

**Solution with 2-pane + Team API:**
- 1 HiPilot (Team Lead) exclusively controls EDA pane
- 5 agents run as background processes via Claude Code Team API
- Agents communicate via SendMessage protocol
- HiPilot executes MCP calls on behalf of agents

## Communication Flow

```
1. Engineer types command in HiPilot pane
   ↓
2. HiPilot spawns/communicates with agents via Team API
   ↓
3. Agents do their work (query brains, plan, etc.)
   ↓
4. Agents send results to HiPilot via SendMessage
   ↓
5. HiPilot executes MCP calls (eda.*, etc.)
   ↥
6. EDA pane shows tool output
   ↓
7. HiPilot reports results to engineer
```

## Agent Message Protocol

Agents send these message types to HiPilot:

```json
// Query a brain
{
  "type": "query_brain",
  "agent": "planner",
  "brain": "eda",
  "query": "floorplan best practices"
}

// Request Tcl execution
{
  "type": "execute_tcl",
  "agent": "executor",
  "tcl": "floorPlan ...",
  "description": "Floorplan initialization"
}

// Request phase approval
{
  "type": "request_approval",
  "agent": "supervisor",
  "phase": "floorplan",
  "evidence": { "duration": 450, "eda_activity": {...} }
}

// Report status
{
  "type": "report_status",
  "agent": "archivist",
  "status": "working",
  "progress": 75
}
```

## Implementation

To activate team mode:
```
/team-mode
```

This uses Claude Code's native Team API:
1. `TeamCreate("hipilot-team")` - Create team
2. `TaskCreate` for each agent - Define tasks
3. `Agent.spawn` for each agent - Launch background agents
4. `SendMessage` - Agent-to-lead communication
5. `TeamDelete` - Cleanup on shutdown

## Key Rules

1. **HiPilot ONLY** touches the EDA pane
2. **Agents NEVER** send commands to EDA pane
3. **All communication** goes through SendMessage
4. **MCP calls** are made exclusively by HiPilot
5. **Team API** runs agents in background (no visible panes)
