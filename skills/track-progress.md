---
name: track-progress
description: >
  Capture QoR metrics and track progress over time. Shows trend analysis,
  compares to targets, and generates progress reports. Essential for
  understanding design improvement trajectory.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - qor.snapshot
    - qor.list_snapshots
    - qor.get_trend
    - qor.compare
    - context.get_context
  autonomous: false
  flow_stages: [all]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `snapshot_name` | string | `auto` | Name for this snapshot (auto = timestamp) |
| `show_trend` | boolean | `true` | Show trend analysis |
| `trend_metric` | string | `wns` | Metric for trend: `wns`, `tns`, `violations`, `power`, `area` |
| `compare_to` | string | `last` | Compare to: `last`, `baseline`, or snapshot ID |
| `generate_report` | boolean | `true` | Generate formatted progress report |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `qor.snapshot` | Capture current QoR metrics |
| `qor.list_snapshots` | List all saved snapshots |
| `qor.get_trend` | Show trend over time |
| `qor.compare` | Compare two snapshots |
| `context.get_context` | Get current design context |

---

## Workflow

### Step 1 — Get Current Context

**MCP Call:**
```
context.get_context
```

**Response:**
```
tool: innovus
stage: post_cts
qor: { wns: -0.15, tns: -5.2, violations: 12 }
```

---

### Step 2 — Capture QoR Snapshot

**MCP Call:**
```
qor.snapshot name="post_cts_opt_1" description="After CTS optimization"
```

**Response:**
```
snapshot_id: snap_1740123456789
name: post_cts_opt_1
metrics:
  wns: -0.15
  tns: -5.2
  setup_violations: 12
  hold_violations: 0
  drc_violations: 3
  total_power: 125.5mW
  cell_count: 45678
  area: 1.23mm²
```

---

### Step 3 — List Previous Snapshots

**MCP Call:**
```
qor.list_snapshots
```

**Response:**
```
snapshots:
  - snap_1740100000000: baseline (WNS: -0.25)
  - snap_1740110000000: post_place (WNS: -0.20)
  - snap_1740120000000: post_cts (WNS: -0.18)
  - snap_1740123456789: post_cts_opt_1 (WNS: -0.15)
```

---

### Step 4 — Compare to Reference

**MCP Call:**
```
qor.compare snapshot1="baseline" snapshot2="post_cts_opt_1"
```

**Response:**
```
delta:
  wns: +0.10ns (improved)
  tns: +8.3ns (improved)
  violations: -35 (improved)
  power: +2.1mW (slight increase)
improved: true
summary: "WNS improved by 0.10ns from baseline, 15 violations remaining"
```

---

### Step 5 — Show Trend

**MCP Call:**
```
qor.get_trend metric="wns" snapshots=10
```

**Response:**
```
trend: improving
data:
  - baseline: -0.25
  - post_place: -0.20
  - post_cts: -0.18
  - post_cts_opt_1: -0.15
summary: "Consistent improvement over 4 snapshots (+0.10ns total)"
```

---

## Example Output

```
📊 HiPilot Progress Report — 2026-02-23 16:30

Current Context:
  Tool: Innovus
  Stage: post_cts
  Design: ibex_core

QoR Snapshot: post_cts_opt_1
┌─────────────┬───────────┐
│ Metric      │ Value     │
├─────────────┼───────────┤
│ WNS         │ -0.15ns   │
│ TNS         │ -5.2ns    │
│ Setup Viol. │ 12        │
│ Hold Viol.  │ 0         │
│ DRC Viol.   │ 3         │
│ Power       │ 125.5mW   │
│ Area        │ 1.23mm²   │
└─────────────┴───────────┘

Comparison to Baseline:
  WNS: +0.10ns improved ⬆️
  TNS: +8.3ns improved ⬆️
  Violations: -35 ⬆️

Trend Analysis (WNS over 4 snapshots):
  📈 Improving consistently
  From -0.25ns → -0.15ns (+40% improvement)

Progress to Target (WNS >= 0):
  Current: -0.15ns
  Remaining: 0.15ns
  At current rate: ~2 more iterations

Recommendation:
  Continue with setup timing fixes. On track to close timing.
```

---

## Usage

**Quick Check:**
```
track-progress
```

**Detailed Analysis:**
```
track-progress snapshot_name="after_eco" compare_to="baseline" show_trend=true
```

**Specific Metric Trend:**
```
track-progress trend_metric="power" show_trend=true
```

---

## Integration with Other Skills

This skill is typically used:
- Before and after `fix-setup-timing` / `fix-hold-timing`
- After each flow stage (`cts`, `route-design`, etc.)
- Before ECO iterations
- At design checkpoints

---

## Success Criteria

- [ ] QoR snapshot captured successfully
- [ ] Comparison to reference snapshot shown
- [ ] Trend analysis displayed (if enabled)
- [ ] Clear progress report generated
- [ ] Recommendations provided
