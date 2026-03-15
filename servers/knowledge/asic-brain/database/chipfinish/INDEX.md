---
title: Chip Finish
stage: 9
tool: innovus / icc2_shell
prerequisites:
  - Routing completed
  - Timing optimized
  - DRC clean (or acceptable)
next_stage: null
qor_metrics: [DEF_Size, GDS_Size, Netlist_Cells]
risk_level: low
duration: 2-10 minutes
---

# Chip Finish (Stage 9)

Final chip finishing and output generation. Covers DEF/GDS export,
netlist generation, and final verification.

## Quick Reference

```
Input: Routed and optimized design
Output: GDS, DEF, Netlist, SPEF
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Chip Finish Workflow

1. **Final Cleanup** - Remove assigns, dangling nets
2. **Final Verification** - Check connectivity
3. **Export DEF** - Layout exchange format
4. **Export Netlists** - Verilog for LVS, simulation
5. **Export GDS** - Mask layout data
6. **Export SPEF** - Parasitics for STA
7. **Generate Reports** - Final QoR

### Output Files

#### DEF Files

| File | Purpose |
|------|---------|
| `design_routing.def` | Full design with routing |
| `design_final.def` | Final signoff DEF |

#### Verilog Netlists

| File | Purpose |
|------|---------|
| `design_routing.vg` | Gate-level with power |
| `design_lvs.vg` | LVS netlist |
| `design_func.v` | Functional simulation |

#### GDS Files

| File | Purpose |
|------|---------|
| `design_core.gds` | Layout for verification |
| `design_core_merged.gds` | Merged with standard cells |

## GDS Map File

The GDS map file maps layer names to GDS layer numbers.

```tcl
# Typical Skywater 130nm GDS map
# li1    -> 66:20
# met1   -> 68:20
# met2   -> 69:20
# met3   -> 70:20
# met4   -> 71:20
# met5   -> 72:20
```

## Final Stage

This is the final stage of the RTL2GDS flow. Outputs are ready for:
- Physical verification (DRC, LVS)
- Signoff STA
- Tape-out
