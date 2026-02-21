/**
 * Unit tests for risk-analyzer.js
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeRisk,
  generateApprovalPrompt,
  validateConfirmation,
} from '../src/lib/risk-analyzer.js';

describe('risk-analyzer.js', () => {
  describe('analyzeRisk', () => {
    it('should return safe for empty input', () => {
      const result = analyzeRisk('');
      expect(result.category).toBe(0);
      expect(result.label).toBe('Safe');
    });

    it('should detect high-risk save commands', () => {
      const tcl = 'save_design design.db';
      const result = analyzeRisk(tcl);
      expect(result.category).toBe(3);
      expect(result.critical_commands.length).toBeGreaterThan(0);
    });

    it('should detect dangerous delete commands', () => {
      const tcl = 'delete_cell cell1';
      const result = analyzeRisk(tcl);
      expect(result.category).toBe(2);
      expect(result.dangerous_commands.length).toBeGreaterThan(0);
    });

    it('should detect moderate-risk optimization commands', () => {
      const tcl = 'route_design';
      const result = analyzeRisk(tcl);
      expect(result.category).toBe(1);
    });

    it('should classify read-only commands as safe', () => {
      const tcl = 'report_timing';
      const result = analyzeRisk(tcl);
      expect(result.category).toBe(0);
      expect(result.label).toBe('Safe');
    });

    it('should handle null input', () => {
      const result = analyzeRisk(null);
      expect(result.category).toBe(0);
    });

    it('should include warnings for dangerous commands', () => {
      const tcl = 'delete_cell *';
      const result = analyzeRisk(tcl);
      expect(result.has_warnings).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should include warnings for critical commands', () => {
      const tcl = 'save_design';
      const result = analyzeRisk(tcl);
      expect(result.has_warnings).toBe(true);
    });

    it('should provide time estimates', () => {
      const result = analyzeRisk('report_timing');
      expect(result.estimated_time_display).toBeDefined();
      expect(result.estimated_time_seconds).toBeDefined();
    });

    it('should provide summary', () => {
      const result = analyzeRisk('report_timing');
      expect(result.summary).toBeDefined();
      expect(result.summary.risk_level).toBeDefined();
      expect(result.summary.time).toBeDefined();
    });
  });

  describe('generateApprovalPrompt', () => {
    it('should generate prompt for safe commands', () => {
      const risk = analyzeRisk('report_timing');
      const prompt = generateApprovalPrompt(risk, 'report_timing');
      expect(prompt).toContain('Approval Required');
      expect(prompt).toContain('report_timing');
    });

    it('should generate prompt for dangerous commands', () => {
      const risk = analyzeRisk('delete_cell cell1');
      const prompt = generateApprovalPrompt(risk, 'delete_cell cell1');
      expect(prompt).toContain('DANGEROUS');
    });

    it('should generate prompt for critical commands', () => {
      const risk = analyzeRisk('save_design');
      const prompt = generateApprovalPrompt(risk, 'save_design');
      expect(prompt).toContain('CRITICAL');
    });
  });

  describe('validateConfirmation', () => {
    it('should accept yes for safe commands', () => {
      const risk = analyzeRisk('report_timing');
      const result = validateConfirmation('yes', risk);
      expect(result.valid).toBe(true);
    });

    it('should accept execute for safe commands', () => {
      const risk = analyzeRisk('report_timing');
      const result = validateConfirmation('execute', risk);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid confirmation for dangerous commands', () => {
      const risk = analyzeRisk('delete_cell cell1');
      const result = validateConfirmation('yes', risk);
      expect(result.valid).toBe(false);
    });

    it('should accept CONFIRM for dangerous commands', () => {
      const risk = analyzeRisk('delete_cell cell1');
      const result = validateConfirmation('CONFIRM', risk);
      expect(result.valid).toBe(true);
    });

    it('should handle cancel', () => {
      const risk = analyzeRisk('report_timing');
      const result = validateConfirmation('cancel', risk);
      expect(result.valid).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });
});
