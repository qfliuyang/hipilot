/**
 * HiPilot Report Analyzer
 *
 * Provides LLM prompt generation and structured analysis for EDA reports.
 * Supports timing, DRC, power, and area report analysis.
 *
 * Design philosophy: Let the AI read raw report text rather than building
 * complex parsers. This makes the system feel intelligent and adaptable.
 */

import * as logger from './logger.js';

/**
 * Report types supported for analysis
 */
export const REPORT_TYPES = {
  TIMING: 'timing',
  DRC: 'drc',
  POWER: 'power',
  AREA: 'area',
  AUTO: 'auto',
};

/**
 * Detect report type from content
 */
export function detectReportType(reportText) {
  if (!reportText || reportText.trim().length === 0) {
    return REPORT_TYPES.AUTO;
  }

  const text = reportText.toLowerCase();

  // Timing report indicators
  if (text.includes('setup') && text.includes('slack')) {
    return REPORT_TYPES.TIMING;
  }
  if (text.includes('wns') || text.includes('tns')) {
    return REPORT_TYPES.TIMING;
  }
  if (text.includes('timing path') && text.includes('delay')) {
    return REPORT_TYPES.TIMING;
  }

  // DRC report indicators
  if (text.includes('drc') || text.includes('violation')) {
    return REPORT_TYPES.DRC;
  }
  if (text.includes('metal spacing') || text.includes('min area')) {
    return REPORT_TYPES.DRC;
  }

  // Power report indicators
  if (text.includes('power') && (text.includes('mw') || text.includes('uw'))) {
    return REPORT_TYPES.POWER;
  }
  if (text.includes('leakage') || text.includes('dynamic power')) {
    return REPORT_TYPES.POWER;
  }

  // Area report indicators
  if (text.includes('area') && text.includes('cell')) {
    return REPORT_TYPES.AREA;
  }
  if (text.includes('utilization') || text.includes('chip area')) {
    return REPORT_TYPES.AREA;
  }

  return REPORT_TYPES.AUTO;
}

/**
 * Extract key metrics from timing report for structured context
 */
function extractTimingMetrics(reportText) {
  const metrics = {
    wns: null,
    tns: null,
    setupViolations: 0,
    holdViolations: 0,
    maxDelay: null,
    minDelay: null,
  };

  // WNS extraction
  const wnsMatch = reportText.match(/WNS\s*[:=]\s*(-?\d+\.?\d*)/i) ||
                   reportText.match(/worst\s+negative\s+slack\s*[:=]\s*(-?\d+\.?\d*)/i) ||
                   reportText.match(/slack\s*\(VIOLATED\)\s*(-?\d+\.?\d*)/i);
  if (wnsMatch) metrics.wns = parseFloat(wnsMatch[1]);

  // TNS extraction
  const tnsMatch = reportText.match(/TNS\s*[:=]\s*(-?\d+\.?\d*)/i) ||
                   reportText.match(/total\s+negative\s+slack\s*[:=]\s*(-?\d+\.?\d*)/i);
  if (tnsMatch) metrics.tns = parseFloat(tnsMatch[1]);

  // Setup violations
  const setupMatch = reportText.match(/setup\s+violations?\s*[:=]\s*(\d+)/i) ||
                     reportText.match(/failing\s+endpoints?\s*\(setup\)\s*[:=]\s*(\d+)/i);
  if (setupMatch) metrics.setupViolations = parseInt(setupMatch[1], 10);

  // Hold violations
  const holdMatch = reportText.match(/hold\s+violations?\s*[:=]\s*(\d+)/i) ||
                    reportText.match(/failing\s+endpoints?\s*\(hold\)\s*[:=]\s*(\d+)/i);
  if (holdMatch) metrics.holdViolations = parseInt(holdMatch[1], 10);

  return metrics;
}

/**
 * Extract key metrics from DRC report
 */
function extractDrcMetrics(reportText) {
  const metrics = {
    totalViolations: 0,
    categories: [],
    criticalCount: 0,
    warningCount: 0,
  };

  // Total violations
  const totalMatch = reportText.match(/total\s+(?:drc\s+)?violations?\s*[:=]\s*(\d+)/i) ||
                     reportText.match(/(\d+)\s+violations?\s+found/i);
  if (totalMatch) metrics.totalViolations = parseInt(totalMatch[1], 10);

  // Category extraction (common DRC types)
  const categoryPatterns = [
    { name: 'Metal Spacing', pattern: /metal\s+spacing|spacing\s+violation/i },
    { name: 'Min Area', pattern: /min\s+area|minimum\s+area/i },
    { name: 'Via Enclosure', pattern: /via\s+enclosure|enclosure\s+violation/i },
    { name: 'Short', pattern: /short|shorted/i },
    { name: 'Open', pattern: /open\s+circuit|net\s+open/i },
    { name: 'Antenna', pattern: /antenna|diode/i },
  ];

  for (const cat of categoryPatterns) {
    if (cat.pattern.test(reportText)) {
      metrics.categories.push(cat.name);
    }
  }

  // Critical vs warning counts
  const criticalMatch = reportText.match(/critical\s+violations?\s*[:=]\s*(\d+)/i) ||
                        reportText.match(/error\s*[:=]\s*(\d+)/i);
  if (criticalMatch) metrics.criticalCount = parseInt(criticalMatch[1], 10);

  const warningMatch = reportText.match(/warning\s+violations?\s*[:=]\s*(\d+)/i) ||
                       reportText.match(/warnings?\s*[:=]\s*(\d+)/i);
  if (warningMatch) metrics.warningCount = parseInt(warningMatch[1], 10);

  return metrics;
}

/**
 * Generate timing report analysis prompt for LLM
 */
export function generateTimingPrompt(reportText, metrics = null) {
  const extractedMetrics = metrics || extractTimingMetrics(reportText);

  return `You are a VLSI Physical Design expert analyzing a timing report. Please analyze the following report and provide actionable insights.

## Structured Metrics (for context)
- WNS (Worst Negative Slack): ${extractedMetrics.wns !== null ? extractedMetrics.wns + ' ns' : 'Not detected'}
- TNS (Total Negative Slack): ${extractedMetrics.tns !== null ? extractedMetrics.tns + ' ns' : 'Not detected'}
- Setup Violations: ${extractedMetrics.setupViolations || 'Not detected'}
- Hold Violations: ${extractedMetrics.holdViolations || 'Not detected'}

## Raw Timing Report
\`\`\`
${reportText.slice(0, 15000)}
\`\`\`
${reportText.length > 15000 ? '\n[Report truncated for analysis - showing first 15000 characters]' : ''}

## Analysis Request
Please provide a comprehensive analysis with the following sections:

### 1. Executive Summary
- What is the overall timing health of this design?
- Is the design meeting timing or are there violations?

### 2. Critical Issues (if any)
- List the most critical timing violations
- Identify patterns (e.g., all violations on same clock domain, specific path groups)
- Highlight any unexpected or concerning values

### 3. Root Cause Analysis
- What are the likely causes of any timing issues?
- Are there common factors among failing paths?
- Any tool or methodology concerns?

### 4. Recommended Next Steps
- Prioritized list of actions to take
- Specific Tcl commands or EDA operations that could help
- Any additional reports that should be generated

### 5. Confidence Assessment
- Rate your confidence in this analysis (High/Medium/Low)
- Note any ambiguities or missing information

Format your response with clear headings and bullet points for readability.`;
}

/**
 * Generate DRC report analysis prompt for LLM
 */
export function generateDrcPrompt(reportText, metrics = null) {
  const extractedMetrics = metrics || extractDrcMetrics(reportText);

  return `You are a VLSI Physical Design expert analyzing a DRC (Design Rule Check) report. Please analyze the following report and provide actionable insights.

## Structured Metrics (for context)
- Total Violations: ${extractedMetrics.totalViolations || 'Not detected'}
- Violation Categories Detected: ${extractedMetrics.categories.length > 0 ? extractedMetrics.categories.join(', ') : 'Not categorized'}
- Critical Errors: ${extractedMetrics.criticalCount || 'Not specified'}
- Warnings: ${extractedMetrics.warningCount || 'Not specified'}

## Raw DRC Report
\`\`\`
${reportText.slice(0, 15000)}
\`\`\`
${reportText.length > 15000 ? '\n[Report truncated for analysis - showing first 15000 characters]' : ''}

## Analysis Request
Please provide a comprehensive analysis with the following sections:

### 1. Executive Summary
- What is the overall DRC health of this design?
- Is the design clean or are there violations requiring attention?

### 2. Violation Categories
- List each type of violation found
- Estimate severity (Critical/High/Medium/Low) for each category
- Note any patterns in violation locations

### 3. Critical Issues
- Highlight violations that must be fixed before tapeout
- Identify any systematic issues (e.g., widespread metal spacing)
- Flag any violations that may indicate methodology problems

### 4. Recommended Fixes
- Specific actions to resolve each violation type
- Tool commands or scripts that could help
- Order of operations (which fixes to attempt first)

### 5. Confidence Assessment
- Rate your confidence in this analysis (High/Medium/Low)
- Note any ambiguities or missing information

Format your response with clear headings and bullet points for readability.`;
}

/**
 * Generate power report analysis prompt for LLM
 */
export function generatePowerPrompt(reportText, metrics = null) {
  return `You are a VLSI Physical Design expert analyzing a power report. Please analyze the following report and provide actionable insights.

## Raw Power Report
\`\`\`
${reportText.slice(0, 15000)}
\`\`\`
${reportText.length > 15000 ? '\n[Report truncated for analysis - showing first 15000 characters]' : ''}

## Analysis Request
Please provide a comprehensive analysis with the following sections:

### 1. Executive Summary
- What is the overall power consumption profile?
- Is power within expected/acceptable ranges?

### 2. Power Breakdown
- Leakage vs dynamic power distribution
- Power by hierarchy (if available)
- Power by clock domain (if available)

### 3. Concerns and Anomalies
- Any unexpectedly high power components
- Comparison points that seem unusual
- Potential power hotspots

### 4. Optimization Opportunities
- Suggestions for power reduction
- Trade-offs to consider
- Additional analysis that would be helpful

### 5. Confidence Assessment
- Rate your confidence in this analysis (High/Medium/Low)

Format your response with clear headings and bullet points for readability.`;
}

/**
 * Generate area report analysis prompt for LLM
 */
export function generateAreaPrompt(reportText, metrics = null) {
  return `You are a VLSI Physical Design expert analyzing an area/utilization report. Please analyze the following report and provide actionable insights.

## Raw Area Report
\`\`\`
${reportText.slice(0, 15000)}
\`\`\`
${reportText.length > 15000 ? '\n[Report truncated for analysis - showing first 15000 characters]' : ''}

## Analysis Request
Please provide a comprehensive analysis with the following sections:

### 1. Executive Summary
- What is the overall area and utilization status?
- Is the design within die size constraints?

### 2. Area Breakdown
- Cell count and types
- Utilization by region/layer (if available)
- Memory vs logic area distribution

### 3. Utilization Analysis
- Current utilization vs target
- Any congestion indicators
- White space availability

### 4. Recommendations
- Suggestions for area optimization if needed
- Floorplan adjustments to consider
- Next steps for area closure

### 5. Confidence Assessment
- Rate your confidence in this analysis (High/Medium/Low)

Format your response with clear headings and bullet points for readability.`;
}

/**
 * Analyze timing report - returns structured analysis object
 * Returns prompt for Claude to analyze. Claude Code (not MCP) handles LLM calls.
 */
export function analyzeTimingReport(reportText) {
  logger.debug('Analyzing timing report', { length: reportText?.length });

  const metrics = extractTimingMetrics(reportText);
  const prompt = generateTimingPrompt(reportText, metrics);

  return {
    type: REPORT_TYPES.TIMING,
    metrics,
    prompt,
    summary: generateTimingSummary(metrics),
  };
}

/**
 * Analyze DRC report - returns structured analysis object
 */
export function analyzeDrcReport(reportText) {
  logger.debug('Analyzing DRC report', { length: reportText?.length });

  const metrics = extractDrcMetrics(reportText);
  const prompt = generateDrcPrompt(reportText, metrics);

  return {
    type: REPORT_TYPES.DRC,
    metrics,
    prompt,
    summary: generateDrcSummary(metrics),
  };
}

/**
 * Analyze power report - returns structured analysis object
 */
export function analyzePowerReport(reportText) {
  logger.debug('Analyzing power report', { length: reportText?.length });

  const prompt = generatePowerPrompt(reportText);

  return {
    type: REPORT_TYPES.POWER,
    prompt,
    summary: 'Power report analysis prepared',
  };
}

/**
 * Analyze area report - returns structured analysis object
 */
export function analyzeAreaReport(reportText) {
  logger.debug('Analyzing area report', { length: reportText?.length });

  const prompt = generateAreaPrompt(reportText);

  return {
    type: REPORT_TYPES.AREA,
    prompt,
    summary: 'Area report analysis prepared',
  };
}

/**
 * Generate a quick summary for timing metrics
 */
function generateTimingSummary(metrics) {
  const parts = [];

  if (metrics.wns !== null) {
    const status = metrics.wns < 0 ? 'VIOLATED' : 'MET';
    parts.push(`WNS: ${metrics.wns} ns (${status})`);
  }

  if (metrics.tns !== null) {
    parts.push(`TNS: ${metrics.tns} ns`);
  }

  if (metrics.setupViolations > 0) {
    parts.push(`${metrics.setupViolations} setup violations`);
  }

  if (metrics.holdViolations > 0) {
    parts.push(`${metrics.holdViolations} hold violations`);
  }

  if (parts.length === 0) {
    return 'No timing metrics extracted';
  }

  return parts.join(' | ');
}

/**
 * Generate a quick summary for DRC metrics
 */
function generateDrcSummary(metrics) {
  if (metrics.totalViolations === 0) {
    return 'No DRC violations detected';
  }

  const parts = [`${metrics.totalViolations} total violations`];

  if (metrics.categories.length > 0) {
    parts.push(`Categories: ${metrics.categories.join(', ')}`);
  }

  if (metrics.criticalCount > 0) {
    parts.push(`${metrics.criticalCount} critical`);
  }

  return parts.join(' | ');
}

/**
 * Main analyze report function - auto-detects type and generates appropriate prompt
 */
export function analyzeReport(reportText, reportType = REPORT_TYPES.AUTO) {
  logger.info('Analyzing report', { type: reportType, length: reportText?.length });

  // Auto-detect if needed
  const detectedType = reportType === REPORT_TYPES.AUTO
    ? detectReportType(reportText)
    : reportType;

  // Route to appropriate analyzer
  switch (detectedType) {
    case REPORT_TYPES.TIMING:
      return analyzeTimingReport(reportText);
    case REPORT_TYPES.DRC:
      return analyzeDrcReport(reportText);
    case REPORT_TYPES.POWER:
      return analyzePowerReport(reportText);
    case REPORT_TYPES.AREA:
      return analyzeAreaReport(reportText);
    default:
      // Default to timing analysis for unknown types
      logger.warn('Unknown report type, defaulting to timing analysis', { detectedType });
      return analyzeTimingReport(reportText);
  }
}

/**
 * Get example prompts for documentation/testing
 */
export function getExamplePrompts() {
  return {
    timing: generateTimingPrompt(
      `Report: report_timing -max_paths 10
WNS: -0.523 ns
TNS: -12.456 ns
Setup violations: 47
Hold violations: 0

Path 1: clk_buf_2/Q -> reg_data_in/D
Slack: -0.523 ns
Path Group: CLK_MAIN
...
`,
      { wns: -0.523, tns: -12.456, setupViolations: 47, holdViolations: 0 }
    ),
    drc: generateDrcPrompt(
      `DRC Report: verify_drc
Total violations: 23

Metal spacing violations: 15
Min area violations: 5
Via enclosure violations: 3

Critical: 0
Warnings: 23
...`,
      { totalViolations: 23, categories: ['Metal Spacing', 'Min Area', 'Via Enclosure'], criticalCount: 0, warningCount: 23 }
    ),
  };
}

// Export all functions
export default {
  REPORT_TYPES,
  detectReportType,
  analyzeReport,
  analyzeTimingReport,
  analyzeDrcReport,
  analyzePowerReport,
  analyzeAreaReport,
  generateTimingPrompt,
  generateDrcPrompt,
  generatePowerPrompt,
  generateAreaPrompt,
  getExamplePrompts,
};
