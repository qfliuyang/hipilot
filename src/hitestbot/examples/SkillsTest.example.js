#!/usr/bin/env node
/**
 * Example: Skills Validation Test
 *
 * Demonstrates how to extend TestRunner for custom test scenarios.
 * This test validates that all HiPilot skills have valid templates.
 */

import { TestRunner, TestUtils } from '../index.js';
import fs from 'fs';
import path from 'path';

class SkillsTestRunner extends TestRunner {
  constructor(options = {}) {
    super({
      testName: 'Skills Validation Test',
      ...options
    });
    this.skillsDir = options.skillsDir || './skills';
    this.results = [];
  }

  async execute() {
    await this.step('Discover Skills', () => this.discoverSkills());
    await this.step('Validate YAML Frontmatter', () => this.validateFrontmatter());
    await this.step('Check Template Files', () => this.checkTemplates());
    await this.step('Generate Summary', () => this.generateSummary());
    await this.generateReport();
  }

  async discoverSkills() {
    const skillsDir = path.join(this.localDir, this.skillsDir);

    if (!fs.existsSync(skillsDir)) {
      throw new Error(`Skills directory not found: ${skillsDir}`);
    }

    const files = fs.readdirSync(skillsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f.replace('.md', ''),
        path: path.join(skillsDir, f)
      }));

    TestUtils.assert(files.length > 0, `No skill files found in ${skillsDir}`);

    this.results = files.map(f => ({ ...f, valid: true, errors: [] }));
    return `Found ${files.length} skills`;
  }

  async validateFrontmatter() {
    let validCount = 0;

    for (const skill of this.results) {
      const content = fs.readFileSync(skill.path, 'utf8');

      // Check for YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        skill.valid = false;
        skill.errors.push('Missing YAML frontmatter');
        continue;
      }

      const frontmatter = frontmatterMatch[1];

      // Check required fields
      const requiredFields = ['name', 'description'];
      for (const field of requiredFields) {
        if (!frontmatter.includes(`${field}:`)) {
          skill.valid = false;
          skill.errors.push(`Missing required field: ${field}`);
        }
      }

      if (skill.valid) validCount++;
    }

    return `${validCount}/${this.results.length} skills have valid frontmatter`;
  }

  async checkTemplates() {
    let withTemplates = 0;

    for (const skill of this.results) {
      const content = fs.readFileSync(skill.path, 'utf8');

      // Check for template reference
      const hasTemplate = content.includes('template:') ||
                         content.includes('```tcl') ||
                         content.includes('.tcl.j2');

      if (hasTemplate) {
        withTemplates++;
        skill.hasTemplate = true;
      } else {
        skill.hasTemplate = false;
      }
    }

    return `${withTemplates}/${this.results.length} skills have templates`;
  }

  async generateSummary() {
    const valid = this.results.filter(s => s.valid);
    const invalid = this.results.filter(s => !s.valid);

    console.log('\n   Skills Summary:');
    console.log(`   - Total: ${this.results.length}`);
    console.log(`   - Valid: ${valid.length}`);
    console.log(`   - Invalid: ${invalid.length}`);

    if (invalid.length > 0) {
      console.log('\n   Invalid skills:');
      for (const skill of invalid) {
        console.log(`   - ${skill.name}: ${skill.errors.join(', ')}`);
      }
    }

    TestUtils.assertEquals(invalid.length, 0, `${invalid.length} skills have validation errors`);

    return `All ${valid.length} skills valid`;
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SkillsTestRunner({
    skillsDir: process.argv[2] || './skills'
  });

  runner.run().catch(err => {
    console.error('Skills test failed:', err.message);
    process.exit(1);
  });
}

export { SkillsTestRunner };
