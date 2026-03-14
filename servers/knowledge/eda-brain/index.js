#!/usr/bin/env node
/**
 * EDA-Brain - EDA Tools Working Knowledge Base
 *
 * Stores comprehensive knowledge about EDA tools:
 * - Command references (Innovus, DC, PrimeTime, ICC2, etc.)
 * - Syntax patterns and validation rules
 * - Tool-specific best practices
 * - Error message database
 * - Tool capabilities and feature matrices
 *
 * Works alongside ASIC-Brain (general reasoning) and Project-Brain (design-specific)
 * to provide tool-specific expertise.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Tool Registry - All supported EDA tools
// ============================================================================

const TOOL_REGISTRY = {
  innovus: {
    name: 'Cadence Innovus',
    vendor: 'Cadence',
    version: '20.10',
    category: 'pnr',
    description: 'Implementation system for digital IC design',
    capabilities: [
      'design_init', 'floorplan', 'power_planning', 'placement',
      'cts', 'routing', 'optimization', 'signoff'
    ],
    prompt: 'innovus',
    fileExtensions: ['.enc', '.def', '.gds'],
  },
  dc_shell: {
    name: 'Synopsys Design Compiler',
    vendor: 'Synopsys',
    version: 'L-2016.03-SP2',
    category: 'synthesis',
    description: 'RTL synthesis tool',
    capabilities: ['synthesis', 'optimization', 'dft', 'constraints'],
    prompt: 'dc_shell',
    fileExtensions: ['.db', '.v', '.sdc'],
  },
  pt_shell: {
    name: 'Synopsys PrimeTime',
    vendor: 'Synopsys',
    version: 'T-2022.03',
    category: 'signoff',
    description: 'Static timing analysis (STA) tool',
    capabilities: ['timing_analysis', 'signoff', 'ecos', 'constraints_validation'],
    prompt: 'pt_shell',
    fileExtensions: ['.db', '.v', '.sdc', '.spef'],
  },
  icc2: {
    name: 'Synopsys IC Compiler II',
    vendor: 'Synopsys',
    version: 'T-2022.03',
    category: 'pnr',
    description: 'Place and route tool',
    capabilities: [
      'design_init', 'floorplan', 'power_planning', 'placement',
      'cts', 'routing', 'optimization'
    ],
    prompt: 'icc2',
    fileExtensions: ['.nlib', '.def', '.gds'],
  },
  starrc: {
    name: 'Synopsys StarRC',
    vendor: 'Synopsys',
    category: 'extraction',
    description: 'Parasitic extraction tool',
    capabilities: ['rc_extraction', 'parasitics', 'signoff'],
    prompt: 'starrc',
    fileExtensions: ['.spef', '.spf'],
  },
  genus: {
    name: 'Cadence Genus',
    vendor: 'Cadence',
    category: 'synthesis',
    description: 'RTL synthesis and optimization',
    capabilities: ['synthesis', 'optimization', 'constraints'],
    prompt: 'genus',
    fileExtensions: ['.v', '.sdc'],
  },
  tempus: {
    name: 'Cadence Tempus',
    vendor: 'Cadence',
    category: 'signoff',
    description: 'Timing signoff and analysis',
    capabilities: ['timing_analysis', 'signoff', 'ecos'],
    prompt: 'tempus',
    fileExtensions: ['.v', '.sdc', '.spef'],
  },
};

// ============================================================================
// Command Database - Tool-specific commands
// ============================================================================

const COMMAND_DATABASE = {
  innovus: {
    // Design initialization
    init_design: {
      syntax: 'init_design',
      description: 'Initialize design with loaded variables',
      prerequisites: ['init_verilog', 'init_lef_file', 'init_top_cell'],
      example: `set init_verilog "design.v"
set init_lef_file "tech.tlef cells.lef"
set init_top_cell "top"
init_design`,
      category: 'design_init',
    },
    floorPlan: {
      syntax: 'floorPlan -site <site> -su <ar> <density> <l> <b> <r> <t>',
      description: 'Create floorplan with site utilization mode',
      parameters: {
        site: 'Site name (e.g., unit)',
        ar: 'Aspect ratio (1.0 = square)',
        density: 'Target utilization (0.0-1.0)',
        l: 'Left margin (um)',
        b: 'Bottom margin (um)',
        r: 'Right margin (um)',
        t: 'Top margin (um)',
      },
      example: 'floorPlan -site unit -su 1.0 0.70 10 10 10 10',
      category: 'floorplan',
    },
    place_opt_design: {
      syntax: 'place_opt_design [-incremental] [-optimize_flow]',
      description: 'Place and optimize standard cells',
      options: {
        incremental: 'Incremental optimization',
        optimize_flow: 'Enable optimization flow',
      },
      category: 'placement',
    },
    ccopt_design: {
      syntax: 'ccopt_design',
      description: 'Clock tree synthesis and optimization',
      prerequisites: ['create_ccopt_clock_tree_spec'],
      category: 'cts',
    },
    routeDesign: {
      syntax: 'routeDesign',
      description: 'Global and detail routing',
      category: 'routing',
    },
    verify_drc: {
      syntax: 'verify_drc',
      description: 'Verify design rule compliance',
      category: 'signoff',
    },
    report_timing: {
      syntax: 'report_timing [-max_paths <n>] [-late] [-early]',
      description: 'Report timing analysis',
      parameters: {
        max_paths: 'Number of paths to report',
        late: 'Report setup (late) paths',
        early: 'Report hold (early) paths',
      },
      example: 'report_timing -max_paths 100 -late',
      category: 'reporting',
    },
  },

  dc_shell: {
    analyze: {
      syntax: 'analyze -format <format> <files>',
      description: 'Analyze RTL source files',
      parameters: {
        format: 'verilog | sverilog | vhdl',
        files: 'List of source files',
      },
      example: 'analyze -format sverilog [glob *.v]',
      category: 'synthesis',
    },
    elaborate: {
      syntax: 'elaborate <design_name>',
      description: 'Elaborate analyzed design',
      example: 'elaborate top',
      category: 'synthesis',
    },
    compile_ultra: {
      syntax: 'compile_ultra [-scan] [-no_scan] [-retime] [-incremental]',
      description: 'Compile with ultra optimization',
      options: {
        scan: 'Enable scan insertion',
        no_scan: 'Disable scan insertion',
        retime: 'Enable retiming',
        incremental: 'Incremental compilation',
      },
      example: 'compile_ultra -scan',
      category: 'synthesis',
    },
    remove_path_group: {
      syntax: 'remove_path_group -all',
      description: 'Remove all path groups',
      category: 'constraints',
    },
    group_path: {
      syntax: 'group_path -name <name> -from <from_list> -to <to_list>',
      description: 'Create timing path group',
      example: 'group_path -name reg2reg -from [all_registers] -to [all_registers]',
      category: 'constraints',
    },
  },

  pt_shell: {
    read_db: {
      syntax: 'read_db <file>',
      description: 'Read design database',
      category: 'input_output',
    },
    read_verilog: {
      syntax: 'read_verilog <file>',
      description: 'Read Verilog netlist',
      category: 'input_output',
    },
    read_sdc: {
      syntax: 'read_sdc <file>',
      description: 'Read SDC constraints',
      category: 'constraints',
    },
    report_timing: {
      syntax: 'report_timing [-max_paths <n>] [-delay_type <type>]',
      description: 'Report timing analysis',
      parameters: {
        max_paths: 'Number of paths to report',
        delay_type: 'max | min | min_max',
      },
      category: 'reporting',
    },
  },
};

// ============================================================================
// Error Pattern Database
// ============================================================================

const ERROR_PATTERNS = {
  innovus: {
    IMPLF_53: {
      code: 'IMPLF-53',
      pattern: /IMPLF-53.*layer.*referenced in pin.*macro/i,
      description: 'Tech LEF must be loaded before cell LEFs',
      severity: 'error',
      fix: 'Reorder LEF files: .tlef before .lef',
      autoFixable: true,
    },
    LEF_LOADING_FAILED: {
      code: 'LEF_LOADING_FAILED',
      pattern: /Loading LEF file\(s\) failed/i,
      description: 'LEF files failed to load',
      severity: 'error',
      fix: 'Check LEF file paths and order (tech LEF first)',
      autoFixable: false,
    },
    NO_TIMING_CONSTRAINTS: {
      code: 'NO_TIMING_CONSTRAINTS',
      pattern: /No timing constraints found/i,
      description: 'Missing SDC constraints',
      severity: 'warning',
      fix: 'Load SDC file with source command',
      autoFixable: false,
    },
  },

  dc_shell: {
    UNRESOLVED_REFERENCE: {
      code: 'UNRESOLVED_REFERENCE',
      pattern: /Unresolved reference to/i,
      description: 'Module or cell reference not found',
      severity: 'error',
      fix: 'Check library references and link_design',
      autoFixable: false,
    },
    MISSING_TARGET_LIBRARY: {
      code: 'MISSING_TARGET_LIBRARY',
      pattern: /target_library not set/i,
      description: 'Target library not configured',
      severity: 'error',
      fix: 'Set target_library variable',
      autoFixable: true,
    },
  },

  pt_shell: {
    NO_CLOCKS_DEFINED: {
      code: 'NO_CLOCKS_DEFINED',
      pattern: /No clocks defined/i,
      description: 'No clock constraints in design',
      severity: 'error',
      fix: 'Load SDC with create_clock definitions',
      autoFixable: false,
    },
  },
};

// ============================================================================
// Best Practices Database
// ============================================================================

const BEST_PRACTICES = {
  innovus: {
    floorplan: [
      {
        title: 'LEF Loading Order',
        description: 'Always load Tech LEF (.tlef) before cell LEFs (.lef)',
        rationale: 'Tech LEF defines layers that cell LEFs reference',
        check: 'init_lef_file order',
      },
      {
        title: 'Core Utilization',
        description: 'Target 65-75% core utilization for initial floorplan',
        rationale: 'Leaves room for optimization and CTS',
        check: 'floorPlan density parameter',
      },
    ],
    placement: [
      {
        title: 'Path Groups',
        description: 'Create path groups before placement for better QoR',
        rationale: 'Helps tool prioritize critical paths',
        commands: ['reset_path_groups', 'createBasicPathGroups -expanded'],
      },
    ],
    cts: [
      {
        title: 'NDR Rules',
        description: 'Apply Non-Default Rules for clock nets',
        rationale: 'Improves clock skew and reduces crosstalk',
        commands: ['set_ccopt_property use_default_ndr false'],
      },
    ],
  },

  dc_shell: {
    synthesis: [
      {
        title: 'Compile Strategy',
        description: 'Use compile_ultra -scan for DFT-ready netlist',
        rationale: 'Enables scan insertion during synthesis',
        command: 'compile_ultra -scan',
      },
      {
        title: 'Path Groups',
        description: 'Define path groups for reg2reg, in2reg, reg2out',
        rationale: 'Better optimization control',
        commands: [
          'remove_path_group -all',
          'group_path -name reg2reg -from [all_registers] -to [all_registers]',
        ],
      },
    ],
  },
};

// ============================================================================
// EDA-Brain Class
// ============================================================================

class EDABrain {
  constructor() {
    this.tools = TOOL_REGISTRY;
    this.commands = COMMAND_DATABASE;
    this.errors = ERROR_PATTERNS;
    this.practices = BEST_PRACTICES;
  }

  /**
   * Get tool information
   */
  getTool(toolName) {
    return this.tools[toolName] || null;
  }

  /**
   * List all supported tools
   */
  listTools(category = null) {
    const tools = Object.entries(this.tools).map(([id, info]) => ({
      id,
      ...info,
    }));

    if (category) {
      return tools.filter(t => t.category === category);
    }
    return tools;
  }

  /**
   * Get command information
   */
  getCommand(tool, command) {
    if (!this.commands[tool] || !this.commands[tool][command]) {
      return null;
    }
    return {
      tool,
      command,
      ...this.commands[tool][command],
    };
  }

  /**
   * Search commands by category
   */
  getCommandsByCategory(tool, category) {
    if (!this.commands[tool]) return [];

    return Object.entries(this.commands[tool])
      .filter(([_, info]) => info.category === category)
      .map(([cmd, info]) => ({ command: cmd, ...info }));
  }

  /**
   * Fuzzy search commands
   */
  searchCommands(tool, query) {
    if (!this.commands[tool]) return [];

    const lowerQuery = query.toLowerCase();
    return Object.entries(this.commands[tool])
      .filter(([cmd, info]) => {
        return cmd.toLowerCase().includes(lowerQuery) ||
               info.description?.toLowerCase().includes(lowerQuery) ||
               info.category?.toLowerCase().includes(lowerQuery);
      })
      .map(([cmd, info]) => ({ command: cmd, ...info }));
  }

  /**
   * Match error pattern
   */
  matchError(tool, output) {
    if (!this.errors[tool]) return null;

    for (const [id, pattern] of Object.entries(this.errors[tool])) {
      if (pattern.pattern.test(output)) {
        return {
          id,
          tool,
          ...pattern,
        };
      }
    }
    return null;
  }

  /**
   * Get best practices for tool/stage
   */
  getBestPractices(tool, stage = null) {
    if (!this.practices[tool]) return [];

    if (stage) {
      return this.practices[tool][stage] || [];
    }

    // Return all practices for tool
    return Object.values(this.practices[tool]).flat();
  }

  /**
   * Validate command syntax
   */
  validateCommand(tool, command) {
    const cmdInfo = this.getCommand(tool, command.split(' ')[0]);
    if (!cmdInfo) {
      return {
        valid: false,
        error: `Unknown command: ${command}`,
      };
    }

    // Basic syntax validation
    return {
      valid: true,
      command: cmdInfo,
    };
  }

  /**
   * Get tool capabilities for a stage
   */
  getCapabilities(tool, stage) {
    const toolInfo = this.getTool(tool);
    if (!toolInfo) return [];

    return toolInfo.capabilities.filter(cap => cap.includes(stage));
  }

  /**
   * Compare tools for a specific capability
   */
  compareTools(capability) {
    return Object.entries(this.tools)
      .filter(([_, info]) => info.capabilities.includes(capability))
      .map(([id, info]) => ({
        id,
        name: info.name,
        vendor: info.vendor,
      }));
  }

  /**
   * Generate command example
   */
  generateExample(tool, command, context = {}) {
    const cmdInfo = this.getCommand(tool, command);
    if (!cmdInfo) return null;

    let example = cmdInfo.example || cmdInfo.syntax;

    // Replace placeholders with context values
    for (const [key, value] of Object.entries(context)) {
      example = example.replace(new RegExp(`<${key}>`, 'g'), value);
    }

    return example;
  }
}

// ============================================================================
// Quick Access Functions
// ============================================================================

let globalInstance = null;

function getEDABrain() {
  if (!globalInstance) {
    globalInstance = new EDABrain();
  }
  return globalInstance;
}

export function getToolInfo(tool) {
  return getEDABrain().getTool(tool);
}

export function listTools(category) {
  return getEDABrain().listTools(category);
}

export function getCommand(tool, command) {
  return getEDABrain().getCommand(tool, command);
}

export function searchCommands(tool, query) {
  return getEDABrain().searchCommands(tool, query);
}

export function getCommandsByCategory(tool, category) {
  return getEDABrain().getCommandsByCategory(tool, category);
}

export function matchErrorPattern(tool, output) {
  return getEDABrain().matchError(tool, output);
}

export function getBestPractices(tool, stage) {
  return getEDABrain().getBestPractices(tool, stage);
}

export function validateCommandSyntax(tool, command) {
  return getEDABrain().validateCommand(tool, command);
}

export function compareToolsForCapability(capability) {
  return getEDABrain().compareTools(capability);
}

export function generateCommandExample(tool, command, context) {
  return getEDABrain().generateExample(tool, command, context);
}

// ============================================================================
// Exports
// ============================================================================

export {
  EDABrain,
  TOOL_REGISTRY,
  COMMAND_DATABASE,
  ERROR_PATTERNS,
  BEST_PRACTICES,
};

export default {
  getToolInfo,
  listTools,
  getCommand,
  searchCommands,
  getCommandsByCategory,
  matchErrorPattern,
  getBestPractices,
  validateCommandSyntax,
  compareToolsForCapability,
  generateCommandExample,
};
