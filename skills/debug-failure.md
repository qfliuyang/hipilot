---
name: debug-failure
description: >
  Diagnose EDA command failures and present analysis with fix suggestions.
  Analyzes error output, categorizes the problem, and provides actionable
  recommendations. First step in error recovery workflow.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - eda.get_last_result
    - eda.diagnose_error
    - eda.capture_and_analyze
    - suggest.for_violation
  autonomous: false
  flow_stages: [all]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output` | string | `""` | Error output to analyze (empty = use last result) |
| `context_lines` | integer | `100` | Lines of context to capture |
| `show_suggestions` | boolean | `true` | Show fix suggestions |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `eda.get_last_result` | Get last command result |
| `eda.diagnose_error` | Categorize and explain error |
| `suggest.for_violation` | Get fix suggestions |

---

## Workflow

### Step 1 — Get Last Result

If no output provided, capture from EDA:

**MCP Call:**
```
eda.get_last_result lines=100
```

**Response:**
```
success: false
error_type: "constraint"
error_line: "Error: cannot find clock 'clk_main'"
summary: "Clock constraint not found"
```

---

### Step 2 — Diagnose Error

**MCP Call:**
```
eda.diagnose_error output="<error_output>"
```

**Response:**
```
category: constraint
explanation: "Clock 'clk_main' is not defined in the design or constraints"
suggested_fixes:
  - "Check if clock is defined in SDC: create_clock -name clk_main"
  - "Verify clock port exists in design"
  - "Check for typos in clock name"
```

---

### Step 3 — Get Targeted Suggestions

**MCP Call:**
```
suggest.for_violation violation_type="constraint"
```

**Response:**
```
suggestions:
  1. Check SDC file for clock definition
     Tcl: create_clock -name clk_main -period 5.0 [get_ports clk_main]
  2. Verify port exists
     Tcl: get_ports clk_main
```

---

## Error Categories

| Category | Common Causes | Example |
|----------|---------------|---------|
| `syntax` | Tcl syntax errors | `unknown command "putsx"` |
| `constraint` | Missing/invalid constraints | `cannot find clock 'clk'` |
| `timing` | Timing violations | `setup violation -0.15ns` |
| `drc` | Design rule violations | `spacing violation on metal1` |
| `resource` | Memory, license, CPU | `out of memory` |
| `data` | Missing files, corrupt data | `file not found: design.lib` |

---

## Example Output

```
🔍 Failure Diagnosis

Command: report_timing -max_paths 50
Status: FAILED (exit code 1)

Error Analysis:
  Category: Constraint Error
  Line: 47
  
  Problem: Clock 'clk_main' is not defined
  
  Explanation:
    The SDC constraint file references a clock named 'clk_main'
    but this clock has not been created in the design.
    
Fix Suggestions:
  
  1. ✅ Define the clock in SDC
     create_clock -name clk_main -period 5.0 [get_ports clk_main]
     
  2. Check if clock port exists
     get_ports -filter "name =~ *clk*"
     
  3. Check for clock name typos
     all_clocks
     
  4. Verify SDC was loaded
     report_constraints -all_violators

Recommended Action:
  → Add create_clock command to SDC file
  → Reload constraints: read_sdc constraints.sdc
  → Re-run timing analysis
```

---

## Common Error Patterns

### Syntax Errors
```
Error: unknown command "size_cells"
       ^-- Did you mean "size_cell"?
```
→ Fix: Correct command name

### Constraint Errors
```
Error: cannot find clock 'clk_core' in mode 'func'
```
→ Fix: Define clock or check mode

### Timing Errors
```
Error: timing analysis failed - negative slack paths exist
```
→ Fix: Run timing fix workflow

### Resource Errors
```
Error: out of memory allocating 8GB
```
→ Fix: Increase memory or simplify design

---

## Integration with auto-recover

After diagnosis, can trigger automatic recovery:

```
debug-failure
  → Diagnosis: Constraint error, missing clock
  
auto-recover
  → Apply suggested fix automatically
```

---

## Success Criteria

- [ ] Error output captured
- [ ] Error categorized correctly
- [ ] Root cause explained
- [ ] Fix suggestions provided
- [ ] Next steps clear
