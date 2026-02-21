/**
 * Tcl Syntax Highlighter
 *
 * Provides color-coded syntax highlighting for Tcl scripts
 */

import chalk from 'chalk';

const colors = {
  comment: chalk.dim.gray,
  keyword: chalk.cyan,
  flag: chalk.yellow,
  string: chalk.green,
  variable: chalk.magenta,
  number: chalk.blue,
  default: chalk.white,
};

const KEYWORDS = new Set([
  'proc', 'if', 'then', 'else', 'elseif', 'while', 'for', 'foreach',
  'switch', 'break', 'continue', 'return', 'expr', 'set', 'unset',
  'puts', 'source', 'global', 'namespace', 'package', 'catch',
  'report_timing', 'report_power', 'report_area', 'check_drc',
  'route_design', 'place_design', 'optimize_design', 'fix_eco_timing',
  'get_cells', 'get_pins', 'get_nets', 'create_placement', 'route_auto',
]);

export function highlightTcl(code) {
  const lines = code.split('\n');
  return lines.map(line => highlightLine(line)).join('\n');
}

function highlightLine(line) {
  if (line.match(/^\s*#/)) {
    return colors.comment(line);
  }

  const parts = line.split(/(?=#)/);
  const codePart = parts[0];
  const commentPart = parts.slice(1).join('');

  let highlighted = codePart;

  highlighted = highlighted.replace(
    /"([^"]*)"/g,
    (match, p1) => colors.string(`"${p1}"`)
  );

  highlighted = highlighted.replace(
    /\$[a-zA-Z_][a-zA-Z0-9_]*/g,
    match => colors.variable(match)
  );

  highlighted = highlighted.replace(
    /(\s|^)(-[a-zA-Z_][a-zA-Z0-9_]*)/g,
    (match, space, flag) => space + colors.flag(flag)
  );

  highlighted = highlighted.replace(
    /\b\d+\.?\d*\b/g,
    match => colors.number(match)
  );

  highlighted = highlighted.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
    (match) => KEYWORDS.has(match) ? colors.keyword(match) : match
  );

  if (commentPart) {
    highlighted += colors.comment(commentPart);
  }

  return highlighted;
}

export default { highlightTcl, colors };