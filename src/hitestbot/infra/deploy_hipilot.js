#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SSH_HOST = 'EDA@192.168.112.163';
const SSH_PASS = 'eda2020';
const REMOTE_DIR = '/home/EDA/hipilot';
const NODE_PATH = '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function ssh(cmd, timeout = 60000) {
  const fullCmd = `sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no ${SSH_HOST} '${cmd.replace(/'/g, "'\\''")}'`;
  try {
    return execSync(fullCmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    console.error(`SSH command failed: ${cmd}`);
    throw err;
  }
}

function scp(localPath, remotePath) {
  const cmd = `sshpass -p '${SSH_PASS}' scp -o StrictHostKeyChecking=no ${localPath} ${SSH_HOST}:${remotePath}`;
  execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
}

async function deploy() {
  console.log('=== HiPilot Deployment to EDA Server ===\n');
  
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  
  // Step 1: Create tarball
  console.log('[1/6] Creating tarball...');
  const tarFile = `/tmp/hipilot_deploy_${timestamp}.tar.gz`;
  const tarCmd = `tar czf ${tarFile} -C "${PROJECT_ROOT}" --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' --exclude='*.mp4' --exclude='*.log' .`;
  execSync(tarCmd, { encoding: 'utf-8' });
  console.log(`   Created: ${tarFile}`);
  
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
  
  // Step 4: Extract and install
  console.log('[4/6] Extracting and installing dependencies...');
  ssh(`
    cd ${REMOTE_DIR}/_deploy_temp
    tar xzf hipilot_deploy_${timestamp}.tar.gz
    rm hipilot_deploy_${timestamp}.tar.gz
    export PATH=${NODE_PATH}:$PATH
    npm install --production > /tmp/npm_deploy.log 2>&1
  `, 180000);
  console.log('   npm install complete');
  
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
  
  // Step 6: Configure MCP (MERGE with existing settings — preserves API keys!)
  console.log('[6/7] Configuring MCP servers...');
  const hipilotDir = `${REMOTE_DIR}/current`;
  
  let existingSettings = {};
  try {
    const existingJson = ssh(`cat ~/.claude/settings.json 2>/dev/null || echo '{}'`);
    existingSettings = JSON.parse(existingJson);
    console.log('   Found existing settings, will merge (preserving API keys)...');
  } catch (e) {
    console.log('   No existing settings, creating new...');
  }
  
  const mergedSettings = {
    ...existingSettings,
    mcpServers: {
      ...(existingSettings.mcpServers || {}),
      'hipilot-eda': {
        command: `${NODE_PATH}/node`,
        args: [`${hipilotDir}/servers/eda/index.js`],
        env: { HIPILOT_SESSION: 'hipilot' }
      },
      'hipilot-tmux': {
        command: `${NODE_PATH}/node`,
        args: [`${hipilotDir}/servers/tmux/index.js`],
        env: { HIPILOT_SESSION: 'hipilot' }
      },
      'hipilot-knowledge': {
        command: `${NODE_PATH}/node`,
        args: [`${hipilotDir}/servers/knowledge/index.js`],
        env: {}
      }
    },
    skipDangerousModePermissionPrompt: true
  };
  
  ssh(`mkdir -p ~/.claude`);
  ssh(`cat > ~/.claude/settings.json << 'EOFSETTINGS'
${JSON.stringify(mergedSettings, null, 2)}
EOFSETTINGS`);
  console.log('   MCP configured (settings merged)');
  
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
    console.log('   Slash commands deployed (8 commands)');
  }
  
  // Cleanup
  unlinkSync(tarFile);
  
  console.log('\n=== Deployment Complete ===');
  console.log(`HiPilot installed at: ${hipilotDir}`);
  console.log(`Identity: deploy/eda-server/CLAUDE.md → ${hipilotDir}/CLAUDE.md`);
  console.log(`MCP servers: ~/.claude/settings.json (merged, API keys preserved)`);
  console.log(`Commands: ${hipilotDir}/.claude/commands/ (8 slash commands)`);
  console.log('\nClaude Code on EDA server will now identify as HiPilot.');
}

deploy().catch(err => {
  console.error('Deployment failed:', err.message);
  process.exit(1);
});
