---
name: compare-implementations
description: >
  Compare QoR metrics between different implementations or checkpoints.
  Shows delta analysis, identifies improvements and regressions, generates
  comparison reports. Essential for evaluating design alternatives.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - qor.list_snapshots
    - qor.compare
    - qor.get_trend
    - session.list_checkpoints
  autonomous: false
  flow_stages: [all]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `snapshot1` | string | `""` | First snapshot ID or name (baseline) |
| `snapshot2` | string | `""` | Second snapshot ID or name (current) |
| `metrics` | list | `[wns, tns, violations, power, area]` | Metrics to compare |
| `show_trend` | boolean | `true` | Show trend over time |
| `generate_report` | boolean | `true` | Generate formatted report |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `qor.list_snapshots` | List available snapshots |
| `qor.compare` | Compare two snapshots |
| `qor.get_trend` | Show metric trends |
| `session.list_checkpoints` | List checkpoints with QoR |

---

## Workflow

### Step 1 — List Available Snapshots

If snapshot IDs not provided:

**MCP Call:**
```
qor.list_snapshots
```

**Response:**
```
snapshots:
  1. baseline (snap_001) - 2026-02-23 10:00
     WNS: -0.25ns, TNS: -15.5ns, Violations: 47
     
  2. post_cts (snap_002) - 2026-02-23 12:00
     WNS: -0.15ns, TNS: -8.2ns, Violations: 28
     
  3. post_route (snap_003) - 2026-02-23 14:00
     WNS: -0.08ns, TNS: -3.1ns, Violations: 12
     
  4. after_eco (snap_004) - 2026-02-23 16:00
     WNS: +0.02ns, TNS: 0.0ns, Violations: 0
```

---

### Step 2 — Compare Snapshots

**MCP Call:**
```
qor.compare snapshot1="baseline" snapshot2="after_eco"
```

**Response:**
```
snapshot1: baseline (2026-02-23 10:00)
snapshot2: after_eco (2026-02-23 16:00)

delta:
  wns: +0.27ns (-0.25 → +0.02)
  tns: +15.5ns (-15.5 → 0.0)
  setup_violations: -47 (47 → 0)
  hold_violations: 0 (0 → 0)
  drc_violations: -5 (5 → 0)
  total_power: +2.1mW (123.4 → 125.5)
  area: +0.02mm² (1.20 → 1.22)
  
improved: true
summary: "WNS improved by 0.27ns, timing clean achieved"
```

---

### Step 3 — Show Trend (Optional)

**MCP Call:**
```
qor.get_trend metric="wns" snapshots=10
```

**Response:**
```
trend: improving
data:
  - baseline: -0.25ns
  - post_cts: -0.15ns
  - post_route: -0.08ns
  - after_eco: +0.02ns

improvement: +0.27ns total (108% improvement)
```

---

## Example Output

```
📊 Implementation Comparison Report

Comparing: baseline vs after_eco
Time span: 6 hours (2026-02-23 10:00 to 16:00)

┌──────────────────┬─────────────┬─────────────┬──────────┐
│ Metric           │ Baseline    │ After ECO   │ Delta    │
├──────────────────┼─────────────┼─────────────┼──────────┤
│ WNS (ns)         │ -0.25       │ +0.02       │ +0.27 ⬆️ │
│ TNS (ns)         │ -15.50      │ 0.00        │ +15.5 ⬆️ │
│ Setup Violations │ 47          │ 0           │ -47 ⬆️  │
│ Hold Violations  │ 0           │ 0           │ 0        │
│ DRC Violations   │ 5           │ 0           │ -5 ⬆️   │
│ Power (mW)       │ 123.4       │ 125.5       │ +2.1 ⬇️ │
│ Area (mm²)       │ 1.20        │ 1.22        │ +0.02 ⬇️│
└──────────────────┴─────────────┴─────────────┴──────────┘

Summary:
  ✓ TIMING CLEAN - WNS +0.02ns, TNS 0.0ns
  ✓ DRC CLEAN - 0 violations
  ✓ All setup violations fixed
  
Trade-offs:
  ⚠️ Power increased by 1.7%
  ⚠️ Area increased by 1.7%
  
Trend (WNS over 4 snapshots):
  📈 Consistently improving
  -0.25ns → +0.02ns (108% improvement)

Recommendation:
  Implementation successful. Ready for signoff.
```

---

## Comparison Types

### Before/After Comparison
```
compare-implementations snapshot1="baseline" snapshot2="after_fix"
```

### Checkpoint Comparison
```
compare-implementations snapshot1="pre_cts" snapshot2="post_cts"
```

### Multiple Iteration Comparison
```
compare-implementations snapshot1="iter_1" snapshot2="iter_5"
```

---

## Metrics Explained

| Metric | Good Direction | Notes |
|--------|----------------|-------|
| WNS | More positive | 0+ = timing clean |
| TNS | Closer to 0 | Sum of all negative slack |
| Setup Violations | Decrease | Must be 0 for signoff |
| Hold Violations | Decrease | Must be 0 for signoff |
| DRC Violations | Decrease | Must be 0 for signoff |
| Power | Decrease | May increase for timing |
| Area | Decrease | May increase for timing |

---

## Trend Analysis

The trend shows improvement direction:

| Trend | Meaning |
|-------|---------|
| `improving` | Consistently getting better |
| `stable` | No significant change |
| `degrading` | Getting worse - investigate |

---

## Integration with Other Skills

**After fix workflow:**
```
auto-fix-timing max_iterations=5
compare-implementations snapshot1="baseline" snapshot2="current"
```

**After flow stage:**
```
cts
compare-implementations snapshot1="pre_cts" snapshot2="post_cts"
```

**Before signoff:**
```
compare-implementations snapshot1="baseline" snapshot2="final"
track-progress
```

---

## Success Criteria

- [ ] Snapshots identified
- [ ] Comparison executed
- [ ] All metrics compared
- [ ] Improvements and regressions highlighted
- [ ] Trend analysis shown
- [ ] Summary report generated
