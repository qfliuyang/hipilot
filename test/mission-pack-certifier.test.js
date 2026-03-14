/**
 * Unit tests for MissionPackCertifier
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { MissionPackCertifier } from '../src/hitestbot/core/MissionPackCertifier.js';

describe('MissionPackCertifier', () => {
  let tempDir;
  let certifier;

  beforeEach(() => {
    tempDir = join(tmpdir(), `mp-cert-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    certifier = new MissionPackCertifier({ designDir: tempDir });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('loadMissionPack', () => {
    it('should load mission pack from YAML file', () => {
      const yamlContent = `
project:
  name: test_design
  description: Test design

design:
  rtl:
    top_module: top
    files:
      - rtl/top.v
  libraries:
    target:
      - lib/tech.lib
`;
      writeFileSync(join(tempDir, 'hipilot-mission.yaml'), yamlContent);

      const result = certifier.loadMissionPack();

      expect(result.success).toBe(true);
      expect(result.missionPack).toBeDefined();
    });

    it('should auto-detect when no mission pack exists', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), 'module top; endmodule');
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');

      const result = certifier.loadMissionPack();

      expect(result.success).toBe(true);
    });

    it('should return error when no design dir', () => {
      const badCertifier = new MissionPackCertifier({});
      const result = badCertifier.loadMissionPack();

      expect(result.success).toBe(false);
    });
  });

  describe('checkQoRAgainstTargets', () => {
    it('should identify timing gaps', () => {
      const yamlContent = `
project:
  name: test
flow:
  targets:
    timing:
      wns: 0.0
      tns: 0.0
`;
      writeFileSync(join(tempDir, 'hipilot-mission.yaml'), yamlContent);
      certifier.loadMissionPack();

      const result = certifier.checkQoRAgainstTargets('synthesis', {
        timing: { wns: -0.5, tns: -10.0 }
      });

      expect(result.targetsMet).toBe(false);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it('should pass when targets are met', () => {
      const yamlContent = `
project:
  name: test
flow:
  targets:
    timing:
      wns: 0.0
`;
      writeFileSync(join(tempDir, 'hipilot-mission.yaml'), yamlContent);
      certifier.loadMissionPack();

      const result = certifier.checkQoRAgainstTargets('synthesis', {
        timing: { wns: 0.1 }
      });

      expect(result.targetsMet).toBe(true);
    });
  });

  describe('calculateGap', () => {
    it('should calculate lower-is-better gaps correctly', () => {
      certifier.missionPack = { getTargets: () => ({}) };

      // Area: target 100000, actual 120000 (worse - higher area is bad)
      const gap = certifier.calculateGap(120000, 100000, 'lower');
      expect(gap.severity).toBe('critical');

      // Area: target 100000, actual 90000 (better - lower area)
      const goodGap = certifier.calculateGap(90000, 100000, 'lower');
      expect(goodGap.severity).toBe('passed');
    });

    it('should calculate higher-is-better gaps correctly', () => {
      certifier.missionPack = { getTargets: () => ({}) };

      // Frequency: target 100, actual 80 (worse than target)
      const gap = certifier.calculateGap(80, 100, 'higher');
      expect(gap.severity).toBe('critical');

      // WNS: target 0, actual -0.5 (worse than target - more negative)
      const wnsGap = certifier.calculateGap(-0.5, 0.0, 'higher');
      expect(wnsGap.severity).toBe('critical');
    });
  });

  describe('getFlowProgress', () => {
    it('should calculate flow progress', () => {
      // Manually set mission pack data
      certifier.missionPack = {
        stages: ['synthesis', 'floorplan', 'placement']
      };

      const progress = certifier.getFlowProgress(['synthesis']);

      expect(progress.completedStages).toBe(1);
      expect(progress.remainingStages).toBe(2);
      expect(progress.nextStage).toBe('floorplan');
    });
  });
});
