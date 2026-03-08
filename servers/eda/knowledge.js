/**
 * PageIndex-based Knowledge Module for HiPilot EDA Server
 *
 * Provides context-aware command lookup using hierarchical tree structure.
 * Replaces similarity-based RAG with reasoning-based tree navigation.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Knowledge base paths
const KNOWLEDGE_PATHS = {
  master: join(PROJECT_ROOT, 'memory', 'EDA_MASTER_KNOWLEDGE_BASE.md'),
  dc: join(PROJECT_ROOT, 'memory', 'DC_COMMAND_REFERENCE.md'),
  innovus: join(PROJECT_ROOT, 'memory', 'INNOVUS_COMMAND_REFERENCE.md'),
  index: join(PROJECT_ROOT, 'memory', 'EDA_KNOWLEDGE_INDEX.md'),
};

// PageIndex tree structure for EDA knowledge
// This represents the hierarchical organization of knowledge
const KNOWLEDGE_TREE = {
  'FUNDAMENTALS': {
    path: '00_FUNDAMENTALS',
    children: ['ASIC_Lifecycle', 'Digital_Design', 'Standard_Cells', 'Timing_Analysis']
  },
  'RTL2GDS_FLOW': {
    path: '01_RTL2GDS_FLOW',
    children: ['Flow_Overview', 'Stage_Dependencies', 'Checkpoints', 'QoR_Metrics']
  },
  'SYNTHESIS': {
    path: '02_SYNTHESIS',
    tool: 'dc_shell',
    children: ['Library_Setup', 'Design_Reading', 'Constraints', 'Compilation', 'DFT', 'Outputs']
  },
  'PHYSICAL_DESIGN': {
    path: '03_PHYSICAL_DESIGN',
    tool: 'innovus',
    children: ['Design_Init', 'Floorplanning', 'Power_Planning', 'Placement', 'CTS', 'Routing', 'Finishing']
  },
  'SIGNOFF': {
    path: '04_SIGNOFF',
    children: ['PrimeTime_STA', 'SDC_Constraints', 'StarRC', 'Physical_Verification']
  },
  'TROUBLESHOOTING': {
    path: '05_TROUBLESHOOTING',
    children: ['Tool_Detection', 'Common_Errors', 'Debugging']
  }
};

// Stage to tool mapping
const STAGE_TOOL_MAP = {
  // Stage 0: Synthesis
  'synthesis': 'dc_shell',
  'compile': 'dc_shell',
  'dc': 'dc_shell',

  // Stages 1-9: Physical Design (Innovus)
  'init': 'innovus',
  'init_design': 'innovus',
  'floorplan': 'innovus',
  'floorplanning': 'innovus',
  'powerplan': 'innovus',
  'power_planning': 'innovus',
  'placement': 'innovus',
  'place': 'innovus',
  'cts': 'innovus',
  'clock_tree': 'innovus',
  'routing': 'innovus',
  'route': 'innovus',
  'chip_finish': 'innovus',
  'finish': 'innovus',
  'gds': 'innovus',

  // Signoff tools
  'sta': 'pt_shell',
  'primetime': 'pt_shell',
  'pt_shell': 'pt_shell',
  'extraction': 'starrc',
  'starrc': 'starrc',
};

// Command patterns by tool
const TOOL_COMMAND_PATTERNS = {
  'dc_shell': [
    /^analyze\s/,
    /^elaborate\s/,
    /^compile/,
    /^read_file/,
    /^write_file/,
    /^set_target_library/,
    /^set_link_library/,
    /^create_clock/,
    /^set_input_delay/,
    /^set_output_delay/,
    /^insert_dft/,
    /^set_dft_signal/,
  ],
  'innovus': [
    /^init_design/,
    /^floorPlan/,
    /^globalNetConnect/,
    /^addStripe/,
    /^sroute/,
    /^place_opt_design/,
    /^ccopt_design/,
    /^routeDesign/,
    /^optDesign/,
    /^timeDesign/,
    /^saveDesign/,
    /^defIn/,
    /^defOut/,
    /^streamOut/,
    /^saveNetlist/,
    /^source.*\.enc/,
  ],
  'pt_shell': [
    /^read_file/,
    /^read_parasitics/,
    /^update_timing/,
    /^report_timing/,
    /^report_constraint/,
  ]
};

/**
 * Get the expected tool for a given stage name
 * @param {string} stage - Stage name or command
 * @returns {string|null} - Expected tool or null
 */
export function getExpectedTool(stage) {
  const normalized = stage.toLowerCase().replace(/\s+/g, '_');
  return STAGE_TOOL_MAP[normalized] || null;
}

/**
 * Detect which tool a command belongs to
 * @param {string} command - Tcl command
 * @returns {string|null} - Tool name or null
 */
export function detectToolFromCommand(command) {
  const trimmed = command.trim();

  for (const [tool, patterns] of Object.entries(TOOL_COMMAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return tool;
      }
    }
  }

  return null;
}

/**
 * Verify if a command is appropriate for the expected tool
 * @param {string} command - Tcl command to check
 * @param {string} expectedTool - Expected tool name
 * @returns {object} - Validation result with status and message
 */
export function validateCommandContext(command, expectedTool) {
  const detectedTool = detectToolFromCommand(command);

  if (!detectedTool) {
    return {
      valid: true, // Unknown commands pass validation
      warning: 'Command tool context unknown',
      detectedTool: null,
      expectedTool
    };
  }

  if (detectedTool !== expectedTool) {
    return {
      valid: false,
      error: `Tool mismatch: Command is for ${detectedTool} but expected ${expectedTool}`,
      detectedTool,
      expectedTool,
      severity: 'CRITICAL'
    };
  }

  return {
    valid: true,
    detectedTool,
    expectedTool
  };
}

/**
 * Navigate knowledge tree and get relevant section
 * @param {string} path - Tree path like "PHYSICAL_DESIGN/Placement"
 * @returns {object} - Knowledge content
 */
export function getKnowledgeByPath(path) {
  const parts = path.split('/');
  let current = KNOWLEDGE_TREE;

  for (const part of parts) {
    if (current[part]) {
      current = current[part];
    } else {
      return null;
    }
  }

  return current;
}

/**
 * Get knowledge for a specific flow stage
 * @param {string} stage - Stage name
 * @returns {object} - Relevant knowledge
 */
export function getKnowledgeForStage(stage) {
  const tool = getExpectedTool(stage);

  if (!tool) {
    return {
      found: false,
      message: `No knowledge found for stage: ${stage}`
    };
  }

  // Map to knowledge tree
  let treePath;
  if (tool === 'dc_shell') {
    treePath = 'SYNTHESIS';
  } else if (tool === 'innovus') {
    treePath = 'PHYSICAL_DESIGN';
  } else {
    treePath = 'SIGNOFF';
  }

  return {
    found: true,
    tool,
    stage,
    treePath,
    knowledgeBase: tool === 'dc_shell' ? 'dc' : 'innovus',
    criticalRules: getCriticalRules(tool),
    commonErrors: getCommonErrors(tool),
  };
}

/**
 * Get critical rules for a tool
 * @param {string} tool - Tool name
 * @returns {string[]} - List of critical rules
 */
function getCriticalRules(tool) {
  const rules = {
    'dc_shell': [
      'Set target_library before reading design',
      'Run check_design after link',
      'Use compile_ultra for better QoR',
      'Write .ddc checkpoint after synthesis',
      'Generate scan.def for physical design'
    ],
    'innovus': [
      'Set init_* variables BEFORE init_design',
      '.enc files are Tcl scripts - use source, not read_db directly',
      'Load scan.def before placement if DFT is used',
      'Run timeDesign after each major stage',
      'Use saveDesign to create checkpoints',
      'Always source previous .enc at start of stage'
    ],
    'pt_shell': [
      'Read parasitics after netlist',
      'Run update_timing before reports',
      'Check for missing constraints'
    ]
  };

  return rules[tool] || [];
}

/**
 * Get common errors for a tool
 * @param {string} tool - Tool name
 * @returns {object[]} - List of common errors with solutions
 */
function getCommonErrors(tool) {
  const errors = {
    'dc_shell': [
      {
        pattern: /unable to resolve reference/i,
        cause: 'Missing link_library',
        solution: 'Add target library to link_library: set link_library "* $target_library"'
      },
      {
        pattern: /no clock/i,
        cause: 'Missing create_clock constraint',
        solution: 'Add clock definition: create_clock -period 10 [get_ports clk]'
      }
    ],
    'innovus': [
      {
        pattern: /cannot restore design/i,
        cause: 'Checkpoint file or .enc.dat directory missing',
        solution: 'Verify checkpoint.enc and checkpoint.enc.dat/ both exist'
      },
      {
        pattern: /command not found/i,
        cause: 'Tcl sent to bash shell (tool not running)',
        solution: 'Check tool prompt before sending commands'
      },
      {
        pattern: /init_design.*failed/i,
        cause: 'Missing init variables or library files',
        solution: 'Verify init_verilog, init_lef_file, init_mmmc_file are set'
      }
    ]
  };

  return errors[tool] || [];
}

/**
 * Diagnose an error using the knowledge base
 * @param {string} errorOutput - Error message/output
 * @param {string} tool - Tool name (optional)
 * @returns {object} - Diagnosis and suggested fix
 */
export function diagnoseError(errorOutput, tool = null) {
  const errors = tool ? getCommonErrors(tool) : [];

  // Check all known error patterns
  for (const error of errors) {
    if (error.pattern.test(errorOutput)) {
      return {
        diagnosed: true,
        cause: error.cause,
        solution: error.solution,
        severity: 'known'
      };
    }
  }

  // Check for bash prompt (tool crash)
  if (/^\[.*@.*\].*[$#]$/m.test(errorOutput)) {
    return {
      diagnosed: true,
      cause: 'EDA tool crashed to bash shell',
      solution: 'Tool exited unexpectedly. Check for Tcl syntax errors or missing files.',
      severity: 'critical'
    };
  }

  // Check for bash command not found
  if (/bash:\s*\w+:\s*command not found/i.test(errorOutput)) {
    return {
      diagnosed: true,
      cause: 'Tcl commands sent to bash shell',
      solution: 'Tool not running. Start innovus/dc_shell before sending Tcl commands.',
      severity: 'critical'
    };
  }

  return {
    diagnosed: false,
    message: 'Unknown error pattern',
    severity: 'unknown'
  };
}

/**
 * Get stage-by-stage flow guide
 * @returns {object} - Flow stages with tools and checkpoints
 */
export function getFlowGuide() {
  return {
    stages: [
      { stage: 0, name: 'Synthesis', tool: 'dc_shell', input: 'RTL', output: 'ibex_core.syn.v', checkpoint: 'synthesis.ddc' },
      { stage: 1, name: 'Design Init', tool: 'innovus', input: 'ibex_core.syn.v', output: 'init_design.enc' },
      { stage: 2, name: 'Floorplan', tool: 'innovus', input: 'init_design.enc', output: 'floor_plan.enc' },
      { stage: 3, name: 'Power Planning', tool: 'innovus', input: 'floor_plan.enc', output: 'powerplan.enc' },
      { stage: 4, name: 'Placement', tool: 'innovus', input: 'powerplan.enc', output: 'placement.enc' },
      { stage: 5, name: 'CTS', tool: 'innovus', input: 'placement.enc', output: 'cts.enc' },
      { stage: 6, name: 'Post-CTS Opt', tool: 'innovus', input: 'cts.enc', output: 'post_cts_opt.enc' },
      { stage: 7, name: 'Routing', tool: 'innovus', input: 'post_cts_opt.enc', output: 'routing.enc' },
      { stage: 8, name: 'Post-Route Opt', tool: 'innovus', input: 'routing.enc', output: 'routing_opt.enc' },
      { stage: 9, name: 'Chip Finish', tool: 'innovus', input: 'routing_opt.enc', output: 'chip_done.enc, GDS' }
    ]
  };
}

/**
 * Check if file is a valid checkpoint for a tool
 * @param {string} filename - Checkpoint filename
 * @param {string} tool - Tool name
 * @returns {boolean} - True if valid
 */
export function isValidCheckpoint(filename, tool) {
  if (tool === 'dc_shell') {
    return filename.endsWith('.ddc') || filename.endsWith('.db');
  } else if (tool === 'innovus') {
    return filename.endsWith('.enc');
  }
  return false;
}

/**
 * Get the checkpoint loading command for a tool
 * @param {string} checkpoint - Checkpoint filename
 * @param {string} tool - Tool name
 * @returns {string} - Tcl command to load checkpoint
 */
export function getCheckpointLoadCommand(checkpoint, tool) {
  if (tool === 'dc_shell') {
    return `read_file -format ddc ${checkpoint}`;
  } else if (tool === 'innovus') {
    return `source ${checkpoint}`;
  }
  return `# Unknown tool: ${tool}`;
}

// Export knowledge tree for external access
export { KNOWLEDGE_TREE, STAGE_TOOL_MAP, TOOL_COMMAND_PATTERNS };
