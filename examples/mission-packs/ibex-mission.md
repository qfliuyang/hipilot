# Mission Pack: Ibex RISC-V Core

## Project Overview

I want to implement a physical design flow for the **Ibex RISC-V Core** using the **Skywater 130nm PDK**. This is a 32-bit RISC-V CPU with approximately 7000 cells. The target frequency is 100 MHz.

## Design Files

### RTL Source
The RTL is written in SystemVerilog. The top module is `ibex_core`. Here are the source files I need:

- `rtl/ibex_core.sv` - Top level core
- `rtl/ibex_alu.sv` - ALU
- `rtl/ibex_decoder.sv` - Instruction decoder
- `rtl/ibex_id_stage.sv` - Instruction decode stage
- `rtl/ibex_if_stage.sv` - Instruction fetch stage
- `rtl/ibex_ex_block.sv` - Execution block
- `rtl/ibex_load_store_unit.sv` - Load/store unit
- `rtl/ibex_register_file_ff.sv` - Register file
- `rtl/ibex_cs_registers.sv` - Control/status registers
- Plus other supporting modules...

Use `SYNTHESIS` define during synthesis.

### Constraints
Timing constraints are in: `constraints/ibex_core.sdc`

### Libraries
- **Tech LEF**: `lef/sky130_fd_sc_hd.tlef` (must be first!)
- **Cell LEF**: `lef/sky130_fd_sc_hd.lef`
- **Liberty**: `lib/sky130_fd_sc_hd__tt_025C_1v80.lib` (typical corner)
- **GDS**: `gds/sky130_fd_sc_hd.gds`

## Technology Setup

- **Process**: Skywater 130nm (sky130)
- **Voltage**: 1.8V
- **Temperature**: 25°C typical
- **Metal layers**: 6 layers (li1, met1-met5)

## Flow Requirements

Run the full RTL-to-GDS flow:

1. **Synthesis** with Design Compiler - enable DFT scan insertion
2. **Design Init** in Innovus - load the synthesized netlist
3. **Floorplan** - target 68% core utilization, die area around 450x450 microns
4. **Power Planning** - build VDD/VSS rings and stripes
5. **Placement** - timing-driven placement
6. **CTS** - clock tree synthesis, target skew under 100ps
7. **Post-CTS Optimization**
8. **Routing** - enable antenna fixing
9. **Route Optimization**
10. **Chip Finish** - export GDS

## Target QoR

### Timing
- Target frequency: 100 MHz (10ns period)
- WNS should be 0 or positive (no timing violations)
- TNS should be 0

### Area
- Core utilization: ~68%
- Maximum die area: 450x450 microns

### Power
- Keep leakage under 5mW
- Dynamic power under 50mW

## Tool Versions

- **Innovus**: v20.10
- **Design Compiler**: T-2022.03

## Special Instructions

For CTS, use ccopt and set target max transition to 0.15ns. Use 8 CPUs for multi-threading. Set early global max route layer to 4.

After chip finish, generate timing, power, and area reports.
