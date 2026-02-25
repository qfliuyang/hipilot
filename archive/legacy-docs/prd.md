# HiPilot - Product Requirements Document

**Date:** 2026-02-19
**Version:** 2.0
**Status:** Updated

---

## 1. Problem Statement

Physical design engineers spend 60-70% of their time on repetitive, tool-specific tasks:
- Writing and debugging Tcl scripts for EDA tools (ICC2, Innovus, PrimeTime, Tempus)
- Reading and interpreting lengthy timing/power/DRC reports
- Looking up tool commands in 1000+ page manuals
- Re-discovering solutions to problems the team has already solved
- Onboarding junior engineers who lack tribal knowledge

**Core Problem:** Engineering teams lose valuable knowledge when senior engineers leave, and junior engineers spend months rediscovering solutions that already exist in email threads, wiki pages, and tribal knowledge.

Existing AI-EDA solutions (Synopsys DSO.ai, Cadence Cerebrus) are black-box optimizers that remove the engineer from the loop. They optimize parameters but don't help with the daily workflow of understanding, debugging, and iterating.

## 2. Target User

**Primary persona: Physical Design Engineer**

- Works on floorplanning, placement, CTS, routing, and signoff
- 2-15 years of experience (from junior to senior)
- Uses Synopsys (ICC2/FC, PrimeTime, StarRC) and/or Cadence (Innovus, Tempus, Quantus)
- Works on remote Linux servers via SSH + tmux
- Writes Tcl scripts daily
- Reads timing/power/DRC reports daily
- Has access to EDA tool manuals and team runbooks

**User needs by experience level:**

| Level | Primary Need |
|-------|-------------|
| Junior (0-3 years) | "What command do I use? What does this report mean? How did we solve this before?" |
| Mid (3-7 years) | "Generate the Tcl for me, I'll review and tweak it" |
| Senior (7+ years) | "Quick shortcuts, capture my knowledge as reusable skills, auto-generate skills from my work" |

## 3. Product Vision

HiPilot is **a senior colleague in your terminal** who:
- **Knows every command** in every manual
- **Remembers what the team did last time** (skills capture tribal knowledge)
- **Generates correct Tcl scripts** for your review
- **Reads and comprehends reports** (AI understands raw text, no complex parsers)
- **Auto-generates skills** from emails, docs, and posts (via `/skill-gen`)
- **Never touches the design** without your permission

### Core Value: Skills as Knowledge Capture

**Skills are the primary value prop** - they encode team expertise that would otherwise be lost:
- Senior engineers solve a problem once → skill is created
- Junior engineers can now execute senior-level flows via natural language
- Knowledge scales across the team instead of staying in one person's head
- Skills accumulate over time, making the team more capable collectively

## 4. Competitive Landscape

| Product | Approach | Limitation |
|---------|----------|-----------|
| **Synopsys DSO.ai** | Black-box parameter optimization | No transparency, no workflow help, expensive, no knowledge capture |
| **Cadence Cerebrus** | ML-driven optimization | Vendor lock-in, no conversational interface, no skill system |
| **ChatGPT/Claude raw** | General LLM | Hallucinates Tcl commands, no EDA tool integration, no team knowledge |
| **GitHub Copilot** | Code completion | No EDA tool awareness, no report comprehension, no skill capture |
| **HiPilot** | Copilot with skills + docs + tool control | Human-in-the-loop, vendor-agnostic, extensible, knowledge-first |

### HiPilot Differentiators

1. **Skills as primary value:** Knowledge capture and sharing, not just automation
2. **Transparency:** Always shows generated Tcl with reasoning and sources (not just badges)
3. **Pure terminal UI:** Beautiful CLI experience like Claude Code/Cursor, no browser needed
4. **Auto-skill generation:** Create skills from emails/docs via `/skill-gen`
5. **Intent-driven:** Natural language → validated Tcl workflow, not raw code completion
6. **Vendor-agnostic:** Works with both Synopsys and Cadence tools
7. **Engineer-in-the-loop:** AI suggests, human decides — nothing runs without approval
8. **AI reads raw reports:** Let AI comprehend text output instead of building complex parsers

## 5. Phase 1 Requirements (MVP)

### 5.1 Functional Requirements

#### FR-1: Conversational Tcl Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | User describes intent in natural language, HiPilot generates Tcl | P0 |
| FR-1.2 | Generated Tcl uses validated templates when a matching skill exists | P0 |
| FR-1.3 | Generated Tcl uses documentation when no skill matches | P0 |
| FR-1.4 | Every Tcl output shows trust badge: `[✓ Template]`, `[📖 Doc-based]`, or `[⚠ Unverified]` | P0 |
| FR-1.5 | Doc-based generation includes source attribution and reasoning | P0 |
| FR-1.6 | User can review Tcl before execution | P0 |
| FR-1.7 | Multi-turn conversation maintains context (design state, previous results) | P0 |

#### FR-2: EDA Terminal Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | `[▶ Run]` action sends generated Tcl to the EDA terminal pane | P0 |
| FR-2.2 | `[✎ Edit]` opens Tcl in $EDITOR for manual tweaks | P0 |
| FR-2.3 | `[💾 Save]` saves Tcl to project scripts directory | P1 |
| FR-2.4 | `Ctrl+Enter` keyboard shortcut for Run action | P1 |
| FR-2.5 | Scripts archived to `.hipilot/history/` with timestamps | P1 |

#### FR-3: Report Comprehension

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | AI reads raw timing reports from PrimeTime and Tempus | P0 |
| FR-3.2 | AI reads raw DRC reports from ICC2 and Innovus | P0 |
| FR-3.3 | AI reads raw power/area reports | P1 |
| FR-3.4 | Minimal parsing for basic QoR extraction (WNS, TNS, violation counts) | P0 |
| FR-3.5 | AI comprehends full report text for analysis and suggestions | P0 |
| FR-3.6 | Highlight critical issues and suggest next steps | P0 |

**Note:** AI comprehends raw text output. We do NOT build complex parsers - let the AI read and understand.

#### FR-4: Quick Commands

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | `/timing [group]` - run and summarize timing report | P0 |
| FR-4.2 | `/drc` - run and summarize DRC check | P0 |
| FR-4.3 | `/compare last` - compare current QoR with last checkpoint | P1 |
| FR-4.4 | `/history` - show Tcl commands sent in this session | P1 |
| FR-4.5 | `/save checkpoint <name>` - save QoR checkpoint | P1 |

#### FR-5: Skill System

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Skills defined as markdown files with YAML frontmatter | P0 |
| FR-5.2 | Three-level resolution: project > user > built-in | P0 |
| FR-5.3 | Skills define parameters, validation rules, workflow steps | P0 |
| FR-5.4 | Skills include few-shot examples for LLM parameter extraction | P0 |
| FR-5.5 | Ship with 5-10 built-in skills for common PD tasks | P0 |
| FR-5.6 | Use Claude Code's native skill format (no custom format) | P0 |
| FR-5.7 | Skills are flexible workflows, not rigid scripts | P0 |
| FR-5.8 | Skills can be auto-generated from emails/docs (Phase 2) | P1 |

#### FR-6: Knowledge System

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Index EDA manuals (PDF, HTML, text) into searchable store | P0 |
| FR-6.2 | Keyword search (FTS5) over command references | P0 |
| FR-6.3 | Exact command lookup by tool + command name | P0 |
| FR-6.4 | Support team/project knowledge directories | P0 |
| FR-6.5 | Semantic/embedding search (optional, future enhancement) | P2 |

#### FR-7: Skill Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | `/skill-gen` command creates skills from emails/docs/posts | P1 |
| FR-7.2 | Extracts workflow, parameters, and examples from source text | P1 |
| FR-7.3 | Generates skill markdown with YAML frontmatter | P1 |
| FR-7.4 | User reviews and edits before saving | P1 |
| FR-7.5 | Supports bulk import from team documentation | P2 |

#### FR-8: Setup and Onboarding

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-8.1 | `hipilot setup` wizard for first-time configuration | P0 |
| FR-8.2 | Auto-detect EDA tool installations on PATH | P0 |
| FR-8.3 | Auto-detect project `.hipilot/` config when in project directory | P0 |
| FR-8.4 | Quick-start help shown after setup (example commands) | P1 |

#### FR-9: Pure Terminal UI

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-9.1 | Beautiful CLI interface inspired by Claude Code/Cursor | P0 |
| FR-9.2 | Mode 2 layout: 50/50 split (chat + EDA terminal), not adaptive | P0 |
| FR-9.3 | Rich terminal rendering (colors, formatting, tables) | P0 |
| FR-9.4 | No web UI or browser dependency | P0 |
| FR-9.5 | Works over SSH on remote servers | P0 |

#### FR-10: Screen Recording

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10.1 | Each feature must have demo video recorded on EDA server | P0 |
| FR-10.2 | Screen recording infrastructure (Xvfb + ffmpeg) set up | P0 |
| FR-10.3 | Videos show real workflow on CentOS 7 environment | P0 |
| FR-10.4 | Videos transferable for review and documentation | P1 |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Tcl generation latency | < 5 seconds for template-based, < 15 seconds for doc-based |
| NFR-2 | Report comprehension time | < 10 seconds for AI to read and summarize (no complex parsing) |
| NFR-3 | Doc indexing time | < 5 minutes for initial index of ~1000 manual pages |
| NFR-4 | Memory usage (MCP servers) | < 500MB total for all three servers |
| NFR-5 | Works on CentOS 7+ (glibc 2.17) | Standard semiconductor server environments |
| NFR-6 | Works over SSH with tmux | No X11/GUI dependency |
| NFR-7 | Offline-capable for Tcl template rendering | Only LLM calls require network |
| NFR-8 | Node.js v16.x compatible | Must work with older Node.js (glibc 2.17 constraint) |

### 5.3 Out of Scope (Phase 1)

- Proactive terminal monitoring (Phase 2)
- Multi-iteration loop tracking with automatic QoR comparison (Phase 2)
- Skill catalog browser UI (Phase 2)
- AI-learned skills from observation (Phase 4 - use `/skill-gen` instead)
- Web-based UI or desktop application (never - pure terminal only)
- Direct integration with design databases (Milkyway, OA)
- Schematic or layout visualization
- Complex report parsers (AI reads raw text instead)
- Rigid workflow systems (skills are flexible)

## 6. Built-in Skills (Phase 1)

| Skill | Trigger Phrases | Vendors |
|-------|----------------|---------|
| `fix-setup-timing` | "fix setup", "close timing", "setup violations" | Synopsys, Cadence |
| `fix-hold-timing` | "fix hold", "hold violations" | Synopsys, Cadence |
| `run-timing-report` | "timing report", "check timing" | Synopsys, Cadence |
| `run-drc` | "check drc", "drc violations" | Synopsys, Cadence |
| `report-power` | "power report", "check power", "leakage" | Synopsys, Cadence |
| `report-area` | "area report", "utilization" | Synopsys, Cadence |
| `read-design` | "open design", "read design", "load design" | Synopsys, Cadence |
| `save-design` | "save design", "write checkpoint" | Synopsys, Cadence |
| `run-route-opt` | "route opt", "optimize routing" | Synopsys, Cadence |
| `compare-qor` | "compare results", "qor delta" | Synopsys, Cadence |

## 7. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Tcl accuracy** | >95% of template-based scripts run without errors | Track `source` success/failure in EDA terminal |
| **Time savings** | 30% reduction in time from "intent" to "running Tcl" | User surveys + session timing |
| **Adoption** | 80% of team uses HiPilot daily within 1 month | Usage logs |
| **Skill creation** | 5+ team-authored skills per project within 3 months | Count skills in `.hipilot/skills/` |
| **Skill usage** | 60% of Tcl generation uses skills (vs doc-based) | Track skill vs doc-based generation |
| **Knowledge capture** | 10+ skills auto-generated from team docs in month 1 | Count `/skill-gen` usage |
| **Trust** | Engineers approve >90% of generated Tcl on first presentation | Track approval vs edit vs reject rates |

## 8. Testing and Validation

### 8.1 EDA Server Environment

| Item | Value |
|------|-------|
| **Server** | 192.168.112.163 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v16.20.2 (last compatible with glibc 2.17) |
| **Design** | Ibex Core (RTL-to-GDS flow available) |

### 8.2 Real Design Testing

All features must be tested on the Ibex core design:
- Complete RTL-to-GDS flow
- Real timing reports
- Real DRC violations
- Real signoff checks

### 8.3 Screen Recording Requirements

Every feature must have a demo video:
- Recorded on EDA server (CentOS 7)
- Shows complete workflow
- 1-5 minutes per feature
- Stored in `/home/EDA/hipilot_test/recordings/`
- Transferable for review

## 9. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| LLM generates incorrect Tcl | Design corruption, wasted time | Medium | Three-tier model (templates > docs > refuse), show reasoning, mandatory review |
| EDA vendor manual licensing | Cannot distribute indexed manuals | High | Users supply their own manuals; HiPilot indexes locally |
| Claude API latency over SSH | Slow response times | Medium | Template rendering is local; only LLM calls need network |
| Engineers don't trust AI output | Low adoption | Medium | Transparency-first UX, show reasoning and sources, not just badges |
| Claude Code upstream divergence | Fork becomes hard to maintain | Low | Minimal fork delta (3 changes), MCP-first architecture |
| Skills become rigid | Users bypass skills for flexibility | Medium | Skills are flexible workflows, not rigid scripts; AI can adapt |
| AI cannot comprehend reports | Poor report understanding | Low | GPT-4/Claude excellent at reading text; minimal QoR parsing as fallback |
| Node.js version conflicts | Can't run on CentOS 7 | Low | Use Node.js v16.x compatible with glibc 2.17 |

## 10. Technical Realities

### 10.1 Platform Constraints

- **Target:** CentOS 7 (glibc 2.17)
- **Node.js:** v16.20.2 (last version compatible with glibc 2.17)
- **No browser:** Pure terminal UI only
- **SSH only:** No GUI dependencies

### 10.2 Design for Testing

- **Ibex Core:** Open-source RISC-V CPU
- **Complete flow:** RTL-to-GDS available
- **Real problems:** Real timing violations, real DRC issues
- **Validates:** Tcl generation, report comprehension, skills

### 10.3 Simplification Decisions

**What we DON'T do:**
- Complex report parsers (AI reads raw text)
- Custom skill format (use Claude Code's native skills)
- Rigid workflows (skills are flexible, AI adapts)
- Trust badges alone (show reasoning and sources)
- Web UI (pure terminal only)
- Latest Node.js (v16.x is fine)

**What we DO:**
- Beautiful terminal UI (Claude Code/Cursor style)
- Mode 2 layout (50/50 split, fixed)
- AI comprehends reports (minimal parsing)
- Auto-generate skills from docs
- Show reasoning and sources
- Three-tier intelligence model

## 11. Architecture Highlights

### Three-Tier Intelligence Model

```
Tier 1: LLM (Claude)
  Role: Intent recognition, parameter extraction, reading reports, generating Tcl
  Does NOT: Generate raw Tcl from memory

Tier 2: Skills (Team Expertise)
  Role: Workflow definitions, parameter schemas, proven patterns
  Format: Claude Code native skills (markdown + YAML)

Tier 3: Templates + Docs
  Role: Vendor-specific Tcl, command reference
  Format: Jinja2 templates + indexed manuals
```

### MCP Server Architecture

```
EDA MCP: Tcl generation, send-to-terminal, detect_tool (minimal parsing)
Tmux MCP: Pane control, send-keys, capture_pane, update_status
Knowledge MCP: Doc search, command reference, skill generation support
```

### Why This Works

- **No EDA-trained LLM needed:** Domain expertise in skills/docs
- **Transparent:** Always show reasoning and sources
- **Flexible:** Skills guide but don't constrain
- **Maintainable:** MCP-first, minimal fork
- **Knowledge-centric:** Skills capture team expertise
