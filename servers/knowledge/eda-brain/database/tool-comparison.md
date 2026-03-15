# EDA Tool Comparison

When to use which EDA tool for each task.

## Tool Selection Matrix

| Task | Primary Tool | Alternative | Notes |
|------|--------------|-------------|-------|
| RTL Synthesis | Design Compiler | Genus | DC is industry standard |
| Physical Design (Cadence) | Innovus | - | Complete P&R solution |
| Physical Design (Synopsys) | ICC2 | - | Synopsys flow integration |
| Signoff STA | PrimeTime | Tempus | PT is golden signoff |
| Parasitic Extraction | StarRC | Quantus | Required for signoff |
| Physical Verification | IC Validator | Calibre | DRC/LVS checks |
| Power Analysis | PrimeTime PX | Voltus | Dynamic/static power |

## Synthesis Tools

### Design Compiler (Synopsys)

**Best for:**
- Synopsys-based flows
- DFT integration
- PrimeTime correlation

**Strengths:**
- Mature, proven tool
- Excellent QoR
- Tight PT correlation
- Good DFT support

**When to choose:**
- Synopsys flow
- ASIC designs
- DFT requirements

### Genus (Cadence)

**Best for:**
- Cadence-based flows
- Innovus integration
- Mixed-signal designs

**Strengths:**
- Innovus integration
- Mixed-signal support
- Fast runtime

**When to choose:**
- Cadence flow
- Mixed-signal designs
- Quick synthesis needed

---

## Place & Route Tools

### Innovus (Cadence)

**Best for:**
- Advanced node designs
- Complex floorplans
- High-performance designs

**Strengths:**
- Excellent CTS
- Advanced routing
- Good correlation with Tempus
- Strong optimization

**When to choose:**
- Cadence flow
- Complex designs
- Advanced nodes (<7nm)

### ICC2 (Synopsys)

**Best for:**
- Synopsys-based flows
- PrimeTime correlation
- DFT-aware P&R

**Strengths:**
- PT correlation
- DFT integration
- Synopsys ecosystem

**When to choose:**
- Synopsys flow
- Tight PT correlation needed
- DFT requirements

---

## Signoff Tools

### PrimeTime (Synopsys)

**Best for:**
- Final signoff
- Synopsys flows
- Advanced analysis

**Strengths:**
- Industry standard
- Advanced analysis (POCV, SOCV)
- ECO guidance
- Best correlation

**When to choose:**
- Final signoff
- Synopsys flow
- Advanced nodes

### Tempus (Cadence)

**Best for:**
- Cadence flows
- Innovus correlation
- Quick analysis

**Strengths:**
- Innovus correlation
- Fast runtime
- Integrated with Innovus

**When to choose:**
- Cadence flow
- In-design analysis
- Quick checks

---

## Flow Recommendations

### Synopsys Flow

```
RTL -> Design Compiler -> ICC2 -> PrimeTime -> StarRC
```

**Advantages:**
- Tight tool correlation
- Single vendor support
- Proven methodology

### Cadence Flow

```
RTL -> Genus -> Innovus -> Tempus -> Quantus
```

**Advantages:**
- Integrated environment
- Advanced algorithms
- Good mixed-signal support

### Mixed Flow

```
RTL -> Design Compiler -> Innovus -> PrimeTime
```

**Advantages:**
- Best-of-breed tools
- Flexible methodology

**Challenges:**
- Correlation issues
- Multiple support contacts
- Complex setup

---

## Decision Tree

```
Starting new project?
├── Synopsys shop? -> DC + ICC2 + PT
├── Cadence shop? -> Genus + Innovus + Tempus
└── Mixed?
    ├── Need best synthesis? -> DC
    ├── Need best P&R? -> Innovus
    └── Need golden signoff? -> PT
```

---

## Tool Version Compatibility

| Tool | Compatible With |
|------|-----------------|
| DC L-2016.03 | PT T-2022.03, ICC2 T-2022.03 |
| Innovus 20.10 | Tempus 20.10, Genus 20.10 |
| PT T-2022.03 | DC L-2016.03+, ICC2 T-2022.03 |

Always check vendor compatibility matrices for production flows.
