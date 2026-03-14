/**
 * Mission Pack Auto-Detection
 *
 * Automatically detects design structure and generates a mission pack
 * for projects that don't have one. This enables legacy projects to
 * work with HiPilot without manual configuration.
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';

// File extensions to scan
const RTL_EXTENSIONS = ['.v', '.sv', '.vhd', '.vhdl', '.verilog'];
const LIB_EXTENSIONS = ['.lib', '.db'];
const LEF_EXTENSIONS = ['.lef', '.tlef'];
const GDS_EXTENSIONS = ['.gds', '.gds2', '.gdsii'];
const SDC_EXTENSIONS = ['.sdc'];

/**
 * Auto-detect design structure and generate mission pack
 */
export function autoDetectMissionPack(designDir) {
  const detection = {
    designDir,
    rtl: detectRtl(designDir),
    libraries: detectLibraries(designDir),
    constraints: detectConstraints(designDir),
    topModule: null,
  };

  // Try to detect top module from various sources
  detection.topModule = detectTopModule(detection);

  // Generate mission pack data
  return generateMissionPack(detection);
}

/**
 * Detect RTL files in the design directory
 */
function detectRtl(designDir) {
  const rtlDirs = ['rtl', 'src', 'verilog', 'hdl', 'design', '.'];
  const files = [];
  const includeDirs = [];

  for (const dir of rtlDirs) {
    const fullPath = join(designDir, dir);
    if (!existsSync(fullPath)) continue;

    const stat = statSync(fullPath);
    if (!stat.isDirectory()) continue;

    if (dir !== '.') {
      includeDirs.push(dir);
    }

    try {
      const entries = readdirSync(fullPath);
      for (const entry of entries) {
        const ext = extname(entry).toLowerCase();
        if (RTL_EXTENSIONS.includes(ext)) {
          files.push(join(dir, entry));
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }

  return { files, includeDirs };
}

/**
 * Detect library files (LIB, LEF, GDS)
 */
function detectLibraries(designDir) {
  const libDirs = ['lib', 'libs', 'library', 'libraries', 'lef', 'gds', 'tech', 'pdk', '.'];

  const target = [];
  const lef = [];
  const gds = [];
  let pdkRoot = null;

  for (const dir of libDirs) {
    const fullPath = join(designDir, dir);
    if (!existsSync(fullPath)) continue;

    const stat = statSync(fullPath);
    if (!stat.isDirectory()) continue;

    try {
      const entries = readdirSync(fullPath, { recursive: true });

      for (const entry of entries) {
        const ext = extname(entry).toLowerCase();
        const relativePath = join(dir, entry);

        if (ext === '.lib' || ext === '.db') {
          // Prioritize typical/foundry corners
          const name = entry.toLowerCase();
          if (name.includes('ff') || name.includes('ss') || name.includes('tt') ||
              name.includes('typ') || name.includes('fast') || name.includes('slow')) {
            target.unshift(relativePath); // Priority libraries first
          } else {
            target.push(relativePath);
          }
        } else if (ext === '.lef' || ext === '.tlef') {
          // Tech LEF should be first
          const name = entry.toLowerCase();
          if (name.includes('tech') || ext === '.tlef') {
            lef.unshift(relativePath);
          } else {
            lef.push(relativePath);
          }
        } else if (GDS_EXTENSIONS.includes(ext)) {
          gds.push(relativePath);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }

  // Try to detect PDK root
  pdkRoot = detectPdkRoot(designDir, lef, target);

  return { target, lef, gds, pdk_root: pdkRoot };
}

/**
 * Detect PDK root from library paths
 */
function detectPdkRoot(designDir, lefFiles, libFiles) {
  // Check common PDK root indicators
  const pdkIndicators = ['pdk', 'pdks', 'tech', 'technology', 'foundry'];

  // Try to find PDK from LEF paths
  for (const lef of lefFiles) {
    const parts = lef.split('/');
    for (let i = 0; i < parts.length; i++) {
      if (pdkIndicators.some(ind => parts[i].toLowerCase().includes(ind))) {
        return parts.slice(0, i + 1).join('/');
      }
    }
  }

  // Check environment variable
  if (process.env.PDK_ROOT) {
    return process.env.PDK_ROOT;
  }

  if (process.env.PDK) {
    return process.env.PDK;
  }

  return null;
}

/**
 * Detect constraint files (SDC)
 */
function detectConstraints(designDir) {
  const constraintDirs = ['constraints', 'sdc', 'constraint', 'timing', '.'];
  const sdc = [];

  for (const dir of constraintDirs) {
    const fullPath = join(designDir, dir);
    if (!existsSync(fullPath)) continue;

    const stat = statSync(fullPath);
    if (!stat.isDirectory()) continue;

    try {
      const entries = readdirSync(fullPath);
      for (const entry of entries) {
        const ext = extname(entry).toLowerCase();
        if (SDC_EXTENSIONS.includes(ext)) {
          sdc.push(join(dir, entry));
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }

  return { sdc };
}

/**
 * Detect top module name from various sources
 */
function detectTopModule(detection) {
  // 1. Try to find from SDC files (look for current_design)
  for (const sdc of detection.constraints.sdc) {
    try {
      const content = readFileSync(join(detection.designDir, sdc), 'utf-8');
      const match = content.match(/current_design\s+(\w+)/);
      if (match) return match[1];

      // Also look for set_top_module
      const topMatch = content.match(/set_top_module\s+(\w+)/);
      if (topMatch) return topMatch[1];
    } catch (e) {
      // Ignore read errors
    }
  }

  // 2. Try to find from RTL files (look for module declaration)
  for (const rtl of detection.rtl.files) {
    try {
      const content = readFileSync(join(detection.designDir, rtl), 'utf-8');

      // Match module declarations
      const moduleMatches = content.match(/module\s+(\w+)/g);
      if (moduleMatches) {
        // Extract module names
        const modules = moduleMatches.map(m => m.replace(/module\s+/, ''));

        // Look for common top module patterns
        for (const mod of modules) {
          const lowerMod = mod.toLowerCase();
          if (lowerMod.includes('top') ||
              lowerMod.includes('core') ||
              lowerMod.includes('chip') ||
              lowerMod.includes('soc')) {
            return mod;
          }
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  // 3. Try directory name
  const dirName = basename(detection.designDir);
  if (dirName && dirName !== '.' && dirName !== '/') {
    return dirName;
  }

  // 4. Default fallback
  return 'top';
}

/**
 * Detect technology information from libraries
 */
function detectTechnology(libraries) {
  const tech = {
    node: null,
    foundry: null,
    process: null,
  };

  // Try to infer from library names
  const allLibs = [...libraries.target, ...libraries.lef];

  for (const lib of allLibs) {
    const name = lib.toLowerCase();

    // Detect node
    const nodeMatch = name.match(/(130|65|45|28|22|16|14|7|5|3)[nm|hp|lp]/);
    if (nodeMatch) {
      tech.node = `${nodeMatch[1]}nm`;
    }

    // Detect foundry
    if (name.includes('sky')) {
      tech.foundry = 'skywater';
      tech.process = 'sky130';
    } else if (name.includes('tsmc')) {
      tech.foundry = 'tsmc';
    } else if (name.includes('gf') || name.includes('globalfoundries')) {
      tech.foundry = 'globalfoundries';
    } else if (name.includes('samsung')) {
      tech.foundry = 'samsung';
    }
  }

  return tech;
}

/**
 * Generate mission pack from detection results
 */
function generateMissionPack(detection) {
  const designName = basename(detection.designDir);
  const tech = detectTechnology(detection.libraries);

  return {
    project: {
      name: detection.topModule || designName,
      description: `Auto-detected mission pack for ${designName}`,
      version: '1.0.0-auto',
      auto_generated: true,
      generated_at: new Date().toISOString(),
    },

    design: {
      rtl: {
        top_module: detection.topModule || designName,
        language: 'systemverilog',
        files: detection.rtl.files.slice(0, 50), // Limit to first 50 files
        include_dirs: detection.rtl.includeDirs,
      },

      constraints: {
        sdc: detection.constraints.sdc,
      },

      libraries: {
        target: detection.libraries.target.slice(0, 5), // Limit to first 5 libs
        lef: detection.libraries.lef,
        gds: detection.libraries.gds.slice(0, 3), // Limit to first 3 GDS
        pdk_root: detection.libraries.pdk_root,
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
      targets: {
        timing: {
          wns: 0.0,
          tns: 0.0,
        },
      },
    },

    technology: {
      node: tech.node || '130nm',
      foundry: tech.foundry || 'unknown',
      process: tech.process || 'generic',
    },
  };
}

/**
 * Check if auto-detection is likely to succeed
 */
export function canAutoDetect(designDir) {
  const checks = {
    hasRtl: false,
    hasLibs: false,
    hasConstraints: false,
    confidence: 0,
  };

  // Check for RTL
  const rtlDirs = ['rtl', 'src', 'verilog', 'hdl'];
  for (const dir of rtlDirs) {
    const fullPath = join(designDir, dir);
    if (existsSync(fullPath)) {
      checks.hasRtl = true;
      checks.confidence += 30;
      break;
    }
  }

  // Check for libraries
  const libDirs = ['lib', 'libs', 'library', 'lef'];
  for (const dir of libDirs) {
    const fullPath = join(designDir, dir);
    if (existsSync(fullPath)) {
      checks.hasLibs = true;
      checks.confidence += 30;
      break;
    }
  }

  // Check for constraints
  const constraintDirs = ['constraints', 'sdc', 'constraint'];
  for (const dir of constraintDirs) {
    const fullPath = join(designDir, dir);
    if (existsSync(fullPath)) {
      checks.hasConstraints = true;
      checks.confidence += 20;
      break;
    }
  }

  // Bonus for top-level files
  const topFiles = ['Makefile', 'README', 'README.md', 'setup.tcl'];
  for (const file of topFiles) {
    if (existsSync(join(designDir, file))) {
      checks.confidence += 5;
    }
  }

  checks.canDetect = checks.confidence >= 50;
  return checks;
}

export default {
  autoDetectMissionPack,
  canAutoDetect,
};
