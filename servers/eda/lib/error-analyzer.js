/**
 * error-analyzer.js - Error classification and analysis
 *
 * Categorizes EDA errors and provides fix suggestions.
 */

/**
 * Error severity levels.
 */
export const ERROR_SEVERITY = {
  CRITICAL: 'critical',  // Blocks all progress
  HIGH: 'high',          // Blocks current stage
  MEDIUM: 'medium',      // May cause issues later
  LOW: 'low',            // Informational
};

/**
 * Error categories.
 */
export const ERROR_CATEGORIES = {
  SYNTAX: 'syntax',           // Tcl syntax errors
  PERMISSION: 'permission',   // File permission errors
  LICENSE: 'license',         // Tool license errors
  MEMORY: 'memory',           // Out of memory
  DISK_SPACE: 'disk_space',   // Out of disk space
  MISSING_FILE: 'missing_file', // Input file not found
  TIMING: 'timing',           // Timing violations
  DRC: 'drc',                 // Design rule violations
  CONNECTIVITY: 'connectivity', // Connectivity issues
  TOOL_CRASH: 'tool_crash',   // Tool crashed
  TIMEOUT: 'timeout',         // Command timeout
  UNKNOWN: 'unknown',         // Uncategorized
};

/**
 * Error patterns for classification.
 */
const ERROR_PATTERNS = [
  // Syntax errors
  { pattern: /syntax error|invalid command|unbalanced braces/i, category: ERROR_CATEGORIES.SYNTAX, severity: ERROR_SEVERITY.HIGH },
  { pattern: /wrong # args|expected integer|variable not found/i, category: ERROR_CATEGORIES.SYNTAX, severity: ERROR_SEVERITY.HIGH },

  // Permission errors
  { pattern: /permission denied|access denied|cannot open.*permission/i, category: ERROR_CATEGORIES.PERMISSION, severity: ERROR_SEVERITY.HIGH },

  // License errors
  { pattern: /license error|no license|license checkout failed|license server/i, category: ERROR_CATEGORIES.LICENSE, severity: ERROR_SEVERITY.CRITICAL },

  // Memory errors
  { pattern: /out of memory|memory allocation failed|malloc failed|heap overflow/i, category: ERROR_CATEGORIES.MEMORY, severity: ERROR_SEVERITY.HIGH },

  // Disk space errors
  { pattern: /no space left|disk full|cannot write.*no space/i, category: ERROR_CATEGORIES.DISK_SPACE, severity: ERROR_SEVERITY.CRITICAL },

  // Missing file errors
  { pattern: /no such file|file not found|cannot open.*no such/i, category: ERROR_CATEGORIES.MISSING_FILE, severity: ERROR_SEVERITY.HIGH },

  // Timing errors
  { pattern: /setup violation|hold violation|timing violation|slack.*violated/i, category: ERROR_CATEGORIES.TIMING, severity: ERROR_SEVERITY.MEDIUM },

  // DRC errors
  { pattern: /drc violation|design rule violation|spacing violation|min spacing violation/i, category: ERROR_CATEGORIES.DRC, severity: ERROR_SEVERITY.MEDIUM },

  // Connectivity errors
  { pattern: /connectivity error|unconnected pin|floating net|no connection/i, category: ERROR_CATEGORIES.CONNECTIVITY, severity: ERROR_SEVERITY.HIGH },

  // Tool crashes
  { pattern: /segmentation fault|core dumped|bus error|aborted|killed/i, category: ERROR_CATEGORIES.TOOL_CRASH, severity: ERROR_SEVERITY.CRITICAL },

  // Timeout
  { pattern: /timeout|timed out|command took too long/i, category: ERROR_CATEGORIES.TIMEOUT, severity: ERROR_SEVERITY.MEDIUM },
];

/**
 * Suggested fixes for error categories.
 */
const FIX_SUGGESTIONS = {
  [ERROR_CATEGORIES.SYNTAX]: [
    'Check for typos in command names',
    'Verify proper Tcl syntax (balanced braces, quotes)',
    'Review variable names and substitutions',
  ],
  [ERROR_CATEGORIES.PERMISSION]: [
    'Check file permissions with `ls -la`',
    'Verify user has read/write access',
    'Try running with appropriate sudo privileges',
  ],
  [ERROR_CATEGORIES.LICENSE]: [
    'Check license server status',
    'Verify license feature is available',
    'Try releasing held licenses',
  ],
  [ERROR_CATEGORIES.MEMORY]: [
    'Reduce design size or memory footprint',
    'Increase system memory or swap space',
    'Split operation into smaller steps',
  ],
  [ERROR_CATEGORIES.DISK_SPACE]: [
    'Clean up temporary files',
    'Remove old checkpoints and logs',
    'Check disk usage with `df -h`',
  ],
  [ERROR_CATEGORIES.MISSING_FILE]: [
    'Verify file path is correct',
    'Check if file was generated in previous stage',
    'Run previous stage to generate missing file',
  ],
  [ERROR_CATEGORIES.TIMING]: [
    'Run timing report to identify violating paths',
    'Use `optDesign` or `fix_eco_timing` to fix violations',
    'Check constraints are properly defined',
  ],
  [ERROR_CATEGORIES.DRC]: [
    'Run DRC report to identify violation types',
    'Fix spacing/width violations in layout',
    'Verify technology LEF is correct',
  ],
  [ERROR_CATEGORIES.CONNECTIVITY]: [
    'Run verify_connectivity report',
    'Check for unconnected pins',
    'Verify power nets are properly connected',
  ],
  [ERROR_CATEGORIES.TOOL_CRASH]: [
    'Check tool log files for crash details',
    'Verify input data is valid',
    'Try with reduced design complexity',
  ],
  [ERROR_CATEGORIES.TIMEOUT]: [
    'Increase timeout value',
    'Check if tool is stuck or still processing',
    'Break operation into smaller steps',
  ],
};

/**
 * Classify an error message into category and severity.
 * @param {string} errorMessage - Error message to classify
 * @returns {object} { category, severity, patterns }
 */
export function classifyError(errorMessage) {
  const lowerMessage = errorMessage.toLowerCase();

  for (const { pattern, category, severity } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        category,
        severity,
        matched: pattern.toString(),
      };
    }
  }

  return {
    category: ERROR_CATEGORIES.UNKNOWN,
    severity: ERROR_SEVERITY.MEDIUM,
    matched: null,
  };
}

/**
 * Get fix suggestions for an error category.
 * @param {string} category - Error category
 * @returns {string[]} Array of suggestions
 */
export function getFixSuggestions(category) {
  return FIX_SUGGESTIONS[category] || ['Review error message for details', 'Check tool documentation'];
}

/**
 * Analyze error output and provide structured analysis.
 * @param {string} errorOutput - Full error output
 * @returns {object} Structured error analysis
 */
export function analyzeError(errorOutput) {
  const lines = errorOutput.split('\n').filter(l => l.trim());
  const classification = classifyError(errorOutput);
  const suggestions = getFixSuggestions(classification.category);

  // Extract first few error lines for context
  const errorLines = lines.filter(l =>
    /error|warning|failed|critical/i.test(l)
  ).slice(0, 10);

  return {
    category: classification.category,
    severity: classification.severity,
    summary: errorLines.length > 0 ? errorLines[0].trim() : 'Unknown error',
    errorLines,
    suggestions,
    requiresToolRestart: [
      ERROR_CATEGORIES.LICENSE,
      ERROR_CATEGORIES.TOOL_CRASH,
    ].includes(classification.category),
    requiresStageRerun: [
      ERROR_CATEGORIES.TIMING,
      ERROR_CATEGORIES.DRC,
      ERROR_CATEGORIES.CONNECTIVITY,
    ].includes(classification.category),
  };
}
