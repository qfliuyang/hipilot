---
name: report-power
description: >
  Generate and interpret power analysis reports at any flow stage. Covers
  static (leakage) and dynamic (switching + internal) power, activity-based
  analysis from VCD or SAIF files, comparison against a power budget, and
  identification of top power contributors. Works in ICC2, Innovus, and
  PrimeTime PX for signoff. Helps identify over-budget blocks before tapeout.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    synopsys_pt: "pt_shell T-2022.03+ (with PrimePower)"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_report_power.tcl
    cadence: templates/cadence/innovus_report_power.tcl
  auto_generated: false
  flexible: true
  flow_stages: [post_place, post_cts, post_route, signoff]
  report_inputs:
    - switching activity file (VCD or SAIF, optional)
    - SDC constraints (for clock frequencies)
    - liberty files (for leakage values)
  qor_metrics: [total_power, leakage_power, dynamic_power, switching_power]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `analysis_effort` | string | `medium` | `low` (fast estimate), `medium` (standard), `high` (full vectorless + activity propagation). |
| `switching_activity_file` | string | `""` | Path to VCD or SAIF file. Empty = use vectorless estimation (default toggle rates). |
| `power_budget` | float | `0.0` | Total power budget in milliwatts. 0 = no budget check. Set to flag over-budget warning. |
| `hierarchy_depth` | integer | `3` | Levels of hierarchy to report. 1 = top-level only; 0 = unlimited (very verbose). |
| `corner` | string | `func_tt_25c` | Analysis corner for power. Typical = TT/25C for dynamic; SS/125C for leakage worst-case. |
| `report_path` | string | `./reports/power.rpt` | File path for the power report output. |
| `show_top_n` | integer | `10` | Number of highest power instances to list in the summary. |

---

## Workflow

### Step 1 — Choose analysis mode: vectorless vs activity-based

Power analysis accuracy depends heavily on whether real switching activity
is available.

| Mode | Input | Accuracy | When to use |
|------|-------|----------|-------------|
| **Vectorless** | Clock period only | ±30% | Early estimation, pre-silicon planning |
| **Default toggle rate** | Clock + default 0.2 toggle rate | ±20% | Post-place sanity check |
| **SAIF-based** | SAIF from gate-level simulation | ±10% | Post-route sign-off |
| **VCD-based** | VCD from RTL or gate-level sim | ±5% | Final signoff, power validation |

If a SAIF or VCD file is available, always use it. If not, run vectorless with
a default toggle rate of 0.2 (reasonable for most digital logic).

---

### Step 2 — Set up switching activity

**ICC2 — read SAIF:**
```tcl
# Read switching activity from gate-level simulation
read_saif \
    -input ${switching_activity_file} \
    -instance_name u_dut \
    -auto_map_names

# Verify that activity was matched
report_saif -missing_nets
```

**ICC2 — vectorless (no SAIF):**
```tcl
# Set default toggle rate for all nets
set_switching_activity -default_toggle_rate 0.2 \
                       -default_static_probability 0.5 \
                       -period [expr 1.0 / $clock_freq_ghz]
```

**Innovus — read SAIF:**
```tcl
readSaif \
    -input ${switching_activity_file} \
    -scope u_dut
```

**Innovus — vectorless:**
```tcl
# Set toggle rate for all nets (toggles per clock period)
setDontUse false
setPowerAnalysisMode -reset
setPowerAnalysisMode \
    -analysisType averagePower \
    -toggleRate 0.2 \
    -staticProbability 0.5
```

---

### Step 3 — Run power analysis

**ICC2:**
```tcl
# Compute power for all scenarios or a specific corner
set_scenario_status func_tt_25c -active true

update_power

report_power \
    -hierarchy \
    -levels ${hierarchy_depth} \
    -corner ${corner} \
    -verbose \
    > ${report_path}
```

**ICC2 — leakage worst case (SS, 125C):**
```tcl
report_power \
    -analysis_effort ${analysis_effort} \
    -leakage \
    -corner func_ss_125c \
    > ${report_path}.leakage
```

**Innovus:**
```tcl
# Run power analysis pass
powerAnalysis \
    -analysisType averagePower \
    -effortLevel ${analysis_effort}

# Report hierarchical power
report_power \
    -hierarchy \
    -outfile ${report_path}
```

**PrimeTime PX (signoff):**
```tcl
# In pt_shell with PrimePower enabled
set_app_var power_enable_analysis true
set_app_var power_analysis_mode time_based

update_power
report_power \
    -hierarchy \
    -levels ${hierarchy_depth} \
    -nosplit \
    > ${report_path}
```

---

### Step 4 — Extract key metrics from the report

A typical ICC2/Innovus power report section looks like:

```
-------------------------------------------------------------------
                  Leakage     Internal   Switching       Total
                     (mW)        (mW)       (mW)          (mW)
-------------------------------------------------------------------
u_core               0.312       4.231      2.847         7.390
  u_alu              0.089       1.203      0.912         2.204
  u_regfile          0.041       0.987      0.501         1.529
  u_ctrl             0.012       0.231      0.188         0.431
  u_mem_if           0.170       1.810      1.246         3.226
-------------------------------------------------------------------
Total chip           0.312       4.231      2.847         7.390
-------------------------------------------------------------------
```

AI will parse and extract:
- **Total power** (sum of leakage + internal + switching)
- **Leakage fraction** (leakage / total — high fraction = power gating opportunity)
- **Top N power consumers** by instance
- **Budget comparison** if `power_budget` is set

---

### Step 5 — Compare against power budget

If `power_budget > 0`, compare extracted total against the budget:

```
Power Budget Check
─────────────────────────────────────────
  Budget:        10.00 mW
  Measured:       7.39 mW   ✓ UNDER BUDGET
  Margin:         2.61 mW  (26.1% headroom)

  Leakage:        0.31 mW  (4.2% of total)
  Dynamic:        7.08 mW  (95.8% of total)
─────────────────────────────────────────
```

If over budget:
1. List the top power contributors (Step 6).
2. Check if activity file is accurate — over-estimated toggle rates inflate
   dynamic power significantly.
3. Investigate clock gating coverage (Step 7).

---

### Step 6 — Identify top power contributors

**ICC2:**
```tcl
# Top N power instances
report_power \
    -hierarchy \
    -levels 4 \
    -sort_by total_power \
    -max_instances ${show_top_n} \
    > ${report_path}.top_consumers
```

**Innovus:**
```tcl
# Sort by power consumption
report_power \
    -hierarchy \
    -sort total \
    -outfile ${report_path}.top_consumers
```

AI will interpret the list and identify:
- Large memories or SRAMs (typically 30–60% of total power — normal)
- Unbalanced high-activity datapaths (potential for micro-architecture change)
- Clock tree power (if >15% of total, CTS is under-buffered or over-clocked)
- Combinational logic with very high toggle rate (may indicate glitching)

---

### Step 7 — Check clock gating coverage

Clock gating is the single most effective power reduction technique for
sequential logic. Poor clock gating can waste 20–40% of dynamic power.

**ICC2:**
```tcl
# Report clock gating coverage
report_clock_gating \
    -verbose \
    > ${report_path}.clock_gating

# Check which registers are NOT clock-gated
report_clock_gating -ungated
```

**Innovus:**
```tcl
# Check clock gating
report_power -clockGating
```

If ungated register count is high (>30% of total flops), this is a significant
power reduction opportunity. Flag for RTL-level clock gating insertion.

---

### Step 8 — Save report and log QoR

```tcl
# ICC2: archive the power report
file copy -force ${report_path} \
    ./reports/power_${flow_stage}_${corner}.rpt

# Log the headline numbers (for QoR tracking)
set total_pw [get_attribute [current_design] total_power]
echo "QoR: total_power=${total_pw} corner=${corner} stage=${flow_stage}"
```

---

## Core Principles

1. **Power analysis without activity is an estimate, not a measurement.**
   Vectorless analysis can be off by 2-3x in power-hungry paths. For signoff,
   always use SAIF from gate simulation that covers representative workloads.

2. **Leakage is a corner choice; dynamic is a workload choice.** Report leakage
   at the worst-case leakage corner (SS, 125C). Report dynamic at the
   workload-representative corner (TT, 25C or the operating corner).

3. **SRAM power is often the largest contributor — and hardest to fix.**
   If memories dominate, investigate memory power modes (low-power standby,
   read/write port gating) at the IP level. RTL-level clock gating on memory
   enable signals is the most practical lever.

4. **Clock tree power scales with buffer count, not just frequency.**
   If the design is over-buffered post-CTS, clock power is inflated. Check
   `report_clock_timing -type transition` — if average slew is well below
   the maximum, the tree is over-buffered.

5. **Glitching inflates dynamic power.** If a datapath shows dynamic power
   far in excess of its logical activity rate, it may be glitching (logic
   transitions that do not propagate to the output). Balance logic depths
   or add isolation cells.

6. **Power results are only as good as the liberty files.** If the liberty
   cell power values have not been characterized for the operating voltage,
   the report is inaccurate. Confirm the liberty file voltage matches the
   supply in your design.

---

## What Can Go Wrong

- **`read_saif` matches 0 nets.** Check the instance scope name. The SAIF
  scope path must match the RTL hierarchy exactly. Use `-auto_map_names` and
  check `report_saif -missing_nets` for unmatched signals.
- **Total power reads as zero.** Power analysis was not run before reporting.
  Call `update_power` (ICC2) or `powerAnalysis` (Innovus) first.
- **Leakage values seem wrong.** Verify the liberty file being used has power
  tables (look for `leakage_power()` groups in the `.lib`). If missing,
  the tool uses defaults which may be wildly inaccurate.
- **Report shows power for only part of the design.** If hierarchy_depth is
  too shallow, nested modules are rolled up and you cannot see their
  individual contribution. Increase `hierarchy_depth` to 4 or 5.
- **SAIF-based power is much higher than vectorless.** This usually means the
  simulation vectors cover a high-activity scenario (e.g. sustained memory
  burst). Verify the simulation workload is representative of the real use case,
  not a stress test.

---

## Example Usage

```
/report-power

# or with parameters:
/report-power corner=func_tt_25c power_budget=10.0 show_top_n=15
/report-power switching_activity_file=./sim/ibex_dhrystone.saif analysis_effort=high
/report-power hierarchy_depth=5 report_path=./reports/power_signoff.rpt
```

**Typical session dialogue:**

> "Can you check our power? We have a 10 mW budget and I'm worried we're close."

HiPilot will:
1. Check if a SAIF file is available (ask if not found automatically)
2. Run `report_power` at the TT/25C corner
3. Extract total, leakage, and dynamic power numbers
4. Compare against the 10 mW budget and display margin
5. List the top 10 power consumers with percentage breakdown
6. Identify the largest opportunity (e.g. "u_mem_if uses 43% of power —
   check clock gating on memory enable signals")

---

## Lessons Learned (from real tapeout experience)

- On sky130hd at 100 MHz, total power for a small core (Ibex-class, ~20K cells)
  is typically 5–15 mW. If you see numbers much higher, check that the toggle
  rate is not set to 1.0 (100%) which is unrealistic.
- Innovus `powerAnalysis` with `-effortLevel high` can take 10–30 minutes on a
  full chip. Use `medium` for iterative checks and `high` only for the final
  signoff run.
- PrimeTime PX with VCD produces the most accurate results but requires
  importing parasitics (SPEF/RCDB). If SPEF is not available, PT PX will
  fall back to ideal wire capacitance — acceptable for early estimates.
- Clock gating coverage on the Ibex core is approximately 60%. Adding
  RTL-level clock enables on the register file read ports can reduce dynamic
  power by 15–20% in compute-bound workloads.
