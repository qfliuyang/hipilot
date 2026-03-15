---
type: learning
category: success-patterns
tags: [success, best-practices, strategies]
---

# Success Patterns

Strategies and approaches that have worked well across projects.

## Placement

### Congestion Mitigation

**Strategy:** Progressive density increase with congestion-driven placement

**Approach:**
1. Start with target_density 0.65
2. Enable congestion-driven placement
3. Increase density by 0.05 if no congestion
4. Stop when congestion > 5% or timing degrades

**Results:**
- Average WNS improvement: 15%
- Congestion reduction: 40%

**Related QoR:** See qor_snapshots where stage='placement' AND utilization < 0.75

### Path Group Optimization

**Strategy:** Group critical paths separately

**Approach:**
1. Identify critical paths from synthesis
2. Create path groups with weight 5.0
3. Use group-based optimization

## CTS

### Skew Target Setting

**Strategy:** Match skew target to design requirements

**Guidelines:**
- High-performance designs: < 50ps skew
- Low-power designs: < 100ps skew acceptable
- Always use ccopt for automatic optimization

### NDR Rules

**Strategy:** Apply non-default rules to clock nets

**Best Practice:**
- Double width for clock nets
- Shield critical clocks
- Use proper spacing rules

## Routing

### DRC Cleanup Flow

**Strategy:** Iterative routing with progressive DRC fixing

**Approach:**
1. First route: routeDesign with default settings
2. Check DRC: verify_drc
3. Fix shorts: editSelect + delete
4. Re-route: routeDesign -incremental
5. Repeat until DRC clean

## General

### Checkpoint Strategy

**Strategy:** Frequent checkpoints at key milestones

**Checkpoints:**
- After each major stage completion
- Before risky operations
- After achieving timing closure

**Naming Convention:** `{stage}_{version}_{YYYYMMDD}`

**Related SQLite:** See checkpoints table for project checkpoint history
