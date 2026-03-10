/**
 * Tcl Generation Engine for LittleBrain
 *
 * Purpose: Generate correct, validated Tcl scripts for EDA tools like a dedicated LLM would.
 *
 * Functions:
 * - generateTcl(intent, tool, stage, context): Main entry - convert natural language intent to Tcl
 * - sanitizeScript(tcl, tool): Fix existing Tcl - correct common errors, add missing params
 * - validateSyntax(tcl, tool): Check syntax - return {valid, errors, warnings}
 * - autoFix(tcl, errors): Auto-correct errors - apply known fixes
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Tool Definitions and Command Mappings
// ============================================================================

const TOOL_DEFINITIONS = {
  'dc_shell': {
    name: 'Design Compiler',
    vendor: 'Synopsys',
    prompt: 'dc_shell>',
    commentChar: '#',
    stringQuote: '"',
    lineContinuation: '\\',
    supportsArrays: true,
    supportsNamespaces: false,
    pathGroupReset: 'remove_path_group -all',
    compileCommand: 'compile_ultra',
    commonOptions: ['-scan', '-no_scan', '-timing_high_effort_script', '-incremental', '-retime']
  },
  'innovus': {
    name: 'Innovus',
    vendor: 'Cadence',
    prompt: 'innovus',
    commentChar: '#',
    stringQuote: '"',
    lineContinuation: '\\',
    supportsArrays: true,
    supportsNamespaces: true,
    pathGroupReset: 'reset_path_groups',
    compileCommand: 'place_opt_design',
    commonOptions: ['-incremental', '-optimize_flow']
  },
  'pt_shell': {
    name: 'PrimeTime',
    vendor: 'Synopsys',
    prompt: 'pt_shell>',
    commentChar: '#',
    stringQuote: '"',
    lineContinuation: '\\',
    supportsArrays: true,
    supportsNamespaces: false,
    pathGroupReset: 'remove_path_group -all',
    compileCommand: null,
    commonOptions: []
  }
};

// ============================================================================
// Stage Definitions with Tool-Specific Commands
// ============================================================================

const STAGE_COMMANDS = {
  'synthesis': {
    'dc_shell': {
      setup: [
        'set target_library "<TARGET_LIB>"',
        'set link_library "<LINK_LIB>"',
        'set search_path "<SEARCH_PATH>"'
      ],
      read_design: [
        'analyze -format verilog <RTL_FILES>',
        'elaborate <TOP_MODULE>',
        'link'
      ],
      constraints: [
        'source <CONSTRAINTS_FILE>'
      ],
      path_groups: [
        'remove_path_group -all',
        'group_path -name reg2reg -from [all_registers] -to [all_registers]',
        'group_path -name in2reg -from [all_inputs] -to [all_registers]',
        'group_path -name reg2out -from [all_registers] -to [all_outputs]'
      ],
      compile: [
        'compile_ultra -scan'
      ],
      outputs: [
        'write_file -format verilog -output <OUTPUT_NETLIST>',
        'write_sdc <OUTPUT_SDC>'
      ]
    }
  },

  'design_init': {
    'innovus': {
      setup: [
        'set init_verilog "<NETLIST>"',
        'set init_lef_file "<LEF_FILES>"',
        'set init_top_cell "<TOP_MODULE>"',
        'set init_gnd_net "VSS"',
        'set init_pwr_net "VDD"'
      ],
      init: [
        'init_design'
      ],
      constraints: [
        'source <CONSTRAINTS_FILE>'
      ]
    }
  },

  'floorplan': {
    'innovus': {
      floorplan: [
        'floorPlan -site <SITE> -su <ASPECT_RATIO> <DENSITY> <MARGIN_L> <MARGIN_B> <MARGIN_R> <MARGIN_T>'
      ],
      pins: [
        'place_pins -ports [all_ports]'
      ]
    }
  },

  'power_planning': {
    'innovus': {
      connect: [
        'globalNetConnect VDD -type pgpin -pin VDD -inst *',
        'globalNetConnect VSS -type pgpin -pin VSS -inst *'
      ],
      ring: [
        'addRing -nets {VDD VSS} -type core_rings -layer {met4 met5} -width 2.0 -spacing 1.0'
      ],
      stripes: [
        'addStripe -nets {VDD VSS} -layer met4 -direction vertical -width 1.0 -spacing 2.0 -set_to_set_distance 20.0'
      ],
      route: [
        'sroute -nets {VDD VSS}'
      ]
    }
  },

  'placement': {
    'innovus': {
      place: [
        'place_opt_design'
      ],
      report: [
        'reportCongestion',
        'timeDesign -preCTS -setup'
      ]
    }
  },

  'cts': {
    'innovus': {
      spec: [
        'create_ccopt_clock_tree_spec'
      ],
      cts: [
        'ccopt_design'
      ],
      report: [
        'timeDesign -postCTS -setup -hold'
      ]
    }
  },

  'routing': {
    'innovus': {
      route: [
        'routeDesign'
      ],
      verify: [
        'verify_drc',
        'verify_lvs'
      ],
      report: [
        'timeDesign -postRoute -setup -hold'
      ]
    }
  },

  'export': {
    'innovus': {
      gds: [
        'streamOut <OUTPUT_GDS> -mapFile <MAP_FILE>'
      ],
      def: [
        'defOut -routing <OUTPUT_DEF>'
      ],
      netlist: [
        'saveNetlist <OUTPUT_NETLIST>'
      ]
    }
  }
};

// ============================================================================
// Command Templates for Natural Language Intent Mapping
// ============================================================================

const INTENT_TEMPLATES = {
  // Path groups
  'set up path groups': {
    'dc_shell': `remove_path_group -all
group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
group_path -name reg2out -from [all_registers] -to [all_outputs]`,
    'innovus': `reset_path_groups
createBasicPathGroups -expanded`
  },

  'reset path groups': {
    'dc_shell': 'remove_path_group -all',
    'innovus': 'reset_path_groups'
  },

  'create path groups': {
    'dc_shell': `group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
group_path -name reg2out -from [all_registers] -to [all_outputs]`,
    'innovus': 'createBasicPathGroups -expanded'
  },

  // Floorplan
  'create floorplan': {
    'innovus': 'floorPlan -site <SITE> -su <AR> <DENSITY> <L> <B> <R> <T>'
  },

  'floorplan': {
    'innovus': 'floorPlan -site <SITE> -su <AR> <DENSITY> <L> <B> <R> <T>'
  },

  // Power planning
  'add power ring': {
    'innovus': 'addRing -nets {VDD VSS} -type core_rings -layer {met4 met5} -width 2.0 -spacing 1.0'
  },

  'add power stripes': {
    'innovus': 'addStripe -nets {VDD VSS} -layer met4 -direction vertical -width 1.0 -spacing 2.0 -set_to_set_distance 20.0'
  },

  'connect power': {
    'innovus': `globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *`
  },

  'sroute': {
    'innovus': 'sroute -nets {VDD VSS}'
  },

  // Placement
  'place design': {
    'innovus': 'place_opt_design'
  },

  'run placement': {
    'innovus': 'place_opt_design'
  },

  // CTS
  'run cts': {
    'innovus': `create_ccopt_clock_tree_spec
ccopt_design`
  },

  'clock tree synthesis': {
    'innovus': `create_ccopt_clock_tree_spec
ccopt_design`
  },

  // Routing
  'route design': {
    'innovus': 'routeDesign'
  },

  'run routing': {
    'innovus': 'routeDesign'
  },

  // Timing reports
  'report timing': {
    'dc_shell': 'report_timing -max_paths 100',
    'innovus': 'report_timing -max_paths 100 -late',
    'pt_shell': 'report_timing -max_paths 100'
  },

  'check timing': {
    'dc_shell': 'check_timing',
    'innovus': 'timeDesign -setup',
    'pt_shell': 'check_timing'
  },

  // Synthesis
  'compile': {
    'dc_shell': 'compile_ultra -scan'
  },

  'compile ultra': {
    'dc_shell': 'compile_ultra -scan'
  },

  // Design initialization
  'init design': {
    'innovus': `set init_verilog "<NETLIST>"
set init_lef_file "<LEF_FILES>"
set init_top_cell "<TOP_MODULE>"
init_design`
  },

  'initialize design': {
    'innovus': `set init_verilog "<NETLIST>"
set init_lef_file "<LEF_FILES>"
set init_top_cell "<TOP_MODULE>"
init_design`
  }
};

// ============================================================================
// Validation Rules and Error Patterns
// ============================================================================

const VALIDATION_RULES = {
  'dc_shell': {
    // Command-specific validation
    'remove_path_group': {
      pattern: /^remove_path_group\s+-all$/,
      error: "DC uses 'remove_path_group -all', not 'reset_path_groups'",
      fix: 'remove_path_group -all'
    },
    'compile_ultra': {
      pattern: /compile_ultra(\s+-\w+)*/,
      required_options: [],
      warning: "Consider using -scan for DFT, -retime for performance"
    },
    'analyze': {
      pattern: /analyze\s+-format\s+\w+/,
      error: "analyze requires -format option",
      fix: 'analyze -format verilog <files>'
    },
    'elaborate': {
      pattern: /elaborate\s+\w+/,
      error: "elaborate requires a design name",
      fix: 'elaborate <top_module>'
    }
  },

  'innovus': {
    'floorPlan': {
      pattern: /floorPlan\s+-site\s+\w+\s+-su\s+[\d.]+\s+[\d.]+/,
      error: "floorPlan requires -site and -su with correct parameter order",
      fix: 'floorPlan -site <site> -su <AR> <density> <L> <B> <R> <T>'
    },
    'init_design': {
      prerequisites: ['init_verilog', 'init_lef_file', 'init_top_cell'],
      error: "MUST set init_verilog, init_lef_file, init_top_cell BEFORE init_design"
    },
    'set_init_lef_file': {
      lef_order_check: true,
      error: "Tech LEF (.tlef) must be loaded BEFORE cell LEFs (.lef) in init_lef_file",
      fix: 'Put tech LEF (.tlef) first in the list, then cell LEFs (.lef)',
      description: 'Tech LEF defines layers that cell LEFs reference. Wrong order causes IMPLF-53 errors.'
    },
    'reset_path_groups': {
      pattern: /^reset_path_groups$/,
      error: "Innovus uses 'reset_path_groups', DC uses 'remove_path_group -all'",
      fix: 'reset_path_groups'
    }
  },

  'pt_shell': {
    'read_db': {
      pattern: /read_db\s+.+/
    },
    'read_verilog': {
      pattern: /read_verilog\s+.+/
    }
  }
};

// Common error patterns and their fixes
const ERROR_PATTERNS = {
  // DC-specific fixes
  'reset_path_groups': {
    tools: ['dc_shell'],
    error: "Command 'reset_path_groups' not found",
    fix: 'remove_path_group -all',
    description: 'DC uses remove_path_group, not reset_path_groups'
  },

  'remove_path_group -all (in innovus)': {
    tools: ['innovus'],
    error: "Invalid command 'remove_path_group'",
    fix: 'reset_path_groups',
    description: 'Innovus uses reset_path_groups, not remove_path_group'
  },

  'floorPlan -size': {
    tools: ['innovus'],
    error: "Invalid option '-size' for floorPlan",
    fix: 'floorPlan -site <site> -su <AR> <density> <margins>',
    description: 'Use -su (site utilization) mode instead of -size'
  },

  'floorPlan missing -site': {
    tools: ['innovus'],
    error: "floorPlan: missing required -site option",
    fix: 'floorPlan -site <site_name> -su ...',
    description: 'floorPlan requires -site option'
  },

  'init_design before lef': {
    tools: ['innovus'],
    error: "LEF files not loaded",
    fix: 'Set init_lef_file BEFORE init_design',
    description: 'Must set init_lef_file before calling init_design'
  },

  'LEF file order - tech LEF must be first': {
    tools: ['innovus'],
    error: "IMPLF-53.*layer.*referenced in pin.*macro",
    fix: 'Load tech LEF (.tlef) BEFORE cell LEFs (.lef)',
    description: 'Tech LEF must be loaded first to define layers before cell LEFs reference them'
  },

  'LEF loading failed - wrong order': {
    tools: ['innovus'],
    error: "Loading LEF file\\(s\\) failed",
    fix: 'Ensure tech LEF (.tlef) is loaded before cell LEFs (.lef) in init_lef_file',
    description: 'LEF files must be loaded in correct order: tech LEF first, then cell LEFs'
  },

  'compile_ultra without scan': {
    tools: ['dc_shell'],
    warning: true,
    message: "compile_ultra without -scan or -no_scan",
    fix: 'compile_ultra -scan',
    description: 'Should specify scan option for DFT'
  }
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate Tcl script from natural language intent
 *
 * @param {string} intent - Natural language description (e.g., "set up path groups")
 * @param {string} tool - Target tool ('dc_shell', 'innovus', 'pt_shell')
 * @param {string} stage - Optional flow stage context
 * @param {object} context - Optional context with placeholders and values
 * @returns {object} {tcl: string, placeholders: [], warnings: []}
 */
function generateTcl(intent, tool, stage = null, context = {}) {
  const warnings = [];
  const placeholders = [];

  // Validate tool
  if (!TOOL_DEFINITIONS[tool]) {
    return {
      tcl: null,
      placeholders: [],
      warnings: [],
      error: `Unknown tool: ${tool}. Supported: dc_shell, innovus, pt_shell`
    };
  }

  // Normalize intent
  const normalizedIntent = intent.toLowerCase().trim();

  // Look up template
  let template = null;

  // Try exact match first
  if (INTENT_TEMPLATES[normalizedIntent] && INTENT_TEMPLATES[normalizedIntent][tool]) {
    template = INTENT_TEMPLATES[normalizedIntent][tool];
  } else {
    // Try partial matches
    for (const [key, value] of Object.entries(INTENT_TEMPLATES)) {
      if (normalizedIntent.includes(key) && value[tool]) {
        template = value[tool];
        break;
      }
    }
  }

  // If no template found, try to generate from stage commands
  if (!template && stage && STAGE_COMMANDS[stage] && STAGE_COMMANDS[stage][tool]) {
    const stageCmds = STAGE_COMMANDS[stage][tool];
    const allCmds = [];
    for (const [category, commands] of Object.entries(stageCmds)) {
      allCmds.push(...commands);
    }
    template = allCmds.join('\n');
    warnings.push(`Generated from stage '${stage}' - review and customize`);
  }

  // If still no template, return error with suggestions
  if (!template) {
    const suggestions = Object.keys(INTENT_TEMPLATES).filter(k =>
      INTENT_TEMPLATES[k][tool]
    );
    return {
      tcl: null,
      placeholders: [],
      warnings: [],
      error: `No template found for intent '${intent}' with tool '${tool}'`,
      suggestions
    };
  }

  // Apply context substitutions
  let tcl = template;
  const placeholderRegex = /<([A-Z_]+)>/g;
  let match;

  while ((match = placeholderRegex.exec(template)) !== null) {
    const placeholder = match[1];
    if (!placeholders.includes(placeholder)) {
      placeholders.push(placeholder);
    }

    // Substitute if value provided in context
    if (context[placeholder] !== undefined) {
      tcl = tcl.replace(new RegExp(`<${placeholder}>`, 'g'), context[placeholder]);
    } else if (context[placeholder.toLowerCase()] !== undefined) {
      tcl = tcl.replace(new RegExp(`<${placeholder}>`, 'g'), context[placeholder.toLowerCase()]);
    }
  }

  // Add header comment
  const header = `# Generated by LittleBrain Tcl Generator
# Tool: ${TOOL_DEFINITIONS[tool].name}
# Intent: ${intent}
# Stage: ${stage || 'N/A'}
# Generated: ${new Date().toISOString()}
`;

  tcl = header + '\n' + tcl;

  return {
    tcl,
    placeholders,
    warnings,
    tool
  };
}

/**
 * Sanitize and fix existing Tcl script
 *
 * @param {string} tcl - Existing Tcl script
 * @param {string} tool - Target tool
 * @returns {object} {tcl: string, fixes: [], warnings: []}
 */
function sanitizeScript(tcl, tool) {
  const fixes = [];
  const warnings = [];
  let sanitized = tcl;

  // Validate tool
  if (!TOOL_DEFINITIONS[tool]) {
    return {
      tcl: null,
      fixes: [],
      warnings: [],
      error: `Unknown tool: ${tool}`
    };
  }

  // Apply tool-specific fixes

  // Fix 1: reset_path_groups -> remove_path_group -all for DC
  if (tool === 'dc_shell') {
    const resetPattern = /reset_path_groups\s*-all?/g;
    if (resetPattern.test(sanitized)) {
      sanitized = sanitized.replace(resetPattern, 'remove_path_group -all');
      fixes.push({
        type: 'command_substitution',
        original: 'reset_path_groups',
        replacement: 'remove_path_group -all',
        reason: 'Design Compiler uses remove_path_group, not reset_path_groups'
      });
    }
  }

  // Fix 2: remove_path_group -> reset_path_groups for Innovus
  if (tool === 'innovus') {
    const removePattern = /remove_path_group\s+-all/g;
    if (removePattern.test(sanitized)) {
      sanitized = sanitized.replace(removePattern, 'reset_path_groups');
      fixes.push({
        type: 'command_substitution',
        original: 'remove_path_group -all',
        replacement: 'reset_path_groups',
        reason: 'Innovus uses reset_path_groups, not remove_path_group'
      });
    }
  }

  // Fix 3: floorPlan -size -> floorPlan -su
  if (tool === 'innovus') {
    const sizePattern = /floorPlan\s+-size/g;
    if (sizePattern.test(sanitized)) {
      warnings.push({
        type: 'deprecated_syntax',
        message: "floorPlan -size is deprecated, use -su (site utilization) mode",
        suggestion: 'floorPlan -site <site> -su <AR> <density> <margins>'
      });
    }
  }

  // Fix 4: Add missing -scan to compile_ultra in DC
  if (tool === 'dc_shell') {
    const compilePattern = /compile_ultra\s*(?!.*-scan)(?!.*-no_scan)/;
    if (compilePattern.test(sanitized)) {
      sanitized = sanitized.replace(/compile_ultra(?!\s*-)/g, 'compile_ultra -scan');
      fixes.push({
        type: 'add_option',
        command: 'compile_ultra',
        added: '-scan',
        reason: 'Added -scan option for DFT (use -no_scan if not doing scan)'
      });
    }
  }

  // Fix 5: Check for init_design prerequisites in Innovus
  if (tool === 'innovus' && sanitized.includes('init_design')) {
    const hasInitLef = /set\s+init_lef_file/.test(sanitized);
    const hasInitVerilog = /set\s+init_verilog/.test(sanitized);
    const hasInitTop = /set\s+init_top_cell/.test(sanitized);

    if (!hasInitLef || !hasInitVerilog || !hasInitTop) {
      warnings.push({
        type: 'missing_prerequisite',
        message: 'init_design requires init_lef_file, init_verilog, and init_top_cell to be set first',
        missing: [
          !hasInitLef && 'init_lef_file',
          !hasInitVerilog && 'init_verilog',
          !hasInitTop && 'init_top_cell'
        ].filter(Boolean)
      });
    }
  }

  // Fix 5b: Validate and fix LEF file loading order (tech LEF must be first)
  if (tool === 'innovus') {
    const lefMatch = sanitized.match(/set\s+init_lef_file\s+\{([^}]+)\}/);
    if (lefMatch) {
      const lefFiles = lefMatch[1].trim().split(/\s+/);
      const techLefIndex = lefFiles.findIndex(f => f.includes('.tlef') || f.includes('tech'));
      const cellLefIndices = lefFiles.map((f, i) => (f.includes('.lef') && !f.includes('.tlef')) ? i : -1).filter(i => i >= 0);

      // Check if tech LEF exists and is before all cell LEFs
      if (techLefIndex >= 0 && cellLefIndices.some(i => i < techLefIndex)) {
        // Tech LEF is after some cell LEFs - need to reorder
        const techLef = lefFiles[techLefIndex];
        const otherLefs = lefFiles.filter((_, i) => i !== techLefIndex);
        const reordered = [techLef, ...otherLefs];

        sanitized = sanitized.replace(
          /set\s+init_lef_file\s+\{[^}]+\}/,
          `set init_lef_file "${reordered.join(' ')}"`
        );

        fixes.push({
          type: 'lef_order_fix',
          original: lefFiles.join(' '),
          reordered: reordered.join(' '),
          reason: 'Tech LEF (.tlef) must be loaded BEFORE cell LEFs (.lef) to define layers'
        });

        warnings.push({
          type: 'lef_order_corrected',
          message: 'Reordered LEF files: tech LEF (.tlef) must be first to define layers before cell LEFs reference them',
          severity: 'warning'
        });
      }
    }
  }

  // Fix 6: Remove trailing whitespace
  const originalLength = sanitized.length;
  sanitized = sanitized.replace(/[ \t]+$/gm, '');
  if (sanitized.length !== originalLength) {
    fixes.push({
      type: 'whitespace_cleanup',
      message: 'Removed trailing whitespace'
    });
  }

  // Fix 7: Ensure proper line endings
  sanitized = sanitized.replace(/\r\n/g, '\n');

  return {
    tcl: sanitized,
    fixes,
    warnings,
    tool
  };
}

/**
 * Validate Tcl syntax for a specific tool
 *
 * @param {string} tcl - Tcl script to validate
 * @param {string} tool - Target tool
 * @returns {object} {valid: boolean, errors: [], warnings: []}
 */
function validateSyntax(tcl, tool) {
  const errors = [];
  const warnings = [];

  // Validate tool
  if (!TOOL_DEFINITIONS[tool]) {
    return {
      valid: false,
      errors: [{ message: `Unknown tool: ${tool}` }],
      warnings: []
    };
  }

  const lines = tcl.split('\n');
  const toolRules = VALIDATION_RULES[tool] || {};

  // Track state for prerequisite checking
  const state = {
    variables: new Set(),
    commands: [],
    inComment: false
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Track variable assignments
    const varMatch = line.match(/set\s+(\w+)\s+/);
    if (varMatch) {
      state.variables.add(varMatch[1]);
    }

    // Get command name
    const cmdMatch = line.match(/^(\w+)/);
    if (cmdMatch) {
      const cmdName = cmdMatch[1];
      state.commands.push({ line: lineNum, command: cmdName, full: line });

      // Check command-specific rules
      if (toolRules[cmdName]) {
        const rule = toolRules[cmdName];

        // Check pattern
        if (rule.pattern && !rule.pattern.test(line)) {
          errors.push({
            line: lineNum,
            command: cmdName,
            message: rule.error || `Invalid syntax for ${cmdName}`,
            fix: rule.fix,
            severity: 'error'
          });
        }

        // Check prerequisites
        if (rule.prerequisites) {
          for (const prereq of rule.prerequisites) {
            if (!state.variables.has(prereq)) {
              errors.push({
                line: lineNum,
                command: cmdName,
                message: rule.error || `${cmdName} requires ${prereq} to be set first`,
                missing: prereq,
                severity: 'error'
              });
            }
          }
        }

        // Add warning
        if (rule.warning) {
          warnings.push({
            line: lineNum,
            command: cmdName,
            message: rule.warning
          });
        }
      }
    }

    // Tool-specific syntax checks

    // Check for common cross-tool mistakes
    if (tool === 'dc_shell' && line.includes('reset_path_groups')) {
      errors.push({
        line: lineNum,
        message: "DC uses 'remove_path_group -all', not 'reset_path_groups'",
        fix: 'remove_path_group -all',
        severity: 'error'
      });
    }

    if (tool === 'innovus' && /remove_path_group\s+-all/.test(line)) {
      errors.push({
        line: lineNum,
        message: "Innovus uses 'reset_path_groups', not 'remove_path_group -all'",
        fix: 'reset_path_groups',
        severity: 'error'
      });
    }

    // Check bracket balance
    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push({
        line: lineNum,
        message: `Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`,
        severity: 'error'
      });
    }

    // Check brace balance
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        line: lineNum,
        message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`,
        severity: 'error'
      });
    }

    // Check quote balance
    const quotes = (line.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      errors.push({
        line: lineNum,
        message: 'Unbalanced quotes',
        severity: 'error'
      });
    }
  }

  // Post-validation checks

  // Check for init_design prerequisites (must come before init_design in script)
  if (tool === 'innovus') {
    const initDesignLine = state.commands.find(c => c.command === 'init_design');
    if (initDesignLine) {
      const requiredVars = ['init_lef_file', 'init_verilog', 'init_top_cell'];
      for (const varName of requiredVars) {
        if (!state.variables.has(varName)) {
          errors.push({
            line: initDesignLine.line,
            command: 'init_design',
            message: `Missing required variable: ${varName} must be set before init_design`,
            severity: 'error'
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      lines: lines.length,
      commands: state.commands.length,
      variables: Array.from(state.variables)
    }
  };
}

/**
 * Auto-fix errors in Tcl script
 *
 * @param {string} tcl - Tcl script with errors
 * @param {array} errors - Array of errors from validateSyntax
 * @returns {object} {tcl: string, applied: [], remaining: []}
 */
function autoFix(tcl, errors) {
  const applied = [];
  const remaining = [];
  let fixed = tcl;

  for (const error of errors) {
    let wasFixed = false;

    switch (error.message) {
      case "DC uses 'remove_path_group -all', not 'reset_path_groups'":
        fixed = fixed.replace(/reset_path_groups\s*-all?/g, 'remove_path_group -all');
        wasFixed = true;
        break;

      case "Innovus uses 'reset_path_groups', not 'remove_path_group -all'":
        fixed = fixed.replace(/remove_path_group\s+-all/g, 'reset_path_groups');
        wasFixed = true;
        break;

      case "floorPlan requires -site and -su with correct parameter order":
        // Cannot auto-fix without knowing parameters
        wasFixed = false;
        break;

      default:
        // Check if there's a fix suggestion
        if (error.fix) {
          // Try to apply the fix if it's a simple replacement
          if (error.command && fixed.includes(error.command)) {
            // This is a simplified fix - may need manual review
            wasFixed = false; // Mark as not auto-fixed for safety
          }
        }
        break;
    }

    if (wasFixed) {
      applied.push(error);
    } else {
      remaining.push(error);
    }
  }

  // Re-validate to check if all errors were fixed
  return {
    tcl: fixed,
    applied,
    remaining,
    allFixed: remaining.length === 0
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get tool information
 */
function getToolInfo(tool) {
  return TOOL_DEFINITIONS[tool] || null;
}

/**
 * List available intents for a tool
 */
function listIntents(tool = null) {
  if (tool) {
    return Object.entries(INTENT_TEMPLATES)
      .filter(([_, templates]) => templates[tool])
      .map(([intent, _]) => intent);
  }
  return Object.keys(INTENT_TEMPLATES);
}

/**
 * Get stage commands for a specific tool and stage
 */
function getStageCommands(stage, tool) {
  if (STAGE_COMMANDS[stage] && STAGE_COMMANDS[stage][tool]) {
    return STAGE_COMMANDS[stage][tool];
  }
  return null;
}

// ============================================================================
// Exports
// ============================================================================

export {
  generateTcl,
  sanitizeScript,
  validateSyntax,
  autoFix,
  getToolInfo,
  listIntents,
  getStageCommands,
  TOOL_DEFINITIONS,
  STAGE_COMMANDS,
  INTENT_TEMPLATES,
  VALIDATION_RULES,
  ERROR_PATTERNS
};

// Default export for convenience
export default {
  generateTcl,
  sanitizeScript,
  validateSyntax,
  autoFix,
  getToolInfo,
  listIntents,
  getStageCommands
};
