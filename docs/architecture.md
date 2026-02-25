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
│   │  │ 48 Tools:   │  │ 8 Tools:    │  │ 7 Tools:    │            │   │
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
│   │  │ 35 Skills   │  │  Templates  │  │     Docs    │            │   │
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

#### EDA MCP Server (`servers/eda/index.js`)

**Purpose:** EDA tool integration

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `generate_tcl` | Create Tcl from intent | Natural language | Tcl script |
| `send_to_terminal` | Execute Tcl in EDA | Tcl string | Execution result |
| `extract_qor` | Parse QoR metrics | Report text | WNS, TNS, violations |
| `detect_tool` | Identify running tool | None | Tool name |
| `get_mode` | Get execution mode | None | manual/auto |
| `set_mode` | Set execution mode | mode string | Success/fail |
| `toggle_mode` | Toggle mode | None | New mode |
| `get_pending` | Get queued Tcl | None | Pending Tcl |
| `approve_pending` | Execute pending | None | Execution result |
| `reject_pending` | Cancel pending | None | Success |
| `list_templates` | List Tcl templates | None | Template list |
| `get_job_status` | Check job status | Job ID | Status |
| `get_risk_analysis` | Analyze risk | Tcl string | Risk level |
| `confirm_dangerous` | Confirm operation | Confirmation | Success |
| `get_status` | Get overall status | None | Status object |
| `quick` | Quick execution | Command | Result |
| `capture_and_analyze` | Capture output | None | Analysis |
| `run_skill` | Execute skill | Skill name | Result |
| `edit_tcl` | Edit template | Template | Updated Tcl |

#### Tmux MCP Server (`servers/tmux/index.js`)

**Purpose:** Workspace management

| Tool | Description |
|------|-------------|
| `send_keys` | Send keystrokes to pane |
| `capture_pane` | Read pane content |
| `get_pane_output` | Get last N lines |
| `update_status` | Update status bar |
| `set_mode_status` | Update mode indicator |
| `list_panes` | List all panes |
| `resize_pane` | Resize pane |

#### Knowledge MCP Server (`servers/knowledge/index.js`)

**Purpose:** Skill and documentation management

| Tool | Description |
|------|-------------|
| `search_docs` | Search documentation |
| `get_command_ref` | Get EDA command reference |
| `list_skills` | List all skills |
| `get_skill` | Get skill content |

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
│   ├── hipilot              # Main launcher
│   ├── setup.sh             # Installation
│   └── e2e-test.sh          # Testing
│
├── servers/
│   ├── eda/
│   │   ├── index.js         # Main server (3300+ lines)
│   │   └── package.json
│   ├── tmux/
│   │   ├── index.js         # Tmux control
│   │   └── package.json
│   └── knowledge/
│       ├── index.js         # Knowledge retrieval
│       └── package.json
│
├── skills/                  # 35 skill files
│   ├── ibex-rtl2gds-flow.md # Master flow
│   ├── synthesis.md
│   ├── floorplan.md
│   ├── cts.md
│   ├── routing-opt.md
│   ├── chip-finish.md
│   ├── sta.md
│   ├── verification.md
│   └── ... (27 more)
│
├── src/
│   ├── lib/
│   │   ├── paths.js         # Path resolution
│   │   ├── mode.js          # Execution mode
│   │   ├── risk-analyzer.js # Risk assessment
│   │   └── report-analyzer.js
│   ├── tui/                 # Terminal UI
│   ├── cli.js               # CLI entry
│   └── index.js             # Main entry
│
├── scripts/
│   └── mcp_wrapper.sh       # JSON-RPC wrapper
│
├── templates/               # Tcl templates
│   ├── synopsys/
│   └── cadence/
│
├── docs/                    # Documentation
│   ├── architecture.md
│   ├── quick-start.md
│   ├── skills-guide.md
│   ├── mcp-servers.md
│   ├── rtl2gds-flow.md
│   ├── specs/
│   └── testing/
│
└── archive/                 # Superseded docs (reference only)
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

1. Create `templates/vendor/template.tcl.j2`
2. Use Jinja2 syntax
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

**Last Updated:** 2026-02-24
