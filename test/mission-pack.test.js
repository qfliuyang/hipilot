/**
 * Unit tests for Project Mission Pack system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test the mission pack modules
import {
  MissionPack,
  loadMissionPack,
  createDefaultMissionPack,
  hasMissionPack,
  getMissionPackInfo,
} from '../src/mission-pack/index.js';

import { validateMissionPack, VALID_STAGES } from '../src/mission-pack/validator.js';
import { autoDetectMissionPack, canAutoDetect } from '../src/mission-pack/auto-detect.js';

describe('mission-pack/index.js', () => {
  let tempDir;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = join(tmpdir(), `hipilot-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('MissionPack class', () => {
    it('should create a MissionPack instance with basic data', () => {
      const data = {
        project: { name: 'test_design' },
        design: {
          rtl: { top_module: 'top', files: ['rtl/top.v'] },
          libraries: { target: ['lib/tech.lib'] },
        },
      };

      const mp = new MissionPack(data, null, tempDir);

      expect(mp.projectName).toBe('test_design');
      expect(mp.topModule).toBe('top');
      expect(mp.stages).toHaveLength(10); // Default stages
    });

    it('should resolve RTL file paths correctly', () => {
      const data = {
        project: { name: 'test' },
        design: {
          rtl: {
            top_module: 'top',
            files: ['rtl/top.v', 'rtl/module.v'],
          },
        },
      };

      const mp = new MissionPack(data, null, tempDir);
      const rtlFiles = mp.getRtlFiles();

      expect(rtlFiles).toHaveLength(2);
      expect(rtlFiles[0]).toContain('rtl/top.v');
      expect(rtlFiles[1]).toContain('rtl/module.v');
    });

    it('should handle absolute paths without modification', () => {
      const data = {
        project: { name: 'test' },
        design: {
          rtl: {
            top_module: 'top',
            files: ['/absolute/path/to/file.v'],
          },
        },
      };

      const mp = new MissionPack(data, null, tempDir);
      const rtlFiles = mp.getRtlFiles();

      expect(rtlFiles[0]).toBe('/absolute/path/to/file.v');
    });

    it('should return default stages when not specified', () => {
      const data = { project: { name: 'test' } };
      const mp = new MissionPack(data, null, tempDir);

      expect(mp.stages).toContain('synthesis');
      expect(mp.stages).toContain('floorplan');
      expect(mp.stages).toContain('placement');
      expect(mp.stages).toContain('cts');
      expect(mp.stages).toContain('routing');
      expect(mp.stages).toContain('chip_finish');
    });

    it('should return custom stages when specified', () => {
      const data = {
        project: { name: 'test' },
        flow: { stages: ['synthesis', 'floorplan'] },
      };
      const mp = new MissionPack(data, null, tempDir);

      expect(mp.stages).toHaveLength(2);
      expect(mp.stages).toEqual(['synthesis', 'floorplan']);
    });

    it('should get tool configuration', () => {
      const data = {
        project: { name: 'test' },
        tools: {
          innovus: { version: '20.10', common_tcl: 'setDesignMode' },
        },
      };
      const mp = new MissionPack(data, null, tempDir);

      const config = mp.getToolConfig('innovus');
      expect(config.version).toBe('20.10');
      expect(config.common_tcl).toBe('setDesignMode');
    });

    it('should get stage-specific tool config', () => {
      const data = {
        project: { name: 'test' },
        tools: {
          innovus: {
            stage_tcl: {
              floorplan: 'floorPlan -s',
            },
          },
        },
      };
      const mp = new MissionPack(data, null, tempDir);

      const config = mp.getToolConfig('innovus', 'floorplan');
      expect(config.stageTcl).toBe('floorPlan -s');
    });

    it('should get target metrics', () => {
      const data = {
        project: { name: 'test' },
        flow: {
          targets: {
            timing: { wns: 0.0, tns: 0.0 },
            area: { max_utilization: 0.75 },
          },
        },
      };
      const mp = new MissionPack(data, null, tempDir);

      const targets = mp.getTargets();
      expect(targets.timing.wns).toBe(0.0);
      expect(targets.area.max_utilization).toBe(0.75);
    });

    it('should return summary with correct info', () => {
      const data = {
        project: { name: 'test_design' },
        design: {
          rtl: {
            top_module: 'top',
            files: ['rtl/a.v', 'rtl/b.v'],
          },
        },
      };
      const mp = new MissionPack(data, '/path/to/mission.yaml', tempDir);

      const summary = mp.getSummary();
      expect(summary.project).toBe('test_design');
      expect(summary.topModule).toBe('top');
      expect(summary.rtlFiles).toBe(2);
      expect(summary.source).toBe('/path/to/mission.yaml');
    });

    it('should export to JSON', () => {
      const data = { project: { name: 'test' } };
      const mp = new MissionPack(data, '/path/mission.yaml', tempDir);

      const json = mp.toJSON();
      expect(json.project.name).toBe('test');
      expect(json._meta.source).toBe('/path/mission.yaml');
      expect(json._meta.designDir).toBe(tempDir);
    });
  });

  describe('loadMissionPack', () => {
    it('should load mission pack from YAML file', () => {
      const yamlContent = `
project:
  name: test_design
  description: Test design for unit tests

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

      const mp = loadMissionPack(tempDir);

      expect(mp.projectName).toBe('test_design');
      expect(mp.topModule).toBe('top');
    });

    it('should load mission pack from JSON file', () => {
      const jsonContent = JSON.stringify({
        project: { name: 'json_design' },
        design: { rtl: { top_module: 'top', files: [] } },
      });
      writeFileSync(join(tempDir, 'hipilot-mission.json'), jsonContent);

      const mp = loadMissionPack(tempDir);

      expect(mp.projectName).toBe('json_design');
    });

    it('should create default mission pack when none exists', () => {
      const mp = loadMissionPack(tempDir);

      expect(mp.projectName).toBeDefined();
      expect(mp.stages).toBeDefined();
    });

    it('should check environment variable for mission pack path', () => {
      const customPath = join(tempDir, 'custom-mission.yaml');
      writeFileSync(customPath, 'project:\n  name: custom_design');

      const originalEnv = process.env.HIPILOT_MISSION_PACK;
      process.env.HIPILOT_MISSION_PACK = customPath;

      try {
        const mp = loadMissionPack('/nonexistent/path');
        expect(mp.projectName).toBe('custom_design');
      } finally {
        process.env.HIPILOT_MISSION_PACK = originalEnv;
      }
    });
  });

  describe('hasMissionPack', () => {
    it('should return true when mission pack exists', () => {
      writeFileSync(join(tempDir, 'hipilot-mission.yaml'), 'project:\n  name: test');
      expect(hasMissionPack(tempDir)).toBe(true);
    });

    it('should return false when no mission pack exists', () => {
      expect(hasMissionPack(tempDir)).toBe(false);
    });
  });

  describe('getMissionPackInfo', () => {
    it('should return info about existing mission pack', () => {
      writeFileSync(join(tempDir, 'hipilot-mission.yaml'), 'project:\n  name: test');
      const info = getMissionPackInfo(tempDir);

      expect(info.exists).toBe(true);
      expect(info.format).toBe('yaml');
    });

    it('should return exists:false when no mission pack', () => {
      const info = getMissionPackInfo(tempDir);
      expect(info.exists).toBe(false);
    });
  });

  describe('createDefaultMissionPack', () => {
    it('should create default mission pack', () => {
      const mp = createDefaultMissionPack(tempDir);

      expect(mp.projectName).toBeDefined();
      expect(mp.stages).toHaveLength(10);
      expect(mp.isValid()).toBe(true);
    });
  });
});

describe('mission-pack/validator.js', () => {
  describe('validateMissionPack', () => {
    it('should validate a complete mission pack', () => {
      const data = {
        project: { name: 'test', description: 'Test', version: '1.0.0' },
        design: {
          rtl: { top_module: 'top', files: ['rtl/top.v'] },
          libraries: { target: ['lib/tech.lib'], lef: ['lef/tech.tlef'] },
        },
        flow: { stages: ['synthesis', 'floorplan'] },
      };

      const result = validateMissionPack(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing project section', () => {
      const data = { design: {} };
      const result = validateMissionPack(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required section: project');
    });

    it('should report missing project.name', () => {
      const data = { project: { description: 'Test' } };
      const result = validateMissionPack(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('project.name is required');
    });

    it('should validate flow stages', () => {
      const data = {
        project: { name: 'test' },
        flow: { stages: ['synthesis', 'invalid_stage'] },
      };
      const result = validateMissionPack(data);

      const hasStageWarning = result.warnings.some(w =>
        w.toLowerCase().includes('invalid_stage')
      );
      expect(hasStageWarning).toBe(true);
    });

    it('should validate timing targets', () => {
      const data = {
        project: { name: 'test' },
        flow: {
          targets: {
            timing: { wns: 'invalid', tns: 0.0 },
          },
        },
      };
      const result = validateMissionPack(data);

      expect(result.errors).toContain('flow.targets.timing.wns must be a number');
    });

    it('should validate core_utilization range', () => {
      const data = {
        project: { name: 'test' },
        design: {
          floorplan: { core_utilization: 1.5 },
        },
      };
      const result = validateMissionPack(data);

      expect(result.errors).toContain(
        'design.floorplan.core_utilization must be a number between 0 and 1'
      );
    });

    it('should warn about missing libraries', () => {
      const data = {
        project: { name: 'test' },
        design: {},
      };
      const result = validateMissionPack(data);

      expect(result.errors).toContain('design.libraries is required (target libraries)');
    });

    it('should validate LEF order warning', () => {
      const data = {
        project: { name: 'test' },
        design: {
          libraries: {
            target: ['lib/tech.lib'],
            lef: ['cells.lef', 'tech.tlef'],
          },
        },
      };
      const result = validateMissionPack(data);

      // Should have a warning about LEF order
      const hasLefWarning = result.warnings.some(w =>
        w.toLowerCase().includes('lef') && w.toLowerCase().includes('first')
      );
      expect(hasLefWarning).toBe(true);
    });
  });

  describe('VALID_STAGES constant', () => {
    it('should contain all valid flow stages', () => {
      expect(VALID_STAGES).toContain('synthesis');
      expect(VALID_STAGES).toContain('floorplan');
      expect(VALID_STAGES).toContain('placement');
      expect(VALID_STAGES).toContain('cts');
      expect(VALID_STAGES).toContain('routing');
      expect(VALID_STAGES).toContain('chip_finish');
    });
  });
});

describe('mission-pack/auto-detect.js', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = join(tmpdir(), `hipilot-autodetect-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('canAutoDetect', () => {
    it('should detect RTL directory', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), 'module top; endmodule');

      const result = canAutoDetect(tempDir);
      expect(result.hasRtl).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(30);
    });

    it('should detect library directory', () => {
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');

      const result = canAutoDetect(tempDir);
      expect(result.hasLibs).toBe(true);
    });

    it('should detect constraints directory', () => {
      mkdirSync(join(tempDir, 'constraints'), { recursive: true });
      writeFileSync(join(tempDir, 'constraints', 'top.sdc'), '');

      const result = canAutoDetect(tempDir);
      expect(result.hasConstraints).toBe(true);
    });

    it('should return high confidence for complete design', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      mkdirSync(join(tempDir, 'constraints'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), '');
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');
      writeFileSync(join(tempDir, 'constraints', 'top.sdc'), '');

      const result = canAutoDetect(tempDir);
      expect(result.canDetect).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    });
  });

  describe('autoDetectMissionPack', () => {
    it('should detect RTL files', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), 'module top; endmodule');
      writeFileSync(join(tempDir, 'rtl', 'module.v'), 'module mod; endmodule');
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');

      const result = autoDetectMissionPack(tempDir);

      expect(result.design.rtl.files).toHaveLength(2);
      expect(result.design.rtl.files).toContain('rtl/top.v');
    });

    it('should detect library files with priority', () => {
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');
      writeFileSync(join(tempDir, 'lib', 'tech_ff.lib'), '');
      mkdirSync(join(tempDir, 'lef'), { recursive: true });
      writeFileSync(join(tempDir, 'lef', 'tech.tlef'), '');

      const result = autoDetectMissionPack(tempDir);

      expect(result.design.libraries.target).toContain('lib/tech_ff.lib');
      expect(result.design.libraries.lef[0]).toBe('lef/tech.tlef');
    });

    it('should detect SDC files', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), '');
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');
      mkdirSync(join(tempDir, 'constraints'), { recursive: true });
      writeFileSync(join(tempDir, 'constraints', 'top.sdc'), '');

      const result = autoDetectMissionPack(tempDir);

      expect(result.design.constraints.sdc).toContain('constraints/top.sdc');
    });

    it('should detect top module from SDC', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), '');
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');
      mkdirSync(join(tempDir, 'constraints'), { recursive: true });
      writeFileSync(join(tempDir, 'constraints', 'top.sdc'), 'current_design my_top_module');

      const result = autoDetectMissionPack(tempDir);

      expect(result.design.rtl.top_module).toBe('my_top_module');
    });

    it('should detect technology from library names', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), '');
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'sky130_ff.lib'), '');
      mkdirSync(join(tempDir, 'lef'), { recursive: true });
      writeFileSync(join(tempDir, 'lef', 'sky130.lef'), '');

      const result = autoDetectMissionPack(tempDir);

      expect(result.technology.foundry).toBe('skywater');
      expect(result.technology.process).toBe('sky130');
    });

    it('should create valid mission pack structure', () => {
      mkdirSync(join(tempDir, 'rtl'), { recursive: true });
      writeFileSync(join(tempDir, 'rtl', 'top.v'), '');
      mkdirSync(join(tempDir, 'lib'), { recursive: true });
      writeFileSync(join(tempDir, 'lib', 'tech.lib'), '');

      const result = autoDetectMissionPack(tempDir);

      expect(result.project.name).toBeDefined();
      expect(result.project.version).toBeDefined();
      expect(result.flow.stages).toBeDefined();
      expect(result.flow.stages).toHaveLength(10);
    });
  });
});
