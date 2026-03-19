/**
 * qor-parser.js - QoR metric extraction from EDA reports
 *
 * Extracts WNS, TNS, violations, power, area, and utilization
 * from timing, power, and area reports.
 */

/**
 * Extract basic QoR metrics from report text.
 * @param {string} reportContent - Report content to parse
 * @returns {object} Metrics object with WNS, TNS, violations, power, area, etc.
 */
export function extractQoR(reportContent) {
  const metrics = {
    wns: null,
    tns: null,
    setup_violations: 0,
    hold_violations: 0,
    drc_violations: 0,
    total_power: null,
    leakage_power: null,
    cell_count: null,
    area: null,
    utilization: null,
  };

  // WNS patterns (ICC2, Innovus, PrimeTime)
  const wnsPatterns = [
    /(?:WNS|worst\s+negative\s+slack|wns)\s*[:=]?\s*(-?\d+\.?\d*)\s*(?:ns|ps)?/i,
    /slack\s*\(VIOLATED\)\s*(-?\d+\.?\d*)/i,
    /^\s*(-\d+\.?\d*)\s+\(VIOLATED\)/m,
  ];
  for (const pat of wnsPatterns) {
    const m = reportContent.match(pat);
    if (m) { metrics.wns = parseFloat(m[1]); break; }
  }

  // TNS patterns
  const tnsPatterns = [
    /(?:TNS|total\s+negative\s+slack|tns)\s*[:=]?\s*(-?\d+\.?\d*)\s*(?:ns|ps)?/i,
  ];
  for (const pat of tnsPatterns) {
    const m = reportContent.match(pat);
    if (m) { metrics.tns = parseFloat(m[1]); break; }
  }

  // Violation counts
  const setupMatch = reportContent.match(/(?:setup|max_delay)\s*(?:violations?|failing\s+endpoints?)\s*[:=]?\s*(\d+)/gi);
  if (setupMatch) {
    for (const m of setupMatch) {
      const n = m.match(/(\d+)\s*$/);
      if (n) metrics.setup_violations += parseInt(n[1]);
    }
  }

  const holdMatch = reportContent.match(/(?:hold|min_delay)\s*(?:violations?|failing\s+endpoints?)\s*[:=]?\s*(\d+)/gi);
  if (holdMatch) {
    for (const m of holdMatch) {
      const n = m.match(/(\d+)\s*$/);
      if (n) metrics.hold_violations += parseInt(n[1]);
    }
  }

  // DRC violations
  const drcPatterns = [
    /(?:total|all)\s*(?:drc)?\s*violations?\s*[:=]?\s*(\d+)/i,
    /(\d+)\s+(?:total\s+)?violations?\s+found/i,
    /Number of DRC violations\s*[:=]?\s*(\d+)/i,
  ];
  for (const pat of drcPatterns) {
    const m = reportContent.match(pat);
    if (m) { metrics.drc_violations = parseInt(m[1]); break; }
  }

  // Power
  const totalPower = reportContent.match(/total.*?power\s*[:=]?\s*(\d+\.?\d*)\s*(mW|uW|W)/i);
  if (totalPower) metrics.total_power = `${totalPower[1]} ${totalPower[2]}`;

  const leakagePower = reportContent.match(/leakage.*?power\s*[:=]?\s*(\d+\.?\d*)\s*(mW|uW|W)/i);
  if (leakagePower) metrics.leakage_power = `${leakagePower[1]} ${leakagePower[2]}`;

  // Cell count
  const cellMatch = reportContent.match(/(?:cell|instance|leaf)\s*count\s*[:=]?\s*(\d+)/i);
  if (cellMatch) metrics.cell_count = parseInt(cellMatch[1]);

  // Area
  const areaMatch = reportContent.match(/(?:total|design)\s*area\s*[:=]?\s*(\d+\.?\d*)/i);
  if (areaMatch) metrics.area = parseFloat(areaMatch[1]);

  // Utilization
  const utilMatch = reportContent.match(/utilization\s*[:=]?\s*(\d+\.?\d*)\s*%/i);
  if (utilMatch) metrics.utilization = parseFloat(utilMatch[1]);

  return metrics;
}

/**
 * Format QoR metrics as a human-readable summary.
 * @param {object} metrics - Metrics from extractQoR
 * @returns {string} Formatted summary
 */
export function formatQoRSummary(metrics) {
  const lines = [];
  lines.push('## QoR Summary');

  if (metrics.wns !== null) {
    const status = metrics.wns >= 0 ? '✓ MET' : '✗ VIOLATED';
    lines.push(`**WNS:** ${metrics.wns} ns ${status}`);
  }
  if (metrics.tns !== null) {
    lines.push(`**TNS:** ${metrics.tns} ns`);
  }

  if (metrics.setup_violations > 0) {
    lines.push(`**Setup Violations:** ${metrics.setup_violations}`);
  }
  if (metrics.hold_violations > 0) {
    lines.push(`**Hold Violations:** ${metrics.hold_violations}`);
  }
  if (metrics.drc_violations > 0) {
    lines.push(`**DRC Violations:** ${metrics.drc_violations}`);
  }

  if (metrics.total_power) {
    lines.push(`**Total Power:** ${metrics.total_power}`);
  }
  if (metrics.cell_count) {
    lines.push(`**Cell Count:** ${metrics.cell_count}`);
  }
  if (metrics.area !== null) {
    lines.push(`**Area:** ${metrics.area}`);
  }
  if (metrics.utilization !== null) {
    lines.push(`**Utilization:** ${metrics.utilization}%`);
  }

  return lines.join('\n');
}
