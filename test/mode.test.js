/**
 * Unit tests for mode.js
 * Mode is permanently AUTO — all commands execute immediately.
 */

import { describe, it, expect } from 'vitest';
import {
  getMode,
  isAutoMode,
  isManualMode,
  MODES,
} from '../src/lib/mode.js';

describe('mode.js', () => {
  describe('getMode', () => {
    it('should always return AUTO', () => {
      expect(getMode()).toBe(MODES.AUTO);
    });
  });

  describe('isAutoMode / isManualMode', () => {
    it('should always be auto mode', () => {
      expect(isAutoMode()).toBe(true);
      expect(isManualMode()).toBe(false);
    });
  });
});
