#!/usr/bin/env node
/**
 * Archivist Agent - Knowledge Recording and Analysis
 *
 * Responsibilities:
 * - Record QoR metrics to Knowledge Agent (Project-Brain)
 * - Store error patterns and resolutions
 * - Analyze trends across phases
 * - Provide historical context for future planning
 */

export class ArchivistAgent {
  constructor(knowledgeAgent) {
    this.name = 'archivist';
    this.knowledge = knowledgeAgent;
    this.recordsCreated = 0;
    this.recordHistory = [];
  }

  /**
   * Record phase execution results
   */
  async recordPhaseResults(phase, execution, plan) {
    console.log(`[Archivist] Recording results for ${phase}`);

    const records = [];

    // Record 1: QoR metrics
    if (execution.qor) {
      const qorRecord = await this.recordQoR(phase, execution.qor, {
        duration: execution.duration,
        strategy: plan.strategy?.type,
      });
      records.push(qorRecord);
    }

    // Record 2: Phase memory
    const phaseRecord = await this.recordPhaseMemory(phase, {
      plan,
      execution,
      completedAt: Date.now(),
    });
    records.push(phaseRecord);

    // Record 3: Any errors
    if (execution.errors && execution.errors.length > 0) {
      for (const error of execution.errors) {
        const errorRecord = await this.recordErrorPattern(error, execution, phase);
        records.push(errorRecord);
      }
    }

    // Record 4: Execution metrics
    const metricsRecord = await this.recordMetrics(phase, execution);
    records.push(metricsRecord);

    this.recordsCreated += records.length;
    this.recordHistory.push(...records);

    return {
      phase,
      recordsCreated: records.length,
      records,
    };
  }

  /**
   * Record QoR metrics via Knowledge Agent
   */
  async recordQoR(phase, metrics, context = {}) {
    console.log(`[Archivist] Recording QoR for ${phase}:`, metrics);

    const record = await this.knowledge.recordQoR(phase, metrics, context);

    return {
      type: 'qor',
      phase,
      metrics,
      context,
      record,
    };
  }

  /**
   * Record phase memory
   */
  async recordPhaseMemory(phase, data) {
    console.log(`[Archivist] Recording phase memory for ${phase}`);

    const memoryCategory = `${phase}_memory`;
    const key = `execution_${Date.now()}`;

    const record = await this.knowledge.store(memoryCategory, key, data, {
      phase,
      timestamp: Date.now(),
    });

    return {
      type: 'phase_memory',
      phase,
      category: memoryCategory,
      key,
      record,
    };
  }

  /**
   * Record error pattern
   */
  async recordErrorPattern(error, execution, phase) {
    console.log(`[Archivist] Recording error pattern for ${phase}: ${error}`);

    // Try to match with existing patterns via Knowledge Agent
    const tool = this.getToolForPhase(phase);
    const matchedPattern = await this.knowledge.queryEDA({
      type: 'error_pattern',
      tool,
      output: error,
    });

    const record = await this.knowledge.store(
      'error_patterns',
      `error_${Date.now()}`,
      {
        pattern: matchedPattern?.pattern || error,
        message: error,
        phase,
        tool,
        resolution: null, // To be filled when resolved
        matchedPattern: matchedPattern?.id || null,
      },
      {
        phase,
        timestamp: Date.now(),
      }
    );

    return {
      type: 'error_pattern',
      phase,
      error,
      matchedPattern,
      record,
    };
  }

  /**
   * Record execution metrics
   */
  async recordMetrics(phase, execution) {
    console.log(`[Archivist] Recording metrics for ${phase}`);

    const metrics = {
      duration: execution.duration,
      stepsCompleted: execution.steps.length,
      status: execution.status,
      timestamp: Date.now(),
    };

    const record = await this.knowledge.store(
      'execution_metrics',
      `metrics_${phase}_${Date.now()}`,
      metrics,
      { phase }
    );

    return {
      type: 'metrics',
      phase,
      metrics,
      record,
    };
  }

  /**
   * Analyze trends across phases
   */
  async analyzeTrends(phases = null) {
    console.log(`[Archivist] Analyzing trends`);

    // Query QoR progression via Knowledge Agent
    const wnsProgression = await this.knowledge.queryProject({
      type: 'qor_progression',
      metric: 'wns',
    });

    const tnsProgression = await this.knowledge.queryProject({
      type: 'qor_progression',
      metric: 'tns',
    });

    // Analyze timing trend
    const timingTrend = this.analyzeMetricTrend(wnsProgression.progression || []);
    const noiseTrend = this.analyzeMetricTrend(tnsProgression.progression || []);

    return {
      wnsTrend: timingTrend,
      tnsTrend: noiseTrend,
      overallHealth: this.assessHealth(timingTrend, noiseTrend),
      recommendations: this.generateRecommendations(timingTrend, noiseTrend),
    };
  }

  /**
   * Analyze trend for a single metric
   */
  analyzeMetricTrend(progression) {
    if (progression.length < 2) {
      return { trend: 'insufficient_data', direction: 'unknown' };
    }

    const values = progression.map(p => p.value);
    const first = values[0];
    const last = values[values.length - 1];
    const delta = last - first;

    // For WNS: positive is better (meeting timing)
    // For TNS: less negative is better
    const improving = delta > 0;
    const degrading = delta < 0;

    return {
      trend: improving ? 'improving' : degrading ? 'degrading' : 'stable',
      direction: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'flat',
      delta,
      first,
      last,
      count: values.length,
    };
  }

  /**
   * Assess overall health
   */
  assessHealth(wnsTrend, tnsTrend) {
    if (wnsTrend.trend === 'improving' && tnsTrend.trend === 'improving') {
      return 'healthy';
    }
    if (wnsTrend.trend === 'degrading' || tnsTrend.trend === 'degrading') {
      return 'at_risk';
    }
    return 'stable';
  }

  /**
   * Generate recommendations based on trends
   */
  generateRecommendations(wnsTrend, tnsTrend) {
    const recommendations = [];

    if (wnsTrend.trend === 'degrading') {
      recommendations.push({
        type: 'timing',
        priority: 'high',
        message: 'WNS is degrading - consider increasing optimization effort',
      });
    }

    if (tnsTrend.trend === 'degrading') {
      recommendations.push({
        type: 'noise',
        priority: 'medium',
        message: 'TNS showing degradation - review constraint settings',
      });
    }

    return recommendations;
  }

  /**
   * Get historical context for a phase
   */
  async getHistoricalContext(phase) {
    console.log(`[Archivist] Getting historical context for ${phase}`);

    // Query Project-Brain via Knowledge Agent
    const phaseMemory = await this.knowledge.queryProject({
      type: 'recall',
      category: `${phase}_memory`,
    });

    const errors = await this.knowledge.queryProject({
      type: 'recall',
      category: 'error_patterns',
    });

    return {
      phase,
      previousRuns: phaseMemory.success ? phaseMemory.entries : [],
      commonErrors: errors.success ? errors.entries : [],
      lessons: this.extractLessons(phaseMemory.entries || []),
    };
  }

  /**
   * Extract lessons from historical data
   */
  extractLessons(entries) {
    const lessons = [];

    for (const entry of entries) {
      if (entry.value && entry.value.execution) {
        const exec = entry.value.execution;

        // Lesson from successful runs
        if (exec.status === 'completed' && exec.qor) {
          lessons.push({
            type: 'success',
            strategy: entry.value.plan?.strategy?.type,
            qor: exec.qor,
          });
        }

        // Lesson from failures
        if (exec.status === 'failed' && exec.errors) {
          lessons.push({
            type: 'failure',
            errors: exec.errors,
            recovery: exec.recovery,
          });
        }
      }
    }

    return lessons;
  }

  /**
   * Get EDA tool for a phase
   */
  getToolForPhase(phase) {
    const toolMap = {
      synthesis: 'dc_shell',
      design_init: 'innovus',
      floorplan: 'innovus',
      powerplan: 'innovus',
      placement: 'innovus',
      cts: 'innovus',
      post_cts_opt: 'innovus',
      routing: 'innovus',
      route_opt: 'innovus',
      chip_finish: 'innovus',
    };

    return toolMap[phase] || 'innovus';
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      recordsCreated: this.recordsCreated,
      phasesRecorded: [...new Set(this.recordHistory.map(r => r.phase))].length,
    };
  }
}

export default ArchivistAgent;
