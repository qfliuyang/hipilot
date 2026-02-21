/**
 * Unit tests for mode.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getMode,
  setMode,
  toggleMode,
  isAutoMode,
  isManualMode,
  queuePending,
  getPending,
  approvePending,
  rejectPending,
  getModeStatus,
  MODES,
} from '../src/lib/mode.js';
import { existsSync, unlinkSync } from 'fs';

describe('mode.js', () => {
  describe('getMode', () => {
    it('should default to MANUAL mode', () => {
      const mode = getMode();
      expect(mode).toBe(MODES.MANUAL);
    });
  });

  describe('setMode', () => {
    it('should reject invalid modes', () => {
      expect(() => setMode('invalid')).toThrow('Invalid mode');
    });

    it('should accept valid modes', () => {
      expect(() => setMode(MODES.MANUAL)).not.toThrow();
      expect(() => setMode(MODES.AUTO)).not.toThrow();
    });
  });

  describe('toggleMode', () => {
    it('should toggle between modes', () => {
      setMode(MODES.MANUAL);
      const newMode = toggleMode();
      expect(newMode).toBe(MODES.AUTO);

      toggleMode();
      expect(getMode()).toBe(MODES.MANUAL);
    });
  });

  describe('isAutoMode / isManualMode', () => {
    it('should correctly detect auto mode', () => {
      setMode(MODES.AUTO);
      expect(isAutoMode()).toBe(true);
      expect(isManualMode()).toBe(false);
    });

    it('should correctly detect manual mode', () => {
      setMode(MODES.MANUAL);
      expect(isAutoMode()).toBe(false);
      expect(isManualMode()).toBe(true);
    });
  });
});
