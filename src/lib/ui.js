import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';

export const colors = {
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  red: '#ff5555',
  blue: '#6272a4',
  dim: '#44475a',
};

export const icons = {
  run: '▶',
  edit: '✎',
  save: '💾',
  docs: '📖',
  template: '✓',
  doc: '📖',
  warning: '⚠',
  success: '✓',
  fail: '✗',
  working: '🔄',
  report: '📊',
  chip: '🔲',
  bullet: '•',
};

export function showHeader(title) {
  const headerText = chalk.bold.white('HiPilot v0.1.0 - VLSI PD Copilot');
  const box = boxen(headerText, {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'cyan',
    title: 'HiPilot',
    titleAlignment: 'center',
  });
  console.log(box);
  console.log('');
  console.log(chalk.bold(title));
  console.log('');
}

export function showSection(title) {
  console.log('');
  console.log(chalk.cyan('╶─ ' + title + ' ╴'));
  console.log('');
}

export function showTclBlock(title, code, trust = 'unverified') {
  const badges = {
    template: chalk.green('[✓ Template]'),
    doc: chalk.blue('[📖 Doc-based]'),
    unverified: chalk.yellow('[⚠ Unverified]'),
  };

  console.log('');
  console.log(badges[trust] || badges.unverified);
  
  const box = boxen(code, {
    title: title,
    titleAlignment: 'left',
    borderStyle: 'classic',
    borderColor: 'blue',
    padding: 1,
  });
  console.log(box);
  console.log('');
}

export function showMetrics(title, metrics) {
  const table = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    colWidths: [25, 20],
  });

  for (const [key, value] of Object.entries(metrics)) {
    table.push([key, String(value)]);
  }

  console.log('');
  console.log(chalk.bold.cyan(title));
  console.log(table.toString());
  console.log('');
}

export function showActions(actions) {
  console.log('');
  console.log(chalk.dim('Actions:'));
  actions.forEach(({key, label}) => {
    console.log(`  [${chalk.cyan(key)}] ${label}`);
  });
  console.log('');
}

export function showReportAnalysis(analysis) {
  console.log('');
  console.log(`  📊 ${chalk.bold(analysis.type)} Analysis`);

  if (analysis.summary) {
    console.log(`  ${analysis.summary}`);
  }

  if (analysis.issues && analysis.issues.length > 0) {
    console.log(`  ${chalk.yellow('Issues:')} ${analysis.issues.length}`);
    analysis.issues.forEach(issue => {
      console.log(`    • ${issue}`);
    });
  }

  if (analysis.suggestion) {
    console.log(`  ${chalk.green('✓ Suggestion:')} ${analysis.suggestion}`);
  }
  console.log('');
}

export function showSuccess(message) {
  console.log(`${icons.success} ${chalk.green(message)}`);
}

export function showError(message) {
  console.log(`${icons.fail} ${chalk.red(message)}`);
}

export function showInfo(message) {
  console.log(`${icons.bullet} ${chalk.blue(message)}`);
}

export function showWorking(message) {
  console.log(`${icons.working} ${chalk.yellow(message)}`);
}
