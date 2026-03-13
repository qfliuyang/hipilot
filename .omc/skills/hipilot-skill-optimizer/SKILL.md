---
name: hipilot-skill-optimizer
description: Optimize HiPilot skills based on HiTestBot results and failure patterns
triggers:
  - hipilot
  - skill
  - optimize
  - hitestbot
  - skill-creator
argument-hint: "[skill-name]"
---

# HiPilot Skill Optimizer

## Purpose

Analyze HiPilot skills against HiTestBot results to identify gaps, fix issues, and improve certification scores. This skill helps maintain high-quality skills that pass HiTestBot certification (6.0/6.0 target).

## When to Activate

Use this skill when:
- HiTestBot reports failures (L1-L5)
- Skills need updating based on test results
- Creating new skills for HiPilot
- Refactoring existing skills for better clarity
- Fixing LEF order, QoR reporting, or tool switching issues

## HiTestBot Scoring Reference

| Layer | Score | What It Tests |
|-------|-------|---------------|
| L1 | 1.0 | Claude responds to command |
| L2 | 1.0 | Claude understands the task |
| L3 | 1.0 | MCP tools are used correctly |
| L3b | 1.0 | Correct tool for each stage (dc_shell for synthesis, innovus for P&R) |
| L4 | 1.0 | EDA tool executes without errors |
| L5 | 1.0 | QoR metrics reported with explicit WNS/TNS numbers |

## Common Skill Issues & Fixes

### 1. L5 QoR Assessment Failure

**Problem**: No WNS/TNS numbers in Claude output
**Fix**: Add explicit QoR reporting section:
```markdown
### MANDATORY QoR REPORTING (L5 Requirement)
**CRITICAL: Report WNS/TNS in this exact format:**
```
WNS: 0.XXX ns
TNS: 0.YYY ns
```

The test scorer looks for patterns:
- `WNS[:\s]*(-?[\d.]+)`
- `TNS[:\s]*(-?[\d.]+)`
```

### 2. L3b Process Validation Failure

**Problem**: Wrong tool for stage (e.g., innovus for synthesis)
**Fix**: Explicitly state tool requirements:
```markdown
**Tool:** dc_shell (REQUIRED - Innovus cannot synthesize RTL)

```javascript
// CORRECT - Stage 0 uses dc_shell
eda.start_tool({tool: "dc_shell", design_dir: process.env.HIPILOT_DESIGN_DIR})

// WRONG - Innovus cannot run synthesis
eda.start_tool({tool: "innovus"}) // ❌ Will fail
```
```

### 3. L4 EDA Execution Failure

**Problem**: IMPLF-53 LEF loading error
**Fix**: Document LEF order requirement:
```markdown
### LEF File Loading Order (CRITICAL)
Tech LEF (.tlef) MUST be loaded BEFORE cell LEFs (.lef):

```tcl
# CORRECT - Tech LEF first
set init_lef_file "sky130_fd_sc_hd.tlef sky130_fd_sc_hd_merged.lef"

# WRONG - Cell LEF before Tech LEF
set init_lef_file "sky130_fd_sc_hd_merged.lef sky130_fd_sc_hd.tlef" ;# ❌ IMPLF-53 error
```
```

## Skill Optimization Checklist

When reviewing a skill, verify:

- [ ] **L1/L2**: Clear purpose and intent recognition
- [ ] **L3**: Correct MCP tool usage patterns
- [ ] **L3b**: Correct tool specified for each stage
- [ ] **L4**: Error handling for common failures
- [ ] **L5**: Explicit WNS/TNS reporting requirements
- [ ] **Human-Like**: Incremental commands, not batch scripts
- [ ] **LittleBrain**: Uses knowledge tools for Tcl generation/QoR extraction

## Workflow

1. **Analyze HiTestBot Results**
   ```bash
   # Check latest test evidence
   ls test-evidence/latest/FLOW_REPORT.md

   # Identify failing layers
   grep -E "L[1-5].*:" test-evidence/latest/FLOW_REPORT.md
   ```

2. **Find Affected Skills**
   ```bash
   # Search skills for relevant content
   grep -r "wns\|tns\|QoR" skills/
   grep -r "dc_shell\|innovus" skills/
   ```

3. **Update Skills**
   - Add missing requirements
   - Strengthen error handling
   - Include exact patterns for test scoring

4. **Re-run HiTestBot**
   ```bash
   bin/hitestbot-eda /rtl2gds
   ```

5. **Verify Fix**
   - Check new FLOW_REPORT.md
   - Confirm score improved

## Skill Template for HiTestBot Success

```markdown
---
name: [workflow-name]
description: [Clear, specific description]
triggers: [relevant keywords]
---

# [Workflow Name]

## Purpose
[What this skill does and when to use it]

## Prerequisites
- [List required files/tools]
- [Any setup needed]

## Stage X: [Name] ([tool]) - ~[time] minutes
**Skip if:** `[checkpoint file exists]`

**Tool:** [dc_shell|innovus|pt_shell] (REQUIRED)

```javascript
// 1. Start correct tool
eda.start_tool({tool: "[tool]", design_dir: "$design_dir"})

// 2. Send Tcl
eda.send_tcl_nonblocking({tcl: stageX_tcl, description: "Stage X: [Name]"})

// 3. Wait for completion
eda.await_idle({timeout: [seconds], expected_tool: "[tool]"})

// 4. Check result
eda.get_last_result({lines: 50})

// 5. Run timing report for QoR
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get timing"})
eda.await_idle({timeout: 30})
const output = await eda.get_last_result({lines: 50})

// 6. Report WNS/TNS (L5 REQUIREMENT)
console.log(`Stage X [Name]: WNS: [value] ns, TNS: [value] ns`)
```

### Error Handling
**Common Error:** `[error pattern]`
**Fix:** `[specific solution]`

## Notes
- [Any additional context]
```

## References

- HiTestBot: `src/hitestbot/core/FlowCertifier.js`
- LittleBrain: `servers/knowledge/littlebrain/`
- Skills: `skills/`
- Test Evidence: `test-evidence/latest/`

## Examples

### Optimize ibex-rtl2gds-flow skill
```bash
# Check current score
cat test-evidence/latest/FLOW_REPORT.md | grep "L5"

# Result: L5 QoR Assessment: 0.0

# Fix: Add to skills/ibex-rtl2gds-flow.md
```markdown
### MANDATORY QoR REPORTING
After EVERY stage, report:
```
Stage X [Name]: WNS: 0.XXX ns, TNS: 0.YYY ns
```
```

# Re-run test
bin/hitestbot-eda /rtl2gds

# Verify: L5 QoR Assessment: 1.0
```

### Create new skill from HiTestBot failure
```bash
# Identify gap from test results
grep "blocking_stage" test-evidence/latest/flow_progress.json

# Create skill
/skill add fix-[specific-error]

# Populate with solution
# ...
```
