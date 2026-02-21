/**
 * Shell escape utilities to prevent command injection.
 *
 * All user-supplied values passed to execSync must be escaped
 * before interpolation into shell command strings.
 */

/**
 * Escape a string for safe use in a single-quoted shell argument.
 * Wraps the value in single quotes and escapes any embedded single quotes.
 *
 * @param {string} str - The string to escape
 * @returns {string} Shell-safe single-quoted string
 */
export function shellEscape(str) {
  if (str === undefined || str === null) {
    return "''";
  }
  const s = String(str);
  // Replace each ' with '\'' (end quote, escaped quote, start quote)
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Validate that a value is an integer within an optional range.
 *
 * @param {*} value - The value to validate
 * @param {string} name - Parameter name for error messages
 * @param {number} [min] - Minimum allowed value (inclusive)
 * @param {number} [max] - Maximum allowed value (inclusive)
 * @returns {number} The validated integer
 */
export function validateInt(value, name, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num)) {
    throw new Error(`${name} must be an integer, got: ${value}`);
  }
  if (min !== undefined && num < min) {
    throw new Error(`${name} must be >= ${min}, got: ${num}`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`${name} must be <= ${max}, got: ${num}`);
  }
  return num;
}
