# RTL2GDS Flow Guide - How to Run Real Operations

## Critical Lesson: Real Commands vs. Fake Commands

### What FAILED (Cheating - Don't Do This)

```bash
# These are FAKE - they just produce text output
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"puts STAGE_1_COMPLETE"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"report_timing"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"=== FLOW_COMPLETE ==="}'
```

**Why these fail:**
- `puts` only prints text - doesn't process design
- `report_*` only queries data - doesn't modify design
- Innovus logs show no real operations

### What WORKS (Real Operations - Do This)

```bash
# These are REAL - they actually process the design
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"init_design"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"floorPlan -site sky130hd_sites -su 1 0.7 1 1 1 1"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"placeDesign"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"create_ccopt_clock_tree -name clk"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"routeDesign"}'
bash mcp_wrapper.sh eda send_to_terminal '{"tcl":"saveDesign /path/to/design.enc"}'
```

**Why these work:**
- `init_design` loads netlist, LEF, constraints
- `floorPlan` creates die geometry
- `placeDesign` places cells
- `create_ccopt_clock_tree` builds clock network
- `routeDesign` routes all nets
- `saveDesign` saves checkpoint

## Real EDA Commands Reference

### Design Initialization

```tcl
# Set design files
set init_verilog /path/to/design.syn.v
set init_top_cell ibex_core
set init_lef_file {/path/to/tech.lef /path/to/cells.lef}
set init_mmmc_file /path/to/mmmc.view

# Initialize
init_design
```

### Floorplan

```tcl
# Create floorplan
floorPlan -site sky130hd_sites -su 1 0.7 1 1 1 1

# Or with specific dimensions
floorPlan -d 100 100 5 5 5 5
```

### Placement

```tcl
# Place standard cells
placeDesign
```

### Clock Tree Synthesis

```tcl
# Create clock tree
create_ccopt_clock_tree -name clk
ccopt_design
```

### Routing

```tcl
# Route all nets
routeDesign

# Or with options
routeDesign -globalDetail
```

### Save

```tcl
# Save checkpoint
saveDesign /path/to/design.enc
```

## Evidence of Real Execution

### In Innovus Log (innovus_main.log)

Look for:
```
Total number of combinational cells: 329    # Real cell count
Total number of sequential cells: 68        # Real cell count
*Info: initialize multi-corner CTS.         # Real CTS operation
Routing completed successfully              # Real routing
```

### In Innovus Command Log (innovus_main.cmd)

Should show:
```
init_design                    # NOT "puts STAGE_1"
floorPlan -site ...           # NOT "report_timing"
placeDesign                   # NOT "report_power"
create_ccopt_clock_tree ...   # NOT "puts COMPLETE"
routeDesign                   # Real routing command
```

## Prompt Template for RTL2GDS Flow

Use this prompt structure when asking Claude Code to run RTL2GDS:

```
Execute the Ibex RTL2GDS flow using MCP commands.

MCP wrapper: /home/EDA/hipilot/current/scripts/mcp_wrapper.sh

CRITICAL: Send REAL EDA commands, NOT puts statements.
- Use: init_design, floorPlan, placeDesign, routeDesign
- NOT: puts "STAGE_COMPLETE", report_timing (these don't modify design)

STEP 1 - Set auto mode:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'

STEP 2 - Initialize design:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"set init_verilog /path/to/design.syn.v; set init_top_cell ibex_core; set init_lef_file /path/to/lef; init_design"}'

STEP 3 - Floorplan:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"floorPlan -site sky130hd_sites -su 1 0.7 1 1 1 1"}'

STEP 4 - Place:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"placeDesign"}'

STEP 5 - CTS:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"create_ccopt_clock_tree -name clk; ccopt_design"}'

STEP 6 - Route:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"routeDesign"}'

STEP 7 - Save:
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"saveDesign /path/to/routed.enc"}'
```

## How to Verify Real Execution

1. **Check innovus_main.cmd** - Should show real commands, not puts
2. **Check innovus_main.log** - Should show cell counts, CTS info, routing status
3. **Check prompt increment** - `innovus 1>` → `innovus 10+` means many commands executed
4. **Check for real errors** - Errors like "Design must be in memory" prove commands executed

## Summary Table

| Type | Commands | Result |
|------|----------|--------|
| **FAKE** | `puts`, `report_*`, `echo` | Just text output, no design change |
| **REAL** | `init_design`, `floorPlan`, `placeDesign`, `routeDesign` | Actually processes design |

**Always use REAL commands for RTL2GDS flow.**
