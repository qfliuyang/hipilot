/**
 * ProgressTracker - Track improvement across test runs
 *
 * Reads flow_progress.json files from multiple runs and produces
 * the improvement trend table per TESTING_RULES.md Section 10.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export class ProgressTracker {
  constructor() {
    this.runs = [];
  }

  /** Add a run from a flow_progress.json file */
  addRunFromFile(filePath) {
    if (!existsSync(filePath)) return;
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      this.runs.push(data);
    } catch {}
  }

  /** Scan an evidence base directory for all flow_progress.json files */
  scanDirectory(baseDir) {
    if (!existsSync(baseDir)) return;
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const progressFile = join(baseDir, entry.name, 'flow_progress.json');
        this.addRunFromFile(progressFile);
      }
    }
    this.runs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /** Get the improvement trend */
  getTrend() {
    return this.runs.map(run => ({
      date: run.timestamp?.slice(0, 10) || 'unknown',
      test: run.test_name,
      progress: `${run.completed_stages}/${run.total_stages} (${run.progress_pct}%)`,
      score: `${run.total_score?.toFixed(1)}/${run.max_score}`,
      blocking_stage: run.blocking_stage || 'none',
      blocking_category: run.blocking_category || '-',
    }));
  }

  /** Format trend as a markdown table */
  formatTrend() {
    const trend = this.getTrend();
    if (trend.length === 0) return 'No test runs found.\n';

    let md = `| Date | Progress | Score | Blocking Stage | Category |\n`;
    md += `|------|----------|-------|----------------|----------|\n`;
    for (const row of trend) {
      md += `| ${row.date} | ${row.progress} | ${row.score} | ${row.blocking_stage} | ${row.blocking_category} |\n`;
    }

    // Trend summary
    if (trend.length >= 2) {
      const first = this.runs[0];
      const last = this.runs[this.runs.length - 1];
      const progressDelta = (last.progress_pct || 0) - (first.progress_pct || 0);
      const scoreDelta = (last.total_score || 0) - (first.total_score || 0);

      md += `\n**Trend over ${trend.length} runs:**\n`;
      md += `- Progress: ${progressDelta >= 0 ? '+' : ''}${progressDelta}%\n`;
      md += `- Score: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)}\n`;
    }

    return md;
  }

  /** Check if graduation criteria are met */
  checkGraduation() {
    if (this.runs.length === 0) return { graduated: false, reason: 'No runs' };

    const latest = this.runs[this.runs.length - 1];
    const checks = [
      {
        name: 'All stages pass',
        passed: latest.completed_stages === latest.total_stages,
        detail: `${latest.completed_stages}/${latest.total_stages} completed`,
      },
      {
        name: 'Score ≥ 90%',
        passed: latest.total_score >= latest.max_score * 0.9,
        detail: `${latest.total_score?.toFixed(1)}/${latest.max_score} (${((latest.total_score / latest.max_score) * 100).toFixed(0)}%)`,
      },
      {
        name: 'No blocking stage',
        passed: !latest.blocking_stage,
        detail: latest.blocking_stage ? `Blocked at: ${latest.blocking_stage}` : 'No blockers',
      },
      {
        name: 'No HIPILOT_BUG failures',
        passed: !latest.stages?.some(s => s.failure_category === 'HIPILOT_BUG'),
        detail: latest.stages?.filter(s => s.failure_category === 'HIPILOT_BUG').length + ' HiPilot bugs',
      },
    ];

    const allPassed = checks.every(c => c.passed);
    return {
      graduated: allPassed,
      checks,
      reason: allPassed
        ? 'All graduation criteria met'
        : `Failed: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`,
    };
  }
}
