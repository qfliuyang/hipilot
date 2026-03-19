/**
 * FlowReporter - Generate FLOW_REPORT.md and flow_progress.json
 *
 * Produces the human-readable report and machine-readable progress data
 * per TESTING_RULES.md Section 8.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export class FlowReporter {
  /**
   * Generate all report formats.
   * @param {object} data
   * @param {string} data.workflowName
   * @param {string} data.timestamp
   * @param {number} data.totalElapsedMs
   * @param {object[]} data.stageResults - StageVerifier results
   * @param {object} data.mcpStats - MCP call statistics
   * @param {object} [data.mcpDiagnostics] - { byTool, errorExcerpts } for diagnostic summary
   * @param {object} data.workflowResult - workflow.run metadata
   * @param {object[]} [data.observations] - ObservationPoint results (pane previews)
   */
  generate(data) {
    return {
      markdown: this.generateMarkdown(data),
      json: this.generateJson(data),
    };
  }

  generateMarkdown(data) {
    const { workflowName, timestamp, totalElapsedMs, stageResults, mcpStats, mcpDiagnostics, workflowResult, observations } = data;
    const totalS = (totalElapsedMs / 1000).toFixed(1);
    const totalStages = workflowResult?.total_steps || stageResults.length;

    const passedStages = stageResults.filter(s => s.status === 'pass').length;
    const partialStages = stageResults.filter(s => s.status === 'partial').length;
    const failedStages = stageResults.filter(s => s.status === 'fail').length;
    const completedStages = passedStages + partialStages;
    const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

    // Get first result for transcript (university-style scoring)
    const result = stageResults[0] || {};
    const transcript = result.transcript;
    const hasTranscript = transcript && transcript.subjects;

    // Legacy score calculation
    const totalScore = stageResults.reduce((s, r) => s + r.total_score, 0);
    const maxScore = stageResults.reduce((s, r) => s + r.max_score, 0) || (totalStages * 5);

    // Find blocking stage
    const blockingStage = stageResults.find(s => s.status === 'fail');

    let md = `# HiPilot Flow Certification Report\n\n`;

    // University-Style Transcript (if available)
    if (hasTranscript) {
      md += `## Academic Transcript\n\n`;
      md += `| Subject | Score | Grade | Weight | Status |\n`;
      md += `|---------|-------|-------|--------|--------|\n`;
      for (const subject of transcript.subjects) {
        const icon = subject.status === 'PASS' ? '✅' : '❌';
        md += `| ${subject.name} | ${subject.score}% | ${subject.grade} | ${subject.weight}x | ${icon} ${subject.status} |\n`;
      }
      md += `\n`;
      md += `**GPA: ${transcript.gpa}/4.0** | **Final Grade: ${transcript.final_grade}** | **Overall: ${transcript.overall_percentage}%**\n\n`;
      md += `*Assessment: ${result.assessment || 'N/A'}*\n\n`;

      if (result.recommendations && result.recommendations.length > 0) {
        md += `**Recommendations:**\n`;
        for (const rec of result.recommendations) {
          md += `- ${rec}\n`;
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }

    md += `## Executive Summary\n\n`;
    const overallStatus = failedStages === 0
      ? (partialStages > 0 ? 'PARTIAL PASS' : 'PASS')
      : 'FAIL';
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| **Overall** | ${overallStatus} |\n`;
    md += `| Workflow | ${workflowName} |\n`;
    md += `| Progress | ${completedStages}/${totalStages} stages (${progressPct}%) |\n`;
    if (hasTranscript) {
      md += `| GPA | ${transcript.gpa}/4.0 (${transcript.final_grade}) |\n`;
      // Find Human-Like subject and display prominently
      const humanLike = transcript.subjects.find(s => s.name === 'Human-Like');
      if (humanLike) {
        const humanLevel = humanLike.score >= 80 ? '🟢 Human-like' :
                          humanLike.score >= 60 ? '🟡 Semi-human' :
                          humanLike.score >= 40 ? '🟠 Partially human' :
                          humanLike.score >= 20 ? '🔴 Machine-like' : '⚫ Dead machine';
        md += `| **Human Level** | ${humanLevel} (${humanLike.score}%) |\n`;
      }
    }
    md += `| Score | ${totalScore.toFixed(1)}/${maxScore} |\n`;
    md += `| Duration | ${totalS}s |\n`;
    if (blockingStage) {
      md += `| Blocking Stage | ${blockingStage.stage} (${blockingStage.failure_classification?.category || 'N/A'}) |\n`;
    }
    md += `\n---\n\n`;

    // Flow Progress
    md += `## Flow Progress\n\n`;
    md += `| # | Stage | Score | Status | Notes |\n`;
    md += `|---|-------|-------|--------|-------|\n`;

    for (const sr of stageResults) {
      const icon = sr.status === 'pass' ? '✅' : sr.status === 'partial' ? '⚠️' : '❌';
      const notes = sr.failure_classification
        ? `${sr.failure_classification.category}: ${sr.failure_classification.summary.slice(0, 60)}`
        : (sr.scores?.L5_qor_assessment?.detail || '').slice(0, 80);
      md += `| ${sr.stage} | ${sr.stage} | ${sr.total_score.toFixed(1)}/5.0 | ${icon} ${sr.status.toUpperCase()} | ${notes} |\n`;
    }

    // Add unreached stages
    const reachedCount = stageResults.length;
    if (reachedCount < totalStages) {
      for (let i = reachedCount; i < totalStages; i++) {
        const stepName = workflowResult?.step_results?.[i]?.name || `Stage ${i + 1}`;
        md += `| ${i + 1} | ${stepName} | - | ⏭ SKIP | Not reached |\n`;
      }
    }

    md += `\n**Progress: ${completedStages}/${totalStages} stages (${progressPct}%)**\n`;
    md += `**Total Score: ${totalScore.toFixed(1)}/${maxScore}**\n\n`;

    // Blocking Issue
    if (blockingStage) {
      md += `---\n\n## Blocking Issue\n\n`;
      md += `**Stage:** ${blockingStage.stage}\n`;
      if (blockingStage.failure_classification) {
        md += `**Category:** ${blockingStage.failure_classification.category}\n`;
        md += `**Summary:** ${blockingStage.failure_classification.summary}\n`;
        md += `**Action:** ${blockingStage.failure_classification.action}\n`;
      }
      md += '\n';
    }

    // Stage Scorecards (detailed)
    md += `---\n\n## Stage Scorecards\n\n`;
    for (const sr of stageResults) {
      const icon = sr.status === 'pass' ? '✅' : sr.status === 'partial' ? '⚠️' : '❌';
      const max = sr.max_score || 5.0;
      md += `### ${sr.stage} (${sr.total_score.toFixed(1)}/${max.toFixed(1)}) ${icon}\n\n`;

      // Show transcript if available
      if (sr.transcript) {
        md += `**University Transcript:**\n`;
        md += `| Subject | Score | Grade | Weight |\n`;
        md += `|---------|-------|-------|--------|\n`;
        for (const subject of sr.transcript.subjects) {
          const statusIcon = subject.status === 'PASS' ? '✓' : '✗';
          md += `| ${subject.name} | ${subject.score}% | ${subject.grade} | ${subject.weight}x ${statusIcon} |\n`;
        }
        md += `\n**GPA: ${sr.transcript.gpa}/4.0** | **Grade: ${sr.transcript.final_grade}**\n\n`;
      }

      // Show detailed scores
      md += `**Detailed Scores:**\n\n`;
      md += `| Layer | Score | Detail |\n`;
      md += `|-------|-------|--------|\n`;
      for (const [key, val] of Object.entries(sr.scores || {})) {
        const layerName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        md += `| ${layerName} | ${val.score?.toFixed(1) || 'N/A'} | ${val.detail || 'N/A'} |\n`;
      }
      md += '\n';

      if (sr.failure_classification) {
        md += `**Failure:** ${sr.failure_classification.category} — ${sr.failure_classification.summary}\n`;
        md += `**Action:** ${sr.failure_classification.action}\n\n`;
      }
    }

    // MCP Statistics
    if (mcpStats) {
      md += `---\n\n## MCP Statistics\n\n`;
      md += `| Metric | Value |\n`;
      md += `|--------|-------|\n`;
      md += `| Total Calls | ${mcpStats.total_calls} |\n`;
      md += `| Successful | ${mcpStats.by_status?.ok || 0} |\n`;
      md += `| Errors | ${mcpStats.errors || 0} |\n`;
      md += `| Total Duration | ${mcpStats.total_duration_ms}ms |\n`;
      for (const [server, count] of Object.entries(mcpStats.by_server || {})) {
        md += `| ${server} calls | ${count} |\n`;
      }
      md += '\n';
    }

    // Diagnostic Summary (verbose for evidence-only debug; EDA server has no source)
    md += `---\n\n## Diagnostic Summary\n\n`;
    md += `*All debug information comes from the evidence package. EDA server has no source code.*\n\n`;
    if (mcpDiagnostics?.byTool && Object.keys(mcpDiagnostics.byTool).length > 0) {
      md += `### MCP Call Breakdown\n\n`;
      md += `| Tool | Calls | Errors |\n`;
      md += `|------|-------|--------|\n`;
      for (const [tool, info] of Object.entries(mcpDiagnostics.byTool)) {
        md += `| ${tool} | ${info.count} | ${info.errors || 0} |\n`;
      }
      md += '\n';
    }
    if (mcpDiagnostics?.errorExcerpts?.length) {
      md += `### Error Excerpts\n\n`;
      for (let i = 0; i < mcpDiagnostics.errorExcerpts.length; i++) {
        const ex = mcpDiagnostics.errorExcerpts[i];
        md += `**${i + 1}. ${ex.tool}** (${ex.ts})\n`;
        md += '```\n' + (ex.excerpt || 'No details') + '\n```\n\n';
      }
    }
    const lastObs = observations?.length ? observations[observations.length - 1] : null;
    if (lastObs?.content) {
      md += `### Pane Previews (last observation)\n\n`;
      if (lastObs.content.claude_pane_last50) {
        md += `**Claude pane (last 50 lines):**\n\`\`\`\n${lastObs.content.claude_pane_last50}\n\`\`\`\n\n`;
      }
      if (lastObs.content.eda_pane_last50) {
        md += `**EDA pane (last 50 lines):**\n\`\`\`\n${lastObs.content.eda_pane_last50}\n\`\`\`\n\n`;
      }
    }
    md += `See \`run_log.txt\`, \`mcp_calls.jsonl\`, \`stage_*/scorecard.json\` for full evidence.\n\n`;

    // Recommendations
    md += `---\n\n## Recommendations\n\n`;
    if (blockingStage) {
      const cat = blockingStage.failure_classification?.category || 'UNKNOWN';
      md += `- **Focus:** Resolve blocking stage \`${blockingStage.stage}\` (${cat})\n`;
      if (blockingStage.failure_classification?.action) {
        md += `- **Action:** ${blockingStage.failure_classification.action}\n`;
      }
      if (cat === 'AI_BEHAVIOR') {
        md += `- Review Claude prompts and skill matching; consider improving stage skill or MCP tool usage.\n`;
      } else if (cat === 'ENVIRONMENT') {
        md += `- Check EDA tool availability, paths, and licenses on the server.\n`;
      } else if (cat === 'HIPILOT_BUG') {
        md += `- Inspect MCP logs and template output for tool or Tcl generation bugs.\n`;
      }
    } else if (partialStages > 0) {
      md += `- Some stages passed with warnings; review partial scorecards for improvement.\n`;
    } else {
      md += `- All stages passed. Consider running full RTL2GDS to validate end-to-end.\n`;
    }
    md += `- **Evidence:** See \`stage_*/\` directories for per-stage artifacts and scorecards.\n`;
    md += `- **Video:** See \`video.mp4\` with timestamps in \`video_timestamps.json\` for observation offsets.\n\n`;
    md += `---\n\n*Generated by HiTestBot v2 at ${new Date().toISOString()}*\n`;

    return md;
  }

  generateJson(data) {
    const { workflowName, timestamp, totalElapsedMs, stageResults, workflowResult } = data;
    const totalStages = workflowResult?.total_steps || stageResults.length;
    const passedStages = stageResults.filter(s => s.status === 'pass').length;
    const partialStages = stageResults.filter(s => s.status === 'partial').length;
    const completedStages = passedStages + partialStages;
    const totalScore = stageResults.reduce((s, r) => s + r.total_score, 0);
    const maxScore = stageResults.reduce((s, r) => s + (r.max_score || 5), 0);
    const blockingStage = stageResults.find(s => s.status === 'fail');

    // Get first result for transcript
    const result = stageResults[0] || {};

    return {
      test_name: workflowName,
      timestamp,
      duration_s: Math.round(totalElapsedMs / 1000),
      total_stages: totalStages,
      completed_stages: completedStages,
      progress_pct: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
      total_score: totalScore,
      max_score: maxScore,
      // University-style transcript
      transcript: result.transcript || null,
      gpa: result.transcript?.gpa || null,
      final_grade: result.transcript?.final_grade || null,
      assessment: result.assessment || null,
      recommendations: result.recommendations || [],
      blocking_stage: blockingStage?.stage || null,
      blocking_category: blockingStage?.failure_classification?.category || null,
      stages: stageResults.map(sr => ({
        name: sr.stage,
        score: sr.total_score,
        max_score: sr.max_score || 5,
        status: sr.status,
        transcript: sr.transcript || null,
        failure_category: sr.failure_classification?.category || null,
        scores: Object.fromEntries(
          Object.entries(sr.scores || {}).map(([k, v]) => [k, v.score])
        ),
      })),
    };
  }

}
