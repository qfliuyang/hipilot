# HiPilot Project Roadmap

**Date:** 2026-02-19
**Status:** Updated

---

## Phase Overview

```
Phase 1: Core MVP
  ├─ Conversational Tcl generation
  ├─ EDA terminal integration (send-to-EDA)
  ├─ Report comprehension (AI reads raw text)
  ├─ Quick commands (/timing, /drc, etc.)
  ├─ Skill system (user-extensible, Claude Code native)
  ├─ Knowledge system (doc indexing + retrieval)
  ├─ Pure terminal UI (Mode 2: 50/50 split)
  ├─ Setup wizard & onboarding
  ├─ Basic status bar
  ├─ Screen recording infrastructure
  └─ 10 built-in skills

Phase 2: Skill Generation & Enhanced Knowledge
  ├─ /skill-gen command (auto-generate skills from docs)
  ├─ Multi-iteration optimization loops
  ├─ Session QoR baseline & delta tracking
  ├─ Skill catalog browser (/skills UI)
  ├─ Before/after comparison tables
  ├─ QoR checkpoint management
  └─ Skill trigger auto-detection

Phase 3: Proactive Intelligence
  ├─ Terminal output monitoring
  ├─ Pattern detection (WARNING, ERROR, DRC)
  ├─ Non-blocking proactive suggestions
  ├─ Configurable verbosity & ignore patterns
  ├─ Job completion notifications
  └─ Timing regression alerts

Phase 4: Adaptive Learning
  ├─ AI-suggested skill creation from user sessions
  ├─ Team analytics (most-used skills, common issues)
  ├─ QoR trending across runs/tapeouts
  ├─ Semantic embedding search over docs
  ├─ Cross-project knowledge sharing
  └─ Skill marketplace (share across teams)
```

---

## Phase 1: Core MVP - Detailed Breakdown

### Milestone 1.1: Foundation

**Goal:** Basic tmux workspace + Claude Code fork running with MCP server stubs.

| Task | Description |
|------|-------------|
| Fork Claude Code | Minimal fork with HiPilot system prompt |
| Launcher script | `bin/hipilot` sets up tmux session (50/50 split) |
| MCP server scaffolding | Three server packages with stub tools |
| Config system | `~/.hipilot/config.yaml` + project `.hipilot/` |
| CI pipeline | Build, lint, test for all packages |
| Pure terminal UI | Beautiful CLI, Mode 2 layout (fixed 50/50) |

**Deliverable:** `hipilot` command launches tmux workspace with chat + EDA panes and status bar.

**Screen Recording:** Demo video showing launcher and basic workspace.

### Milestone 1.2: EDA MCP Server Core

**Goal:** Tcl generation from templates + basic QoR extraction.

| Task | Description |
|------|-------------|
| Template engine | Nunjucks-based Tcl template renderer |
| Vendor adapters | Synopsys + Cadence adapter implementations |
| 10 built-in templates | One template per built-in skill, per vendor |
| `eda.generate_tcl` | Full implementation with template resolution |
| `eda.detect_tool` | Detect running EDA tool via tmux pane |
| Basic QoR extraction | Minimal parsing for WNS, TNS, counts |
| AI report comprehension | Let AI read raw report text |

**Deliverable:** Can generate Tcl from templates and comprehend timing/DRC reports.

**Screen Recording:** Demo showing Tcl generation and report comprehension.

### Milestone 1.3: Tmux MCP Server

**Goal:** Full workspace management + send-to-EDA bridge.

| Task | Description |
|------|-------------|
| `tmux.send_keys` | Send keystrokes to named panes |
| `tmux.capture_pane` | Read pane content |
| `tmux.update_status` | Status bar rendering |
| `tmux.setup_layout` | Layout creation/reconfiguration (50/50 fixed) |
| Send-to-EDA bridge | `eda.send_to_terminal` → tmux integration |
| Script archiving | Save scripts to `.hipilot/history/` |
| Keyboard shortcuts | `Ctrl+Enter`, `Ctrl+E`, `Ctrl+H` |

**Deliverable:** Full chat-to-EDA pipeline works end-to-end.

**Screen Recording:** Demo showing send-to-EDA workflow.

### Milestone 1.4: Knowledge MCP Server

**Goal:** Document indexing + retrieval for doc-based generation.

| Task | Description |
|------|-------------|
| PDF parser | Extract text from EDA manual PDFs |
| HTML parser | Parse SolvNet/support HTML pages |
| Chunker | Smart chunking with code block preservation |
| SQLite FTS5 index | Full-text search over chunks |
| Command reference index | Structured command lookup table |
| `knowledge.search_docs` | Hybrid search implementation |
| `knowledge.get_command_ref` | Exact command lookup |
| `knowledge.get_methodology` | Methodology guide retrieval |
| `knowledge.get_experience` | Team experience search |
| CLI: `hipilot index` | Document indexing command |

**Deliverable:** Can index EDA manuals and retrieve relevant docs for Tcl generation.

**Screen Recording:** Demo showing doc indexing and retrieval.

### Milestone 1.5: Skills + Quick Commands

**Goal:** Skill system + built-in skills + quick commands.

| Task | Description |
|------|-------------|
| Skill loader | Load skills from project > user > built-in |
| Skill parser | Parse markdown + YAML frontmatter (Claude Code native) |
| Skill matcher | Match user intent to skill triggers |
| 10 built-in skills | fix-setup, fix-hold, timing, drc, power, area, read-design, save-design, route-opt, compare-qor |
| Quick command router | `/timing`, `/drc`, `/power`, `/area` etc. |
| `/history` command | Show session Tcl history |
| `/skills` command | List available skills |
| `/help` command | Show help text |

**Deliverable:** Full skill-based workflow + power user quick commands.

**Screen Recording:** Demo showing skill usage and quick commands.

### Milestone 1.6: Onboarding + Polish

**Goal:** First-time experience + edge case handling.

| Task | Description |
|------|-------------|
| `hipilot setup` wizard | Interactive first-time configuration |
| Tool auto-detection | Detect EDA tools on PATH |
| Welcome screen | Post-setup tips in chat pane |
| Error UX | Handle: no tool, no skill, execution errors |
| Power/area report comprehension | Complete report coverage |
| Job submission | LSF/SGE/Slurm/local job submitters |
| Documentation | User guide, skill authoring guide |
| Testing on Ibex | Validate all features on real design |

**Deliverable:** Production-ready Phase 1 release with screen recordings for all features.

**Screen Recording:** Complete end-to-end workflow demo on Ibex design.

---

## Phase 2: Skill Generation & Enhanced Knowledge

### Key Features

**Auto-Skill Generation:**
- `/skill-gen <source>` command creates skills from documentation
- Supports emails, wiki pages, forum posts, runbooks
- Extracts workflow, parameters, validation rules
- Generates skill markdown with YAML frontmatter
- User reviews and edits before saving
- Bulk import from team documentation

**Iterative Optimization Loops:**
- Session state tracks QoR baseline at session start
- Each skill execution records before/after metrics
- Automatic delta reporting after every Tcl execution
- Iteration counter and progress visualization

```
── Iteration 1 ─────────────────────────────
Strategy: cell sizing
Result: WNS -0.148 → -0.062 ✓ progress

── Iteration 2 ─────────────────────────────
Strategy: buffer insertion
Result: WNS -0.062 → +0.003 ✓ CLOSED
```

**Skill Catalog Browser:**
- `/skills` shows rich table with categories, triggers, trust levels
- `/skills describe <name>` shows full skill documentation
- `/skills search <query>` searches skill descriptions
- Skill usage statistics (most-used, success rate)

**QoR Checkpointing:**
- `/save checkpoint "after_cts"` saves metrics snapshot
- `/compare "before_route" "after_route"` shows delta table
- Checkpoints stored in `.hipilot/checkpoints/`

---

## Phase 3: Proactive Intelligence

### Key Features

**Terminal Monitoring:**
- Background polling of EDA pane output (configurable interval)
- Pattern matching for WARNING, ERROR, DRC counts, timing regression
- Non-blocking notifications appear in chat pane
- Does not interrupt user's current conversation

**Configurable Verbosity:**

```yaml
monitoring:
  enabled: true
  verbosity: normal     # quiet | normal | verbose
  poll_interval: 5      # seconds
  notify_on:
    - errors
    - drc_violations
    - timing_regression
    - job_complete
  ignore_patterns:
    - "^INFO: Reading"
    - "^INFO: Loading"
```

**Smart Alerts:**
- DRC violation count threshold (only alert if > N)
- Timing regression detection (WNS got worse since last check)
- Job completion with automatic QoR comparison
- Tool crash detection

---

## Phase 4: Adaptive Learning

### Key Features

**AI-Suggested Skills:**
- After a manual multi-step workflow, HiPilot offers: "Save this as a skill?"
- Generates skill markdown from observed commands
- Engineer refines parameters and templates

**Team Analytics:**
- Dashboard showing most-used skills, common issues, fix success rates
- Identify knowledge gaps (frequent doc-based generation → needs a skill)
- Track time savings per engineer

**QoR Trending:**
- Track QoR metrics across runs and tapeouts
- Identify regression patterns
- Compare against team/project baselines

**Skill Marketplace:**
- Share skills across teams via Git
- Curated "verified skill" library
- Skill versioning and compatibility tracking

---

## Technology Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Claude Code | Latest stable | Base CLI framework |
| Node.js | v16.20.2 | MCP servers runtime (CentOS 7 compatible) |
| TypeScript | 5+ | Implementation language |
| tmux | 1.8+ | Terminal multiplexer |
| SQLite | 3.35+ | Knowledge index (FTS5 support) |
| nunjucks | 3.x | Jinja2-compatible template engine |
| better-sqlite3 | 9.x | Node.js SQLite binding |
| pdf-parse | 1.x | PDF text extraction |
| cheerio | 1.x | HTML parsing |

**Note:** Node.js v16.20.2 is the last version compatible with glibc 2.17 (CentOS 7).

---

## Testing & Validation

### EDA Server Environment

| Item | Value |
|------|-------|
| **Server** | 192.168.112.163 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v16.20.2 |
| **Design** | Ibex Core (RISC-V CPU) |

### Real Design Testing

All features tested on Ibex core:
- Complete RTL-to-GDS flow
- Real timing reports
- Real DRC violations
- Real signoff checks

### Screen Recording Requirements

Every milestone must have demo video:
- Recorded on EDA server (CentOS 7)
- Shows complete workflow
- 1-5 minutes per feature
- Xvfb + ffmpeg infrastructure ready

---

## Risk Register

| Risk | Phase | Impact | Mitigation |
|------|-------|--------|-----------|
| Claude Code breaking changes | All | Fork divergence | Minimal fork delta, MCP-first design |
| EDA manual PDF parsing quality | 1 | Poor retrieval | Multiple parser strategies, manual correction |
| Tcl template coverage gaps | 1 | Users hit unvalidated paths | Knowledge fallback, clear trust badges |
| Remote server Node.js availability | 1 | Can't install | Provide static binary option, Docker fallback |
| Claude API latency over SSH | 1 | Slow responses | Template rendering is local, only LLM needs network |
| Low adoption by senior engineers | 1-2 | Poor ROI | Quick commands, don't slow down experts |
| EDA vendor licensing concerns | All | Can't distribute manuals | Local-only indexing, users supply own docs |
| Skills become rigid | 1-2 | Users bypass skills | Skills are flexible workflows, not rigid scripts |
| AI cannot comprehend reports | 1 | Poor understanding | GPT-4/Claude excellent at reading text; minimal QoR parsing as fallback |
| Screen recording overhead | All | Development slowdown | Lightweight Xvfb + ffmpeg, automate where possible |

---

## Success Metrics

### Phase 1 Success Criteria

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Tcl accuracy** | >95% of template-based scripts run without errors | Track `source` success/failure in EDA terminal |
| **Time savings** | 30% reduction in time from "intent" to "running Tcl" | User surveys + session timing |
| **Adoption** | 80% of team uses HiPilot daily within 1 month | Usage logs |
| **Skill creation** | 5+ team-authored skills per project within 3 months | Count skills in `.hipilot/skills/` |
| **Trust** | Engineers approve >90% of generated Tcl on first presentation | Track approval vs edit vs reject rates |
| **Screen recordings** | 100% of features have demo videos | Video library completeness |
| **CentOS 7 compatibility** | All features work on EDA server | Testing on 192.168.112.163 |

### Long-term Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| **Knowledge capture** | 50+ skills per team | 6 months |
| **Skill usage** | 60% of Tcl generation uses skills | 6 months |
| **Junior engineer ramp-up** | 50% reduction in onboarding time | 1 year |
| **Repeat problem solving** | 80% reduction in rediscovering solutions | 1 year |
| **Team productivity** | 30% overall productivity improvement | 1 year |

---

## Development Priorities

### What Matters Most

1. **Skills as primary value** - Knowledge capture and sharing
2. **Pure terminal UI** - Beautiful CLI, Mode 2 layout
3. **AI reads reports** - Comprehend raw text, minimal parsing
4. **Auto-generate skills** - /skill-gen from documentation
5. **Transparency** - Show reasoning, not just badges
6. **Test on real design** - Ibex core validation
7. **Screen recordings** - Every feature needs demo

### What We Don't Do

- Complex report parsers (AI reads raw text)
- Custom skill format (use Claude Code's native skills)
- Rigid workflows (skills are flexible, AI adapts)
- Trust badges alone (show reasoning and sources)
- Web UI (pure terminal only)
- Latest Node.js (v16.x is fine for CentOS 7)
- Adaptive layouts (Mode 2: 50/50 fixed)
