/**
 * Mission Pack Parser - Extracts structured data from natural language Markdown
 *
 * The mission pack is a human-written Markdown document. This parser extracts
 * structured information like file paths, targets, and flow requirements from
 * the natural language text.
 */

import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Parse a Markdown mission pack into structured data
 * @param {string} content - Markdown content
 * @param {string} designDir - Design directory for resolving paths
 * @returns {Object} Structured mission pack data
 */
export function parseMarkdownMissionPack(content, designDir) {
  const data = {
    project: {},
    design: {
      rtl: {},
      constraints: {},
      libraries: {},
    },
    flow: {},
    technology: {},
    tools: {},
    custom: {},
  };

  // Extract project name from title
  const titleMatch = content.match(/#\s*Mission Pack:\s*(.+)/i) ||
                     content.match(/#\s*(.+)/);
  if (titleMatch) {
    data.project.name = titleMatch[1].trim();
    data.project.description = `Mission pack for ${data.project.name}`;
  }

  // Extract sections
  const sections = extractSections(content);

  // Parse Project Overview
  if (sections['project overview']) {
    const overview = sections['project overview'];

    // Extract design name from bold text
    const boldMatch = overview.match(/\*\*(.+?)\*\*/);
    if (boldMatch && !data.project.name) {
      data.project.name = boldMatch[1].replace(/\s+/g, '_').toLowerCase();
    }

    // Extract PDK
    const pdkMatch = overview.match(/\*\*(.+?\d+n?m.*?)\*\*/i) ||
                     overview.match(/PDK:\s*(\S+)/i) ||
                     overview.match(/(skywater|tsmc|gf|smic).*?(\d+n?m)/i);
    if (pdkMatch) {
      data.technology.foundry = extractFoundry(overview);
      data.technology.node = extractNode(overview);
      data.technology.process = extractProcess(overview);
    }

    // Extract target frequency
    const freqMatch = overview.match(/(\d+(?:\.\d+)?)\s*(MHz|GHz)/i) ||
                      overview.match(/target frequency.*? (\d+)/i);
    if (freqMatch) {
      const freq = parseFloat(freqMatch[1]);
      const unit = freqMatch[2]?.toLowerCase() || 'mhz';
      data.flow.targets = data.flow.targets || {};
      data.flow.targets.timing = {
        freq: unit === 'ghz' ? freq * 1000 : freq,
      };
    }

    // Extract cell count
    const cellMatch = overview.match(/(\d[\d,]*)\s*cells?/i) ||
                      overview.match(/(\d[\d,]*)\s*gates?/i);
    if (cellMatch) {
      data.project.cell_count = parseInt(cellMatch[1].replace(/,/g, ''), 10);
    }
  }

  // Parse Design Files
  if (sections['design files'] || sections['rtl source']) {
    const designSection = sections['design files'] || sections['rtl source'];

    // Extract top module
    const topMatch = designSection.match(/top module[:\s]+`?(\w+)`?/i) ||
                     designSection.match(/top[:\s]+`?(\w+)`?/i);
    if (topMatch) {
      data.design.rtl.top_module = topMatch[1];
    }

    // Extract RTL language
    if (designSection.match(/systemverilog|sv/i)) {
      data.design.rtl.language = 'systemverilog';
    } else if (designSection.match(/verilog|\.v/i)) {
      data.design.rtl.language = 'verilog';
    }

    // Extract RTL file paths
    const rtlFiles = extractFilePaths(designSection, /`?(rtl\/[\w\/._-]+)`?/gi);
    if (rtlFiles.length > 0) {
      data.design.rtl.files = rtlFiles;
    }

    // If no files found but rtl/ mentioned, auto-detect
    if (data.design.rtl.files?.length === 0 && designSection.includes('rtl/')) {
      data.design.rtl.auto_detect = true;
    }

    // Extract defines
    const defineMatch = designSection.match(/`?(\w+)`?\s*define/i);
    if (defineMatch) {
      data.design.rtl.defines = [defineMatch[1]];
    }
  }

  // Parse Constraints
  if (sections['constraints']) {
    const constraintFiles = extractFilePaths(sections['constraints'], /`?([\w\/._-]+\.sdc)`?/gi);
    if (constraintFiles.length > 0) {
      data.design.constraints.sdc = constraintFiles;
    }
  }

  // Parse Libraries
  if (sections['libraries']) {
    const libSection = sections['libraries'];

    // Extract LEF files
    const lefFiles = extractFilePaths(libSection, /`?([\w\/._-]+\.tlef)`?/gi)
      .concat(extractFilePaths(libSection, /`?([\w\/._-]+\.lef)`?/gi));
    if (lefFiles.length > 0) {
      data.design.libraries.lef = lefFiles;
    }

    // Extract Liberty files
    const libFiles = extractFilePaths(libSection, /`?([\w\/._-]+\.lib)`?/gi);
    if (libFiles.length > 0) {
      data.design.libraries.target = libFiles;
    }

    // Extract GDS files
    const gdsFiles = extractFilePaths(libSection, /`?([\w\/._-]+\.gds)`?/gi);
    if (gdsFiles.length > 0) {
      data.design.libraries.gds = gdsFiles;
    }
  }

  // Parse Flow Requirements
  if (sections['flow requirements']) {
    const flowSection = sections['flow requirements'];

    // Extract stages from numbered list or text
    const stages = extractStages(flowSection);
    if (stages.length > 0) {
      data.flow.stages = stages;
    }

    // Extract DFT setting
    if (flowSection.match(/dft|scan|test/i)) {
      data.flow.recipes = data.flow.recipes || {};
      data.flow.recipes.synthesis = { enable_dft: true };
    }

    // Extract utilization
    const utilMatch = flowSection.match(/(\d+)%?\s*utilization/i) ||
                      flowSection.match(/utilization.*? (\d+)%?/i);
    if (utilMatch) {
      data.design.floorplan = data.design.floorplan || {};
      data.design.floorplan.core_utilization = parseInt(utilMatch[1], 10) / 100;
    }
  }

  // Parse Target QoR
  if (sections['target qor'] || sections['targets']) {
    const targetsSection = sections['target qor'] || sections['targets'];

    // Extract frequency
    const freqMatch = targetsSection.match(/(\d+(?:\.\d+)?)\s*(MHz|GHz)/i);
    if (freqMatch) {
      const freq = parseFloat(freqMatch[1]);
      const unit = freqMatch[2]?.toLowerCase() || 'mhz';
      data.flow.targets = data.flow.targets || {};
      data.flow.targets.timing = data.flow.targets.timing || {};
      data.flow.targets.timing.freq = unit === 'ghz' ? freq * 1000 : freq;
    }

    // Extract WNS target
    const wnsMatch = targetsSection.match(/WNS.*? (\d+(?:\.\d+)?)/i) ||
                     targetsSection.match(/slack.*? (\d+(?:\.\d+)?)/i);
    if (wnsMatch) {
      data.flow.targets.timing.wns = parseFloat(wnsMatch[1]);
    }

    // Extract area
    const areaMatch = targetsSection.match(/(\d+)\s*x\s*(\d+)/i) ||
                      targetsSection.match(/area.*? (\d+)/i);
    if (areaMatch) {
      data.design.floorplan = data.design.floorplan || {};
      if (areaMatch[2]) {
        data.design.floorplan.die_area = [
          parseInt(areaMatch[1], 10),
          parseInt(areaMatch[2], 10),
        ];
      }
    }
  }

  // Parse Technology Setup
  if (sections['technology setup']) {
    const techSection = sections['technology setup'];

    data.technology.foundry = data.technology.foundry || extractFoundry(techSection);
    data.technology.node = data.technology.node || extractNode(techSection);
    data.technology.process = data.technology.process || extractProcess(techSection);

    // Extract voltage
    const voltMatch = techSection.match(/(\d+(?:\.\d+)?)\s*V/i);
    if (voltMatch) {
      data.technology.power = data.technology.power || {};
      data.technology.power.vdd = { voltage: parseFloat(voltMatch[1]) };
    }
  }

  // Parse Special Instructions
  if (sections['special instructions'] || sections['tool versions']) {
    const specialSection = sections['special instructions'] || sections['tool versions'];

    // Extract Innovus version
    const innovusMatch = specialSection.match(/Innovus.*? v?(\d+\.\d+)/i);
    if (innovusMatch) {
      data.tools.innovus = { version: innovusMatch[1] };
    }

    // Extract DC version
    const dcMatch = specialSection.match(/Design Compiler.*? v?(\S+)/i) ||
                    specialSection.match(/DC Shell.*? v?(\S+)/i);
    if (dcMatch) {
      data.tools.design_compiler = { version: dcMatch[1] };
    }
  }

  // Auto-detect if needed
  if (shouldAutoDetect(data)) {
    autoDetectMissingData(data, designDir);
  }

  return data;
}

/**
 * Extract sections from Markdown content
 */
function extractSections(content) {
  const sections = {};
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Check for section header (## or ###)
    const sectionMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (sectionMatch) {
      // Save previous section
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
      }
      // Start new section
      currentSection = sectionMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Extract file paths from text using regex
 */
function extractFilePaths(text, regex) {
  const paths = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    paths.push(match[1]);
  }
  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Extract flow stages from text
 */
function extractStages(text) {
  const stages = [];
  const stageMap = {
    'synthesis': 'synthesis',
    'design.init': 'design_init',
    'floorplan': 'floorplan',
    'power.plan': 'powerplan',
    'powerplan': 'powerplan',
    'placement': 'placement',
    'cts': 'cts',
    'clock.tree': 'cts',
    'post.cts': 'post_cts_opt',
    'routing': 'routing',
    'route.opt': 'route_opt',
    'chip.finish': 'chip_finish',
    'finish': 'chip_finish',
  };

  // Check for numbered list of stages
  const stageMatches = text.matchAll(/(?:^|\n)\s*(?:\d+[.):-]|[-*])\s*(.+?)(?=\n|$)/gi);
  for (const match of stageMatches) {
    const line = match[1].toLowerCase();
    for (const [key, value] of Object.entries(stageMap)) {
      if (line.includes(key.replace('.', ' ')) || line.includes(key.replace('.', ''))) {
        if (!stages.includes(value)) {
          stages.push(value);
        }
      }
    }
  }

  // If no stages found, look for explicit mentions
  if (stages.length === 0) {
    for (const [key, value] of Object.entries(stageMap)) {
      if (text.toLowerCase().includes(key.replace('.', ' ')) ||
          text.toLowerCase().includes(key.replace('.', ''))) {
        if (!stages.includes(value)) {
          stages.push(value);
        }
      }
    }
  }

  // Default stages if still empty
  if (stages.length === 0) {
    stages.push(
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
    );
  }

  return stages;
}

/**
 * Extract foundry name from text
 */
function extractFoundry(text) {
  if (text.match(/skywater|sky130/i)) return 'skywater';
  if (text.match(/tsmc/i)) return 'tsmc';
  if (text.match(/globalfoundries|gf/i)) return 'globalfoundries';
  if (text.match(/smic/i)) return 'smic';
  return 'unknown';
}

/**
 * Extract process node from text
 */
function extractNode(text) {
  const match = text.match(/(\d+)n?m/i);
  return match ? `${match[1]}nm` : 'unknown';
}

/**
 * Extract process name from text
 */
function extractProcess(text) {
  if (text.match(/sky130/i)) return 'sky130';
  if (text.match(/tsmc\s*65/i)) return 'tsmc65';
  if (text.match(/tsmc\s*28/i)) return 'tsmc28';
  if (text.match(/gf\s*22/i)) return 'gf22';
  const nodeMatch = text.match(/(\d+)n?m/i);
  return nodeMatch ? `process${nodeMatch[1]}` : 'unknown';
}

/**
 * Check if auto-detection is needed
 */
function shouldAutoDetect(data) {
  return !data.design.rtl.files?.length ||
         !data.design.libraries.target?.length ||
         !data.project.name;
}

/**
 * Auto-detect missing data from design directory
 */
function autoDetectMissingData(data, designDir) {
  if (!existsSync(designDir)) return;

  // Auto-detect RTL files
  if (!data.design.rtl.files?.length) {
    const rtlFiles = [];
    const rtlDir = join(designDir, 'rtl');
    if (existsSync(rtlDir)) {
      try {
        const files = readdirSync(rtlDir);
        for (const file of files) {
          if (file.match(/\.(v|sv|vhd|vhdl)$/i)) {
            rtlFiles.push(`rtl/${file}`);
          }
        }
      } catch { /* ignore */ }
    }
    if (rtlFiles.length > 0) {
      data.design.rtl.files = rtlFiles;
    }
  }

  // Auto-detect top module from file names
  if (!data.design.rtl.top_module && data.design.rtl.files?.length > 0) {
    // Look for common top module names
    for (const file of data.design.rtl.files) {
      const base = file.split('/').pop().replace(/\.(v|sv)$/i, '');
      if (base.match(/_top$|^top_/i) || base.match(/_core$|^core_/i)) {
        data.design.rtl.top_module = base;
        break;
      }
    }
    // Use first file as fallback
    if (!data.design.rtl.top_module) {
      const firstFile = data.design.rtl.files[0];
      data.design.rtl.top_module = firstFile.split('/').pop().replace(/\.(v|sv)$/i, '');
    }
  }

  // Auto-detect libraries
  if (!data.design.libraries.target?.length) {
    const libDir = join(designDir, 'lib');
    if (existsSync(libDir)) {
      try {
        const files = readdirSync(libDir);
        const libFiles = files
          .filter(f => f.endsWith('.lib'))
          .map(f => `lib/${f}`);
        if (libFiles.length > 0) {
          data.design.libraries.target = libFiles;
        }
      } catch { /* ignore */ }
    }
  }

  // Auto-detect LEF files
  if (!data.design.libraries.lef?.length) {
    const lefDir = join(designDir, 'lef');
    if (existsSync(lefDir)) {
      try {
        const files = readdirSync(lefDir);
        const lefFiles = files
          .filter(f => f.endsWith('.lef') || f.endsWith('.tlef'))
          .sort((a, b) => {
            // Tech LEF first
            if (a.includes('tech') && !b.includes('tech')) return -1;
            if (!a.includes('tech') && b.includes('tech')) return 1;
            return 0;
          })
          .map(f => `lef/${f}`);
        if (lefFiles.length > 0) {
          data.design.libraries.lef = lefFiles;
        }
      } catch { /* ignore */ }
    }
  }

  // Auto-detect constraints
  if (!data.design.constraints.sdc?.length) {
    const constraintDir = join(designDir, 'constraints');
    if (existsSync(constraintDir)) {
      try {
        const files = readdirSync(constraintDir);
        const sdcFiles = files
          .filter(f => f.endsWith('.sdc'))
          .map(f => `constraints/${f}`);
        if (sdcFiles.length > 0) {
          data.design.constraints.sdc = sdcFiles;
        }
      } catch { /* ignore */ }
    }
  }

  // Set default project name
  if (!data.project.name) {
    data.project.name = designDir.split('/').pop() || 'unnamed';
    data.project.description = `Auto-detected mission pack for ${data.project.name}`;
  }

  // Set default stages
  if (!data.flow.stages?.length) {
    data.flow.stages = [
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
    ];
  }
}

export default {
  parseMarkdownMissionPack,
};
