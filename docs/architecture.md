# HiPilot Architecture

**System Design and Technical Details**

---

## System Overview

HiPilot extends Claude Code with specialized capabilities for VLSI physical design automation through three MCP servers and 35 built-in skills.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           HiPilot Architecture                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User Interface Layer                                                   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Claude Code CLI                              │   │
│   │  - Natural language input                                       │   │
│   │  - Skill invocation (/skill-name)                               │   │
│   │  - Tcl approval workflow                                        │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│   MCP Integration Layer                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│   │  │   EDA MCP   │  │  Tmux MCP   │  │Knowledge MCP│            │   │
│   │  │   Server    │  │   Server    │  │   Server    │            │   │
│   │  │             │  │             │  │             │            │   │
│   │  │ 49 Tools:   │  │ 8 Tools:    │  │ 7 Tools:    │            │   │
│   │  │ - generate  │  │ - send_keys │  │ - search    │            │   │
│   │  │ - send_tcl  │  │ - capture   │  │ - list      │            │   │
│   │  │ - extract   │  │ - status    │  │ - get       │            │   │
│   │  │ - mode ctrl │  │ - list      │  │ - ref       │            │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│   Execution Layer                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  ┌────────────────┐              ┌────────────────┐            │   │
│   │  │ tmux Workspace │              │   EDA Tools    │            │   │
│   │  │                │              │                │            │   │
│   │  │ Pane 0: Claude │◄────────────►│ - Innovus      │            │   │
│   │  │ Pane 1: EDA    │              │ - ICC2         │            │   │
│   │  │                │              │ - PrimeTime    │            │   │
│   │  │ 50/50 Split    │              │ - DC Shell     │            │   │
│   │  └────────────────┘              └────────────────┘            │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│   Knowledge Layer                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│   │  │ 36 Skills   │  │  Templates  │  │     Docs    │            │   │
│   │  │             │  │             │  │             │            │   │
│   │  │ - Flow      │  │ - Tcl.j2    │  │ - Specs     │            │   │
│   │  │ - Fix       │  │ - Report    │  │ - Guides    │            │   │
│   │  │ - Report    │  │ - Timing    │  │ - PRD       │            │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Claude Code Layer

**Purpose:** User interface and AI reasoning

**Responsibilities:**
- Parse natural language commands
- Match user intent to skills
- Generate Tcl from templates
- Present results to user

**Configuration:** `~/.claude/settings.json`

### 2. MCP Server Layer

#### EDA MCP Server (`servers/eda/index.js`) — 52 tools

**Purpose:** EDA tool integration, Tcl generation, QoR tracking, workflow automation

| Category | Tools |
|----------|-------|
| **Tcl Generation** | `generate_tcl`, `send_to_terminal`, `quick`, `save_tcl`, `edit_tcl`, `validate_tcl`, `list_templates`, `run_skill` |
| **EDA Interaction** | `detect_tool`, `execute_and_verify`, `capture_and_analyze`, `capture_and_wait`, `wait_for_prompt`, `wait_for_pattern`, `get_last_result`, `extract_qor`, `get_job_status`, `analyze_report`, `get_analysis_cache`, `diagnose_error` |
| **Mode Control** | `get_mode`, `set_mode`, `toggle_mode`, `get_pending`, `approve_pending`, `reject_pending`, `get_risk_analysis`, `confirm_dangerous`, `get_status` |
| **Session** | `session.save_checkpoint`, `session.list_checkpoints`, `session.restore_checkpoint`, `session.get_history`, `session.get_context` |
| **Context** | `context.detect`, `context.get_stage`, `context.suggest_next` |
| **QoR** | `qor.snapshot`, `qor.list_snapshots`, `qor.compare`, `qor.get_trend` |
| **Workflow** | `workflow.define`, `workflow.list`, `workflow.run`, `workflow.get_status`, `workflow.cancel` |
| **Suggestions** | `suggest.analyze`, `suggest.for_violation`, `suggest.next_optimization` |

See [mcp-servers.md](mcp-servers.md) for full parameter schemas.

#### Tmux MCP Server (`servers/tmux/index.js`) — 8 tools

**Purpose:** Workspace management, pane control

| Tool | Description |
|------|-------------|
| `send_keys` | Send keystrokes to pane |
| `capture_pane` | Read pane content |
| `get_pane_output` | Get last N lines from scrollback |
| `setup_layout` | Create or attach to 50/50 workspace |
| `update_status` | Update status bar with context |
| `set_mode_status` | Update mode indicator |
| `list_panes` | List all panes |
| `resize_pane` | Resize pane |

#### Knowledge MCP Server (`servers/knowledge/index.js`) — 7 tools

**Purpose:** Skill and documentation management

| Tool | Description |
|------|-------------|
| `search_docs` | Full-text search across docs |
| `get_command_ref` | Get EDA command reference |
| `search_commands` | Search commands by keyword/category |
| `list_skills` | List all skills (project > user > built-in) |
| `get_skill` | Get full skill content |
| `match_skill` | Match intent to best skill |
| `get_methodology` | Flow stage methodology guide |

### 3. Skills System

**Location:** `skills/*.md`

**Format:** Markdown with YAML frontmatter

```markdown
---
name: skill-name
description: Description
hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [stage]
  triggers:
    - "trigger phrase"
  qor_metrics: [WNS, TNS]
  risk_level: moderate
---

# Skill Title

## Quick Reference
...

## MCP Commands
...
```

### 4. Template System

**Location:** `templates/`

**Engine:** Nunjucks (Jinja2-compatible)

**Structure:**
```
templates/
├── synopsys/
│   ├── icc2_fix_setup_timing.tcl
│   └── icc2_report_timing.tcl
└── cadence/
    └── innovus_*.tcl
```

---

## Data Flow

### Command Execution Flow

```
1. User Input
   "fix setup timing violations"
         │
         ▼
2. Skill Matching
   /fix-setup-timing skill found
         │
         ▼
3. Tcl Generation
   Template: icc2_fix_setup_timing.tcl
   Parameters: max_paths=10, slack_threshold=0
         │
         ▼
4. Mode Check
   If manual: Queue for approval
   If auto: Execute immediately
         │
         ▼
5. Tcl Execution
   MCP: eda.send_to_terminal(tcl)
   tmux: send_keys to EDA pane
         │
         ▼
6. Output Capture
   MCP: tmux.capture_pane()
   Parse for WNS/TNS
         │
         ▼
7. Result Presentation
   Display to user with QoR metrics
```

### Mode System

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Manual** | Tcl queued for approval | Safety-critical operations |
| **Auto** | Tcl executes immediately | Automated flows |

**Mode Controls:**
- `eda.set_mode({mode: "auto"})`
- `eda.set_mode({mode: "manual"})`
- `eda.toggle_mode()`

---

## Workspace Layout

### tmux Split Layout (50/50)

```
┌────────────────────────────────┬────────────────────────────────┐
│         Pane 0 (Left)          │         Pane 1 (Right)         │
│                                │                                │
│     ┌──────────────────┐       │     ┌──────────────────┐       │
│     │                  │       │     │                  │       │
│     │   Claude Code    │       │     │   EDA Tool       │       │
│     │   (HiPilot)      │       │     │   (Innovus)      │       │
│     │                  │       │     │                  │       │
│     │   - Skill docs   │       │     │   innovus>       │       │
│     │   - Tcl preview  │───────┼────▶│   [executes Tcl] │       │
│     │   - QoR results  │◀──────┼─────│   [produces out] │       │
│     │                  │       │     │                  │       │
│     └──────────────────┘       │     └──────────────────┘       │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│  Status Bar: ⚙ HiPilot │ 🔒 Manual │ innovus │ ibex_core       │
└────────────────────────────────────────────────────────────────┘
```

---

## File System Layout

```
hipilot/
├── bin/
│   ├── hipilot              # Main launcher (tmux workspace)
│   └── setup.sh             # Installation wizard
│
├── servers/                 # MCP servers (JSON-RPC over stdio)
│   ├── eda/index.js         # EDA MCP (52 tools)
│   ├── tmux/index.js        # Tmux MCP (8 tools)
│   └── knowledge/index.js   # Knowledge MCP (7 tools)
│
├── skills/                  # 35 skill definitions (.md)
│
├── src/
│   ├── cli.js               # TUI dashboard (React/Ink)
│   ├── index.js             # Main CLI entry point
│   ├── lib/                 # Utilities (17 modules)
│   ├── tui/                 # React/Ink TUI components
│   └── hitestbot/           # E2E test framework (14 tests, v2 core)
│
├── data/
│   └── command-reference.json  # EDA command reference
│
├── templates/               # 22 Tcl templates
│   ├── synopsys/            # 10 ICC2 templates
│   └── cadence/             # 10 Innovus templates
│
├── test/                    # Unit tests (vitest, 118 tests)
│
├── scripts/
│   └── postinstall.js       # Post-install setup
│
└── docs/                    # Documentation
    ├── architecture.md, quick-start.md, skills-guide.md
    ├── mcp-servers.md, rtl2gds-flow.md, deploy-guide.md
    ├── specs/               # MCP server specifications
    └── testing/             # Testing rules and guides
```

---

## Security Model

### Trust Levels

| Level | Source | Badge |
|-------|--------|-------|
| **Trusted** | Team-authored skills | [✓ Template] |
| **Verified** | EDA vendor documentation | [📖 Doc-based] |
| **Unverified** | AI-generated (no skill/doc) | [⚠ Unverified] |

### Risk Analysis

Before executing Tcl, HiPilot analyzes:
- Destructive operations (delete, remove, clear)
- Global modifications (all_instances, *)
- Timing changes (set_clock, set_delay)
- File operations (write, save, export)

### Approval Workflow (Manual Mode)

```
1. User command → Tcl generated
2. Risk analysis performed
3. If moderate/high risk:
   - Tcl queued as "pending"
   - User prompted to approve
4. User approves → Tcl executes
5. User rejects → Tcl discarded
```

---

## Performance Characteristics

| Operation | Typical Time |
|-----------|--------------|
| Skill lookup | < 100ms |
| Tcl generation | < 500ms |
| Command execution | Variable (EDA tool dependent) |
| Report parsing | < 1s |
| Full flow (Ibex) | ~20 minutes |

---

## Extension Points

### Adding New Skills

1. Create `skills/new-skill.md`
2. Add YAML frontmatter
3. Include MCP commands
4. Test with EDA tool

### Adding New Templates

1. Create `templates/vendor/tool_operation.tcl`
2. Use Nunjucks/Jinja2 syntax
3. Register in EDA MCP server

### Adding New MCP Tools

1. Add tool definition in `servers/*/index.js`
2. Implement tool handler
3. Update documentation

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| @modelcontextprotocol/sdk | ^1.0.4 | MCP protocol |
| nunjucks | ^3.2.4 | Template engine |
| chalk | ^5.3.0 | Terminal colors |
| commander | ^9.5.0 | CLI parsing |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| vitest | ^1.0.0 | Testing |

---

**Last Updated:** 2026-02-25
