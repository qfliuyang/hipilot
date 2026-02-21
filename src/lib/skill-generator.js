/**
 * HiPilot Skill Auto-Generator
 *
 * Generates skills from text sources (emails, wiki posts, runbooks)
 */

import { info, debug } from './logger.js';

/**
 * Parse text for workflow patterns
 */
function parseWorkflow(text) {
  const lines = text.split('\n');
  const steps = [];
  let currentStep = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for step patterns
    const stepMatch = trimmed.match(/^(?:Step|Phase|Stage)\s+(\d+)[\s:.-]+(.+)/i) ||
                      trimmed.match(/^(\d+)\.\s+(.+)/) ||
                      trimmed.match(/^[-*]\s+(.+)/);

    if (stepMatch) {
      if (currentStep) steps.push(currentStep);
      currentStep = {
        number: stepMatch[1] || steps.length + 1,
        title: stepMatch[2] || stepMatch[1],
        commands: [],
        description: '',
      };
    } else if (currentStep && trimmed) {
      // Check for Tcl command
      if (trimmed.startsWith('report_') ||
          trimmed.startsWith('set ') ||
          trimmed.startsWith('get_') ||
          trimmed.startsWith('create_') ||
          trimmed.startsWith('fix_') ||
          trimmed.startsWith('opt') ||
          trimmed.startsWith('route') ||
          trimmed.startsWith('place')) {
        currentStep.commands.push(trimmed);
      } else {
        currentStep.description += trimmed + ' ';
      }
    }
  }

  if (currentStep) steps.push(currentStep);

  return steps;
}

/**
 * Extract parameters from text
 */
function extractParameters(text) {
  const params = [];

  // Look for parameter patterns
  const patterns = [
    /(?:parameter|param|arg|argument)\s*[:=]\s*(\w+)\s*[-:]\s*(.+)/gi,
    /\$\{(\w+)\}/g,
    /-(\w+)\s+(\w+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      params.push({
        name: match[1],
        description: match[2] || 'User-defined parameter',
        type: inferType(match[2]),
      });
    }
  }

  // Remove duplicates
  const seen = new Set();
  return params.filter(p => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });
}

/**
 * Infer parameter type from description
 */
function inferType(description) {
  if (!description) return 'string';
  const d = description.toLowerCase();

  if (d.includes('number') || d.includes('count') || d.includes('paths')) return 'integer';
  if (d.includes('time') || d.includes('slack') || d.includes('period')) return 'float';
  if (d.includes('true') || d.includes('false') || d.includes('enable') || d.includes('disable')) return 'boolean';
  if (d.includes('corner') || d.includes('list')) return 'list';

  return 'string';
}

/**
 * Extract trigger phrases from text
 */
function extractTriggers(text, title) {
  const triggers = [];

  // From title
  if (title) {
    const titleWords = title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    if (titleWords.length >= 2) {
      triggers.push(titleWords.slice(0, 3).join(' '));
    }
  }

  // From text - look for "how to" or "to fix" patterns
  const howToMatch = text.match(/how\s+to\s+(.+?)(?:\.|\n|$)/i);
  if (howToMatch) {
    triggers.push(howToMatch[1].trim().toLowerCase());
  }

  // Look for verb patterns
  const verbs = ['fix', 'check', 'run', 'generate', 'optimize', 'analyze'];
  for (const verb of verbs) {
    const match = text.match(new RegExp(`${verb}\\s+(\\w+(?:\\s+\\w+){0,3})`, 'i'));
    if (match && !triggers.includes(match[0].toLowerCase())) {
      triggers.push(match[0].toLowerCase());
    }
  }

  return triggers.slice(0, 3); // Max 3 triggers
}

/**
 * Detect vendor from text
 */
function detectVendor(text) {
  const lower = text.toLowerCase();
  const vendors = [];

  if (lower.includes('icc2') || lower.includes('icc') || lower.includes('synopsys') ||
      lower.includes('primetime') || lower.includes('pt_shell')) {
    vendors.push('synopsys');
  }

  if (lower.includes('innovus') || lower.includes('tempus') || lower.includes('cadence') ||
      lower.includes('genus')) {
    vendors.push('cadence');
  }

  return vendors.length > 0 ? vendors : ['synopsys', 'cadence'];
}

/**
 * Detect flow stage from text
 */
function detectFlowStage(text) {
  const lower = text.toLowerCase();

  const stages = [
    { pattern: /synthesis|syn|genus/, stage: 'synthesis' },
    { pattern: /floorplan|floor|init|init_design/, stage: 'floorplan' },
    { pattern: /place|placement/, stage: 'placement' },
    { pattern: /cts|clock|clock_tree/, stage: 'cts' },
    { pattern: /route|routing/, stage: 'routing' },
    { pattern: /signoff|eco|final/, stage: 'signoff' },
  ];

  for (const { pattern, stage } of stages) {
    if (pattern.test(lower)) return stage;
  }

  return 'post_route'; // Default
}

/**
 * Generate skill from parsed content
 */
function generateSkillContent(parsed) {
  const { title, description, steps, parameters, triggers, vendors, flowStage, source } = parsed;

  const safeName = title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30);

  // Build YAML frontmatter
  let skill = `---
name: ${safeName}
description: >
  ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}

hipilot:
  vendor: [${vendors.join(', ')}]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: false
  auto_generated: true
  flexible: true
  flow_stages: [${flowStage}]
  source_doc: "${source || 'Auto-generated from team documentation'}"
---

## Triggers

${triggers.map(t => `- "${t}"`).join('\n')}

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
${parameters.map(p => `| ${p.name} | ${p.type} | | ${p.description} |`).join('\n')}
${parameters.length === 0 ? '| (none) | | | No parameters identified |' : ''}

## Workflow

${steps.map((step, i) => `
### Step ${i + 1} - ${step.title}

${step.description.trim()}

${step.commands.length > 0 ? '**Commands:**\n```tcl\n' + step.commands.join('\n') + '\n```' : ''}
`).join('\n')}

## What Can Go Wrong

- **Missing design data**: Ensure the design is loaded before running
- **Tool version differences**: Commands may vary between tool versions
- **Incomplete parameter extraction**: Review auto-extracted parameters

## Notes

*This skill was auto-generated. Please review and refine before use.*
`;

  return skill;
}

/**
 * Main skill generation function
 */
export function generateSkill(sourceText, sourceName = 'unknown') {
  try {
    // Extract title from first line or source name
    const firstLine = sourceText.split('\n')[0].trim();
    const title = firstLine.replace(/^#+\s*/, '').substring(0, 50) || sourceName;

    // Parse description (first paragraph)
    const paragraphs = sourceText.split('\n\n');
    const description = paragraphs[0].replace(/^#+\s*/, '').substring(0, 200);

    // Parse workflow
    const steps = parseWorkflow(sourceText);

    // Extract parameters
    const parameters = extractParameters(sourceText);

    // Extract triggers
    const triggers = extractTriggers(sourceText, title);

    // Detect vendor
    const vendors = detectVendor(sourceText);

    // Detect flow stage
    const flowStage = detectFlowStage(sourceText);

    const parsed = {
      title,
      description,
      steps,
      parameters,
      triggers,
      vendors,
      flowStage,
      source: sourceName,
    };

    const skill = generateSkillContent(parsed);

    info('Skill generated', { title, triggers, vendors });

    return {
      success: true,
      skill,
      metadata: {
        title,
        triggers,
        vendors,
        flowStage,
        stepCount: steps.length,
        parameterCount: parameters.length,
      },
    };
  } catch (err) {
    debug('Skill generation failed', { error: err.message });
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Preview skill without saving
 */
export function previewSkill(sourceText, sourceName) {
  return generateSkill(sourceText, sourceName);
}

/**
 * Parse and validate skill file
 */
export function validateSkill(skillContent) {
  const issues = [];

  // Check for required YAML frontmatter
  if (!skillContent.match(/^---\s*$/m)) {
    issues.push('Missing YAML frontmatter');
  }

  // Check for name
  if (!skillContent.match(/^name:\s*\S+/m)) {
    issues.push('Missing required field: name');
  }

  // Check for description
  if (!skillContent.match(/^description:/m)) {
    issues.push('Missing required field: description');
  }

  // Check for hipilot section
  if (!skillContent.match(/^hipilot:/m)) {
    issues.push('Missing hipilot configuration section');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export default {
  generateSkill,
  previewSkill,
  validateSkill,
  parseWorkflow,
  extractParameters,
  extractTriggers,
  detectVendor,
  detectFlowStage,
};
