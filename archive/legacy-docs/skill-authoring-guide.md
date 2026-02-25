# HiPilot Skill Authoring Guide

**Version:** Phase 1
**Date:** 2026-02-19

---

## 1. What Are Skills?

Skills are reusable PD workflow definitions that bridge the gap between natural language and correct EDA Tcl. They encode your team's expertise into a format that HiPilot can execute reliably.

**Skills are the primary value prop of HiPilot** - they capture and scale team knowledge:
- Senior engineers solve a problem once → skill is created
- Junior engineers can now execute senior-level flows via natural language
- Knowledge scales across the team instead of staying in one person's head
- Skills accumulate over time, making the team more capable collectively

When an engineer says "fix setup timing on pcie_rx", HiPilot matches this to the `fix-setup-timing` skill, extracts the parameters, and uses a validated Tcl template to generate the script.

**Skills are NOT code.** They are structured descriptions that tell HiPilot:
- What parameters to extract from the conversation
- Which Tcl template to use
- What steps to follow
- How to validate inputs

**Skills use Claude Code's native format** - no custom skill format needed.

---

## 2. Skill File Format

Skills are markdown files with YAML frontmatter, stored in:

```
{project}/.hipilot/skills/    ← team skills (in git, shared)
~/.hipilot/skills/            ← personal skills
{install}/skills/             ← built-in skills
```

Resolution order: project > user > built-in (first match wins, by name).

### 2.1 Minimal Skill

```yaml
# my-skill.md
---
name: report-congestion
description: Generate and analyze routing congestion report
trigger: "congestion", "routing congestion", "congestion map"
vendor: [synopsys]
---

## Workflow

1. Generate congestion report using `eda.generate_tcl`
2. Parse the report output
3. Summarize hotspots to the user
```

### 2.2 Full Skill (All Fields)

```yaml
# fix-setup-timing.md
---
name: fix-setup-timing
description: Analyze and fix setup timing violations through iterative cell sizing and buffering
trigger: "fix setup", "fix timing", "close timing", "setup violations"
vendor: [synopsys, cadence]
tools_required: [eda.generate_tcl, eda.extract_qor, knowledge.get_recipe]
---

## Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| path_group | string | yes | — | Target path group name |
| max_paths | int | no | 10 | Number of worst paths to fix |
| strategies | list | no | [size_cell, insert_buffer] | Fix strategies in priority order |
| effort | enum(low,medium,high) | no | medium | Optimization effort level |

## Parameter Extraction Examples

User: "fix the 3 worst setup violations on mem_ctrl"
→ path_group: "mem_ctrl", max_paths: 3, strategies: default, effort: default

User: "I have setup issues on the GPU block, try aggressive sizing"
→ path_group: "gpu_core", max_paths: default, strategies: ["size_cell"], effort: "high"

User: "timing is not closing on clk_main, only use buffers please"
→ path_group: "clk_main", max_paths: default, strategies: ["insert_buffer"], effort: default

User: "fix all the timing on pcie_rx, high effort, try everything"
→ path_group: "pcie_rx", max_paths: 50, strategies: ["size_cell", "insert_buffer", "reroute"], effort: "high"

## Validation Rules

- path_group must exist in current design (query knowledge.get_design_info)
- max_paths must be between 1 and 100
- if effort=high, warn user this may significantly change cell count
- strategies must be a subset of: [size_cell, insert_buffer, reroute, clone_register]

## Workflow

1. Read latest timing report → AI comprehends violations
2. Present violation summary to user (WNS, TNS, count)
3. Generate fix Tcl from template with extracted params
4. Show Tcl to user for review with trust badge AND reasoning
5. On approval, send to EDA terminal
6. Wait for completion, re-read timing report
7. Report before/after delta (WNS change, paths fixed, paths remaining)

## Templates Used

- synopsys: icc2_fix_setup_timing.tcl.j2
- cadence: innovus_fix_setup_timing.tcl.j2
```

---

## 3. Frontmatter Fields Reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | yes | string | Unique skill identifier (kebab-case) |
| `description` | yes | string | One-line description of what the skill does |
| `trigger` | yes | string (comma-separated) | Phrases that activate this skill |
| `vendor` | no | list | Supported vendors: `[synopsys]`, `[cadence]`, `[synopsys, cadence]` |
| `tools_required` | no | list | MCP tools this skill uses |

---

## 4. Sections Reference

### Parameters (recommended)

Define what inputs the skill needs. The LLM extracts these from the user's natural language.

```markdown
## Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| path_group | string | yes | — | Target path group |
| max_paths | int | no | 10 | Number of paths |
```

**Supported types:** `string`, `int`, `float`, `boolean`, `enum(val1,val2,...)`, `list`

### Parameter Extraction Examples (recommended)

Teach the LLM how to interpret user requests. These are few-shot examples.

```markdown
## Parameter Extraction Examples

User: "fix the 3 worst setup violations on mem_ctrl"
→ path_group: "mem_ctrl", max_paths: 3

User: "timing issues on GPU block, aggressive sizing"
→ path_group: "gpu_core", strategies: ["size_cell"], effort: "high"
```

**Tips:**
- Include 3-5 examples covering different phrasings
- Show both explicit and implicit parameter extraction
- Include edge cases (missing params, ambiguous wording)

### Validation Rules (recommended)

Constraints checked before template rendering.

```markdown
## Validation Rules

- path_group must exist in current design
- max_paths must be between 1 and 100
- if effort=high, warn user about cell count impact
```

### Workflow (required)

Step-by-step execution plan. **Skills are flexible workflows, not rigid scripts.**

```markdown
## Workflow

1. Read latest timing report
2. Present summary to user
3. Generate Tcl from template
4. Show for review
5. Execute on approval
6. Report results
```

**Note:** The workflow is a guide, not a rigid script. The AI can adapt based on context.

### Templates Used (recommended)

Maps vendor to Tcl template file.

```markdown
## Templates Used

- synopsys: icc2_fix_setup_timing.tcl.j2
- cadence: innovus_fix_setup_timing.tcl.j2
```

---

## 5. Writing Tcl Templates

Templates live alongside skills and use Jinja2 syntax (via nunjucks).

### 5.1 Template Location

```
{project}/.hipilot/templates/{vendor}/
~/.hipilot/templates/{vendor}/
{install}/templates/{vendor}/
```

### 5.2 Template Conventions

Every template MUST:

```tcl
{# Always include a header #}
# HiPilot Generated - {{ timestamp }}
# Skill: {{ skill_name }}
# Intent: {{ description }}
# Trust: [✓ Template]

{# Validate preconditions #}
if { [sizeof_collection [get_designs]] == 0 } {
  puts "ERROR: No design loaded"
  return
}

{# Main body with parameterized values #}
set paths [get_timing_paths \
  -group {{ path_group }} \
  -max_paths {{ max_paths }} \
  -slack_lesser_than 0]

{# Handle empty results #}
if { [sizeof_collection $paths] == 0 } {
  puts "INFO: No violations found on {{ path_group }}"
  return
}

{# Core operations #}
{% for strategy in strategies %}
{% if strategy == "size_cell" %}
# Strategy: cell sizing
...
{% endif %}
{% endfor %}

{# Always end with verification #}
puts "INFO: Fix complete. Running verification..."
report_timing -group {{ path_group }} -max_paths {{ max_paths }}
```

### 5.3 Template Variables

Templates receive these automatic variables:

| Variable | Source | Example |
|----------|--------|---------|
| `timestamp` | System | `2026-02-19 14:32:05` |
| `skill_name` | Skill frontmatter | `fix-setup-timing` |
| `description` | Generated by LLM | `Fix setup timing on pcie_rx` |

Plus all parameters defined in the skill's `## Parameters` section.

### 5.4 Template Filters

Available nunjucks filters:

| Filter | Usage | Result |
|--------|-------|--------|
| `default` | `{{ var \| default("BUFFD4") }}` | Fallback value |
| `join` | `{{ list \| join(" ") }}` | Join list items |
| `upper` | `{{ name \| upper }}` | Uppercase |
| `lower` | `{{ name \| lower }}` | Lowercase |

---

## 6. Skill Examples

### 6.1 Simple: Run Timing Report

```yaml
# run-timing-report.md
---
name: run-timing-report
description: Run timing analysis and summarize results
trigger: "timing report", "check timing", "show timing"
vendor: [synopsys, cadence]
---

## Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| path_group | string | no | all | Path group to report (or "all") |
| max_paths | int | no | 10 | Paths to display per group |

## Parameter Extraction Examples

User: "show me timing"
→ path_group: "all", max_paths: 10

User: "timing on pcie_rx, show 5 worst"
→ path_group: "pcie_rx", max_paths: 5

## Workflow

1. Generate timing report Tcl
2. Send to EDA terminal
3. AI reads and comprehends the generated report
4. Present summary table to user

## Templates Used

- synopsys: icc2_report_timing.tcl.j2
- cadence: innovus_report_timing.tcl.j2
```

### 6.2 Medium: DRC Check

```yaml
# run-drc.md
---
name: run-drc
description: Run DRC checks and summarize violations
trigger: "check drc", "drc violations", "run drc", "drc"
vendor: [synopsys, cadence]
---

## Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| region | string | no | all | Region to check (or "all") |
| types | list | no | [all] | DRC types: short, spacing, width, via, etc. |

## Workflow

1. Generate DRC check Tcl
2. Execute in EDA terminal
3. AI reads and comprehends DRC report
4. Present violation summary:
   - Total count
   - Breakdown by type
   - Worst areas (coordinates)
5. Suggest fixes if common patterns detected

## Templates Used

- synopsys: icc2_report_drc.tcl.j2
- cadence: innovus_report_drc.tcl.j2
```

### 6.3 Advanced: Team-Specific Flow

```yaml
# our-signoff-checks.md
---
name: our-signoff-checks
description: Run our team's standard signoff checklist before tapeout
trigger: "signoff checks", "signoff", "tapeout checks", "pre-tapeout"
vendor: [synopsys]
---

## Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| corner | string | no | all | Corner to check (or "all") |
| skip | list | no | [] | Checks to skip: timing, drc, lvs, power, erc |

## Workflow

1. Confirm design is saved (checkpoint exists)
2. For each check (unless skipped):
   a. Run timing signoff (PrimeTime)
      - All corners, setup + hold
      - Report must show WNS >= 0
   b. Run DRC
      - Zero violations required
      - Report any waivers
   c. Run LVS
      - Clean match required
   d. Run power analysis
      - Check against power budget in .hipilot/config.yaml
   e. Run ERC
      - Zero violations required
3. Generate signoff summary report
4. Flag any failing checks with ✗

## Templates Used

- synopsys: pt_signoff_timing.tcl.j2
- synopsys: icc2_signoff_drc.tcl.j2
- synopsys: icc2_signoff_lvs.tcl.j2
- synopsys: icc2_report_power.tcl.j2
```

---

## 7. Testing Your Skills

### 7.1 Dry Run

Test parameter extraction without executing:

```
you: /skills test fix-setup-timing "fix the 5 worst setup violations on mem_ctrl"

hipilot: Skill: fix-setup-timing
  Extracted parameters:
    path_group: "mem_ctrl" ✓
    max_paths: 5 ✓
    strategies: ["size_cell", "insert_buffer"] (default) ✓
    effort: "medium" (default) ✓

  Validation: all rules pass ✓
  Template: icc2_fix_setup_timing.tcl.j2 (found) ✓
```

### 7.2 Template Preview

Generate Tcl without sending to terminal:

```
you: /skills preview fix-setup-timing path_group=mem_ctrl max_paths=5

hipilot: [Preview - not sent to terminal]

  ┌─ Tcl [✓ Template] ──────────────────────────────┐
  │ # HiPilot Generated - 2026-02-19 14:32:05        │
  │ # Skill: fix-setup-timing                          │
  │ set paths [get_timing_paths \                      │
  │   -group mem_ctrl \                                │
  │   -max_paths 5 ...]                                │
  └───────────────────────────────────────────────────┘
```

---

## 8. Best Practices

1. **Name skills with verbs:** `fix-setup-timing`, `run-drc`, `report-power` — not `timing-fixer` or `drc-checker`

2. **Include 3-5 extraction examples:** The more examples, the better the LLM extracts params

3. **Always include validation rules:** Catch wrong path group names, out-of-range values before hitting the EDA tool

4. **End templates with verification:** Every Tcl template should end with a `report_*` command so results can be parsed

5. **Keep skills focused:** One skill = one task. Don't make a "do everything" skill

6. **Use project skills for team flows:** Put team-specific skills in `.hipilot/skills/` and commit to git

7. **Use personal skills for shortcuts:** Your personal tricks go in `~/.hipilot/skills/`

8. **Version your templates:** Templates are code — treat them with the same rigor as your PD scripts

9. **Skills are flexible:** Don't make rigid scripts. Let the AI adapt based on context.

10. **Show reasoning:** Include workflow explanations so the AI can communicate its approach to the user.

---

## 9. Skill Generation (Phase 2)

### 9.1 Auto-Generate Skills

HiPilot can automatically generate skills from existing documentation:

```bash
/skill-gen /path/to/team_runbook.md
/skill-gen /path/to/email_thread.txt
/skill-gen /path/to/forum_post.html
```

### 9.2 Generation Process

1. **Parse source document**
   - Extract workflow steps
   - Identify parameters
   - Find validation rules
   - Collect examples

2. **Generate skill structure**
   - Skill name (auto-detected)
   - Description
   - Trigger phrases
   - Parameters schema
   - Validation rules
   - Workflow steps
   - Usage examples

3. **Generate markdown**
   - YAML frontmatter
   - Skill sections
   - Template references

4. **User review**
   - Edit skill
   - Add missing pieces
   - Validate

5. **Save to skill directory**
   - Project skills: `.hipilot/skills/`
   - User skills: `~/.hipilot/skills/`
   - Built-in skills: `{install}/skills/`

### 9.3 Generation Examples

**From Team Runbook:**

```markdown
Source: how_to_fix_setup_violations.md

Output Skill: fix-setup-timing
  - Parameters: path_group, max_paths, strategies
  - Workflow: Read report → Analyze → Generate Tcl → Execute → Verify
  - Examples: 3-5 examples from runbook
```

**From Email Thread:**

```markdown
Source: ir_drop_fix_email.txt

Output Skill: fix-ir-drop
  - Parameters: region, voltage_threshold, strap_width
  - Workflow: Check IR → Add straps → Verify
  - Examples: Extracted from email discussion
```

---

## 10. Skill Lifecycle

```
1. Create skill
   ├─ Manual authoring
   └─ Auto-generation from docs (Phase 2)

2. Test skill
   ├─ Dry run parameter extraction
   ├─ Preview Tcl generation
   └─ Test on real design (Ibex)

3. Validate skill
   ├─ Test on Ibex core
   ├─ Verify Tcl runs correctly
   └─ Check report comprehension

4. Deploy skill
   ├─ Commit to project repo
   ├─ Share with team
   └─ Document in skill catalog

5. Maintain skill
   ├─ Update as needed
   ├─ Add new examples
   └─ Refine parameters

6. Monitor usage
   ├─ Track skill usage
   ├─ Collect feedback
   └─ Iterate and improve
```

---

## 11. Skill Catalog

### 11.1 Built-in Skills (Phase 1)

| Skill | Trigger | Vendors | Purpose |
|-------|---------|---------|---------|
| `fix-setup-timing` | "fix setup", "close timing" | Synopsys, Cadence | Fix setup violations |
| `fix-hold-timing` | "fix hold", "hold violations" | Synopsys, Cadence | Fix hold violations |
| `run-timing-report` | "timing report", "check timing" | Synopsys, Cadence | Generate timing report |
| `run-drc` | "check drc", "drc violations" | Synopsys, Cadence | Run DRC checks |
| `report-power` | "power report", "check power" | Synopsys, Cadence | Generate power report |
| `report-area` | "area report", "utilization" | Synopsys, Cadence | Generate area report |
| `read-design` | "open design", "read design" | Synopsys, Cadence | Load design into tool |
| `save-design` | "save design", "write checkpoint" | Synopsys, Cadence | Save design checkpoint |
| `run-route-opt` | "route opt", "optimize routing" | Synopsys, Cadence | Run routing optimization |
| `compare-qor` | "compare results", "qor delta" | Synopsys, Cadence | Compare QoR metrics |

### 11.2 Team Skills

Teams create their own skills for:
- Methodology-specific flows
- Tool-specific configurations
- Project-specific constraints
- Best practices and lessons learned

### 11.3 Personal Skills

Individuals create personal skills for:
- Personal shortcuts
- Preferred workflows
- Custom parameter sets
- Frequent tasks

---

## 12. Troubleshooting

### 12.1 Skill Not Matching

**Problem:** Skill not triggering

**Solutions:**
- Check trigger phrases match user language
- Verify skill is in correct directory
- Check skill YAML frontmatter is valid
- Test with `/skills test` command

### 12.2 Parameter Extraction Failing

**Problem:** Wrong parameters extracted

**Solutions:**
- Add more extraction examples
- Clarify parameter descriptions
- Add validation rules
- Test with `/skills test` command

### 12.3 Template Not Found

**Problem:** Template not found error

**Solutions:**
- Check template path in skill
- Verify template exists in correct location
- Check vendor/tool combination
- Use `/skills list` to see available templates

### 12.4 Generated Tcl Not Working

**Problem:** Generated Tcl fails in EDA tool

**Solutions:**
- Test template manually
- Check parameter values
- Validate template syntax
- Add more precondition checks
- Test on Ibex design

---

## 13. Resources

### 13.1 Documentation

- **PRD:** `/docs/prd.md` - Product requirements
- **Architecture:** `/docs/plans/2026-02-18-hipilot-architecture-design.md`
- **EDA MCP Spec:** `/docs/specs/eda-mcp-server-spec.md`
- **UX Spec:** `/docs/specs/ux-specification.md`

### 13.2 Examples

- **Built-in skills:** `{install}/skills/`
- **Ibex design skills:** `{project}/.hipilot/skills/`
- **Template examples:** `{install}/templates/`

### 13.3 Testing

- **EDA server:** 192.168.112.163 (CentOS 7)
- **Test design:** Ibex Core
- **Test command:** `/skills test <skill> "<input>"`
