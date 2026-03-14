---
name: /synthesis
description: >
  Run Stage 0: RTL Synthesis using Design Compiler.
  Synthesizes RTL Verilog into gate-level netlist.
  Uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME environment variables.
---

# /synthesis

Run Stage 0: RTL Synthesis for the current design.

## Prerequisites

Environment variables must be set:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
```

Required files in design directory:
- `rtl/*.v` or `rtl/*.sv` - RTL source files
- `constraints/${HIPILOT_DESIGN_NAME}.sdc` - Timing constraints
- `tech/lib/*.db` - Technology libraries

## What You Do

### 1. Verify environment

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;

if (!designDir || !designName) {
  console.error("Set HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME");
  return;
}
```

### 2. Start dc_shell

```javascript
eda.start_tool({tool: "dc_shell", design_dir: designDir});
```

### 3. Run synthesis flow

Work incrementally:
1. Setup directories and libraries
2. Read and analyze RTL
3. Elaborate and link design
4. Apply constraints
5. Compile with `compile_ultra`
6. Write output netlist

### 4. Report QoR (L5 REQUIRED)

After synthesis completes:
```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get timing"});
eda.await_idle({timeout: 30});
const result = eda.get_last_result({lines: 50});

// Parse and report EXACT WNS/TNS
console.log(`Stage 0 Synthesis: WNS: X.XXX ns, TNS: Y.YYY ns`);
```

## Output

- Netlist: `result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v`
- Reports: `result/syn/report/timing.rpt`, `area.rpt`

## Next Step

After synthesis completes successfully:
- Run `/design-init` to load the netlist into Innovus
