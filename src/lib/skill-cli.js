/**
 * HiPilot Skill CLI - Interactive Skill Generation
 *
 * Provides an interactive CLI workflow for generating skills from
 * text sources (emails, wiki posts, runbooks).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import boxen from 'boxen';
import { generateSkill, validateSkill } from './skill-generator.js';
import { info, error } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

const colors = {
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  red: '#ff5555',
  purple: '#bd93f9',
};

/**
 * Display header for skill generation workflow
 */
function showHeader() {
  const text = chalk.bold.white('HiPilot Skill Generator') + '\n' + chalk.dim('Turn documentation into reusable skills');
  console.log(boxen(text, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: 'cyan',
  }));
}

/**
 * Get the skills directory path (project-level .hipilot/skills)
 */
function getSkillsDir() {
  // Use project-level .hipilot/skills directory
  const skillsDir = join(PROJECT_ROOT, '.hipilot', 'skills');
  return skillsDir;
}

/**
 * Ensure the skills directory exists
 */
function ensureSkillsDir() {
  const skillsDir = getSkillsDir();
  if (!existsSync(skillsDir)) {
    try {
      mkdirSync(skillsDir, { recursive: true });
      info('Created skills directory', { path: skillsDir });
    } catch (err) {
      error('Failed to create skills directory', { error: err.message });
      throw new Error(`Cannot create skills directory: ${skillsDir}`);
    }
  }
  return skillsDir;
}

/**
 * Prompt user for input (using stdin/stdout)
 * Returns a Promise that resolves with the user's input
 */
function prompt(question, defaultValue = '') {
  return new Promise((resolve) => {
    const display = defaultValue
      ? `${question} ${chalk.dim(`(${defaultValue})`)}: `
      : `${question}: `;
    process.stdout.write(chalk.hex(colors.cyan)(display));

    let input = '';
    const onData = (data) => {
      const str = data.toString();
      // Handle Ctrl+C
      if (str === '\u0003') {
        process.exit(0);
      }
      // Handle Enter
      if (str === '\n' || str === '\r\n') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        const result = input.trim() || defaultValue;
        resolve(result);
        return;
      }
      // Handle backspace
      if (str === '\u007f') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      // Regular character
      input += str;
      process.stdout.write(str);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
  });
}

/**
 * Prompt for multi-line input (source text)
 * User ends input with a line containing only "EOF" or Ctrl+D
 */
function promptMultiline(question) {
  return new Promise((resolve) => {
    console.log(chalk.hex(colors.cyan)(question));
    console.log(chalk.dim('  (Enter your text. Type "EOF" on a new line or press Ctrl+D when done)'));
    console.log('');

    const lines = [];
    const onData = (data) => {
      const str = data.toString();

      // Handle Ctrl+D (EOF) or Ctrl+C
      if (str === '\u0004') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        console.log('');
        resolve(lines.join('\n'));
        return;
      }
      if (str === '\u0003') {
        process.exit(0);
      }

      // Handle line input
      if (str === '\n' || str === '\r\n') {
        const currentLine = lines.length > 0 ? lines[lines.length - 1] : '';
        if (currentLine.trim().toUpperCase() === 'EOF') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          lines.pop(); // Remove the EOF line
          console.log('');
          resolve(lines.join('\n'));
          return;
        }
        lines.push('');
        process.stdout.write('\n');
      } else if (str === '\u007f') {
        // Backspace
        if (lines.length > 0) {
          const lastIdx = lines.length - 1;
          if (lines[lastIdx].length > 0) {
            lines[lastIdx] = lines[lastIdx].slice(0, -1);
            process.stdout.write('\b \b');
          } else if (lines.length > 1) {
            lines.pop();
            process.stdout.write('\b \b');
          }
        }
      } else {
        if (lines.length === 0) lines.push('');
        lines[lines.length - 1] += str;
        process.stdout.write(str);
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
  });
}

/**
 * Display a preview of the generated skill
 */
function showPreview(skillContent, metadata) {
  console.log('');
  console.log(boxen(
    chalk.bold('Generated Skill Preview'),
    { padding: { left: 1, right: 1 }, borderStyle: 'single', borderColor: 'yellow' }
  ));
  console.log('');

  // Show metadata
  console.log(chalk.hex(colors.cyan)('Metadata:'));
  console.log(`  ${chalk.dim('Title:')}    ${metadata.title}`);
  console.log(`  ${chalk.dim('Triggers:')}  ${metadata.triggers.join(', ')}`);
  console.log(`  ${chalk.dim('Vendors:')}   ${metadata.vendors.join(', ')}`);
  console.log(`  ${chalk.dim('Stage:')}     ${metadata.flowStage}`);
  console.log(`  ${chalk.dim('Steps:')}     ${metadata.stepCount}`);
  console.log(`  ${chalk.dim('Params:')}    ${metadata.parameterCount}`);
  console.log('');

  // Show skill content preview (first 30 lines)
  const lines = skillContent.split('\n');
  const previewLines = lines.slice(0, 30);
  console.log(chalk.hex(colors.cyan)('Content Preview:'));
  console.log(chalk.dim('─'.repeat(60)));
  console.log(previewLines.join('\n'));
  if (lines.length > 30) {
    console.log(chalk.dim(`... (${lines.length - 30} more lines)`));
  }
  console.log(chalk.dim('─'.repeat(60)));
  console.log('');
}

/**
 * Validate and save the skill file
 */
function saveSkill(skillContent, filename) {
  const skillsDir = ensureSkillsDir();
  const filePath = join(skillsDir, filename);

  // Validate before saving
  const validation = validateSkill(skillContent);
  if (!validation.valid) {
    console.log(chalk.hex(colors.red)('Validation Issues:'));
    for (const issue of validation.issues) {
      console.log(`  ${chalk.hex(colors.yellow)('⚠')} ${issue}`);
    }
    console.log('');
    return { success: false, issues: validation.issues };
  }

  // Check if file already exists
  if (existsSync(filePath)) {
    return { success: false, exists: true, path: filePath };
  }

  // Save the file
  try {
    writeFileSync(filePath, skillContent, 'utf-8');
    info('Skill saved', { path: filePath });
    return { success: true, path: filePath };
  } catch (err) {
    error('Failed to save skill', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Main skill generation workflow
 */
export async function runSkillGenerationWorkflow() {
  showHeader();

  // Step 1: Prompt for source text
  console.log(chalk.bold('Step 1: Source Text'));
  console.log(chalk.dim('Paste your documentation (email, wiki post, runbook, etc.)'));
  console.log('');

  const sourceText = await promptMultiline('Enter source text:');

  if (!sourceText.trim()) {
    console.log(chalk.hex(colors.red)('No text provided. Exiting.'));
    return { success: false, reason: 'no_input' };
  }

  console.log(chalk.hex(colors.green)(`✓ Received ${sourceText.length} characters`));
  console.log('');

  // Step 2: Generate skill
  console.log(chalk.bold('Step 2: Generating Skill...'));
  const result = generateSkill(sourceText, 'cli-input');

  if (!result.success) {
    console.log(chalk.hex(colors.red)(`Generation failed: ${result.error}`));
    return { success: false, reason: 'generation_failed', error: result.error };
  }

  console.log(chalk.hex(colors.green)('✓ Skill generated successfully'));
  console.log('');

  // Step 3: Show preview
  showPreview(result.skill, result.metadata);

  // Step 4: Confirm save
  console.log(chalk.bold('Step 3: Save Skill'));
  const defaultFilename = `${result.metadata.title.toLowerCase().replace(/[^\w]+/g, '-')}.md`;
  const filename = await prompt('Filename', defaultFilename);

  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  const confirm = await prompt(`Save to .hipilot/skills/${filename}? (y/n)`, 'y');

  if (confirm.toLowerCase() !== 'y') {
    console.log(chalk.hex(colors.yellow)('Save cancelled.'));

    // Option to copy to clipboard or display full content
    const showFull = await prompt('Show full skill content? (y/n)', 'n');
    if (showFull.toLowerCase() === 'y') {
      console.log('');
      console.log(chalk.dim('═'.repeat(60)));
      console.log(result.skill);
      console.log(chalk.dim('═'.repeat(60)));
    }

    return { success: false, reason: 'user_cancelled' };
  }

  // Step 5: Save
  const saveResult = saveSkill(result.skill, filename);

  if (saveResult.success) {
    console.log('');
    console.log(boxen(
      chalk.hex(colors.green)('✓ Skill saved successfully!') + '\n\n' +
      chalk.dim('Location: ') + saveResult.path.replace(PROJECT_ROOT, '.') + '\n' +
      chalk.dim('Use in Claude Code: ') + `"use the ${result.metadata.title} skill"`,
      { padding: 1, borderStyle: 'round', borderColor: 'green' }
    ));
    console.log('');

    return {
      success: true,
      path: saveResult.path,
      metadata: result.metadata,
    };
  }

  if (saveResult.exists) {
    console.log(chalk.hex(colors.yellow)(`File already exists: ${saveResult.path}`));
    const overwrite = await prompt('Overwrite? (y/n)', 'n');

    if (overwrite.toLowerCase() === 'y') {
      try {
        writeFileSync(saveResult.path, result.skill, 'utf-8');
        console.log(chalk.hex(colors.green)('✓ Skill overwritten successfully!'));
        return {
          success: true,
          path: saveResult.path,
          metadata: result.metadata,
        };
      } catch (err) {
        console.log(chalk.hex(colors.red)(`Failed to save: ${err.message}`));
        return { success: false, reason: 'save_failed', error: err.message };
      }
    } else {
      console.log(chalk.hex(colors.yellow)('Save cancelled.'));
      return { success: false, reason: 'user_cancelled' };
    }
  }

  console.log(chalk.hex(colors.red)(`Failed to save: ${saveResult.error || saveResult.issues?.join(', ')}`));
  return { success: false, reason: 'save_failed', error: saveResult.error };
}

/**
 * Quick skill generation (non-interactive)
 * Used for piping input or automated generation
 */
export async function quickGenerate(sourceText, options = {}) {
  const result = generateSkill(sourceText, options.sourceName || 'quick-gen');

  if (!result.success) {
    return result;
  }

  if (options.previewOnly) {
    return result;
  }

  const skillsDir = ensureSkillsDir();
  const filename = options.filename || `${result.metadata.title.toLowerCase().replace(/[^\w]+/g, '-')}.md`;
  const filePath = join(skillsDir, filename);

  // Check for existing file
  if (existsSync(filePath) && !options.force) {
    return {
      success: false,
      error: 'file_exists',
      path: filePath,
      skill: result.skill,
    };
  }

  try {
    writeFileSync(filePath, result.skill, 'utf-8');
    return {
      success: true,
      path: filePath,
      metadata: result.metadata,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Validate a skill file at given path
 */
export function validateSkillFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return validateSkill(content);
  } catch (err) {
    return {
      valid: false,
      issues: [`Failed to read file: ${err.message}`],
    };
  }
}

/**
 * List all generated skills in the skills directory
 */
export function listGeneratedSkills() {
  const skillsDir = getSkillsDir();

  if (!existsSync(skillsDir)) {
    return [];
  }

  const files = readdirSync(skillsDir).filter(f => f.endsWith('.md'));

  return files.map(f => {
    const content = readFileSync(join(skillsDir, f), 'utf-8');
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);
    return {
      file: f,
      name: nameMatch ? nameMatch[1].trim() : f.replace('.md', ''),
      description: descMatch ? descMatch[1].trim() : '',
    };
  });
}

export default {
  runSkillGenerationWorkflow,
  quickGenerate,
  validateSkillFile,
  listGeneratedSkills,
};
