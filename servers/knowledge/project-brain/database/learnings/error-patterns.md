---
type: learning
category: error-patterns
tags: [errors, troubleshooting, patterns]
---

# Error Patterns

Common errors encountered across projects and their solutions.

## Innovus

### LEF Loading Errors

**Symptom:** `ERROR: Cannot read LEF file`

**Causes:**
- Missing LEF file in search path
- Corrupted LEF file
- Version mismatch between LEF and tool

**Solutions:**
1. Verify LEF file exists: `ls -la $LEF_PATH`
2. Check LEF syntax: `head -50 $LEF_FILE`
3. Update lefInMode: `set lefInMode 5.8`

**Related SQLite:** See error_log table entries with error_type='lef_loading'

### MMMC Setup Errors

**Symptom:** `ERROR: No valid timing view found`

**Causes:**
- Missing .lib files
- Incorrect corner definitions
- Library/analysis view mismatch

**Solutions:**
1. Verify .lib files exist and are readable
2. Check create_rc_corner commands
3. Validate set_analysis_view usage

## Design Compiler

### Elaboration Errors

**Symptom:** `Error: Cannot elaborate design`

**Causes:**
- Missing RTL files
- Syntax errors in Verilog/VHDL
- Missing library definitions

**Solutions:**
1. Check search_path includes all RTL directories
2. Run lint on source files before synthesis
3. Verify link_library is set correctly

## PrimeTime

### SDC Constraint Errors

**Symptom:** `Error: Constraint not applied`

**Causes:**
- Clock definitions missing
- Incorrect port names in constraints
- Constraint files not sourced

**Solutions:**
1. Verify clock definitions match RTL
2. Check port names with `report_port`
3. Source SDC after design link

## Pattern Matching

When encountering new errors:
1. Search error_log table for similar messages
2. Check this PageIndex for documented patterns
3. If new pattern found, document here and log to SQLite
