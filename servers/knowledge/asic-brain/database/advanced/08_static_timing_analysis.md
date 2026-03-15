---
topic: static_timing_analysis
sources:
  - https://ondevtra.com/sta.html
  - https://ondevtra.com/mcmm-optimization.html
  - https://www.icdesigntips.com/2020/12/setup-and-hold-slack-explained.html
  - https://docs.amd.com/r/en-US/ug949-vivado-design-methodology/Reviewing-Timing-Slack
---

# Static Timing Analysis (STA) Fundamentals

## Overview

Static Timing Analysis (STA) is a method of validating the timing performance of a design by checking all possible paths for timing violations without requiring simulation vectors. It is the signoff method for timing closure in modern ASIC design.

## Setup and Hold Time Definitions

| Parameter | Definition |
|-----------|------------|
| **Setup Time** | The time data must arrive and remain stable **before** the sampling clock edge |
| **Hold Time** | The time data must remain stable **after** the sampling clock edge |
| **Slack** | Timing margin indicating how much margin exists before a violation occurs |

## Slack Equations

### Setup Slack
```
Setup Slack = Required Time - Arrival Time
            = Clock Period - Setup Time - T(ck->q) - Combo Delay
```

### Hold Slack
```
Hold Slack = Arrival Time - Required Time
           = T(ck->q) + Combo Delay - Hold Time
```

A **positive slack** indicates timing is met; **negative slack** indicates a violation requiring optimization.

## Complete Slack Equations with All Factors

According to AMD/Xilinx documentation, the full slack equations including clock skew and uncertainty are:

### Setup/Recovery Slack
```
Slack = Setup Path Requirement
      - Datapath Delay (max)
      + Clock Skew
      - Clock Uncertainty
      - Setup/Recovery Time
```

### Hold/Removal Slack
```
Slack = Hold Path Requirement
      + Datapath Delay (min)
      - Clock Skew
      - Clock Uncertainty
      - Hold/Removal Time
```

Where:
- **Clock Skew** = Destination clock delay - Source clock delay (after common node)
- **Clock Uncertainty** = Accounts for jitter, skew, and modeling margins

## Multi-Corner Multi-Mode (MCMM) Analysis

### What is MCMM?

MCMM analysis models real-world operating conditions by checking timing across multiple **mode/corner combinations** (called **scenarios**):

| Aspect | Description |
|--------|-------------|
| **Modes** | Functional, Scan/Test, Low-power/Retention |
| **Corners (PVT)** | Process (SS/TT/FF), Voltage (min/nom/max), Temperature (cold/room/hot) |

### Why MCMM Matters

- **Avoids late surprises**: Prevents "fixed at TT, broken at SS/FF" scenarios
- **Coherent optimization**: Sizing and buffering decisions account for competing corners
- **Confident tapeout**: Reported WNS/TNS represent true worst cases

### Key Corners for Analysis

| Corner | Conditions | Used For |
|--------|-----------|----------|
| **SS** (Slow-Slow) | High temp, low voltage, slow process | **Setup** analysis (worst delay) |
| **FF** (Fast-Fast) | Low temp, high voltage, fast process | **Hold** analysis (best delay) |
| **TT** (Typical-Typical) | Nominal conditions | Coverage verification |

## Clock Uncertainty Impact

| Check Type | Uncertainty Effect |
|------------|------------------|
| **Setup** | `Required Time = Clock Period - (Clock Uncertainty + Setup Time)` -> Reduces available setup window |
| **Hold** | `Required Hold Time = Hold Time + Clock Uncertainty` -> Increases hold requirement |

**Example:** With 1 ns clock period and 80 ps uncertainty:
- Effective setup period = 920 ps (instead of 1 ns)
- Hold requirement increases by 80 ps

## Timing Checks Summary

| Check | Description | Violation Impact |
|-------|-------------|------------------|
| **Setup** | Data arrives before clock edge | Cannot run at target frequency |
| **Hold** | Data stable after clock edge | **Functional failure at ANY frequency** |
| **Recovery** | Async reset deasserts before clock | Metastability, functional failure |
| **Removal** | Async reset held after clock | Metastability, functional failure |
| **Min Pulse Width** | Clock pulse wide enough | Clock not captured correctly |
| **Max Transition** | Signal slew rate | Timing degradation, reliability |
| **Max Capacitance** | Load on driver | Timing degradation, reliability |

## Setup vs Hold Violation Characteristics

| Aspect | Setup Violation | Hold Violation |
|--------|-----------------|----------------|
| **Occurs at** | Slow corners (SS, high temp, low voltage) | Fast corners (FF, low temp, high voltage) |
| **Fix with** | Speed up path, reduce logic, add pipeline stages | Slow down path, add buffers |
| **Frequency** | Worsens at higher frequencies | Frequency independent |
| **Severity** | Limits max frequency | Causes functional failure |

## Timing Optimization Techniques

| Technique | Purpose |
|-----------|---------|
| **Buffer insertion/removal** | Adjust path delays |
| **Gate sizing** | Speed up or slow down paths |
| **Path restructuring** | Redesign violating paths |
| **Clock gating** | Reduce power consumption |
| **Useful skew** | Intentionally skew clocks to help timing |
| **VT swapping** | Use low-Vt cells for speed, high-Vt for leakage |

## OpenSTA Example

```tcl
# Define PVT corners
define_corner tt ss ff
read_liberty -corner tt libs/sky130_fd_sc_hd__tt_025C_1v80.lib
read_liberty -corner ss libs/sky130_fd_sc_hd__ss_125C_1v60.lib
read_liberty -corner ff libs/sky130_fd_sc_hd__ff_n40C_1v95.lib

# MCMM loop
foreach mode {func scan lp} {
  reset_path -all
  read_sdc constraints/${mode}.sdc

  foreach c {tt ss ff} {
    set_current_corner $c
    update_timing
    report_worst_slack -max  ;# Setup
    report_worst_slack -min  ;# Hold
  }
}
```

## PrimeTime Tcl Commands

```tcl
# Read design
read_verilog design.v
read_lib stdcell.lib
link_design

# Read constraints
read_sdc constraints.sdc

# Update timing
update_timing -full

# Report timing
report_timing -delay_type max -nworst 10
report_timing -delay_type min -nworst 10

# Report slack
report_constraint -all_violators
```

## Best Practices

1. **Check all corners** - Don't rely on single corner analysis
2. **Verify all modes** - Functional, scan, and low-power modes
3. **Include uncertainty** - Account for clock jitter and skew
4. **Fix hold early** - Hold violations are catastrophic
5. **Use realistic constraints** - Over-constraining wastes effort
6. **Iterate with implementation** - STA drives optimization decisions
