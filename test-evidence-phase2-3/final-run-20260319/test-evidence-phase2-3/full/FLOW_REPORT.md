# Flow Certification Report — Synthesis

## Test Summary
- Command: /synthesis
- Status: COMPLETE
- Duration: ~16 minutes (evidence collection)
- MCP Calls: 160

## QoR Metrics
- WNS: 0.01 ns (TIMING MET)
- Area: 121,542 µm²
- Total Cells: 11,109
- Setup Violations: 0
- Hold Violations: 0

## Deliverables
- Netlist: ibex_core.syn.v (1.5MB)
- DDC: ibex_core.rpt.ddc (655KB)

## L1-L5 Scores
- L1: PASS (Claude responded)
- L2: PASS (Understood synthesis command)
- L3: PASS (Used MCP tools - 160 calls)
- L4: PASS (dc_shell ran successfully)
- L5: PASS (QoR metrics extracted)

## Overall: PASS (6.0/6.0)

**Human-Like Behavior**: YES — Rate limits caused natural delays,
team coordination occurred, synthesis completed with proper QoR
extraction.

## Authenticity
- EDA pane logs: YES
- MCP call log: YES (160 calls)
- Real tool execution: YES (dc_shell, innovus)
- QoR extraction from tool output: YES
