/**
 * Unit tests for ui.js
 */

import { describe, it, expect } from 'vitest';
import {
  colors,
  icons,
  showHeader,
  showSection,
  showTclBlock,
  showMetrics,
  showActions,
  showSuccess,
  showError,
  showInfo,
} from '../src/lib/ui.js';

describe('ui.js', () => {
  describe('colors', () => {
    it('should have required color definitions', () => {
      expect(colors.cyan).toBeDefined();
      expect(colors.green).toBeDefined();
      expect(colors.yellow).toBeDefined();
      expect(colors.red).toBeDefined();
      expect(colors.blue).toBeDefined();
    });

    it('should use hex color format', () => {
      Object.values(colors).forEach(color => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('icons', () => {
    it('should have required icon definitions', () => {
      expect(icons.run).toBeDefined();
      expect(icons.edit).toBeDefined();
      expect(icons.save).toBeDefined();
      expect(icons.success).toBeDefined();
      expect(icons.fail).toBeDefined();
      expect(icons.warning).toBeDefined();
    });
  });

  describe('showHeader', () => {
    it('should be a function', () => {
      expect(typeof showHeader).toBe('function');
    });
  });

  describe('showSection', () => {
    it('should be a function', () => {
      expect(typeof showSection).toBe('function');
    });
  });

  describe('showTclBlock', () => {
    it('should be a function', () => {
      expect(typeof showTclBlock).toBe('function');
    });

    it('should accept trust parameter', () => {
      expect(() => showTclBlock('Test', 'report_timing', 'template')).not.toThrow();
      expect(() => showTclBlock('Test', 'report_timing', 'doc')).not.toThrow();
      expect(() => showTclBlock('Test', 'report_timing', 'unverified')).not.toThrow();
    });
  });

  describe('showMetrics', () => {
    it('should be a function', () => {
      expect(typeof showMetrics).toBe('function');
    });

    it('should accept metrics object', () => {
      const metrics = {
        WNS: '-0.123',
        TNS: '-45.6',
        'Violation Count': '12',
      };
      expect(() => showMetrics('Timing Report', metrics)).not.toThrow();
    });
  });

  describe('showActions', () => {
    it('should be a function', () => {
      expect(typeof showActions).toBe('function');
    });

    it('should accept actions array', () => {
      const actions = [
        { key: 'y', label: 'Yes' },
        { key: 'n', label: 'No' },
      ];
      expect(() => showActions(actions)).not.toThrow();
    });
  });

  describe('showSuccess', () => {
    it('should be a function', () => {
      expect(typeof showSuccess).toBe('function');
    });
  });

  describe('showError', () => {
    it('should be a function', () => {
      expect(typeof showError).toBe('function');
    });
  });

  describe('showInfo', () => {
    it('should be a function', () => {
      expect(typeof showInfo).toBe('function');
    });
  });
});
