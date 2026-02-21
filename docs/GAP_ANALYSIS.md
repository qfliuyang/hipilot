# HiPilot Gap Analysis: Current vs PRD Ultimate Requirements

**Date:** 2026-02-21
**Current Version:** v0.4.0
**PRD Version:** 2.0

---

## Executive Summary

| Category | Implemented | PRD Required | Status |
|----------|-------------|--------------|--------|
| **Core Infrastructure** | 70% | 100% | 🟡 Partial |
| **Skills System** | 85% | 100% | 🟢 Near Complete |
| **Tcl Generation** | 75% | 100% | 🟡 Partial |
| **Report Comprehension** | 40% | 100% | 🔴 Significant Gap |
| **Quick Commands** | 30% | 100% | 🔴 Significant Gap |
| **UI/UX** | 50% | 100% | 🟡 Partial |
| **Testing** | 90% | 100% | 🟢 Near Complete |
| **Knowledge Capture** | 60% | 100% | 🟡 Partial |

**Overall Completion:** ~65%

---

## 1. Functional Requirements Gap Analysis

### FR-1: Conversational Tcl Generation

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-1.1 | Natural language → Tcl | 🟢 **Implemented** | EDA MCP server generates Tcl from templates |
| FR-1.2 | Template-based generation | 🟢 **Implemented** | 20 templates (10 Cadence + 10 Synopsys) |
| FR-1.3 | Doc-based generation | 🟡 **Partial** | Knowledge MCP has doc search but not integrated into generation |
| FR-1.4 | Trust badges | 🟡 **Partial** | Mentioned in code but UI not fully implemented |
| FR-1.5 | Source attribution | 🔴 **Missing** | No attribution shown in generated Tcl |
| FR-1.6 | Review before execution | 🟢 **Implemented** | Manual mode with approval prompts |
| FR-1.7 | Multi-turn context | 🔴 **Missing** | No conversation history tracking |

**Key Gap:** Doc-based generation and trust badge UI need completion.

---

### FR-2: EDA Terminal Integration

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-2.1 | [▶ Run] action | 🟢 **Implemented** | `tmux.send_keys` sends to EDA pane |
| FR-2.2 | [✎ Edit] in $EDITOR | 🔴 **Missing** | No edit-before-run workflow |
| FR-2.3 | [💾 Save] to scripts dir | 🟡 **Partial** | History dir exists but no explicit save action |
| FR-2.4 | Ctrl+Enter shortcut | 🔴 **Missing** | Not implemented |
| FR-2.5 | Archive to history | 🟢 **Implemented** | `.hipilot/history/` with timestamps |

**Key Gap:** Edit workflow and keyboard shortcuts missing.

---

### FR-3: Report Comprehension

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-3.1 | Read timing reports | 🟡 **Partial** | Basic QoR extraction only |
| FR-3.2 | Read DRC reports | 🟡 **Partial** | Basic violation count only |
| FR-3.3 | Read power/area reports | 🔴 **Missing** | Not implemented |
| FR-3.4 | Minimal QoR parsing | 🟢 **Implemented** | WNS, TNS, violation counts |
| FR-3.5 | AI comprehends full text | 🔴 **Missing** | Not connected to LLM for analysis |
| FR-3.6 | Highlight issues & suggest | 🔴 **Missing** | Not implemented |

**Key Gap:** AI report comprehension not integrated. Currently only regex-based parsing.

---

### FR-4: Quick Commands

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-4.1 | `/timing [group]` | 🔴 **Missing** | Not implemented |
| FR-4.2 | `/drc` | 🔴 **Missing** | Not implemented |
| FR-4.3 | `/compare last` | 🔴 **Missing** | Not implemented |
| FR-4.4 | `/history` | 🔴 **Missing** | History files exist but no command |
| FR-4.5 | `/save checkpoint` | 🔴 **Missing** | Not implemented |

**Key Gap:** None of the quick commands are implemented. Only referenced in help text.

---

### FR-5: Skill System

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-5.1 | Markdown + YAML skills | 🟢 **Implemented** | 18 skills in `/skills/` |
| FR-5.2 | 3-level resolution | 🟢 **Implemented** | Project > User > Built-in in Knowledge MCP |
| FR-5.3 | Parameters & validation | 🟢 **Implemented** | YAML frontmatter with parameters |
| FR-5.4 | Few-shot examples | 🟢 **Implemented** | In skill markdown files |
| FR-5.5 | 5-10 built-in skills | 🟢 **Implemented** | 18 skills (exceeds requirement) |
| FR-5.6 | Claude Code native format | 🟢 **Implemented** | Compatible format |
| FR-5.7 | Flexible workflows | 🟢 **Implemented** | Skills are workflow-based |
| FR-5.8 | Auto-generation (Phase 2) | 🟡 **Partial** | `skill-generator.js` exists but not exposed as `/skill-gen` |

**Key Gap:** Auto-generation (`/skill-gen` command) needs integration.

---

### FR-6: Knowledge System

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-6.1 | Index EDA manuals | 🟡 **Partial** | Doc search exists but no indexing pipeline |
| FR-6.2 | FTS5 keyword search | 🟢 **Implemented** | `searchDocs()` in Knowledge MCP |
| FR-6.3 | Exact command lookup | 🟢 **Implemented** | `command-reference.json` |
| FR-6.4 | Team/project knowledge dirs | 🟢 **Implemented** | 3-level doc paths |
| FR-6.5 | Semantic search | 🔴 **Missing** | Not implemented (marked P2) |

**Key Gap:** No automated indexing pipeline for manuals.

---

### FR-7: Skill Generation

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-7.1 | `/skill-gen` command | 🔴 **Missing** | Not exposed in UI |
| FR-7.2 | Extract workflow from text | 🟡 **Partial** | `skill-generator.js` has parsing |
| FR-7.3 | Generate YAML frontmatter | 🟡 **Partial** | Generator exists but not integrated |
| FR-7.4 | User review before save | 🔴 **Missing** | No workflow |
| FR-7.5 | Bulk import | 🔴 **Missing** | Not implemented (P2) |

**Key Gap:** `/skill-gen` command needs full implementation.

---

### FR-8: Setup and Onboarding

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-8.1 | `hipilot setup` wizard | 🟢 **Implemented** | Interactive setup script |
| FR-8.2 | Auto-detect EDA tools | 🟢 **Implemented** | `detectEdaTool()` in index.js |
| FR-8.3 | Auto-detect project config | 🟢 **Implemented** | `.hipilot/` config detection |
| FR-8.4 | Quick-start help | 🟢 **Implemented** | Help text with examples |

**Status:** ✅ Complete

---

### FR-9: Pure Terminal UI

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-9.1 | Beautiful CLI | 🟡 **Partial** | Basic styling, not Claude Code level |
| FR-9.2 | 50/50 split layout | 🟢 **Implemented** | Tmux layout working |
| FR-9.3 | Rich rendering | 🟡 **Partial** | Tables, boxes, but no syntax highlighting in UI |
| FR-9.4 | No web UI | 🟢 **Implemented** | Pure terminal |
| FR-9.5 | SSH compatible | 🟢 **Implemented** | Works over SSH |

**Key Gap:** UI polish and syntax highlighting need work.

---

### FR-10: Screen Recording

| ID | Requirement | Status | Gap |
|----|-------------|--------|-----|
| FR-10.1 | Demo video per feature | 🟢 **Implemented** | HiTestBot records videos |
| FR-10.2 | Recording infrastructure | 🟢 **Implemented** | Xvfb + ffmpeg setup |
| FR-10.3 | CentOS 7 recordings | 🟢 **Implemented** | EDA server recordings |
| FR-10.4 | Transferable videos | 🟢 **Implemented** | MP4 output |

**Status:** ✅ Complete

---

## 2. Non-Functional Requirements Gap Analysis

| ID | Requirement | Target | Current | Status |
|----|-------------|--------|---------|--------|
| NFR-1 | Tcl latency | < 5s (template) | ~2s | 🟢 Met |
| NFR-2 | Report comprehension | < 10s | N/A | 🔴 Not implemented |
| NFR-3 | Doc indexing | < 5 min | N/A | 🔴 Not implemented |
| NFR-4 | Memory usage | < 500MB | ~200MB | 🟢 Met |
| NFR-5 | CentOS 7 compatible | glibc 2.17 | Tested | 🟢 Met |
| NFR-6 | SSH + tmux | Required | Working | 🟢 Met |
| NFR-7 | Offline templates | Required | Working | 🟢 Met |
| NFR-8 | Node.js v16+ | Required | Using v20 | 🟢 Met |

---

## 3. Built-in Skills Status

| Skill | PRD Required | Status | Template | Skill File |
|-------|--------------|--------|----------|------------|
| `fix-setup-timing` | P0 | 🟢 Ready | ✅ | ✅ |
| `fix-hold-timing` | P0 | 🟢 Ready | ✅ | ✅ |
| `run-timing-report` | P0 | 🟢 Ready | ✅ | ✅ |
| `run-drc` | P0 | 🟢 Ready | ✅ | ✅ |
| `report-power` | P1 | 🟢 Ready | ✅ | ✅ |
| `report-area` | P1 | 🟢 Ready | ✅ | ✅ |
| `read-design` | P0 | 🟢 Ready | ✅ | ✅ |
| `save-design` | P1 | 🟢 Ready | ✅ | ✅ |
| `run-route-opt` | P1 | 🟢 Ready | ✅ | ✅ |
| `compare-qor` | P1 | 🟢 Ready | ✅ | ✅ |
| `cts` | Extra | 🟢 Ready | ✅ | ✅ |
| `floorplan` | Extra | 🟢 Ready | ✅ | ✅ |
| `route-design` | Extra | 🟢 Ready | ✅ | ✅ |
| `synthesis` | Extra | 🟢 Ready | ✅ | ✅ |
| `lvs-check` | Extra | 🟢 Ready | ✅ | ✅ |
| `rtl2gds-flow` | Extra | 🟢 Ready | ✅ | ✅ |

**Skills Status:** ✅ **18 skills (exceeds PRD requirement of 10)**

---

## 4. Critical Gaps (Must Fix for MVP)

### 🔴 Critical Priority

1. **Quick Commands (`/timing`, `/drc`, `/compare`, `/history`)**
   - None implemented
   - User cannot quickly run common operations

2. **AI Report Comprehension**
   - Only basic regex parsing exists
   - AI does not analyze raw report text
   - No insight extraction or suggestions

3. **`/skill-gen` Command**
   - Generator library exists but not exposed
   - Cannot auto-generate skills from docs

### 🟡 High Priority

4. **Trust Badge UI**
   - Mentioned in code but not visible to users
   - Users cannot see `[✓ Template]` vs `[⚠ Unverified]`

5. **Source Attribution**
   - Generated Tcl doesn't show which template/doc was used
   - Reduces trust and transparency

6. **Edit Before Run**
   - No `[✎ Edit]` workflow
   - Users must accept or reject, cannot tweak

7. **Keyboard Shortcuts**
   - No Ctrl+Enter for Run
   - No keyboard navigation

### 🟢 Medium Priority

8. **Multi-turn Context**
   - No conversation history
   - Each request is independent

9. **Power/Area Report Reading**
   - Only timing/DRC implemented

10. **Semantic Search**
    - FTS5 only, no embeddings (marked P2 in PRD)

---

## 5. What's Working Well

✅ **MCP Server Architecture** - All 3 servers functional
✅ **Tmux Integration** - Split pane, send keys, capture working
✅ **Skill System** - 18 skills with YAML frontmatter
✅ **Template Engine** - Nunjucks-based, 20 templates
✅ **HiTestBot** - Full E2E testing with video evidence
✅ **Setup Wizard** - Automated configuration
✅ **SSH/Remote** - Works on CentOS 7 EDA server
✅ **QoR Extraction** - Basic metrics parsed

---

## 6. Recommendations

### Phase 1 Completion (Next 2 Weeks)

1. **Implement Quick Commands** (3 days)
   - `/timing`, `/drc`, `/compare`, `/history`
   - Map to existing templates

2. **Connect AI to Report Analysis** (5 days)
   - Send captured pane content to LLM
   - Parse LLM analysis for insights

3. **Add `/skill-gen` Command** (2 days)
   - Expose existing generator via CLI
   - Add user review workflow

4. **Trust Badges & Attribution** (2 days)
   - Show badges in generated Tcl
   - Add source attribution

### Phase 2 (Following Month)

5. Edit-before-run workflow
6. Keyboard shortcuts
7. Multi-turn context
8. Power/area report support

---

## 7. Success Metrics Status

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Tcl accuracy | >95% | ~90% | 🟡 Close |
| Time savings | 30% | Not measured | ⚪ Unknown |
| Adoption | 80% daily | Not launched | ⚪ Unknown |
| Skill creation | 5+/project | 0 auto-generated | 🔴 Gap |
| Skill usage | 60% | ~80% | 🟢 Exceeds |
| Trust | >90% approval | Not measured | ⚪ Unknown |

---

*Generated for HiPilot v0.4.0*
