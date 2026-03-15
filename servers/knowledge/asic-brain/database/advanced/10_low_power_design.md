---
topic: low_power_design
sources:
  - https://www.synopsys.com/glossary/what-is-low-power-design.html
  - https://telecomtrainingpro.com/what-is-dvfs-dynamic-voltage-and-frequency-scaling/
  - https://thetechylife.com/what-is-dvfs-in-vlsi/
  - https://imanagerpublications.com/assets/htmlfiles/JCIR()6032.html
  - https://islped.org/X2008/Jairam.pdf
---

# Low Power Design Techniques

## Overview

Low power design is essential for modern ASICs, driven by requirements for battery-operated devices, thermal management, and energy efficiency in data centers. Power consumption consists of dynamic power (switching) and static power (leakage).

## Clock Gating (CG)

**Purpose**: Reduces dynamic power by halting clock signals to inactive circuit sections.

**Implementation**: Uses specialized clock-gating cells (latch-based preferred over AND/NOR gates to avoid glitches).

**Power Savings**: Up to **50%** reduction in dynamic power; can reduce total dynamic consumption by ~40% in clock networks.

**Types**:
- **Combinational/Structural CG**: Applied during synthesis (e.g., MFL - Multi-Flop Latch)
- **Sequential CG**: Applied at RTL design stage
- **Medium-grained CG**: Global/regional clock buffer control

**Best Practice**: Implement close to clock distribution roots, limited by enable signal timing feasibility.

## Power Gating

**Purpose**: Eliminates leakage power by completely disconnecting power to idle blocks.

**Implementation**: Uses sleep transistors (header/footer switches) between supply rails and circuit blocks.

**Power Savings**: Can reduce leakage by **>50%** to **20X** with ~10% area overhead.

**Types**:
- **Fine-grain**: Switch inside each standard cell (high area overhead)
- **Coarse-grain**: Block-level switching (preferred for ASICs)
- **Sleep/Drowsy modes**: Data retention vs. maximum power saving trade-offs

**Requirements**:
- Isolation gates to prevent floating outputs
- Power state definitions
- Power management unit (PMU) with correct signal sequencing

## Retention with Power Gating

Saves flop values before shutdown using retention flops, enabling quick state restoration.

- Adds SAVE/RESTORE signals to PMU control sequences
- Retention flops have separate always-on supply
- Enables fast wake-up with state preservation

## Multi-Voltage (Multi-VDD / MSV)

**Purpose**: Reduces both dynamic and static power by operating different blocks at optimal voltages.

**Implementation**: Voltage islands with level shifters for cross-domain communication.

**Strategies**:
- **Static Voltage Scaling (SVS)**: Fixed different voltages per block
- **Multi-level Voltage Scaling (MVS)**: Switching between few discrete voltage levels
- **Dynamic Voltage and Frequency Scaling (DVFS)**: Continuous adaptation

**Requirements**:
- Level shifter cells for voltage crossings
- Isolation cells for power-gated domains
- Multi-corner timing analysis

## DVFS (Dynamic Voltage and Frequency Scaling)

**Purpose**: Real-time adaptation of voltage/frequency based on workload.

**Power Savings**: **40-70%** dynamic power improvement; **2-3X** leakage reduction.

**Key Concepts**:
- Voltage scaling (undervolting) exploits quadratic V^2 relationship with power
- Frequency scaling reduces switching activity
- **AVFS (Adaptive VFS)**: Closed-loop control compensating for PVT variations

**Implementation Requirements**:
- Power domains with switchable supplies
- Power management unit (PMU)
- EDA tool support for multi-corner optimization
- Voltage regulators with fast response

## Power Optimization Summary

| Technique | Target Power | Typical Savings | Complexity |
|-----------|-----------|-----------------|------------|
| Clock Gating | Dynamic | 40-50% | Low |
| Power Gating | Leakage | 50-95% | Medium |
| Multi-Voltage | Both | 30-50% | Medium |
| DVFS | Both | 40-70% | High |

## Unified Power Format (UPF/CPF)

UPF/CPF enables specification of power intent across RTL-to-GDSII flow:
- Power domain definitions
- Level shifter & isolation cell insertion
- Retention register implementation
- Power state management

## Low Power Design Flow

```
1. Power Intent Specification (UPF)
        |
        v
2. RTL Design with Clock Gating
        |
        v
3. Synthesis with Power Optimization
        |
        v
4. Physical Implementation with Power Domains
        |
        v
5. Verification (Functional, Timing, Power)
```

## Tcl Commands for Low Power (UPF)

```tcl
# Create power domains
create_power_domain PD_CORE -elements {core_inst}
create_power_domain PD_CPU -elements {cpu_inst}

# Define supply nets
create_supply_net VDD -domain PD_CORE
create_supply_net VDD_LOW -domain PD_CPU

# Create power switches
create_power_switch SW_CPU \
    -domain PD_CPU \
    -input_supply_port {VIN VDD} \
    -output_supply_port {VOUT VDD_CPU}

# Define isolation strategy
set_isolation ISO_CPU \
    -domain PD_CPU \
    -isolation_signal {iso_en} \
    -location self

# Define retention strategy
set_retention RET_CPU \
    -domain PD_CPU \
    -retention_signal {ret_en} \
    -save_signal {save_en high} \
    -restore_signal {restore_en high}
```

## Best Practices

1. **Start with architecture** - Partition design by power domains early
2. **Use clock gating extensively** - Lowest overhead, highest impact
3. **Plan power gating carefully** - Consider wake-up latency and state retention
4. **Verify power sequences** - Ensure correct power-up/down ordering
5. **Analyze all corners** - Multi-voltage requires multi-corner analysis
6. **Consider thermal** - Power and thermal are closely coupled
