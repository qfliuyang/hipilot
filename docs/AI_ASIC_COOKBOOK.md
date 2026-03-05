# AI in ASIC: The HiPilot Cookbook for Chip Designers

> **From Silicon to Software: A Practical Guide for ASIC Engineers**
>
> *You design chips. Now let's teach AI to help you do it better.*

---

## Table of Contents

1. [The Big Picture: Why AI Needs Your ASIC Expertise](#chapter-1-the-big-picture)
2. [MCP Demystified: The Universal Translator](#chapter-2-mcp-demystified)
3. [Skills: Teaching AI Your Expertise](#chapter-3-skills)
4. [Your First Skill: Creating a Timing Closure Assistant](#chapter-4-your-first-skill)
5. [Templates: Tcl Generation Made Easy](#chapter-5-templates)
6. [Debugging Like a Pro](#chapter-6-debugging)
7. [Real-World Recipes](#chapter-7-recipes)

---

## Chapter 1: The Big Picture

### The Paradigm Shift

Remember when you first learned layout? The transition from schematic to physical design felt like learning a new language. **AI development is the same**—it's just another layer of abstraction.

**Traditional ASIC Flow:**
```
RTL → Synthesis → Placement → CTS → Routing → Signoff → GDS
```

**AI-Assisted ASIC Flow (HiPilot):**
```
Your Expertise → Skills → AI Assistant → Tcl → EDA Tools → GDS
                        ↑
                   You guide here
```

### Why Your ASIC Knowledge is Gold

AI doesn't understand:
- Why clock tree synthesis timing matters
- When to use useful skew vs. balanced trees
- How to read noise margins in crosstalk reports
- The difference between a DRV and a real violation

**You do.** And that's why HiPilot needs you.

### What You'll Build

By the end of this cookbook, you'll:
- ✅ Create skills that teach AI your timing closure tricks
- ✅ Debug AI-generated Tcl like you debug DRC violations
- ✅ Extend HiPilot for your specific methodology
- ✅ Feel confident contributing to AI-assisted chip design

---

## Chapter 2: MCP Demystified

### The Restaurant Analogy

Imagine MCP (Model Context Protocol) as a **universal restaurant ordering system**:

| Component | Restaurant Analogy | HiPilot Reality |
|-----------|-------------------|-----------------|
| **You** | The chef with recipes | The ASIC engineer with expertise |
| **Claude (AI)** | The waiter taking orders | The AI assistant interpreting requests |
| **MCP Server** | The kitchen translator | The bridge between AI and EDA tools |
| **EDA Tool** | The cooking equipment | Innovus, ICC2, PrimeTime |
| **Skill** | The recipe card | Your documented expertise |

### How MCP Actually Works

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU (ASIC Engineer)                                            │
│  "Run timing analysis on setup paths"                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ Natural Language
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE (AI Assistant)                                          │
│  Reads your intent → Looks up skills → Plans actions           │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ MCP Protocol (JSON-RPC)
┌─────────────────────────────────────────────────────────────────┐
│  MCP SERVER (Node.js Process)                                   │
│  Receives: { "tool": "eda.execute_and_verify",                  │
│            "tcl": "report_timing -max_paths 10..." }            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓ tmux send-keys
┌─────────────────────────────────────────────────────────────────┐
│  EDA TOOL (Innovus/ICC2)                                        │
│  Executes Tcl → Returns results to right pane                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Insight

**MCP is just a standardized way for AI to "talk" to tools.** Instead of learning each EDA tool's API, the AI uses MCP to send Tcl commands through tmux—exactly like you would type them manually.

### MCP in Action: A Real Example

Here's what happens when you type `/rtl2gds`:

```javascript
// 1. Claude reads your command
userInput = "/rtl2gds"

// 2. Claude loads the skill (a markdown file)
skillContent = readFile("skills/ibex-rtl2gds-flow.md")

// 3. Claude calls MCP to check if Innovus is running
mcpCall = {
  "tool": "eda.detect_tool",    // ← MCP tool name
  "params": {}                   // ← No params needed
}

// 4. MCP server executes via tmux
tmuxCommand = "tmux -L hipilot capture-pane -p -t hipilot:0.1"
result = "innovus 1>"  // ← Tool is running!

// 5. Claude calls MCP to run a stage
mcpCall = {
  "tool": "eda.execute_and_verify",
  "params": {
    "tcl": "timeDesign -postRoute...",  // ← Your Tcl!
    "description": "Post-route timing",
    "timeout": 120
  }
}

// 6. MCP sends to EDA pane and waits
executeAndWait("timeDesign -postRoute...")
result = { status: "success", qor: { wns: -0.059, tns: -0.921 } }
```

**The beauty:** You write Tcl. AI orchestrates it. MCP delivers it.

---

## Chapter 3: Skills

### What is a Skill?

A **skill** is your expertise written down so AI can follow it. Think of it as:
- A detailed runbook for a specific task
- A methodology document with exact commands
- Your brain dump about how to fix setup violations

### Skill Structure (Anatomy)

```markdown
---
name: fix-setup-timing           # ← Skill identifier
description: >                    # ← What it does
  Fix setup timing violations in placed or routed designs.
  This skill covers useful skew, sizing, and buffer insertion.
---

# Fix Setup Timing Violations

## When to Use This Skill

Use this skill when:
- Setup WNS is negative after placement or CTS
- You have reg2reg timing violations
- You want to close timing before routing

## Prerequisites

Before running this skill, ensure:
1. Design is placed (or routed)
2. MMMC views are active
3. You have a timing report showing violating paths

## The Methodology

### Step 1: Analyze the Problem

Run a detailed timing report:

```tcl
# Get the worst paths with full path details
report_timing -max_paths 20 -max_slack 0.0 -path_type full_clock \
  -outfile setup_violations.rpt
```

Look for:
- **High cell delay**: May need sizing up
- **Long wire delay**: May need buffering
- **Clock skew**: May need useful skew

### Step 2: Apply Fixes Based on Root Cause

#### Option A: Useful Skew (for clock skew issues)

```tcl
# Enable useful skew optimization
setOptMode -usefulSkew true
setOptMode -usefulSkewPreCTS false
setOptMode -usefulSkewPostCTS true

# Run optimization
optDesign -postCTS -setup
```

#### Option B: Cell Sizing (for high cell delay)

```tcl
# Size up violating cells
ecoChangeCell -upsize -cells [get_cells -of_pins [get_pins -filter \
  "slack < 0"]]

# Run incremental optimization
optDesign -postRoute -setup -incremental
```

### Step 3: Verify Results

```tcl
timeDesign -postRoute -prefix final -outDir timing_reports

# Check if WNS improved
puts "Final WNS: [get_metric timing.setup.WNS]"
```

## Common Pitfalls

⚠️ **Don't use useful skew if:**
- Hold timing is already tight (skew makes hold worse)
- You're before CTS (skew isn't meaningful yet)

⚠️ **Don't size up cells if:**
- It causes congestion (check utilization first)
- It creates new DRVs

## Success Criteria

✅ Setup WNS ≥ 0 (or within your signoff margin)
✅ No new hold violations introduced
✅ Congestion remains acceptable (< 85%)
```

### Breaking Down the Skill

| Section | Purpose | ASIC Analogy |
|---------|---------|--------------|
| **Frontmatter** | Metadata for AI to find the skill | Like a datasheet header |
| **When to Use** | Pre-conditions, decision criteria | Design review checklist |
| **Prerequisites** | What must be true before starting | PDK requirements |
| **The Methodology** | Step-by-step procedure | Runbook/Recipe |
| **Common Pitfalls** | Things that go wrong | DRC warnings |
| **Success Criteria** | How to know you're done | Signoff requirements |

### Writing Your First Skill Section

Let's write a simple skill for **buffer insertion on long nets**:

```markdown
## Methodology: Buffer Long Nets

### Identify Long Nets

Find nets with high wire delay:

```tcl
# Report net delays for all nets
report_net -delay -outfile net_delays.rpt

# Filter for nets with delay > 500ps
set long_nets [get_nets -filter "total_delay > 0.5"]
```

### Insert Buffers

For each long net, add buffers:

```tcl
# Split long nets with buffers
addBuffer -net $long_nets -cell BUFX2 -prefix LONG_NET_BUF_
```

### Verify No New DRVs

Check that buffering didn't create issues:

```tcl
# Check for max cap violations
report_drc -max_cap -outfile post_buffer_drc.rpt
```
```

**Notice:**
- Each Tcl block has a comment explaining what it does
- The "Why" is explained before the "What"
- There are verification steps

---

## Chapter 4: Your First Skill

### Exercise: Create a "Post-CTS Hold Fix" Skill

Let's build a complete skill together. You'll fix hold violations after clock tree synthesis.

#### Step 1: Create the File

Create `skills/post-cts-hold-fix.md`:

```markdown
---
name: post-cts-hold-fix
description: >
  Fix hold violations after clock tree synthesis.
  Uses useful skew and buffer insertion techniques.
---

# Post-CTS Hold Violation Fixing

## When to Use This Skill

Use after CTS when:
- `timeDesign -postCTS` shows negative hold slack
- You have hold violations in reg2reg paths
- Setup timing is already clean (or has margin)

## Prerequisites

1. CTS is complete (clock tree built)
2. Setup WNS ≥ 0 (or ≥ -50ps if you have margin)
3. MMMC views are active

## Understanding the Problem

**Why hold violations happen after CTS:**
- Clock tree insertion adds delay to the clock path
- Data path delay hasn't changed
- If clock delay > data delay → hold violation!

**Visual explanation:**
```
Before CTS (no hold issue):
  Clock:  [Source]──────[Flop CK]          (short path)
  Data:   [Flop Q]──────────────[Flop D]   (longer path)

After CTS (hold violation!):
  Clock:  [Source]══════╪══════[Flop CK]    (clock tree adds delay!)
  Data:   [Flop Q]──────┼──────────[Flop D]  (unchanged)
                        ↑
                   Data arrives before clock!
```

## The Fix Strategy

### Method 1: Useful Skew (Preferred)

Push the capturing clock later (delay the clock to the destination flop):

```tcl
# Enable useful skew for hold fixing
setOptMode -usefulSkew true
setOptMode -usefulSkewHold true

# Run hold optimization
optDesign -postCTS -hold
```

**Why this works:**
- Delays the capture clock
- Gives data more time to arrive
- Doesn't add buffers to data path (no area/power cost)

### Method 2: Buffer Insertion (Fallback)

If useful skew can't fix all violations:

```tcl
# Get violating paths
set hold_violators [get_pins -filter "hold_slack < 0"]

# Add delay buffers on data path
addDelay -pins $hold_violators -cell DELAY_BUF_X1
```

**Trade-offs:**
- ✅ Fixes violations reliably
- ❌ Uses area and power
- ❌ May create setup issues if overdone

## The Complete Flow

```tcl
# Step 1: Check current timing
puts "Before hold fix:"
timeDesign -postCTS
set before_wns [get_metric timing.setup.WNS]
set before_wns_hold [get_metric timing.hold.WNS]
puts "  Setup WNS: ${before_wns}ns"
puts "  Hold WNS: ${before_wns_hold}ns"

# Step 2: Run useful skew optimization
setOptMode -usefulSkew true
setOptMode -usefulSkewHold true
optDesign -postCTS -hold

# Step 3: Check results
puts "After useful skew:"
timeDesign -postCTS
set after_wns [get_metric timing.setup.WNS]
set after_wns_hold [get_metric timing.hold.WNS]
puts "  Setup WNS: ${after_wns}ns (was: ${before_wns}ns)"
puts "  Hold WNS: ${after_wns_hold}ns (was: ${before_wns_hold}ns)"

# Step 4: If still violating, use buffer insertion
if {$after_wns_hold < 0} {
  puts "Hold still violating. Adding delay buffers..."

  # Select violating pins (excluding clock pins)
  set violating_data_pins [get_pins -filter "hold_slack < 0 && direction == in"]

  # Add buffers
  foreach pin $violating_data_pins {
    addDelay -pin $pin -cell BUF_X1
  }

  # Incremental optimization
  optDesign -postCTS -hold -incremental
}

# Step 5: Final verification
timeDesign -postCTS -prefix final_hold_fixed
puts "Final setup WNS: [get_metric timing.setup.WNS]"
puts "Final hold WNS: [get_metric timing.hold.WNS]"
```

## Verification Checklist

- [ ] Hold WNS ≥ 0 (or within signoff margin)
- [ ] Setup WNS didn't degrade significantly (< 50ps)
- [ ] No new DRVs introduced
- [ ] Clock tree skew is acceptable (< 200ps)

## Common Issues

**Issue:** Useful skew made setup worse!
**Solution:** You need setup margin to use useful skew. If setup is already tight, use buffer insertion instead.

**Issue:** Still have hold violations after both methods.
**Solution:** Check if violations are on async pins (set/reset). These need special handling.

## Success Metrics

✅ Hold violations = 0
✅ Setup margin maintained
✅ Clean DRC
```

#### Step 2: Test Your Skill

```bash
# Deploy to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# Test with HiTestBot
bin/hitestbot-eda "fix hold violations after CTS"
```

#### Step 3: Iterate

Look at the evidence:
- Did AI follow your methodology?
- Did the Tcl work correctly?
- What would you clarify?

---

## Chapter 5: Templates

### Why Templates Matter

You don't want to write raw Tcl every time. **Templates** are pre-written Tcl with variables:

```tcl
# Template: report_timing.tcl
report_timing -max_paths {{ max_paths | default(10) }} \
  -path_type {{ path_type | default('summary') }} \
  -outfile {{ output_file }}
```

When AI calls `generate_tcl`, it fills in the variables:

```javascript
// AI request
{
  "intent": "report timing",
  "max_paths": 50,
  "path_type": "full_clock",
  "output_file": "timing.rpt"
}

// Generated Tcl
report_timing -max_paths 50 \
  -path_type full_clock \
  -outfile timing.rpt
```

### Creating a Template

Let's create a template for **power analysis**:

Create `templates/cadence/report_power.tcl`:

```tcl
{# report_power.tcl - Power Analysis Template #}
{# Usage: Generate power reports for the current design #}

{# Report summary power #}
report_power -outfile {{ summary_file | default('power_summary.rpt') }}

{# Report hierarchical power (if requested) #}
{% if hierarchical %}
report_power -hier -outfile {{ hier_file | default('power_hier.rpt') }}
{% endif %}

{# Report power by cell type (if requested) #}
{% if by_cell_type %}
report_power -cell_type -outfile {{ cell_type_file | default('power_by_cell.rpt') }}
{% endif %}

{# Optional: Clock gating efficiency report #}
{% if clock_gating_report %}
report_clock_gating -outfile {{ cg_file | default('clock_gating.rpt') }}
{% endif %}
```

### Template Syntax Explained

| Syntax | Meaning | Example |
|--------|---------|---------|
| `{{ var }}` | Variable substitution | `{{ max_paths }}` → `20` |
| `{{ var \| default(10) }}` | Default value if not provided | `{{ max_paths \| default(10) }}` → `10` |
| `{% if condition %}` | Conditional block | `{% if hierarchical %}` |
| `{# comment #}` | Template comment (not in output) | `{# This is ignored #}` |

### Using Templates in Skills

Reference your template in a skill:

```markdown
## Generate Power Report

```tcl
// Template will be rendered with these parameters
generate_tcl({
  template: "cadence/report_power",
  hierarchical: true,
  clock_gating_report: true
})
```
```

---

## Chapter 6: Debugging Like a Pro

### The Debugging Mindset

You already debug DRC violations, timing issues, and LVS mismatches. **Debugging AI is similar:**

1. **Observe** → What did the AI actually do?
2. **Compare** → What did you expect vs. what happened?
3. **Isolate** → Where did it go wrong?
4. **Fix** → Update skills, templates, or instructions

### Debugging Tools

#### 1. Observation Points (The AI's "Waveform")

HiTestBot captures observations like a waveform viewer captures signals:

```
test-evidence/20260304173910/
├── obs_progress_000_claude.log    # What AI was thinking at time 0
├── obs_progress_600_claude.log    # What AI was thinking at 10 minutes
├── obs_progress_1200_claude.log   # What AI was thinking at 20 minutes
└── obs_after_flow_claude.log      # Final result
```

**Read them like a VCD file:**

```bash
# See what AI was doing at minute 10
cat obs_progress_600_claude.log | grep -E "execute_and_verify|error|Error"
```

#### 2. The Timeline (Chronological Debug)

```bash
# View all events in order
cat test-evidence/latest/timeline.jsonl | jq -s '.[] | select(.type == "mcp_call")'
```

#### 3. MCP Call Log

When `HIPILOT_TEST_LOG` is set:

```bash
# See every MCP tool call
cat /tmp/hipilot_test_mcp.jsonl | jq '{tool: .tool, status: .status}'
```

### Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| AI uses Bash instead of MCP | Skill doesn't emphasize MCP | Add "Use MCP tools, not Bash" to skill |
| AI skips verification steps | Success criteria unclear | Add explicit "Verification" section |
| AI gives up on errors | No error recovery guidance | Add "Error Recovery" section to skill |
| Tcl commands fail | Wrong tool version syntax | Check Innovus vs. ICC2 syntax in templates |
| AI loops infinitely | No completion criteria | Add "Stop when..." conditions |

### Real Debug Session

**Problem:** AI kept trying to use `loadDef` which fails in Innovus.

**Evidence:**
```
obs_progress_300_claude.log:
  ❌ loadDef result/pr/data/init.def
  Error: **ERROR: (TECH-280004): Cannot load DEF after design is initialized
```

**Root Cause:** Skill said "Load the design" but didn't specify to use checkpoints.

**Fix:** Update skill to be explicit:

```markdown
## Load Design

**DO NOT use `loadDef` or `defIn`.** These cause "lib cell exists" errors.

Instead, use the checkpoint file:

```tcl
# CORRECT: Load from checkpoint
source result/pr/data/init_design.enc

# WRONG: Don't do this
# loadDef result/pr/data/init.def  ← Causes errors!
```
```

---

## Chapter 7: Real-World Recipes

### Recipe 1: Add Clock Gating Checks

**Goal:** Create a skill that checks clock gating efficiency.

```markdown
---
name: check-clock-gating
description: Analyze and report clock gating efficiency
---

# Clock Gating Analysis

## Generate Report

```tcl
# Report clock gating efficiency
report_clock_gating -outfile clock_gating.rpt

# Get statistics
set cg_efficiency [get_metric clock_gating.efficiency]
set cg_coverage [get_metric clock_gating.coverage]

puts "Clock Gating Efficiency: ${cg_efficiency}%"
puts "Clock Gating Coverage: ${cg_coverage}%"
```

## Interpretation

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| Efficiency | > 90% | 80-90% | < 80% |
| Coverage | > 95% | 85-95% | < 85% |

## Improvements

If efficiency is low:
```tcl
# Identify inefficient gating cells
report_clock_gating -inefficient -outfile inefficient_gates.rpt

# Consider re-synthesis with better constraints
```
```

### Recipe 2: Custom DRC Check

**Goal:** Check specific DRC rules your foundry cares about.

```markdown
---
name: foundry-drc-check
description: Run design-rule checks for SkyWater 130nm
---

# Foundry-Specific DRC

## Run Checks

```tcl
# Standard DRC
verify_drc -outfile drc.rpt

# Check specific rules for SkyWater 130nm
verify_drc -check "M1.S.1 M2.S.1 VIA1.EN.1" -outfile critical_drc.rpt

# Get count of violations
set drc_count [get_metric drc.total_count]
puts "Total DRC violations: $drc_count"
```

## Fix Common Issues

### M1 Spacing Violations

```tcl
# If M1 spacing violations exist
ecoRoute -fix_drc -layer M1
```

### Via Enclosure

```tcl
# Fix via enclosure issues
verify_drc -check "VIA*" -outfile via_drc.rpt
ecoRoute -fix_drc -via
```
```

### Recipe 3: Multi-Corner Analysis

**Goal:** Create a skill for multi-corner multi-mode (MCMM) analysis.

```markdown
---
name: mcmm-analysis
description: Run timing analysis across all corners and modes
---

# MCMM Analysis

## Setup

```tcl
# Ensure all views are active
set_analysis_view -setup {ss_m40c ss_125c ff_m40c} -hold {ff_m40c ss_125c}
```

## Run Analysis

```tcl
# Analyze each corner
foreach view [get_analysis_views] {
  set_active_view $view
  timeDesign -postRoute -prefix "timing_${view}"

  set wns [get_metric timing.setup.WNS]
  set tns [get_metric timing.setup.TNS]

  puts "Corner $view: WNS=$wns TNS=$tns"
}
```

## Generate Summary Table

```tcl
# Create summary report
set fp [open mcmm_summary.rpt w]
puts $fp "Corner\tSetup WNS\tSetup TNS\tHold WNS"

foreach view [get_analysis_views] {
  set wns [get_metric -view $view timing.setup.WNS]
  set tns [get_metric -view $view timing.setup.TNS]
  set hold [get_metric -view $view timing.hold.WNS]
  puts $fp "$view\t$wns\t$tns\t$hold"
}

close $fp
```
```

---

## Appendix: Quick Reference

### MCP Tools Available

| Tool | What It Does | When to Use |
|------|-------------|-------------|
| `eda.detect_tool` | Check if Innovus/ICC2 is running | Before starting any work |
| `eda.start_tool` | Launch EDA tool in right pane | When no tool is running |
| `eda.execute_and_verify` | Run Tcl and check result | For every stage/command |
| `eda.diagnose_error` | Get AI analysis of errors | When errors occur |
| `eda.generate_tcl` | Use template to make Tcl | For common reports |
| `knowledge.get_skill` | Load a skill markdown file | At start of flow |
| `qor.snapshot` | Save timing metrics | After each major stage |

### Skill Checklist

Before considering a skill "done":

- [ ] **Prerequisites** listed (what must be true before starting)
- [ ] **Step-by-step** procedure (numbered, clear)
- [ ] **Tcl examples** with comments explaining why
- [ ] **Error handling** (what to do when things fail)
- [ ] **Verification** steps (how to know it worked)
- [ ] **Pitfalls** section (common mistakes)

### Template Checklist

- [ ] **Variables** have sensible defaults
- [ ] **Conditionals** for optional features
- [ ] **Comments** explain what the Tcl does
- [ ] **Tested** with real EDA tool

---

## You're Ready!

You now have everything you need to:
- ✅ Write skills that teach AI your ASIC expertise
- ✅ Debug AI behavior like you debug timing violations
- ✅ Extend HiPilot for your specific methodology
- ✅ Contribute to the future of AI-assisted chip design

**Remember:**
- AI is a tool, not a replacement for your expertise
- Skills are just documented expertise—write what you know
- Start small, test often, iterate based on evidence

**Your next step:** Pick one task you do frequently (like hold fixing or DRC cleanup) and write a skill for it. Test it. Share it.

*Happy designing!* 🚀

---

## Resources

- **HiPilot Source:** `/home/EDA/hipilot/current/`
- **Skills Directory:** `skills/`
- **Templates Directory:** `templates/cadence/` and `templates/synopsys/`
- **Test Evidence:** `test-evidence/latest/`
- **This Cookbook:** You're reading it!

*Questions? Check the existing skills—they're the best examples.*
