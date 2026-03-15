/**
 * Project Mission Pack - Configuration system for HiPilot projects
 *
 * The mission pack defines what HiPilot should do for a specific design,
 * containing all design-specific details. This enables HiPilot core to be
 * completely design-agnostic while handling any project effectively.
 *
 * Usage:
 *   const { loadMissionPack } = require('./src/mission-pack');
 *   const mission = loadMissionPack('/path/to/design');
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { validateMissionPack } from './validator.js';
import { parseMarkdownMissionPack } from './parser.js';

// Default mission pack paths (in order of priority)
// Markdown (.md) is the preferred format - natural language
// YAML (.yaml/.yml) is legacy format - structured data
const MISSION_PACK_FILES = [
  'hipilot-mission.md',         // Markdown - preferred natural language format
  'hipilot-mission.yaml',
  'hipilot-mission.yml',
  'hipilot-mission.json',
  '.hipilot/mission.md',
  '.hipilot/mission.yaml',
  '.hipilot/mission.yml',
  '.hipilot/mission.json',
];

/**
 * MissionPack class - Represents a loaded mission pack
 */
export class MissionPack {
  constructor(data, sourcePath, designDir) {
    this.data = data;
    this.sourcePath = sourcePath;
    this.designDir = designDir;
    this._validated = null;
  }

  /**
   * Get project identity
   */
  get project() {
    return this.data.project || {};
  }

  /**
   * Get design configuration
   */
  get design() {
    return this.data.design || {};
  }

  /**
   * Get flow configuration
   */
  get flow() {
    return this.data.flow || {};
  }

  /**
   * Get technology configuration
   */
  get technology() {
    return this.data.technology || {};
  }

  /**
   * Get tools configuration
   */
  get tools() {
    return this.data.tools || {};
  }

  /**
   * Get custom configuration
   */
  get custom() {
    return this.data.custom || {};
  }

  /**
   * Get project name
   */
  get projectName() {
    return this.project.name || 'unnamed';
  }

  /**
   * Get top module name
   */
  get topModule() {
    return this.design.rtl?.top_module || this.projectName;
  }

  /**
   * Get list of flow stages
   */
  get stages() {
    return this.flow.stages || [
      'synthesis',
      'design_init',
      'floorplan',
      'powerplan',
      'placement',
      'cts',
      'post_cts_opt',
      'routing',
      'route_opt',
      'chip_finish'
    ];
  }

  /**
   * Get RTL file paths (resolved to absolute paths)
   */
  getRtlFiles() {
    const rtl = this.design.rtl || {};
    const files = rtl.files || [];

    return files.map(f => this._resolvePath(f));
  }

  /**
   * Get include directories
   */
  getIncludeDirs() {
    const rtl = this.design.rtl || {};
    const dirs = rtl.include_dirs || rtl.includeDirs || [];

    return dirs.map(d => this._resolvePath(d));
  }

  /**
   * Get Verilog defines
   */
  getDefines() {
    const rtl = this.design.rtl || {};
    return rtl.defines || [];
  }

  /**
   * Get constraint files
   */
  getConstraintFiles() {
    const constraints = this.design.constraints || {};
    const sdc = constraints.sdc || [];

    return sdc.map(f => this._resolvePath(f));
  }

  /**
   * Get libraries for a specific corner
   */
  getLibraries(corner = 'typical') {
    const libs = this.design.libraries || {};

    // If specific corner defined in technology.corners
    if (this.technology.corners?.[corner]?.lib) {
      return [this._resolvePath(this.technology.corners[corner].lib)];
    }

    // Otherwise use target libraries
    const targetLibs = libs.target || libs.liberty || [];
    return targetLibs.map(f => this._resolvePath(f));
  }

  /**
   * Get all LEF files (Tech LEF should be first!)
   */
  getLefFiles() {
    const libs = this.design.libraries || {};
    const lef = libs.lef || [];

    return lef.map(f => this._resolvePath(f));
  }

  /**
   * Get GDS files
   */
  getGdsFiles() {
    const libs = this.design.libraries || {};
    const gds = libs.gds || [];

    return gds.map(f => this._resolvePath(f));
  }

  /**
   * Get PDK root directory
   */
  getPdkRoot() {
    const libs = this.design.libraries || {};
    return libs.pdk_root
      ? this._resolvePath(libs.pdk_root)
      : process.env.PDK_ROOT || null;
  }

  /**
   * Get tool configuration
   */
  getToolConfig(toolName, stage = null) {
    const toolConfig = this.tools[toolName] || {};

    if (!stage) {
      return toolConfig;
    }

    // Get stage-specific Tcl if available
    const stageTcl = toolConfig.stage_tcl?.[stage] || '';

    return {
      ...toolConfig,
      stageTcl,
    };
  }

  /**
   * Get recipe for a stage
   */
  getRecipe(stage) {
    return this.flow.recipes?.[stage] || {};
  }

  /**
   * Get target metrics
   */
  getTargets() {
    return this.flow.targets || {};
  }

  /**
   * Get target timing constraints
   */
  getTimingTargets() {
    return this.flow.targets?.timing || {};
  }

  /**
   * Get pre-stage hook
   */
  getPreHook(stage) {
    return this.custom?.pre_hooks?.[stage] || '';
  }

  /**
   * Get post-stage hook
   */
  getPostHook(stage) {
    return this.custom?.post_hooks?.[stage] || '';
  }

  /**
   * Get Tcl libraries to source
   */
  getTclLibraries() {
    const libs = this.custom?.tcl_libraries || [];
    return libs.map(f => this._resolvePath(f));
  }

  /**
   * Get custom environment variables
   */
  getEnvironment() {
    return this.custom?.environment || {};
  }

  /**
   * Get floorplan configuration
   */
  getFloorplanConfig() {
    return this.design.floorplan || {};
  }

  /**
   * Get MMMC corner definitions
   */
  getCorners() {
    return this.technology.corners || {};
  }

  /**
   * Get power domain configuration
   */
  getPowerDomains() {
    return this.technology.power || {};
  }

  /**
   * Get technology node info
   */
  getTechnologyInfo() {
    return {
      node: this.technology.node || 'unknown',
      foundry: this.technology.foundry || 'unknown',
      process: this.technology.process || 'unknown',
    };
  }

  /**
   * Validate the mission pack
   */
  validate() {
    if (this._validated === null) {
      this._validated = validateMissionPack(this.data);
    }
    return this._validated;
  }

  /**
   * Check if mission pack is valid
   */
  isValid() {
    return this.validate().valid;
  }

  /**
   * Get summary of mission pack
   */
  getSummary() {
    return {
      project: this.projectName,
      topModule: this.topModule,
      rtlFiles: this.getRtlFiles().length,
      stages: this.stages.length,
      source: this.sourcePath,
      valid: this.isValid(),
    };
  }

  /**
   * Resolve a relative path to absolute
   */
  _resolvePath(path) {
    if (path.startsWith('/')) {
      return path;
    }
    return resolve(this.designDir, path);
  }

  /**
   * Export mission pack as plain object
   */
  toJSON() {
    return {
      ...this.data,
      _meta: {
        source: this.sourcePath,
        designDir: this.designDir,
        loadedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Find mission pack file in design directory
 */
function findMissionPackFile(designDir) {
  // Check environment variable first
  const envPath = process.env.HIPILOT_MISSION_PACK;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // Search in design directory
  for (const file of MISSION_PACK_FILES) {
    const fullPath = join(designDir, file);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Parse mission pack content (Markdown, YAML, or JSON)
 */
function parseMissionPack(content, filePath, designDir) {
  const ext = filePath.split('.').pop().toLowerCase();

  if (ext === 'json') {
    return JSON.parse(content);
  }

  if (ext === 'md') {
    // Parse natural language Markdown
    return parseMarkdownMissionPack(content, designDir);
  }

  // Simple YAML parser for basic structure
  // For complex YAML, we'd use a library like js-yaml
  // But for now, we'll use a minimal parser
  return parseMinimalYaml(content);
}

/**
 * Minimal YAML parser for mission packs
 * Handles basic structure: key: value, nested objects, arrays
 */
function parseMinimalYaml(content) {
  const lines = content.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Calculate indent level
    const indent = line.length - line.trimStart().length;

    // Parse the line
    const colonIndex = trimmed.indexOf(':');
    let key, value;

    if (colonIndex === -1) {
      // Array item
      if (trimmed.startsWith('- ')) {
        value = trimmed.slice(2).trim();
        // Find the array in current context
        const current = stack[stack.length - 1];
        if (!current.array) {
          current.array = [];
          current.obj[current.key] = current.array;
        }

        // Check if value is a nested object
        if (!value) {
          // Multi-line object in array - handled by next iterations
          current.array.push({});
          stack.push({
            obj: current.array[current.array.length - 1],
            indent: indent,
            array: null,
          });
        } else {
          current.array.push(parseYamlValue(value));
        }
        continue;
      }
      continue; // Skip malformed lines
    }

    key = trimmed.slice(0, colonIndex).trim();
    value = trimmed.slice(colonIndex + 1).trim();

    // Pop stack to find correct parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Check if this is an array item
    if (key === '-') {
      if (!current.array) {
        current.array = [];
        current.obj[current.key] = current.array;
      }
      current.array.push(parseYamlValue(value));
    } else if (!value) {
      // Nested object
      current.obj[key] = {};
      stack.push({
        obj: current.obj[key],
        key: key,
        indent: indent,
        array: null,
      });
    } else {
      // Key-value pair
      current.obj[key] = parseYamlValue(value);
    }
  }

  return result;
}

/**
 * Parse a YAML value
 */
function parseYamlValue(value) {
  if (!value) return null;

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // Array notation [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value);
    } catch {
      // Fall through to string
    }
  }

  // Quoted string
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Literal block (| or >) - simplified, just return as-is
  return value;
}

/**
 * Load a mission pack from a design directory
 */
export function loadMissionPack(designDir = null) {
  const targetDir = designDir || process.env.HIPILOT_DESIGN_DIR || process.cwd();

  const missionPackPath = findMissionPackFile(targetDir);

  if (!missionPackPath) {
    // Return a default mission pack
    return createDefaultMissionPack(targetDir);
  }

  try {
    const content = readFileSync(missionPackPath, 'utf-8');
    const data = parseMissionPack(content, missionPackPath, targetDir);

    return new MissionPack(data, missionPackPath, targetDir);
  } catch (error) {
    throw new Error(`Failed to load mission pack from ${missionPackPath}: ${error.message}`);
  }
}

/**
 * Create a default mission pack for designs without one
 */
export function createDefaultMissionPack(designDir) {
  const designName = designDir.split('/').pop() || 'unnamed';

  const defaultData = {
    project: {
      name: designName,
      description: `Auto-generated mission pack for ${designName}`,
      version: '1.0.0',
    },
    design: {
      rtl: {
        top_module: designName,
        auto_detect: true,
      },
      libraries: {
        auto_detect: true,
      },
    },
    flow: {
      stages: [
        'synthesis',
        'design_init',
        'floorplan',
        'powerplan',
        'placement',
        'cts',
        'post_cts_opt',
        'routing',
        'route_opt',
        'chip_finish',
      ],
    },
  };

  return new MissionPack(defaultData, null, designDir);
}

/**
 * Check if a mission pack exists for a design directory
 */
export function hasMissionPack(designDir = null) {
  const targetDir = designDir || process.env.HIPILOT_DESIGN_DIR || process.cwd();
  return findMissionPackFile(targetDir) !== null;
}

/**
 * Get mission pack info without fully loading it
 */
export function getMissionPackInfo(designDir = null) {
  const targetDir = designDir || process.env.HIPILOT_DESIGN_DIR || process.cwd();
  const path = findMissionPackFile(targetDir);

  if (!path) {
    return { exists: false };
  }

  return {
    exists: true,
    path,
    format: path.endsWith('.json') ? 'json' :
            path.endsWith('.md') ? 'markdown' : 'yaml',
  };
}

export default {
  MissionPack,
  loadMissionPack,
  createDefaultMissionPack,
  hasMissionPack,
  getMissionPackInfo,
};
