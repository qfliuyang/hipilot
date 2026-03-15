---
topic: synthesis_optimization
sources:
  - https://picture.iczhiku.com/resource/eetop/SHidRGQWtQruovNN.pdf
  - https://picture.iczhiku.com/resource/eetop/WhIeRlYLJdqZWVmm.pdf
  - https://iccircle.com/static/upload/img20240711111615.pdf
  - https://knowledge-for-everyone.info/comprehensive-guide-to-asic-design-using-synopsys-design-compiler/
---

# Synthesis Deep Dive: Design Compiler Optimization

## Overview of compile_ultra

The `compile_ultra` command is Synopsys' **push-button solution for timing-critical, high-performance designs**. It encapsulates DC Ultra strategies into a single command and requires:
- DC Ultra license
- DesignWare Foundation license

## Key compile_ultra Optimization Features

| Feature | Description |
|---------|-------------|
| **Topographical Technology** | Accurate prediction of post-layout timing, area, and power without wireload models |
| **Automatic Boundary Optimization** | Optimizes across hierarchical boundaries by default |
| **Automatic Ungrouping** | Two strategies: delay-based and area-based auto-ungrouping |
| **Aggressive Logic Duplication** | Replicates gates to isolate load on critical paths |
| **Library-Aware Mapping** | Uses ALIB pseudolibrary for better area/delay tradeoffs |
| **Datapath Extraction** | Transforms arithmetic operators into optimized datapath blocks |
| **Adaptive Retiming** | Local retiming moves to improve WNS (with `-retime` option) |

## Automatic Ungrouping Strategies

### 1. Delay-Based Auto-Ungrouping (default with compile_ultra)
- Ungroups hierarchies along the **critical path**
- Used primarily for **timing optimization**
- Can be disabled with `-no_autoungroup`

### 2. Area-Based Auto-Ungrouping
- Removes small subdesigns before initial mapping
- Threshold: 30 child cells (configurable via `compile_auto_ungroup_area_num_cells`)
- Improves both timing and area QoR

## Path Groups and Critical Path Management

### Creating Path Groups

```tcl
group_path -name <group_name> -from <start_points> -to <end_points>
```

Path groups allow you to:
- Organize optimization by criticality
- Apply different constraints to different path categories
- Control optimization effort per path group

### Optimizing Near-Critical Paths

| Technique | Command/Method | Purpose |
|-----------|--------------|---------|
| **Critical Range** | `set_critical_range <value> [current_design]` | Optimize paths within specified range of critical path |
| **High-Effort Script** | `compile_ultra -timing_high_effort_script` | Advanced timing optimization strategies |
| **Area High-Effort** | `compile_ultra -area_high_effort_script` | Area-focused optimization |

## Delay Optimization Strategies

To achieve faster designs with compile_ultra:

1. **Use `compile_ultra` directly** - enables delay-based auto-ungrouping by default
2. **Apply `-timing_high_effort_script`** - includes multiple timing improvement strategies
3. **Set critical range** - optimize near-critical paths, not just the worst path
4. **Enable boundary optimization** - optimize across hierarchical boundaries
5. **Fix heavily loaded nets** - use `balance_buffer` or design rule fixing
6. **Set cost priority** - `set_cost_priority -delay` (for design exploration)

## Area Optimization Strategies

| Strategy | Implementation |
|----------|---------------|
| Area-based auto-ungrouping | `compile_ultra` (automatic) or `compile -auto_ungroup area` |
| Disable TNS optimization | `set_max_area -ignore_tns` |
| Area high-effort script | `compile_ultra -area_high_effort_script` |
| Boundary optimization | Enabled by default in compile_ultra |

## Important Incompatibilities

The `compile_ultra -top` option is **incompatible** with:
- `-incremental`
- `-timing_high_effort_script`
- `-area_high_effort_script`

## Recommended Optimization Flow

```
1. Initial compile with compile_ultra
   -> Enables all default optimizations

2. If timing not met:
   -> compile_ultra -timing_high_effort_script

3. If area needs improvement:
   -> compile_ultra -area_high_effort_script

4. For incremental improvements:
   -> compile_ultra -incremental (after initial compile_ultra)
```

## Key Variables and Controls

| Variable | Default | Purpose |
|----------|---------|---------|
| `compile_auto_ungroup_area_num_cells` | 30 | Threshold for area-based ungrouping |
| `compile_auto_ungroup_count_leaf_cells` | false | Count leaf cells recursively |
| `compile_ultra_ungroup_dw` | true | Ungroup DesignWare hierarchies |
| `compile_seqmap_propagate_high_effort` | true | Remove redundant registers |
| `compile_top_all_paths` | false | Fix all paths with -top option |

## Constraint Optimization

### Critical Path Focus
- Use `group_path` to isolate critical paths
- Apply `set_critical_range` to optimize near-critical paths
- Consider `set_cost_priority` to balance timing vs. area

### Path Group Examples

```tcl
# Group I/O paths
group_path -name INPUTS -from [all_inputs]
group_path -name OUTPUTS -to [all_outputs]

# Group clock domains
group_path -name CLK_DOMAIN_1 -from [get_clocks clk1]
group_path -name CLK_DOMAIN_2 -from [get_clocks clk2]

# Set critical range for near-critical optimization
set_critical_range 0.5 [current_design]
```

## DFT Scan Insertion Methodology

### Pre-Synthesis Considerations
- Plan scan architecture early
- Determine scan style (multiplexed flip-flop, clocked scan, LSSD)
- Define scan chain count based on pin availability

### Scan Insertion Flow

```tcl
# 1. Define test protocol
set_dft_configuration -scan_enable enable_signal

# 2. Configure scan chains
set_scan_configuration -chain_count 8 \
                       -clock_mixing mix_clocks

# 3. Preview scan architecture
create_test_protocol -infer_clock -infer_async
preview_dft -show scan_summary

# 4. Insert scan chains
insert_dft

# 5. Verify test protocol
dft_drc
```

### Scan Optimization
- Balance scan chain lengths for even test time
- Consider lock-up latches for clock domain crossings
- Use scan compression for large designs
- Analyze coverage with ATPG tools

## Best Practices

1. **Start with clean RTL** - No latches, no combinational loops
2. **Use realistic constraints** - Don't over-constrain initially
3. **Apply physical constraints** - Floorplan awareness for better QoR
4. **Iterate strategically** - Major changes early, incremental later
5. **Verify equivalence** - Use Formality after each major compile
6. **Analyze reports** - Check timing, area, power, DRC violations
