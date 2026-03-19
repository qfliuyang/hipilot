/**
 * tools/report-analysis.js - EDA report analysis tools
 *
 * Provides tools for analyzing EDA reports (timing, DRC, power, area) with caching.
 */

import { existsSync, readFileSync } from 'fs';
import {
  analyzeReport,
} from '../../../src/lib/report-analyzer.js';
import {
  getCachedAnalysis,
  setCachedAnalysis,
  getCacheStats,
  clearCache,
  generateActionButtons,
  formatActionButtons,
} from '../../../src/lib/report-cache.js';

/**
 * Tool definitions for report analysis tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.analyze_report',
    description: 'Analyze EDA report (timing, DRC, power, area) using AI. Auto-detects report type or accepts explicit type. Returns structured analysis with LLM prompt for detailed insights. Use this to understand report contents and get actionable recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        report_content: {
          type: 'string',
          description: 'Full text content of the EDA report to analyze',
        },
        report_path: {
          type: 'string',
          description: 'Path to report file (alternative to report_content)',
        },
        report_type: {
          type: 'string',
          description: 'Type of report for targeted analysis (auto-detected if not specified)',
          enum: ['auto', 'timing', 'drc', 'power', 'area'],
          default: 'auto',
        },
      },
      required: [],
    },
  },
  {
    name: 'eda.get_analysis_cache',
    description: 'Get report analysis cache statistics or clear cache. Shows number of cached analyses, cache size, and hit rates. Use action:clear to clear all cached analyses.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform',
          enum: ['stats', 'clear'],
          default: 'stats',
        },
      },
    },
  },
];

/**
 * Handle eda.analyze_report.
 */
export function handleAnalyzeReport(args) {
  const { report_content, report_path, report_type = 'auto', use_cache = true } = args;

  // Get report content from file or argument
  let content = report_content;
  if (report_path && !content) {
    if (!existsSync(report_path)) {
      return {
        content: [{ type: 'text', text: `❌ Report file not found: ${report_path}` }],
        isError: true,
      };
    }
    content = readFileSync(report_path, 'utf-8');
  }

  if (!content || content.trim().length === 0) {
    return {
      content: [{ type: 'text', text: '❌ No report content provided. Use report_content or report_path.' }],
      isError: true,
    };
  }

  // Check cache first
  let analysis;
  let cached = false;
  if (use_cache) {
    const cachedResult = getCachedAnalysis(content, report_type);
    if (cachedResult) {
      analysis = cachedResult;
      cached = true;
    }
  }

  // If not cached, analyze the report
  if (!analysis) {
    analysis = analyzeReport(content, report_type);
    // Store in cache for future use
    if (use_cache) {
      setCachedAnalysis(content, report_type, analysis);
    }
  }

  // Build response
  let text = `📊 **Report Analysis: ${analysis.type.toUpperCase()}**`;
  if (cached) {
    text += ' 🔄 (cached)';
  }
  text += '\n\n';

  // Show extracted metrics if available
  if (analysis.metrics) {
    text += `**Extracted Metrics:**\n`;
    const metrics = analysis.metrics;
    for (const [key, value] of Object.entries(metrics)) {
      if (value !== null && value !== undefined && value !== 0) {
        text += `  • ${key}: ${value}\n`;
      }
    }
    text += `\n`;
  }

  // Show summary
  text += `**Summary:** ${analysis.summary}\n\n`;

  // Generate action buttons
  const actionButtons = generateActionButtons(analysis.type, true);
  text += formatActionButtons(actionButtons);

  text += `\n\n---\n\n`;
  text += analysis.prompt;

  return {
    content: [{ type: 'text', text }],
    _metadata: {
      report_type: analysis.type,
      metrics: analysis.metrics,
      summary: analysis.summary,
      prompt: analysis.prompt,
      cached,
      action_buttons: actionButtons,
    }
  };
}

/**
 * Handle eda.get_analysis_cache.
 */
export function handleGetAnalysisCache(args) {
  const { action = 'stats' } = args;

  if (action === 'clear') {
    const result = clearCache();
    return {
      content: [{
        type: 'text',
        text: result.error
          ? `❌ Failed to clear cache: ${result.error}`
          : `✓ Cleared ${result.cleared} cached analysis entries`
      }],
      _metadata: result,
    };
  }

  // Default: show stats
  const stats = getCacheStats();
  let text = '📊 **Analysis Cache Statistics**\n\n';
  text += `**Valid Entries:** ${stats.entries}\n`;
  text += `**Expired Entries:** ${stats.expired || 0}\n`;
  text += `**Total Cache Size:** ${stats.sizeKB} KB\n\n`;
  text += `**Cache Location:** ~/.hipilot/analysis-cache/\n`;
  text += `**TTL:** 24 hours\n\n`;
  text += `Use \`eda.get_analysis_cache({ action: 'clear' })\` to clear all cached analyses.`;

  return {
    content: [{ type: 'text', text }],
    _metadata: stats,
  };
}

/**
 * Tool handler map for report analysis tools.
 */
export const TOOL_HANDLERS = {
  'eda.analyze_report': handleAnalyzeReport,
  'eda.get_analysis_cache': handleGetAnalysisCache,
};
