---
topic: dft_methodology
sources:
  - https://www.synopsys.com/glossary/what-is-design-for-test.html
  - https://vlsiguru.com/blog/dft-tools-and-techniques-explained-simply
  - https://www.takshila-vlsi.com/blog/introduction-to-dft-enhancing-testability-in-vlsi-designs/
  - https://www.eda-academy.com/techblogs/enhancing-ic-reliability-advanced-techniques-in-design-for-testability-dft
  - https://zilika.com/design-for-test/
---

# DFT: Scan Chain, BIST, and Testability

## Overview

Design for Testability (DFT) is a methodology that adds testability features to a hardware design, making it easier to test and validate after manufacturing. DFT is essential for ensuring quality, reliability, and cost-effective testing of complex VLSI designs.

## Core DFT Techniques

### 1. Scan Chain Insertion

**Purpose**: Converts flip-flops into shift registers to improve controllability and observability of internal states.

**Implementation**: Replace standard flip-flops with scan flip-flops (multiplexed flip-flops) that can operate in:
- **Normal Mode**: Regular functional operation
- **Shift Mode**: Form scan chains for test data in/out
- **Capture Mode**: Capture combinational logic responses

**Key Ports**:
- Scan In (SI)
- Scan Out (SO)
- Scan Enable (SE)
- Clock (CLK)

**Overhead**: ~10% area, ~5% speed impact

### 2. ATPG (Automatic Test Pattern Generation)

- Generates test vectors to detect specific faults (stuck-at faults, transition faults)
- Maximizes fault coverage while minimizing test time
- Works with scan chains to apply patterns and analyze responses

**Tools**: Synopsys TetraMAX, Siemens Tessent ATPG

### 3. Boundary Scan (JTAG/IEEE 1149.1)

- Tests interconnections between ICs on PCBs without physical probes
- Inserts scan cells at I/O boundaries
- Essential for BGA packages and board-level testing
- Enables in-system testing and debugging

**JTAG Signals**:
- TDI (Test Data In)
- TDO (Test Data Out)
- TMS (Test Mode Select)
- TCK (Test Clock)
- TRST (Test Reset, optional)

### 4. BIST (Built-In Self-Test)

Embeds test pattern generators (TPG) and response analyzers on-chip.

**Types**:
- **Logic BIST (LBIST)**: Tests digital logic at-speed
- **Memory BIST (MBIST)**: Tests embedded memories

**Benefits**:
- Reduces external test equipment dependency
- Supports in-field testing for automotive/medical applications
- Enables self-diagnosis after deployment

## DFT Implementation Flow

| Step | Activity |
|------|----------|
| 1 | Design analysis & testability bottlenecks identification |
| 2 | DFT insertion (scan chains, BIST, test points) |
| 3 | DFT rule checking and violation fixing |
| 4 | ATPG pattern generation |
| 5 | Fault simulation & coverage validation |
| 6 | Test vector preparation for ATE |

## Scan Insertion Methodology

### Pre-Synthesis Considerations
- Plan scan architecture early
- Determine scan style (multiplexed flip-flop, clocked scan, LSSD)
- Define scan chain count based on pin availability

### Scan Styles

| Style | Description | Use Case |
|-------|-------------|----------|
| **Multiplexed Flip-Flop** | MUX selects between data and scan input | Most common, low overhead |
| **Clocked Scan** | Separate clock for scan operation | High-performance designs |
| **LSSD** | Level-sensitive scan design | IBM methodology, robust |

### Scan Insertion Flow (DFT Compiler)

```tcl
# 1. Define test protocol
set_dft_configuration -scan_enable enable_signal

# 2. Configure scan chains
set_scan_configuration -chain_count 8 \
                       -clock_mixing mix_clocks \
                       -style multiplexed_flip_flop

# 3. Preview scan architecture
create_test_protocol -infer_clock -infer_async
preview_dft -show scan_summary

# 4. Insert scan chains
insert_dft

# 5. Verify test protocol
dft_drc

# 6. Report scan architecture
report_scan_path
```

## Advanced DFT Techniques

| Technique | Description |
|-----------|-------------|
| **Hierarchical DFT** | Partition design into blocks with individual DFT, integrate at top level |
| **Test Compression** | Reduces test data volume without compromising fault coverage |
| **Low Power DFT** | Power-aware testing to manage switching activity and thermal issues |
| **At-Speed Testing** | Tests circuits at operational frequency (detects timing faults) |
| **Test Point Insertion (TPI)** | Improves fault coverage with minimal gate/delay overhead |

## Fault Models

| Fault Type | Description | Detection Method |
|------------|-------------|------------------|
| **Stuck-At** | Signal stuck at 0 or 1 | Logic test |
| **Transition** | Slow-to-rise or slow-to-fall | At-speed test |
| **Path Delay** | Excessive delay on specific path | Path delay test |
| **Bridging** | Unintended connection between nets | IDDQ or logic test |
| **Open** | Broken connection | Various |

## Key Industry Tools

| Vendor | Tools |
|--------|-------|
| Synopsys | DFT Compiler, DFTMAX, TetraMAX |
| Cadence | Genus Synthesis Solution, Modus |
| Siemens EDA | Tessent Scan, Tessent ATPG, Tessent MBIST/LBIST |

## Modern Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **Low Power Designs** | Power gating and clock gating require scan chain partitioning and isolation logic |
| **Multi-clock Domains** | Need careful synchronization during test |
| **Advanced Nodes** | Physically aware DFT considering timing, power, and area constraints |
| **In-Field Testing** | BIST enables self-diagnosis after deployment |

## DFT Tcl Commands (Tessent)

```tcl
# Set context
set_context dft -scan

# Read design
read_verilog design.v
read_cell_library stdcell.lib

# Set design level
set_design_level physical_block

# Configure scan
set_scan_config -chain_count 8 \
                -clock_mixing mix_clocks

# Insert scan
process_dft_specification
extract_icl

# Create patterns
create_patterns -scan
```

## Best Practices

1. **Plan DFT early** - Consider testability during RTL design
2. **Balance chain lengths** - Even test time across all chains
3. **Consider clock domains** - Use lock-up latches for CDC
4. **Enable compression** - Reduce test time and data volume
5. **Verify coverage** - Target > 98% stuck-at fault coverage
6. **Check timing** - Scan mode has different timing constraints
