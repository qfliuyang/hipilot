/**
 * Unit tests for shell-escape.js
 */

import { describe, it, expect } from 'vitest';
import { shellEscape, validateInt } from '../src/lib/shell-escape.js';

describe('shellEscape', () => {
  describe('normal strings', () => {
    it('wraps a plain string in single quotes', () => {
      expect(shellEscape('hello')).toBe("'hello'");
    });

    it('wraps an empty string in single quotes', () => {
      expect(shellEscape('')).toBe("''");
    });

    it('returns empty single quotes for null', () => {
      expect(shellEscape(null)).toBe("''");
    });

    it('returns empty single quotes for undefined', () => {
      expect(shellEscape(undefined)).toBe("''");
    });

    it('converts numbers to strings and wraps them', () => {
      expect(shellEscape(42)).toBe("'42'");
    });
  });

  describe('shell metacharacters', () => {
    it('safely wraps dollar sign', () => {
      const result = shellEscape('$HOME');
      expect(result).toBe("'$HOME'");
    });

    it('safely wraps parentheses (command substitution)', () => {
      const result = shellEscape('$(rm -rf /)');
      expect(result).toBe("'$(rm -rf /)'");
    });

    it('safely wraps backticks', () => {
      const result = shellEscape('`id`');
      expect(result).toBe("'`id`'");
    });

    it('safely wraps semicolon', () => {
      const result = shellEscape('a; b');
      expect(result).toBe("'a; b'");
    });

    it('safely wraps pipe', () => {
      const result = shellEscape('a | b');
      expect(result).toBe("'a | b'");
    });

    it('safely wraps double quotes', () => {
      const result = shellEscape('"quoted"');
      expect(result).toBe('\'"quoted"\'');
    });

    it('safely wraps double ampersand (logical AND)', () => {
      const result = shellEscape('a && b');
      expect(result).toBe("'a && b'");
    });

    it('safely wraps newlines', () => {
      const result = shellEscape('line1\nline2');
      expect(result).toBe("'line1\nline2'");
    });
  });

  describe('single quote escaping', () => {
    it("escapes an embedded single quote", () => {
      // The ' inside becomes '\''
      expect(shellEscape("it's")).toBe("'it'\\''s'");
    });

    it("escapes multiple embedded single quotes", () => {
      expect(shellEscape("a'b'c")).toBe("'a'\\''b'\\''c'");
    });

    it("handles a string that is only a single quote", () => {
      expect(shellEscape("'")).toBe("''\\'''");
    });
  });
});

describe('validateInt', () => {
  describe('valid integers', () => {
    it('accepts a valid integer', () => {
      expect(validateInt(5, 'count')).toBe(5);
    });

    it('accepts zero', () => {
      expect(validateInt(0, 'count')).toBe(0);
    });

    it('accepts negative integers', () => {
      expect(validateInt(-3, 'offset')).toBe(-3);
    });

    it('accepts integer passed as string', () => {
      expect(validateInt('10', 'count')).toBe(10);
    });

    it('accepts value exactly at min boundary', () => {
      expect(validateInt(1, 'count', 1, 10)).toBe(1);
    });

    it('accepts value exactly at max boundary', () => {
      expect(validateInt(10, 'count', 1, 10)).toBe(10);
    });
  });

  describe('rejects non-integers', () => {
    it('throws for a float', () => {
      expect(() => validateInt(1.5, 'count')).toThrow('count must be an integer');
    });

    it('throws for a float string', () => {
      expect(() => validateInt('3.14', 'pi')).toThrow('pi must be an integer');
    });

    it('throws for NaN', () => {
      expect(() => validateInt(NaN, 'count')).toThrow('count must be an integer');
    });

    it('throws for a non-numeric string', () => {
      expect(() => validateInt('abc', 'count')).toThrow('count must be an integer');
    });
  });

  describe('range violations', () => {
    it('throws when value is below min', () => {
      expect(() => validateInt(0, 'count', 1, 10)).toThrow('count must be >= 1');
    });

    it('throws when value is above max', () => {
      expect(() => validateInt(11, 'count', 1, 10)).toThrow('count must be <= 10');
    });

    it('accepts when no min/max specified', () => {
      expect(validateInt(-999999, 'count')).toBe(-999999);
    });

    it('checks only min when max is omitted', () => {
      expect(validateInt(100, 'count', 1)).toBe(100);
      expect(() => validateInt(0, 'count', 1)).toThrow('count must be >= 1');
    });

    it('checks only max when min is omitted', () => {
      expect(validateInt(-100, 'count', undefined, 50)).toBe(-100);
      expect(() => validateInt(51, 'count', undefined, 50)).toThrow('count must be <= 50');
    });
  });
});
