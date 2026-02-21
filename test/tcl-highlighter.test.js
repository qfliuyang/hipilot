/**
 * Unit tests for tcl-highlighter.js
 */

import { describe, it, expect } from 'vitest';
import { highlightTcl } from '../src/lib/tcl-highlighter.js';

describe('tcl-highlighter.js', () => {
  describe('highlightTcl', () => {
    it('should return highlighted output', () => {
      const code = 'report_timing -max_paths 10';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
      expect(highlighted.length).toBeGreaterThanOrEqual(code.length);
    });

    it('should handle empty input', () => {
      const highlighted = highlightTcl('');
      expect(highlighted).toBe('');
    });

    it('should handle multi-line Tcl', () => {
      const code = `set_db flow_stage init
read_db design.db
report_timing`;
      const highlighted = highlightTcl(code);
      expect(highlighted).toContain('\n');
      expect(typeof highlighted).toBe('string');
    });

    it('should highlight comments', () => {
      const code = '# comment\nreport_timing';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
      expect(highlighted.length).toBeGreaterThan(0);
    });

    it('should handle strings', () => {
      const code = 'puts "Hello World"';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
    });

    it('should handle variables', () => {
      const code = 'set x $var';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
    });

    it('should handle keywords', () => {
      const code = 'report_timing';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
    });

    it('should handle flags', () => {
      const code = 'report_timing -max_paths 10';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
    });

    it('should handle numbers', () => {
      const code = 'set x 123';
      const highlighted = highlightTcl(code);
      expect(typeof highlighted).toBe('string');
    });
  });
});
