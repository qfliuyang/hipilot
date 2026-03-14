/**
 * Mission Pack Validator
 *
 * Validates mission pack configuration against the schema.
 * Ensures required fields are present and values are valid.
 */

// Required sections
const REQUIRED_SECTIONS = ['project'];

// Valid flow stages
const VALID_STAGES = [
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
  'sta',
  'drc',
  'lvs',
  'verification',
];

// Valid tools
const VALID_TOOLS = ['innovus', 'design_compiler', 'dc_shell', 'prime_time', 'pt_shell', 'icc2'];

// Valid recipe strategies
const VALID_SYNTHESIS_STRATEGIES = ['area', 'timing', 'power', 'balanced'];
const VALID_PLACEMENT_OPTIMIZATIONS = ['timing', 'congestion', 'power', 'area'];
const VALID_EFFORT_LEVELS = ['low', 'medium', 'high'];

/**
 * Validate a mission pack configuration
 */
export function validateMissionPack(data) {
  const errors = [];
  const warnings = [];

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!data[section]) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  // Validate project section
  if (data.project) {
    validateProject(data.project, errors, warnings);
  }

  // Validate design section
  if (data.design) {
    validateDesign(data.design, errors, warnings);
  }

  // Validate flow section
  if (data.flow) {
    validateFlow(data.flow, errors, warnings);
  }

  // Validate technology section
  if (data.technology) {
    validateTechnology(data.technology, errors, warnings);
  }

  // Validate tools section
  if (data.tools) {
    validateTools(data.tools, errors, warnings);
  }

  // Validate custom section
  if (data.custom) {
    validateCustom(data.custom, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate project section
 */
function validateProject(project, errors, warnings) {
  if (!project.name) {
    errors.push('project.name is required');
  } else if (typeof project.name !== 'string') {
    errors.push('project.name must be a string');
  }

  if (project.description && typeof project.description !== 'string') {
    warnings.push('project.description should be a string');
  }

  if (project.version && typeof project.version !== 'string') {
    warnings.push('project.version should be a string (e.g., "1.0.0")');
  }
}

/**
 * Validate design section
 */
function validateDesign(design, errors, warnings) {
  // RTL validation
  if (design.rtl) {
    validateRtl(design.rtl, errors, warnings);
  } else if (!design.libraries?.auto_detect) {
    warnings.push('design.rtl not specified - may use auto-detection');
  }

  // Constraints validation
  if (design.constraints) {
    validateConstraints(design.constraints, errors, warnings);
  }

  // Libraries validation
  if (design.libraries) {
    validateLibraries(design.libraries, errors, warnings);
  } else {
    errors.push('design.libraries is required (target libraries)');
  }

  // Floorplan validation (optional)
  if (design.floorplan) {
    validateFloorplan(design.floorplan, errors, warnings);
  }
}

/**
 * Validate RTL section
 */
function validateRtl(rtl, errors, warnings) {
  if (rtl.auto_detect) {
    // Auto-detection enabled, skip further validation
    return;
  }

  if (!rtl.top_module) {
    warnings.push('design.rtl.top_module not specified');
  }

  if (!rtl.files || !Array.isArray(rtl.files) || rtl.files.length === 0) {
    if (!rtl.auto_detect) {
      errors.push('design.rtl.files must be a non-empty array (or set auto_detect: true)');
    }
  } else {
    // Validate file paths
    for (const file of rtl.files) {
      if (typeof file !== 'string') {
        errors.push(`Invalid RTL file path: ${file}`);
      }
    }
  }

  if (rtl.include_dirs && !Array.isArray(rtl.include_dirs)) {
    errors.push('design.rtl.include_dirs must be an array');
  }

  if (rtl.defines && !Array.isArray(rtl.defines)) {
    errors.push('design.rtl.defines must be an array');
  }

  // Validate language
  if (rtl.language) {
    const validLanguages = ['verilog', 'systemverilog', 'vhdl', 'sv'];
    if (!validLanguages.includes(rtl.language.toLowerCase())) {
      warnings.push(`Unrecognized RTL language: ${rtl.language}`);
    }
  }
}

/**
 * Validate constraints section
 */
function validateConstraints(constraints, errors, warnings) {
  if (constraints.sdc) {
    if (!Array.isArray(constraints.sdc)) {
      errors.push('design.constraints.sdc must be an array');
    }
  }

  if (constraints.upf) {
    if (!Array.isArray(constraints.upf)) {
      errors.push('design.constraints.upf must be an array');
    }
  }
}

/**
 * Validate libraries section
 */
function validateLibraries(libraries, errors, warnings) {
  if (libraries.auto_detect) {
    // Auto-detection enabled
    return;
  }

  // Check for target libraries
  const hasTargets = libraries.target || libraries.liberty;
  if (!hasTargets) {
    errors.push('design.libraries.target (or .liberty) is required for synthesis');
  }

  // Check for LEF files (physical design)
  const hasLef = libraries.lef && Array.isArray(libraries.lef) && libraries.lef.length > 0;
  if (!hasLef) {
    warnings.push('design.libraries.lef not specified - physical design stages may fail');
  }

  // Warn if LEF order might be wrong (tech LEF should be first)
  if (hasLef) {
    const firstLef = libraries.lef[0];
    if (firstLef && !firstLef.toLowerCase().includes('tech') && !firstLef.toLowerCase().includes('.tlef')) {
      warnings.push('First LEF file should be the Tech LEF (.tlef or containing "tech" in name)');
    }
  }
}

/**
 * Validate floorplan section
 */
function validateFloorplan(floorplan, errors, warnings) {
  if (floorplan.die_area) {
    if (!Array.isArray(floorplan.die_area) || floorplan.die_area.length !== 2) {
      errors.push('design.floorplan.die_area must be [width, height] array');
    }
  }

  if (floorplan.core_utilization !== undefined) {
    if (typeof floorplan.core_utilization !== 'number' ||
        floorplan.core_utilization < 0 ||
        floorplan.core_utilization > 1) {
      errors.push('design.floorplan.core_utilization must be a number between 0 and 1');
    }
  }

  if (floorplan.aspect_ratio !== undefined) {
    if (typeof floorplan.aspect_ratio !== 'number' || floorplan.aspect_ratio <= 0) {
      errors.push('design.floorplan.aspect_ratio must be a positive number');
    }
  }

  if (floorplan.core_margin) {
    if (!Array.isArray(floorplan.core_margin) || floorplan.core_margin.length !== 4) {
      errors.push('design.floorplan.core_margin must be [left, bottom, right, top] array');
    }
  }
}

/**
 * Validate flow section
 */
function validateFlow(flow, errors, warnings) {
  // Validate stages
  if (flow.stages) {
    if (!Array.isArray(flow.stages)) {
      errors.push('flow.stages must be an array');
    } else {
      for (const stage of flow.stages) {
        if (!VALID_STAGES.includes(stage)) {
          warnings.push(`Unknown flow stage: ${stage}. Valid stages: ${VALID_STAGES.join(', ')}`);
        }
      }
    }
  }

  // Validate skip_stages
  if (flow.skip_stages) {
    if (!Array.isArray(flow.skip_stages)) {
      errors.push('flow.skip_stages must be an array');
    }
  }

  // Validate targets
  if (flow.targets) {
    validateTargets(flow.targets, errors, warnings);
  }

  // Validate recipes
  if (flow.recipes) {
    validateRecipes(flow.recipes, errors, warnings);
  }
}

/**
 * Validate targets section
 */
function validateTargets(targets, errors, warnings) {
  if (targets.timing) {
    const timing = targets.timing;
    if (timing.wns !== undefined && typeof timing.wns !== 'number') {
      errors.push('flow.targets.timing.wns must be a number');
    }
    if (timing.tns !== undefined && typeof timing.tns !== 'number') {
      errors.push('flow.targets.timing.tns must be a number');
    }
    if (timing.freq !== undefined && typeof timing.freq !== 'number') {
      errors.push('flow.targets.timing.freq must be a number (MHz)');
    }
  }

  if (targets.area) {
    const area = targets.area;
    if (area.max_utilization !== undefined &&
        (typeof area.max_utilization !== 'number' ||
         area.max_utilization < 0 ||
         area.max_utilization > 1)) {
      errors.push('flow.targets.area.max_utilization must be a number between 0 and 1');
    }
  }

  if (targets.power) {
    const power = targets.power;
    if (power.max_leakage !== undefined && typeof power.max_leakage !== 'number') {
      errors.push('flow.targets.power.max_leakage must be a number');
    }
    if (power.max_dynamic !== undefined && typeof power.max_dynamic !== 'number') {
      errors.push('flow.targets.power.max_dynamic must be a number');
    }
  }
}

/**
 * Validate recipes section
 */
function validateRecipes(recipes, errors, warnings) {
  // Synthesis recipe
  if (recipes.synthesis) {
    const synth = recipes.synthesis;
    if (synth.effort && !VALID_EFFORT_LEVELS.includes(synth.effort)) {
      errors.push(`Invalid synthesis effort: ${synth.effort}. Valid: ${VALID_EFFORT_LEVELS.join(', ')}`);
    }
    if (synth.strategy && !VALID_SYNTHESIS_STRATEGIES.includes(synth.strategy)) {
      warnings.push(`Unrecognized synthesis strategy: ${synth.strategy}`);
    }
  }

  // Placement recipe
  if (recipes.placement) {
    const place = recipes.placement;
    if (place.effort && !VALID_EFFORT_LEVELS.includes(place.effort)) {
      errors.push(`Invalid placement effort: ${place.effort}`);
    }
    if (place.optimization && !VALID_PLACEMENT_OPTIMIZATIONS.includes(place.optimization)) {
      warnings.push(`Unrecognized placement optimization: ${place.optimization}`);
    }
  }

  // CTS recipe
  if (recipes.cts) {
    const cts = recipes.cts;
    if (cts.target_skew !== undefined && typeof cts.target_skew !== 'number') {
      errors.push('flow.recipes.cts.target_skew must be a number (ps)');
    }
    if (cts.target_latency !== undefined && typeof cts.target_latency !== 'number') {
      errors.push('flow.recipes.cts.target_latency must be a number (ps)');
    }
  }
}

/**
 * Validate technology section
 */
function validateTechnology(tech, errors, warnings) {
  if (tech.node) {
    if (typeof tech.node !== 'string') {
      errors.push('technology.node must be a string (e.g., "130nm")');
    }
  }

  if (tech.metal_layers) {
    const layers = tech.metal_layers;
    if (layers.count && typeof layers.count !== 'number') {
      errors.push('technology.metal_layers.count must be a number');
    }
  }

  if (tech.power) {
    validatePowerDomains(tech.power, errors, warnings);
  }

  if (tech.corners) {
    validateCorners(tech.corners, errors, warnings);
  }
}

/**
 * Validate power domains
 */
function validatePowerDomains(power, errors, warnings) {
  if (!power.vdd) {
    warnings.push('technology.power.vdd not specified');
  } else {
    if (!power.vdd.net) {
      errors.push('technology.power.vdd.net is required');
    }
    if (power.vdd.voltage !== undefined && typeof power.vdd.voltage !== 'number') {
      errors.push('technology.power.vdd.voltage must be a number');
    }
  }

  if (!power.vss) {
    warnings.push('technology.power.vss not specified');
  } else if (!power.vss.net) {
    errors.push('technology.power.vss.net is required');
  }
}

/**
 * Validate corners
 */
function validateCorners(corners, errors, warnings) {
  for (const [name, corner] of Object.entries(corners)) {
    if (!corner.lib && !corner.library) {
      errors.push(`technology.corners.${name} missing library file (.lib)`);
    }

    if (corner.temperature !== undefined && typeof corner.temperature !== 'number') {
      errors.push(`technology.corners.${name}.temperature must be a number`);
    }

    if (corner.voltage !== undefined && typeof corner.voltage !== 'number') {
      errors.push(`technology.corners.${name}.voltage must be a number`);
    }
  }
}

/**
 * Validate tools section
 */
function validateTools(tools, errors, warnings) {
  for (const [toolName, config] of Object.entries(tools)) {
    if (!VALID_TOOLS.includes(toolName)) {
      warnings.push(`Unknown tool: ${toolName}`);
    }

    if (config.version && typeof config.version !== 'string') {
      warnings.push(`tools.${toolName}.version should be a string`);
    }

    if (config.stage_tcl) {
      if (typeof config.stage_tcl !== 'object') {
        errors.push(`tools.${toolName}.stage_tcl must be an object mapping stages to Tcl`);
      }
    }
  }
}

/**
 * Validate custom section
 */
function validateCustom(custom, errors, warnings) {
  if (custom.pre_hooks) {
    if (typeof custom.pre_hooks !== 'object') {
      errors.push('custom.pre_hooks must be an object mapping stages to Tcl');
    }
  }

  if (custom.post_hooks) {
    if (typeof custom.post_hooks !== 'object') {
      errors.push('custom.post_hooks must be an object mapping stages to Tcl');
    }
  }

  if (custom.tcl_libraries) {
    if (!Array.isArray(custom.tcl_libraries)) {
      errors.push('custom.tcl_libraries must be an array of file paths');
    }
  }

  if (custom.environment) {
    if (typeof custom.environment !== 'object') {
      errors.push('custom.environment must be an object of key-value pairs');
    }
  }
}

export {
  VALID_STAGES,
  VALID_TOOLS,
  VALID_EFFORT_LEVELS,
  VALID_SYNTHESIS_STRATEGIES,
  VALID_PLACEMENT_OPTIMIZATIONS,
};

export default {
  validateMissionPack,
  VALID_STAGES,
  VALID_TOOLS,
  VALID_EFFORT_LEVELS,
  VALID_SYNTHESIS_STRATEGIES,
  VALID_PLACEMENT_OPTIMIZATIONS,
};
