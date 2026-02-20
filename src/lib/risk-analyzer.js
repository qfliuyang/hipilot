/**
 * HiPilot Risk Analyzer
 *
 * Analyzes Tcl scripts for risk level and categorization.
 * Categories:
 *   0 - Safe (Green): Read-only, instant operations
 *   1 - Moderate (Yellow): Modifies design but reversible
 *   2 - Dangerous (Orange): Destructive, requires confirmation
 *   3 - Critical (Red): Irreversible, requires explicit typing
 */

// Risk pattern definitions
const RISK_PATTERNS = {
  SAFE: {
    patterns: [
      /^report_/i,
      /^check_/i,
      /^verify_/i,
      /^get_/i,
      /^all_/i,
      /^echo/i,
      /^puts/i,
      /^list_/i,
      /^show_/i,
      /^print/i,
      /^display/i,
      /^summary/i,
    ],
    category: 0,
    color: '🟢',
    label: 'Safe',
    description: 'Read-only operation, no side effects'
  },

  MODERATE: {
    patterns: [
      /^optDesign/i,
      /^opt_design/i,
      /^routeDesign/i,
      /^route_design/i,
      /^route_opt/i,
      /^routeAuto/i,
      /^route_auto/i,
      /^placeDesign/i,
      /^place_design/i,
      /^synthesize/i,
      /^ccopt_design/i,
      /^clock_design/i,
      /^fix_eco_timing/i,
      /^fixEcoTiming/i,
      /^legalize/i,
      /^filler/i,
      /^create_wire/i,
    ],
    category: 1,
    color: '🟡',
    label: 'Moderate',
    description: 'Modifies design but easily reversible'
  },

  DANGEROUS: {
    patterns: [
      /^remove_(?!clock_latency)/i,
      /^delete_(?!all)/i,
      /^clear_/i,
      /^reset_/i,
      /^undo/i,
      /^setdonttouch/i,
      /^set_dont_touch/i,
      /^remove_net/i,
      /^remove_cell/i,
      /^remove_instance/i,
    ],
    category: 2,
    color: '🟠',
    label: 'Dangerous',
    description: 'Destructive operation, may lose work'
  },

  CRITICAL: {
    patterns: [
      /^remove_design.*-all/i,
      /^delete_all/i,
      /^remove.*-all.*-all/i,
      /^exit\b/i,
      /^quit\b/i,
      /^saveDesign/i,
      /^save_design/i,
      /^saveBlock/i,
      /^save_block/i,
      /^write_to_gds/i,
    ],
    category: 3,
    color: '🔴',
    label: 'Critical',
    description: 'Irreversible or overwrites data'
  }
};

// Time estimates by category (in seconds)
const TIME_ESTIMATES = {
  0: 5,      // Safe: almost instant
  1: 300,    // Moderate: 1-10 minutes
  2: 60,     // Dangerous: usually quick but risky
  3: 30      // Critical: varies but the risk is the main concern
};

// Confirmation requirements by category
const CONFIRMATION_REQUIREMENTS = {
  0: { type: 'none', text: null },
  1: { type: 'standard', text: null },
  2: { type: 'single_type', text: 'CONFIRM' },
  3: { type: 'double_type', text: 'I UNDERSTAND THE RISKS AND WANT TO PROCEED' }
};

/**
 * Format time estimate for display
 */
function formatTime(seconds) {
  if (seconds < 10) return 'instant';
  if (seconds < 60) return `~${seconds} seconds`;
  if (seconds < 300) return `~${Math.round(seconds / 60)} minutes`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)} minutes`;
  return `~${Math.round(seconds / 3600)} hours`;
}

/**
 * Detect additional time indicators in Tcl
 */
function detectTimeIndicators(tcl) {
  const lines = tcl.split('\n');
  let additionalTime = 0;

  for (const line of lines) {
    // Long-running loop indicators
    if (/foreach/i.test(line) || /while/i.test(line) || /for\s*\(/i.test(line)) {
      additionalTime += 30;
    }

    // Large batch operations
    if (/-max_paths\s+\d+/.test(line)) {
      const match = line.match(/-max_paths\s+(\d+)/);
      if (match && parseInt(match[1]) > 100) {
        additionalTime += 60;
      }
    }
  }

  return additionalTime;
}

/**
 * Main risk analysis function
 * @param {string} tcl - Tcl script to analyze
 * @returns {Object} Risk analysis result
 */
export function analyzeRisk(tcl) {
  if (!tcl || typeof tcl !== 'string') {
    return {
      category: 0,
      color: '🟢',
      label: 'Safe',
      description: 'Empty or invalid script',
      detected_risks: [],
      dangerous_commands: [],
      critical_commands: [],
      estimated_time_seconds: 0,
      estimated_time_display: 'instant',
      requires_confirmation: false,
      confirmation_type: 'none',
      confirmation_text: null,
      has_warnings: false,
      warnings: []
    };
  }

  const lines = tcl.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const detectedRisks = [];
  let maxCategory = 0;
  const warnings = [];

  // Analyze each line
  for (const line of lines) {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Check against each risk pattern
    for (const [level, config] of Object.entries(RISK_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(line)) {
          detectedRisks.push({
            line: line.substring(0, 80) + (line.length > 80 ? '...' : ''),
            full_line: line,
            category: config.category,
            level: config.label,
            color: config.color,
            description: config.description
          });
          maxCategory = Math.max(maxCategory, config.category);
          break;
        }
      }
    }
  }

  // Get category configuration
  const categoryNames = ['SAFE', 'MODERATE', 'DANGEROUS', 'CRITICAL'];
  const categoryConfig = RISK_PATTERNS[categoryNames[maxCategory]] || RISK_PATTERNS.SAFE;

  // Calculate time estimate
  let baseTime = TIME_ESTIMATES[maxCategory] || 5;
  const additionalTime = detectTimeIndicators(tcl);
  const totalTime = baseTime + additionalTime;

  // Get confirmation requirements
  const confirmReq = CONFIRMATION_REQUIREMENTS[maxCategory];

  // Generate warnings
  if (maxCategory >= 2) {
    warnings.push('This script contains potentially destructive operations');
  }
  if (maxCategory >= 3) {
    warnings.push('This operation may be IRREVERSIBLE');
    warnings.push('Please ensure you have a checkpoint saved');
  }

  // Extract dangerous and critical commands
  const dangerousCommands = detectedRisks
    .filter(r => r.category === 2)
    .map(r => r.line);
  const criticalCommands = detectedRisks
    .filter(r => r.category === 3)
    .map(r => r.line);

  return {
    category: maxCategory,
    color: categoryConfig.color,
    label: categoryConfig.label,
    description: categoryConfig.description,
    detected_risks: detectedRisks,
    dangerous_commands: dangerousCommands,
    critical_commands: criticalCommands,
    estimated_time_seconds: totalTime,
    estimated_time_display: formatTime(totalTime),
    requires_confirmation: maxCategory >= 2,
    confirmation_type: confirmReq.type,
    confirmation_text: confirmReq.text,
    has_warnings: warnings.length > 0,
    warnings: warnings,
    // Summary for quick display
    summary: {
      risk_level: `${categoryConfig.color} ${categoryConfig.label}`,
      time: formatTime(totalTime),
      needs_confirmation: maxCategory >= 2,
      dangerous_count: dangerousCommands.length,
      critical_count: criticalCommands.length
    }
  };
}

/**
 * Generate approval prompt text based on risk level
 * @param {Object} riskAnalysis - Result from analyzeRisk()
 * @param {string} tcl - Original Tcl script
 * @returns {string} Formatted approval prompt
 */
export function generateApprovalPrompt(riskAnalysis, tcl) {
  const { category, color, label, estimated_time_display, dangerous_commands, critical_commands, warnings, confirmation_text } = riskAnalysis;

  let prompt = '';

  // Header based on category
  if (category === 0) {
    prompt += `🔒 **Approval Required** (Manual Mode)\n\n`;
  } else if (category === 1) {
    prompt += `🔒 **Approval Required** (Manual Mode)\n\n`;
  } else if (category === 2) {
    prompt += `⚠️ **DANGEROUS OPERATION DETECTED**\n\n`;
  } else if (category === 3) {
    prompt += `🚨 **CRITICAL OPERATION - IRREVERSIBLE**\n\n`;
  }

  // Risk level
  prompt += `**Risk Level:** ${color} ${label}\n`;
  prompt += `**Estimated Time:** ${estimated_time_display}\n\n`;

  // Warnings
  if (warnings.length > 0) {
    prompt += `**Warnings:**\n`;
    for (const warning of warnings) {
      prompt += `- ⚠️ ${warning}\n`;
    }
    prompt += `\n`;
  }

  // Tcl preview
  prompt += `**Tcl Script:**\n\`\`\`tcl\n${tcl}\n\`\`\`\n\n`;

  // Dangerous commands highlight
  if (dangerous_commands.length > 0) {
    prompt += `**Dangerous Commands Detected:**\n`;
    for (const cmd of dangerous_commands) {
      prompt += `- 🟠 \`${cmd}\`\n`;
    }
    prompt += `\n`;
  }

  // Critical commands highlight
  if (critical_commands.length > 0) {
    prompt += `**Critical Commands Detected:**\n`;
    for (const cmd of critical_commands) {
      prompt += `- 🔴 \`${cmd}\`\n`;
    }
    prompt += `\n`;
  }

  // Divider
  prompt += `---\n\n`;

  // Actions
  if (category >= 2) {
    prompt += `**To execute this ${label.toLowerCase()} operation:**\n`;
    prompt += `- Type **"${confirmation_text}"** to confirm\n`;
    prompt += `- Or say **"cancel"** to abort\n\n`;
  } else {
    prompt += `**Actions:**\n`;
    prompt += `- Say **"yes"** or **"execute"** to run\n`;
    prompt += `- Say **"no"** or **"cancel"** to reject\n`;
    prompt += `- Say **"enable auto mode"** for faster execution this session\n\n`;
  }

  return prompt;
}

/**
 * Check if a confirmation string matches the required confirmation
 * @param {string} userInput - User's confirmation input
 * @param {Object} riskAnalysis - Risk analysis result
 * @returns {Object} { valid: boolean, message: string }
 */
export function validateConfirmation(userInput, riskAnalysis) {
  const { category, confirmation_type, confirmation_text } = riskAnalysis;

  // Normalize input
  const normalizedInput = userInput.trim().toUpperCase();
  const requiredText = (confirmation_text || '').toUpperCase();

  if (category < 2) {
    // Safe or moderate - simple yes/no
    const yesWords = ['YES', 'Y', 'EXECUTE', 'RUN', 'OK', 'SURE', 'DO IT', 'APPROVE', 'CONFIRM'];
    const noWords = ['NO', 'N', 'CANCEL', 'REJECT', 'SKIP', "DON'T", 'ABORT'];

    if (yesWords.some(w => normalizedInput.includes(w))) {
      return { valid: true, message: 'Approved' };
    }
    if (noWords.some(w => normalizedInput.includes(w))) {
      return { valid: false, message: 'Cancelled by user', cancelled: true };
    }
    return { valid: false, message: 'Please say "yes" to approve or "no" to cancel' };
  }

  if (category === 2) {
    // Dangerous - requires typing "CONFIRM"
    if (normalizedInput === 'CONFIRM' || normalizedInput === requiredText) {
      return { valid: true, message: 'Confirmed - dangerous operation approved' };
    }
    return { valid: false, message: `Please type "${confirmation_text}" exactly to confirm this dangerous operation` };
  }

  if (category === 3) {
    // Critical - requires typing full phrase
    if (normalizedInput === requiredText) {
      return { valid: true, message: 'Confirmed - critical operation approved' };
    }
    return {
      valid: false,
      message: `Please type the exact phrase "${confirmation_text}" to confirm this irreversible operation`,
      hint: confirmation_text
    };
  }

  return { valid: false, message: 'Unknown risk category' };
}

export default {
  analyzeRisk,
  generateApprovalPrompt,
  validateConfirmation,
  RISK_PATTERNS,
  TIME_ESTIMATES,
  CONFIRMATION_REQUIREMENTS
};
