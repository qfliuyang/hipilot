# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HiPilot is a VLSI Physical Design copilot system - a lightweight fork of Claude Code with three specialized MCP (Model Context Protocol) servers. It provides physical design engineers with an AI-powered assistant that generates vendor-specific Tcl scripts, parses EDA reports, and manages a tmux-based workspace.

**Current State:** This repository contains **architectural documentation and specifications only**. The actual implementation is being developed on a separate EDA server with real tool access.

## Critical Context from Architecture Discussion

This section captures the key insights, decisions, and concerns that emerged during the architecture design process. **Read this first before making any changes.**

### 1. Why HiPilot Exists (The Core Problem)

**Skills are the primary value proposition**, not AI automation.

The problem HiPilot solves: **Knowledge capture and sharing**, not just faster Tcl generation.

```
Without HiPilot:
Senior engineer solves complex timing issue → Knowledge stays in their head
→ Junior engineers make same mistakes → Team repeats work
→ When senior leaves, expertise leaves

With HiPilot:
Senior engineer documents solution (email/wiki/post)
→ AI turns it into a reusable skill
→ Anyone can execute: "fix my post-CTS setup violations"
→ Team builds library of proven solutions
```

**Key insight:** The value is in **skills encoding team expertise**, making senior-level workflows executable by junior engineers.

### 2. The Architecture Discussion: Key Decisions

#### Decision 1: Pure Terminal UI (No Browser)

**Decision:** Stay with pure terminal-based implementation.

**Rationale:**
- EDA engineers work on remote Linux servers via SSH
- Firefox on Linux is "a disaster"
- Modern terminal UIs (Claude Code, Cursor, Windsurf) prove beautiful CLI is possible
- Target users are already comfortable in terminals

**Implementation:**
- Use TUI libraries: blessed, ink, chalk, cli-table3
- Modern color schemes (Dracula, Nord, Catppuccin)
- Box drawing, syntax highlighting, progress indicators
- Keyboard shortcuts prominently displayed

#### Decision 2: Mode 2 Layout (Side-by-Side Split)

**Decision:** Fixed 50/50 split layout, not adaptive.

**Layout:**
```
┌──────────────────────┬──────────────────────┐
│      Chat            │      EDA Terminal    │
│      (50%)           │      (50%)           │
│                      │                      │
│  Claude Code /       │  icc2_shell /        │
│  HiPilot running     │  innovus /           │
│  here                │  pt_shell            │
└──────────────────────┴──────────────────────┘
```

**Rationale:**
- See both AI and EDA output simultaneously
- Watch EDA tool execute in real-time
- Chat pane has room for long responses
- Alt+S can toggle between focus/split modes if needed

**What's in each pane:**
- **Chat Pane (Left):** Claude Code with HiPilot system prompt, MCP servers connected
- **EDA Pane (Right):** Whatever EDA tool the engineer started (icc2_shell, innovus, etc.)

#### Decision 3: AI Reads Raw EDA Output (No Parsers)

**Critical insight:** Building parsers makes the AI feel "dumb" not intelligent.

**The Problem:**
```
When you have 50 regex parsers extracting data:
- User thinks: "This is just text processing, not AI"
- Maintaining parsers = nightmare (tool versions, custom formats)
- LLMs are GOOD at reading messy text - why not use that?
```

**The Solution:**
```
AI directly reads EDA reports:
1. Capture raw EDA output (tmux.capture_pane)
2. Show to Claude: "Analyze this timing report"
3. Claude comprehends patterns, identifies issues
4. Claude suggests solutions based on documentation
5. Claude generates Tcl (with attribution to docs/skills)
```

**What we still parse:**
- Minimal structured extraction for QoR tracking (WNS, TNS, violation counts)
- Let AI do the heavy lifting of comprehension

#### Decision 4: Skills Must Be Auto-Generated

**The Friction Problem:** Manual skill authoring is too demanding.

```
To write ONE skill manually:
- YAML frontmatter with 10+ fields
- Parameter types and validation rules
- 3-5 few-shot examples
- Workflow documentation
- Jinja2 template
- Testing and refinement

Senior engineers won't do this. They just want to share what worked.
```

**The Solution: AI-Generated Skills**

```
Input (any format):
Email, wiki post, runbook, or even verbal description:
  "I fixed the PCIe timing by sizing up clk_buf_2 from X2 to X8.
   Don't use buffer insertion on clocks - it creates hold violations."

Output (complete skill):
- YAML frontmatter with metadata
- Parameters extracted automatically
- Few-shot examples generated from context
- Tcl template extracted from code blocks
- Workflow steps identified
- Lessons learned captured

Command: /skill-gen "turn this into a skill: [paste text]"
```

**Use Claude Code's native skill format** - don't reinvent. HiPilot extends it with EDA-specific fields.

#### Decision 5: Trust Through Transparency, Not Badges

**Revised trust model:**

```
Old thinking:
[✓ Template] = trusted (hardcoded)
[⚠ Unverified] = scary (AI guessed)

Better approach:
Show the reasoning, not just the badge:
  "I analyzed your timing report and found 47 violations.
   34 share undersized clock buffer clk_buf_2.
   Based on Synopsys CTS methodology doc (section 4.3),
   sizing up clock buffers before data path optimization
   prevents hold violations. Here's the Tcl: [...]

The user trusts it because they can VERIFY the reasoning,
not because of a badge."
```

**Trust badges still exist** but indicate source:
- `[✓ Template]` - From team skill (tested)
- `[📖 Doc-based]` - From EDA manual (show source)
- `[⚠ AI-generated]` - No skill/doc found (explain why)

### 3. Technical Realities Discovered

#### EDA Server Environment (Verified)

**Connection:** `ssh EDA@192.168.112.163` (private build, not production)

**System:**
- OS: CentOS 7.9.2009 (glibc 2.17)
- **Critical:** Old glibc means modern Node.js won't work
- **Solution:** Node.js v16.20.2 works (installed at `/home/EDA/hipilot_test/node-v16.20.2-linux-x64/`)

**EDA Tools Available:**
- Synopsys ICC2: T-2022.03
- Synopsys PrimeTime: T-2022.03
- Cadence Innovus: v20.10-p004_1
- Plus: StarRC, SpyGlass, Calibre, Tempus

**Development Tools:**
- Node.js: v16.20.2 (verified working)
- npm: 8.19.4
- Python: 3.6.8, 2.7.5
- tmux: 1.8
- git, gcc, g++: Available

**Workspace:** `/home/EDA/hipilot_test/`

#### Real EDA Tool Behavior (Important for Parsing)

**ICC2:**
- Requires a loaded design before most commands work
- Output format: Text-based, structured sections
- Commands: `report_timing`, `report_constraint`, `help [command]`

**Innovus:**
- Can start without design (limited commands)
- Extensive help system: `help report_timing` shows full syntax
- Output format: Similar to ICC2 but different column names and structure

**Key finding:** Machine-readable options exist:
- ICC2: Some commands support `-machine_readable` or `-tcl_list`
- Innovus: `-collection` flag returns structured data
- **Use these when available** instead of text parsing

### 4. Architecture Refinements

#### Three-Tier Model (Clarified)

```
Tier 1: LLM (Claude)
  Role: Intent recognition, parameter extraction, reading reports,
        generating Tcl, explaining reasoning
  Does NOT: Generate Tcl from memory (always grounded in docs/skills)

Tier 2: Skills (PD engineer-authored OR AI-generated)
  Role: Workflow definitions, parameter schemas, templates,
        proven patterns, team knowledge
  Format: Claude Code skill format + EDA extensions

Tier 3: Templates + Documentation
  Role: Vendor-specific Tcl, command reference, methodology guides
  Format: Jinja2 templates + indexed EDA manuals
```

**Why this works without EDA-trained LLM:**
- LLM reads/comprehends (what it's good at)
- Skills provide workflows (what engineers know)
- Templates provide correct Tcl (what vendors specify)
- Docs provide ground truth (no hallucination)

#### MCP Server Architecture (Simplified)

**Remove:** Complex report parsers (let AI read raw output)

**EDA MCP Server:**
- `eda.generate_tcl` - Generate from template OR doc-based
- `eda.send_to_terminal` - Send to EDA pane via tmux
- `eda.detect_tool` - What's running in EDA pane?
- `eda.get_qor` - Quick QoR extraction (minimal parsing)

**Tmux MCP Server:**
- `tmux.send_keys` - Send to panes
- `tmux.capture_pane` - Read pane output
- `tmux.setup_layout` - Create HiPilot session
- `tmux.update_status` - Status bar

**Knowledge MCP Server:**
- `knowledge.search_docs` - Search EDA manuals
- `knowledge.get_command_ref` - Exact command lookup
- `knowledge.get_methodology` - Flow-specific guidance

#### Skill System (Enhanced)

**Use Claude Code skills as base:**
- Markdown + YAML frontmatter
- `/skills` commands work natively
- Compatible with Claude Code ecosystem

**HiPilot extensions:**
```yaml
---
# Claude Code fields
name: fix-setup-timing
description: Fix setup timing violations

# HiPilot extensions
hipilot:
  vendor: [synopsys, cadence]
  has_template: true
  template_path: templates/fix_setup_timing.tcl.j2
  auto_generated: false  # true if AI-created
  source_doc: "From email: Re: PCIe timing fix"
  flexible: true  # AI can adapt workflow
---

## Parameters (same as Claude Code)
## Workflow (same as Claude Code)

## HiPilot additions
### Core Principles
- Size clock buffers before data paths
- Incremental sizing (X2 → X4 → X8)

### What AI Can Adapt
- If violation pattern doesn't match, explain why
- If results unexpected, suggest alternative
- Learn from execution and improve
```

### 5. Development Priorities (Reordered)

**Given the above insights:**

1. **P0: Terminal UI Enhancement**
   - Beautiful, modern TUI (colors, boxes, syntax)
   - Status bar with QoR context
   - Keyboard shortcuts
   - Progress indicators

2. **P0: Tmux Integration**
   - Send-to-EDA bridge
   - Pane capture
   - Layout setup
   - Status bar updates

3. **P0: Basic Tcl Generation**
   - Template engine (Nunjucks)
   - 3-5 basic templates
   - Doc-based Tcl generation (when no template)

4. **P1: AI Reads Reports**
   - Capture raw output
   - AI comprehends and explains
   - Pattern identification
   - QoR extraction (minimal)

5. **P1: Skill System**
   - Skill loader (Claude Code format)
   - Skill matching
   - **Manual authoring first**
   - Auto-generation (later)

6. **P2: Knowledge System**
   - Document indexing
   - Command reference
   - Doc search

7. **P2: Report Parsers**
   - Only for QoR metrics (WNS, TNS, counts)
   - Let AI do full comprehension

### 6. Important Constraints

#### Claude Code Fork Reality

**Can do:**
- System prompt customization
- UI enhancements (TUI)
- MCP server configuration
- Keybindings (Ctrl+Enter for Tcl)

**Cannot easily do:**
- Major architecture changes
- Breaking from Claude Code updates
- Custom skill format (use native)

**Strategy:** Keep fork minimal (10% changes), leverage MCP for 90% of functionality.

#### Node.js Version Constraint

**Problem:** CentOS 7 has glibc 2.17, modern Node.js requires glibc 2.28+

**Solution:**
- Use Node.js v16.x (last version compatible with glibc 2.17)
- Installed and tested: v16.20.2 works perfectly
- `package.json` must specify: `"engines": { "node": ">=16 <17" }`

#### EDA Tool Limitations

**No design = no testing:** Most EDA commands require loaded design

**Workarounds:**
- Use `help` commands to learn syntax
- Use sample designs if available
- Create minimal test designs
- Test parsers on sample outputs in docs

### 7. What NOT to Do (Learned from Discussion)

❌ **Don't build complex report parsers** - Let AI read raw text
❌ **Don't create custom skill format** - Use Claude Code's native skills
❌ **Don't make rigid workflows** - Skills should be flexible, AI can adapt
❌ **Don't rely on trust badges alone** - Show reasoning and sources
❌ **Don't use web UI** - Stay pure terminal
❌ **Don't require latest Node.js** - v16.x is fine for this use case
❌ **Don't hide AI's work** - Transparency is non-negotiable

### 8. Development Workflow (with EDA Server Access)

**When implementing features:**

```bash
# 1. SSH to EDA server
ssh EDA@192.168.112.163

# 2. Set up environment
export PATH=/home/EDA/hipilot_test/node-v16.20.2-linux-x64/bin:$PATH
cd /home/EDA/hipilot_test

# 3. Test against real tools
icc2_shell  # or innovus, pt_shell

# 4. Generate sample outputs
report_timing -max_paths 10 > /tmp/timing_test.rpt

# 5. Test parsers/code against real data
node test_parser.js /tmp/timing_test.rpt

# 6. Iterate based on actual tool behavior
```

**Key advantage:** Can validate everything against real EDA tools, not theoretical specs.

## Original Documentation (Still Relevant)

The following sections from the original architecture docs remain accurate and should be referenced:

### MCP Server Specifications
- `docs/specs/eda-mcp-server-spec.md` - Tool APIs
- `docs/specs/tmux-mcp-server-spec.md` - Tmux operations
- `docs/specs/knowledge-mcp-server-spec.md` - Knowledge system

### Product Requirements
- `docs/prd.md` - Problem statement, success metrics
- `docs/roadmap.md` - Development phases

### UX Patterns
- `docs/specs/ux-specification.md` - Interaction design
- `docs/guides/skill-authoring-guide.md` - How to write skills

### Configuration System

**User Configuration (`~/.hipilot/config.yaml`):**
```yaml
tools:
  synopsys:
    icc2: /opt/synopsys/icc2_2022.03/T-2022.03/bin/icc2_shell
    pt: /opt/synopsys/prime_2022.03/T-2022.03/bin/pt_shell
  cadence:
    innovus: /opt/cadence/INNOVUS20.10/tools.lnx86/bin/innovus

scheduler:
  type: lsf
  queue: normal

docs:
  synopsys: /tools/synopsys/docs/
  cadence: /tools/cadence/docs/
  team: /proj/shared/pd_knowledge/

layout:
  mode: split  # focus | split
  chat_width: 50
  eda_width: 50
```

**Project Configuration (`{project}/.hipilot/config.yaml`):**
```yaml
design:
  name: test_design
  technology: tsmc7ff
  corners:
    - ss_0.72v_125c
    - tt_0.80v_25c

eda:
  tool: synopsys  # synopsys | cadence
  version: icc2_2022.03
  flow_stage: post_route

paths:
  scripts: ./scripts/
  reports: ./reports/
  checkpoints: ./checkpoints/
```

## Quick Start for New Sessions

When starting a new development session:

1. **Read this section first** (Critical Context from Architecture Discussion)
2. **Connect to EDA server** to test against real tools
3. **Reference the MCP specs** for implementation details
4. **Use Node.js v16.x** (not newer)
5. **Stay pure terminal** (no web UI)
6. **Let AI read reports** (don't over-engineer parsers)
7. **Focus on skills** (the core value proposition)
8. **Make it beautiful** (modern terminal UI)

## Technology Stack

- **Base:** Claude Code (light fork)
- **MCP Protocol:** Model Context Protocol
- **Runtime:** Node.js v16.x (glibc 2.17 compatibility)
- **Language:** TypeScript 5+
- **Template Engine:** Nunjucks (Jinja2-compatible)
- **Database:** SQLite with FTS5
- **Terminal:** tmux 1.8+
- **UI Libraries:** chalk, blessed, cli-table3, ora

## Success Metrics (from PRD)

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Tcl accuracy** | >95% of template-based scripts run without errors | Track `source` success/failure |
| **Time savings** | 30% reduction in time from "intent" to "running Tcl" | User surveys + session timing |
| **Adoption** | 80% of team uses HiPilot daily within 1 month | Usage logs |
| **Skill creation** | 5+ team-authored skills per project within 3 months | Count skills in `.hipilot/skills/` |
| **Trust** | Engineers approve >90% of generated Tcl on first presentation | Track approval vs edit vs reject |

---

## EDA Server - Real Design Testing

### Connection Details
- **Server:** 192.168.112.163
- **User:** EDA
- **Password:** eda2020
- **Root Password:** 2020
- **Workspace:** `/home/EDA/hipilot_test/`

### Real Design Available: Ibex Core

**Design:** Ibex - 32-bit RISC-V CPU (RV32IMC)
**Technology:** Skywater 130nm HD (sky130hd)
**Location:** `/home/EDA/hipilot_test/ibex_work_upload/`

This is a COMPLETE RTL-to-GDS flow including:
- Real RTL source (~20 Verilog files for Ibex CPU)
- Synthesis scripts (Design Compiler)
- Place & Route scripts (Innovus) - init, floorplan, placement, CTS, routing, optimization
- STA scripts (PrimeTime)
- Physical Verification (Calibre DRC/LVS)
- Power Analysis (Voltus)
- Parasitic Extraction (StarRC)

**Use this for testing:**
- Tcl template generation (real production scripts)
- Report parsing (real timing/DRC/power/area reports)
- Skill workflows (complete flow stages from synthesis to signoff)
- Integration testing (end-to-end workflows)

### Quick Test Commands

After SSH connection to EDA server:
```bash
cd /home/EDA/hipilot_test/ibex_work_upload

# Available flow stages:
make syn          # Synthesis (Design Compiler)
make init         # Initialize design in Innovus
make floor_plan   # Floorplanning
make place_io     # IO placement
make power_plan   # Power network
make placement    # Standard cell placement
make cts          # Clock tree synthesis
make post_cts_opt # Post-CTS optimization
make routing      # Routing
make routing_opt  # Routing optimization
make chip_done    # Final outputs
make run_pt       # PrimeTime timing analysis
make drc          # Calibre DRC
make lvs          # Calibre LVS
make static_ir    # Voltus static IR analysis
```

### Screen Recording for Demos

**Location:** `/home/EDA/hipilot_test/`

**Scripts Available:**
- `screen_recording_setup.sh` - One-time setup (already run)
- `start_recording.sh [desc]` - Start screen recording
- `stop_recording.sh` - Stop and finalize recording

**Workflow:**
```bash
# On EDA server
cd /home/EDA/hipilot_test

# 1. Start recording
./start_recording.sh "feature_description"

# 2. Demonstrate your feature
# (work in terminal, show HiPilot working)

# 3. Stop recording
./stop_recording.sh

# 4. From local machine - transfer video
scp EDA@192.168.112.163:~/hipilot_test/recordings/*.mp4 .
```

**Recording Specs:**
- Virtual Display: Xvfb on :99 (1920x1080)
- Encoder: ffmpeg with H.264
- Format: MP4
- Framerate: 25 fps
- Quality: CRF 23 (good quality, reasonable size)
- Typical size: 5-50 MB for 1-5 minute demos

**REQUIREMENT:** Each major feature completion MUST include a screen recording video demonstrating it working on the EDA server (CentOS 7). This ensures HiPilot actually works on the target platform.

See `docs/SCREEN_RECORDING_SETUP.md` for complete guide.

### Environment on EDA Server

**Installed:**
- Node.js v16.20.2 (at `/home/EDA/hipilot_test/node-v16.20.2-linux-x64/`)
- npm 8.19.4
- Python 3.6.8, 2.7.5
- tmux 1.8
- ffmpeg 2.8.15 (with x11grab for screen recording)
- Xvfb (virtual X server for headless recording)

**EDA Tools:**
- Synopsys ICC2 T-2022.03
- Synopsys PrimeTime T-2022.03
- Cadence Innovus v20.10-p004_1
- Plus: StarRC, SpyGlass, Calibre, Voltus

**PATH Setup (add to ~/.bashrc):**
```bash
export PATH=/home/EDA/hipilot_test/node-v16.20.2-linux-x64/bin:$PATH
export DISPLAY=:99  # For screen recording
```
