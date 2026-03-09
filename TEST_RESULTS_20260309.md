# HiPilot Test Results - March 9, 2025

## Summary

**Test Run:** 2026-03-09 08:57:25
**Command:** `/rtl2gds`
**Duration:** 1202.8s (20 minutes)

## Score Breakdown

| Layer | Score | Status | Notes |
|-------|-------|--------|-------|
| L1 Prompt Delivery | 1.0/1.0 | ✅ | Claude responded |
| L2 Intent Recognition | 1.0/1.0 | ✅ | Understood RTL-to-GDS flow |
| L3 MCP Tool Usage | 1.0/1.0 | ✅ | 6,839 MCP calls |
| L3b Process Validation | 1.0/1.0 | ✅ | Correctly used dc_shell |
| L4 EDA Execution | 0.0/1.0 | ❌ | LEF file loading error |
| L5 QoR Assessment | 1.0/1.0 | ✅ | WNS=0.00, TNS=0.00 |

**Total: 5.0/6.0 (83%)**

## Key Result: Human-Like 30% → 100%

The Human-Like behavior score improved from **30% (Machine-like)** to **100% (Human-like)**.

**GPA: 3.37/4.0 (B)**

## EDA Error (L4 Failure)

```
**ERROR: (IMPLF-53): The layer 'li1' referenced in pin 'VGND' in macro 'sky130_ef_sc_hd__decap_12'
**ERROR: Loading LEF file(s) failed
```

This is a PDK/environment issue.

## Evidence

Full evidence: `test-evidence/20260309085725/` (64MB)

Key files:
- FLOW_REPORT.md - Full report
- timeline.jsonl - Event log
- mcp_log.jsonl - 6,839 MCP calls
- recordings/test_recording.mp4 - Full video

## Commit

`9bb7511` - "Add LittleBrain activity logging and improve Human-Like behavior"

## LittleBrain Logging

New logging system added:
- servers/knowledge/littlebrain/logger.js
- Tracks all reasoning steps
- Integrated into HiTestBot evidence collection
