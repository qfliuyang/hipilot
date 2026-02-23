#!/usr/bin/env node
import React from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import {
  BigBanner, AnimatedHeader, StatusCard, StatusGrid,
  QuickStartCard, CommandPalette, McpToolsCard, LiveClock, Footer,
  Header, StatusItem, QuickStart, QuickCommands, Divider,
  Section, MetricsTable, TclBlock, LoadingSpinner, ActivityFeed,
  COLORS, ICONS, STATUS_ICONS
} from './tui/index.js';
import {
  existsSync, readdirSync, readFileSync, writeFileSync
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { VERSION } from './lib/version.js';
import {
  runSkillGenerationWorkflow, quickGenerate
} from './lib/skill-cli.js';
import {
  listQuickCommands, getCommandHelp
} from './lib/quick-commands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

function checkMcpRegistered() {
  const settingsPath = join(PROJECT_ROOT, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return { registered: false, path: settingsPath };
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const servers = Object.keys(settings.mcpServers || {});
    return { registered: servers.length > 0, servers, path: settingsPath };
  } catch {
    return { registered: false, path: settingsPath };
  }
}

function checkSkills() {
  const skillsDir = join(PROJECT_ROOT, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = readFileSync(join(skillsDir, f), 'utf-8');
      if (content.trim().length === 0) return null;
      const nameMatch = content.match(/name:\s*(.*)/);
      const descMatch = content.match(/description:\s*(.*)/);
      return {
        file: f,
        name: nameMatch ? nameMatch[1].trim() : f.replace('.md', ''),
        description: descMatch ? descMatch[1].trim() : '',
      };
    })
    .filter(Boolean);
}

function checkTemplates() {
  const templatesDir = join(PROJECT_ROOT, 'templates');
  if (!existsSync(templatesDir)) return [];
  const templates = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) { walk(fullPath); }
      else if (entry.name.endsWith('.tcl') && entry.name !== '.gitkeep') {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.trim().length > 0) {
            templates.push({
              path: fullPath.replace(templatesDir + '/', ''),
              vendor: fullPath.includes('synopsys') ? 'Synopsys' :
                      fullPath.includes('cadence') ? 'Cadence' : 'Generic'
            });
          }
        } catch { }
      }
    }
  };
  walk(templatesDir);
  return templates;
}

function checkDeps() {
  return existsSync(join(PROJECT_ROOT, 'node_modules'));
}

function detectEdaTool() {
  try { execSync('pgrep -f icc2_shell', { stdio: 'pipe' }); return 'ICC2'; } catch { }
  try { execSync('pgrep -f innovus', { stdio: 'pipe' }); return 'Innovus'; } catch { }
  try { execSync('pgrep -f pt_shell', { stdio: 'pipe' }); return 'PrimeTime'; } catch { }
  return null;
}

function checkSlashCommands() {
  const cmdDir = join(PROJECT_ROOT, '.claude', 'commands');
  if (!existsSync(cmdDir)) return [];
  return readdirSync(cmdDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}

function checkCommandRef() {
  const cmdRefPath = join(PROJECT_ROOT, 'data', 'command-reference.json');
  if (!existsSync(cmdRefPath)) return 0;
  try {
    const ref = JSON.parse(readFileSync(cmdRefPath, 'utf-8'));
    return ref.commands ? ref.commands.length : 0;
  } catch { return 0; }
}

function StatusApp() {
  const depsOk = checkDeps();
  const mcp = checkMcpRegistered();
  const skills = checkSkills();
  const templates = checkTemplates();
  const slashCmds = checkSlashCommands();
  const cmdCount = checkCommandRef();
  const edaTool = detectEdaTool();

  const statusItems = [
    { 
      icon: depsOk ? ICONS.ok : ICONS.no, 
      label: 'Dependencies', 
      value: depsOk ? 'installed' : 'not installed', 
      status: depsOk ? 'ok' : 'no' 
    },
    { 
      icon: mcp.registered ? ICONS.ok : ICONS.no, 
      label: 'MCP Servers', 
      value: mcp.registered ? mcp.servers.join(', ') : 'not registered', 
      status: mcp.registered ? 'ok' : 'no' 
    },
    { 
      icon: skills.length > 0 ? ICONS.ok : ICONS.warn, 
      label: 'Skills', 
      value: `${skills.length} loaded`, 
      status: skills.length > 0 ? 'ok' : 'warn' 
    },
    { 
      icon: templates.length > 0 ? ICONS.ok : ICONS.warn, 
      label: 'Templates', 
      value: `${templates.length} available`, 
      status: templates.length > 0 ? 'ok' : 'warn' 
    },
    { 
      icon: cmdCount > 0 ? ICONS.ok : ICONS.warn, 
      label: 'Command Ref', 
      value: `${cmdCount} commands`, 
      status: cmdCount > 0 ? 'ok' : 'warn' 
    },
    { 
      icon: slashCmds.length > 0 ? ICONS.ok : ICONS.warn, 
      label: 'Quick Commands', 
      value: `${slashCmds.length} available`, 
      status: slashCmds.length > 0 ? 'ok' : 'warn' 
    },
    { 
      icon: edaTool ? ICONS.running : ICONS.pending, 
      label: 'EDA Tool', 
      value: edaTool || 'none detected', 
      status: edaTool ? 'running' : 'pending' 
    },
    { 
      icon: ICONS.chip, 
      label: 'Environment', 
      value: process.env.HOSTNAME || 'local', 
      status: 'ok',
      accent: COLORS.purple
    },
  ];

  return React.createElement(Box, { flexDirection: 'column', padding: 0 },
    React.createElement(BigBanner, { version: VERSION }),
    React.createElement(Divider, null),
    
    React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 
        `${ICONS.gear} System Status`
      ),
      React.createElement(Text, null, '')
    ),
    
    React.createElement(StatusGrid, { items: statusItems }),
    
    React.createElement(Divider, null),
    
    !depsOk && React.createElement(Box, { paddingX: 2, marginBottom: 1 },
      React.createElement(Text, { color: COLORS.yellow },
        `  ${ICONS.warn} Run "hipilot setup" to install dependencies`)
    ),
    !mcp.registered && React.createElement(Box, { paddingX: 2, marginBottom: 1 },
      React.createElement(Text, { color: COLORS.yellow },
        `  ${ICONS.warn} Run "hipilot setup" to register MCP servers`)
    ),
    
    depsOk && mcp.registered && React.createElement(React.Fragment, null,
      React.createElement(QuickStartCard, null),
      React.createElement(Box, { marginTop: 1 }),
      React.createElement(McpToolsCard, null),
      React.createElement(Divider, null),
      React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
        React.createElement(Text, { bold: true, color: COLORS.cyan }, 
          `${ICONS.bolt} Quick Commands`
        )
      ),
      React.createElement(CommandPalette, null)
    ),
    
    React.createElement(Footer, null)
  );
}

function SkillsApp() {
  const skills = checkSkills();

  return React.createElement(Box, { flexDirection: 'column', padding: 0 },
    React.createElement(BigBanner, { version: VERSION }),
    React.createElement(Divider, null),
    
    React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 
        `${ICONS.star} Skills (${skills.length})`
      ),
      React.createElement(Text, null, '')
    ),
    
    skills.length === 0
      ? React.createElement(Box, { 
          paddingX: 2, 
          borderStyle: 'round', 
          borderColor: COLORS.yellow,
          marginX: 2,
          paddingY: 1,
        },
          React.createElement(Text, { color: COLORS.yellow },
            `${ICONS.warn} No skills found. Add skills to skills/*.md`)
        )
      : React.createElement(Box, { 
          flexDirection: 'column', 
          paddingX: 2,
          borderStyle: 'round',
          borderColor: COLORS.purple,
          marginX: 2,
          paddingY: 1,
        },
          ...skills.map((skill, i) =>
            React.createElement(Box, { 
              key: i, 
              marginBottom: 1,
              borderStyle: 'single',
              borderColor: COLORS.purple,
              paddingX: 1,
            },
              React.createElement(Text, { color: COLORS.purple, bold: true },
                `${ICONS.chip} ${skill.name.padEnd(20)}`
              ),
              React.createElement(Text, { color: COLORS.gray },
                skill.description
              )
            )
          )
        ),
    
    React.createElement(Divider, null),
    React.createElement(Footer, null)
  );
}

function TemplatesApp() {
  const templates = checkTemplates();

  return React.createElement(Box, { flexDirection: 'column', padding: 0 },
    React.createElement(BigBanner, { version: VERSION }),
    React.createElement(Divider, null),
    
    React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 
        `${ICONS.gear} Tcl Templates (${templates.length})`
      ),
      React.createElement(Text, null, '')
    ),
    
    templates.length === 0
      ? React.createElement(Box, { 
          paddingX: 2,
          borderStyle: 'round',
          borderColor: COLORS.yellow,
          marginX: 2,
          paddingY: 1,
        },
          React.createElement(Text, { color: COLORS.yellow },
            `${ICONS.warn} No templates found. Add templates to templates/**/*.tcl`)
        )
      : React.createElement(Box, { 
          flexDirection: 'column', 
          paddingX: 2,
          borderStyle: 'round',
          borderColor: COLORS.cyan,
          marginX: 2,
          paddingY: 1,
        },
          ...templates.map((t, i) =>
            React.createElement(Box, { 
              key: i,
              borderStyle: 'single',
              borderColor: t.vendor === 'Synopsys' ? COLORS.cyan :
                           t.vendor === 'Cadence' ? COLORS.green : COLORS.gray,
              paddingX: 1,
              marginY: 0,
            },
              React.createElement(Text, {
                color: t.vendor === 'Synopsys' ? COLORS.cyan :
                       t.vendor === 'Cadence' ? COLORS.green : COLORS.gray,
                bold: true
              }, `[${t.vendor.padEnd(8)}]`),
              React.createElement(Text, { color: COLORS.white }, ` ${t.path}`)
            )
          )
        ),
    
    React.createElement(Divider, null),
    React.createElement(Footer, null)
  );
}

function QuickCommandsApp() {
  const commands = listQuickCommands();

  return React.createElement(Box, { flexDirection: 'column', padding: 0 },
    React.createElement(BigBanner, { version: VERSION }),
    React.createElement(Divider, null),
    
    React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 
        `${ICONS.bolt} Quick Commands (${commands.length})`
      ),
      React.createElement(Text, null, '')
    ),
    
    React.createElement(Box, { 
      flexDirection: 'column', 
      paddingX: 2,
      borderStyle: 'round',
      borderColor: COLORS.purple,
      marginX: 2,
      paddingY: 1,
    },
      ...commands.map((cmd, i) =>
        React.createElement(Box, { 
          key: i, 
          flexDirection: 'column', 
          marginBottom: 1,
          borderStyle: 'single',
          borderColor: COLORS.purple,
          paddingX: 1,
        },
          React.createElement(Box, null,
            React.createElement(Text, { color: COLORS.purple, bold: true }, 
              `${ICONS.arrow} /${cmd.name}`
            ),
            cmd.hasArgument && React.createElement(Text, { color: COLORS.gray }, ` [${cmd.argumentName}]`)
          ),
          React.createElement(Box, { paddingLeft: 2 },
            React.createElement(Text, { color: COLORS.gray }, cmd.description)
          ),
          React.createElement(Box, { paddingLeft: 2 },
            React.createElement(Text, { color: COLORS.gray, dimColor: true }, `Usage: ${cmd.usage}`)
          )
        )
      )
    ),
    
    React.createElement(Divider, null),
    React.createElement(Footer, null)
  );
}

function HelpApp() {
  return React.createElement(Box, { flexDirection: 'column', padding: 0 },
    React.createElement(BigBanner, { version: VERSION }),
    React.createElement(Divider, null),
    
    React.createElement(Box, { 
      flexDirection: 'column', 
      paddingX: 2,
      borderStyle: 'double',
      borderColor: COLORS.cyan,
      marginX: 2,
      paddingY: 1,
    },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 
        `${ICONS.gear} CLI Commands`
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { color: COLORS.green }, '  hipilot              '),
      React.createElement(Text, { color: COLORS.gray }, 'Show status'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot setup        '),
      React.createElement(Text, { color: COLORS.gray }, 'Install dependencies'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot workspace    '),
      React.createElement(Text, { color: COLORS.gray }, 'Launch tmux workspace'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot skills       '),
      React.createElement(Text, { color: COLORS.gray }, 'List skills'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot templates    '),
      React.createElement(Text, { color: COLORS.gray }, 'List Tcl templates'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot quick        '),
      React.createElement(Text, { color: COLORS.gray }, 'List quick commands'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot skill-gen    '),
      React.createElement(Text, { color: COLORS.gray }, 'Generate skill'),
      React.createElement(Text, { color: COLORS.green }, '  hipilot version      '),
      React.createElement(Text, { color: COLORS.gray }, 'Show version'),
    ),
    
    React.createElement(Box, { 
      flexDirection: 'column', 
      paddingX: 2,
      borderStyle: 'round',
      borderColor: COLORS.purple,
      marginX: 2,
      paddingY: 1,
      marginTop: 1,
    },
      React.createElement(Text, { bold: true, color: COLORS.purple }, 
        `${ICONS.bolt} Quick Commands (in Claude Code)`
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { color: COLORS.green }, '  /timing [group]      '),
      React.createElement(Text, { color: COLORS.gray }, 'Run timing analysis'),
      React.createElement(Text, { color: COLORS.green }, '  /drc                 '),
      React.createElement(Text, { color: COLORS.gray }, 'Check design rules'),
      React.createElement(Text, { color: COLORS.green }, '  /power               '),
      React.createElement(Text, { color: COLORS.gray }, 'Power analysis'),
      React.createElement(Text, { color: COLORS.green }, '  /area                '),
      React.createElement(Text, { color: COLORS.gray }, 'Area/utilization'),
      React.createElement(Text, { color: COLORS.green }, '  /compare [base]      '),
      React.createElement(Text, { color: COLORS.gray }, 'Compare QoR'),
      React.createElement(Text, { color: COLORS.green }, '  /history             '),
      React.createElement(Text, { color: COLORS.gray }, 'Show command history'),
      React.createElement(Text, { color: COLORS.green }, '  /fix-setup [group]   '),
      React.createElement(Text, { color: COLORS.gray }, 'One-command timing fix'),
      React.createElement(Text, { color: COLORS.green }, '  /fix-hold [group]    '),
      React.createElement(Text, { color: COLORS.gray }, 'One-command hold fix'),
    ),
    
    React.createElement(Divider, null),
    
    React.createElement(Box, { 
      flexDirection: 'column', 
      paddingX: 2,
      borderStyle: 'round',
      borderColor: COLORS.cyan,
      marginX: 2,
      paddingY: 1,
    },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 
        `${ICONS.gear} MCP Tools`
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { color: COLORS.purple }, '  eda.generate_tcl        '),
      React.createElement(Text, { color: COLORS.gray }, 'Generate Tcl from intent'),
      React.createElement(Text, { color: COLORS.purple }, '  eda.send_to_terminal    '),
      React.createElement(Text, { color: COLORS.gray }, 'Send Tcl to EDA pane'),
      React.createElement(Text, { color: COLORS.purple }, '  eda.quick               '),
      React.createElement(Text, { color: COLORS.gray }, 'One-call operations'),
      React.createElement(Text, { color: COLORS.purple }, '  eda.extract_qor         '),
      React.createElement(Text, { color: COLORS.gray }, 'Extract QoR from reports'),
      React.createElement(Text, { color: COLORS.purple }, '  tmux.send_keys          '),
      React.createElement(Text, { color: COLORS.gray }, 'Send keys to pane'),
      React.createElement(Text, { color: COLORS.purple }, '  tmux.capture_pane       '),
      React.createElement(Text, { color: COLORS.gray }, 'Capture pane output'),
      React.createElement(Text, { color: COLORS.purple }, '  knowledge.search_docs   '),
      React.createElement(Text, { color: COLORS.gray }, 'Search documentation'),
    ),
    
    React.createElement(Divider, null),
    
    React.createElement(Box, { 
      flexDirection: 'column', 
      paddingX: 2,
      borderStyle: 'round',
      borderColor: COLORS.pink,
      marginX: 2,
      paddingY: 1,
    },
      React.createElement(Text, { bold: true, color: COLORS.pink }, 
        `${ICONS.bolt} Keyboard Shortcuts`
      ),
      React.createElement(Text, null, ''),
      React.createElement(Text, { color: COLORS.green }, '  Ctrl+E      '),
      React.createElement(Text, { color: COLORS.gray }, 'Switch to EDA pane'),
      React.createElement(Text, { color: COLORS.green }, '  Ctrl+S      '),
      React.createElement(Text, { color: COLORS.gray }, 'Save last generated Tcl'),
      React.createElement(Text, { color: COLORS.green }, '  prefix+m    '),
      React.createElement(Text, { color: COLORS.gray }, 'Toggle manual/auto mode'),
    ),
    
    React.createElement(Divider, null),
    React.createElement(Footer, null)
  );
}

function VersionApp() {
  return React.createElement(Box, { 
    flexDirection: 'column',
    alignItems: 'center',
    padding: 1 
  },
    React.createElement(BigBanner, { version: VERSION })
  );
}

const command = process.argv[2];

async function main() {
  let App;

  switch (command) {
    case 'skills':
      App = SkillsApp;
      break;
    case 'templates':
      App = TemplatesApp;
      break;
    case 'quick':
      App = QuickCommandsApp;
      break;
    case 'help':
    case '--help':
    case '-h':
      App = HelpApp;
      break;
    case 'version':
    case '--version':
    case '-v':
      App = VersionApp;
      break;
    case 'setup':
      console.log('Running setup...');
      try {
        execSync('bash bin/setup.sh', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      } catch (error) {
        console.error('Setup failed:', error.message);
        process.exit(1);
      }
      return;
    case 'workspace':
      console.log('Launching workspace...');
      try {
        execSync('bash bin/hipilot', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      } catch (error) {
        console.error('Failed to launch workspace:', error.message);
        process.exit(1);
      }
      return;
    case 'skill-gen':
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
      return;
    default:
      App = StatusApp;
  }

  render(React.createElement(App));
}

main();
