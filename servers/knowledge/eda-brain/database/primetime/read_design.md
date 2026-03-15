---
tool: primetime
command_category: design_reading
version: T-2022.03+
source: Synopsys PrimeTime User Guide
---

# Reading Design Data

## read_verilog

### Syntax
```tcl
read_verilog file_list
```

## Description
Reads Verilog gate-level netlist into PrimeTime. This is the primary method for loading the design to be analyzed.

## Arguments

| Argument | Description |
|----------|-------------|
| `file_list` | List of Verilog files to read |

## Examples

### Basic Usage
```tcl
# Read single Verilog file
read_verilog design.v

# Read multiple files
read_verilog {file1.v file2.v top.v}
```

## read_db

### Syntax
```tcl
read_db file_list
```

## Description
Reads Synopsys database (.db) files. These can be logic libraries or design databases.

## Examples
```tcl
# Read logic libraries
read_db {typical.db slow.db fast.db}

# Read design database
read_db design.db
```

## read_ddc

### Syntax
```tcl
read_ddc file_name
```

## Description
Reads Design Compiler DDC format design files.

## Examples
```tcl
read_ddc design.ddc
```

## link_design

### Syntax
```tcl
link_design [design_name]
```

## Description
Links the design by resolving all cell references to library cells. Must be called after reading netlist and libraries.

## Arguments

| Argument | Description |
|----------|-------------|
| `design_name` | Name of top-level design (optional) |

## Examples

### Basic Linking
```tcl
# Read libraries first
read_db {typical.db}

# Read netlist
read_verilog design.v

# Link the design
link_design

# Or specify top level
link_design top
```

## current_design

### Syntax
```tcl
current_design [design_name]
```

## Description
Sets or queries the current design context.

## Examples
```tcl
# Set current design
current_design top

# Query current design
puts [current_design]
```

## Complete Design Reading Flow
```tcl
# Set search path
set search_path ". /libs /designs"

# Read logic libraries
read_db {typical.db slow.db fast.db}

# Read netlist
read_verilog design.v

# Set current design
current_design top

# Link design
link_design

# Check design integrity
check_design
```

## Common Errors

### Error: Unresolved references
```
Error: Cannot resolve reference to cell 'AND2X1' (LINK-1)
```
**Solution**: Read logic library containing the cell before linking

### Error: Multiple top levels
```
Error: Multiple top-level designs found (LINK-2)
```
**Solution**: Specify design name in link_design

### Error: File not found
```
Error: Cannot open file 'design.v' (FILE-1)
```
**Solution**: Check file path and search_path

## Best Practices

1. **Read libraries before netlist** - Ensures cells are available
2. **Use search_path** - Simplifies file references
3. **Always link_design** - Required before any analysis
4. **Check design after linking** - Verify no issues
5. **Set current_design** - Ensures correct context

## Source
- [Synopsys PrimeTime User Guide](https://picture.iczhiku.com/resource/eetop/SykdfdRlrLPEQBBX.pdf)
- [PrimeTime Advanced Timing Analysis User Guide](https://picture.iczhiku.com/resource/eetop/wYkddifjjPrgOvMb.pdf)
