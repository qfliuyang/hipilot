/**
 * ASIC-Brain EDA Output Parser
 *
 * Parses EDA tool outputs and returns structured data that HiPilot can understand.
 * Part of the ASIC-Brain (Customer Owned Technology Brain) subsystem for intelligent output analysis.
 *
 * Formerly part of LittleBrain - renamed to reflect the dual-brain architecture
 * alongside Project-Brain.
 */

/**
 * Main entry point for parsing EDA output
 * @param {string} output - Raw EDA output text
 * @param {string} tool - Tool name (innovus, dc_shell, pt_shell, etc.)
 * @returns {object} Structured parse result
 */
export function parseOutput(output, tool = 'auto') {
  if (!output || typeof output !== 'string') {
    return {
      success: false,
      error: 'Invalid output: expected non-empty string',
      errors: [],
      qor: null,
      state: 'unknown',
      recommendations: [],
    };
  }

  // Auto-detect tool if not specified
  const detectedTool = tool === 'auto' ? detectTool(output) : tool;

  // Extract all information
  const errors = extractErrors(output);
  const qor = extractQoR(output);
  const state = detectToolState(output);
  const warnings = extractWarnings(output);

  // Generate recommendations based on parsed data
  const parsed = {
    tool: detectedTool,
    errors,
    warnings,
    qor,
    state,
    output_length: output.length,
  };

  const recommendations = recommendRecovery(parsed);

  return {
    success: errors.length === 0,
    tool: detectedTool,
    state,
    errors,
    warnings,
    qor,
    recommendations,
    summary: generateSummary(parsed),
  };
}

/**
 * Detect which tool produced the output
 * @param {string} output - EDA output text
 * @returns {string} Detected tool name
 */
function detectTool(output) {
  const patterns = [
    { tool: 'innovus', pattern: /innovus\s*\d*>|Cadence\s+Innovus/i },
    { tool: 'dc_shell', pattern: /dc_shell>|Design\s+Compiler/i },
    { tool: 'pt_shell', pattern: /pt_shell>|PrimeTime/i },
    { tool: 'icc2', pattern: /icc2\s*\d*>|IC\s+Compiler\s+II/i },
    { tool: 'starrc', pattern: /starrc>|StarRC/i },
    { tool: 'bash', pattern: /\[.*@.*\][#$]|bash-\d+\.[\d#$]/i },
  ];

  for (const { tool, pattern } of patterns) {
    if (pattern.test(output)) return tool;
  }

  return 'unknown';
}

/**
 * Extract and classify errors from EDA output
 * @param {string} output - EDA output text
 * @returns {array} Array of error objects with severity, type, message, location
 */
export function extractErrors(output) {
  const errors = [];
  const lines = output.split('\n');

  // Error pattern definitions with severity classification
  const errorPatterns = [
    // Syntax errors
    {
      type: 'syntax',
      severity: 'High',
      patterns: [
        /unknown\s+command/i,
        /invalid\s+command/i,
        /syntax\s+error/i,
        /unexpected\s+token/i,
        /missing\s+operand/i,
        /unmatched\s+(?:brace|bracket|parenthesis)/i,
        /bad\s+expression/i,
      ],
    },
    // Constraint errors
    {
      type: 'constraint',
      severity: 'High',
      patterns: [
        /cannot\s+find\s+(?:ports?|pins?|nets?|cells?)/i,
        /constraint\s+error/i,
        /invalid\s+constraint/i,
        /missing\s+constraint/i,
        /SDC\s+error/i,
        /clock\s+undefined/i,
        /no\s+clock\s+found/i,
      ],
    },
    // Tool/execution errors
    {
      type: 'tool',
      severity: 'High',
      patterns: [
        /^\*\*ERROR/i,
        /^Error:/i,
        /ERROR:/i,
        /FATAL/i,
        /INTERNAL\s+ERROR/i,
        /segmentation\s+fault/i,
        /core\s+dumped/i,
        /license\s+error/i,
        /failed\s+to\s+open/i,
        /file\s+not\s+found/i,
        /permission\s+denied/i,
      ],
    },
    // Design errors
    {
      type: 'design',
      severity: 'Medium',
      patterns: [
        /unconnected\s+(?:ports?|nets?)/i,
        /multiple\s+drivers/i,
        /no\s+drivers/i,
        /loading\s+error/i,
        /design\s+not\s+found/i,
        /module\s+not\s+found/i,
        /reference\s+not\s+found/i,
      ],
    },
    // Timing violations (reported as errors in some contexts)
    {
      type: 'timing',
      severity: 'Medium',
      patterns: [
        /VIOLATED.*slack/i,
        /timing\s+violation\s*(?:error|failed)/i,
        /setup\s+violation\s*(?:error|failed)/i,
        /hold\s+violation\s*(?:error|failed)/i,
      ],
    },
    // Library/technology errors
    {
      type: 'library',
      severity: 'High',
      patterns: [
        /library\s+not\s+found/i,
        /tech\s+file\s+error/i,
        /lef\s+error/i,
        /def\s+error/i,
        /gds\s+error/i,
        /parasitics\s+error/i,
      ],
    },
  ];

  // Track seen errors to avoid duplicates
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    for (const category of errorPatterns) {
      for (const pattern of category.patterns) {
        const match = line.match(pattern);
        if (match && !seen.has(line.trim())) {
          seen.add(line.trim());

          // Try to extract file/line information
          const location = extractLocation(line, lines, i);

          errors.push({
            severity: category.severity,
            type: category.type,
            message: line.trim(),
            matched_pattern: match[0],
            line_number: i + 1,
            file: location.file,
            source_line: location.line,
            context: extractContext(lines, i),
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Extract file and line number information from error context
 * @param {string} line - Current line
 * @param {array} lines - All lines
 * @param {number} index - Current line index
 * @returns {object} File and line information
 */
function extractLocation(line, lines, index) {
  // Patterns for file:line references
  const filePatterns = [
    /(?:file|in)\s+["']?([^"':\s]+)["']?(?::\s*(\d+))?/i,
    /([^\s:]+\.(?:tcl|v|sv|sdc|enc|lef|def|gds)):(\d+)/i,
    /line\s+(\d+)\s+(?:of|in)\s+["']?([^"':\s]+)["']?/i,
  ];

  for (const pattern of filePatterns) {
    const match = line.match(pattern);
    if (match) {
      // Check which capture group is the file vs line
      const file = match[2] && match[2].match(/^\d+$/) ? match[1] : match[1];
      const lineNum = match[2] && match[2].match(/^\d+$/) ? match[2] : match[1];
      return { file, line: lineNum };
    }
  }

  // Look in surrounding lines for context
  for (let i = Math.max(0, index - 3); i <= Math.min(lines.length - 1, index + 3); i++) {
    for (const pattern of filePatterns) {
      const match = lines[i].match(pattern);
      if (match) {
        return { file: match[1], line: match[2] || null };
      }
    }
  }

  return { file: null, line: null };
}

/**
 * Extract context around a line
 * @param {array} lines - All lines
 * @param {number} index - Center line index
 * @param {number} radius - Context radius
 * @returns {string} Context text
 */
function extractContext(lines, index, radius = 2) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Extract warnings from EDA output
 * @param {string} output - EDA output text
 * @returns {array} Array of warning objects
 */
function extractWarnings(output) {
  const warnings = [];
  const lines = output.split('\n');

  const warningPatterns = [
    /^\*\*WARN/i,
    /^Warning:/i,
    /WARNING:/i,
    /warning:/i,
  ];

  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of warningPatterns) {
      if (pattern.test(line) && !seen.has(line.trim())) {
        seen.add(line.trim());
        warnings.push({
          message: line.trim(),
          line_number: i + 1,
          context: extractContext(lines, i, 1),
        });
      }
    }
  }

  return warnings;
}

/**
 * Extract QoR metrics from EDA output
 * @param {string} output - EDA output text
 * @returns {object} Structured QoR metrics
 */
export function extractQoR(output) {
  const metrics = {
    // Timing metrics
    wns: null,
    tns: null,
    setup_violations: null,
    hold_violations: null,
    worst_path_slack: null,
    clock_period: null,

    // Area metrics
    cell_count: null,
    area: null,
    utilization: null,
    core_area: null,

    // Power metrics
    leakage_power: null,
    dynamic_power: null,
    total_power: null,

    // DRC/Physical metrics
    drc_violations: null,
    antenna_violations: null,
    short_violations: null,
    open_violations: null,

    // Routing metrics
    wire_length: null,
    via_count: null,
    congestion: null,

    // Extraction metadata
    extracted_at: new Date().toISOString(),
    confidence: 'medium',
  };

  // WNS patterns (various tools)
  const wnsPatterns = [
    /(?:WNS|worst\s+negative\s+slack|wns)\s*[:=]?\s*(-?\d+\.?\d*)\s*(?:ns|ps)?/i,
    /slack\s*\(VIOLATED\)\s*(-?\d+\.?\d*)/i,
    /^\s*(-\d+\.?\d*)\s+\(VIOLATED\)/m,
    /WNS\s+.*=\s*(-?\d+\.?\d*)/i,
    /worst\s+slack.*:\s*(-?\d+\.?\d*)/i,
  ];

  for (const pattern of wnsPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.wns = parseFloat(match[1]);
      break;
    }
  }

  // TNS patterns
  const tnsPatterns = [
    /(?:TNS|total\s+negative\s+slack|tns)\s*[:=]?\s*(-?\d+\.?\d*)\s*(?:ns|ps)?/i,
    /TNS\s+.*=\s*(-?\d+\.?\d*)/i,
    /total\s+slack.*:\s*(-?\d+\.?\d*)/i,
  ];

  for (const pattern of tnsPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.tns = parseFloat(match[1]);
      break;
    }
  }

  // Setup violations
  const setupPatterns = [
    /setup\s+violations?\s*[:=]?\s*(\d+)/i,
    /setup\s+.*:\s*(\d+)\s*violations?/i,
    /(\d+)\s+setup\s+violations?/i,
  ];

  for (const pattern of setupPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.setup_violations = parseInt(match[1]);
      break;
    }
  }

  // Hold violations
  const holdPatterns = [
    /hold\s+violations?\s*[:=]?\s*(\d+)/i,
    /hold\s+.*:\s*(\d+)\s*violations?/i,
    /(\d+)\s+hold\s+violations?/i,
  ];

  for (const pattern of holdPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.hold_violations = parseInt(match[1]);
      break;
    }
  }

  // Cell count
  const cellPatterns = [
    /cell\s+count\s*[:=]?\s*(\d+)/i,
    /total\s+cells?\s*[:=]?\s*(\d+)/i,
    /(\d+)\s+cells?\s+placed/i,
    /instance\s+count\s*[:=]?\s*(\d+)/i,
  ];

  for (const pattern of cellPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.cell_count = parseInt(match[1]);
      break;
    }
  }

  // Area
  const areaPatterns = [
    /total\s+area\s*[:=]?\s*(\d+\.?\d*)/i,
    /area\s*[:=]?\s*(\d+\.?\d*)\s*(?:um|micron)/i,
    /design\s+area\s*[:=]?\s*(\d+\.?\d*)/i,
  ];

  for (const pattern of areaPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.area = parseFloat(match[1]);
      break;
    }
  }

  // Utilization
  const utilPatterns = [
    /utilization\s*[:=]?\s*(\d+\.?\d*)\s*%/i,
    /utilization\s*[:=]?\s*(\d+\.?\d*)/i,
    /density\s*[:=]?\s*(\d+\.?\d*)\s*%/i,
  ];

  for (const pattern of utilPatterns) {
    const match = output.match(pattern);
    if (match) {
      let util = parseFloat(match[1]);
      // Normalize to percentage if needed
      if (util < 1) util *= 100;
      metrics.utilization = util;
      break;
    }
  }

  // Power metrics
  const leakagePatterns = [
    /leakage\s+power\s*[:=]?\s*(\d+\.?\d*)/i,
    /leakage\s*[:=]?\s*(\d+\.?\d*)\s*(?:nW|uW|mW|W)/i,
  ];

  for (const pattern of leakagePatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.leakage_power = parseFloat(match[1]);
      break;
    }
  }

  const dynamicPatterns = [
    /dynamic\s+power\s*[:=]?\s*(\d+\.?\d*)/i,
    /switching\s+power\s*[:=]?\s*(\d+\.?\d*)/i,
    /dynamic\s*[:=]?\s*(\d+\.?\d*)\s*(?:nW|uW|mW|W)/i,
  ];

  for (const pattern of dynamicPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.dynamic_power = parseFloat(match[1]);
      break;
    }
  }

  const totalPowerPatterns = [
    /total\s+power\s*[:=]?\s*(\d+\.?\d*)/i,
    /total\s*[:=]?\s*(\d+\.?\d*)\s*(?:nW|uW|mW|W)/i,
  ];

  for (const pattern of totalPowerPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.total_power = parseFloat(match[1]);
      break;
    }
  }

  // DRC violations
  const drcPatterns = [
    /DRC\s+violations?\s*[:=]?\s*(\d+)/i,
    /total\s+violations?\s*[:=]?\s*(\d+)/i,
    /(\d+)\s+DRC\s+violations?/i,
  ];

  for (const pattern of drcPatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.drc_violations = parseInt(match[1]);
      break;
    }
  }

  // Wire length
  const wirePatterns = [
    /wire\s+length\s*[:=]?\s*(\d+\.?\d*)/i,
    /total\s+wire\s*[:=]?\s*(\d+\.?\d*)/i,
    /route\s+length\s*[:=]?\s*(\d+\.?\d*)/i,
  ];

  for (const pattern of wirePatterns) {
    const match = output.match(pattern);
    if (match) {
      metrics.wire_length = parseFloat(match[1]);
      break;
    }
  }

  // Calculate confidence based on how many metrics were found
  const definedMetrics = Object.values(metrics).filter(v => v !== null && typeof v !== 'string').length;
  if (definedMetrics >= 5) {
    metrics.confidence = 'high';
  } else if (definedMetrics >= 2) {
    metrics.confidence = 'medium';
  } else {
    metrics.confidence = 'low';
  }

  return metrics;
}

/**
 * Detect the current state of the EDA tool
 * @param {string} output - EDA output text
 * @returns {object} State information
 */
export function detectToolState(output) {
  const state = {
    status: 'unknown',
    tool: null,
    ready: false,
    busy: false,
    error: false,
    pager: false,
    prompt: null,
  };

  // Check for tool prompts (ready state)
  const promptPatterns = [
    { tool: 'innovus', pattern: /innovus\s*\d*>\s*$/, ready: true },
    { tool: 'dc_shell', pattern: /dc_shell[>-]?\s*$/, ready: true },
    { tool: 'pt_shell', pattern: /pt_shell[>-]?\s*$/, ready: true },
    { tool: 'icc2', pattern: /icc2\s*\d*>\s*$/, ready: true },
    { tool: 'starrc', pattern: /starrc[>-]?\s*$/, ready: true },
    { tool: 'bash', pattern: /\[.*@.*\][#$]\s*$/, ready: true },
  ];

  for (const { tool, pattern, ready } of promptPatterns) {
    if (pattern.test(output)) {
      state.tool = tool;
      state.ready = ready;
      state.status = 'ready';
      state.prompt = tool;
      break;
    }
  }

  // Check for busy indicators
  const busyPatterns = [
    /processing/i,
    /running/i,
    /optimizing/i,
    /routing/i,
    /placing/i,
    /loading/i,
    /saving/i,
    /\.{3,}/,  // Ellipsis often indicates ongoing work
    /please\s+wait/i,
  ];

  for (const pattern of busyPatterns) {
    if (pattern.test(output)) {
      state.busy = true;
      if (state.status === 'unknown') {
        state.status = 'busy';
      }
      break;
    }
  }

  // Check for pager (waiting for user input)
  const pagerPatterns = [
    /--More--/i,
    /Press\s+.*to\s+continue/i,
    /\(press\s+Enter\s+to\s+continue\)/i,
    /:\s*$/,  // Single colon at end often indicates pager
  ];

  for (const pattern of pagerPatterns) {
    if (pattern.test(output)) {
      state.pager = true;
      state.status = 'pager';
      state.ready = false;
      break;
    }
  }

  // Check for crash/termination indicators
  const crashPatterns = [
    /segmentation\s+fault/i,
    /core\s+dumped/i,
    /aborted/i,
    /killed/i,
    /terminated/i,
    /exited\s+with\s+code\s+\d+/i,
  ];

  for (const pattern of crashPatterns) {
    if (pattern.test(output)) {
      state.error = true;
      state.status = 'crashed';
      state.ready = false;
      break;
    }
  }

  // If no prompt found and no special state, check if it's just output
  if (state.status === 'unknown' && output.length > 0) {
    // Check if output ends with newline (likely still processing)
    if (output.endsWith('\n')) {
      state.status = 'output';
    }
  }

  return state;
}

/**
 * Generate recovery recommendations based on parsed output
 * @param {object} parsed - Parsed output data
 * @returns {array} Array of recommendation objects
 */
export function recommendRecovery(parsed) {
  const recommendations = [];

  // Handle errors
  if (parsed.errors && parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      const rec = generateErrorRecommendation(error, parsed.tool);
      if (rec) {
        recommendations.push(rec);
      }
    }
  }

  // Handle QoR issues
  if (parsed.qor) {
    const qorRecs = generateQoRRecommendations(parsed.qor);
    recommendations.push(...qorRecs);
  }

  // Handle state issues
  if (parsed.state) {
    if (parsed.state.pager) {
      recommendations.push({
        action: 'send_pager_exit',
        description: 'Exit pager by sending "q" or Space',
        confidence: 'high',
        retryable: true,
        command: 'q',
      });
    }

    if (parsed.state.status === 'crashed') {
      recommendations.push({
        action: 'restart_tool',
        description: 'Tool crashed - restart required',
        confidence: 'high',
        retryable: false,
        requires_user_action: true,
      });
    }
  }

  // If no specific recommendations, add a generic one
  if (recommendations.length === 0) {
    recommendations.push({
      action: 'continue',
      description: 'No issues detected - continue with next step',
      confidence: 'medium',
      retryable: true,
    });
  }

  return recommendations;
}

/**
 * Generate recommendation for a specific error
 * @param {object} error - Error object
 * @param {string} tool - Tool name
 * @returns {object|null} Recommendation or null
 */
function generateErrorRecommendation(error, tool) {
  const actionMap = {
    syntax: {
      action: 'fix_syntax',
      description: `Fix ${error.type} error: ${error.matched_pattern}`,
      confidence: 'high',
      retryable: true,
      fix_type: 'code_correction',
    },
    constraint: {
      action: 'fix_constraints',
      description: `Check SDC constraints: ${error.matched_pattern}`,
      confidence: 'high',
      retryable: true,
      fix_type: 'constraint_update',
    },
    tool: {
      action: 'check_environment',
      description: `Tool error - check setup: ${error.matched_pattern}`,
      confidence: 'medium',
      retryable: true,
      fix_type: 'environment_check',
    },
    design: {
      action: 'fix_design',
      description: `Design issue: ${error.matched_pattern}`,
      confidence: 'medium',
      retryable: true,
      fix_type: 'design_correction',
    },
    timing: {
      action: 'fix_timing',
      description: `Timing violation detected - run optimization`,
      confidence: 'high',
      retryable: true,
      fix_type: 'timing_optimization',
    },
    library: {
      action: 'check_library',
      description: `Check library/tech files: ${error.matched_pattern}`,
      confidence: 'high',
      retryable: false,
      fix_type: 'library_setup',
      requires_user_action: true,
    },
  };

  const rec = actionMap[error.type];
  if (rec) {
    return {
      ...rec,
      error_message: error.message,
      error_line: error.line_number,
      error_file: error.file,
    };
  }

  return null;
}

/**
 * Generate recommendations based on QoR metrics
 * @param {object} qor - QoR metrics
 * @returns {array} Recommendations
 */
function generateQoRRecommendations(qor) {
  const recs = [];

  // Timing recommendations
  if (qor.wns !== null && qor.wns < 0) {
    recs.push({
      action: 'fix_setup_timing',
      description: `WNS is ${qor.wns}ns - setup timing violation detected`,
      confidence: 'high',
      retryable: true,
      fix_type: 'timing_optimization',
      metric: 'wns',
      value: qor.wns,
    });
  }

  if (qor.tns !== null && qor.tns < 0) {
    recs.push({
      action: 'fix_total_timing',
      description: `TNS is ${qor.tns}ns - total negative slack violation`,
      confidence: 'high',
      retryable: true,
      fix_type: 'timing_optimization',
      metric: 'tns',
      value: qor.tns,
    });
  }

  // DRC recommendations
  if (qor.drc_violations !== null && qor.drc_violations > 0) {
    recs.push({
      action: 'fix_drc',
      description: `${qor.drc_violations} DRC violations detected`,
      confidence: 'high',
      retryable: true,
      fix_type: 'drc_repair',
      metric: 'drc_violations',
      value: qor.drc_violations,
    });
  }

  // Utilization recommendations
  if (qor.utilization !== null) {
    if (qor.utilization > 90) {
      recs.push({
        action: 'reduce_utilization',
        description: `Utilization is ${qor.utilization.toFixed(1)}% - consider increasing die area`,
        confidence: 'medium',
        retryable: true,
        fix_type: 'floorplan_adjustment',
        metric: 'utilization',
        value: qor.utilization,
      });
    } else if (qor.utilization < 30) {
      recs.push({
        action: 'increase_utilization',
        description: `Utilization is ${qor.utilization.toFixed(1)}% - die area may be too large`,
        confidence: 'low',
        retryable: true,
        fix_type: 'floorplan_adjustment',
        metric: 'utilization',
        value: qor.utilization,
      });
    }
  }

  return recs;
}

/**
 * Generate a human-readable summary of parsed output
 * @param {object} parsed - Parsed data
 * @returns {string} Summary text
 */
function generateSummary(parsed) {
  const parts = [];

  // Status
  if (parsed.errors && parsed.errors.length > 0) {
    parts.push(`Found ${parsed.errors.length} error(s)`);
  } else {
    parts.push('No errors detected');
  }

  // QoR summary
  if (parsed.qor) {
    const qorParts = [];
    if (parsed.qor.wns !== null) {
      qorParts.push(`WNS=${parsed.qor.wns}ns`);
    }
    if (parsed.qor.tns !== null) {
      qorParts.push(`TNS=${parsed.qor.tns}ns`);
    }
    if (parsed.qor.cell_count !== null) {
      qorParts.push(`${parsed.qor.cell_count} cells`);
    }
    if (qorParts.length > 0) {
      parts.push(`QoR: ${qorParts.join(', ')}`);
    }
  }

  // State
  if (parsed.state) {
    parts.push(`State: ${parsed.state.status}`);
  }

  return parts.join(' | ');
}

// Export all functions for testing and usage
export default {
  parseOutput,
  extractErrors,
  extractQoR,
  detectToolState,
  recommendRecovery,
};
