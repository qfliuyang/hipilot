---
tool: design_compiler
command_category: design_reading
version: L-2016.03+
source: Synopsys Design Compiler User Guide
---

# analyze and elaborate

## Syntax

### analyze
```tcl
analyze -library library_name
        -format {verilog | vhdl}
        file_list
```

### elaborate
```tcl
elaborate design_name
        -library library_name
        -architecture arch_name
        -parameters param_list
```

## Description

The `analyze` and `elaborate` commands provide a two-step process for reading RTL designs into Design Compiler. This is the recommended approach for complex designs.

- **analyze**: Performs syntax checking and creates intermediate `.syn` files in the work directory
- **elaborate**: Builds the design from analyzed files, performs synthesis checks, and creates the design in memory

## analyze Arguments

| Option | Description | Required |
|--------|-------------|----------|
| `-library` | Target library (work directory) | Yes |
| `-format` | File format: verilog or vhdl | Yes |
| `file_list` | List of RTL files to analyze | Yes |

## elaborate Arguments

| Option | Description | Required |
|--------|-------------|----------|
| `design_name` | Top-level module/entity name | Yes |
| `-library` | Source library (work directory) | No |
| `-architecture` | VHDL architecture to use | For VHDL |
| `-parameters` | Parameter/generic overrides | No |

## Examples

### Basic analyze/elaborate
```tcl
# Analyze Verilog files
analyze -library work -format verilog {file1.v file2.v top.v}

# Elaborate top module
elaborate top -library work
```

### VHDL Flow
```tcl
# Analyze VHDL files
analyze -library work -format vhdl {pkg.vhd entity.vhd arch.vhd}

# Elaborate with specific architecture
elaborate top_entity -library work -architecture rtl
```

### With Parameters
```tcl
# Analyze
analyze -library work -format verilog design.v

# Elaborate with parameter override
elaborate top -library work -parameters "WIDTH=32,DEPTH=1024"
```

### Multiple Libraries
```tcl
# Analyze into specific library
analyze -library mylib -format verilog design.v

# Elaborate from that library
elaborate top -library mylib
```

## read_file Alternative

### Syntax
```tcl
read_file -format {verilog | vhdl | sverilog | ddc | db}
          -library library_name
          file_list
```

### Description
Single-step command that combines analyze and elaborate. Faster but less control.

### Examples
```tcl
# Read Verilog directly
read_file -format verilog design.v

# Read SystemVerilog
read_file -format sverilog design.sv

# Read compiled DDC
read_file -format ddc design.ddc
```

## analyze vs read_file Comparison

| Aspect | analyze/elaborate | read_file |
|--------|-------------------|-----------|
| Speed | Slower (two-step) | Faster |
| Control | More control | Less control |
| Error checking | Better error messages | Basic errors |
| VHDL support | Full support | Limited |
| Parameters | Easy to override | Harder to override |
| Incremental | Can re-elaborate | Must re-read all |

## Common Errors

### Error: Syntax error during analyze
```
Error: syntax error at line 45 in file design.v (VER-1)
```
**Solution**: Fix RTL syntax error

### Error: Module not found during elaborate
```
Error: Cannot find the design 'top' in the library 'work' (LBR-0)
```
**Solution**: Check module name matches elaborate argument

### Error: Missing module
```
Error: Unable to resolve reference 'submodule' in 'top' (LINK-1)
```
**Solution**: Analyze all dependent files first

### Error: Work library not defined
```
Error: Library 'work' not defined (LBR-2)
```
**Solution**: Define library with `define_design_lib work -path ./work`

## Best Practices

1. **Use analyze/elaborate for complex designs** - Better error messages and control
2. **Use read_file for simple designs** - Faster turnaround
3. **Analyze dependencies first** - Bottom-up order
4. **Check work directory exists** - Create with `define_design_lib`
5. **Use consistent library names** - Match analyze `-library` with elaborate `-library`

## Complete Example
```tcl
# Setup
define_design_lib work -path ./work

# Set target technology
set target_library "typical.db"
set link_library "* typical.db"

# Analyze all files (bottom-up order)
analyze -library work -format verilog \
    {utils.v alu.v regfile.v core.v top.v}

# Elaborate top level
elaborate top -library work

# Link design
link

# Check design
check_design
```

## Source
- [Synopsys Design Compiler User Guide](https://picture.iczhiku.com/resource/eetop/WhIEDLIWLEUyevnv.pdf)
- [Design Compiler Workshop](http://thuime.cn/wiki/images/0/06/Design_Compiler_1_Student_Guide_2007.03-clear.pdf)
