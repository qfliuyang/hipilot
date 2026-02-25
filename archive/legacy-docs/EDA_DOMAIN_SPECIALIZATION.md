# EDA Domain Specialization Strategy

**Version:** 1.0
**Date:** 2026-02-20
**Goal:** Transform Claude Code from general AI → EDA-specialized assistant (fast, token-efficient)

---

## The Problem

| Challenge | Current State | Impact |
|-----------|---------------|--------|
| **Slow** | Claude figures out context each time | 30-90s per response |
| **Token-heavy** | Re-explains EDA concepts repeatedly | Wastes context window |
| **Generic** | Uses Bash instead of EDA tools | Bypasses safety systems |
| **Inconsistent** | Different approaches each time | Unpredictable results |

**Root Cause:** Claude Code is a generalist. It doesn't "know" EDA until told, every time.

---

## The Solution: Layered Context Injection

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: Just-in-Time Context (loaded per request)            │
│  "This is a post-CTS design with setup violations..."          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Design Context (loaded once per session)             │
│  "Design: ibex, Technology: sky130hd, Stage: post_route"       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: EDA Domain Knowledge (in system prompt)              │
│  "When user says 'fix timing', use eda.generate_tcl..."        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Core Agent Behavior (always loaded)                  │
│  "You are HiPilot, an EDA assistant..."                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Core Agent Behavior (System Prompt)

### Create: `.claude/system.md`

```markdown
# HiPilot - EDA Physical Design Copilot

You are HiPilot, an AI assistant specialized in VLSI physical design. You help engineers
work with EDA tools (Innovus, ICC2, PrimeTime) to design chips.

## Core Behavior

1. **Always use MCP tools first** - Never use Bash for EDA operations
2. **Check status before acting** - Call `eda.get_status()` first
3. **Show what you'll do** - Display Tcl before executing
4. **Explain briefly** - One sentence of reasoning, then act

## Response Format (Save Tokens!)

**For EDA operations:**
```
📊 Status: [tool] [mode]
🔧 Action: [what you'll do]
📝 Tcl:
```tcl
[the commands]
```
▶ Proceed? (y/n)
```

**Keep responses under 500 tokens unless user asks for details.**

## MCP Tools (Always Use These!)

| Tool | When to Use |
|------|-------------|
| `eda.get_status()` | Before ANY EDA operation |
| `eda.generate_tcl()` | To create Tcl from intent |
| `eda.send_to_terminal()` | To send Tcl to EDA pane |
| `eda.get_risk_analysis()` | To check if operation is safe |
| `eda.extract_qor()` | To parse timing/power reports |

**NEVER use:** `tmux send-keys`, `echo > /dev/pts`, direct file writes to EDA
```

### Token Savings
- **Before:** Claude explains EDA concepts (~500 tokens) + figures out approach (~300 tokens)
- **After:** Claude follows system prompt (~0 extra tokens)
- **Savings:** ~800 tokens per request

---

## Layer 2: EDA Domain Knowledge (Compact Reference)

### Create: `.claude/commands/eda-quick-ref.md`

```markdown
# EDA Quick Reference (Internal)

Use this to map user intent → MCP tool → action. DO NOT explain to user.

## Intent Mapping Table

| User Says | Tool Call | Template |
|-----------|-----------|----------|
| "timing report" / "check timing" | `eda.generate_tcl({operation: "report_timing"})` | report_timing |
| "fix setup" / "setup violations" | `eda.generate_tcl({operation: "fix_setup_timing"})` | fix_setup_timing |
| "fix hold" / "hold violations" | `eda.generate_tcl({operation: "fix_hold_timing"})` | fix_hold_timing |
| "power report" / "check power" | `eda.generate_tcl({operation: "report_power"})` | report_power |
| "area report" / "check area" | `eda.generate_tcl({operation: "report_area"})` | report_area |
| "drc" / "check drc" | `eda.generate_tcl({operation: "check_drc"})` | check_drc |
| "route" / "run routing" | `eda.generate_tcl({operation: "route_design"})` | route_design |
| "save" / "checkpoint" | `eda.generate_tcl({operation: "save_design"})` | save_design |
| "load" / "open design" | `eda.generate_tcl({operation: "read_design"})` | read_design |

## Vendor Detection

| Tool Detected | Vendor | Template Path |
|---------------|--------|---------------|
| innovus | cadence | templates/cadence/ |
| icc2_shell | synopsys | templates/synopsys/ |
| pt_shell | synopsys | templates/synopsys/ |

## Flow Stage Awareness

| Stage | Commands Available |
|-------|-------------------|
| pre-CTS | CTS commands, placement |
| post-CTS | Optimization, hold fixing |
| post-route | Signoff, extraction |

## Risk Levels (Auto-handled)

| Level | Indicator | Action |
|-------|-----------|--------|
| Safe | 🟢 | Auto-approve if user said "yes" |
| Moderate | 🟡 | Show, ask for confirmation |
| Dangerous | 🟠 | Require "CONFIRM" |
| Critical | 🔴 | Require full phrase |
```

### Token Savings
- **Before:** Claude lists all possible approaches (~400 tokens)
- **After:** Claude looks up in table (~50 tokens)
- **Savings:** ~350 tokens per request

---

## Layer 3: Design Context (Session-Scoped)

### Create: `.hipilot/design.yaml` (per project)

```yaml
# HiPilot Design Context
# This file is loaded once per session to provide context

design:
  name: ibex_core
  technology: sky130hd
  status: post_route

eda:
  vendor: cadence
  tool: innovus
  version: "20.10"

flow:
  current_stage: post_route
  completed_stages: [synthesis, floorplan, placement, cts, routing]

timing:
  target_mhz: 100
  worst_path_group: reg2reg

known_issues:
  - "Clock tree has long insertion delay"
  - "Hold violations on async paths"

shortcuts:
  # User-defined shortcuts
  "quick check": "report_timing -max_paths 5 && report_power"
  "signoff": "run all signoff checks"
```

### Loading Mechanism

Add to MCP server: `eda.get_design_context()`

```javascript
case 'eda.get_design_context': {
  const contextPath = join(process.cwd(), '.hipilot', 'design.yaml');
  if (existsSync(contextPath)) {
    const context = yaml.load(readFileSync(contextPath, 'utf-8'));
    return {
      content: [{
        type: 'text',
        text: `📋 **Design Context**\n` +
              `Design: ${context.design.name}\n` +
              `Technology: ${context.design.technology}\n` +
              `Stage: ${context.flow.current_stage}\n` +
              `Tool: ${context.eda.vendor} ${context.eda.tool}\n`
      }],
      _metadata: context
    };
  }
  return { content: [{ type: 'text', text: 'No design context loaded.' }] };
}
```

### Token Savings
- **Before:** User explains design each time (~200 tokens)
- **After:** Loaded from file once (~0 extra tokens per request)
- **Savings:** ~200 tokens per request

---

## Layer 4: Just-in-Time Context (Per-Request)

### Skill-Based Context Loading

When user invokes a skill, load ONLY relevant context:

```markdown
# In skill file (e.g., skills/fix-setup-timing.md)

---
name: fix-setup-timing
context_load:
  - templates/synopsys/icc2_fix_setup_timing.tcl
  - docs/methodology/setup_timing_fixing.md
---

## Quick Workflow
1. Run: `eda.get_risk_analysis()` on generated Tcl
2. If 🟢 or 🟡: Send to terminal
3. If 🟠 or 🔴: Show warning, ask for confirmation
4. Capture output, report WNS improvement

## Common Patterns
- Undersized cells → size up
- Long nets → add buffers
- Clock skew → fix CTS
```

### Token Savings
- **Before:** Load entire skill (~1000 tokens)
- **After:** Load only workflow section (~150 tokens)
- **Savings:** ~850 tokens per skill use

---

## Implementation: Token Budget Tracker

### Add to MCP Server: `eda.token_report()`

```javascript
case 'eda.token_report': {
  return {
    content: [{
      type: 'text',
      text: `📊 **Token Budget**\n` +
            `Used: ~${estimatedTokens}\n` +
            `Remaining: ~${200000 - estimatedTokens}\n` +
            `Efficiency: ${efficiency}%\n\n` +
            `Tips:\n` +
            `- Use skills instead of free-form requests\n` +
            `- Load design context once per session\n` +
            `- Use quick-ref for common operations`
    }]
  };
}
```

---

## Speed Optimization: Pre-Computed Responses

### Common Operations Cache

For frequent operations, pre-compute the response:

```javascript
// In MCP server
const QUICK_RESPONSES = {
  'status': () => callTool('eda.get_status'),
  'timing': () => callTool('eda.generate_tcl', {operation: 'report_timing'}),
  'power': () => callTool('eda.generate_tcl', {operation: 'report_power'}),
  'area': () => callTool('eda.generate_tcl', {operation: 'report_area'}),
  'drc': () => callTool('eda.generate_tcl', {operation: 'check_drc'}),
};

// Before processing, check if it's a quick operation
if (QUICK_RESPONSES[userIntent]) {
  return QUICK_RESPONSES[userIntent]();  // ~100ms instead of ~30s
}
```

---

## Summary: Token & Time Budget

| Operation | Before | After | Savings |
|-----------|--------|-------|---------|
| Simple timing report | 1200 tokens, 45s | 200 tokens, 5s | 83% tokens, 89% time |
| Fix setup violations | 2000 tokens, 90s | 400 tokens, 15s | 80% tokens, 83% time |
| Load design context | 300 tokens each time | 0 tokens (once) | 100% tokens |
| Skill execution | 1500 tokens | 300 tokens | 80% tokens |

**Expected improvement:** 5-10x faster, 4-5x fewer tokens

---

## Implementation Checklist

### Phase 1: System Prompt (Day 1)
- [ ] Create `.claude/system.md` with core behavior
- [ ] Test that Claude follows MCP-first rule
- [ ] Verify token reduction

### Phase 2: Quick Reference (Day 1)
- [ ] Create `eda-quick-ref.md` with intent mapping
- [ ] Add vendor detection rules
- [ ] Add flow stage awareness

### Phase 3: Design Context (Day 2)
- [ ] Add `eda.get_design_context()` MCP tool
- [ ] Create `.hipilot/design.yaml` schema
- [ ] Test context loading

### Phase 4: JIT Context (Day 3)
- [ ] Update skill format with `context_load`
- [ ] Implement lazy loading
- [ ] Measure token savings

### Phase 5: Pre-Computed Cache (Day 3)
- [ ] Add quick response cache
- [ ] Benchmark speed improvement
- [ ] Add `eda.token_report()` tool

---

## Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|------------|
| Load entire documentation | Load only relevant section |
| Explain EDA concepts | Assume user knows, just act |
| List all options | Pick best option, ask to confirm |
| Use Bash commands | Use MCP tools |
| Re-explain workflow | Use skills with embedded workflow |

---

**Last Updated:** 2026-02-20
