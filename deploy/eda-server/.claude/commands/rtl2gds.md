---
name: /rtl2gds
description: >
  DEPRECATED: Use modular stage commands instead.
  Run /synthesis, then /design-init, /floorplan, /placement, /cts, /routing, /chipfinish
---

# /rtl2gds - DEPRECATED

**This command is deprecated. Use modular stage commands instead.**

The monolithic RTL-to-GDS flow has been replaced with a modular stage-by-stage architecture using the Three-Brain system.

## New Workflow

Run each stage independently:

| Order | Command | Purpose | Tool |
|-------|---------|---------|------|
| 1 | `/synthesis` | RTL → netlist | dc_shell |
| 2 | `/design-init` | Load netlist, MMMC | innovus |
| 3 | `/floorplan` | Die area, IO placement | innovus |
| 4 | `/powerplan` | VDD/VSS rings | innovus |
| 5 | `/placement` | Cell placement | innovus |
| 6 | `/cts` | Clock tree synthesis | innovus |
| 7 | `/postcts-opt` | Post-CTS optimization | innovus |
| 8 | `/routing` | Global + detail route | innovus |
| 9 | `/routeopt` | Route optimization | innovus |
| 10 | `/chipfinish` | Filler, GDS export | innovus |

## Why Modular?

- **Checkpoint recovery**: Resume from any stage
- **Tool switching**: dc_shell for synthesis, innovus for P&R
- **Better error handling**: Per-stage diagnosis and retry
- **Three-Brain integration**: ASIC-Brain, EDA-Brain, Project-Brain collaborate per stage

## Example

```
User: "/synthesis"
HiPilot: Runs synthesis, saves checkpoint

User: "/floorplan"
HiPilot: Loads synthesis checkpoint, runs floorplan

User: "/placement"
HiPilot: Runs placement, reports WNS/TNS
```

See [AI_ASIC_COOKBOOK.md](../docs/AI_ASIC_COOKBOOK.md) for detailed stage documentation.
