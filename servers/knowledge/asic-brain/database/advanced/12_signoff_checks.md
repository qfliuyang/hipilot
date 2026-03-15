---
topic: signoff_checks
sources:
  - https://chipxpert.in/physical-design-flow-in-vlsi-from-netlist-to-gdsii/
  - https://vlsigensys.com/the-vlsi-physical-design-journey-mapping-a-netlist-to-a-silicon-ready-gdsii/
---

# Signoff Checks: DRC, LVS, Antenna, and Final Verification

## Overview

Physical verification and signoff checks ensure that the design can be manufactured correctly and matches the intended functionality. These checks must pass 100% before tape-out.

## Design Rule Check (DRC)

### Purpose
Ensures the layout follows foundry manufacturing rules. Each process node has specific rules for:
- Minimum widths and spacings
- Via and contact rules
- Density requirements
- Antenna rules

### Common DRC Checks

| Check | Description |
|-------|-------------|
| **Width** | Minimum feature width for each layer |
| **Spacing** | Minimum distance between features |
| **Enclosure** | Overlap requirements for vias/contacts |
| **Notch** | Minimum width of notches in shapes |
| **Area** | Minimum area for polygons |
| **Density** | Metal density for CMP uniformity |

### DRC Tools
- Siemens Calibre
- Synopsys IC Validator
- Cadence Pegasus

## Layout vs. Schematic (LVS)

### Purpose
Ensures the layout matches the gate-level netlist (schematic). Verifies:
- Net connectivity
- Device matching
- Parameter verification

### LVS Process
1. Extract netlist from layout
2. Compare with reference netlist
3. Report mismatches (missing/extra devices, incorrect connections)
4. Iterate until clean

### Common LVS Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| Open nets | Missing connections | Fix routing |
| Shorted nets | Unintended connections | Fix routing |
| Missing devices | Cells not placed | Add missing cells |
| Extra devices | Unintended placements | Remove extra cells |

## Electrical Rule Check (ERC)

### Purpose
Checks for electrical issues that could cause functional problems:
- Floating gates (unconnected inputs)
- Floating wells (missing well taps)
- Antenna violations
- Max via current violations

### ERC Checks

| Check | Description |
|-------|-------------|
| **Floating Gates** | Unconnected transistor gates |
| **Floating Wells** | Unconnected well regions |
| **Antenna** | Charge accumulation on metal |
| **Via Current** | Current density in vias |

## Antenna Check

### Problem
During plasma etching, long metal wires can accumulate charge and damage transistor gates.

### Antenna Ratio
```
Antenna Ratio = Metal Area / Gate Area
```

Must be less than maximum allowed ratio (technology dependent, typically ~100-500).

### Solutions
| Solution | Implementation |
|----------|---------------|
| **Antenna Diodes** | Add diodes to discharge accumulated charge |
| **Jumper Insertion** | Break long metal runs by jumping to higher layer |
| **Layer Hopping** | Distribute metal across multiple layers |

## IR Drop and Electromigration (EM)

### IR Drop Analysis
- Calculates voltage drop in power grid
- Target: < 10% of VDD for static IR drop
- Tools: Ansys RedHawk, Cadence Voltus

### Electromigration Analysis
- Checks current density in wires and vias
- Ensures long-term reliability
- Based on EM rules in technology file

## Signoff Flow

```
1. Complete Physical Design
        |
        v
2. Run DRC -> Fix violations -> Re-run
        |
        v
3. Run LVS -> Fix mismatches -> Re-run
        |
        v
4. Run ERC -> Fix issues -> Re-run
        |
        v
5. Run Antenna Check -> Fix violations -> Re-run
        |
        v
6. Run IR Drop/EM Analysis -> Fix if needed
        |
        v
7. Final STA Signoff
        |
        v
8. GDSII Generation
```

## Signoff Tcl Commands (Calibre)

```tcl
# DRC Run
run_drc -deck drc_rules.svrf -design top.gds

# LVS Run
run_lvs -deck lvs_rules.svrf \
        -layout top.gds \
        -source top.spice

# ERC Run
run_erc -deck erc_rules.svrf -design top.gds

# Antenna Check
run_antenna -deck antenna_rules.svrf -design top.gds
```

## Signoff Quality Metrics

| Check | Target | Criticality |
|-------|--------|-------------|
| DRC | 0 violations | Critical |
| LVS | Clean (no mismatches) | Critical |
| ERC | 0 violations | Critical |
| Antenna | 0 violations | Critical |
| IR Drop | < 10% of VDD | High |
| EM | 0 violations | High |

## Best Practices

1. **Run checks early** - Don't wait until the end
2. **Fix systematically** - Address all violations of same type together
3. **Understand waivers** - Some violations may be waivable with foundry approval
4. **Document exceptions** - Keep record of any waived violations
5. **Use foundry rules** - Always use latest rule deck from foundry
6. **Iterate carefully** - One fix can introduce new violations

## Final Tape-Out Checklist

- [ ] DRC clean (0 violations)
- [ ] LVS clean (exact match)
- [ ] ERC clean (0 violations)
- [ ] Antenna clean (0 violations)
- [ ] IR drop within spec (< 10% VDD)
- [ ] EM clean (0 violations)
- [ ] STA signoff (all corners, all modes)
- [ ] Metal fill inserted
- [ ] GDSII generated and validated
- [ ] Documentation complete
