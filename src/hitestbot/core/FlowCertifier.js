/**
 * FlowCertifier — Uses HiPilot like a human, records everything, correlates evidence.
 *
 * HiTestBot is a virtual human. It:
 *   1. Launches HiPilot (bin/hipilot)
 *   2. Starts video recording on display :0
 *   3. Waits for Claude Code to be ready
 *   4. Types a command (e.g., /synthesis)
 *   5. Watches Claude work, approves when asked
 *   6. Takes screenshots at key moments
 *   7. Continuously logs both panes with timestamps
 *   8. Stops recording, collects all logs
 *   9. Builds correlated evidence timeline
 *  10. Scores based on what a human would see
 *
 * It NEVER calls MCP tools, sends commands to the EDA pane, or
 * bypasses any part of HiPilot. It uses HiPilot exactly as shipped.
 *
 * After the test, it collects logs that HiPilot produced:
 *   - MCP call log (HIPILOT_TEST_LOG)
 *   - EDA tool log files (innovus.log*, icc2_shell.log*, etc.)
 *   - Both pane captures with timestamps
 * These are post-test evidence collection, not test-time cheating.
 */

import { execSync, spawn, spawnSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, copyFileSync, createWriteStream, unlinkSync, statSync, watch } from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';
import { ObservationPoint } from './ObservationPoint.js';
import { FlowReporter } from './FlowReporter.js';
import { CheatDetector } from './CheatDetector.js';

// Heartbeat configuration for event-driven monitoring
const HEARTBEAT_ENABLED = process.env.HIPILOT_HEARTBEAT !== 'false'; // Enabled by default
const HEARTBEAT_FALLBACK_INTERVAL_MS = 5000; // Poll every 5s if heartbeat unavailable
const HEARTBEAT_MAX_AGE_MS = 10000; // Heartbeat older than 10s is stale

// Adaptive polling intervals based on detected state - optimized for faster response
// Key insight: Poll fast when activity is happening, skip work when idle
const POLL_INTERVALS = {
  working: 1000,        // Fast poll when Claude is actively producing output (1s)
  waiting_for_eda: 2000, // Poll EDA frequently to catch completion quickly (2s)
  idle: 500,            // Very fast when idle to detect prompt immediately (0.5s)
  needs_approval: 200,  // Ultra-fast response for approvals (0.2s)
  asking_question: 500, // Fast response for questions (0.5s)
  bypass_permissions: 200, // Ultra-fast for permission bypass (0.2s)
};
const DEFAULT_POLL_INTERVAL_MS = 1000;

// Throttling: Skip expensive operations during long-running EDA
const SCREENSHOT_INTERVAL_POLLS = 30;     // Every ~60s during EDA (was every 12 = 24s)
const OBSERVATION_INTERVAL_POLLS = 15;    // Every ~30s during EDA (was every 6 = 12s)
const FAST_SCREENSHOT_INTERVAL = 6;       // Every ~6s when working (fast mode)
const FAST_OBSERVATION_INTERVAL = 3;      // Every ~3s when working (fast mode)
const CLAUDE_READY_TIMEOUT_MS = 120000;

// ═══════════════════════════════════════════════════════════════════
//  HUMAN-LIKE BEHAVIOR MODELING
//
//  HiTestBot should behave like a real engineer, not a robot:
//    - Irregular attention patterns (humans don't poll mechanically)
//    - Contextual reading speed (fast for familiar, slow for new)
//    - Attention fatigue (occasional "distraction" periods)
//    - Smart screenshot timing (at interesting moments, not periodic)
//    - Review pauses (humans pause after typing to see results)
// ═══════════════════════════════════════════════════════════════════

// Human polling is irregular - add jitter to avoid mechanical patterns
const HUMAN_JITTER_PERCENT = 0.3;  // ±30% variation in timing

// Human attention model: focus level affects response time
const ATTENTION_MODEL = {
  high: { responseMs: 500, jitter: 0.2 },    // Alert: fast response
  normal: { responseMs: 1500, jitter: 0.4 }, // Standard: moderate
  low: { responseMs: 3000, jitter: 0.5 },    // Fatigued: slower
};

// Screenshots: humans take them at meaningful moments
const SCREENSHOT_TRIGGERS = {
  stateChange: true,      // Always capture on state transitions
  errorDetected: true,    // Capture when errors appear
  completion: true,       // Capture on completion
  periodicMaxInterval: 120000, // Max 2min between shots (humans glance)
};

// Review pauses: humans naturally pause after certain actions
const REVIEW_PAUSE_MS = {
  afterCommand: 2000,     // Pause to read response
  afterError: 3000,       // Pause longer to understand error
  afterCompletion: 1000,  // Quick check before continuing
};

// ═══════════════════════════════════════════════════════════════════
//  ANTI-CHEAT RULES
//
//  HiTestBot is a virtual human. It must NEVER:
//    1. Import or call any MCP server code
//    2. Send tmux commands to pane 0.1 (the EDA pane)
//    3. Write to any file that HiPilot reads (skills, templates, settings)
//    4. Modify the tmux session layout or settings
//    5. Read MCP logs DURING the test (only AFTER the test ends)
//    6. Fabricate screenshots or evidence files
//    7. Run EDA tool commands directly
//    8. Mock or fake EDA tools (no "puts innovus 1>", no "echo" to simulate output)
//    9. Use results from a previous test run (each test gets a clean design copy)
//
//  All interaction with HiPilot is through:
//    - tmux send-keys to pane 0.0 (type in Claude Code's input)
//    - tmux capture-pane from both panes (read the screen)
//    - import/imagemagick for screenshots (capture the desktop)
//    - ffmpeg for video (record the desktop)
//
//  Evidence integrity:
//    - Screenshots come from `import -window root` (X11 capture)
//    - Video comes from ffmpeg recording display :0
//    - Pane logs come from tmux capture-pane
//    - All evidence is timestamped and cross-referenced in timeline.jsonl
//    - MCP logs are collected AFTER the test from files HiPilot wrote
//    - HiTestBot cannot create or modify MCP log entries
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  STAGE-TOOL VALIDATION MAP
//
//  RTL2GDS flow has strict tool requirements per stage:
//  - Stage 0 (Synthesis): MUST use dc_shell
//  - Stages 1-9 (Physical Design): MUST use innovus
//  - Signoff: SHOULD use pt_shell
//
//  These constraints are fundamental to the flow. A human engineer
//  would never try to run synthesis in innovus - that's a process error.
// ═══════════════════════════════════════════════════════════════════
const STAGE_TOOL_MAP = {
  // Stage 0: Synthesis - ONLY dc_shell is valid
  'synthesis': { tool: 'dc_shell', stage: 0, required: true },
  'compile': { tool: 'dc_shell', stage: 0, required: true },
  'dc': { tool: 'dc_shell', stage: 0, required: true },
  'elaborate': { tool: 'dc_shell', stage: 0, required: true },

  // Stages 1-9: Physical Design - ONLY innovus is valid
  'init_design': { tool: 'innovus', stage: 1, required: true },
  'init': { tool: 'innovus', stage: 1, required: true },
  'floorplan': { tool: 'innovus', stage: 2, required: true },
  'floorplanning': { tool: 'innovus', stage: 2, required: true },
  'power_plan': { tool: 'innovus', stage: 3, required: true },
  'powerplan': { tool: 'innovus', stage: 3, required: true },
  'placement': { tool: 'innovus', stage: 4, required: true },
  'place': { tool: 'innovus', stage: 4, required: true },
  'cts': { tool: 'innovus', stage: 5, required: true },
  'clock_tree': { tool: 'innovus', stage: 5, required: true },
  'post_cts_opt': { tool: 'innovus', stage: 6, required: true },
  'routing': { tool: 'innovus', stage: 7, required: true },
  'route': { tool: 'innovus', stage: 7, required: true },
  'routing_opt': { tool: 'innovus', stage: 8, required: true },
  'chip_finish': { tool: 'innovus', stage: 9, required: true },
  'chip_done': { tool: 'innovus', stage: 9, required: true },
  'stream_out': { tool: 'innovus', stage: 9, required: true },

  // Signoff
  'sta': { tool: 'pt_shell', stage: 10, required: false },
  'primetime': { tool: 'pt_shell', stage: 10, required: false },
};

// A human does NOT stare at a timer. They glance at the screen and read:
// - Is there a prompt (❯, >, $, innovus N>)? → terminal is idle, ready for input
// - Is text scrolling? → something is running
// - Is Claude showing a spinner (thinking/Drizzling)? → Claude is working
// - Nothing changed but no prompt either? → might be stuck
const EARLY_ABORT_PATTERNS = [           // a human would stop watching if they see these
  /MCP.*not (available|found|configured)/i,
  /no MCP/i,
  /CLAUDE\.md.*not found/i,
  /command not found: claude/i,
  /ECONNREFUSED/i,
  // Note: permission denied is NOT here - we need to handle bypass permissions prompt
];
const QUESTION_PATTERNS = [              // Claude is asking the human something
  /should I (proceed|continue|start|fix|retry)/i,
  /do you want/i,
  /would you like/i,
  /\? *$/m,
  /\[y\/n\]/i,
  /\[yes\/no\]/i,
  /please confirm/i,
  /choose.*:/i,
  /select.*:/i,
];

export class FlowCertifier {
  constructor(options = {}) {
    this.session = options.session || 'hipilot';
    this.socket = options.socket || this.session;
    this.hipilotBin = options.hipilotBin || null;
    this.evidenceBaseDir = options.evidenceDir || '/tmp/hipilot-test-evidence';
    this.display = options.display || ':0';
    this.mcpLogPath = options.mcpLogPath || '/tmp/hipilot_test_mcp.jsonl';

    // Design source: tarball to extract for a clean start each test.
    // Existing results from previous runs can mislead scoring.
    this.designTarball = options.designTarball || '/home/EDA/ibex_demo.tar';
    this.testWorkBase = options.testWorkBase || '/home/EDA/runs';

    // Extract keyword from command for directory name (e.g., "/synthesis" -> "synthesis")
    const commandKeyword = this._extractCommandKeyword(options.command || 'test');

    // Human-readable timestamp: YYYYMMDD-HHMMSS
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    this.timestamp = `${dateStr}-${timeStr}`;

    // Directory format: /home/EDA/runs/test-{keyword}-{timestamp}
    this.runDirName = `test-${commandKeyword}-${this.timestamp}`;
    this.evidenceDir = join(this.evidenceBaseDir, this.runDirName);
    this.testWorkDir = join(this.testWorkBase, this.runDirName);
    this.observations = [];
    this.stageResults = [];
    this.recordingStartTime = null;
    this._runLogLines = [];
    this._paneLog = [];
    this._ffmpegPid = null;
    this._videoFile = null;
    this._lastCompletedStage = 0; // Track RTL2GDS stage progress
    this.lastCommand = null;

    // Heartbeat monitoring state
    this._heartbeatWatcher = null;
    this._lastHeartbeat = null;
    this._heartbeatAvailable = false;
  }

  /**
   * Get the heartbeat file path for this session.
   * Heartbeat file is written by the EDA MCP server for event-driven monitoring.
   */
  _getHeartbeatPath() {
    const username = process.env.USER || process.env.USERNAME || 'unknown';
    return join(tmpdir(), `hipilot-${this.socket}-heartbeat.json`);
  }

  /**
   * Read the latest heartbeat from the filesystem.
   * Returns null if heartbeat file doesn't exist or can't be read.
   */
  _readHeartbeat() {
    try {
      const path = this._getHeartbeatPath();
      if (!existsSync(path)) return null;
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if heartbeat is available and fresh.
   */
  _isHeartbeatFresh(maxAgeMs = HEARTBEAT_MAX_AGE_MS) {
    const hb = this._readHeartbeat();
    if (!hb) return false;
    const age = Date.now() - hb.timestamp;
    return age <= maxAgeMs;
  }

  /**
   * Start watching heartbeat file for changes.
   * Uses fs.watch() for event-driven monitoring.
   */
  _startHeartbeatWatch() {
    if (!HEARTBEAT_ENABLED || this._heartbeatWatcher) return false;

    const heartbeatPath = this._getHeartbeatPath();

    // Check if heartbeat file exists (indicates server supports heartbeats)
    if (!existsSync(heartbeatPath)) {
      this._heartbeatAvailable = false;
      return false;
    }

    this._heartbeatAvailable = true;

    try {
      let lastContent = null;
      this._heartbeatWatcher = watch(heartbeatPath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          try {
            const hb = this._readHeartbeat();
            if (hb) {
              const content = JSON.stringify(hb);
              if (content !== lastContent) {
                lastContent = content;
                this._lastHeartbeat = hb;
              }
            }
          } catch (e) {
            // Ignore read errors during watch
          }
        }
      });

      // Read initial state
      this._lastHeartbeat = this._readHeartbeat();
      return true;
    } catch (e) {
      this._heartbeatWatcher = null;
      this._heartbeatAvailable = false;
      return false;
    }
  }

  /**
   * Stop watching heartbeat file.
   */
  _stopHeartbeatWatch() {
    if (this._heartbeatWatcher) {
      this._heartbeatWatcher.close();
      this._heartbeatWatcher = null;
    }
  }

  /**
   * Extract a clean keyword from the command for directory naming.
   * Converts "/synthesis" -> "synthesis", "fix setup timing" -> "fix-setup-timing"
   */
  _extractCommandKeyword(command) {
    if (!command || typeof command !== 'string') return 'test';

    // Remove leading slash, convert to lowercase
    let keyword = command.toLowerCase().trim();
    if (keyword.startsWith('/')) {
      keyword = keyword.slice(1);
    }

    // Replace spaces and special chars with hyphens
    keyword = keyword.replace(/[^a-z0-9]+/g, '-');

    // Limit length
    if (keyword.length > 30) {
      keyword = keyword.slice(0, 30);
    }

    // Remove trailing hyphen
    keyword = keyword.replace(/-+$/, '');

    return keyword || 'test';
  }

  /**
   * Get the appropriate poll interval based on current state and heartbeat availability.
   * Uses longer intervals when heartbeat is available (event-driven).
   */
  _getPollInterval(state) {
    // If heartbeat is available and fresh, use much longer polling interval
    if (this._heartbeatAvailable && this._isHeartbeatFresh()) {
      return HEARTBEAT_FALLBACK_INTERVAL_MS;
    }
    // Otherwise use state-based adaptive polling
    return POLL_INTERVALS[state] || DEFAULT_POLL_INTERVAL_MS;
  }

  /**
   * Prepare a clean design copy for this test run.
   * Copies ibex_demo.tar to the test directory and extracts it there
   * for complete isolation — prevents evidence contamination between runs.
   *
   * Directory format: /runs/test-{keyword}-{timestamp}/
   *
   * Returns the path to the clean work directory.
   */
  prepareCleanDesign() {
    this._runLog(`Preparing clean design copy in: ${this.testWorkDir}`);

    // Create timestamped work directory
    try {
      execSync(`mkdir -p ${this.testWorkDir}`, { encoding: 'utf-8', timeout: 5000 });
      this._runLog(`Created run directory: ${this.testWorkDir}`);
    } catch (e) {
      this._runLog(`Failed to create work dir: ${e.message}`);
      return null;
    }

    // Check source tarball exists
    if (!existsSync(this.designTarball)) {
      this._runLog(`Design tarball not found: ${this.designTarball} — using existing design location`);
      return null;
    }

    // Copy tarball to test directory for isolation
    const localTarball = join(this.testWorkDir, 'ibex_demo.tar');
    try {
      this._runLog(`Copying tarball to test directory...`);
      execSync(`cp ${this.designTarball} ${localTarball}`, {
        encoding: 'utf-8', timeout: 30000,
      });
      this._runLog(`Tarball copied: ${localTarball}`);
    } catch (e) {
      this._runLog(`Failed to copy tarball: ${e.message}`);
      return null;
    }

    // Extract design tarball from the local copy
    try {
      this._runLog(`Extracting tarball...`);
      execSync(`tar xf ${localTarball} -C ${this.testWorkDir}`, {
        encoding: 'utf-8', timeout: 60000,
      });

      // Find the extracted directory (usually ibex_work_upload or similar)
      const contents = execSync(`ls ${this.testWorkDir}`, { encoding: 'utf-8', timeout: 5000 }).trim().split('\n');
      const extractedDirs = contents.filter(f => f !== 'ibex_demo.tar');
      const designDir = extractedDirs.length === 1
        ? join(this.testWorkDir, extractedDirs[0])
        : this.testWorkDir;

      // Clean outputs from the extracted copy
      this._removeExistingOutputs(designDir);

      this._runLog(`Clean design ready at: ${designDir}`);
      this._runLog(`Run directory: ${this.testWorkDir}`);
      return designDir;
    } catch (e) {
      this._runLog(`Failed to extract design: ${e.message}`);
      return null;
    }
  }

  /**
   * Remove ALL existing design outputs to force complete flow execution.
   * HiPilot should never skip a stage just because files exist.
   */
  _removeExistingOutputs(designDir) {
    if (!existsSync(designDir)) return;

    this._runLog(`Removing existing outputs from: ${designDir}`);

    const outputDirs = [
      'result',
      'result/syn',
      'result/pr',
      'result/scanchain',
      '*.enc',
      '*.enc.dat',
      '*.log',
      '*.rpt',
    ];

    for (const dir of outputDirs) {
      try {
        const path = join(designDir, dir);
        if (existsSync(path)) {
          execSync(`rm -rf "${path}"`, { encoding: 'utf-8', timeout: 10000 });
          this._runLog(`  Removed: ${path}`);
        }
      } catch (e) {
        this._runLog(`  Warning: Could not remove ${dir}: ${e.message}`);
      }
    }

    // Specifically remove the synthesis netlist that causes skips
    const netlistPath = join(designDir, 'result/syn/data/ibex_core.syn.v');
    if (existsSync(netlistPath)) {
      try {
        execSync(`rm -f "${netlistPath}"`, { encoding: 'utf-8', timeout: 5000 });
        this._runLog(`  Removed synthesis netlist: ${netlistPath}`);
      } catch (e) {
        this._runLog(`  Warning: Could not remove netlist: ${e.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  VIDEO RECORDING
  // ═══════════════════════════════════════════════════════════════════

  _startVideoRecording() {
    const videoDir = join(this.evidenceDir, 'recordings');
    mkdirSync(videoDir, { recursive: true });
    this._videoFile = join(videoDir, 'test_recording.mp4');
    const ffmpegLog = join(videoDir, 'ffmpeg.log');
    const pidFile = join(videoDir, 'ffmpeg.pid');

    try {
      // Detect resolution from display
      let resolution = '1920x1080';
      try {
        const info = execSync(`DISPLAY=${this.display} xdpyinfo 2>/dev/null | grep dimensions | awk '{print $2}'`, {
          encoding: 'utf-8', timeout: 5000, shell: true,
        }).trim();
        if (info && info.includes('x')) resolution = info;
      } catch { /* use default */ }

      // Use nohup + shell for CentOS 7 reliability.
      // On CentOS 7, spawning ffmpeg directly from Node can fail due to glibc/TTY issues.
      // nohup detaches the process so it survives even if the parent exits.
      const ffmpegCmd = [
        `DISPLAY=${this.display}`,
        'nohup ffmpeg -y -f x11grab',
        `-video_size ${resolution}`,
        '-framerate 10',
        `-i ${this.display}`,
        '-c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p',
        `'${this._videoFile}'`,
        `> '${ffmpegLog}' 2>&1 &`,
        `echo $!`,
      ].join(' ');

      const pid = execSync(ffmpegCmd, {
        encoding: 'utf-8', timeout: 10000, shell: true,
        env: { ...process.env, DISPLAY: this.display },
      }).trim();

      this._ffmpegPid = parseInt(pid, 10);
      writeFileSync(pidFile, String(this._ffmpegPid));

      // Verify ffmpeg started (reduced from 2s to 1s)
      execSync('sleep 1', { timeout: 5000 });
      try {
        process.kill(this._ffmpegPid, 0); // check if alive
        this._runLog(`Video recording started: PID=${this._ffmpegPid}, resolution=${resolution}`);
        return true;
      } catch {
        this._runLog(`ffmpeg process ${this._ffmpegPid} died immediately — check ${ffmpegLog}`);
        this._ffmpegPid = null;
        return false;
      }
    } catch (e) {
      this._runLog(`Video recording failed to start: ${e.message}`);
      this._ffmpegPid = null;
      return false;
    }
  }

  _stopVideoRecording() {
    if (!this._ffmpegPid) return;
    try {
      // SIGINT for clean ffmpeg shutdown (writes proper file trailer)
      process.kill(this._ffmpegPid, 'SIGINT');
      this._runLog(`Sent SIGINT to ffmpeg PID=${this._ffmpegPid}`);

      // Wait for ffmpeg to finalize (reduced from 3s to 2s)
      execSync('sleep 2', { timeout: 10000 });

      // Check if still running, force kill if needed
      try {
        process.kill(this._ffmpegPid, 0);
        process.kill(this._ffmpegPid, 'SIGKILL');
        this._runLog('Force-killed ffmpeg');
      } catch {
        // Process already exited — good
      }

      if (existsSync(this._videoFile)) {
        const stat = execSync(`ls -lh '${this._videoFile}' | awk '{print $5}'`, { encoding: 'utf-8' }).trim();
        this._runLog(`Video saved: ${this._videoFile} (${stat})`);
      }
    } catch (e) {
      this._runLog(`Error stopping video: ${e.message}`);
    }
    this._ffmpegPid = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SCREENSHOT
  // ═══════════════════════════════════════════════════════════════════

  _takeScreenshot(name) {
    const file = join(this.evidenceDir, `screenshot_${name}.png`);
    try {
      execSync(`import -window root -display ${this.display} '${file}' 2>/dev/null`, { timeout: 10000 });
      this._runLog(`Screenshot: ${basename(file)}`);
      return file;
    } catch {
      this._runLog(`Screenshot failed: ${name}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CONTINUOUS PANE LOGGING
  // ═══════════════════════════════════════════════════════════════════

  _logPanes(label) {
    const ts = new Date().toISOString();
    const elapsed = this.recordingStartTime
      ? ((Date.now() - this.recordingStartTime) / 1000).toFixed(1)
      : '0.0';

    const claude = this._capturePane('0.0');
    const eda = this._capturePane('0.1');

    this._paneLog.push({
      timestamp: ts,
      elapsed_s: parseFloat(elapsed),
      video_offset_s: this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : null,
      label,
      claude_lines: claude.split('\n').length,
      eda_lines: eda.split('\n').length,
      claude_last10: claude.split('\n').filter(l => l.trim()).slice(-10).join('\n'),
      eda_last10: eda.split('\n').filter(l => l.trim()).slice(-10).join('\n'),
    });

    return { claude, eda };
  }

  // Parallel version for faster capture during watch loop
  async _logPanesParallel(label) {
    const ts = new Date().toISOString();
    const elapsed = this.recordingStartTime
      ? ((Date.now() - this.recordingStartTime) / 1000).toFixed(1)
      : '0.0';

    // Capture both panes in parallel for speed
    const [claude, eda] = await Promise.all([
      this._capturePaneAsync('0.0'),
      this._capturePaneAsync('0.1')
    ]);

    this._paneLog.push({
      timestamp: ts,
      elapsed_s: parseFloat(elapsed),
      video_offset_s: this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : null,
      label,
      claude_lines: claude.split('\n').length,
      eda_lines: eda.split('\n').length,
      claude_last10: claude.split('\n').filter(l => l.trim()).slice(-10).join('\n'),
      eda_last10: eda.split('\n').filter(l => l.trim()).slice(-10).join('\n'),
    });

    return { claude, eda };
  }

  // Async wrapper for pane capture
  _capturePaneAsync(paneId) {
    return new Promise((resolve) => {
      try {
        const result = this._capturePane(paneId);
        resolve(result);
      } catch (e) {
        resolve('');
      }
    });
  }

  _savePaneLog() {
    writeFileSync(
      join(this.evidenceDir, 'pane_log.jsonl'),
      this._paneLog.map(e => JSON.stringify(e)).join('\n') + '\n'
    );
    this._runLog(`Pane log saved: ${this._paneLog.length} entries`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  POST-TEST LOG COLLECTION (not during test — evidence after the fact)
  // ═══════════════════════════════════════════════════════════════════

  _collectLogs() {
    this._runLog('Collecting post-test logs...');
    const logsDir = join(this.evidenceDir, 'logs');
    mkdirSync(logsDir, { recursive: true });

    // 1. Full pane dumps (complete scrollback)
    this._savePaneDump(logsDir, '0.0', 'claude_full.log');
    this._savePaneDump(logsDir, '0.1', 'eda_full.log');

    // 2. MCP call log (written by HiPilot's MCP servers during the test)
    this._collectMcpLog(logsDir);

    // 3. EDA tool log files (Innovus, ICC2, PrimeTime produce log files)
    this._collectEdaLogs(logsDir);

    // 4. HiPilot internal files (mode, pending, history)
    this._collectHipilotState(logsDir);

    // 5. LittleBrain reasoning logs (NEW - captures AI decision-making)
    this._collectLittleBrainLogs(logsDir);
  }

  _collectLittleBrainLogs(logsDir) {
    // LittleBrain logs are written to ~/.hipilot/littlebrain/logs/
    const homedir = process.env.HOME || '/home/EDA';
    const lbLogDir = join(homedir, '.hipilot', 'littlebrain', 'logs');

    if (!existsSync(lbLogDir)) {
      this._runLog('No LittleBrain logs directory found');
      return;
    }

    try {
      const files = readdirSync(lbLogDir);
      let collected = 0;

      // Collect the most recent log files (last 5 minutes)
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      for (const f of files) {
        if (!f.endsWith('.jsonl') && !f.endsWith('.json')) continue;

        const src = join(lbLogDir, f);
        const stat = statSync(src);

        // Only collect recent files from this test run
        if (stat.mtimeMs < fiveMinutesAgo) continue;

        const dst = join(this.evidenceDir, 'littlebrain', f);
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
        collected++;
      }

      this._runLog(`LittleBrain logs collected: ${collected} files`);

      // Also create a summary if we found logs
      if (collected > 0) {
        this._summarizeLittleBrainLogs(join(this.evidenceDir, 'littlebrain'));
      }
    } catch (e) {
      this._runLog(`LittleBrain log collection failed: ${e.message}`);
    }
  }

  _summarizeLittleBrainLogs(lbDir) {
    try {
      // Find the most recent session log
      const files = readdirSync(lbDir).filter(f => f.endsWith('.jsonl') && !f.includes('_summary'));
      if (files.length === 0) return;

      // Sort by mtime, take most recent
      const mostRecent = files
        .map(f => ({ file: f, stat: statSync(join(lbDir, f)) }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0];

      const logPath = join(lbDir, mostRecent.file);
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      // Count entry types
      const counts = {};
      const decisions = [];

      for (const line of lines.slice(-100)) { // Last 100 entries
        try {
          const entry = JSON.parse(line);
          counts[entry.type] = (counts[entry.type] || 0) + 1;
          if (entry.type === 'decision' || entry.type === 'reasoning') {
            decisions.push(entry);
          }
        } catch { /* skip invalid lines */ }
      }

      // Write summary
      const summary = {
        session_file: mostRecent.file,
        total_entries: lines.length,
        entry_types: counts,
        key_decisions: decisions.slice(-10),
        collected_at: new Date().toISOString()
      };

      writeFileSync(join(lbDir, 'littlebrain_summary.json'), JSON.stringify(summary, null, 2));
      this._runLog(`LittleBrain summary: ${lines.length} entries, ${Object.keys(counts).length} types`);
    } catch (e) {
      this._runLog(`LittleBrain summary failed: ${e.message}`);
    }
  }

  _savePaneDump(logsDir, paneId, filename) {
    try {
      const content = execSync(
        `tmux -L ${this.socket} capture-pane -t ${this.session}:0.${paneId} -p -S -10000 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      writeFileSync(join(logsDir, filename), content);
      this._runLog(`Pane dump: ${filename} (${content.split('\n').length} lines)`);
    } catch (e) {
      this._runLog(`Pane dump failed for ${filename}: ${e.message}`);
    }
  }

  _collectMcpLog(logsDir) {
    // The MCP log is written by HiPilot's EDA MCP server when HIPILOT_TEST_LOG is set.
    // We look for it in the standard location and copy it to evidence.
    const possiblePaths = [
      this.mcpLogPath,
      '/tmp/hipilot_test_mcp.jsonl',
      '/tmp/mcp.jsonl',
    ];

    for (const p of possiblePaths) {
      if (existsSync(p)) {
        const content = readFileSync(p, 'utf-8');
        writeFileSync(join(logsDir, 'mcp_calls.jsonl'), content);
        const lines = content.split('\n').filter(l => l.trim()).length;
        this._runLog(`MCP log collected: ${p} (${lines} calls)`);
        return;
      }
    }
    this._runLog('No MCP log found (HIPILOT_TEST_LOG may not be set)');
  }

  _collectEdaLogs(logsDir) {
    // EDA tools write log files to the working directory.
    // Innovus: innovus.log*, innovus.cmd*
    // ICC2: icc2_shell.log*
    // PrimeTime: pt_shell.log*
    const edaLogPatterns = [
      { glob: 'innovus.log*', tool: 'innovus' },
      { glob: 'innovus.cmd*', tool: 'innovus' },
      { glob: 'icc2_shell.log*', tool: 'icc2' },
      { glob: 'pt_shell.log*', tool: 'primetime' },
    ];

    // Check both the project dir and common design dirs
    const searchDirs = [
      this._projectRoot(),
      '/home/EDA/hipilot_test/ibex_work_upload',
    ];

    let collected = 0;
    for (const dir of searchDirs) {
      if (!existsSync(dir)) continue;
      try {
        const files = readdirSync(dir);
        for (const pat of edaLogPatterns) {
          const globBase = pat.glob.replace('*', '');
          const matching = files.filter(f => f.startsWith(globBase));
          for (const f of matching) {
            const src = join(dir, f);
            const dst = join(logsDir, `eda_${pat.tool}_${f}`);
            try {
              copyFileSync(src, dst);
              collected++;
            } catch { /* skip unreadable files */ }
          }
        }
      } catch { /* skip inaccessible dirs */ }
    }
    this._runLog(`EDA logs collected: ${collected} files`);
  }

  _collectHipilotState(logsDir) {
    // Collect HiPilot's internal state files for correlation
    const username = process.env.USER || 'unknown';
    const hipilotTmp = `/tmp/hipilot-${username}`;
    const stateFiles = ['mode', 'pending.tcl', 'pending_meta.json'];

    for (const f of stateFiles) {
      const src = join(hipilotTmp, f);
      if (existsSync(src)) {
        try {
          copyFileSync(src, join(logsDir, `hipilot_${f}`));
        } catch { /* skip */ }
      }
    }

    // Collect execution history
    const histDir = join(this._projectRoot(), '.hipilot', 'history');
    if (existsSync(histDir)) {
      try {
        const histFiles = readdirSync(histDir)
          .sort()
          .slice(-20);
        for (const f of histFiles) {
          try {
            copyFileSync(join(histDir, f), join(logsDir, `history_${f}`));
          } catch { /* skip */ }
        }
        this._runLog(`History collected: ${histFiles.length} files`);
      } catch { /* skip */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EVIDENCE CORRELATOR — Timeline linking video ↔ panes ↔ MCP
  // ═══════════════════════════════════════════════════════════════════

  _buildTimeline() {
    this._runLog('Building correlated evidence timeline...');
    const timeline = [];

    // 1. Add observation points (screenshots + pane captures)
    for (const obs of this.observations) {
      timeline.push({
        timestamp: obs.timestamp,
        elapsed_s: obs.video_offset_s,
        video_offset_s: obs.video_offset_s,
        source: 'observation',
        event: obs.name,
        detail: obs.context,
        artifacts: obs.artifacts,
      });
    }

    // 2. Add pane log entries
    for (const entry of this._paneLog) {
      timeline.push({
        timestamp: entry.timestamp,
        elapsed_s: entry.elapsed_s,
        video_offset_s: entry.video_offset_s,
        source: 'pane_capture',
        event: entry.label,
        detail: {
          claude_lines: entry.claude_lines,
          eda_lines: entry.eda_lines,
          claude_last_line: entry.claude_last10.split('\n').slice(-1)[0] || '',
          eda_last_line: entry.eda_last10.split('\n').slice(-1)[0] || '',
        },
      });
    }

    // 3. Add MCP log entries (post-test collection)
    const mcpLogFile = join(this.evidenceDir, 'logs', 'mcp_calls.jsonl');
    if (existsSync(mcpLogFile)) {
      const lines = readFileSync(mcpLogFile, 'utf-8').split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const entryTime = new Date(entry.ts).getTime();
          timeline.push({
            timestamp: entry.ts,
            elapsed_s: this.recordingStartTime ? (entryTime - this.recordingStartTime) / 1000 : null,
            video_offset_s: this.recordingStartTime ? (entryTime - this.recordingStartTime) / 1000 : null,
            source: 'mcp_log',
            event: `${entry.server}.${entry.tool || entry.event}`,
            detail: {
              status: entry.status,
              duration_ms: entry.duration_ms,
              error: entry.error || null,
            },
          });
        } catch { /* skip malformed lines */ }
      }
    }

    // 4. Add run log entries
    for (const line of this._runLogLines) {
      const match = line.match(/^\[(.+?)\] (.+)$/);
      if (match) {
        const ts = match[1];
        const entryTime = new Date(ts).getTime();
        timeline.push({
          timestamp: ts,
          elapsed_s: this.recordingStartTime ? (entryTime - this.recordingStartTime) / 1000 : null,
          video_offset_s: this.recordingStartTime ? (entryTime - this.recordingStartTime) / 1000 : null,
          source: 'hitestbot',
          event: match[2].slice(0, 100),
        });
      }
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    writeFileSync(
      join(this.evidenceDir, 'timeline.jsonl'),
      timeline.map(e => JSON.stringify(e)).join('\n') + '\n'
    );
    this._runLog(`Timeline built: ${timeline.length} events`);

    return timeline;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PHASES (same as before, now with recording/screenshots/logging)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Launch HiPilot the way a human does:
   *   1. Open a terminal on the desktop (display :0)
   *   2. Run bin/hipilot inside it
   *   3. The tmux workspace appears on screen — visible to ffmpeg
   *
   * A human opens a terminal, types "bin/hipilot", and the layout pops up.
   * HiTestBot does the same thing with xterm on display :0.
   */
  /**
   * Kill all stale processes from previous test runs.
   * Stale EDA tools lock database files. Stale tmux sessions confuse the workspace.
   * Stale ffmpeg processes hold display :0. Must clean thoroughly.
   */
  _cleanStaleProcesses() {
    this._runLog('Cleaning stale processes...');
    const cmds = [
      // Kill all EDA tools
      'pkill -9 -f "innovus" 2>/dev/null || true',
      'pkill -9 -f "icc2_shell" 2>/dev/null || true',
      'pkill -9 -f "pt_shell" 2>/dev/null || true',
      'pkill -9 -f "dc_shell" 2>/dev/null || true',
      'pkill -9 -f "tempus" 2>/dev/null || true',
      'pkill -9 -f "genus" 2>/dev/null || true',
      'pkill -9 -f "voltus" 2>/dev/null || true',
      // Kill Claude Code and related processes
      'pkill -9 -f "claude" 2>/dev/null || true',
      'pkill -9 -f "claude-code" 2>/dev/null || true',
      // Kill all tmux sessions for this socket
      `tmux -L ${this.socket} kill-server 2>/dev/null || true`,
      'pkill -9 -f "tmux.*hipilot" 2>/dev/null || true',
      // Kill video recording
      'pkill -9 -f "ffmpeg.*x11grab" 2>/dev/null || true',
      'pkill -9 -f "ffmpeg.*hipilot" 2>/dev/null || true',
      // Kill any lingering node processes from MCP servers
      'pkill -9 -f "node.*hipilot.*server" 2>/dev/null || true',
    ];
    for (const cmd of cmds) {
      try { execSync(cmd, { encoding: 'utf-8', timeout: 5000 }); } catch { /* ignore */ }
    }
    this._runLog('Stale processes cleaned');
  }

  async launchHiPilot(cleanDesignDir = null) {
    this._runLog('Phase 1: Launching HiPilot...');

    // Kill ALL stale processes (EDA tools, tmux, ffmpeg) — critical for clean test
    this._cleanStaleProcesses();
    // Short wait for processes to die (pkill -9 is fast, 500ms is enough)
    await this._sleep(500);

    const binPath = this.hipilotBin || join(this._projectRoot(), 'bin', 'hipilot');
    const projectDir = this._projectRoot();

    // Build env vars - include clean design directory if provided
    // Ensure PATH includes common Node.js locations for claude CLI
    const nodePaths = '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/usr/local/bin:/usr/bin:/bin';
    const envVars = {
      ...process.env,
      HIPILOT_SESSION: this.session,
      HIPILOT_TEST_LOG: this.mcpLogPath,
      PATH: process.env.PATH ? `${process.env.PATH}:${nodePaths}` : nodePaths,
    };
    if (cleanDesignDir) {
      envVars.HIPILOT_DESIGN_DIR = cleanDesignDir;
    }

    // Step 1: Create the tmux session (headless — reliable)
    try {
      const output = execSync(`bash ${binPath} --no-terminal 2>&1`, {
        encoding: 'utf-8', timeout: 300000,
        env: envVars,
      });
      this._runLog(`bin/hipilot --no-terminal output:\n${output}`);
    } catch (e) {
      const stdout = e.stdout ? e.stdout.toString() : '';
      const stderr = e.stderr ? e.stderr.toString() : '';
      this._runLog(`bin/hipilot failed: ${e.message}`);
      this._runLog(`stdout: ${stdout}`);
      this._runLog(`stderr: ${stderr}`);
      throw new Error(`Failed to launch HiPilot: ${e.message}\nstdout: ${stdout}\nstderr: ${stderr}`);
    }

    // Step 2: Verify session exists
    try {
      execSync(`tmux -L ${this.socket} has-session -t ${this.session}`, {
        encoding: 'utf-8', timeout: 5000,
      });
      this._runLog('tmux session verified');
    } catch {
      throw new Error('HiPilot tmux session not found after launch');
    }

    // Step 3: Open a terminal window on the desktop that attaches to the session.
    // This is what makes HiPilot VISIBLE on screen — just like a human would see it.
    // The terminal shows the two-pane tmux layout. ffmpeg records it.
    // HiTestBot still interacts via tmux send-keys (works regardless of the terminal).
    this._openTerminalOnDesktop();

    // Step 4: Early cheat detection — verify real Claude processes are running
    // This catches the "echo" cheat where fake status messages are printed
    this._runLog('Verifying authentic Claude processes...');
    await this._sleep(3000); // Wait for processes to start

    const earlyCheatCheck = new CheatDetector({
      socket: this.socket,
      session: this.session,
    });

    // For dynamic team creation, we only expect 1 process (Supervisor) initially
    // The other 4 agents will be spawned by Supervisor via TeamCreate API
    const processCheck = earlyCheatCheck.verifyClaudeProcesses(1);
    if (!processCheck.valid) {
      this._runLog(`⚠️ CHEAT DETECTED EARLY: ${processCheck.message}`);
      throw new Error(`Cheat detected: ${processCheck.message}`);
    }

    this._runLog(`✓ Verified ${processCheck.count} Claude processes running`);

    return true;
  }

  /**
   * Open a terminal window on display :0 and attach to the HiPilot tmux session.
   * This makes the workspace visible on the EDA server's desktop.
   * A human would see the same layout pop up in their terminal.
   */
  _openTerminalOnDesktop() {
    const attachCmd = `tmux -L ${this.socket} attach-session -t ${this.session}`;

    // Detect screen resolution BEFORE opening terminal
    let screenW = 1920, screenH = 1080;
    try {
      const res = execSync(`DISPLAY=${this.display} xdpyinfo 2>/dev/null | grep dimensions | awk '{print $2}'`, {
        encoding: 'utf-8', timeout: 5000, shell: true,
      }).trim();
      if (res.includes('x')) {
        const [w, h] = res.split('x').map(Number);
        if (w > 0 && h > 0) { screenW = w; screenH = h; }
      }
    } catch { /* use defaults */ }

    try {
      execSync(`which gnome-terminal 2>/dev/null`, { encoding: 'utf-8', timeout: 2000 });
    } catch {
      this._runLog(`WARNING: gnome-terminal not found.`);
      return;
    }

    // 80% of desktop. Convert pixels to terminal cols×rows.
    // Monospace font on CentOS 7 gnome-terminal: ~8px wide, ~17px tall
    const cols = Math.round(screenW * 0.8 / 8);
    const rows = Math.round(screenH * 0.8 / 17);

    execSync(`DISPLAY=${this.display} gnome-terminal --title=HiPilot --geometry=${cols}x${rows} -- ${attachCmd} &`, {
      encoding: 'utf-8', timeout: 5000,
      env: { ...process.env, DISPLAY: this.display },
      shell: true,
    });
    this._runLog(`Opened gnome-terminal: ${cols}x${rows} chars (80% of ${screenW}x${screenH})`);

    // Center the window. Try xdotool first (more reliable on CentOS 7), wmctrl as fallback.
    try {
      execSync('sleep 0.5', { timeout: 5000 });
      const winW = Math.round(screenW * 0.8);
      const winH = Math.round(screenH * 0.8);
      const posX = Math.round((screenW - winW) / 2);
      const posY = Math.round((screenH - winH) / 2);
      execSync(
        `DISPLAY=${this.display} xdotool search --name HiPilot windowmove ${posX} ${posY} windowsize ${winW} ${winH} 2>/dev/null || ` +
        `DISPLAY=${this.display} wmctrl -r HiPilot -e 0,${posX},${posY},${winW},${winH} 2>/dev/null || true`,
        { encoding: 'utf-8', timeout: 5000, shell: true }
      );
      this._runLog(`Window centered at (${posX},${posY}), size ${winW}x${winH}`);
    } catch {
      this._runLog('Window centering failed — uses default position');
    }
  }

  /**
   * Update MCP settings.json on the EDA server with HIPILOT_DESIGN_DIR.
   * This is CRITICAL because MCP servers get their environment from settings.json,
   * not from the shell environment.
   */
  async _updateMcpSettings(designDir) {
    // SECURITY: Credentials MUST be provided via environment variables
    const SSH_HOST = process.env.HIPILOT_SSH_HOST;
    const SSH_PASS = process.env.HIPILOT_SSH_PASS;

    if (!SSH_HOST || !SSH_PASS) {
      throw new Error('HIPILOT_SSH_HOST and HIPILOT_SSH_PASS environment variables must be set');
    }

    const REMOTE_SETTINGS = '/home/EDA/.claude/settings.json';

    // HiPilot code directory - always use the deployed version
    const hipilotDir = '/home/EDA/hipilot/current';

    try {
      // Read current settings from EDA server
      const readCmd = `SSHPASS=${SSH_PASS} sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_HOST} 'cat ${REMOTE_SETTINGS} 2>/dev/null || echo "{}"'`;
      const settingsJson = execSync(readCmd, { encoding: 'utf-8', timeout: 15000 });
      const settings = JSON.parse(settingsJson);

      // Patch each MCP server to include HIPILOT_DESIGN_DIR in env
      const mcpServers = settings.mcpServers || {};
      for (const serverName of Object.keys(mcpServers)) {
        if (!mcpServers[serverName].env) {
          mcpServers[serverName].env = {};
        }
        mcpServers[serverName].env.HIPILOT_DESIGN_DIR = designDir;

        // CRITICAL: Update MCP server paths to use freshly deployed code
        if (serverName === 'hipilot-eda') {
          mcpServers[serverName].args = [`${hipilotDir}/servers/eda/index.js`];
        } else if (serverName === 'hipilot-tmux') {
          mcpServers[serverName].args = [`${hipilotDir}/servers/tmux/index.js`];
        } else if (serverName === 'hipilot-knowledge') {
          mcpServers[serverName].args = [`${hipilotDir}/servers/knowledge/index.js`];
        }
      }

      // Also ensure global env section has it (for newer Claude Code versions)
      if (!settings.env) {
        settings.env = {};
      }
      settings.env.HIPILOT_DESIGN_DIR = designDir;

      // Write updated settings back to EDA server
      const updatedJson = JSON.stringify(settings, null, 2);
      const writeCmd = `SSHPASS=${SSH_PASS} sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_HOST} 'cat > ${REMOTE_SETTINGS}' << 'EOFSETTINGS'\n${updatedJson}\nEOFSETTINGS`;
      execSync(writeCmd, { encoding: 'utf-8', timeout: 15000 });

      this._runLog(`MCP settings.json updated with HIPILOT_DESIGN_DIR=${designDir}`);
      this._runLog(`MCP servers now using code from: ${hipilotDir}`);
    } catch (err) {
      this._runLog(`WARNING: Failed to update MCP settings.json: ${err.message}`);
      this._runLog('MCP servers may use default design directory instead of clean directory');
      // Don't throw - we can still try to run the test
    }
  }

  async waitForClaudeReady() {
    this._runLog('Phase 2: Waiting for Claude Code to be ready (prompt + MCP servers)...');
    const start = Date.now();
    let attempt = 0;
    let promptDetectedTime = null;

    while (Date.now() - start < CLAUDE_READY_TIMEOUT_MS) {
      const claudeOutput = this._capturePane('0.0');
      const lines = claudeOutput.split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1] || '';

      // Check for fatal errors first
      if (claudeOutput.includes('Claude CLI not found')) {
        this._runLog('Claude CLI not installed — left pane shows fallback');
        return false;
      }

      // Claude Code prompt detected
      const hasPrompt = claudeOutput.includes('❯') ||
        claudeOutput.includes('Welcome') ||
        claudeOutput.includes('Claude Code');

      // MCP servers are ready when we see tool output patterns
      // This indicates MCP servers have initialized and are responding
      const mcpReady = /mcp__hipilot-|eda\.(detect_tool|get_status|start_tool)/i.test(claudeOutput) ||
        /MCP.*tool|tools\/list|server.*ready/i.test(claudeOutput);

      if (hasPrompt && !promptDetectedTime) {
        promptDetectedTime = Date.now();
        this._runLog(`Prompt detected after ${((promptDetectedTime - start) / 1000).toFixed(1)}s, waiting for MCP servers...`);
      }

      // Consider ready when:
      // 1. Prompt is visible AND
      // 2. Either MCP tools are responding OR we've waited 10s after prompt (give MCP time to init)
      const timeSincePrompt = promptDetectedTime ? Date.now() - promptDetectedTime : 0;
      const isReady = hasPrompt && (mcpReady || timeSincePrompt > 10000);

      if (isReady) {
        const elapsed = (Date.now() - start) / 1000;
        const mcpStatus = mcpReady ? 'MCP ready' : 'MCP timeout (proceeding anyway)';
        this._runLog(`Claude Code ready (${elapsed.toFixed(1)}s), ${mcpStatus}, captured ${claudeOutput.length} chars`);
        return true;
      }

      // Exponential backoff: start fast (1s), gradually increase to max (3s)
      attempt++;
      const delayMs = Math.min(1000 * Math.min(attempt, 3), 3000);
      await this._sleep(delayMs);
    }

    this._runLog(`Claude Code not ready after ${CLAUDE_READY_TIMEOUT_MS / 1000}s`);
    return false;
  }

  typeInHiPilot(text) {
    // SECURITY: Validate input against allowlist
    const allowedPattern = /^[a-zA-Z0-9_\-\/\s\.:;,"'`!?@#$%\^\&*()\[\]{}=+\<\>\|\~`]+$/;
    if (!allowedPattern.test(text)) {
      this._runLog(`Rejected invalid command characters: "${text}"`);
      return false;
    }

    // Block dangerous command patterns
    const dangerousPatterns = [
      /;\s*rm\s+/i, /;\s*sudo\s+/i, /;\s*dd\s+/i,
      />\s*\/dev\/null/i, /2>&1.*\/dev\/null/i,
      /\$\(/, /`/, /\|\s*sh\s*$/i, /\|\s*bash\s*$/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        this._runLog(`Rejected dangerous command pattern: "${text}"`);
        return false;
      }
    }

    const target = `${this.session}:0.0`;
    // Use spawnSync with array args instead of shell string for better security
    try {
      const result1 = spawnSync('tmux', ['-L', this.socket, 'send-keys', '-t', target, '-l', text], {
        encoding: 'utf-8', timeout: 5000,
      });
      if (result1.error) throw result1.error;

      const result2 = spawnSync('tmux', ['-L', this.socket, 'send-keys', '-t', target, 'C-m'], {
        encoding: 'utf-8', timeout: 5000,
      });
      if (result2.error) throw result2.error;

      this._runLog(`Typed: "${text}"`);
      return true;
    } catch (e) {
      this._runLog(`Failed to type: ${e.message}`);
      return false;
    }
  }

  /**
   * Detect what state Claude is in — a human reads the screen and knows.
   *
   * States:
   *   'working'         — Claude is producing output (left pane changing)
   *   'waiting_for_eda' — Left pane idle but right pane still changing (EDA tool running)
   *   'asking_question' — Claude asked the human something
   *   'needs_approval'  — Manual mode, pending Tcl waiting for prefix+y
   *   'bypass_permissions' — Claude Code dangerous mode permission prompt
   *   'done'            — Claude's input prompt reappeared (ready for next command)
   *   'error'           — Something fundamentally broken (MCP not found, etc.)
   *   'idle'            — Both panes idle, no prompt detected
   */
  _detectState(claude, eda, claudeChanged, edaChanged, recentClaudeOutputs = []) {
    const claudeLines = claude.split('\n').filter(l => l.trim());
    const lastLine = claudeLines[claudeLines.length - 1] || '';

    // Check EDA pane for tool prompt (innovus N>, icc2_shell>, $)
    const edaLines = eda.split('\n').filter(l => l.trim());
    const edaLastLine = edaLines[edaLines.length - 1] || '';
    const edaPromptReady = /innovus\s*\d+>/i.test(edaLastLine) ||
      /icc2_shell>/i.test(edaLastLine) ||
      /pt_shell>/i.test(edaLastLine) ||
      /\$\s*$/.test(edaLastLine);

    // Check for fatal errors first — a human would notice and stop
    for (const pat of EARLY_ABORT_PATTERNS) {
      if (pat.test(claude)) return { state: 'error', detail: claude.match(pat)[0] };
    }

    // Check for Claude's ready prompt — the cursor is blinking at ❯ or >
    // This is the clearest signal: Claude finished and is waiting for next input
    const claudePromptReady = /^[>❯]\s*$/.test(lastLine) ||
      /^❯\s/.test(lastLine) ||
      lastLine.includes('What can I help') ||
      lastLine.includes('How can I help');

    // Check for bypass permissions prompt (Claude Code dangerous mode) — CRITICAL
    // This must be checked BEFORE thinking/working states
    // BUT only if Claude is NOT already ready (avoid matching old scrollback text)
    if (!claudePromptReady && /bypass permissions|Dangerous mode|⏵⏵/.test(claude)) {
      return { state: 'bypass_permissions' };
    }

    // Approval is no longer needed (mode is always auto), but detect if it appears
    if (this._needsApproval(claude)) return { state: 'needs_approval', detail: 'unexpected approval prompt' };

    // Check for Claude asking a question
    for (const pat of QUESTION_PATTERNS) {
      if (pat.test(lastLine) || pat.test(claudeLines.slice(-3).join('\n'))) {
        return { state: 'asking_question', detail: lastLine };
      }
    }

    // Check if Claude is actively thinking (spinner visible)
    const claudeThinking = /thinking|Drizzling|Working|Generating/i.test(lastLine) ||
      /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✶●◉⠿]/.test(lastLine);

    // Track stage completion - extract stage numbers from "Stage X COMPLETE" or "Stage X completed" messages
    // Use matchAll to find ALL stage completions, keeping the highest stage number
    // Matches: "STAGE 3 COMPLETE", "Stage 2 completed successfully", "Stage 4 Complete"
    const stageCompletionRegex = /Stage\s+(\d+)\s+(?:COMPLETE|completed|Complete)/gi;
    let stageMatch;
    let matchCount = 0;
    while ((stageMatch = stageCompletionRegex.exec(claude)) !== null) {
      matchCount++;
      const stageNum = parseInt(stageMatch[1], 10);
      if (stageNum > this._lastCompletedStage) {
        this._lastCompletedStage = stageNum;
        this._runLog(`Stage ${stageNum} completion detected (match #${matchCount})`);
      }
    }
    if (matchCount > 0) {
      this._runLog(`Stage regex found ${matchCount} matches, lastCompletedStage=${this._lastCompletedStage}`);
    }

    // Check for stage completion message (various formats)
    const stageComplete = /Stage\s+\d+\s+(?:COMPLETE|completed|Complete)/i.test(claude);

    // Check for full RTL2GDS flow completion - Stage 9 is the final stage
    // Only mark as complete when Stage 9 is done AND Claude is at prompt
    const rtl2gdsComplete = this._lastCompletedStage >= 9 && claudePromptReady && !claudeThinking;

    // Check if Claude is just monitoring (only doing eda.peek/get_status)
    // A human would recognize this pattern: repeated "👁️ EDA Pane Snapshot" with similar content
    const isMonitoringPattern = recentClaudeOutputs.length >= 3 &&
      recentClaudeOutputs.every(out => /👁️.*EDA Pane Snapshot|eda\.(peek|get_status)/i.test(out));

    // Check if Claude just said "Proceeding to Stage..." - if so, don't treat as done
    // This happens between stages when Claude is preparing the next stage
    const justProceeding = /Proceeding to Stage \d+/i.test(claude) &&
      claudePromptReady && !claudeChanged;

    // For RTL2GDS flow, don't mark as done until Stage 9 is complete
    // For other flows, use the normal prompt detection
    const isRtl2gdsFlow = /rtl2gds|RTL.to.GDS/i.test(claude);
    const rtl2gdsDone = isRtl2gdsFlow && this._lastCompletedStage >= 9 && claudePromptReady;

    // If Claude shows prompt AND (pane didn't change OR only monitoring) → done
    // BUT not if we just saw "Proceeding to Stage..." (between stages)
    // AND for RTL2GDS, require Stage 9 to be complete
    if (claudePromptReady && (!claudeChanged || isMonitoringPattern) && !justProceeding) {
      // For RTL2GDS flow, only exit if Stage 9 is done OR we've been idle for a while
      if (isRtl2gdsFlow && this._lastCompletedStage < 9) {
        // Still in middle of RTL2GDS flow - don't mark as done yet
        return { state: 'idle', detail: `Claude prompt visible but only Stage ${this._lastCompletedStage} complete` };
      }
      return { state: 'done', detail: `Claude prompt: "${lastLine.trim()}"` };
    }

    // If EDA prompt is back AND Claude has been only monitoring → EDA done, Claude should respond
    if (edaPromptReady && isMonitoringPattern && !claudeThinking) {
      return { state: 'done', detail: 'EDA complete, Claude monitoring finished' };
    }

    // Stage completion is a strong signal of done
    if (stageComplete && !claudeThinking) {
      return { state: 'done', detail: 'Stage completion detected' };
    }

    // Full RTL2GDS flow completion - early termination to avoid long timeout
    if (rtl2gdsComplete && !claudeThinking) {
      return { state: 'done', detail: 'RTL2GDS flow complete (all 9 stages + GDS)', earlyCompletion: true };
    }

    // Claude is actively thinking — definitely working
    if (claudeThinking) {
      return { state: 'working', detail: 'thinking' };
    }

    // If only doing monitoring pattern, consider it "waiting" not "working"
    if (isMonitoringPattern) {
      if (edaChanged) {
        return { state: 'waiting_for_eda', detail: 'Claude monitoring, EDA running' };
      }
      if (edaPromptReady) {
        return { state: 'done', detail: 'EDA prompt ready, Claude monitoring' };
      }
      return { state: 'idle', detail: 'Claude monitoring, waiting for EDA' };
    }

    // Claude pane changed with real work (not just monitoring)
    if (claudeChanged) {
      return { state: 'working', detail: 'output changing' };
    }

    // Left pane idle but right pane changing — EDA tool is executing
    if (!claudeChanged && edaChanged) {
      return { state: 'waiting_for_eda', detail: edaPromptReady ? 'EDA prompt returned' : 'EDA running' };
    }

    // Both panes idle but EDA prompt not ready — EDA is still running
    if (!claudeChanged && !edaChanged && !edaPromptReady) {
      return { state: 'waiting_for_eda', detail: 'EDA running (no prompt yet)' };
    }

    // Both panes idle. Check if EITHER has a ready prompt — that's a strong signal
    if (claudePromptReady) {
      return { state: 'done', detail: 'Claude prompt visible, both panes quiet' };
    }

    return { state: 'idle', detail: `claude: "${lastLine.trim().slice(0, 40)}", eda: "${edaLastLine.trim().slice(0, 40)}"` };
  }

  async watchFlow(options = {}) {
    const maxWaitMs = options.maxWaitMs || MAX_WATCH_MS;
    this._runLog(`Phase 4: Watching flow (max ${maxWaitMs / 1000}s, terminates on prompt detection)...`);

    // Initialize heartbeat monitoring (if available)
    const heartbeatStarted = this._startHeartbeatWatch();
    if (heartbeatStarted) {
      this._runLog('Heartbeat monitoring active — using event-driven polling');
    } else if (HEARTBEAT_ENABLED) {
      this._runLog('Heartbeat not available — using standard polling');
    }

    const start = Date.now();
    let lastClaudeOutput = '';
    let lastEdaOutput = '';
    let lastClaudeChangeTime = start;
    let lastEdaChangeTime = start;
    let approvalCount = 0;
    let questionCount = 0;
    let pollCount = 0;
    let lastState = 'working';
    let heartbeatWakeups = 0; // Track how many times heartbeat woke us up

    // Adaptive timeout: extend when stages complete (rewards progress)
    let currentMaxWaitMs = maxWaitMs;
    let lastCompletedStageAtStart = this._lastCompletedStage || 0;
    let extensionsUsed = 0;
    const MAX_EXTENSIONS = 3; // Max 3 extensions (e.g., 5min → 20min total)

    // Track recent Claude outputs to detect monitoring pattern (eda.peek loops)
    const recentClaudeOutputs = [];
    const MONITORING_WINDOW = 5; // Keep last 5 outputs to detect pattern

    while (Date.now() - start < currentMaxWaitMs) {
      // Use human-like polling interval (with jitter to avoid mechanical patterns)
      const pollInterval = this._getHumanPollInterval(lastState);
      await this._sleep(pollInterval);
      pollCount++;

      // Check if heartbeat woke us up (new state available)
      if (this._heartbeatAvailable && this._lastHeartbeat) {
        const hb = this._lastHeartbeat;
        const hbAge = Date.now() - hb.timestamp;

        // If heartbeat indicates idle/complete and it's fresh, we can react faster
        if (hbAge < HEARTBEAT_MAX_AGE_MS && (hb.state === 'idle' || hb.state === 'complete')) {
          heartbeatWakeups++;
          // When heartbeat says EDA is idle, check more aggressively
          if (lastState === 'waiting_for_eda' && hb.state === 'idle') {
            this._runLog(`Heartbeat: EDA idle detected (${hbAge}ms ago)`);
          }
        }
      }

      // Log both panes continuously — this is what a human sees (parallel capture)
      const panes = await this._logPanesParallel(`poll_${pollCount}`);

      // Track what changed — a human notices when text appears or stops
      const claudeChanged = panes.claude !== lastClaudeOutput;
      const edaChanged = panes.eda !== lastEdaOutput;
      if (claudeChanged) { lastClaudeChangeTime = Date.now(); lastClaudeOutput = panes.claude; }
      if (edaChanged) { lastEdaChangeTime = Date.now(); lastEdaOutput = panes.eda; }

      // Track recent outputs for monitoring pattern detection
      if (claudeChanged) {
        recentClaudeOutputs.push(panes.claude);
        if (recentClaudeOutputs.length > MONITORING_WINDOW) {
          recentClaudeOutputs.shift();
        }
      }

      // Detect state — what would a human see?
      const { state, detail, earlyCompletion } = this._detectState(panes.claude, panes.eda, claudeChanged, edaChanged, recentClaudeOutputs);

      // Adaptive timeout extension: reward progress with more time
      const stagesCompleted = this._lastCompletedStage || 0;
      if (stagesCompleted > lastCompletedStageAtStart && extensionsUsed < MAX_EXTENSIONS) {
        const extension = 600000; // +10 minutes per stage completion
        currentMaxWaitMs += extension;
        extensionsUsed++;
        lastCompletedStageAtStart = stagesCompleted;
        this._runLog(`Stage ${stagesCompleted} complete — timeout extended by ${extension / 1000}s (now ${(currentMaxWaitMs / 1000).toFixed(0)}s max)`);
      }

      // Early termination if completion detected
      if (earlyCompletion) {
        this._runLog('Early completion detected — stopping watch');
        this._takeScreenshot('flow_done_early');
        break;
      }

      if (state !== lastState) {
        this._runLog(`State: ${lastState} → ${state}${detail ? ` (${detail})` : ''}`);
        lastState = state;
      }

      // Smart throttling: Adjust screenshot/observation frequency based on state
      // During EDA execution, we don't need frequent screenshots (EDA output changes slowly)
      // When Claude is working, capture more frequently to catch key moments
      const isEdaRunning = state === 'waiting_for_eda';
      const isActive = state === 'working' || claudeChanged || edaChanged;

      // Use state-appropriate intervals
      const screenshotInterval = isEdaRunning ? SCREENSHOT_INTERVAL_POLLS : FAST_SCREENSHOT_INTERVAL;
      const observationInterval = isEdaRunning ? OBSERVATION_INTERVAL_POLLS : FAST_OBSERVATION_INTERVAL;

      // Human-like screenshot: take at meaningful moments, not just periodically
      const screenshotContext = {
        stateChange: state !== lastState,
        errorDetected: state === 'error',
        completion: earlyCompletion || state === 'done',
      };
      if (this._shouldTakeScreenshot(screenshotContext)) {
        this._takeScreenshot(`progress_${pollCount}`);
        this._recordScreenshot();
      }

      // Only capture observation point at intervals and when there's activity (or EDA running)
      if (pollCount % observationInterval === 0 && (isActive || isEdaRunning)) {
        const obs = await ObservationPoint.capture(`PROGRESS_${pollCount}`, {
          evidenceDir: this.evidenceDir,
          session: this.session,
          socket: this.socket,
          recordingStartTime: this.recordingStartTime,
          display: this.display,
          context: { poll: pollCount, state, elapsed_s: Math.round((Date.now() - start) / 1000) },
        });
        this.observations.push(obs);
      }

      // React based on state — what would a human do?

      if (state === 'needs_approval') {
        this._runLog('Approval needed — pressing prefix+y');
        this._takeScreenshot(`approval_${approvalCount}`);
        this._pressApproval();
        approvalCount++;
        lastClaudeChangeTime = Date.now();
        continue;
      }

      if (state === 'bypass_permissions') {
        this._runLog('Bypass permissions prompt detected — enabling dangerous mode');
        this._takeScreenshot('bypass_permissions');
        // Navigate to checkbox (Tab), toggle (Space), confirm (Enter)
        this._sendKeysToClaude('Tab');
        await this._sleep(100);
        this._sendKeysToClaude(' ');
        await this._sleep(100);
        this._sendKeysToClaude('C-m');
        await this._sleep(200);
        lastClaudeChangeTime = Date.now();
        continue;
      }

      if (state === 'asking_question') {
        // Smart response based on question type
        let response = 'yes';
        const questionLower = detail.toLowerCase();
        const claudeContentLower = claude.toLowerCase();

        // Multiple choice questions about synthesis waiting
        if (/would you like me to.*wait.*synthesis|wait for.*complete|check.*status/i.test(claudeContentLower)) {
          // For "Would you like me to: 1. Wait... 2. Start... 3. Check..." - choose option 1 (wait)
          response = '1';
          this._runLog(`Claude asked multiple choice — responding "${response}" (wait for synthesis)`);
        } else if (/which.*option|choose.*\d|select.*\d|1\.|2\.|3\./i.test(claudeContentLower)) {
          // Generic multiple choice - select option 1
          response = '1';
          this._runLog(`Claude asked multiple choice — responding "${response}"`);
        } else {
          this._runLog(`Claude asked: "${detail}" — responding "${response}"`);
        }

        this._takeScreenshot(`question_${questionCount}`);
        this.typeInHiPilot(response);
        questionCount++;
        lastClaudeChangeTime = Date.now();
        continue;
      }

      if (state === 'error') {
        this._runLog(`Early abort: ${detail}`);
        this._takeScreenshot('error_abort');
        break;
      }

      if (state === 'done') {
        this._runLog('Claude is done (input prompt reappeared)');
        this._takeScreenshot('flow_done');
        break;
      }

      if (state === 'working') {
        // Claude is producing output — keep watching
      }

      if (state === 'waiting_for_eda') {
        // EDA tool is running. A human waits — but check if EDA actually completed
        // If EDA pane shows prompt and hasn't changed for a while, EDA is done
        const edaQuietTime = Date.now() - lastEdaChangeTime;
        // Check if EDA prompt is ready (innovus N>, icc2_shell>, pt_shell>, or $)
        const edaLines = lastEdaOutput.split('\n').filter(l => l.trim());
        const edaLastLine = edaLines[edaLines.length - 1] || '';
        const edaPromptReady = /innovus\s*\d+>/i.test(edaLastLine) ||
          /icc2_shell>/i.test(edaLastLine) ||
          /pt_shell>/i.test(edaLastLine) ||
          /\$\s*$/.test(edaLastLine);
        if (edaQuietTime > 5000 && edaPromptReady && !claudeChanged) {
          // EDA has been quiet with prompt visible for 5s — likely done, Claude should respond
          this._runLog('EDA appears complete (prompt visible, no changes for 5s)');
        }
      }

      if (state === 'idle') {
        // Both panes quiet, no prompt detected. Check how long:
        const quietTime = Math.min(Date.now() - lastClaudeChangeTime, Date.now() - lastEdaChangeTime);
        // Aggressive stuck detection: 30s is enough to know something is wrong (was 120s)
        if (quietTime > 30000 && pollCount > 10) {
          this._runLog(`Both panes quiet for ${(quietTime / 1000).toFixed(0)}s with no prompt — may be stuck`);
          this._takeScreenshot(`quiet_${pollCount}`);
        }
        // Critical stuck detection: If quiet for 60s, something is definitely wrong
        if (quietTime > 60000 && pollCount > 20) {
          this._runLog(`STUCK DETECTED: No activity for 60s — aborting watch`);
          break;
        }
      }

      // Progress log
      if (pollCount % 3 === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        const claudeIdle = ((Date.now() - lastClaudeChangeTime) / 1000).toFixed(0);
        const edaIdle = ((Date.now() - lastEdaChangeTime) / 1000).toFixed(0);
        this._runLog(`Poll ${pollCount}: ${elapsed}s, state=${state}, claude_idle=${claudeIdle}s, eda_idle=${edaIdle}s, approvals=${approvalCount}, questions=${questionCount}`);
      }
    }

    const totalTime = Date.now() - start;

    // Stop heartbeat monitoring
    this._stopHeartbeatWatch();

    // Log heartbeat stats if used
    if (this._heartbeatAvailable) {
      this._runLog(`Heartbeat stats: ${heartbeatWakeups} wakeups, reduced polling from ${POLL_INTERVALS['waiting_for_eda']}ms to ${HEARTBEAT_FALLBACK_INTERVAL_MS}ms during EDA wait`);
    }

    this._runLog(`Watch complete: ${(totalTime / 1000).toFixed(1)}s, ${approvalCount} approvals, ${questionCount} questions answered`);
    return { elapsed_ms: totalTime, approvals: approvalCount, questions: questionCount, polls: pollCount, heartbeat_wakeups: heartbeatWakeups, heartbeat_enabled: this._heartbeatAvailable };
  }

  evaluate(beforeObs, afterObs) {
    const claudeBefore = beforeObs.content?.claude_pane_last50 || '';
    const claudeAfter = afterObs.content?.claude_pane_last50 || '';
    const edaAfter = afterObs.content?.eda_pane_last50 || '';

    // ═══════════════════════════════════════════════════════════════════
    //  UNIVERSITY-STYLE SCORING SYSTEM
    //
    //  Like a university transcript with multiple subjects:
    //  - Each subject has a raw score (0-100) and letter grade (A-F)
    //  - GPA is calculated from letter grades
    //  - Final assessment considers all subjects
    //
    //  Subjects (dimensions of evaluation):
    //  1. Communication (L1-L2) - Did Claude understand and respond?
    //  2. Methodology (L3) - Did Claude use correct tools/interface?
    //  3. Process Validation - Did Claude use the RIGHT tool for each stage?
    //  4. Execution (L4) - Did the EDA tool run successfully?
    //  5. Results (L5) - Were QoR metrics reported correctly?
    // ═══════════════════════════════════════════════════════════════════

    // Raw component scores (0-1 scale)
    const response = this._scoreResponse(claudeBefore, claudeAfter);
    const intent = this._scoreIntent(claudeAfter);
    const toolUsage = this._scoreToolUsage(claudeAfter, edaAfter);
    const processValidation = this._scoreProcessValidation(claudeAfter, edaAfter);
    const edaExecution = this._scoreEdaExecution(edaAfter);
    const qor = this._scoreQoR(claudeAfter, edaAfter);

    // Subject 1: Communication (Response + Intent)
    const communication = {
      name: 'Communication',
      components: { response, intent },
      raw_score: (response.score + intent.score) / 2 * 100,
      weight: 1.0,
    };

    // Subject 2: Methodology (MCP Tool Usage)
    const methodology = {
      name: 'Methodology',
      components: { toolUsage },
      raw_score: toolUsage.score * 100,
      weight: 1.5, // Higher weight - using MCP correctly is fundamental
    };

    // Subject 3: Process Validation (Correct tool for stage)
    const process = {
      name: 'Process',
      components: { processValidation },
      raw_score: processValidation.score * 100,
      weight: 2.0, // HIGHEST weight - correct process is CRITICAL
    };

    // Subject 4: Execution (EDA tool success)
    const execution = {
      name: 'Execution',
      components: { edaExecution },
      raw_score: edaExecution.score * 100,
      weight: 1.5,
    };

    // Subject 5: Results (QoR reporting)
    const results = {
      name: 'Results',
      components: { qor },
      raw_score: qor.score * 100,
      weight: 1.0,
    };

    // Subject 6: Human-Like Quality (NEW - How human-like was the interaction?)
    // This measures the core value of HiPilot - behaving like an expert human engineer
    const humanLike = this._scoreHumanLike(claudeAfter, edaAfter);
    const humanLikeSubject = {
      name: 'Human-Like',
      components: { humanLike },
      raw_score: humanLike.score * 100,
      weight: 2.5, // HIGHEST weight - this is HiPilot's core differentiator
    };

    // Subject 7: Authenticity (NEW - Cheat detection verification)
    // This ensures all evidence is real, not fabricated or replayed
    const authenticity = this._scoreAuthenticity();
    const authenticitySubject = {
      name: 'Authenticity',
      components: { authenticity },
      raw_score: authenticity.score * 100,
      weight: 10.0, // CRITICAL weight - cheating is an automatic fail regardless of other scores
    };

    // All subjects for GPA calculation
    const subjects = [communication, methodology, process, execution, results, humanLikeSubject, authenticitySubject];

    // Calculate letter grades and grade points for each subject
    for (const subject of subjects) {
      subject.grade = this._scoreToLetter(subject.raw_score);
      subject.grade_points = this._letterToGradePoints(subject.grade);
      subject.status = subject.raw_score >= 60 ? 'PASS' : 'FAIL';
    }

    // Calculate weighted GPA (0.0 - 4.0 scale)
    const totalWeight = subjects.reduce((sum, s) => sum + s.weight, 0);
    const weightedGradePoints = subjects.reduce((sum, s) => sum + (s.grade_points * s.weight), 0);
    const gpa = weightedGradePoints / totalWeight;

    // Calculate overall percentage
    const totalRawScore = subjects.reduce((sum, s) => sum + s.raw_score, 0);
    const overallPercentage = totalRawScore / subjects.length;

    // ═══════════════════════════════════════════════════════════════════
    // VETO POWER: CheatDetector has absolute authority to fail the test
    // regardless of any other scores. If critical cheats detected = AUTO FAIL.
    // ═══════════════════════════════════════════════════════════════════
    const hasVeto = authenticitySubject.raw_score === 0;
    let finalGrade;
    let assessment;
    if (hasVeto) {
      // Override all assessments - cheating is an automatic fail
      finalGrade = 'F';
      assessment = {
        status: 'FAIL',
        summary: 'CHEAT DETECTOR VETO: Critical authenticity violations detected. Test automatically FAILED regardless of other scores.',
        recommendations: [
          'Review cheat_detection_report.json for details',
          'Ensure test was run with authentic HiPilot processes',
          'Check for echo commands or fabricated output',
          'Verify video recording shows actual EDA tool execution',
        ],
      };
    }

    // Final assessment (only if not vetoed)
    finalGrade = hasVeto ? 'F' : this._scoreToLetter(overallPercentage);
    assessment = hasVeto
      ? assessment
      : this._assessPerformance(subjects, gpa, finalGrade);

    // Legacy L1-L5 scores for backward compatibility
    const scores = {
      L1_prompt_delivery: response,
      L2_intent_recognition: intent,
      L3_mcp_tool_usage: toolUsage,
      L3b_process_validation: processValidation, // NEW: Process validation
      L4_eda_execution: edaExecution,
      L5_qor_assessment: qor,
    };

    // Total legacy score (for reference)
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);

    // Classification if not passing
    const classification = assessment.status !== 'PASS'
      ? this._classifyFailure(scores, claudeAfter, edaAfter)
      : null;

    return {
      stage: 'full_flow',
      // University-style transcript
      transcript: {
        subjects: subjects.map(s => ({
          name: s.name,
          score: Math.round(s.raw_score),
          grade: s.grade,
          grade_points: s.grade_points,
          weight: s.weight,
          status: s.status,
        })),
        gpa: Math.round(gpa * 100) / 100,
        overall_percentage: Math.round(overallPercentage),
        final_grade: finalGrade,
      },
      // Legacy scores (backward compatibility)
      scores,
      total_score: totalScore,
      max_score: 6.0, // Now 6 components with process validation
      // Assessment
      status: assessment.status.toLowerCase(),
      assessment: assessment.summary,
      recommendations: assessment.recommendations,
      failure_classification: classification,
      mcp_calls_count: null,
      evidence_summary: {
        claude_output_lines: claudeAfter.split('\n').length,
        eda_output_lines: edaAfter.split('\n').length,
      },
    };
  }

  /**
   * Convert percentage score to letter grade
   */
  _scoreToLetter(score) {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 67) return 'D+';
    if (score >= 63) return 'D';
    if (score >= 60) return 'D-';
    return 'F';
  }

  /**
   * Convert letter grade to grade points (GPA scale)
   */
  _letterToGradePoints(grade) {
    const scale = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0,
    };
    return scale[grade] || 0.0;
  }

  /**
   * Assess overall performance and generate recommendations
   */
  _assessPerformance(subjects, gpa, finalGrade) {
    // Critical subjects that must pass
    const criticalSubjects = ['Process', 'Methodology'];
    const failedCritical = subjects.filter(s =>
      criticalSubjects.includes(s.name) && s.status === 'FAIL'
    );

    // Generate recommendations based on subject performance
    const recommendations = [];

    for (const subject of subjects) {
      if (subject.raw_score < 60) {
        switch (subject.name) {
          case 'Process':
            recommendations.push('CRITICAL: Review RTL2GDS flow stages and tool usage. Synthesis requires dc_shell, physical design requires innovus.');
            break;
          case 'Methodology':
            recommendations.push('Improve MCP tool usage - avoid direct bash/tmux commands.');
            break;
          case 'Execution':
            recommendations.push('Check EDA tool setup and Tcl syntax.');
            break;
          case 'Results':
            recommendations.push('Verify QoR extraction and reporting.');
            break;
          case 'Communication':
            recommendations.push('Improve prompt understanding and response quality.');
            break;
        }
      }
    }

    // Determine status
    let status, summary;

    if (failedCritical.length > 0) {
      status = 'FAIL';
      summary = `FAILED: Critical subject(s) failing: ${failedCritical.map(s => s.name).join(', ')}. GPA: ${gpa.toFixed(2)}`;
    } else if (gpa >= 3.0) {
      status = 'PASS';
      summary = `PASSED with ${finalGrade} (GPA: ${gpa.toFixed(2)})`;
    } else if (gpa >= 2.0) {
      status = 'PARTIAL';
      summary = `PARTIAL - Needs improvement (GPA: ${gpa.toFixed(2)}, Grade: ${finalGrade})`;
    } else {
      status = 'FAIL';
      summary = `FAILED (GPA: ${gpa.toFixed(2)}, Grade: ${finalGrade})`;
    }

    return { status, summary, recommendations };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SCORING (what a human would judge)
  // ═══════════════════════════════════════════════════════════════════

  _scoreResponse(before, after) {
    if (!after || after.length < 20) return { score: 0.0, detail: 'No output from Claude Code' };
    if (after === before) return { score: 0.0, detail: 'Claude did not respond (output unchanged)' };
    return { score: 1.0, detail: 'Claude responded to the command' };
  }

  _scoreIntent(claudeOutput) {
    const keywords = ['rtl2gds', 'design', 'innovus', 'flow', 'stage', 'skill', 'placement', 'routing', 'cts'];
    const found = keywords.filter(k => claudeOutput.toLowerCase().includes(k));
    if (found.length >= 3) return { score: 1.0, detail: `Claude understood the task (mentions: ${found.join(', ')})` };
    if (found.length >= 1) return { score: 0.5, detail: `Partial recognition (mentions: ${found.join(', ')})` };
    return { score: 0.0, detail: 'No evidence Claude understood the RTL2GDS task' };
  }

  _scoreToolUsage(claudeOutput, edaOutput) {
    const mcpIndicators = ['execute_and_verify', 'generate_tcl', 'detect_tool', 'start_tool',
      'get_skill', 'match_skill', 'diagnose_error', 'qor.snapshot', 'Template'];
    const found = mcpIndicators.filter(k => claudeOutput.includes(k));
    const edaHasActivity = edaOutput.includes('innovus') || edaOutput.includes('icc2') ||
      edaOutput.includes('source ') || edaOutput.includes('report_timing') || edaOutput.length > 500;

    // For long-running flows, check MCP log file as additional evidence
    // This handles cases where early MCP calls scrolled out of tmux buffer
    let mcpLogEvidence = null;
    // Check evidence dir first (for pulled evidence), then fall back to default path
    const mcpLogPathToUse = existsSync(join(this.evidenceDir, 'mcp_log.jsonl'))
      ? join(this.evidenceDir, 'mcp_log.jsonl')
      : this.mcpLogPath;
    try {
      if (existsSync(mcpLogPathToUse)) {
        const mcpLog = readFileSync(mcpLogPathToUse, 'utf-8');
        const mcpCalls = mcpLog.split('\n').filter(line => line.includes('"tool"') && line.includes('"ok"'));
        if (mcpCalls.length > 5) {
          mcpLogEvidence = { count: mcpCalls.length, tools: [...new Set(mcpCalls.map(l => {
            const match = l.match(/"tool":"([^"]+)"/);
            return match ? match[1] : 'unknown';
          }))].slice(0, 3) }; // Top 3 tools used
        }
      }
    } catch (e) {
      // MCP log check failed, fall back to pane-based scoring
    }

    // Scoring logic with MCP log fallback
    if ((found.length >= 2 || (mcpLogEvidence && mcpLogEvidence.count >= 5)) && edaHasActivity) {
      const detail = mcpLogEvidence
        ? `MCP tools used (${mcpLogEvidence.count} calls: ${mcpLogEvidence.tools.join(', ')}), EDA tool active`
        : `MCP tools used (${found.join(', ')}), EDA tool active`;
      return { score: 1.0, detail };
    }
    if (found.length >= 1 || (mcpLogEvidence && mcpLogEvidence.count >= 1) || edaHasActivity) {
      const mcpDetail = mcpLogEvidence
        ? `MCP(${mcpLogEvidence.count} calls)`
        : `MCP(${found.join(',') || 'none'})`;
      return { score: 0.5, detail: `Partial: ${mcpDetail}, EDA(${edaHasActivity ? 'active' : 'idle'})` };
    }
    if (claudeOutput.includes('tmux send-keys') || claudeOutput.includes('bash:')) return { score: 0.0, detail: 'Claude used direct bash/tmux instead of MCP tools' };
    return { score: 0.0, detail: 'No MCP tool usage or EDA activity detected' };
  }

  /**
   * TEMPORAL VERIFICATION: Check if EDA pane content changed over time.
   * This prevents cheating by detecting idle panes with stale output.
   * @returns {Object} { changed: boolean, changeCount: number, detail: string }
   */
  _verifyPaneActivityOverTime() {
    // Need at least 2 observations to detect change
    if (this.observations.length < 2) {
      return { changed: false, changeCount: 0, detail: 'Insufficient observations for temporal verification' };
    }

    // Filter to EDA pane observations with content
    const edaObservations = this.observations.filter(obs =>
      obs.content && obs.content.eda_pane && obs.content.eda_pane.length > 0
    );

    if (edaObservations.length < 2) {
      return { changed: false, changeCount: 0, detail: 'Less than 2 EDA pane observations' };
    }

    // Sort by timestamp
    edaObservations.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate content hashes and detect changes
    let changeCount = 0;
    let previousHash = null;
    const changes = [];

    for (const obs of edaObservations) {
      // Create simple hash of last 200 chars (captures recent activity)
      const content = obs.content.eda_pane.slice(-200);
      const hash = content.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0).toString(16);

      if (previousHash !== null && hash !== previousHash) {
        changeCount++;
        changes.push({
          timestamp: obs.timestamp,
          elapsed: previousTimestamp ? ((obs.timestamp - previousTimestamp) / 1000).toFixed(1) + 's' : 'N/A'
        });
      }

      previousHash = hash;
      previousTimestamp = obs.timestamp;
    }

    // Require at least 3 changes to consider it active (prevents single-change cheating)
    const changed = changeCount >= 3;

    return {
      changed,
      changeCount,
      totalObservations: edaObservations.length,
      detail: changed
        ? `EDA pane actively changing: ${changeCount} content updates across ${edaObservations.length} observations`
        : `EDA pane mostly idle: only ${changeCount} content changes (need 3+ for active tool)`,
      changes: changes.slice(-5) // Last 5 changes
    };
  }

  /**
   * Verify EDA tool process is actually running on the system.
   * This prevents cheating by ensuring the tool process exists.
   */
  _verifyActiveEdaProcess() {
    try {
      // Check for running EDA processes
      const psOutput = execSync(
        "ps aux | grep -E '(innovus|dc_shell|pt_shell|icc2)' | grep -v grep || echo ''",
        { encoding: 'utf-8', timeout: 5000 }
      );

      const processes = psOutput.trim().split('\n').filter(line => line.length > 0);

      if (processes.length === 0) {
        return { running: false, processes: [], detail: 'No EDA tool processes found' };
      }

      // Parse process info
      const parsed = processes.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          pid: parts[1],
          cpu: parts[2],
          mem: parts[3],
          command: parts.slice(10).join(' ').slice(0, 50)
        };
      });

      return {
        running: true,
        processCount: parsed.length,
        processes: parsed,
        detail: `${parsed.length} EDA process(es) running (CPU: ${parsed.map(p => p.cpu + '%').join(', ')})`
      };
    } catch (e) {
      return { running: false, error: e.message, detail: 'Process check failed' };
    }
  }

  _scoreEdaExecution(edaOutput, finalObservation = null) {
    // CRITICAL: Temporal verification first - check if pane changed over time
    const temporalCheck = this._verifyPaneActivityOverTime();
    const processCheck = this._verifyActiveEdaProcess();

    // If pane didn't change and no process running, it's definitely idle/cheated
    if (!temporalCheck.changed && !processCheck.running) {
      return {
        score: 0.0,
        detail: `CHEAT DETECTED: EDA pane idle (${temporalCheck.changeCount} changes) and no tool process running. Reported completion without actual execution.`,
        temporalCheck,
        processCheck,
        antiCheat: true
      };
    }

    // If pane didn't change much, warn but don't auto-fail (might be fast stage)
    if (!temporalCheck.changed) {
      this._debugLog('Low pane activity detected:', temporalCheck);
    }

    // Read the FULL EDA pane log from evidence directory (has full scrollback, not truncated)
    let fullEdaOutput = edaOutput;
    let fullLogUsed = false;
    try {
      const fullLogPath = join(this.evidenceDir, 'obs_after_flow_eda.log');
      if (existsSync(fullLogPath)) {
        fullEdaOutput = readFileSync(fullLogPath, 'utf-8');
        fullLogUsed = true;
      }
    } catch (e) {
      // Fall back to provided edaOutput if full log not available
    }

    // Read MCP log to extract tool execution events
    // Check evidence dir first (for pulled evidence), then fall back to default path
    let mcpLog = '';
    const mcpLogPathToUse = existsSync(join(this.evidenceDir, 'mcp_log.jsonl'))
      ? join(this.evidenceDir, 'mcp_log.jsonl')
      : this.mcpLogPath;
    let mcpEvents = {
      toolStarts: [],
      tclExecutions: [],
      awaitIdle: [],
      executeVerify: [],
      errors: []
    };
    try {
      if (existsSync(mcpLogPathToUse)) {
        mcpLog = readFileSync(mcpLogPathToUse, 'utf-8');
        const lines = mcpLog.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            // Track tool starts
            if (json.tool === 'start_tool' && json.params?.tool) {
              mcpEvents.toolStarts.push({ tool: json.params.tool, ts: json.ts });
            }
            // Track Tcl executions
            if (json.tool === 'send_tcl_nonblocking' || json.tool === 'send_tcl') {
              mcpEvents.tclExecutions.push({ desc: json.params?.description || json.params?.tcl?.slice(0, 50), ts: json.ts });
            }
            // Track await_idle (indicates tool was running)
            if (json.tool === 'await_idle' && json.meta?.idle === true) {
              mcpEvents.awaitIdle.push({ state: json.meta?.state, lastLine: json.meta?.last_line, ts: json.ts });
            }
            // Track execute_and_verify calls
            if (json.tool === 'execute_and_verify') {
              mcpEvents.executeVerify.push({ desc: json.params?.description, ts: json.ts, ok: json.ok });
            }
            // Track errors
            if (json.error || (json.meta && json.meta.error)) {
              mcpEvents.errors.push({ error: json.error || json.meta?.error, ts: json.ts });
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (e) {
      // MCP log not available
    }

    this._debugLog('Execution Scoring Debug:', {
      fullLogUsed,
      edaOutputLength: fullEdaOutput.length,
      mcpToolStarts: mcpEvents.toolStarts.length,
      mcpTclExecutions: mcpEvents.tclExecutions.length,
      mcpAwaitIdle: mcpEvents.awaitIdle.length,
      mcpExecuteVerify: mcpEvents.executeVerify.length,
      mcpErrors: mcpEvents.errors.length
    });

    // Use full EDA log for all pattern checks
    const checkOutput = fullEdaOutput;

    // CRITICAL: Check for bash errors FIRST - these indicate tool crash
    // Pattern: "bash: <command>: command not found" means Tcl was sent to bash shell
    const bashErrorPattern = /bash:\s*\w+:\s*command not found/i;
    if (bashErrorPattern.test(checkOutput)) {
      const match = checkOutput.match(bashErrorPattern);
      return { score: 0.0, detail: `Tool crashed to bash: ${match[0]}` };
    }

    // Check for bash prompt - indicates tool exited unexpectedly
    const bashPromptPattern = /^\[.*@.*\].*[$#]$/m;
    if (bashPromptPattern.test(checkOutput)) {
      return { score: 0.0, detail: 'EDA pane shows bash prompt - tool crashed' };
    }

    // Check for successful completion patterns in full log
    const completionPatterns = [
      /STAGE \d+ COMPLETE/i,
      /GDS output.*complete/i,
      /Ending "Innovus".*mem=/i,
      /All stages completed successfully/i,
      /streamOut.*completed/i,
      /saveDesign.*completed/i,
    ];
    for (const pat of completionPatterns) {
      if (pat.test(checkOutput)) return { score: 1.0, detail: 'EDA tool completed successfully' };
    }

    // Check for EDA errors in full log
    const errorPatterns = [/\*\*ERROR/i, /FATAL/i, /syntax error/i, /unknown command/i];
    for (const pat of errorPatterns) {
      if (pat.test(checkOutput)) return { score: 0.0, detail: `EDA error: ${checkOutput.match(pat)[0]}` };
    }

    // Check for EDA tool prompt (strong signal: tool ran and returned)
    const promptPatterns = [/innovus\s*\d+>/i, /icc2_shell>/i, /pt_shell>/i, /dc_shell\s*>/i];
    for (const pat of promptPatterns) {
      if (pat.test(checkOutput)) return { score: 1.0, detail: 'EDA tool ran and returned to prompt' };
    }

    // Check for EDA tool activity in full log (weaker: tool output without prompt)
    // Includes patterns for Cadence Innovus, Synopsys ICC2/DC, and PrimeTime outputs
    const activityPatterns = [
      // Command patterns
      /reading lef/i, /init_design/i, /floorPlan/i, /place_opt/i, /ccopt/i,
      /routeDesign/i, /optDesign/i, /timeDesign/i, /saveDesign/i,
      /checkDesign/i, /source.*\.tcl/i, /source.*\.enc/i,
      // Innovus placement patterns
      /GigaPlace/i, /Iteration\s+\d+.*Total net bbox/i, /placement.*cpu/i,
      /Placement optimization completed/i, /Estimated.*wirelength/i,
      // Innovus general patterns
      /% Begin.*load.*data/i, /% End.*load.*data/i,
      /Loading.*file/i, /Reading.*file/i, /Parsing.*complete/i,
      // CTS patterns
      /Clock Tree Synthesis/i, /clock tree.*delay/i, /skew.*target/i,
      // Routing patterns
      /NanoRoute/i, /Global Route/i, /Detailed Route/i, /routing.*completed/i,
      // Optimization patterns
      /deleteBufferTree/i, /optDesign.*cpu/i, /Optimization.*complete/i,
      // Checkpoint patterns
      /.*\.enc.*loaded/i, /.*\.enc.*saved/i, /restoreDesign/i,
      // Synthesis patterns
      /compile_ultra/i, /elaborate/i, /analyze/i, /link/i,
      /synthesis.*completed/i, /Design.*compiled/i,
    ];
    for (const pat of activityPatterns) {
      if (pat.test(checkOutput)) return { score: 0.5, detail: `EDA tool active: ${checkOutput.match(pat)[0]}` };
    }

    // FALLBACK: Use MCP log evidence if pane capture is insufficient
    // This handles the case where tmux capture-pane returns truncated output
    if (mcpEvents.toolStarts.length > 0 && mcpEvents.tclExecutions.length > 0) {
      // We have evidence that tools were started and Tcl was sent
      const tools = mcpEvents.toolStarts.map(e => e.tool).filter((v, i, a) => a.indexOf(v) === i);
      const tclCount = mcpEvents.tclExecutions.length;
      return { score: 0.5, detail: `EDA tool execution detected via MCP (${tools.join(', ')}: ${tclCount} Tcl commands)` };
    }

    // If we have execute_and_verify calls, that's strong evidence of execution
    if (mcpEvents.executeVerify.length > 0) {
      const count = mcpEvents.executeVerify.length;
      return { score: 0.5, detail: `EDA execution verified (${count} execute_and_verify calls)` };
    }

    // If the pane only has the welcome message or shell prompt, no tool ran
    if (checkOutput.includes('Start your EDA tool') || checkOutput.includes('EDA Tool Pane')) {
      return { score: 0.0, detail: 'EDA pane shows only welcome message — no tool started' };
    }

    if (checkOutput.length < 100) return { score: 0.0, detail: 'No significant EDA tool output' };
    return { score: 0.0, detail: 'EDA pane has text but no tool activity detected' };
  }

  /**
   * Process Validation - Check that the correct tool was used for each stage.
   *
   * This is CRITICAL: correct process is more important than results.
   * A human engineer knows:
   *   - Stage 0 (Synthesis): MUST use dc_shell, NEVER innovus
   *   - Stages 1-9 (Physical Design): MUST use innovus
   *   - Signoff: SHOULD use pt_shell
   *
   * If synthesis is attempted in innovus, that's a fundamental error.
   * Results from wrong-tool execution are meaningless.
   */
  _scoreProcessValidation(claudeOutput, edaOutput) {
    // Read the FULL EDA pane log from evidence directory (has full scrollback, not truncated)
    let fullEdaOutput = edaOutput;
    let fullLogUsed = false;
    try {
      const fullLogPath = join(this.evidenceDir, 'obs_after_flow_eda.log');
      this._debugLog('Looking for full EDA log:', { evidenceDir: this.evidenceDir, fullLogPath, exists: existsSync(fullLogPath) });
      if (existsSync(fullLogPath)) {
        fullEdaOutput = readFileSync(fullLogPath, 'utf-8');
        fullLogUsed = true;
        this._debugLog('Full EDA log loaded:', { length: fullEdaOutput.length });
      } else {
        this._debugLog('Full EDA log not found, using truncated output:', { length: edaOutput.length });
      }
    } catch (e) {
      this._debugLog('Error reading full EDA log:', { error: e.message });
      // Fall back to provided edaOutput if full log not available
    }

    // Read MCP log to extract tool execution sequence
    // First check evidence dir (for pulled evidence), then fall back to default path
    let mcpLog = '';
    let mcpLogPathToUse = this.mcpLogPath;
    const evidenceMcpLog = join(this.evidenceDir, 'mcp_log.jsonl');
    if (existsSync(evidenceMcpLog)) {
      mcpLogPathToUse = evidenceMcpLog;
    }
    try {
      if (existsSync(mcpLogPathToUse)) {
        mcpLog = readFileSync(mcpLogPathToUse, 'utf-8');
      }
    } catch (e) {
      // MCP log not available - fall back to pane analysis
    }

    // Extract tool execution sequence from MCP log
    const toolEvents = [];
    const switchEvents = [];
    if (mcpLog) {
      const lines = mcpLog.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          // Look for eda.start_tool calls
          if ((json.tool === 'start_tool' || json.tool === 'eda.start_tool') && json.params?.tool) {
            const toolName = json.params.tool;
            if (['innovus', 'dc_shell', 'pt_shell', 'icc2'].includes(toolName)) {
              toolEvents.push({ tool: toolName, ts: json.ts, type: 'start' });
            }
          }
          // Look for eda.switch_tool calls
          if ((json.tool === 'switch_tool' || json.tool === 'eda.switch_tool') && json.params?.to_tool) {
            const toTool = json.params.to_tool;
            if (['innovus', 'dc_shell', 'pt_shell', 'icc2'].includes(toTool)) {
              switchEvents.push({ tool: toTool, ts: json.ts, type: 'switch', from: json.params.from_tool });
            }
          }
          // Also check for tool detection with tool name
          if (json.tool === 'detect_tool' && json.params?.tool_name) {
            const detectedName = json.params.tool_name.toLowerCase();
            if (detectedName.includes('innovus')) toolEvents.push({ tool: 'innovus', ts: json.ts, type: 'detect' });
            else if (detectedName.includes('dc_shell') || detectedName.includes('designcompiler')) toolEvents.push({ tool: 'dc_shell', ts: json.ts, type: 'detect' });
            else if (detectedName.includes('pt_shell') || detectedName.includes('primetime')) toolEvents.push({ tool: 'pt_shell', ts: json.ts, type: 'detect' });
            else if (detectedName.includes('icc2')) toolEvents.push({ tool: 'icc2', ts: json.ts, type: 'detect' });
          }
        } catch (e) {
          // Skip malformed JSON lines
          continue;
        }
      }
    }

    // Combine all tool events and sort by timestamp
    const allToolEvents = [...toolEvents, ...switchEvents].sort((a, b) => {
      return new Date(a.ts || 0) - new Date(b.ts || 0);
    });

    // Get unique tools used (in order)
    const toolsUsed = [];
    const seenTools = new Set();
    for (const evt of allToolEvents) {
      if (!seenTools.has(evt.tool)) {
        seenTools.add(evt.tool);
        toolsUsed.push(evt.tool);
      }
    }

    // Infer stages from Claude's output and command context
    const command = this.lastCommand || '';
    const lowerClaude = claudeOutput.toLowerCase();
    const lowerEda = fullEdaOutput.toLowerCase();

    // Detect what stage the flow was attempting
    let attemptedStage = null;
    let attemptedTool = null;

    // Check command for stage hints
    if (command.includes('rtl2gds') || command.includes('full flow')) {
      // Full flow - should start with dc_shell for synthesis
      attemptedStage = 'synthesis';
      attemptedTool = 'dc_shell';
    } else if (command.includes('synthesis') || command.includes('compile') || command.includes('syn')) {
      attemptedStage = 'synthesis';
      attemptedTool = 'dc_shell';
    } else if (command.includes('init')) {
      attemptedStage = 'init_design';
      attemptedTool = 'innovus';
    } else if (command.includes('floorplan')) {
      attemptedStage = 'floorplan';
      attemptedTool = 'innovus';
    } else if (command.includes('place')) {
      attemptedStage = 'placement';
      attemptedTool = 'innovus';
    } else if (command.includes('cts')) {
      attemptedStage = 'cts';
      attemptedTool = 'innovus';
    } else if (command.includes('route')) {
      attemptedStage = 'routing';
      attemptedTool = 'innovus';
    }

    // Check what tool actually ran in EDA pane
    let actualTool = null;
    if (lowerEda.includes('dc_shell') || /dc_shell\s*>/i.test(edaOutput)) {
      actualTool = 'dc_shell';
    } else if (lowerEda.includes('innovus') || /innovus\s*\d+>/i.test(edaOutput)) {
      actualTool = 'innovus';
    } else if (lowerEda.includes('pt_shell') || /pt_shell\s*>/i.test(edaOutput)) {
      actualTool = 'pt_shell';
    } else if (lowerEda.includes('icc2') || /icc2_shell\s*>/i.test(edaOutput)) {
      actualTool = 'icc2';
    }

    // Use MCP log tool history for more reliable detection
    // For synthesis stage, check if dc_shell was EVER started (not just what's at the end)
    const dcShellWasUsed = toolsUsed.includes('dc_shell');
    const innovusWasUsed = toolsUsed.includes('innovus');

    // Determine the primary tool for the attempted stage
    let primaryTool = actualTool;
    if (attemptedStage === 'synthesis' && dcShellWasUsed) {
      // For synthesis, if dc_shell was ever used, that's correct
      primaryTool = 'dc_shell';
    } else if (attemptedStage === 'synthesis' && innovusWasUsed && !dcShellWasUsed) {
      // Synthesis attempted with innovus (wrong tool)
      primaryTool = 'innovus';
    }

    // Infer stage from output keywords if not detected from command
    if (!attemptedStage) {
      if (lowerClaude.includes('synthesis') || lowerClaude.includes('compile')) {
        attemptedStage = 'synthesis';
      } else if (lowerClaude.includes('placement') || lowerClaude.includes('floorplan') || lowerClaude.includes('cts')) {
        attemptedStage = 'placement';
      }
    }

    // Debug logging for process validation
    this._debugLog('Process Validation Debug:', {
      attemptedStage,
      actualTool,
      primaryTool,
      command: this.lastCommand,
      edaOutputLength: fullEdaOutput.length,
      usingFullLog: fullLogUsed,
      dcShellWasUsed,
      innovusWasUsed,
      toolsUsed
    });

    // Validate tool-stage match using STAGE_TOOL_MAP
    // Use primaryTool (determined from full MCP log history) instead of just actualTool (current pane state)
    if (attemptedStage && primaryTool) {
      const expected = STAGE_TOOL_MAP[attemptedStage];
      if (expected) {
        if (expected.tool !== primaryTool) {
          // CRITICAL ERROR: Wrong tool for the stage
          return {
            score: 0.0,
            detail: `PROCESS ERROR: Stage "${attemptedStage}" requires ${expected.tool}, but ${primaryTool} was used. This is a fundamental flow error.`,
            violation: {
              stage: attemptedStage,
              expectedTool: expected.tool,
              actualTool: primaryTool,
              severity: 'CRITICAL'
            }
          };
        }
        // Correct tool used
        return {
          score: 1.0,
          detail: `Correct process: ${attemptedStage} used ${primaryTool} as expected`,
          validation: {
            stage: attemptedStage,
            tool: primaryTool,
            correct: true
          }
        };
      }
    }

    // If we can't determine stage/tool mapping, give partial credit for having some tool activity
    if (actualTool) {
      return {
        score: 0.5,
        detail: `Tool ${actualTool} was used, but could not validate stage-tool mapping`,
        validation: { tool: actualTool, stage: attemptedStage || 'unknown' }
      };
    }

    return {
      score: 0.0,
      detail: 'No tool execution detected for process validation'
    };
  }

  _scoreQoR(claudeOutput, edaOutput = '') {
    // Read the FULL EDA pane log from evidence directory (has full scrollback, not truncated)
    let fullEdaOutput = edaOutput;
    try {
      const fullLogPath = join(this.evidenceDir, 'obs_after_flow_eda.log');
      if (existsSync(fullLogPath)) {
        fullEdaOutput = readFileSync(fullLogPath, 'utf-8');
      }
    } catch (e) {
      // Fall back to provided edaOutput if full log not available
    }

    // CRITICAL: Check for evidence that flow actually ran
    // Stale QoR from old runs should not be counted
    const hasFlowActivity = /init_design|floorPlan|place_opt|ccopt|routeDesign|streamOut|compile_ultra|elaborate/i.test(fullEdaOutput);
    const hasStageCompletion = /STAGE \d+ COMPLETE|saveDesign.*completed|Ending "Innovus"|synthesis.*completed/i.test(fullEdaOutput);

    // If no flow activity detected, QoR data is likely stale
    if (!hasFlowActivity && !hasStageCompletion) {
      return { score: 0.0, detail: 'No flow activity detected - QoR may be stale' };
    }

    // Standard format: "WNS: 0.136" or "WNS 0.136"
    const wnsMatch = claudeOutput.match(/WNS[:\s]*(-?[\d.]+)/i);
    const tnsMatch = claudeOutput.match(/TNS[:\s]*(-?[\d.]+)/i);

    // Table format: "│ WNS (Setup) │ +0.136 ns │" or "WNS (Setup) | +0.136"
    const wnsTableMatch = claudeOutput.match(/WNS.*[│┃|]\s*([+-]?[\d.]+)\s*ns/i);
    const tnsTableMatch = claudeOutput.match(/TNS.*[│┃|]\s*([+-]?[\d.]+)\s*ns/i);

    // Parenthetical format: "WNS (Setup) +0.136" without table chars
    const wnsParenMatch = claudeOutput.match(/WNS\s*\(\s*\w+\s*\)\s*([+-]?[\d.]+)/i);
    const tnsParenMatch = claudeOutput.match(/TNS\s*\(\s*\w+\s*\)\s*([+-]?[\d.]+)/i);

    // Extract values using first matching pattern
    const wns = wnsMatch?.[1] || wnsTableMatch?.[1] || wnsParenMatch?.[1];
    const tns = tnsMatch?.[1] || tnsTableMatch?.[1] || tnsParenMatch?.[1];

    // Verify QoR came from current run by checking for context indicators
    // These indicate the QoR was just extracted/generated, not from old logs
    const hasCurrentRunContext = /stage \d+|current|final|completed|post-|pre-|after_|rtl2gds|flow complete|qor\.snapshot|FINAL_/i.test(claudeOutput);
    // Also check if Claude is explicitly reporting QoR in a summary format
    const hasQoRSummary = /QoR|Summary|Metric|WNS.*TNS|timing.*report/i.test(claudeOutput);

    if (wns && tns && (hasCurrentRunContext || hasQoRSummary)) {
      return { score: 1.0, detail: `QoR reported: WNS=${wns}, TNS=${tns}` };
    }
    if (wns || tns) {
      return { score: 0.5, detail: `Partial QoR: WNS=${wns ?? 'N/A'}, TNS=${tns ?? 'N/A'} (context: ${hasCurrentRunContext ? 'run' : 'unknown'})` };
    }

    const metricsKeywords = ['timing', 'violation', 'slack', 'pass', 'fail', 'score'];
    const found = metricsKeywords.filter(k => claudeOutput.toLowerCase().includes(k));
    if (found.length >= 2) return { score: 0.5, detail: `Claude discussed metrics (${found.join(', ')}) but no WNS/TNS numbers` };
    return { score: 0.0, detail: 'No QoR assessment in Claude output' };
  }

  /**
   * Score human-like behavior (0-10 scale, then normalized to 0-1)
   *
   * Human-like means:
   * 0 = Dead machine: Batch-generated 100+ line Tcl scripts, no observation, no reaction
   * 5 = Semi-human: Some incremental steps but still heavily scripted
   * 10 = Real human: Types commands one at a time, observes output, reacts intelligently
   *
   * Key indicators:
   * - Incremental interaction (not batch)
   * - Observation between commands
   * - Error diagnosis and retry
   * - Narrative/thinking out loud
   * - Tool knowledge demonstrated
   */
  _scoreHumanLike(claudeOutput, edaOutput) {
    let score = 0;
    let details = [];

    // 1. Check for batch script patterns (NEGATIVE - indicates machine behavior)
    // Large blocks of Tcl sent at once = machine-like
    const largeTclBlock = /(analyze|elaborate|link|check_design|compile_ultra)[\s\S]{100,}(compile_ultra|exit)/i.test(claudeOutput);
    const batchPattern = /```tcl[\s\S]{200,}```/i.test(claudeOutput);
    if (largeTclBlock || batchPattern) {
      score -= 3;
      details.push('Batch-generated large Tcl blocks');
    } else {
      score += 2;
      details.push('No large batch scripts detected');
    }

    // 2. Check for incremental command patterns (POSITIVE)
    // Multiple individual commands with await_idle pattern
    const individualCommands = (claudeOutput.match(/await_idle|get_last_result|send_tcl_nonblocking/g) || []).length;
    if (individualCommands >= 10) {
      score += 3;
      details.push(`Incremental interaction (${individualCommands} command points)`);
    } else if (individualCommands >= 5) {
      score += 1;
      details.push('Some incremental interaction');
    } else {
      details.push('Limited incremental interaction');
    }

    // 3. Check for observation and reaction (POSITIVE)
    // Looking at output, diagnosing, fixing
    const observationPatterns = [
      /check|observe|look|see|watch/i,
      /error|fail|issue|problem/i,
      /fix|retry|adjust|change/i,
      /diagnose/i,
    ];
    const observations = observationPatterns.filter(p => p.test(claudeOutput)).length;
    if (observations >= 3) {
      score += 2;
      details.push('Shows observation and reaction');
    }

    // 4. Check for narrative/thinking out loud (POSITIVE)
    // Human engineers narrate their work
    const narrativePatterns = [
      /^(okay|alright|now|let's|next|so|then)/im,
      /(starting|running|doing|working on)/i,
      /(complete|done|finished|success)/i,
    ];
    const narrative = narrativePatterns.filter(p => p.test(claudeOutput)).length;
    if (narrative >= 2) {
      score += 2;
      details.push('Narrates work like a human');
    }

    // 5. Check for expert knowledge demonstration (POSITIVE)
    // Using correct commands without reading from skills
    const expertPatterns = [
      /set(init_verilog|init_lef_file|target_library)/i,
      /(place_opt_design|ccopt_design|route_design)/i,
      /report_timing|report_constraint/i,
      /saveDesign|restoreDesign/i,
    ];
    const expertKnowledge = expertPatterns.filter(p => p.test(edaOutput) || p.test(claudeOutput)).length;
    if (expertKnowledge >= 3) {
      score += 2;
      details.push('Demonstrates tool knowledge');
    }

    // 6. Check for MCP tool selection intelligence (POSITIVE)
    // Correctly choosing dc_shell for synthesis, innovus for P&R
    const correctToolUsage = [
      /start_tool.*dc_shell/i.test(claudeOutput) && /synthesis|elaborate|compile/i.test(edaOutput),
      /start_tool.*innovus/i.test(claudeOutput) && /(floorplan|placement|cts|route)/i.test(edaOutput),
    ].filter(Boolean).length;
    if (correctToolUsage >= 1) {
      score += 1;
      details.push('Correct tool selection');
    }

    // Normalize to 0-1 scale
    // Max possible: 2 + 3 + 2 + 2 + 2 + 1 = 12
    // Min possible: -3 (with adjustments keeping it positive)
    const normalizedScore = Math.max(0, Math.min(10, score + 3)) / 10;

    const humanLevel = normalizedScore >= 0.8 ? 'Human-like' :
                       normalizedScore >= 0.6 ? 'Semi-human' :
                       normalizedScore >= 0.4 ? 'Partially human' :
                       normalizedScore >= 0.2 ? 'Machine-like' : 'Dead machine';

    return {
      score: normalizedScore,
      detail: `Human-like level: ${humanLevel} (${(normalizedScore * 10).toFixed(1)}/10) - ${details.join(', ')}`,
      human_level: (normalizedScore * 10).toFixed(1),
      raw_score: score,
    };
  }

  /**
   * Score authenticity based on cheat detection results
   * Reads the cheat_detection_report.json generated during test
   */
  _scoreAuthenticity() {
    // Default: assume authentic if no report
    let score = 1.0;
    let details = ['No cheat detection report — assuming authentic'];
    let criticalIssues = 0;
    let warnings = 0;

    try {
      const reportPath = join(this.evidenceDir, 'cheat_detection_report.json');
      if (!existsSync(reportPath)) {
        return {
          score: 1.0,
          detail: 'No cheat detection report available — skipping authenticity check',
          critical_issues: 0,
          warnings: 0,
        };
      }

      const report = JSON.parse(readFileSync(reportPath, 'utf8'));

      // Count issues by severity
      criticalIssues = report.criticalCheats || 0;
      warnings = report.warnings || 0;

      // CRITICAL: Any critical cheat detection = automatic 0 score
      if (criticalIssues > 0) {
        score = 0.0;
        details = [`CRITICAL: ${criticalIssues} critical cheat(s) detected`];

        // List specific critical issues
        const criticalTypes = [];
        if (report.checks?.processes?.valid === false) criticalTypes.push('fake processes');
        if (report.checks?.echo?.valid === false) criticalTypes.push('echo commands');
        if (report.checks?.pane?.valid === false) criticalTypes.push('fake pane content');
        if (report.checks?.mcp?.valid === false) criticalTypes.push('fake MCP logs');
        if (report.checks?.video?.valid === false) criticalTypes.push('fake video');
        if (report.checks?.freshness?.valid === false) criticalTypes.push('stale evidence');
        if (report.checks?.interactive?.valid === false) criticalTypes.push('no interactivity');

        if (criticalTypes.length > 0) {
          details.push(`Issues: ${criticalTypes.join(', ')}`);
        }
      } else if (warnings > 0) {
        // Warnings reduce score but don't fail completely
        score = Math.max(0, 1.0 - (warnings * 0.1));
        details = [`${warnings} warning(s) — evidence mostly authentic`];
      } else {
        score = 1.0;
        details = ['All authenticity checks passed'];
      }

      return {
        score,
        detail: details.join(' — '),
        critical_issues: criticalIssues,
        warnings: warnings,
        cheat_detected: report.cheatDetected || false,
      };
    } catch (e) {
      // If we can't read the report, assume failure
      return {
        score: 0.0,
        detail: `Failed to read cheat detection report: ${e.message}`,
        critical_issues: 1,
        warnings: 0,
        error: e.message,
      };
    }
  }

  _classifyFailure(scores, claudeOutput, edaOutput) {
    if (scores.L1_prompt_delivery.score === 0.0) return { category: 'ENVIRONMENT', summary: 'Claude Code did not respond', action: 'Check Claude Code is running and MCP servers are connected' };
    if (scores.L3_mcp_tool_usage.score === 0.0 && scores.L3_mcp_tool_usage.detail.includes('direct bash')) return { category: 'AI_BEHAVIOR', summary: 'Claude bypassed MCP tools', action: 'Improve CLAUDE.md to enforce MCP-only usage' };
    if (scores.L3_mcp_tool_usage.score === 0.0) return { category: 'ENVIRONMENT', summary: 'MCP tools not available', action: 'Check settings.json MCP server registration' };
    if (scores.L4_eda_execution.score === 0.0) {
      const isEnv = /license|not found|missing|no design/i.test(edaOutput);
      return isEnv
        ? { category: 'ENVIRONMENT', summary: scores.L4_eda_execution.detail, action: 'Fix EDA server setup' }
        : { category: 'HIPILOT_BUG', summary: scores.L4_eda_execution.detail, action: 'Fix Tcl template or generation' };
    }
    return { category: 'AI_BEHAVIOR', summary: `Score ${Object.values(scores).reduce((s, l) => s + l.score, 0).toFixed(1)}/5.0`, action: 'Review Claude behavior in evidence' };
  }

  /**
   * Detect which stage to start from based on existing checkpoints.
   * Returns the first stage number that needs to run (0-9).
   * This prevents wasting time on already-completed stages.
   */
  _detectStartingStage(designDir) {
    if (!designDir) return 0;

    // Checkpoint file paths for RTL2GDS flow (relative to designDir)
    const checkpoints = [
      { stage: 0, file: 'result/syn/data/ibex_core.syn.v', tool: 'dc_shell' },
      { stage: 1, file: 'result/pr/data/init_design.enc', tool: 'innovus' },
      { stage: 2, file: 'result/pr/data/floor_plan.enc', tool: 'innovus' },
      { stage: 3, file: 'result/pr/data/powerplan.enc', tool: 'innovus' },
      { stage: 4, file: 'result/pr/data/placement.enc', tool: 'innovus' },
      { stage: 5, file: 'result/pr/data/cts.enc', tool: 'innovus' },
      { stage: 6, file: 'result/pr/data/post_cts_opt.enc', tool: 'innovus' },
      { stage: 7, file: 'result/pr/data/routing.enc', tool: 'innovus' },
      { stage: 8, file: 'result/pr/data/routing_opt.enc', tool: 'innovus' },
      { stage: 9, file: 'result/pr/data/chip_done.enc', tool: 'innovus' },
    ];

    for (const cp of checkpoints) {
      const fullPath = join(designDir, cp.file);
      if (!existsSync(fullPath)) {
        this._runLog(`Checkpoint check: Stage ${cp.stage} checkpoint missing (${cp.file})`);
        return cp.stage;
      }
    }

    // All checkpoints exist - flow is complete
    this._runLog('Checkpoint check: All stages complete (flow already finished)');
    return 10;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Pre-flight check: verify the EDA server environment before testing.
   * A human would check: is tmux installed? is the display working? is ffmpeg available?
   */
  async preflight() {
    this._runLog('Pre-flight checks...');
    const checks = [];

    // tmux available?
    try {
      const ver = execSync('tmux -V 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim();
      checks.push({ name: 'tmux', ok: true, detail: ver });
    } catch {
      checks.push({ name: 'tmux', ok: false, detail: 'tmux not found in PATH' });
    }

    // Display :0 accessible?
    try {
      execSync(`xdpyinfo -display ${this.display} >/dev/null 2>&1`, { timeout: 5000 });
      checks.push({ name: 'display', ok: true, detail: this.display });
    } catch {
      checks.push({ name: 'display', ok: false, detail: `display ${this.display} not accessible` });
    }

    // ffmpeg available?
    try {
      execSync('which ffmpeg >/dev/null 2>&1', { timeout: 5000 });
      checks.push({ name: 'ffmpeg', ok: true, detail: 'installed' });
    } catch {
      checks.push({ name: 'ffmpeg', ok: false, detail: 'ffmpeg not found — video recording will fail' });
    }

    // gnome-terminal available?
    try {
      execSync('which gnome-terminal >/dev/null 2>&1', { timeout: 5000 });
      checks.push({ name: 'gnome-terminal', ok: true, detail: 'installed' });
    } catch {
      checks.push({ name: 'gnome-terminal', ok: false, detail: 'gnome-terminal not found — workspace will not be visible' });
    }

    // bin/hipilot exists and is executable?
    const binPath = this.hipilotBin || join(this._projectRoot(), 'bin', 'hipilot');
    checks.push({
      name: 'bin/hipilot',
      ok: existsSync(binPath),
      detail: existsSync(binPath) ? binPath : 'NOT FOUND',
    });

    // Design tarball for clean start?
    checks.push({
      name: 'design tarball',
      ok: existsSync(this.designTarball),
      detail: existsSync(this.designTarball) ? this.designTarball : `NOT FOUND: ${this.designTarball}`,
    });

    // Log results
    let allOk = true;
    for (const c of checks) {
      const icon = c.ok ? '✅' : '❌';
      this._runLog(`  ${icon} ${c.name}: ${c.detail}`);
      if (!c.ok) allOk = false;
    }

    if (!allOk) {
      this._runLog('WARNING: Some pre-flight checks failed — test may not work correctly');
    }

    writeFileSync(join(this.evidenceDir, 'preflight.json'), JSON.stringify(checks, null, 2));
    return { ok: allOk, checks };
  }

  async runTest(command, options = {}) {
    const maxWaitMs = options.maxWaitMs || 900000;
    const phase = options.phase ?? null;
    const purpose = options.purpose || command;
    mkdirSync(this.evidenceDir, { recursive: true });
    this.recordingStartTime = Date.now();

    // Prepare clean design copy (extract tarball to timestamped dir)
    // Each test starts from scratch — no leftover results from previous runs.
    const cleanDesignDir = this.prepareCleanDesign();

    // ═══════════════════════════════════════════════════════════════════
    // CHECKPOINT-AWARE EXECUTION: Detect already-completed stages
    // ═══════════════════════════════════════════════════════════════════
    // Don't waste time on stages that already have checkpoints.
    // This is what a human would do: check progress before starting.
    const initialStage = this._detectStartingStage(cleanDesignDir);
    if (initialStage > 0) {
      this._runLog(`Checkpoint-aware: Skipping stages 0-${initialStage - 1} (checkpoints exist)`);
      this._lastCompletedStage = initialStage - 1;
    }

    // Write test metadata
    const metadata = {
      test_id: this.timestamp,
      timestamp: new Date().toISOString(),
      phase,
      purpose,
      command,
      evidence_dir: this.evidenceDir,
      test_work_dir: this.testWorkDir,
      design_dir: cleanDesignDir,
      design_tarball: this.designTarball,
      session: this.session,
      display: this.display,
      hostname: process.env.HOSTNAME || 'unknown',
      user: process.env.USER || 'unknown',
      status: 'running',
      started_at: new Date().toISOString(),
      completed_at: null,
      result: null,
    };
    writeFileSync(join(this.evidenceDir, 'test_metadata.json'), JSON.stringify(metadata, null, 2));
    this._runLog(`Test ID: ${this.timestamp}, purpose: ${purpose}`);
    if (cleanDesignDir) {
      this._runLog(`Clean design at: ${cleanDesignDir}`);
    }

    // Pre-flight checks
    await this.preflight();

    // Phase 1: Launch HiPilot (creates session + opens terminal on desktop)
    await this.launchHiPilot(cleanDesignDir);

    // Give the terminal window time to open and render (reduced from 3s to 1s)
    await this._sleep(1000);

    // Start video recording AFTER the terminal is visible
    this._startVideoRecording();
    this._takeScreenshot('workspace_visible');
    this._logPanes('after_launch');

    // Phase 2: Wait for Claude Code
    const claudeReady = await this.waitForClaudeReady();
    if (!claudeReady) {
      this._runLog('Claude Code not ready — will still attempt the command');
    }
    this._takeScreenshot('claude_ready');
    this._logPanes('claude_ready');

    // Phase 2.5: Create 5-Agent Team
    // Tell Supervisor to create team, then wait for teammates to appear
    this._runLog('Creating 5-Agent Team...');
    this._runLog('Step 1: Instructing Supervisor to create team...');

    // Type the team creation command
    // Note: EDA pane (pane 1) is already created by bin/hipilot
    // Team mode will create teammates in new panes/windows managed by Claude Code
    const teamCreationCmd = "Create team 'hipilot-team' with 4 teammates using teammateMode: tmux. Teammates: Knowledge (brain interface), Planner (strategy), Executor (EDA control ONLY via MCP), Archivist (recording). The EDA pane already exists as pane 1.";
    this.typeInHiPilot(teamCreationCmd);
    this._takeScreenshot('team_creation_command');

    // Wait for team creation to complete
    this._runLog('Step 2: Waiting for team formation...');
    const teamReady = await this._waitForTeamCreation(120000); // 2 min timeout
    if (teamReady) {
      this._runLog('✓ 5-Agent Team ready');
    } else {
      this._runLog('⚠ Team not fully formed - proceeding with available agents');
    }
    this._takeScreenshot('team_ready');

    // Capture before state
    const beforeObs = await ObservationPoint.capture('BEFORE_COMMAND', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      display: this.display,
      context: { command, claude_ready: claudeReady },
    });
    this.observations.push(beforeObs);

    // Phase 3: Type command
    this.lastCommand = command; // Track for process validation
    const typed = this.typeInHiPilot(command);
    if (!typed) throw new Error('Failed to type command into HiPilot');
    this._takeScreenshot('after_type');
    this._logPanes('after_type');

    // Phase 4: Watch and interact
    const watchResult = await this.watchFlow({ maxWaitMs });

    // Final screenshot and pane log
    this._takeScreenshot('after_flow');
    this._logPanes('after_flow');

    // Capture after state
    const afterObs = await ObservationPoint.capture('AFTER_FLOW', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      display: this.display,
      context: { elapsed_ms: watchResult.elapsed_ms, approvals: watchResult.approvals },
    });
    this.observations.push(afterObs);

    // Stop video recording
    this._stopVideoRecording();

    // Phase 5: Collect all logs (post-test — not cheating)
    this._collectLogs();

    // Save continuous pane log
    this._savePaneLog();

    // Build correlated timeline
    this._buildTimeline();

    // ═══════════════════════════════════════════════════════════════════
    // CHEAT DETECTION: Verify all evidence is authentic
    // ═══════════════════════════════════════════════════════════════════
    this._runLog('Running cheat detection verification...');
    const cheatDetector = new CheatDetector({
      socket: this.socket,
      session: this.session,
      designDir: cleanDesignDir,
    });

    // Get pane text for verification
    const pane0Text = this._capturePane('0.0');
    const pane1Text = this._capturePane('0.1');
    const combinedPaneText = `${pane0Text}\n${pane1Text}`;

    // Get evidence files
    const evidenceFiles = [
      join(this.evidenceDir, 'video.mp4'),
      join(this.evidenceDir, 'test_metadata.json'),
      join(this.evidenceDir, 'pane0_continuous.log'),
      join(this.evidenceDir, 'pane1_continuous.log'),
    ].filter(f => existsSync(f));

    // Add MCP log if collected
    const mcpLogPath = join(this.evidenceDir, 'mcp_calls.jsonl');

    // Run full verification
    const cheatResults = await cheatDetector.runFullVerification({
      paneText: combinedPaneText,
      mcpLogPath: existsSync(mcpLogPath) ? mcpLogPath : null,
      videoPath: join(this.evidenceDir, 'video.mp4'),
      evidenceFiles,
    });

    // Save cheat detection report
    writeFileSync(
      join(this.evidenceDir, 'cheat_detection_report.json'),
      JSON.stringify(cheatResults, null, 2)
    );

    // Log results
    if (cheatResults.cheatDetected) {
      this._runLog(`⚠️ CHEAT DETECTION: ${cheatResults.criticalCheats} critical, ${cheatResults.warnings} warnings`);

      // Log specific issues
      for (const issue of cheatDetector.cheatLog) {
        this._runLog(`  [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
      }
    } else {
      this._runLog('✓ Cheat detection passed — all evidence authentic');
    }

    // Phase 6: Evaluate (include cheat detection in scoring)
    const scorecard = this.evaluate(beforeObs, afterObs);
    this.stageResults = [scorecard];

    // Generate reports
    const reporter = new FlowReporter();
    const reports = reporter.generate({
      workflowName: command,
      timestamp: this.timestamp,
      totalElapsedMs: watchResult.elapsed_ms,
      stageResults: this.stageResults,
      mcpStats: null,
      mcpDiagnostics: null,
      workflowResult: null,
      observations: this.observations,
    });

    writeFileSync(join(this.evidenceDir, 'FLOW_REPORT.md'), reports.markdown);
    writeFileSync(join(this.evidenceDir, 'flow_progress.json'), JSON.stringify(reports.json, null, 2));
    writeFileSync(join(this.evidenceDir, 'stage_scorecards.json'), JSON.stringify(this.stageResults, null, 2));
    writeFileSync(join(this.evidenceDir, 'observation_points.json'), JSON.stringify(this.observations, null, 2));
    writeFileSync(join(this.evidenceDir, 'run_log.txt'), this._runLogLines.join('\n'));

    // Update test metadata with completion
    metadata.completed_at = new Date().toISOString();
    metadata.status = 'completed';
    metadata.result = scorecard.status.toUpperCase();
    metadata.total_score = scorecard.total_score;
    writeFileSync(join(this.evidenceDir, 'test_metadata.json'), JSON.stringify(metadata, null, 2));

    return {
      evidenceDir: this.evidenceDir,
      progress: reports.json,
      stageResults: this.stageResults,
      reportPath: join(this.evidenceDir, 'FLOW_REPORT.md'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  _capturePane(paneId) {
    // Claude Code uses alternate screen mode for its TUI. tmux capture-pane -p
    // may only return the "frame" (2 lines) instead of the full content.
    // Use multiple strategies to get the best possible capture.
    const target = `${this.session}:0.${paneId}`;
    let best = '';

    // Strategy 1: Standard capture approaches
    const cmds = [
      // Normal visible content
      `tmux -L ${this.socket} capture-pane -t ${target} -p 2>/dev/null`,
      // Full scrollback with larger buffer
      `tmux -L ${this.socket} capture-pane -t ${target} -p -S -10000 2>/dev/null`,
      // Start from beginning of history
      `tmux -L ${this.socket} capture-pane -t ${target} -p -S - 2>/dev/null`,
      // Capture with escape sequences (for TUI apps)
      `tmux -L ${this.socket} capture-pane -t ${target} -p -e 2>/dev/null`,
    ];

    for (const cmd of cmds) {
      try {
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
        if (result.length > best.length) best = result;
      } catch { /* try next */ }
    }

    // Strategy 2: Save buffer to temp file and read (bypasses TUI issues)
    try {
      const tmpFile = `/tmp/hipilot_capture_${Date.now()}_${paneId}.txt`;
      execSync(`tmux -L ${this.socket} capture-pane -t ${target} -S -10000 "${tmpFile}" 2>/dev/null`, { timeout: 5000, shell: true });
      const fileResult = readFileSync(tmpFile, 'utf-8');
      if (fileResult.length > best.length) best = fileResult;
      try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
    } catch { /* try next strategy */ }

    // Strategy 3: Use show-buffer after copying (tmux key sequence format)
    try {
      const bufferFile = `/tmp/hipilot_buffer_${paneId}.txt`;
      // Enter copy mode, go to top, start selection, copy to file
      execSync(`tmux -L ${this.socket} copy-mode -t ${target} 2>/dev/null`, { timeout: 1000 });
      execSync(`tmux -L ${this.socket} send-keys -t ${target} -X history-top 2>/dev/null`, { timeout: 1000 });
      execSync(`tmux -L ${this.socket} send-keys -t ${target} -X begin-selection 2>/dev/null`, { timeout: 1000 });
      execSync(`tmux -L ${this.socket} send-keys -t ${target} -X copy-pipe-and-cancel "cat > ${bufferFile}" 2>/dev/null`, { timeout: 1000 });
      const bufferResult = readFileSync(bufferFile, 'utf-8');
      if (bufferResult.length > best.length) best = bufferResult;
    } catch { /* ignore buffer errors */ }

    return best || '';
  }

  /**
   * Capture text from a specific pane (async wrapper for mission pack testing)
   */
  async _capturePaneText(paneId) {
    return this._capturePane(paneId);
  }

  /**
   * Type a command in HiPilot (wrapper for mission pack testing)
   */
  async _typeCommand(command) {
    return this.typeInHiPilot(command);
  }

  _needsApproval(claudeOutput) {
    const approvalPatterns = [/pending.?approval/i, /approve.*pending/i, /prefix\+y/i, /manual.*mode.*queued/i, /⏳.*pending/i, /approval required/i];
    return approvalPatterns.some(p => p.test(claudeOutput));
  }

  _pressApproval() {
    try {
      execSync(`tmux -L ${this.socket} send-keys -t ${this.session}:0.0 C-b`, { encoding: 'utf-8', timeout: 2000 });
      execSync(`tmux -L ${this.socket} send-keys -t ${this.session}:0.0 y`, { encoding: 'utf-8', timeout: 2000 });
      this._runLog('Pressed prefix+y (approval)');
    } catch (e) {
      this._runLog(`Approval keypress failed: ${e.message}`);
    }
  }

  _projectRoot() {
    return join(new URL(import.meta.url).pathname, '..', '..', '..', '..');
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /**
   * Wait for 5-Agent Team creation
   * In team mode, Supervisor creates the team on startup.
   * We wait for all 5 Claude processes to be running.
   */
  async _waitForTeamCreation(timeoutMs = 120000) {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    let lastClaudeCount = 0;

    this._runLog(`Waiting up to ${timeoutMs / 1000}s for team creation...`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Count Claude processes
        const result = spawnSync('pgrep', ['-c', 'claude'], {
          encoding: 'utf-8',
          timeout: 5000,
        });
        const claudeCount = parseInt(result.stdout.trim(), 10) || 0;

        if (claudeCount !== lastClaudeCount) {
          this._runLog(`  Claude processes: ${claudeCount}/5`);
          lastClaudeCount = claudeCount;
        }

        // Check if we have at least 5 Claude processes (Supervisor + 4 teammates)
        if (claudeCount >= 5) {
          this._runLog(`✓ Team formed: ${claudeCount} Claude processes`);
          return true;
        }

        // Also check tmux pane count as alternative
        try {
          const paneResult = spawnSync('tmux', ['-L', this.socket, 'list-panes'], {
            encoding: 'utf-8',
            timeout: 5000,
          });
          const paneCount = paneResult.stdout.split('\n').filter(l => l.trim()).length;
          if (paneCount >= 6) {
            this._runLog(`✓ Layout ready: ${paneCount} panes`);
            return true;
          }
        } catch {
          // Pane check failed, continue with process check
        }
      } catch (e) {
        // Process check failed, continue waiting
      }

      await this._sleep(checkInterval);
    }

    this._runLog(`⚠ Team creation timeout after ${timeoutMs / 1000}s`);
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HUMAN-LIKE BEHAVIOR METHODS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Human-like sleep with jitter - avoids mechanical timing patterns
   * Real humans have irregular attention and response times
   */
  async _humanSleep(baseMs, jitterPercent = HUMAN_JITTER_PERCENT) {
    const jitter = baseMs * jitterPercent * (Math.random() * 2 - 1); // ±jitter
    const actualMs = Math.max(100, Math.round(baseMs + jitter)); // Min 100ms
    await this._sleep(actualMs);
    return actualMs;
  }

  /**
   * Get poll interval with human-like variation
   * Humans don't poll at exact intervals - they glance irregularly
   */
  _getHumanPollInterval(state) {
    const baseInterval = this._getPollInterval(state);
    const jitter = baseInterval * HUMAN_JITTER_PERCENT * (Math.random() * 2 - 1);
    return Math.max(200, Math.round(baseInterval + jitter));
  }

  /**
   * Human review pause - pause naturally after actions to "read" output
   * Real engineers pause to see results before continuing
   */
  async _reviewPause(context = 'afterCommand') {
    const pauseMs = REVIEW_PAUSE_MS[context] || REVIEW_PAUSE_MS.afterCommand;
    const actualPause = await this._humanSleep(pauseMs);
    this._runLog(`Review pause (${context}): ${actualPause}ms`);
    return actualPause;
  }

  /**
   * Should take screenshot? Humans take them at meaningful moments
   * Not just periodically, but when things change or complete
   */
  _shouldTakeScreenshot(context = {}) {
    const now = Date.now();
    const timeSinceLastShot = now - (this._lastScreenshotTime || 0);

    // Always capture on important events
    if (context.stateChange && SCREENSHOT_TRIGGERS.stateChange) return true;
    if (context.errorDetected && SCREENSHOT_TRIGGERS.errorDetected) return true;
    if (context.completion && SCREENSHOT_TRIGGERS.completion) return true;

    // Max interval - humans glance periodically even if nothing changes
    if (timeSinceLastShot > SCREENSHOT_TRIGGERS.periodicMaxInterval) return true;

    return false;
  }

  /**
   * Record that a screenshot was taken
   */
  _recordScreenshot() {
    this._lastScreenshotTime = Date.now();
  }

  _runLog(msg) {
    const ts = new Date().toISOString();
    this._runLogLines.push(`[${ts}] ${msg}`);
  }

  _debugLog(label, data) {
    const ts = new Date().toISOString();
    const serialized = JSON.stringify(data, null, 2);
    this._runLogLines.push(`[${ts}] [DEBUG] ${label} ${serialized}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MISSION PACK TESTING METHODS (Phase 4.5 & Phase 8)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Verify mission pack exists in design directory
   */
  async verifyMissionPackExists() {
    const designDir = process.env.HIPILOT_DESIGN_DIR || '/home/EDA/ibex_work_upload';
    const missionPaths = [
      join(designDir, 'hipilot-mission.md'),
      join(designDir, 'hipilot-mission.yaml'),
      join(designDir, '.hipilot', 'mission.md'),
    ];

    for (const path of missionPaths) {
      if (existsSync(path)) {
        this._runLog(`Mission pack found: ${path}`);
        return { exists: true, path };
      }
    }

    this._runLog('Mission pack not found in design directory');
    return { exists: false };
  }

  /**
   * Verify agent coordination via pane status
   */
  async verifyAgentCoordination() {
    const paneText = await this._capturePaneText(0.0);

    const agents = ['Supervisor', 'Knowledge', 'Planner', 'Executor', 'Archivist'];
    const activeAgents = agents.filter(agent =>
      paneText.includes(`${agent}:`) ||
      paneText.includes(`${agent} Agent`) ||
      paneText.includes(`${agent.toLowerCase()}:`)
    );

    this._runLog(`Active agents detected: ${activeAgents.join(', ')}`);
    return {
      allActive: activeAgents.length >= 5,
      activeAgents,
      missingAgents: agents.filter(a => !activeAgents.includes(a)),
    };
  }

  /**
   * Verify mission pack content was parsed correctly
   */
  async verifyMissionPackContent() {
    const paneText = await this._capturePaneText(0.0);

    const checks = [
      { pattern: /ibex_core|ibex/i, name: 'Project name' },
      { pattern: /100\s*MHz/i, name: 'Target frequency' },
      { pattern: /sky130|skywater/i, name: 'Technology' },
      { pattern: /synthesis.*floorplan|placement.*cts/i, name: 'Stage sequence' },
      { pattern: /20\+?\s*(?:RTL|files)|SystemVerilog/i, name: 'RTL files' },
    ];

    return checks.map(check => ({
      name: check.name,
      found: check.pattern.test(paneText),
    }));
  }

  /**
   * Verify QoR was recorded by Archivist
   */
  async verifyQoRRecorded(stage) {
    const paneText = await this._capturePaneText(0.0);
    const patterns = [
      new RegExp(`Archivist.*${stage}.*QoR`, 'i'),
      new RegExp(`QoR.*snapshot.*${stage}`, 'i'),
      /WNS:\s*[\d.-]+\s*ns/i,
      /TNS:\s*[\d.-]+\s*ns/i,
      /Archivist.*recorded/i,
    ];

    const found = patterns.some(p => p.test(paneText));
    this._runLog(`QoR recorded for ${stage}: ${found}`);
    return found;
  }

  /**
   * Compare actual QoR against mission pack targets
   */
  async compareQoRAgainstTargets() {
    const paneText = await this._capturePaneText(0.0);

    // Extract actual QoR from pane
    const wnsMatch = paneText.match(/WNS:\s*([\d.-]+)\s*ns/i);
    const tnsMatch = paneText.match(/TNS:\s*([\d.-]+)\s*ns/i);

    const actualWNS = wnsMatch ? parseFloat(wnsMatch[1]) : null;
    const actualTNS = tnsMatch ? parseFloat(tnsMatch[1]) : null;

    // Mission pack targets (from ibex-mission.md)
    const targets = {
      wns: 0.0,
      tns: 0.0,
      freq: 100.0,
    };

    return {
      timing: {
        target: targets,
        actual: { wns: actualWNS, tns: actualTNS },
        wnsMet: actualWNS !== null && actualWNS >= targets.wns,
        tnsMet: actualTNS !== null && actualTNS >= targets.tns,
      },
    };
  }

  /**
   * Run mission pack driven full flow test (Phase 8)
   */
  async runMissionPackFlowTest(options = {}) {
    const startTime = Date.now();
    this._runLog('Starting Mission Pack Flow Test (Phase 8)');

    // Step 1: Verify mission pack exists
    const missionCheck = await this.verifyMissionPackExists();
    if (!missionCheck.exists) {
      return { status: 'failed', reason: 'Mission pack not found' };
    }

    // Step 2: Type command to execute flow
    const command = options.command || 'execute the complete RTL2GDS flow from the mission pack';
    await this._typeCommand(command);

    // Step 3: Monitor agent coordination
    const agentCheck = await this.verifyAgentCoordination();
    if (!agentCheck.allActive) {
      this._runLog(`Warning: Missing agents - ${agentCheck.missingAgents.join(', ')}`);
    }

    // Step 4: Wait for completion with stage tracking
    const stages = options.stages || [
      'synthesis', 'design_init', 'floorplan', 'powerplan',
      'placement', 'cts', 'post_cts_opt', 'routing', 'route_opt', 'chip_finish'
    ];

    const stageResults = [];
    for (const stage of stages) {
      this._runLog(`Waiting for stage: ${stage}`);
      const result = await this._waitForStageCompletion(stage, { timeout: 900000 });
      stageResults.push({ stage, ...result });

      // Verify QoR recorded
      const qorRecorded = await this.verifyQoRRecorded(stage);
      if (!qorRecorded) {
        this._runLog(`Warning: QoR may not have been recorded for ${stage}`);
      }
    }

    // Step 5: Verify final outputs
    const designDir = process.env.HIPILOT_DESIGN_DIR || '/home/EDA/ibex_work_upload';
    const gdsPath = join(designDir, 'ibex_core.gds');
    const gdsExists = existsSync(gdsPath);
    const gdsSize = gdsExists ? statSync(gdsPath).size : 0;

    // Step 6: Compare QoR against targets
    const qorComparison = await this.compareQoRAgainstTargets();

    const duration = Date.now() - startTime;
    const allStagesComplete = stageResults.every(r => r.complete);
    const timingClosed = qorComparison.timing.wnsMet;

    // Determine certification tier
    let tier = 'FAIL';
    if (allStagesComplete && gdsExists && timingClosed) {
      tier = 'PLATINUM';
    } else if (allStagesComplete && gdsExists) {
      tier = 'GOLD';
    } else if (stageResults.filter(r => r.complete).length >= 8) {
      tier = 'SILVER';
    } else if (stageResults.filter(r => r.complete).length >= 5) {
      tier = 'BRONZE';
    }

    return {
      status: tier === 'FAIL' ? 'failed' : 'passed',
      tier,
      stageResults,
      gdsExists,
      gdsSize,
      timingClosed,
      qorComparison,
      agentCoordination: agentCheck,
      duration,
    };
  }

  /**
   * Helper: Wait for a specific stage to complete
   */
  async _waitForStageCompletion(stageName, options = {}) {
    const timeout = options.timeout || 900000; // 15 min default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const paneText = await this._capturePaneText(0.0);

      // Check for stage completion indicators
      const completePatterns = [
        new RegExp(`${stageName}.*complete`, 'i'),
        new RegExp(`${stageName}.*done`, 'i'),
        new RegExp(`${stageName}.*finished`, 'i'),
        new RegExp(`${stageName}.*checkpoint`, 'i'),
        new RegExp(`${stageName}.*enc`, 'i'),
      ];

      if (completePatterns.some(p => p.test(paneText))) {
        return { complete: true, duration: Date.now() - startTime };
      }

      // Check for errors
      const errorPatterns = [
        new RegExp(`${stageName}.*error`, 'i'),
        new RegExp(`${stageName}.*failed`, 'i'),
        /ERROR.*Innovus/i,
        /ERROR.*dc_shell/i,
      ];

      if (errorPatterns.some(p => p.test(paneText))) {
        return { complete: false, error: true, duration: Date.now() - startTime };
      }

      await this._sleep(5000); // Check every 5 seconds
    }

    return { complete: false, timeout: true, duration: Date.now() - startTime };
  }
}
