#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SSH_HOST = process.env.HIPILOT_SSH_HOST || 'EDA@192.168.112.163';
const REMOTE_DIR = process.env.HIPILOT_DEPLOY_DIR || '/home/EDA/hipilot';
const NODE_PATH = process.env.HIPILOT_NODE_PATH || '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// deploy script is in src/hitestbot/infra/, so need to go up 3 levels to reach repo root
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// SSH uses SSHPASS env var (-e flag) instead of -p flag.
// -e is more reliable than -p on CentOS 7 (avoids shell quoting issues).
const SSH_OPTS = '-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3';

function ensureSshpass() {
  if (!process.env.SSHPASS) {
    process.env.SSHPASS = process.env.HIPILOT_SSH_PASS || 'eda2020';
  }
}

function ssh(cmd, timeout = 60000) {
  ensureSshpass();
  const escaped = cmd.replace(/'/g, "'\\''");
  const fullCmd = `sshpass -e ssh ${SSH_OPTS} ${SSH_HOST} '${escaped}'`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return execSync(fullCmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      if (attempt < 3 && (err.message.includes('Connection') || err.message.includes('timed out') || err.message.includes('ssh_exchange'))) {
        console.error(`   SSH attempt ${attempt}/3 failed, retrying in ${attempt * 3}s...`);
        execSync(`sleep ${attempt * 3}`);
        continue;
      }
      console.error(`SSH command failed (attempt ${attempt}): ${cmd.slice(0, 100)}`);
      throw err;
    }
  }
}

function scp(localPath, remotePath) {
  ensureSshpass();
  const cmd = `sshpass -e scp ${SSH_OPTS} ${localPath} ${SSH_HOST}:${remotePath}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync(cmd, { encoding: 'utf-8', timeout: 300000 });
      return;
    } catch (err) {
      if (attempt < 3 && (err.message.includes('Connection') || err.message.includes('timed out') || err.message.includes('ssh_exchange'))) {
        console.error(`   SCP attempt ${attempt}/3 failed, retrying in ${attempt * 3}s...`);
        execSync(`sleep ${attempt * 3}`);
        continue;
      }
      throw err;
    }
  }
}

async function deploy() {
  console.log('=== HiPilot Deployment to EDA Server ===\n');
  
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  
  // Step 1: Create self-contained tarball (WITH node_modules, no npm install on EDA)
  // --minimal flag excludes test/, docs/, src/tui (deploy only runtime tools)
  // Note: src/hitestbot/ is INCLUDED by default because hitestbot-eda runs tests on EDA server
  const isMinimal = process.argv.includes('--minimal');
  const isTest = process.argv.includes('--test');
  console.log(`[1/6] Creating ${isMinimal ? 'minimal ' : ''}self-contained tarball...`);
  const tarFile = `/tmp/hipilot_deploy_${timestamp}.tar.gz`;
  const excludes = [
    '--exclude=.git',
    '--exclude=e2e_evidence',
    '--exclude=*.mp4',
    '--exclude=*.log',
    '--exclude=test-evidence',
    '--exclude=._*',
    '--exclude=.DS_Store',
    '--exclude=**/.DS_Store',
  ];
  if (isMinimal) {
    excludes.push(
      '--exclude=test',
      '--exclude=docs',
      '--exclude=src/tui',
      // Note: Cannot use --exclude=20* because project dir might be named "2026-hipilot"
      // Instead, use specific year patterns that match dated directories (20240226, etc)
      '--exclude=20[0-9][0-9]*',
      // Note: src/hitestbot/ is NOT excluded because bin/hitestbot-eda
      // runs tests on the EDA server and needs the test code deployed
    );
  }
  const tarCmd = `tar czf ${tarFile} -C "${PROJECT_ROOT}" ${excludes.join(' ')} .`;
  execSync(tarCmd, { encoding: 'utf-8' });
  console.log(`   Created: ${tarFile}${isMinimal ? ' (minimal — runtime tools only)' : ' (full — includes node_modules)'}`);
  
  // Step 2: Create remote directory
  console.log('[2/6] Creating remote directory...');
  ssh(`mkdir -p ${REMOTE_DIR}`);
  ssh(`rm -rf ${REMOTE_DIR}/_deploy_temp`);
  ssh(`mkdir -p ${REMOTE_DIR}/_deploy_temp`);
  console.log(`   Created: ${REMOTE_DIR}/_deploy_temp`);
  
  // Step 3: Upload tarball
  console.log('[3/6] Uploading code...');
  scp(tarFile, `${REMOTE_DIR}/_deploy_temp/`);
  console.log('   Upload complete');
  
  // Step 4: Extract (no npm install — node_modules included in tarball)
  console.log('[4/6] Extracting self-contained package...');
  ssh(`
    cd ${REMOTE_DIR}/_deploy_temp
    tar xzf hipilot_deploy_${timestamp}.tar.gz 2>/dev/null
    rm hipilot_deploy_${timestamp}.tar.gz
  `, 180000);
  console.log('   Extraction complete (self-contained, no npm install needed)');
  
  // Step 5: Atomic swap
  console.log('[5/6] Swapping deployment...');
  ssh(`
    cd ${REMOTE_DIR}
    rm -rf _old 2>/dev/null || true
    mv current _old 2>/dev/null || true
    mv _deploy_temp current
    ln -sf current hipilot-latest
  `);
  console.log('   Swap complete');
  
  // Step 6: Configure MCP — ONLY update command/args, NEVER touch env.
  // The env section in settings.json stores API keys (ANTHROPIC_API_KEY, base URL, etc.)
  // If we corrupt env, Claude Code fails to start. This has happened before.
  //
  // Safety: read → backup → patch only command/args → validate → write
  console.log('[6/7] Configuring MCP servers...');
  const hipilotDir = `${REMOTE_DIR}/current`;
  
  // Read existing settings
  let existingSettings = {};
  let existingRaw = '';
  try {
    existingRaw = ssh(`cat ~/.claude/settings.json 2>/dev/null || echo '{}'`);
    existingSettings = JSON.parse(existingRaw);
    console.log('   Found existing settings.json');
  } catch (e) {
    console.log('   No existing settings or invalid JSON, creating new...');
  }
  
  // Backup before modifying (so we can restore if something goes wrong)
  if (existingRaw.trim() !== '{}' && existingRaw.trim() !== '') {
    ssh(`cp ~/.claude/settings.json ~/.claude/settings.json.bak 2>/dev/null || true`);
    console.log('   Backed up to settings.json.bak');
  }
  
  const existingMcp = existingSettings.mcpServers || {};
  
  // Patch ONLY command and args for HiPilot servers.
  // Existing env is spread LAST so it always wins (preserves API keys).
  function patchServer(serverName, newCommand, newArgs, defaultEnv) {
    const existing = existingMcp[serverName] || {};
    const existingEnv = existing.env || {};
    return {
      command: newCommand,
      args: newArgs,
      env: { ...defaultEnv, ...existingEnv },
    };
  }
  
  // Permissions: ensure deny rules exist to block bash EDA commands.
  // Existing allow/deny entries are preserved; HiPilot entries are merged in.
  const existingPermissions = existingSettings.permissions || {};
  const existingAllow = existingPermissions.allow || [];
  const existingDeny = existingPermissions.deny || [];
  
  const requiredAllow = [
    'mcp__hipilot-eda__*', 'mcp__hipilot-tmux__*', 'mcp__hipilot-knowledge__*',
    // NOTE: Removed Bash MCP workarounds to ensure native MCP tools are used
    // Claude Code must use native MCP tools (tools/call) not bash fallbacks
  ];
  // Deny DIRECT execution of EDA tools (tool binary as the command).
  // Pattern 'Bash(innovus *)' blocks 'innovus -no_gui' but NOT
  // 'echo {...} | node servers/eda/index.js' (the Bash workaround).
  // CRITICAL: old patterns used Bash(*innovus*) which also blocked the
  // Bash workaround because the JSON payload contains "innovus" as a value.
  const requiredDeny = [
    'Bash(innovus *)', 'Bash(icc2_shell *)', 'Bash(icc2 *)', 'Bash(pt_shell *)',
    'Bash(dc_shell *)', 'Bash(genus *)', 'Bash(tempus *)', 'Bash(calibre *)',
    'Bash(pegasus *)', 'Bash(voltus *)', 'Bash(joules *)', 'Bash(xcelium *)',
    'Bash(vivado *)', 'Bash(quartus *)',
    'Bash(tmux *)', 'Bash(*send-keys*)', 'Bash(*capture-pane*)',
  ];
  
  const mergedAllow = [...new Set([...existingAllow, ...requiredAllow])];
  const mergedDeny = [...new Set([...existingDeny, ...requiredDeny])];
  
  const mergedSettings = {
    ...existingSettings,
    permissions: {
      allow: mergedAllow,
      deny: mergedDeny,
    },
    mcpServers: {
      ...existingMcp,
      'hipilot-eda': patchServer('hipilot-eda', `${NODE_PATH}/node`, [`${hipilotDir}/servers/eda/index.js`], { HIPILOT_SESSION: 'hipilot' }),
      'hipilot-tmux': patchServer('hipilot-tmux', `${NODE_PATH}/node`, [`${hipilotDir}/servers/tmux/index.js`], { HIPILOT_SESSION: 'hipilot' }),
      'hipilot-knowledge': patchServer('hipilot-knowledge', `${NODE_PATH}/node`, [`${hipilotDir}/servers/knowledge/index.js`], {}),
    },
    // NOTE: Removed skipDangerousModePermissionPrompt to ensure native MCP tools are used
    // This requires user interaction on first run but ensures proper MCP functionality
    // skipDangerousModePermissionPrompt: false  // Explicitly disabled
  };
  
  // Validate: env keys must still be present after merge
  const envKeysToValidate = ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL'];
  for (const key of envKeysToValidate) {
    for (const [serverName, serverConfig] of Object.entries(existingMcp)) {
      if (serverConfig.env && serverConfig.env[key]) {
        const merged = mergedSettings.mcpServers[serverName];
        if (!merged || !merged.env || !merged.env[key]) {
          console.error(`   FATAL: Would lose ${key} from ${serverName}.env — aborting settings update`);
          console.error('   Restoring from backup...');
          ssh(`cp ~/.claude/settings.json.bak ~/.claude/settings.json 2>/dev/null || true`);
          throw new Error(`Settings merge would lose ${key} — aborted`);
        }
      }
    }
  }
  
  const settingsJson = JSON.stringify(mergedSettings, null, 2);
  
  // Write to BOTH ~/.claude/ (global) AND project .claude/ (local).
  // Claude Code checks both. Belt and suspenders — if one fails, the other works.
  ssh(`mkdir -p ~/.claude`);
  ssh(`cat > ~/.claude/settings.json << 'EOFSETTINGS'
${settingsJson}
EOFSETTINGS`);
  ssh(`mkdir -p ${hipilotDir}/.claude`);
  ssh(`cat > ${hipilotDir}/.claude/settings.json << 'EOFSETTINGS'
${settingsJson}
EOFSETTINGS`);
  
  // Verify the file is valid JSON after writing
  try {
    ssh(`node -e "JSON.parse(require('fs').readFileSync('/home/EDA/.claude/settings.json','utf8'))" 2>&1`);
    console.log('   MCP configured (command/args updated, env preserved, JSON validated)');
  } catch {
    console.error('   WARNING: settings.json may be corrupted — restoring backup');
    ssh(`cp ~/.claude/settings.json.bak ~/.claude/settings.json 2>/dev/null || true`);
    throw new Error('settings.json validation failed after write — restored backup');
  }
  
  // Step 7: Deploy CLAUDE.md and slash commands for HiPilot identity
  console.log('[7/7] Deploying HiPilot identity (CLAUDE.md + commands)...');
  
  // Copy EDA-server CLAUDE.md to the deployed project directory
  const deployClaude = join(PROJECT_ROOT, '..', 'deploy', 'eda-server', 'CLAUDE.md');
  if (existsSync(deployClaude)) {
    scp(deployClaude, `${hipilotDir}/CLAUDE.md`);
    console.log('   CLAUDE.md deployed (HiPilot identity)');
  } else {
    // Fallback: use the one in the deploy directory relative to project
    const altPath = join(PROJECT_ROOT, 'deploy', 'eda-server', 'CLAUDE.md');
    if (existsSync(altPath)) {
      scp(altPath, `${hipilotDir}/CLAUDE.md`);
      console.log('   CLAUDE.md deployed (HiPilot identity)');
    } else {
      console.log('   WARNING: deploy/eda-server/CLAUDE.md not found');
    }
  }
  
  // Copy slash commands
  const cmdDir = join(PROJECT_ROOT, 'deploy', 'eda-server', '.claude', 'commands');
  if (existsSync(cmdDir)) {
    ssh(`mkdir -p ${hipilotDir}/.claude/commands`);
    for (const file of execSync(`ls ${cmdDir}`, { encoding: 'utf-8' }).trim().split('\n')) {
      if (file.endsWith('.md')) {
        scp(join(cmdDir, file), `${hipilotDir}/.claude/commands/${file}`);
      }
    }
    console.log('   Slash commands deployed (10 commands)');
  }
  
  // Cleanup
  unlinkSync(tarFile);
  
  console.log('\n=== Deployment Complete ===');
  console.log(`HiPilot installed at: ${hipilotDir}`);
  console.log(`Identity: deploy/eda-server/CLAUDE.md → ${hipilotDir}/CLAUDE.md`);
  console.log(`MCP servers: ~/.claude/settings.json (merged, API keys preserved)`);
  console.log(`Commands: ${hipilotDir}/.claude/commands/ (10 slash commands)`);
  console.log('\nClaude Code on EDA server will now identify as HiPilot.');
}

deploy().catch(err => {
  console.error('Deployment failed:', err.message);
  process.exit(1);
});
