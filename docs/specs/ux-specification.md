# HiPilot UX Specification

**Version:** Phase 1
**Date:** 2026-02-19

---

## 1. Design Philosophy

HiPilot should feel like **a senior colleague sitting next to you** — knowledgeable, transparent, non-intrusive, and respectful of the engineer's expertise.

### Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Never block the engineer** | All Tcl requires explicit approval. Suggestions are non-blocking. |
| **Show your work** | Always show Tcl, trust badge, source attribution, and reasoning. Not just badges. |
| **Progressive disclosure** | Chat for exploration, `/commands` for speed, skills for workflows. |
| **Context awareness** | HiPilot knows the tool, flow stage, last results, and design state. |
| **Trust is earned** | Trust badges on every script + reasoning and sources. Transparency builds confidence. |
| **Experts go fast** | Quick commands bypass conversation. Don't slow down seniors. |
| **Novices get guided** | Conversational mode explains steps, links to docs, suggests actions. |
| **Session continuity** | Remembers what was tried, what worked, and the current QoR baseline. |
| **Pure terminal excellence** | Beautiful CLI like Claude Code/Cursor, no browser needed. |
| **Skills as primary value** | Knowledge capture and sharing, not just automation. |

---

## 2. Workspace Layout

### 2.1 Mode 2 Layout (Default - Fixed 50/50)

```
┌──────────────────────┬──────────────────────┐
│ Pane 0: Chat (50%)   │ Pane 1: EDA (50%)    │
│                      │                      │
│ HiPilot AI Chat      │ EDA Tool Terminal    │
│ (Claude Code fork)   │ (icc2_shell, etc.)   │
│                      │                      │
├──────────────────────┴──────────────────────┤
│ Status Bar                                   │
└──────────────────────────────────────────────┘
```

**Key Characteristics:**
- **Fixed 50/50 split** - Not adaptive, predictable and simple
- **Beautiful terminal UI** - Modern, clean, inspired by Claude Code/Cursor
- **No browser** - Pure terminal experience
- **Works over SSH** - Full functionality on remote servers

### 2.2 Pane Roles

**Chat Pane (Left):**
- Primary interaction surface
- Shows conversation, generated Tcl, parsed reports, suggestions
- Contains action buttons: `[▶ Run]` `[✎ Edit]` `[💾 Save]`
- Supports quick commands (`/timing`, `/drc`, etc.)
- Rich terminal rendering (colors, formatting, tables)

**EDA Pane (Right):**
- Standard terminal running the EDA tool
- Engineer can interact with it directly (type Tcl manually)
- HiPilot sends scripts to this pane via `tmux send-keys`
- Engineer sees tool output in real time

**Status Bar (Bottom):**
- Always visible, updates every 5 seconds
- Shows: EDA tool | active skill/alert | job status | design context
- Color-coded for quick status recognition

### 2.3 Pure Terminal UI

**Beautiful CLI Experience:**
- Modern color scheme (dark background, clear accent colors)
- Rich formatting (tables, code blocks, status indicators)
- Smooth interactions (responsive, minimal latency)
- Clean layout (no clutter, focused on work)

**No Web UI:**
- 100% terminal-based
- Works over SSH without X11
- No browser dependency
- Lightweight and fast

---

## 3. Interaction Patterns

### 3.1 Conversational Mode (Primary)

The default interaction. User describes intent, HiPilot responds with analysis and generated Tcl.

**Conversation flow:**

```
User: describes problem or intent
  ↓
HiPilot: gathers context (reads reports, checks design state)
  ↓
HiPilot: explains findings and proposes solution
  ↓
HiPilot: shows generated Tcl with trust badge AND reasoning
  ↓
User: reviews, approves / edits / rejects
  ↓
HiPilot: executes (if approved) and reports results
```

**Example interaction:**

```
you: my design has 47 setup violations on the gpu_core group,
     help me fix the worst 10

hipilot: Let me analyze the current timing state.

  📖 Reading timing report...

  Confirmed: 47 setup violations on gpu_core
  • WNS: -0.312ns (gpu_alu_reg[15]/D)
  • TNS: -4.87ns
  • 32 of 47 paths share clock buffer gpu/clk_buf_2 (undersized)

  I recommend a two-step approach:
  1. Upsize gpu/clk_buf_2 from CLKBUF_X2 to CLKBUF_X8 (addresses 32 paths)
  2. Insert buffers on the remaining 15 data paths

  Starting with step 1:

  ┌─ Tcl [✓ Template] ──────────────────────────────┐
  │ # Fix setup timing: upsize clock buffer           │
  │ size_cell [get_cells gpu/clk_buf_2] \             │
  │   -lib_cell saed14_CLKBUF_X8                      │
  │                                                    │
  │ # Verify improvement                               │
  │ report_timing -group gpu_core -max_paths 10        │
  └───────────────────────────────────────────────────┘

  Source: icc2_fix_setup_timing.tcl.j2
  Reasoning: Detected 47 violations, focusing on worst 10 paths.
             32 paths share undersized clock buffer - sizing first
             is most efficient. Will insert buffers if needed.

  [▶ Run]  [✎ Edit]  [💾 Save]
```

### 3.2 Quick Commands

Slash commands for experienced users who know what they want.

| Command | Action |
|---------|--------|
| `/timing [group]` | Run timing report, parse and summarize |
| `/timing all` | Timing summary for all path groups |
| `/drc` | Run DRC check, parse and summarize |
| `/power` | Run power report, parse and summarize |
| `/area` | Run area report, parse and summarize |
| `/compare last` | Compare current QoR with last saved checkpoint |
| `/save checkpoint <name>` | Save current QoR metrics as named checkpoint |
| `/history` | Show all Tcl commands sent in this session |
| `/skills` | List available skills |
| `/skills describe <name>` | Show skill details and usage |
| `/help` | Show available commands and tips |

**Quick command example:**

```
you: /timing pcie_rx

  pcie_rx timing summary:
  ┌──────────────┬────────┐
  │ Metric       │ Value  │
  ├──────────────┼────────┤
  │ WNS          │ -0.05  │
  │ TNS          │ -0.32  │
  │ Violations   │ 7      │
  │ Worst path   │ reg_d3 │
  └──────────────┴────────┘
```

### 3.3 Report Analysis

User points to a report file, HiPilot reads and summarizes it.

```
you: analyze reports/post_route_timing.rpt

hipilot: 📖 Reading post_route_timing.rpt (4,832 lines)...
  AI comprehending report...

  ┌─────────────────┬──────────┬──────────┬─────────────┐
  │ Path Group      │ WNS (ns) │ TNS (ns) │ Violations  │
  ├─────────────────┼──────────┼──────────┼─────────────┤
  │ clk_main        │  0.023   │  0.000   │  0  ✓       │
  │ clk_pcie        │ -0.148   │ -1.820   │ 23  ✗       │
  │ clk_ddr         │ -0.031   │ -0.044   │  2  ✗       │
  │ func_paths      │  0.156   │  0.000   │  0  ✓       │
  └─────────────────┴──────────┴──────────┴─────────────┘

  Key findings:
  1. clk_pcie is the critical bottleneck (23 violations)
  2. clk_ddr has 2 marginal violations (likely one buffer fix)
  3. clk_main and func_paths are clean

  AI Analysis: The clk_pcie violations are concentrated in the
  receive path. Typical fix is buffer insertion. The clk_ddr
  violations are marginal and may resolve with cell sizing.

  Recommended priority: Fix pcie first, then ddr.
  Want me to start on pcie_rx fixes?
```

---

## 4. Tcl Output Formatting

### 4.1 Code Block Format

Every generated Tcl appears in a clearly marked block:

```
┌─ Tcl [{trust_badge}] ──────────────────────────────┐
│ # Comment explaining intent                          │
│ set paths [get_timing_paths ...]                     │
│ ...                                                  │
└─────────────────────────────────────────────────────┘
Source: {attribution if doc-based}
Reasoning: {explanation of approach}

[▶ Run]  [✎ Edit]  [💾 Save]
```

### 4.2 Trust Badges

| Badge | Meaning | Visual |
|-------|---------|--------|
| `[✓ Template]` | Generated from validated Tcl template | Green checkmark |
| `[📖 Doc-based]` | Generated using EDA manual reference | Book icon |
| `[⚠ Unverified]` | No template or doc match found | Warning icon |

### 4.3 Source Attribution

For doc-based generation, always show where the information came from:

```
Source: ICC2 Command Reference p.1247, "create_keepout_margin"
Source: Team Best Practices, sram_integration.md
Source: Innovus Text Command Reference, "setPlaceMode"
```

### 4.4 Reasoning Display

Always explain the approach, not just show badges:

```
Reasoning: Based on the timing report, you have 47 violations on
           gpu_core. I detected that 32 of these paths share an
           undersized clock buffer. My approach is to size this
           buffer first (most efficient), then insert buffers on
           remaining paths if needed.
```

### 4.5 Actions

| Action | Trigger | Behavior |
|--------|---------|----------|
| `[▶ Run]` | Click or `Ctrl+Enter` | Send script to EDA terminal |
| `[✎ Edit]` | Click | Open script in `$EDITOR` for manual edits |
| `[💾 Save]` | Click | Save to `{project}/scripts/` directory |

---

## 5. Status Bar Specification

### 5.1 Layout

```
│ {tool_section} │ {skill_section} │ {job_section} │ {context_section} │
```

### 5.2 Sections

**Tool Section (Left):**
```
⚙ ICC2 2024.09        (tool detected and running)
⚙ Innovus 23.1        (Cadence tool)
⚙ —                   (no tool detected)
```

**Skill/Alert Section:**
```
📋 fix-setup-timing    (skill active)
📋 idle                (no skill active)
⚠ 12 DRC violations   (alert overrides skill display)
```

**Job Section:**
```
▶ running 2m13s        (interactive execution)
▶ LSF#48271 45m        (batch job running)
▶ complete             (job finished)
▶ idle                 (no active job)
✗ failed               (job failed)
```

**Context Section (Right):**
```
ibex @ ss_0.72v_125c    (design + corner)
ibex                     (design only, no corner info)
—                            (no project config)
```

### 5.3 Color Scheme

```
Background:   #1a1a2e (dark blue-gray)
Tool name:    #00d4ff (cyan)
Skill name:   #ffd700 (gold)
Job running:  #00ff88 (green)
Job failed:   #ff4444 (red)
Alert:        #ffa500 (orange)
Design info:  #e0e0e0 (light gray)
Separator:    #666666 (dim gray)
```

---

## 6. Onboarding Experience

### 6.1 First-Time Setup

```
$ hipilot

  Welcome to HiPilot — your physical design copilot.

  Let's set up your environment.

  1. EDA tools:
     Detected: /tools/synopsys/icc2/2022.03/bin/icc2_shell ✓
     Detected: /tools/synopsys/pt/2022.03/bin/pt_shell ✓
     [Any additional tools? Press Enter to skip]

  2. Documentation:
     Path to EDA manuals: /tools/synopsys/docs/
     Indexing 847 manual pages... ████████████████ done.

  3. Project:
     Current directory: /home/EDA/hipilot_test/ibex_work_upload
     Found .hipilot/ config from your team ✓
     Loading 7 team skills...

  4. Job scheduler:
     [L]SF / [S]GE / S[l]urm / [N]one: L
     Default queue [normal]:
     Default memory [32G]:

  Setup complete! Configuration saved to ~/.hipilot/config.yaml

  Starting HiPilot...
```

### 6.2 Post-Setup Welcome

```
  ┌──────────────────────┬──────────────────────┐
  │ HiPilot Chat         │ EDA Terminal          │
  │                      │                       │
  │ Welcome! Try:        │ Start your EDA tool:  │
  │                      │ $ icc2_shell          │
  │ • "show me timing"   │ $ innovus             │
  │ • "fix setup on X"   │                       │
  │ • /drc               │                       │
  │ • /timing pcie_rx    │                       │
  │ • /skills            │                       │
  │ • /help              │                       │
  │                      │                       │
  └──────────────────────┴──────────────────────┘
```

---

## 7. Error and Edge Case UX

### 7.1 No EDA Tool Running

```
you: fix setup on pcie_rx

hipilot: I don't detect an EDA tool running in the terminal pane.
  Please start your tool first:

  For Synopsys:  icc2_shell -gui (or without -gui)
  For Cadence:   innovus

  I can still generate Tcl scripts for you to review and save,
  but I can't send them to the terminal until a tool is running.
```

### 7.2 No Matching Skill or Documentation

```
you: run a custom obscure flow that nobody has documented

hipilot: I don't have a skill or documentation for this specific task.

  [⚠ Unverified] I can try to help, but my output won't be backed
  by validated templates or tool documentation. Please review any
  generated Tcl very carefully.

  Reasoning: Without documented workflows or templates, I'll need to
             generate Tcl based on general EDA knowledge. This may
             not match your specific tool version or flow.

  Alternatively:
  • Point me to relevant documentation: "use docs at /path/to/..."
  • Create a skill for this workflow: see /help skills
```

### 7.3 Tcl Execution Error

```
(after sending Tcl to EDA terminal, tool reports error)

hipilot: The script encountered an error in the EDA tool:

  Error: "get_timing_paths: -group 'pcie_rx' not found"

  Reasoning: This means the path group name doesn't exist in the
             current design. Let me check what's available...

  📖 Querying design info...

  Available path groups: clk_pcie, clk_ddr, clk_main, func_paths

  Did you mean "clk_pcie"? Want me to regenerate with
  the corrected group name?
```

### 7.4 Long-Running Operation

```
(user starts a long batch job)

hipilot: Job submitted: LSF#48271 (route_opt)
  Queue: normal | Memory: 32G | CPUs: 8
  Log: /home/EDA/hipilot_test/ibex_work_upload/logs/route_opt_48271.log

  I'll update the status bar as it progresses.
  You can continue asking questions while the job runs.
  Use "/job status" to check, or "/job cancel" to stop.

  ┌─────────────────────────────────────────────────┐
  │ ⚙ ICC2 | 📋 route-opt | ▶ LSF#48271 running    │
  └─────────────────────────────────────────────────┘
```

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send last generated Tcl to EDA terminal |
| `Ctrl+E` | Switch focus to EDA pane |
| `Ctrl+H` | Switch focus to Chat pane |
| `Ctrl+S` | Save last generated Tcl to scripts directory |

These are implemented as tmux key bindings in the HiPilot session.

---

## 9. Screen Recording Considerations

### 9.1 Recording-Ready UI

The UI is designed to look good in screen recordings:
- High contrast colors
- Clear text rendering
- Smooth animations (minimal, fast)
- Readable fonts at 1920x1080 resolution

### 9.2 Demo Workflow

When recording feature demos:
1. Start with clean terminal
2. Launch HiPilot
3. Demonstrate feature clearly
4. Show key interactions
5. Explain what's happening
6. Keep demo focused (1-5 minutes)

### 9.3 Recording Checklist

**Before:**
- [ ] Clean terminal
- [ ] Know what to demonstrate
- [ ] Have test data ready
- [ ] Start recording

**During:**
- [ ] Explain what you're doing
- [ ] Show key features
- [ ] Demonstrate workflows
- [ ] Show edge cases
- [ ] Keep focused (1-5 minutes)

**After:**
- [ ] Stop recording
- [ ] Verify file created
- [ ] Transfer for review
- [ ] Test playback

---

## 10. Accessibility

### 10.1 Color Blindness

- Use symbols (✓, ✗, ⚠) along with colors
- High contrast ratios
- Clear text labels

### 10.2 Font Sizing

- Default: Readable at 1920x1080
- Configurable: Font size in config
- Terminal scaling: Respects terminal font settings

### 10.3 Keyboard Navigation

- All actions accessible via keyboard
- Tab completion for commands
- Clear shortcut hints

---

## 11. Performance

### 11.1 Response Times

| Operation | Target |
|-----------|--------|
| Tcl generation | < 5 seconds (template), < 15 seconds (doc-based) |
| Report comprehension | < 10 seconds |
| Status update | < 1 second |
| Quick command | < 3 seconds |

### 11.2 Smooth Interactions

- Minimal lag in terminal
- Fast command processing
- Responsive UI updates
- Efficient rendering

---

## 12. Platform Compatibility

### 12.1 CentOS 7 (Primary Target)

- **tmux:** 1.8+
- **Node.js:** v16.20.2
- **Terminal:** Any standard terminal (xterm, gnome-terminal, etc.)
- **Resolution:** Optimized for 1920x1080

### 12.2 Remote Usage

- **SSH:** Full functionality over SSH
- **No X11:** Pure terminal, no GUI dependency
- **Low bandwidth:** Text-based, efficient

### 12.3 Local Development

- **macOS:** Full support
- **Linux:** Full support (any distribution)
- **Windows:** WSL or native terminal support
