---
title: Synthesis
stage: 0
tool: dc_shell / genus
prerequisites:
  - RTL files (Verilog/SystemVerilog/VHDL)
  - Technology libraries (.db or .lib)
  - Constraint file (SDC)
next_stage: design-init
qor_metrics: [WNS, TNS, Area, Cell_Count, Leakage_Power, Dynamic_Power]
risk_level: moderate
duration: 5-30 minutes
---

# Synthesis (Stage 0)

RTL synthesis with Design Compiler or Genus. Produces gate-level netlist ready for place & route.

## Quick Reference

```
Input: RTL + SDC + Libraries
Output: Netlist + DDC + SDC
Tool: dc_shell (Synopsys) or genus (Cadence)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [dc-commands.md](./dc-commands.md) - Design Compiler commands
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Design Compiler Flow

1. **Environment Setup** - Library paths, search_path
2. **Read Design** - analyze, elaborate, link
3. **Apply Constraints** - read_sdc or define constraints
4. **Compile** - compile_ultra with options
5. **Reports** - timing, area, power
6. **Outputs** - netlist, DDC, SDC

### Genus Flow

1. **Library Setup** - init_lib_search_path
2. **Read Design** - read_hdl, elaborate
3. **Constraints** - read_sdc
4. **Synthesize** - synthesize -to_mapped
5. **Reports** - timing, area, power
6. **Outputs** - netlist, SDC

## Key Concepts

### Topographical Mode (DC)

```tcl
# Better correlation with P&R results
dc_shell-topo
```

### Compile Strategies

| Strategy | Command | Use Case |
|----------|---------|----------|
| Timing-driven | `compile_ultra -timing_effort high` | Tight timing |
| Area-optimized | `compile_ultra -area_effort high` | Area constrained |
| Balanced | `compile_ultra` | Default |
| Low power | `compile_ultra -gate_clock` | Power sensitive |

### QoR Targets

| Metric | Good | Acceptable | Action Required |
|--------|------|------------|-----------------|
| WNS | > 0 | > -10% clock | Re-optimize if < -10% |
| TNS | 0 | < 100ns | Check individual paths |
| Area Util | < 70% | 70-85% | Reduce if > 85% |

## Prerequisites Detail

### Library Setup for Skywater 130nm

```tcl
set search_path [list ./rtl ./scripts ./constraints \
    /path/to/pdk/lib]

set target_library "sky130_fd_sc_hd__tt_025C_1v80.db"
set link_library "* sky130_fd_sc_hd__tt_025C_1v80.db"
```

### PATH Setup (CRITICAL)

```bash
export PATH=/opt/synopsys/syn_2022.03/bin:$PATH
```

## Next Stage

After synthesis completes successfully, proceed to [Design Init](../design-init/INDEX.md).

Required outputs for next stage:
- Synthesized netlist (`.v` or `.vg`)
- SDC constraints file
- Optional: DDC database for DC
