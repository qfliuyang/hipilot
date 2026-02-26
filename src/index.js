#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const command = process.argv[2];

if (command === 'setup') {
  try {
    execSync('bash bin/setup.sh', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
} else if (command === 'skill-gen') {
  const { runSkillGenerationWorkflow, quickGenerate } = await import('./lib/skill-cli.js');
  const isPiped = !process.stdin.isTTY;

  if (isPiped) {
    let sourceText = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { sourceText += chunk; });
    process.stdin.on('end', async () => {
      const isPreview = process.argv.includes('--preview');
      const result = await quickGenerate(sourceText, {
        sourceName: 'piped-input',
        previewOnly: isPreview,
        force: process.argv.includes('--force'),
      });
      if (result.success) {
        if (isPreview) {
          console.log('Generated Skill Preview:');
          console.log('─'.repeat(60));
          console.log(result.skill);
          console.log('─'.repeat(60));
        } else {
          console.log(`✓ Skill generated: ${result.path}`);
        }
      } else {
        console.error('Failed:', result.error);
        process.exit(1);
      }
    });
  } else {
    try {
      await runSkillGenerationWorkflow();
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  }
} else if (command === 'status' || command === 'skills' || command === 'templates'
  || command === 'quick' || command === 'help' || command === '--help' || command === '-h'
  || command === 'version' || command === '--version' || command === '-v') {
  import('./cli.js');
} else {
  // Default: launch the tmux workspace (left=Claude Code, right=terminal)
  try {
    execSync('bash bin/hipilot', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}
