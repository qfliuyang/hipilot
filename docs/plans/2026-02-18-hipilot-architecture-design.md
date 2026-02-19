# HiPilot Architecture Design Document

**Date:** 2026-02-19
**Status:** Updated
**Authors:** HiPilot Architecture Team

---

## 1. Executive Summary

HiPilot is a VLSI physical design copilot system built as a lightweight fork of Claude Code with three specialized MCP (Model Context Protocol) servers. It provides physical design engineers with an AI-powered assistant that generates vendor-specific Tcl scripts, comprehends EDA reports, and manages a tmux-based workspace — all from a pure terminal interface.

### Core Value Proposition

| Pillar | Description |
|--------|-------------|
| **Skills as primary value** | Knowledge capture and sharing, not just automation. Skills encode team expertise that scales. |
| **Human-in-the-loop transparency** | Unlike black-box optimizers (DSO.ai, Cerebrus), HiPilot always shows reasoning, sources, and the generated Tcl. The engineer decides what runs. |
| **Intent-driven PD workflows** | Natural language like "fix setup violations on pcie_rx" becomes a complete, validated Tcl workflow. |
| **Knowledge democratization** | Team skills encode tribal knowledge so junior engineers execute senior-level flows. |
| **Pure terminal excellence** | Beautiful CLI like Claude Code/Cursor, no browser, works over SSH on CentOS 7. |

### Target Environment

- **Primary:** Remote Linux servers (CentOS 7, glibc 2.17) accessed via SSH
- **Design:** Ibex Core (real RISC-V CPU for testing)
- **Tools:** ICC2, Innovus, PrimeTime, Tempus, etc.
- **UI:** Pure terminal, no browser

---

## 2. System Architecture

### 2.1 High-Level Overview

```
hipilot (launcher script)
  └─ tmux session "hipilot"
      ├─ Pane 0 (50%): Claude Code (light fork)
      │    └─ MCP Host
      │         ├─ EDA MCP Server      (Tcl generation, report comprehension, jobs)
      │         ├─ Tmux MCP Server     (pane mgmt, send-to-EDA, status)
      │         └─ Knowledge MCP Server (docs, manuals, skill generation)
      │
      ├─ Pane 1 (50%): EDA Terminal (icc2_shell / innovus / etc.)
      │
      └─ Status Bar: Tool | Skill/Alert | Job Status | Design Context
```

**Key Changes:**
- **50/50 split** (Mode 2), not adaptive layout
- **Pure terminal UI**, beautiful CLI experience
- **AI reads reports** (minimal parsing)

### 2.2 Architectural Approach: MCP-Native with Light Fork (A+)

HiPilot extends Claude Code primarily through MCP servers rather than deep source modification. This gives:

- **90% of functionality** via MCP tools (EDA control, knowledge retrieval, tmux management)
- **10% via source changes** (launcher, system prompt, Tcl action keybinding)
- **Zero fork maintenance burden** for the MCP portion
- **Clean upgrade path** when Claude Code releases new versions

### 2.3 Three-Tier Intelligence Model (Clarified)

```
┌─────────────────────────────────────────────────────┐
│ Tier 1: LLM (Claude - general purpose)               │
│   Role: Intent recognition, parameter extraction,     │
│         reading reports, generating Tcl,             │
│         explaining results to user                   │
│   Does NOT: Generate raw Tcl from memory             │
│         Build complex report parsers                  │
├─────────────────────────────────────────────────────┤
│ Tier 2: Skills (Team Expertise)                      │
│   Role: Workflow definitions, parameter schemas,      │
│         proven patterns, few-shot examples            │
│   Format: Claude Code native skills (markdown + YAML) │
│   Creation: Manual authoring + /skill-gen automation │
│   Nature: Flexible workflows, not rigid scripts       │
├─────────────────────────────────────────────────────┤
│ Tier 3: Templates + Docs (Battle-tested Tcl + Manuals)│
│   Role: Vendor-specific Tcl generation, command       │
│         reference, methodology guides                 │
│   Format: Jinja2 templates (.tcl.j2) + indexed docs   │
└─────────────────────────────────────────────────────┘
```

**Why this works without an EDA-trained LLM:**

The LLM's job is reduced to what general-purpose models already excel at:
1. Understanding natural language intent
2. Extracting structured parameters from conversation
3. **Reading and comprehending report text** (no complex parsers needed)
4. Selecting the right skill/template
5. Explaining results in plain English
6. Generating Tcl informed by docs (not from memory)

Domain expertise lives in skills (authored by PD engineers) and documentation (EDA manuals). When Synopsys releases a new tool version, you update docs — no model retraining needed.

### 2.4 Trust Model

Every generated Tcl script carries a trust badge AND shows reasoning:

| Level | Source | Badge | Coverage | What We Show |
|-------|--------|-------|----------|--------------|
| **Validated** | Skill + Jinja2 template | `[✓ Template]` | ~30% (common workflows) | Template source, parameters |
| **Doc-based** | EDA manual + LLM reasoning | `[📖 Doc-based]` | ~60% (long tail) | Source attribution, reasoning |
| **Unverified** | No skill/docs found | `[⚠ Unverified]` | ~10% (exotic cases) | Warning, no source |

**Transparency beyond badges:**
- Show which documentation was used
- Explain the reasoning process
- Display parameter extraction
- Reveal template selection logic

### 2.5 Simplified MCP Servers

```
EDA MCP Server (Simplified):
  ├─ Tcl template generation
  ├─ Send-to-terminal bridge
  ├─ Basic QoR extraction (minimal parsing)
  ├─ Job management
  └─ Tool detection

Tmux MCP Server (Unchanged):
  ├─ Pane control
  ├─ Send-keys
  ├─ Capture pane
  └─ Status bar

Knowledge MCP Server (Enhanced):
  ├─ Document indexing
  ├─ Command reference
  ├─ Doc search
  └─ Skill generation support (/skill-gen)
```

**Key simplifications:**
- **No complex report parsers:** AI reads raw text instead
- **Minimal QoR extraction:** Just extract key metrics (WNS, TNS, counts)
- **AI comprehends reports:** Let LLM read and understand full text

---

## 3. Component Architecture

### 3.1 EDA MCP Server (Simplified)

The bridge between AI and EDA tools, now with simplified report handling.

**Tools exposed:**

| Tool | Description |
|------|-------------|
| `eda.generate_tcl` | Generates Tcl from intent + template |
| `eda.send_to_terminal` | Writes script to file, sends `source` command to EDA pane |
| `eda.submit_batch` | Submits job via LSF/SGE/Slurm |
| `eda.extract_qor` | Extracts basic metrics (WNS, TNS, counts) - minimal parsing |
| `eda.get_job_status` | Checks running job status |
| `eda.list_templates` | Lists available Tcl templates |
| `eda.detect_tool` | Detects which EDA tool is running in terminal |

**Tcl Generation Engine:**

```
User intent + params
       │
       ▼
  Vendor Adapter (synopsys / cadence)
       │ selects vendor-specific template
       ▼
  Jinja2 Template (e.g., icc2_fix_timing.tcl.j2)
       │ renders with validated parameters
       ▼
  Generated Tcl script
       │
       ▼
  User review → [▶ Run] → EDA terminal
```

**Vendor Adapter Layer:**

```
BaseAdapter (common interface)
  ├─ SynopsysAdapter
  │    ├─ ICC2Adapter    (placement, routing, optimization)
  │    ├─ FCAdapter      (Fusion Compiler flows)
  │    ├─ PTAdapter      (PrimeTime STA)
  │    └─ StarRCAdapter  (parasitic extraction)
  │
  └─ CadenceAdapter
       ├─ InnovusAdapter (placement, routing, optimization)
       ├─ TempusAdapter  (Tempus STA)
       └─ QuantusAdapter (parasitic extraction)
```

**Report Comprehension (New Approach):**

```
Old approach (removed):
  Complex parsers for each report type
  Structured extraction of all fields
  Maintenance burden

New approach (AI-first):
  1. Run EDA tool to generate report
  2. AI reads raw report text
  3. AI comprehends and summarizes
  4. Minimal QoR extraction for metrics (WNS, TNS, counts)
  5. AI provides analysis and suggestions
```

**Basic QoR Extraction:**

Only extract key metrics, let AI handle the rest:

```typescript
interface QoRMetrics {
  wns: number;
  tns: number;
  violation_count: number;
  // Add more as needed, but keep minimal
}
```

**Job Manager:**

Supports multiple job schedulers common in semiconductor companies:

| Submitter | Environment |
|-----------|-------------|
| `LSFSubmitter` | IBM LSF (most common in VLSI) |
| `SGESubmitter` | Sun Grid Engine / Oracle GE |
| `SlurmSubmitter` | Slurm Workload Manager |
| `LocalSubmitter` | Direct shell execution (development) |

### 3.2 Tmux MCP Server

Manages the workspace layout and the chat-to-EDA bridge.

**Tools exposed:**

| Tool | Description |
|------|-------------|
| `tmux.setup_layout` | Creates the HiPilot session with panes |
| `tmux.send_keys` | Sends keystrokes to a named pane |
| `tmux.capture_pane` | Reads current content of a pane |
| `tmux.update_status` | Updates the status bar content |
| `tmux.get_pane_output` | Gets last N lines from a pane |
| `tmux.resize_pane` | Adjusts pane sizes |

**Default Layout (Mode 2 - Fixed 50/50):**

```
┌──────────────────────┬──────────────────────┐
│ Pane 0: "chat" (50%) │ Pane 1: "eda" (50%)  │
│ Claude Code / HiPilot│ EDA tool shell       │
│                      │                      │
│                      │                      │
├──────────────────────┴──────────────────────┤
│ Status Bar                                   │
└──────────────────────────────────────────────┘
```

**Status Bar Format:**

```
Left:   ⚙ {eda_tool} {version}
Center: 📋 {skill_name} | ▶ {job_status} {elapsed}
Right:  {design_name} @ {corner}
```

**Send-to-EDA Bridge:**

When the user approves a Tcl script:
1. Script is written to a temp file: `/tmp/hipilot_{session}_{seq}.tcl`
2. `tmux send-keys` pipes `source /tmp/hipilot_...tcl` to the EDA pane
3. Status bar updates to show running state
4. Scripts are also archived to `{project}/.hipilot/history/` for audit

### 3.3 Knowledge MCP Server (Enhanced)

Documentation-powered reasoning engine with skill generation support.

**Tools exposed:**

| Tool | Description |
|------|-------------|
| `knowledge.search_docs` | Hybrid search across all documentation |
| `knowledge.get_command_ref` | Exact lookup for a specific EDA command |
| `knowledge.get_methodology` | Methodology guide for a topic + tool |
| `knowledge.get_experience` | Search team/personal experience docs |
| `knowledge.generate_skill` | Generate skill from source text (Phase 2) |

**Document Store Structure:**

```
Knowledge Sources
├── EDA Manuals (company-provided)
│   ├── synopsys/
│   │   ├── icc2_command_ref/
│   │   ├── icc2_user_guide/
│   │   ├── primetime_user_guide/
│   │   └── fc_methodology/
│   └── cadence/
│       ├── innovus_text_command_ref/
│       ├── innovus_user_guide/
│       └── tempus_user_guide/
│
├── Team Experience
│   ├── runbooks/
│   ├── postmortems/
│   ├── best_practices/
│   └── faq/
│
└── Project Context
    ├── flow_readme.md
    ├── known_issues.md
    └── design_constraints.md
```

**Ingestion Pipeline:**

```
Raw docs (PDF, HTML, man pages, text)
       │
       ▼
  Document Parsers
  ├─ PDF parser (extract text, preserve structure)
  ├─ HTML parser (Synopsys SolvNet pages)
  └─ Man page parser (structured command docs)
       │
       ▼
  Chunker
  ├─ Command-level chunks (one chunk per EDA command)
  ├─ Section-level chunks (methodology sections)
  └─ Example-level chunks (code examples preserved intact)
       │
       ▼
  Index
  ├─ SQLite FTS5 (full-text keyword search)
  └─ Vector index (optional, for semantic search)
```

**Retrieval Strategy:**

Hybrid retrieval with keyword-first approach:
1. **Exact match** on command names (e.g., `get_timing_paths`) — BM25/FTS5
2. **Semantic search** for methodology questions (e.g., "how to fix hold timing") — vector similarity
3. **Rerank** combined results by relevance
4. **Source attribution** on every returned chunk

**Skill Generation Support (Phase 2):**

The knowledge server supports `/skill-gen` command:
- Parse emails, documentation, forum posts
- Extract workflow steps
- Identify parameters
- Generate skill markdown with YAML frontmatter
- User reviews and edits before saving

---

## 4. Skill System

### 4.1 Skill Format (Claude Code Native)

Skills follow Claude Code's markdown skill format with PD-specific extensions:

```yaml
# ~/.hipilot/skills/fix-setup-timing.md
---
name: fix-setup-timing
description: Analyze and fix setup timing violations
trigger: "fix setup", "fix timing", "close timing"
vendor: [synopsys, cadence]
tools_required: [eda.generate_tcl, eda.extract_qor, knowledge.get_recipe]
---

## Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| path_group | string | yes | — | Target path group name |
| max_paths | int | no | 10 | Number of worst paths to fix |
| strategies | list | no | [size_cell, insert_buffer] | Fix strategies |
| effort | enum | no | medium | low / medium / high |

## Parameter Extraction Examples

User: "fix the 3 worst setup violations on mem_ctrl"
→ path_group: "mem_ctrl", max_paths: 3

User: "timing is not closing on clk_main, only use buffers"
→ path_group: "clk_main", strategies: ["insert_buffer"]

## Validation Rules

- path_group must exist in current design
- max_paths must be between 1 and 100
- if effort=high, warn user about potential cell count impact

## Workflow

1. Read latest timing report → AI comprehends violations
2. Present violation summary to user
3. Generate fix Tcl from template with extracted params
4. Show Tcl to user for review with reasoning
5. On approval, send to EDA terminal
6. Wait for completion, re-read timing report
7. Report before/after delta

## Templates Used

- synopsys: icc2_fix_setup_timing.tcl.j2
- cadence: innovus_fix_setup_timing.tcl.j2
```

### 4.2 Skill Resolution Order

```
1. Project skills:  {project}/.hipilot/skills/    (team-specific)
2. User skills:     ~/.hipilot/skills/             (personal)
3. Built-in skills: {hipilot_install}/skills/      (shipped with HiPilot)
```

Project skills override user skills which override built-in skills (by name).

### 4.3 Tcl Template Format

Templates use Jinja2 syntax (via nunjucks in TypeScript):

```tcl
{# icc2_fix_setup_timing.tcl.j2 #}
# HiPilot Generated - {{ timestamp }}
# Intent: Fix setup timing on {{ path_group }}
# Trust: [✓ Template]

set paths [get_timing_paths \
  -group {{ path_group }} \
  -max_paths {{ max_paths }} \
  -slack_lesser_than 0 \
  -delay_type max]

set path_count [sizeof_collection $paths]
if { $path_count == 0 } {
  puts "INFO: No setup violations found on {{ path_group }}"
  return
}

puts "INFO: Found $path_count violating paths"

{% for strategy in strategies %}
{% if strategy == "size_cell" %}
# Strategy: cell sizing
foreach_in_collection path $paths {
  set cells [get_cells -of_objects [get_attribute $path startpoint]]
  size_cell $cells
}
{% elif strategy == "insert_buffer" %}
# Strategy: buffer insertion
foreach_in_collection path $paths {
  set nets [get_nets -of_objects [get_attribute $path startpoint]]
  insert_buffer $nets -lib_cell {{ buffer_cell | default("BUFFD4") }}
}
{% endif %}
{% endfor %}

# Post-fix verification
report_timing -group {{ path_group }} -max_paths {{ max_paths }}
```

### 4.4 Skill Flywheel

```
Senior engineer solves a novel problem manually
       ↓
HiPilot observes: "You ran these commands to fix IR drop.
                   Save as a skill?"
       ↓
Engineer refines the template, adds params
       ↓
New skill committed to .hipilot/skills/
       ↓
Every team member can now use it via natural language
```

### 4.5 Skill Generation (Phase 2)

Auto-generate skills from existing documentation:

```bash
/skill-gen /path/to/team_runbook.md
/skill-gen /path/to/email_thread.txt
/skill-gen /path/to/forum_post.html
```

Process:
1. Parse source document
2. Extract workflow steps
3. Identify parameters and validation rules
4. Generate skill markdown with YAML frontmatter
5. User reviews and edits
6. Save to appropriate skill directory

---

## 5. Claude Code Fork Delta

### 5.1 Modifications Summary

| # | Change | Location | Purpose |
|---|--------|----------|---------|
| 1 | Launcher script | `bin/hipilot` (new file) | tmux setup, MCP server start, Claude Code launch |
| 2 | System prompt | `src/prompts/hipilot-system.md` (new file) | PD-specific context, safety rules, transparency emphasis |
| 3 | Tcl action | Keybinding handler (minimal patch) | `Ctrl+Enter` sends Tcl block to EDA pane |

### 5.2 Launcher Script

```bash
#!/bin/bash
# bin/hipilot - HiPilot Launcher

set -euo pipefail

HIPILOT_SESSION="${HIPILOT_SESSION:-hipilot}"
HIPILOT_HOME="${HIPILOT_HOME:-$HOME/.hipilot}"
HIPILOT_CONFIG="${HIPILOT_HOME}/config.yaml"

# Ensure config exists
if [ ! -f "$HIPILOT_CONFIG" ]; then
  echo "First time setup - run 'hipilot setup' first."
  exit 1
fi

# Create tmux session with layout (50/50 split)
tmux new-session -d -s "$HIPILOT_SESSION" \
  -x "$(tput cols)" -y "$(tput lines)"
tmux split-window -h -t "$HIPILOT_SESSION" -p 50

# Configure status bar
tmux set-option -t "$HIPILOT_SESSION" status on
tmux set-option -t "$HIPILOT_SESSION" status-style "bg=#1a1a2e,fg=#e0e0e0"
tmux set-option -t "$HIPILOT_SESSION" status-left \
  "#[fg=#00d4ff,bold] HiPilot #[default]| #[fg=#ffd700]Ready#[default] "
tmux set-option -t "$HIPILOT_SESSION" status-right \
  "#[fg=#00ff88]No active job#[default] | %H:%M"
tmux set-option -t "$HIPILOT_SESSION" status-interval 5

# Start Claude Code with HiPilot MCP config in left pane
tmux send-keys -t "$HIPILOT_SESSION:0.0" \
  "claude --mcp-config ${HIPILOT_HOME}/mcp-servers.json" Enter

# Label right pane
tmux send-keys -t "$HIPILOT_SESSION:0.1" \
  "echo '── EDA Terminal ── Start your tool: icc2_shell, innovus, etc.'" Enter

# Attach
tmux attach-session -t "$HIPILOT_SESSION"
```

### 5.3 System Prompt (Key Sections)

```markdown
You are HiPilot, a physical design copilot for VLSI engineers.

## Your Role
- Help PD engineers with floorplanning, placement, routing, CTS, and signoff
- Generate Tcl scripts using skills and templates (NEVER from memory)
- Read and comprehend EDA reports (let AI understand raw text)
- Always show your work — transparency is non-negotiable

## Safety Rules
- NEVER send Tcl to the EDA terminal without user approval
- ALWAYS show the trust badge: [✓ Template], [📖 Doc-based], or [⚠ Unverified]
- ALWAYS show source attribution and reasoning for doc-based generation
- If unsure about a command, look it up via knowledge.get_command_ref
- NEVER modify the design database directly — only through reviewed Tcl scripts

## Transparency Rules
- Show which documentation was used
- Explain your reasoning process
- Display parameter extraction
- Reveal template selection logic
- Don't just show badges — explain WHY

## Workflow
1. Understand the user's intent
2. Check if a skill matches → use skill + template (preferred)
3. If no skill → search documentation → generate with attribution
4. Present Tcl for review with trust badge AND reasoning
5. Execute only on explicit user approval
6. Read and comprehend results, report back

## Report Comprehension
- Read raw report text, don't rely on complex parsers
- Extract key metrics (WNS, TNS, counts) with minimal parsing
- Let AI comprehend full report for analysis
- Provide insights and suggestions
```

---

## 6. Configuration

### 6.1 User Configuration (`~/.hipilot/config.yaml`)

```yaml
# HiPilot User Configuration

# EDA tool paths
tools:
  synopsys:
    icc2: /tools/synopsys/icc2/2024.09/bin/icc2_shell
    pt: /tools/synopsys/pt/2024.09/bin/pt_shell
    starrc: /tools/synopsys/starrc/2024.09/bin/StarXtract
  cadence:
    innovus: /tools/cadence/innovus/23.1/bin/innovus
    tempus: /tools/cadence/tempus/23.1/bin/tempus

# Job scheduler
scheduler:
  type: lsf          # lsf | sge | slurm | local
  queue: normal
  memory: 32G
  cpu: 8

# Documentation paths
docs:
  synopsys: /tools/synopsys/docs/
  cadence: /tools/cadence/docs/
  team: /proj/shared/pd_knowledge/

# Layout preferences (Mode 2: Fixed 50/50)
layout:
  mode: 2            # Mode 2 = 50/50 split, not adaptive
  chat_width: 50      # percentage
  eda_width: 50

# Monitoring (Phase 2+)
monitoring:
  enabled: false
```

### 6.2 Project Configuration (`{project}/.hipilot/config.yaml`)

```yaml
# Project-specific HiPilot config

design:
  name: ibex
  technology: sky130hd
  corners:
    - ss_0.72v_125c
    - ff_0.88v_-40c
    - tt_0.80v_25c
  primary_corner: ss_0.72v_125c
  clocks:
    - name: clk_main
      period: 10ns
    - name: clk_periph
      period: 20ns

eda:
  tool: synopsys       # synopsys | cadence
  version: icc2_2022.03
  flow_stage: placement  # floorplan | placement | cts | routing | post_route | signoff

paths:
  scripts: ./scripts/
  reports: ./reports/
  checkpoints: ./checkpoints/
```

### 6.3 MCP Server Configuration (`~/.hipilot/mcp-servers.json`)

```json
{
  "mcpServers": {
    "hipilot-eda": {
      "command": "node",
      "args": ["~/.hipilot/servers/eda-mcp/dist/index.js"],
      "env": {
        "HIPILOT_HOME": "~/.hipilot"
      }
    },
    "hipilot-tmux": {
      "command": "node",
      "args": ["~/.hipilot/servers/tmux-mcp/dist/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot"
      }
    },
    "hipilot-knowledge": {
      "command": "node",
      "args": ["~/.hipilot/servers/knowledge-mcp/dist/index.js"],
      "env": {
        "HIPILOT_HOME": "~/.hipilot"
      }
    }
  }
}
```

---

## 7. Data Flow

### 7.1 End-to-End: Intent to Execution

```
Engineer: "fix the 3 worst setup violations on gpu_core"
    │
    ├─→ [LLM] Intent: fix_setup_timing
    ├─→ [LLM] Params: {path_group: "gpu_core", max_paths: 3}
    ├─→ [LLM] Skill match: fix-setup-timing ✓
    │
    ├─→ knowledge.get_design_info()
    │   → tool: ICC2, corner: ss_0.72v_125c
    │
    ├─→ eda.extract_qor("timing")
    │   → WNS: -0.15ns, 23 violations on gpu_core
    │
    ├─→ [AI reads full timing report]
    │   → Comprehends violation patterns
    │   → Identifies undersized buffer
    │
    ├─→ eda.generate_tcl({
    │     action: "fix_setup_timing",
    │     vendor: "synopsys", tool: "icc2",
    │     params: {path_group: "gpu_core", max_paths: 3,
    │              strategies: ["size_cell", "insert_buffer"]}
    │   })
    │   → rendered Tcl from template
    │
    ├─→ [Present to user]
    │   "Here's the fix script: ...
    │    [✓ Template] Source: icc2_fix_setup_timing.tcl.j2
    │    Reasoning: Detected 23 violations, focusing on worst 3 paths.
    │               Will size cells first, then insert buffers if needed.
    │    [▶ Run] [✎ Edit]"
    │
    ├─→ [User approves: ▶ Run]
    │
    ├─→ eda.send_to_terminal({script: "/tmp/hipilot_001.tcl"})
    │   └─→ tmux.send_keys(pane: "eda", "source /tmp/hipilot_001.tcl\n")
    │
    ├─→ tmux.update_status({skill: "fix-setup-timing", job: "running"})
    │
    ├─→ [EDA executes in terminal]
    │
    ├─→ [AI reads new timing report]
    │   → WNS: -0.02ns, 5 violations remaining
    │   → Comprehends improvement
    │
    └─→ [Report to user]
        "WNS improved -0.15ns → -0.02ns. Fixed 18/23 paths.
         Remaining violations are marginal, may need one buffer insertion."
```

### 7.2 Doc-based Generation (No Skill Match)

```
Engineer: "add a keepout region around the SRAM, 5um on all sides"
    │
    ├─→ [LLM] Intent: create keepout region
    ├─→ [LLM] Skill match: NONE
    │
    ├─→ knowledge.get_command_ref("icc2", "create_keepout_margin")
    │   → returns: syntax, options, examples from manual p.1247
    │
    ├─→ knowledge.search_docs("keepout region macro ICC2")
    │   → returns: methodology guide section + team best practices
    │
    ├─→ [LLM generates Tcl informed by docs, NOT from memory]
    │
    └─→ [Present to user]
        "Here's the script: ...
         [📖 Doc-based]
         Source: ICC2 Command Reference p.1247, 'create_keepout_margin'
         Reasoning: Based on docs, create_keepout_margin is the correct command.
                    Using -hard_keepout with 5.0um margin on all sides.
         [▶ Run] [✎ Edit]"
```

---

## 8. Deployment

### 8.1 Target Environment

- **Primary:** Remote Linux servers (CentOS 7, glibc 2.17) accessed via SSH
- **Secondary:** Local workstations (macOS/Linux) for script development
- **Requirements:** tmux, Node.js v16.x, Claude API key
- **UI:** Pure terminal, no browser

### 8.2 Installation

```bash
# 1. Install HiPilot
npm install -g @hipilot/cli

# 2. Run setup wizard
hipilot setup

# 3. Start working
hipilot
```

The setup wizard (`hipilot setup`) handles:
- EDA tool path detection
- Documentation path configuration
- Job scheduler selection
- Claude API key setup
- Initial document indexing

### 8.3 Upgrade Path

Since HiPilot is a light fork of Claude Code:
- MCP servers upgrade independently (npm update)
- Claude Code base merges upstream changes periodically
- Skills/templates are user-managed (git-controlled)

---

## 9. Testing Strategy

### 9.1 EDA Server Environment

| Item | Value |
|------|-------|
| **Server** | 192.168.112.163 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v16.20.2 |
| **Design** | Ibex Core (RISC-V CPU) |

### 9.2 Real Design Testing

All features tested on Ibex core:
- Complete RTL-to-GDS flow
- Real timing reports
- Real DRC violations
- Real signoff checks

### 9.3 Screen Recording

Every feature must have demo video:
- Recorded on EDA server (CentOS 7)
- Shows complete workflow
- 1-5 minutes per feature
- Xvfb + ffmpeg infrastructure ready

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Tcl injection** | Templates use parameterized rendering; raw user input never interpolated directly into Tcl |
| **API key exposure** | Claude API key stored in `~/.hipilot/credentials` with 600 permissions, never logged |
| **Design data privacy** | All processing is local; only conversation text goes to Claude API (no design files) |
| **EDA license compliance** | HiPilot does not bundle or redistribute EDA tools; uses existing installations |
| **Accidental destructive commands** | System prompt forbids `remove_design`, `delete_objects` without explicit user request |

---

## 11. Technical Realities

### 11.1 Platform Constraints

- **CentOS 7:** glibc 2.17 (common in semiconductor industry)
- **Node.js v16.20.2:** Last version compatible with glibc 2.17
- **No browser:** Pure terminal UI only
- **SSH only:** No GUI dependencies

### 11.2 Design for Testing

- **Ibex Core:** Open-source RISC-V CPU
- **Complete flow:** RTL-to-GDS available
- **Real problems:** Real timing violations, real DRC issues
- **Validates:** Tcl generation, report comprehension, skills

### 11.3 Simplification Decisions

**What we DON'T do:**
- Complex report parsers (AI reads raw text)
- Custom skill format (use Claude Code's native skills)
- Rigid workflows (skills are flexible, AI adapts)
- Trust badges alone (show reasoning and sources)
- Web UI (pure terminal only)
- Latest Node.js (v16.x is fine)
- Adaptive layouts (Mode 2: 50/50 fixed)

**What we DO:**
- Beautiful terminal UI (Claude Code/Cursor style)
- Mode 2 layout (50/50 split, fixed)
- AI comprehends reports (minimal parsing)
- Auto-generate skills from docs
- Show reasoning and sources
- Three-tier intelligence model
- Knowledge capture as primary value

---

## 12. Appendix: Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| MCP servers | TypeScript (Node.js v16.x) | Matches Claude Code's stack, compatible with glibc 2.17 |
| Tcl templates | Jinja2 (via nunjucks) | Industry standard, JS-native port available |
| Report comprehension | AI (GPT-4/Claude) + minimal QoR parsing | Let AI read text, don't build complex parsers |
| Document indexing | SQLite + FTS5 | Lightweight, local, no external DB |
| Embedding search | Optional (later phase) | Start with keyword search, add as needed |
| Launcher | Bash | Simple, universal, tmux is bash-native |
| Config format | YAML | Readable, familiar to engineers |
| UI | Pure terminal (Claude Code fork) | Works over SSH, no browser, beautiful CLI |
| Layout | Mode 2 (50/50 fixed) | Simple, predictable, not adaptive |
