# EDA MCP Server - Technical Specification

> **Note:** This is the original Phase 1 design specification. The actual implementation has evolved significantly (48 tools, JavaScript instead of TypeScript). See [../mcp-servers.md](../mcp-servers.md) for the current API reference.

**Component:** `@hipilot/eda-mcp-server`
**Version:** Phase 1 (original design)
**Date:** 2026-02-19

---

## 1. Overview

The EDA MCP Server is the core bridge between Claude Code and EDA tools. It provides MCP tools for Tcl script generation, basic QoR extraction, job management, and tool detection.

**Key Design Changes:**
- **Simplified report handling:** AI comprehends raw report text instead of complex parsers
- **Minimal QoR extraction:** Only extract key metrics (WNS, TNS, counts)
- **Focus on templates:** Template-driven Tcl generation

## 2. MCP Tools

### 2.1 `eda.generate_tcl`

Generates a Tcl script from an action intent and parameters using Jinja2 templates.

**Input Schema:**

```json
{
  "action": "string — skill/template action name (e.g., 'fix_setup_timing')",
  "vendor": "string — 'synopsys' | 'cadence' (auto-detected if omitted)",
  "tool": "string — specific tool: 'icc2' | 'fc' | 'pt' | 'innovus' | 'tempus'",
  "params": {
    "description": "Action-specific parameters passed to the template"
  }
}
```

**Output Schema:**

```json
{
  "script": "string — rendered Tcl script",
  "script_path": "string — path where script was written",
  "template_used": "string — template file name",
  "trust_level": "'template' | 'doc_based' | 'unverified'",
  "source_attribution": "string | null — doc reference if doc-based",
  "reasoning": "string — explanation of generation approach"
}
```

**Behavior:**

1. Look up template: `{vendor}/{tool}_{action}.tcl.j2`
2. Validate params against template requirements
3. Render template with nunjucks (Jinja2-compatible)
4. Write rendered script to `/tmp/hipilot_{session}_{seq}.tcl`
5. Archive copy to `{project}/.hipilot/history/`
6. Return script content + metadata + reasoning

**Error cases:**

- Template not found → return `{trust_level: "doc_based"}` with empty script (LLM should use knowledge MCP)
- Invalid params → return validation error with details
- Render failure → return error with template context

### 2.2 `eda.send_to_terminal`

Sends a Tcl script to the EDA terminal pane for execution.

**Input Schema:**

```json
{
  "script_path": "string — path to the Tcl script file",
  "confirm": "boolean — if true, requires user confirmation first (default: true)"
}
```

**Output Schema:**

```json
{
  "sent": "boolean",
  "pane": "string — tmux pane identifier",
  "command": "string — the command sent (e.g., 'source /tmp/hipilot_001.tcl')"
}
```

**Behavior:**

1. Verify script file exists and is readable
2. Verify EDA terminal pane is active
3. Send `source {script_path}` via `tmux send-keys` to the EDA pane
4. Update status bar via tmux MCP

### 2.3 `eda.submit_batch`

Submits a Tcl script as a batch job via the configured job scheduler.

**Input Schema:**

```json
{
  "script_path": "string — path to the Tcl script file",
  "tool": "string — EDA tool to invoke (e.g., 'icc2_shell')",
  "queue": "string | null — job queue (default from config)",
  "memory": "string | null — memory request (default from config)",
  "cpu": "number | null — CPU count (default from config)",
  "job_name": "string | null — custom job name"
}
```

**Output Schema:**

```json
{
  "job_id": "string — scheduler job ID",
  "scheduler": "string — 'lsf' | 'sge' | 'slurm' | 'local'",
  "submit_command": "string — the actual submit command used",
  "log_file": "string — path to job log file"
}
```

### 2.4 `eda.extract_qor`

Extracts basic QoR metrics from an EDA report file (minimal parsing).

**Input Schema:**

```json
{
  "report_type": "string — 'timing' | 'power' | 'area' | 'drc' | 'qor'",
  "report_path": "string | null — explicit path (auto-detected if omitted)",
  "vendor": "string | null — 'synopsys' | 'cadence' (auto-detected)"
}
```

**Output Schema (timing example):**

```json
{
  "report_type": "timing",
  "vendor": "synopsys",
  "tool": "primetime",
  "summary": {
    "wns": -0.148,
    "tns": -1.82,
    "total_violations": 23,
    "total_endpoints": 15847
  },
  "raw_path": "/proj/reports/timing_post_route.rpt",
  "note": "AI should read full report for comprehensive analysis"
}
```

**Behavior:**
- Extract only key metrics (WNS, TNS, violation counts)
- Return path to full report for AI comprehension
- Don't build complex parsers - let AI read and understand

### 2.5 `eda.get_job_status`

Checks the status of a submitted batch job.

**Input Schema:**

```json
{
  "job_id": "string — scheduler job ID"
}
```

**Output Schema:**

```json
{
  "job_id": "string",
  "status": "'pending' | 'running' | 'completed' | 'failed'",
  "elapsed": "string — e.g., '45m 12s'",
  "exit_code": "number | null",
  "log_tail": "string — last 20 lines of log"
}
```

### 2.6 `eda.list_templates`

Lists available Tcl templates.

**Input Schema:**

```json
{
  "vendor": "string | null — filter by vendor",
  "tool": "string | null — filter by tool"
}
```

**Output Schema:**

```json
{
  "templates": [
    {
      "name": "icc2_fix_setup_timing",
      "vendor": "synopsys",
      "tool": "icc2",
      "path": "synopsys/icc2_fix_setup_timing.tcl.j2",
      "params": ["path_group", "max_paths", "strategies", "effort"],
      "description": "Fix setup timing violations via cell sizing and buffering"
    }
  ]
}
```

### 2.7 `eda.detect_tool`

Detects which EDA tool is currently running in the terminal.

**Input Schema:**

```json
{}
```

**Output Schema:**

```json
{
  "tool": "string | null — 'icc2' | 'innovus' | 'pt' | 'tempus' | null",
  "vendor": "string | null — 'synopsys' | 'cadence' | null",
  "version": "string | null",
  "detected_via": "string — 'process' | 'prompt' | 'pane_content'"
}
```

**Detection methods (in order):**

1. Check running processes for known EDA binaries
2. Capture EDA pane content and match tool-specific prompts (e.g., `icc2>`, `innovus>`)
3. Fall back to project config `eda.tool` setting

---

## 3. Tcl Template Engine

### 3.1 Template Structure

Templates are stored in a hierarchical directory:

```
templates/
├── synopsys/
│   ├── icc2_fix_setup_timing.tcl.j2
│   ├── icc2_fix_hold_timing.tcl.j2
│   ├── icc2_run_route_opt.tcl.j2
│   ├── icc2_read_design.tcl.j2
│   ├── icc2_save_design.tcl.j2
│   ├── icc2_report_timing.tcl.j2
│   ├── icc2_report_drc.tcl.j2
│   ├── icc2_report_power.tcl.j2
│   ├── icc2_report_area.tcl.j2
│   ├── pt_timing_analysis.tcl.j2
│   └── starrc_extraction.tcl.j2
├── cadence/
│   ├── innovus_fix_setup_timing.tcl.j2
│   ├── innovus_fix_hold_timing.tcl.j2
│   ├── innovus_run_route_opt.tcl.j2
│   ├── innovus_read_design.tcl.j2
│   ├── innovus_report_timing.tcl.j2
│   ├── innovus_report_drc.tcl.j2
│   ├── tempus_timing_analysis.tcl.j2
│   └── quantus_extraction.tcl.j2
└── common/
    ├── header.tcl.j2          (standard header with timestamp, intent)
    └── footer.tcl.j2          (standard footer with verification)
```

### 3.2 Template Resolution Order

```
1. {project}/.hipilot/templates/{vendor}/    (project-specific)
2. ~/.hipilot/templates/{vendor}/            (user-specific)
3. {install}/templates/{vendor}/             (built-in)
```

### 3.3 Template Conventions

Every template MUST:
- Include a header comment with timestamp, intent, and trust level
- Validate preconditions before executing (check design is loaded, etc.)
- Include post-execution verification (report command)
- Use parameterized values only — no hardcoded design-specific names
- Handle edge cases (e.g., zero violations found)

---

## 4. QoR Extraction (Simplified)

### 4.1 Extraction Interface

```typescript
interface QoRExtractor {
  extract(content: string): QoRMetrics;
  detect(content: string): boolean;  // auto-detect report type
}

interface QoRMetrics {
  type: 'timing' | 'power' | 'area' | 'drc' | 'qor';
  vendor: 'synopsys' | 'cadence';
  tool: string;
  summary: {
    wns?: number;
    tns?: number;
    violation_count?: number;
    // Add more as needed, but keep minimal
  };
  raw_path: string;
  note: string;  // "AI should read full report for analysis"
}
```

### 4.2 Timing QoR Extraction

**Minimal extraction:**
- WNS (worst negative slack)
- TNS (total negative slack)
- Violation count
- Path to full report

**AI comprehension:**
- AI reads full report text
- Understands violation patterns
- Identifies critical paths
- Provides analysis and suggestions

### 4.3 DRC QoR Extraction

**Minimal extraction:**
- Total violation count
- Top violation types
- Path to full report

**AI comprehension:**
- AI reads full DRC report
- Understands violation types
- Identifies hotspots
- Suggests fixes

---

## 5. Vendor Adapter Layer

### 5.1 Adapter Interface

```typescript
interface VendorAdapter {
  vendor: 'synopsys' | 'cadence';
  tools: string[];

  getTemplatePath(action: string, tool: string): string;
  getQoRExtractor(reportType: string): QoRExtractor;
  getToolPromptPattern(): RegExp;  // e.g., /^icc2>/
  getReportPath(reportType: string, projectConfig: ProjectConfig): string;
}
```

### 5.2 Synopsys Adapter

```typescript
class SynopsysAdapter implements VendorAdapter {
  vendor = 'synopsys';
  tools = ['icc2', 'fc', 'pt', 'starrc'];

  getToolPromptPattern() {
    return /^(icc2|dc_shell|pt_shell|fc_shell)>/;
  }

  getReportPath(type: string, config: ProjectConfig): string {
    // Standard Synopsys report naming conventions
    const patterns = {
      timing: `${config.paths.reports}/timing_*.rpt`,
      drc: `${config.paths.reports}/zroute_drc.rpt`,
      power: `${config.paths.reports}/power_*.rpt`,
      area: `${config.paths.reports}/area_*.rpt`,
    };
    return patterns[type];
  }
}
```

### 5.3 Cadence Adapter

```typescript
class CadenceAdapter implements VendorAdapter {
  vendor = 'cadence';
  tools = ['innovus', 'tempus', 'quantus'];

  getToolPromptPattern() {
    return /^(innovus|tempus|genus)(\s\d+)?>/;
  }
}
```

---

## 6. Job Manager

### 6.1 Job Submitter Interface

```typescript
interface JobSubmitter {
  type: 'lsf' | 'sge' | 'slurm' | 'local';
  submit(config: JobConfig): Promise<JobResult>;
  status(jobId: string): Promise<JobStatus>;
  cancel(jobId: string): Promise<void>;
}

interface JobConfig {
  script_path: string;
  tool: string;        // EDA tool binary name
  queue?: string;
  memory?: string;
  cpu?: number;
  job_name?: string;
}
```

### 6.2 LSF Submitter

```typescript
class LSFSubmitter implements JobSubmitter {
  type = 'lsf';

  async submit(config: JobConfig): Promise<JobResult> {
    const cmd = [
      'bsub',
      `-q ${config.queue || 'normal'}`,
      `-M ${config.memory || '32G'}`,
      `-n ${config.cpu || 8}`,
      `-J ${config.job_name || 'hipilot_job'}`,
      `-o ${config.script_path}.log`,
      `${config.tool} -f ${config.script_path}`
    ].join(' ');

    // Execute and parse job ID from "Job <12345> is submitted to queue <normal>"
    const output = await exec(cmd);
    const jobId = output.match(/Job <(\d+)>/)?.[1];
    return { job_id: jobId, submit_command: cmd };
  }

  async status(jobId: string): Promise<JobStatus> {
    const output = await exec(`bjobs -o "stat exit_code run_time" ${jobId}`);
    // Parse bjobs output
  }
}
```

---

## 7. Error Handling

| Error | Response |
|-------|----------|
| Template not found | Return `trust_level: "doc_based"`, signal LLM to use knowledge MCP |
| Template render failure | Return error with param mismatch details |
| EDA pane not active | Return error: "No EDA tool detected. Start your tool in the EDA pane." |
| Report file not found | Return error with suggested paths from project config |
| Job submission failure | Return error with scheduler error message |
| Invalid vendor/tool combination | Return error with supported combinations |

---

## 8. File Structure

```
@hipilot/eda-mcp-server/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── tools/
│   │   ├── generate-tcl.ts       # eda.generate_tcl implementation
│   │   ├── send-to-terminal.ts   # eda.send_to_terminal
│   │   ├── submit-batch.ts       # eda.submit_batch
│   │   ├── extract-qor.ts        # eda.extract_qor (minimal parsing)
│   │   ├── get-job-status.ts     # eda.get_job_status
│   │   ├── list-templates.ts     # eda.list_templates
│   │   └── detect-tool.ts        # eda.detect_tool
│   ├── templates/
│   │   └── engine.ts             # Nunjucks template renderer
│   ├── qor/
│   │   ├── qor-extractor.ts      # Base QoR extractor
│   │   ├── timing-extractor.ts   # Timing QoR (minimal)
│   │   ├── drc-extractor.ts      # DRC QoR (minimal)
│   │   ├── power-extractor.ts    # Power QoR (minimal)
│   │   └── area-extractor.ts     # Area QoR (minimal)
│   ├── adapters/
│   │   ├── base-adapter.ts
│   │   ├── synopsys-adapter.ts
│   │   └── cadence-adapter.ts
│   ├── jobs/
│   │   ├── job-manager.ts
│   │   ├── lsf-submitter.ts
│   │   ├── sge-submitter.ts
│   │   ├── slurm-submitter.ts
│   │   └── local-submitter.ts
│   └── config.ts                 # Configuration loader
├── templates/
│   ├── synopsys/                 # Synopsys Tcl templates
│   ├── cadence/                  # Cadence Tcl templates
│   └── common/                   # Shared template fragments
├── package.json
└── tsconfig.json
```

---

## 9. Testing on Real Design

### Ibex Core Testing

All features tested on Ibex core design:
- **Server:** 192.168.112.163 (CentOS 7)
- **Design:** Ibex RISC-V CPU
- **Flow:** RTL-to-GDS
- **Reports:** Real timing, DRC, power, area reports

### Test Cases

| Feature | Test Case |
|---------|-----------|
| Tcl generation | Generate scripts for each flow stage |
| QoR extraction | Extract metrics from real reports |
| Job submission | Submit jobs via LSF/SGE/Slurm |
| Tool detection | Detect ICC2, Innovus, PrimeTime, Tempus |
| Send-to-EDA | Send scripts to EDA terminal |
| Template rendering | Render all built-in templates |

---

## 10. Platform Compatibility

### CentOS 7 (glibc 2.17)

- **Node.js:** v20.18.3 (glibc-217 build for CentOS 7)
- **Testing:** All features tested on EDA server
- **Validation:** Screen recordings on CentOS 7

### Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | v20.18.3 | CentOS 7 compatible (glibc-217 build) |
| TypeScript | 5.x | Development |
| nunjucks | 3.x | Template rendering |
| better-sqlite3 | 9.x | Database (for future features) |
