/**
 * Unit tests for mode.js
 * Mode is permanently AUTO — all commands execute immediately.
 */

import { describe, it, expect } from 'vitest';
import {
  getMode,
  isAutoMode,
  MODES,
} from '../src/lib/mode.js';

describe('mode.js', () => {
  describe('getMode', () => {
    it('should always return AUTO', () => {
      expect(getMode()).toBe(MODES.AUTO);
    });
  });

  describe('isAutoMode', () => {
    it('should always be true', () => {
      expect(isAutoMode()).toBe(true);
    });
  });
});
