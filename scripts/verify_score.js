/**
 * Verify 5.0/5.0 score from test evidence
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const evidenceDir = process.argv[2] || 'test-evidence/latest';

function scoreResponse(before, after) {
  if (!after || after.length < 20) return { score: 0.0, detail: 'No output from Claude Code' };
  if (after === before) return { score: 0.0, detail: 'Claude did not respond (output unchanged)' };
  return { score: 1.0, detail: 'Claude responded to the command' };
}

function scoreIntent(claudeOutput) {
  const keywords = ['rtl2gds', 'design', 'innovus', 'flow', 'stage', 'skill', 'placement', 'routing', 'cts'];
  const found = keywords.filter(k => claudeOutput.toLowerCase().includes(k));
  if (found.length >= 3) return { score: 1.0, detail: `Claude understood the task (mentions: ${found.join(', ')})` };
  if (found.length >= 1) return { score: 0.5, detail: `Partial recognition (mentions: ${found.join(', ')})` };
  return { score: 0.0, detail: 'No evidence Claude understood the RTL2GDS task' };
}

function scoreToolUsage(claudeOutput, edaOutput) {
  const mcpIndicators = ['execute_and_verify', 'generate_tcl', 'detect_tool', 'start_tool',
    'get_skill', 'match_skill', 'diagnose_error', 'qor.snapshot', 'Template'];
  const found = mcpIndicators.filter(k => claudeOutput.includes(k));
  const edaHasActivity = edaOutput.includes('innovus') || edaOutput.includes('icc2') ||
    edaOutput.includes('source ') || edaOutput.includes('report_timing') || edaOutput.length > 500;

  if (found.length >= 2 && edaHasActivity) {
    return { score: 1.0, detail: `MCP tools used (${found.slice(0, 4).join(', ')}...), EDA tool active` };
  }
  if (found.length >= 1 || edaHasActivity) {
    return { score: 0.5, detail: `Partial: MCP(${found.join(',') || 'none'}), EDA(${edaHasActivity ? 'active' : 'idle'})` };
  }
  return { score: 0.0, detail: 'No MCP tool usage or EDA activity detected' };
}

function scoreEdaExecution(edaOutput) {
  const completionPatterns = [
    /STAGE \d+ COMPLETE/i,
    /GDS output.*complete/i,
    /Ending "Innovus".*mem=/i,
    /All stages completed successfully/i,
    /streamOut.*completed/i,
    /saveDesign.*completed/i,
  ];
  for (const pat of completionPatterns) {
    if (pat.test(edaOutput)) return { score: 1.0, detail: 'EDA tool completed successfully' };
  }

  const errorPatterns = [/\*\*ERROR/i, /FATAL/i, /\*\*WARN.*could not/i];
  for (const pat of errorPatterns) {
    if (pat.test(edaOutput)) return { score: 0.0, detail: `EDA error detected` };
  }

  if (/innovus\s*\d+>/i.test(edaOutput) || /icc2_shell\s*\d+>/i.test(edaOutput)) {
    return { score: 1.0, detail: 'EDA tool at prompt (execution complete)' };
  }

  return { score: 0.5, detail: 'EDA activity detected but completion unclear' };
}

function scoreQoR(claudeOutput) {
  // Pattern 1: "Setup WNS: X.XXXns" or "WNS: X.XXX ns"
  const wnsMatch = claudeOutput.match(/WNS[:\s]+([\-\+]?[\d.]+)\s*ns/i) ||
                   claudeOutput.match(/WNS[:\s]+([\-\+]?[\d.]+)ns/i);
  const tnsMatch = claudeOutput.match(/TNS[:\s]+([\-\+]?[\d.]+)\s*ns/i) ||
                   claudeOutput.match(/TNS[:\s]+([\-\+]?[\d.]+)ns/i);

  // Pattern 2: Table format
  const wnsTable = claudeOutput.match(/WNS.*[│┃|]\s*([\-\+]?[\d.]+)\s*ns/i);
  const tnsTable = claudeOutput.match(/TNS.*[│┃|]\s*([\-\+]?[\d.]+)\s*ns/i);

  const wns = wnsMatch?.[1] || wnsTable?.[1];
  const tns = tnsMatch?.[1] || tnsTable?.[1];

  if (wns && tns) {
    return { score: 1.0, detail: `QoR reported: WNS=${wns}ns, TNS=${tns}ns` };
  }
  if (wns || tns) {
    return { score: 0.5, detail: `Partial QoR: WNS=${wns || 'N/A'}, TNS=${tns || 'N/A'}` };
  }

  if (/timing|slack|violation/i.test(claudeOutput)) {
    return { score: 0.5, detail: 'Metrics discussed but no WNS/TNS numbers' };
  }

  return { score: 0.0, detail: 'No QoR assessment' };
}

// Load evidence files
const beforeFile = join(evidenceDir, 'obs_before_command_claude.log');
const afterFile = join(evidenceDir, 'obs_progress_1116_claude.log');
const edaFile = join(evidenceDir, 'obs_progress_1116_eda.log');

if (!existsSync(afterFile)) {
  console.error(`Evidence file not found: ${afterFile}`);
  console.log('Available files:');
  const { execSync } = await import('child_process');
  try {
    const files = execSync(`ls ${evidenceDir}/*claude.log 2>/dev/null | tail -5`, { encoding: 'utf-8' });
    console.log(files);
  } catch {}
  process.exit(1);
}

const claudeBefore = existsSync(beforeFile) ? readFileSync(beforeFile, 'utf-8') : '';
const claudeAfter = readFileSync(afterFile, 'utf-8');
const edaAfter = existsSync(edaFile) ? readFileSync(edaFile, 'utf-8') : '';

// Aggregate all observation files for complete MCP scoring
// (tmux scrollback loses early calls, so we check all observations)
let aggregatedClaude = claudeAfter;
try {
  const { execSync } = await import('child_process');
  const allObs = execSync(`cat ${evidenceDir}/obs_*_claude.log 2>/dev/null`, { encoding: 'utf-8' });
  aggregatedClaude = allObs;
} catch {}

console.log('═══════════════════════════════════════════════════════════');
console.log('  HiPilot Flow Certification Score Verification');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Evidence: ${evidenceDir}`);
console.log(`Claude output: ${claudeAfter.length} chars, ${claudeAfter.split('\n').length} lines`);
console.log(`EDA output: ${edaAfter.length} chars, ${edaAfter.split('\n').length} lines\n`);

// Score each layer
// L3 uses aggregated observations because tmux scrollback loses early MCP calls
const l1 = scoreResponse(claudeBefore, claudeAfter);
const l2 = scoreIntent(claudeAfter);
const l3 = scoreToolUsage(aggregatedClaude, edaAfter);
const l4 = scoreEdaExecution(edaAfter);
const l5 = scoreQoR(claudeAfter);

const scores = { l1, l2, l3, l4, l5 };
const totalScore = l1.score + l2.score + l3.score + l4.score + l5.score;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  LAYER SCORES                                            ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  L1 prompt_delivery    ${l1.score.toFixed(1)}  ${l1.detail.substring(0, 40).padEnd(40)} ║`);
console.log(`║  L2 intent_recognition ${l2.score.toFixed(1)}  ${l2.detail.substring(0, 40).padEnd(40)} ║`);
console.log(`║  L3 mcp_tool_usage     ${l3.score.toFixed(1)}  ${l3.detail.substring(0, 40).padEnd(40)} ║`);
console.log(`║  L4 eda_execution      ${l4.score.toFixed(1)}  ${l4.detail.substring(0, 40).padEnd(40)} ║`);
console.log(`║  L5 qor_assessment     ${l5.score.toFixed(1)}  ${l5.detail.substring(0, 40).padEnd(40)} ║`);
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  TOTAL: ${totalScore.toFixed(1)}/5.0 ${totalScore === 5.0 ? '✅ ALL LAYERS PASSED' : '⚠️  SOME GAPS'}                    ║`);
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Extract QoR values for verification
const wnsMatch = claudeAfter.match(/WNS[:\s]+([\-\+]?[\d.]+)\s*ns/i) ||
                 claudeAfter.match(/WNS[:\s]+([\-\+]?[\d.]+)ns/i);
const tnsMatch = claudeAfter.match(/TNS[:\s]+([\-\+]?[\d.]+)\s*ns/i) ||
                 claudeAfter.match(/TNS[:\s]+([\-\+]?[\d.]+)ns/i);

if (wnsMatch && tnsMatch) {
  console.log('✓ QoR Values Extracted:');
  console.log(`  - WNS: ${wnsMatch[1]}ns`);
  console.log(`  - TNS: ${tnsMatch[1]}ns`);
}

process.exit(totalScore === 5.0 ? 0 : 1);
