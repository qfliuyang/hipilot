# HiPilot Development & Test Plan

**Date:** 2026-02-21
**Version:** v0.4.0 → v1.0.0
**Objective:** Close critical gaps to reach PRD compliance

---

## Phase Overview

| Phase | Focus | Duration | Target Completion |
|-------|-------|----------|-------------------|
| Phase 1 | Critical Gaps | 2 weeks | 2026-03-07 |
| Phase 2 | High Priority | 2 weeks | 2026-03-21 |
| Phase 3 | Polish & Hardening | 1 week | 2026-03-28 |
| Phase 4 | E2E Validation | 1 week | 2026-04-04 |

**Total Duration:** 6 weeks to v1.0.0

---

## Phase 1: Critical Gaps (Weeks 1-2)

### 1.1 Quick Commands Implementation

**Objective:** Implement `/timing`, `/drc`, `/compare`, `/history` commands

#### Tasks

| ID | Task | Owner | Effort | Depends On |
|----|------|-------|--------|------------|
| 1.1.1 | Create quick command parser in main CLI | TBD | 1d | - |
| 1.1.2 | Implement `/timing [group]` - run timing report skill | TBD | 2d | 1.1.1 |
| 1.1.3 | Implement `/drc` - run DRC check skill | TBD | 1d | 1.1.1 |
| 1.1.4 | Implement `/compare last` - compare QoR with checkpoint | TBD | 2d | 1.1.1 |
| 1.1.5 | Implement `/history` - show session Tcl commands | TBD | 1d | 1.1.1 |
| 1.1.6 | Add help text for all quick commands | TBD | 0.5d | 1.1.1-1.1.5 |

#### Testing Strategy

```javascript
// Unit Tests
- Parser correctly identifies each command
- Invalid commands show helpful error
- Parameters passed correctly to skills

// Integration Tests
- Each command executes correct skill
- Output displayed in chat pane
- Error handling works (no design loaded, etc.)

// E2E Tests
- Record video of each quick command
- Verify output appears in EDA pane
- Verify report captured and analyzed
```

#### Done Criteria
- [ ] All 4 quick commands work via CLI
- [ ] Commands shown in `hipilot --help`
- [ ] Each command has E2E test with video evidence
- [ ] Commands work with both ICC2 and Innovus

---

### 1.2 AI Report Comprehension

**Objective:** Connect captured report output to LLM for analysis

#### Tasks

| ID | Task | Owner | Effort | Depends On |
|----|------|-------|--------|------------|
| 1.2.1 | Create `analyze_report` tool in EDA MCP | TBD | 2d | - |
| 1.2.2 | Design prompt for timing report analysis | TBD | 1d | 1.2.1 |
| 1.2.3 | Design prompt for DRC report analysis | TBD | 1d | 1.2.1 |
| 1.2.4 | Implement report capture → LLM → insight flow | TBD | 2d | 1.2.1-1.2.3 |
| 1.2.5 | Add "Analyze this report" action button | TBD | 1d | 1.2.4 |
| 1.2.6 | Cache report analysis results | TBD | 1d | 1.2.4 |

#### Testing Strategy

```javascript
// Unit Tests
- Prompt includes full report text
- LLM response parsed correctly
- Insights extracted and formatted

// Integration Tests
- Real timing report from Ibex design
- Real DRC report from Ibex design
- Analysis completes within 10s

// E2E Tests
- HiTestBot records: /timing → capture → analyze flow
- Video shows AI analysis appearing
- Compare AI analysis vs raw report
```

#### Done Criteria
- [ ] AI analyzes timing reports and identifies critical paths
- [ ] AI analyzes DRC reports and categorizes violations
- [ ] Analysis appears within 10 seconds
- [ ] E2E test with video evidence

---

### 1.3 `/skill-gen` Command

**Objective:** Expose skill generator to users via CLI

#### Tasks

| ID | Task | Owner | Effort | Depends On |
|----|------|-------|--------|------------|
| 1.3.1 | Add `/skill-gen` command to CLI parser | TBD | 1d | - |
| 1.3.2 | Create interactive skill generation workflow | TBD | 2d | 1.3.1 |
| 1.3.3 | Add preview step before save | TBD | 1d | 1.3.2 |
| 1.3.4 | Save to `.hipilot/skills/` directory | TBD | 1d | 1.3.2 |
| 1.3.5 | Validate generated skill format | TBD | 1d | 1.3.4 |

#### Testing Strategy

```javascript
// Unit Tests
- Parser extracts workflow from sample email
- Generator creates valid YAML frontmatter
- Preview shows correct markdown

// Integration Tests
- Generate skill from sample runbook text
- Generated skill loads correctly
- Generated skill produces valid Tcl

// E2E Tests
- Record: paste email → /skill-gen → preview → save
- Verify saved skill appears in `hipilot skills`
- Test generated skill on Ibex design
```

#### Done Criteria
- [ ] `/skill-gen` command available in CLI
- [ ] Can generate skill from pasted text
- [ ] Preview before save works
- [ ] Generated skill passes validation
- [ ] E2E test with video evidence

---

## Phase 2: High Priority (Weeks 3-4)

### 2.1 Trust Badges & Source Attribution

**Objective:** Show `[✓ Template]`, `[📖 Doc-based]`, `[⚠ Unverified]` badges

#### Tasks

| ID | Task | Owner | Effort | Depends On |
|----|------|-------|--------|------------|
| 2.1.1 | Add badge field to Tcl generation response | TBD | 1d | - |
| 2.1.2 | Display badge in CLI output | TBD | 1d | 2.1.1 |
| 2.1.3 | Add source attribution (template name/doc ref) | TBD | 1d | 2.1.1 |
| 2.1.4 | Color-code badges (green/yellow/red) | TBD | 0.5d | 2.1.2 |

#### Testing Strategy

```javascript
// Unit Tests
- Badge correctly identified by generation source
- Attribution shows correct template path

// Integration Tests
- Template-based → [✓ Template] badge
- Doc-based → [📖 Doc-based] badge
- Fallback → [⚠ Unverified] badge

// E2E Tests
- Record: generate Tcl → verify badge shown
- All 3 badge types captured on video
```

---

### 2.2 Edit Before Run Workflow

**Objective:** Add `[✎ Edit]` action to modify Tcl before execution

#### Tasks

| ID | Task | Owner | Effort | Depends On |
|----|------|-------|--------|------------|
| 2.2.1 | Create temp file with generated Tcl | TBD | 1d | - |
| 2.2.2 | Launch $EDITOR with temp file | TBD | 1d | 2.2.1 |
| 2.2.3 | Capture edited content | TBD | 1d | 2.2.2 |
| 2.2.4 | Show diff between original and edited | TBD | 1d | 2.2.3 |
| 2.2.5 | Add edit action to UI | TBD | 1d | 2.2.1-2.2.4 |

#### Testing Strategy

```javascript
// Unit Tests
- Temp file created with correct content
- Editor launches and returns on save
- Changes captured correctly

// Integration Tests
- Edit workflow end-to-end
- Cancel edit returns to original
- Edited Tcl sent to EDA tool

// E2E Tests
- Record: generate → edit → run flow
- Video shows vim/nano opening
- Video shows edited Tcl executing
```

---

### 2.3 Keyboard Shortcuts

**Objective:** Add Ctrl+Enter for Run, other shortcuts

#### Tasks

| ID | Task | Owner | Effort | Depends On |
|----|------|-------|--------|------------|
| 2.3.1 | Implement key capture in tmux pane | TBD | 2d | - |
| 2.3.2 | Map Ctrl+Enter to Run action | TBD | 1d | 2.3.1 |
| 2.3.3 | Map Ctrl+E to Edit action | TBD | 0.5d | 2.3.1 |
| 2.3.4 | Map Ctrl+S to Save action | TBD | 0.5d | 2.3.1 |
| 2.3.5 | Show shortcut hints in UI | TBD | 1d | 2.3.1-2.3.4 |

#### Testing Strategy

```javascript
// Unit Tests
- Key combinations detected correctly
- Actions triggered on correct keys

// Integration Tests
- Ctrl+Enter sends to EDA pane
- Shortcuts work in both panes

// E2E Tests
- Record: use Ctrl+Enter to run Tcl
- Video shows keyboard shortcut working
```

---

## Phase 3: Polish & Hardening (Week 5)

### 3.1 Multi-turn Context

**Objective:** Maintain conversation history

| Task | Effort |
|------|--------|
| Store conversation history per session | 1d |
| Include previous context in LLM prompts | 2d |
| Show conversation thread in UI | 1d |
| Clear history command | 0.5d |

### 3.2 Power/Area Report Support

**Objective:** Extend report comprehension to power/area

| Task | Effort |
|------|--------|
| Add power report parsing | 1d |
| Add area report parsing | 1d |
| Add `/power` quick command | 0.5d |
| Add `/area` quick command | 0.5d |

### 3.3 Error Handling & Edge Cases

**Objective:** Harden against failures

| Task | Effort |
|------|--------|
| Handle missing design gracefully | 1d |
| Handle SSH disconnections | 1d |
| Handle LLM timeout/failure | 1d |
| Add retry logic for flaky operations | 1d |

---

## Phase 4: E2E Validation (Week 6)

### 4.1 Full Feature E2E Tests

Each feature must have:
- Video recording from EDA server
- Evidence in `e2e_evidence/`
- HiTestBot report

| Feature | Test Scenario |
|---------|---------------|
| Quick Commands | Run all 4 commands on Ibex design |
| AI Report Analysis | Generate timing report → AI analyzes → shows insights |
| Skill Generation | Paste runbook → generate skill → use skill |
| Trust Badges | Generate from template, doc, fallback → verify badges |
| Edit Workflow | Generate Tcl → edit in vim → execute |
| Keyboard Shortcuts | Use Ctrl+Enter, Ctrl+E, Ctrl+S |

### 4.2 Performance Validation

| Metric | Target | Test |
|--------|--------|------|
| Tcl generation | < 5s | Time 10 generations |
| Report analysis | < 10s | Time analysis of 3 reports |
| Skill generation | < 15s | Time 5 skill generations |

### 4.3 Stress Testing

| Scenario | Duration | Success Criteria |
|----------|----------|------------------|
| Long session (4 hours) | 4h | No memory leaks, responsive |
| Many skills (50+) | 1h | All skills load correctly |
| Large report (10MB) | 30m | Analysis completes, no crash |

---

## Testing Infrastructure

### HiTestBot Test Matrix

```yaml
Test Scenarios:
  - name: "Quick Commands"
    commands: ["/timing", "/drc", "/compare", "/history"]
    eda_tools: ["innovus", "icc2"]
    required: true

  - name: "AI Report Analysis"
    flows: ["timing", "drc", "power", "area"]
    validate: "AI insights appear"
    required: true

  - name: "Skill Generation"
    inputs: ["email", "wiki", "runbook"]
    validate: "skill validates and works"
    required: true

  - name: "Edit Workflow"
    steps: ["generate", "edit", "execute"]
    editors: ["vim", "nano"]
    required: false

  - name: "Keyboard Shortcuts"
    shortcuts: ["Ctrl+Enter", "Ctrl+E", "Ctrl+S"]
    required: false
```

### E2E Evidence Requirements

Every feature completion MUST include:
1. Video recording (MP4, 1-5 minutes)
2. Final screenshot (PNG)
3. Tmux pane captures (logs)
4. HiTestBot report (MD)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM latency too high | Add caching, async analysis with progress indicator |
| Editor workflow complex | Support $EDITOR fallback, clear error messages |
| SSH flaky | Add connection retry, better error messages |
| Report too large for LLM | Chunk analysis, focus on summary sections |

---

## Definition of Done (v1.0.0)

### Must Have (Critical Gaps)
- [ ] All 4 quick commands implemented and tested
- [ ] AI report comprehension working for timing/DRC
- [ ] `/skill-gen` command functional
- [ ] E2E tests with video for all critical features

### Should Have (High Priority)
- [ ] Trust badges visible in output
- [ ] Source attribution shown
- [ ] Edit-before-run workflow
- [ ] Keyboard shortcuts working

### Nice to Have (Medium Priority)
- [ ] Multi-turn context
- [ ] Power/area report support
- [ ] Semantic search

---

## Success Metrics (v1.0.0 Target)

| Metric | v0.4.0 | v1.0.0 Target |
|--------|--------|---------------|
| Tcl accuracy | ~90% | >95% |
| Quick command coverage | 0% | 100% (4/4) |
| AI report analysis | 0% | 100% (timing/DRC) |
| Skill auto-generation | 0% | Functional |
| Feature video evidence | 1 | 10+ |

---

*Plan created for HiPilot v0.4.0 → v1.0.0*
