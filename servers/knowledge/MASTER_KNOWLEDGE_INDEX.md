# HiPilot Master Knowledge Index

> Comprehensive PageIndex-based knowledge system for experienced ASIC design

---

## Knowledge Base Statistics

| Brain | Files | Lines | Coverage |
|-------|-------|-------|----------|
| **ASIC-Brain** | 46 | ~3,500 | RTL2GDS flow, methodologies, best practices |
| **EDA-Brain** | 34 | ~6,200 | Tool commands, Tcl scripting, error patterns |
| **Project-Brain** | 5 | ~800 | QoR tracking, learnings, patterns |
| **Total** | **85** | **~10,500** | **Complete ASIC design expertise** |

---

## ASIC-Brain: Design Knowledge

### Tree Structure
```
sic-brain/database/
├── INDEX.md                          [Root: RTL2GDS Overview]
├── synthesis/
│   ├── INDEX.md                      [Stage metadata]
│   ├── tcl-patterns.md               [Basic patterns]
│   ├── tcl-patterns-expanded.md      [Advanced patterns from Synopsys examples]
│   ├── dc-commands.md                [Command reference]
│   └── common-issues.md              [Errors & fixes]
├── design-init/
├── floorplan/
├── power-planning/
├── placement/
├── cts/
├── post-cts-opt/
├── routing/
├── routeopt/
├── chipfinish/
└── advanced/                         [NEW: Deep knowledge]
    ├── 01_rtl2gds_flow_overview.md   [Complete flow]
    ├── 02_synthesis_deep_dive.md     [Optimization strategies]
    ├── 03_floorplanning.md           [Macro/IO placement]
    ├── 04_power_planning.md          [PG methodology]
    ├── 05_clock_tree_synthesis.md    [CTS strategies]
    ├── 06_placement.md               [Timing-driven placement]
    ├── 07_routing.md                 [SI-aware routing]
    ├── 08_static_timing_analysis.md  [STA fundamentals]
    ├── 09_dft_methodology.md         [Scan/BIST]
    ├── 10_low_power_design.md        [Power techniques]
    ├── 11_eco_methodology.md         [Engineering changes]
    └── 12_signoff_checks.md          [DRC/LVS/Signoff]
```

### Query Examples
```javascript
// Get synthesis optimization strategies
asicBrain.query('advanced/synthesis_deep_dive/compile_ultra_strategies');

// Get CTS methodology
asicBrain.query('advanced/clock_tree_synthesis/ccopt_best_practices');

// Search across all knowledge
asicBrain.search('hold timing fix');
```

---

## EDA-Brain: Tool Expertise

### Tree Structure
```
eda-brain/database/
├── INDEX.md                          [Root: Tool Catalog]
├── tool-comparison.md                [When to use which tool]
├── licensing/
│   ├── INDEX.md
│   └── common-issues.md
├── innovus/
│   ├── INDEX.md                      [Tool overview]
│   ├── commands.md                   [Command reference]
│   ├── errors.md                     [Error patterns]
│   ├── best-practices.md             [Recommendations]
│   ├── init_design.md                [NEW: Detailed]
│   ├── floorplan.md                  [NEW: Detailed]
│   ├── power_planning.md             [NEW: Detailed]
│   ├── placement.md                  [NEW: Detailed]
│   ├── cts.md                        [NEW: Detailed]
│   ├── routing.md                    [NEW: Detailed]
│   └── analysis.md                   [NEW: Detailed]
├── design-compiler/
│   ├── INDEX.md
│   ├── commands.md
│   ├── errors.md
│   ├── best-practices.md
│   ├── analyze_elaborate.md          [NEW: Detailed]
│   ├── compile_ultra.md              [NEW: Detailed]
│   ├── path_groups.md                [NEW: Detailed]
│   └── write_commands.md             [NEW: Detailed]
├── icc2/
│   ├── INDEX.md
│   ├── commands.md
│   ├── errors.md
│   ├── best-practices.md
│   └── power-grid-patterns.md        [NEW: From examples]
├── primetime/
│   ├── INDEX.md
│   ├── commands.md
│   ├── errors.md
│   ├── best-practices.md
│   ├── read_design.md                [NEW: Detailed]
│   ├── read_sdc.md                   [NEW: Detailed]
│   ├── report_timing.md              [NEW: Detailed]
│   └── check_timing.md               [NEW: Detailed]
└── tcl/
    └── common-procedures.md          [NEW: Reusable procs]
```

### Query Examples
```javascript
// Get Innovus CTS command details
edaBrain.query('innovus/cts/ccopt_design');

// Get DC compile_ultra options
edaBrain.query('design-compiler/compile_ultra/dc_ultra_flow');

// Search error patterns
edaBrain.searchErrors('LEF file loading failed');

// Get power grid patterns
edaBrain.query('icc2/power-grid-patterns/mesh_with_via_rules');
```

---

## Project-Brain: Dynamic Intelligence

### Hybrid Architecture
```
project-brain/
├── index.js                          [Main interface]
├── db-interface.js                   [SQLite wrapper]
├── database/
│   ├── schema.sql                    [SQLite schema]
│   ├── migrations/
│   │   └── 001-initial-schema.js
│   └── learnings/                    [PageIndex]
│       ├── INDEX.md
│       ├── error-patterns.md
│       └── success-patterns.md
```

### Query Examples
```javascript
// Get QoR trend (SQLite query)
projectBrain.getQoRTrend('placement', 5);

// Query learnings (PageIndex)
projectBrain.queryLearnings('error-patterns/cts_skew_violations');

// Find similar past errors (SQL + pattern match)
projectBrain.getSimilarErrors('setup violation in clk domain');
```

---

## Knowledge Sources

### Web Research
- ChipXpert VLSI Institute - Physical design flow
- Synopsys Official Documentation - Low power design
- VLSI Guru - CTS methodology
- Cadence Community - CTS best practices
- Design-Reuse - ECO methodology
- OnDevTra - STA fundamentals
- Enics Labs - Routing techniques

### EDA Server Documentation
- Synopsys Design Compiler Tcl Examples (16 scripts)
- ICC2 Power Grid Examples (44 scripts)
- ICC2 PGEN Framework (6 scripts)
- Cadence NanoRoute User Guide (PDF)
- PrimeTime Tutorials

### Tool References
- Cadence Innovus Text Command Reference
- Synopsys Design Compiler User Guide
- Synopsys Design Compiler Optimization Reference
- Synopsys PrimeTime User Guide
- Synopsys PrimeTime Advanced Timing Analysis

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-15 | Initial PageIndex structure |
| 1.1.0 | 2026-03-15 | Added advanced ASIC knowledge (12 files) |
| 1.1.1 | 2026-03-15 | Added detailed EDA commands (19 files) |
| 1.2.0 | 2026-03-15 | Extracted Tcl patterns from EDA server |

---

## Next Steps for Growth

1. **Process NanoRoute PDF** - Extract detailed routing knowledge
2. **Add ICC2 EMS Documentation** - 55+ HTML topics from `/opt/synopsys/icc2_2022.03/doc/ICC2/ems/`
3. **Create Video Tutorials Index** - Link to training resources
4. **Add More Example Designs** - Ibex, Rocket Chip, etc.
5. **Build Interactive Workflows** - Step-by-step guided flows

---

*This knowledge base represents the collective expertise of senior ASIC designers and EDA tool experts, organized for AI-powered design assistance.*
