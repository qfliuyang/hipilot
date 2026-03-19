/**
 * Input validation utilities for MCP tools.
 *
 * Provides centralized validation functions for all MCP tool inputs
 * to prevent injection attacks, ensure data integrity, and provide
 * clear error messages.
 */

/**
 * Known EDA tools that can be launched.
 */
const KNOWN_TOOLS = new Set([
  'innovus',
  'dc_shell',
  'pt_shell',
  'icc2',
  'genus',
  'starrc',
  'calibre',
  'virtuoso'
]);

/**
 * Known flow stages from STAGE_TOOL_MAP.
 */
const KNOWN_STAGES = new Set([
  'synthesis',
  'compile',
  'dc',
  'init',
  'init_design',
  'floorplan',
  'floorplanning',
  'powerplan',
  'power_planning',
  'placement',
  'place',
  'cts',
  'clock_tree',
  'routing',
  'route',
  'chip_finish',
  'finish',
  'gds',
  'sta',
  'primetime',
  'pt_shell',
  'extraction',
  'starrc'
]);

/**
 * Validate pane identifier.
 *
 * Accepts named panes ('eda', 'chat') or numeric indices.
 *
 * @param {*} pane - The pane identifier to validate
 * @returns {string} - The validated pane identifier
 * @throws {Error} - If pane is invalid
 */
export function validatePane(pane) {
  if (pane === undefined || pane === null) {
    throw new Error('Pane identifier is required');
  }

  const paneStr = String(pane);

  // Named panes
  if (paneStr === 'eda' || paneStr === 'chat') {
    return paneStr;
  }

  // Numeric pane indices (0-9 for simplicity, tmux supports more)
  const paneNum = parseInt(paneStr, 10);
  if (!isNaN(paneNum) && paneNum >= 0 && paneNum <= 9) {
    return paneStr;
  }

  throw new Error(
    `Invalid pane identifier: "${pane}". ` +
    `Must be 'eda', 'chat', or a numeric index (0-9)`
  );
}

/**
 * Validate timeout is a positive integer within maximum.
 *
 * @param {*} timeout - The timeout value to validate
 * @param {number} [max=600000] - Maximum allowed timeout in milliseconds (default 10 minutes)
 * @returns {number} - The validated timeout in milliseconds
 * @throws {Error} - If timeout is invalid
 */
export function validateTimeout(timeout, max = 600000) {
  if (timeout === undefined || timeout === null) {
    throw new Error('Timeout is required');
  }

  const num = Number(timeout);

  if (!Number.isInteger(num)) {
    throw new Error(`Timeout must be an integer, got: ${timeout}`);
  }

  if (num <= 0) {
    throw new Error(`Timeout must be positive, got: ${num}`);
  }

  if (num > max) {
    throw new Error(
      `Timeout must be <= ${max}ms (${max / 1000}s), got: ${num}ms (${num / 1000}s)`
    );
  }

  return num;
}

/**
 * Validate path to prevent shell injection and directory traversal.
 *
 * @param {*} path - The path to validate
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.allowRelative=true] - Allow relative paths
 * @param {boolean} [options.allowHome=true] - Allow ~/ paths
 * @returns {string} - The validated and normalized path
 * @throws {Error} - If path is invalid or contains dangerous patterns
 */
export function validatePath(path, options = {}) {
  const { allowRelative = true, allowHome = true } = options;

  if (path === undefined || path === null) {
    throw new Error('Path is required');
  }

  const pathStr = String(path).trim();

  if (pathStr.length === 0) {
    throw new Error('Path cannot be empty');
  }

  // Check for shell injection patterns
  const dangerousPatterns = [
    /\|/,           // Pipe
    /;/,            // Command separator
    /&/,            // Background execution
    /\$\(/,         // Command substitution
    /`/,            // Backtick command substitution
    /\n/,           // Newline injection
    /\r/,           // Carriage return
    /\x00/,         // Null byte
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(pathStr)) {
      throw new Error(`Path contains dangerous characters: ${pathStr}`);
    }
  }

  // Check for directory traversal attempts (basic check)
  if (/\.\./.test(pathStr)) {
    throw new Error(`Path contains directory traversal: ${pathStr}`);
  }

  return pathStr;
}

/**
 * Validate Tcl script size.
 *
 * @param {*} tcl - The Tcl script content to validate
 * @param {number} [maxSize=1048576] - Maximum size in bytes (default 1MB)
 * @returns {string} - The validated Tcl script
 * @throws {Error} - If Tcl is too large or invalid type
 */
export function validateTcl(tcl, maxSize = 1024 * 1024) {
  if (tcl === undefined || tcl === null) {
    throw new Error('Tcl script is required');
  }

  const tclStr = String(tcl);

  // Calculate byte length (UTF-16 code units in JS, close enough for validation)
  const byteLength = Buffer.byteLength(tclStr, 'utf8');

  if (byteLength > maxSize) {
    const sizeKB = Math.round(byteLength / 1024);
    const maxKB = Math.round(maxSize / 1024);
    throw new Error(
      `Tcl script too large: ${sizeKB}KB exceeds maximum ${maxKB}KB`
    );
  }

  return tclStr;
}

/**
 * Validate tool name is a known EDA tool.
 *
 * @param {*} tool - The tool name to validate
 * @returns {string} - The validated tool name
 * @throws {Error} - If tool is not recognized
 */
export function validateToolName(tool) {
  if (tool === undefined || tool === null) {
    throw new Error('Tool name is required');
  }

  const toolStr = String(tool).toLowerCase().trim();

  if (toolStr.length === 0) {
    throw new Error('Tool name cannot be empty');
  }

  if (!KNOWN_TOOLS.has(toolStr)) {
    const knownTools = Array.from(KNOWN_TOOLS).sort().join(', ');
    throw new Error(
      `Unknown tool: "${tool}". Known tools: ${knownTools}`
    );
  }

  return toolStr;
}

/**
 * Validate stage name is a known flow stage.
 *
 * @param {*} stage - The stage name to validate
 * @returns {string} - The validated stage name
 * @throws {Error} - If stage is not recognized
 */
export function validateStage(stage) {
  if (stage === undefined || stage === null) {
    throw new Error('Stage name is required');
  }

  const stageStr = String(stage).toLowerCase().trim();

  if (stageStr.length === 0) {
    throw new Error('Stage name cannot be empty');
  }

  if (!KNOWN_STAGES.has(stageStr)) {
    const knownStages = Array.from(KNOWN_STAGES).sort().join(', ');
    throw new Error(
      `Unknown stage: "${stage}". Known stages: ${knownStages}`
    );
  }

  return stageStr;
}

/**
 * Get all known tool names.
 * @returns {string[]} - Array of known tool names
 */
export function getKnownTools() {
  return Array.from(KNOWN_TOOLS).sort();
}

/**
 * Get all known stage names.
 * @returns {string[]} - Array of known stage names
 */
export function getKnownStages() {
  return Array.from(KNOWN_STAGES).sort();
}
