# TEST_PLAN Quantitative Goals & Progress Tracking

**Version:** 1.0
**Date:** 2026-03-15
**Purpose:** Measurable targets for test progress identification and tracking

---

## 1. OVERALL PROGRESS METRICS

### 1.1 Certification Tier Progression

| Tier | Minimum GPA | Agents Active | Stages Complete | Mission Target Met |
|------|-------------|---------------|-----------------|-------------------|
| **Bronze** | ≥ 2.0 | 1 | 1+ | No |
| **Silver** | ≥ 2.5 | 3+ | 3+ | No |
| **Gold** | ≥ 3.0 | 5 | 5+ | Partial |
| **Platinum** | ≥ 3.5 | 5 | 8+ | Yes |

### 1.2 Flow Completion Progress

```
Progress % = (Stages Successfully Completed / Total Stages in Flow) × 100
```

| Phase | Stages | Target | Minimum |
|-------|--------|--------|---------|
| Synthesis | 1 | 100% | 100% |
| Floorplan | 1 | 100% | 50% |
| Placement | 1 | 100% | 50% |
| CTS | 1 | 100% | 50% |
| Routing | 1 | 100% | 50% |
| Chip Finish | 1 | 100% | 50% |
| **Full RTL2GDS** | **6** | **100%** | **67%** |

---

## 2. L1-L5 SCORING MATRIX

### 2.1 Layer Scoring Criteria (0.0 - 1.0)

| Layer | Score 1.0 (Full) | Score 0.5 (Partial) | Score 0.0 (None) |
|-------|------------------|---------------------|------------------|
| **L1** | Response + meaningful content | Response but garbled | No response |
| **L2** | All keywords present | Some keywords | No relevant keywords |
| **L3** | MCP tool called + visible result | Tool called but result unclear | No tool call |
| **L4** | EDA tool runs + output visible | Tool starts but no clear output | Tool fails/doesn't start |
| **L5** | All QoR metrics (WNS/TNS/Area/Power) | Partial metrics | No metrics reported |

### 2.2 Stage Pass Thresholds

| Stage Type | L1 | L2 | L3 | L4 | L5 | Min GPA |
|------------|----|----|----|----|----|---------|
| **Single-command** | ≥ 1.0 | ≥ 0.5 | ≥ 0.5 | N/A | N/A | 2.0 |
| **Tool start** | ≥ 1.0 | ≥ 0.5 | ≥ 0.5 | ≥ 0.5 | N/A | 2.0 |
| **Tcl execution** | ≥ 1.0 | ≥ 0.5 | ≥ 0.5 | ≥ 0.5 | ≥ 0.5 | 2.5 |
| **Full stage** | ≥ 1.0 | ≥ 0.8 | ≥ 0.8 | ≥ 0.8 | ≥ 0.8 | 3.0 |

### 2.3 GPA Calculation

```
Stage GPA = (L1 + L2 + L3 + L4 + L5) / 5

Weighted GPA = (L1×1 + L2×1 + L3×1 + L4×1 + L5×1 + Authenticity×10) / 15

Where Authenticity = 0.0 if any critical cheat detected, else 1.0
```

**Critical:** Any critical cheat → Authenticity = 0 → **Automatic FAIL** regardless of other scores

---

## 3. PHASE-BY-PHASE QUANTITATIVE TARGETS

### Phase 0: Environment Setup

| Checkpoint | Metric | Target | Tolerance |
|------------|--------|--------|-----------|
| tmux session created | Boolean | 100% | 0% |
| 6 panes visible | Count | = 6 | ±0 |
| gnome-terminal opened | Boolean | 100% | 0% |
| ffmpeg recording | Boolean | 100% | 0% |
| video file size | MB | > 10 | > 5 |

### Phase 1: 3-Brain System

| Checkpoint | Metric | Target | Tolerance |
|------------|--------|--------|-----------|
| ASIC-Brain queries | Count | > 0 | - |
| EDA-Brain queries | Count | > 0 | - |
| Project-Brain queries | Count | > 0 | - |
| Response time | ms | < 5000 | < 10000 |

### Phase 2: Agent Registry

| Checkpoint | Metric | Target | Tolerance |
|------------|--------|--------|-----------|
| Agents registered | Count | = 5 | ±0 |
| Supervisor active | Boolean | 100% | 0% |
| Knowledge active | Boolean | 100% | 0% |
| Planner active | Boolean | 100% | 0% |
| Executor active | Boolean | 100% | 0% |
| Archivist active | Boolean | 100% | 0% |

### Phase 3: Individual Agent Skills

| Agent | Min L3 | Min L4 | Min L5 |
|-------|--------|--------|--------|
| Supervisor | 0.5 | N/A | N/A |
| Knowledge | 0.5 | N/A | N/A |
| Planner | 0.5 | N/A | N/A |
| Executor | 0.5 | 0.5 | 0.5 |
| Archivist | 0.5 | N/A | 0.5 |

### Phase 4: Mission Pack Loading

| Checkpoint | Metric | Target | Tolerance |
|------------|--------|--------|-----------|
| File parsed | Boolean | 100% | 0% |
| Libraries identified | Count | > 3 | > 0 |
| Stages defined | Count | > 0 | > 0 |
| Targets extracted | Count | > 0 | > 0 |

### Phase 5: Agent Coordination

| Checkpoint | Metric | Target | Tolerance |
|------------|--------|--------|-----------|
| Hub-and-spoke verified | Boolean | 100% | 0% |
| Knowledge Agent queries | Count | ≥ 3 | ≥ 1 |
| Cross-agent messages | Count | > 0 | > 0 |
| Coordination time | sec | < 30 | < 60 |

### Phase 6-8: End-to-End Flow

| Stage | Min L4 | Min L5 | Checkpoint File | File Size |
|-------|--------|--------|-----------------|-----------|
| Synthesis | 0.5 | 0.5 | synth.v | > 1MB |
| Design Init | 0.5 | N/A | design_init.enc | > 10MB |
| Floorplan | 0.5 | 0.5 | floorplan.enc | > 10MB |
| Placement | 0.5 | 0.5 | placement.enc | > 20MB |
| CTS | 0.5 | 0.5 | cts.enc | > 20MB |
| Routing | 0.5 | 0.5 | routing.enc | > 30MB |
| Chip Finish | 0.5 | 0.5 | gds | > 10MB |

---

## 4. QUALITY METRICS (QoR)

### 4.1 Timing Closure Targets

| Metric | Target | Acceptable | Fails |
|--------|--------|------------|-------|
| **WNS** | ≥ 0 ns | ≥ -0.1 ns | < -0.1 ns |
| **TNS** | = 0 ns | < -1.0 ns | ≥ -1.0 ns |
| **Setup Violations** | = 0 | < 10 | ≥ 10 |
| **Hold Violations** | = 0 | < 10 | ≥ 10 |

### 4.2 Physical Design Targets

| Metric | Target | Minimum |
|--------|--------|---------|
| **Core Utilization** | 65-70% | 50-80% |
| **Routing Congestion** | < 0.8 | < 0.95 |
| **DRC Violations** | = 0 | < 100 |
| **Antenna Violations** | = 0 | < 50 |

---

## 5. CHEAT DETECTION METRICS

### 5.1 Anti-Cheat Score

```
Anti-Cheat Score = 1.0 - (Critical Cheats × 0.5 + Warnings × 0.1)

If Critical Cheats > 0 → Score = 0.0 (FAIL)
```

### 5.2 Detection Categories

| Category | Weight | Auto-Fail |
|----------|--------|-----------|
| **Critical** | 0.5 | Yes |
| **Warning** | 0.1 | No |
| **Info** | 0.0 | No |

### 5.3 Critical Cheat Thresholds

| Cheat Type | Detection Pattern | Penalty |
|------------|-------------------|---------|
| Direct MCP calls | `mcp.*(eda|tmux|knowledge)` | Score = 0 |
| Terminal bypass | `tee.*\/dev\/tty` | Score = 0 |
| Fake processes | Simulated tool output | Score = 0 |
| Stale evidence | File timestamp < test start | Score = 0 |
| Static video | < 10 frames or < 10s duration | Score = 0 |

---

## 6. HUMAN-LIKE BEHAVIOR METRICS

### 6.1 Timing Jitter Requirements

| Parameter | Target | Range |
|-----------|--------|-------|
| **Base poll interval** | 5000ms | 5000ms |
| **Jitter percentage** | 30% | 20-50% |
| **Actual interval** | Varies | 3500-6500ms |
| **High attention response** | 500ms | 400-600ms |
| **Normal attention response** | 1500ms | 900-2100ms |
| **Low attention response** | 3000ms | 1500-4500ms |

### 6.2 Human-Like Score

| Factor | Weight | Measurement |
|--------|--------|-------------|
| **Irregular timing** | 30% | Std dev of poll intervals |
| **Variable attention** | 25% | Attention state transitions |
| **Event-driven screenshots** | 25% | Screenshots at key moments |
| **Physical input simulation** | 20% | Typing delays, keyboard shortcuts |

```
Human-Like Score = Σ(Factor_Score × Weight)

Target: ≥ 0.8 (Human-like)
Minimum: ≥ 0.5 (Acceptable)
```

---

## 7. EVIDENCE QUALITY METRICS

### 7.1 Three-View Correlation Score

```
Correlation Score = (Log_View_Match + Screenshot_View_Match + Video_View_Match) / 3

Where each view match = 1.0 if consistent, 0.5 if partial, 0.0 if contradictory
```

### 7.2 Evidence Freshness

| Evidence Type | Max Age | Verification |
|---------------|---------|--------------|
| Screenshots | 60s | Timestamp in filename |
| Video | 60s | ffmpeg duration check |
| Pane logs | 60s | `capture-pane` timestamp |
| MCP logs | Post-test only | `HIPILOT_TEST_LOG` env |
| EDA output | Created during test | File timestamp > test start |

### 7.3 Evidence Completeness

| Stage | Min Screenshots | Min Video Duration | Min Log Lines |
|-------|-----------------|-------------------|---------------|
| Short (< 5 min) | 5 | 30s | 100 |
| Medium (5-30 min) | 10 | Full | 500 |
| Long (> 30 min) | 15 | Full | 1000 |

---

## 8. PROGRESS TRACKING DASHBOARD

### 8.1 Real-Time Progress

```json
{
  "test_id": "ibex_20260315_143022",
  "phase": 6,
  "stage": "placement",
  "progress_percent": 67,
  "current_gpa": 3.2,
  "l1": 1.0,
  "l2": 0.8,
  "l3": 0.8,
  "l4": 0.5,
  "l5": 0.0,
  "cheat_score": 1.0,
  "human_like_score": 0.85,
  "eta_minutes": 45
}
```

### 8.2 Phase Completion Criteria

| Phase | Completion Criteria | Exit GPA |
|-------|---------------------|----------|
| 0 | All environment checks pass | N/A |
| 1 | All 3 brains respond | N/A |
| 2 | All 5 agents registered | N/A |
| 3 | All agents score ≥ 0.5 L3 | ≥ 2.0 |
| 4 | Mission pack parsed | N/A |
| 5 | Coordination verified | N/A |
| 6 | Synthesis complete | ≥ 2.5 |
| 7 | Self-improvement verified | ≥ 2.5 |
| 8 | GDS generated | ≥ 3.0 |

### 8.3 Trend Metrics

| Metric | Calculation | Target |
|--------|-------------|--------|
| **Stage Success Rate** | Passed Stages / Attempted Stages | > 80% |
| **Average GPA** | Sum of Stage GPAs / Stage Count | > 3.0 |
| **Cheat-Free Rate** | Clean Tests / Total Tests | 100% |
| **Human-Like Rate** | Human-Like Tests / Total Tests | > 90% |
| **Regression Rate** | Previously Passing Now Failing / Total | < 5% |

---

## 9. TARGET COMPARISON

### 9.1 Mission Pack Target Achievement

| Target Type | Definition | Measurement |
|-------------|------------|-------------|
| **Timing Met** | WNS ≥ target | Actual WNS vs target |
| **Area Met** | Area ≤ target | Actual area vs target |
| **Power Met** | Power ≤ target | Actual power vs target |
| **Runtime Met** | Runtime ≤ target | Actual vs estimated |

### 9.2 Target Achievement Score

```
Target Score = (Timing_Met + Area_Met + Power_Met + Runtime_Met) / 4

Where each Met = 1.0 if achieved, 0.5 if within 10%, 0.0 if missed
```

---

## 10. SUMMARY: KEY QUANTITATIVE TARGETS

| Category | Metric | Target | Minimum |
|----------|--------|--------|---------|
| **Certification** | GPA | 3.5 (Platinum) | 2.0 (Bronze) |
| **Flow Completion** | Stages Passed | 8/8 (100%) | 5/8 (62%) |
| **Layer Scores** | L1-L5 Average | 0.8 | 0.5 |
| **Cheat Detection** | Anti-Cheat Score | 1.0 | 1.0 |
| **Human-Like** | Behavior Score | 0.85 | 0.5 |
| **Evidence** | Correlation Score | 1.0 | 0.8 |
| **QoR** | WNS | ≥ 0 | ≥ -0.1 |
| **Targets** | Mission Achievement | 100% | 75% |

---

## 11. TRACKING TEMPLATE

```markdown
## Test Run: [ID]

### Overall Progress
- [ ] Bronze (GPA ≥ 2.0, 1+ stages)
- [ ] Silver (GPA ≥ 2.5, 3+ stages, 3+ agents)
- [ ] Gold (GPA ≥ 3.0, 5+ stages, 5 agents)
- [ ] Platinum (GPA ≥ 3.5, 8+ stages, targets met)

### Phase Status
| Phase | Status | GPA | Blocker |
|-------|--------|-----|---------|
| 0 | ⬜ | - | - |
| 1 | ⬜ | - | - |
| 2 | ⬜ | - | - |
| 3 | ⬜ | - | - |
| 4 | ⬜ | - | - |
| 5 | ⬜ | - | - |
| 6 | ⬜ | - | - |
| 7 | ⬜ | - | - |
| 8 | ⬜ | - | - |

### Stage Scores
| Stage | L1 | L2 | L3 | L4 | L5 | GPA |
|-------|----|----|----|----|----|-----|
| Synth | | | | | | |
| Init | | | | | | |
| FP | | | | | | |
| Place | | | | | | |
| CTS | | | | | | |
| Route | | | | | | |
| Finish | | | | | | |

### Quality Gates
- [ ] Anti-Cheat Score = 1.0
- [ ] Human-Like Score ≥ 0.5
- [ ] Evidence Correlation ≥ 0.8
- [ ] WNS ≥ -0.1
- [ ] GDS Generated
- [ ] Mission Targets Met

### Metrics
- **Overall GPA:**
- **Stages Passed:** / 8
- **Agents Active:** / 5
- **Progress:** %
- **ETA:**
```
