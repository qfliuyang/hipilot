/**
 * FlowCertifier — Uses HiPilot like a human, records everything, correlates evidence.
 *
 * HiTestBot is a virtual human. It:
 *   1. Launches HiPilot (bin/hipilot)
 *   2. Starts video recording on display :0
 *   3. Waits for Claude Code to be ready
 *   4. Types a command (e.g., /rtl2gds)
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

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, copyFileSync, createWriteStream } from 'fs';
import { join, basename } from 'path';
import { ObservationPoint } from './ObservationPoint.js';
import { FlowReporter } from './FlowReporter.js';

const POLL_INTERVAL_MS = 5000;
const CLAUDE_READY_TIMEOUT_MS = 120000;

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
    this.testWorkBase = options.testWorkBase || '/home/EDA/hipilot_test/runs';

    this.timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.evidenceDir = join(this.evidenceBaseDir, this.timestamp);
    this.testWorkDir = join(this.testWorkBase, this.timestamp);
    this.observations = [];
    this.stageResults = [];
    this.recordingStartTime = null;
    this._runLogLines = [];
    this._paneLog = [];
    this._ffmpegPid = null;
    this._videoFile = null;
  }

  /**
   * Prepare a clean design copy for this test run.
   * Extracts ibex_demo.tar into a timestamped directory so each test
   * starts from scratch — no leftover results from previous runs.
   *
   * Returns the path to the clean work directory.
   */
  prepareCleanDesign() {
    this._runLog('Preparing clean design copy...');

    // Create timestamped work directory
    try {
      execSync(`mkdir -p ${this.testWorkDir}`, { encoding: 'utf-8', timeout: 5000 });
    } catch (e) {
      this._runLog(`Failed to create work dir: ${e.message}`);
      return null;
    }

    // Extract design tarball
    if (!existsSync(this.designTarball)) {
      this._runLog(`Design tarball not found: ${this.designTarball} — using existing design location`);
      return null;
    }

    try {
      execSync(`tar xf ${this.designTarball} -C ${this.testWorkDir}`, {
        encoding: 'utf-8', timeout: 60000,
      });
      // Find the extracted directory (usually ibex_work_upload or similar)
      const contents = execSync(`ls ${this.testWorkDir}`, { encoding: 'utf-8', timeout: 5000 }).trim().split('\n');
      const designDir = contents.length === 1
        ? join(this.testWorkDir, contents[0])
        : this.testWorkDir;

      this._runLog(`Clean design at: ${designDir}`);
      return designDir;
    } catch (e) {
      this._runLog(`Failed to extract design: ${e.message}`);
      return null;
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

      // Verify ffmpeg started
      execSync('sleep 2', { timeout: 5000 });
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

      // Wait a few seconds for ffmpeg to finalize
      execSync('sleep 3', { timeout: 10000 });

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

  async launchHiPilot() {
    this._runLog('Phase 1: Launching HiPilot...');

    // Kill ALL stale processes (EDA tools, tmux, ffmpeg) — critical for clean test
    this._cleanStaleProcesses();
    await this._sleep(2000);

    const binPath = this.hipilotBin || join(this._projectRoot(), 'bin', 'hipilot');
    const projectDir = this._projectRoot();

    // Step 1: Create the tmux session (headless — reliable)
    try {
      const output = execSync(`bash ${binPath} --no-terminal 2>&1`, {
        encoding: 'utf-8', timeout: 300000,
        env: { ...process.env, HIPILOT_SESSION: this.session },
      });
      this._runLog(`bin/hipilot --no-terminal output:\n${output}`);
    } catch (e) {
      this._runLog(`bin/hipilot failed: ${e.message}`);
      throw new Error(`Failed to launch HiPilot: ${e.message}`);
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
      execSync('sleep 2', { timeout: 5000 });
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

  async waitForClaudeReady() {
    this._runLog('Phase 2: Waiting for Claude Code to be ready...');
    const start = Date.now();

    while (Date.now() - start < CLAUDE_READY_TIMEOUT_MS) {
      const claudeOutput = this._capturePane('0.0');
      const lines = claudeOutput.split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1] || '';

      // Claude Code is ready when ANY of these appear ANYWHERE in the capture:
      // - The ❯ prompt character (Claude Code's input prompt)
      // - "Welcome" message (Claude Code welcome screen)
      // - "bypass permissions" (Claude started but permissions prompt showing)
      const isReady =
        claudeOutput.includes('❯') ||
        claudeOutput.includes('Welcome') ||
        claudeOutput.includes('bypass permissions') ||
        claudeOutput.includes('Claude Code') ||
        claudeOutput.includes('Opus');

      if (isReady) {
        this._runLog(`Claude Code ready (${((Date.now() - start) / 1000).toFixed(1)}s), captured ${claudeOutput.length} chars`);
        return true;
      }

      if (claudeOutput.includes('Claude CLI not found')) {
        this._runLog('Claude CLI not installed — left pane shows fallback');
        return false;
      }

      await this._sleep(3000);
    }

    this._runLog(`Claude Code not ready after ${CLAUDE_READY_TIMEOUT_MS / 1000}s`);
    return false;
  }

  typeInHiPilot(text) {
    const target = `${this.session}:0.0`;
    const escaped = text.replace(/'/g, "'\\''");
    try {
      execSync(`tmux -L ${this.socket} send-keys -t ${target} -l '${escaped}'`, {
        encoding: 'utf-8', timeout: 5000,
      });
      execSync(`tmux -L ${this.socket} send-keys -t ${target} C-m`, {
        encoding: 'utf-8', timeout: 5000,
      });
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
  _detectState(claude, eda, claudeChanged, edaChanged) {
    const claudeLines = claude.split('\n').filter(l => l.trim());
    const lastLine = claudeLines[claudeLines.length - 1] || '';

    // Check for fatal errors first — a human would notice and stop
    for (const pat of EARLY_ABORT_PATTERNS) {
      if (pat.test(claude)) return { state: 'error', detail: claude.match(pat)[0] };
    }

    // Check for bypass permissions prompt (Claude Code dangerous mode)
    if (/bypass permissions|Dangerous mode|⏵⏵/.test(claude)) {
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

    // Check for Claude's ready prompt — the cursor is blinking at ❯ or >
    // This is the clearest signal: Claude finished and is waiting for next input
    const claudePromptReady = /^[>❯]\s*$/.test(lastLine) ||
      /^❯\s/.test(lastLine) ||
      lastLine.includes('What can I help') ||
      lastLine.includes('How can I help');

    // Check if Claude is actively thinking (spinner visible)
    const claudeThinking = /thinking|Drizzling|Working|Generating/i.test(lastLine) ||
      /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✶●◉⠿]/.test(lastLine);

    // Check EDA pane for tool prompt (innovus N>, icc2_shell>, $)
    const edaLines = eda.split('\n').filter(l => l.trim());
    const edaLastLine = edaLines[edaLines.length - 1] || '';
    const edaPromptReady = /innovus\s*\d+>/i.test(edaLastLine) ||
      /icc2_shell>/i.test(edaLastLine) ||
      /pt_shell>/i.test(edaLastLine) ||
      /\$\s*$/.test(edaLastLine);

    // If Claude shows prompt AND Claude pane didn't just change → done
    if (claudePromptReady && !claudeChanged) {
      return { state: 'done', detail: `Claude prompt: "${lastLine.trim()}"` };
    }

    // Claude is actively producing output or thinking
    if (claudeChanged || claudeThinking) {
      return { state: 'working', detail: claudeThinking ? 'thinking' : 'output changing' };
    }

    // Left pane idle but right pane changing — EDA tool is executing
    if (!claudeChanged && edaChanged) {
      return { state: 'waiting_for_eda', detail: edaPromptReady ? 'EDA prompt returned' : 'EDA running' };
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

    const start = Date.now();
    let lastClaudeOutput = '';
    let lastEdaOutput = '';
    let lastClaudeChangeTime = start;
    let lastEdaChangeTime = start;
    let approvalCount = 0;
    let questionCount = 0;
    let pollCount = 0;
    let lastState = 'working';

    while (Date.now() - start < maxWaitMs) {
      await this._sleep(POLL_INTERVAL_MS);
      pollCount++;

      // Log both panes continuously — this is what a human sees
      const panes = this._logPanes(`poll_${pollCount}`);

      // Track what changed — a human notices when text appears or stops
      const claudeChanged = panes.claude !== lastClaudeOutput;
      const edaChanged = panes.eda !== lastEdaOutput;
      if (claudeChanged) { lastClaudeChangeTime = Date.now(); lastClaudeOutput = panes.claude; }
      if (edaChanged) { lastEdaChangeTime = Date.now(); lastEdaOutput = panes.eda; }

      // Detect state — what would a human see?
      const { state, detail } = this._detectState(panes.claude, panes.eda, claudeChanged, edaChanged);

      if (state !== lastState) {
        this._runLog(`State: ${lastState} → ${state}${detail ? ` (${detail})` : ''}`);
        lastState = state;
      }

      // Screenshot every 60s
      if (pollCount % 12 === 0) this._takeScreenshot(`progress_${pollCount}`);

      // Observation point every 30s
      if (pollCount % 6 === 0) {
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
        await this._sleep(300);
        this._sendKeysToClaude(' ');
        await this._sleep(300);
        this._sendKeysToClaude('C-m');
        await this._sleep(500);
        lastClaudeChangeTime = Date.now();
        continue;
      }

      if (state === 'asking_question') {
        this._runLog(`Claude asked: "${detail}" — responding "yes"`);
        this._takeScreenshot(`question_${questionCount}`);
        this.typeInHiPilot('yes');
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
        // EDA tool is running. A human waits — no timeout needed.
        // But log so we know what's happening.
      }

      if (state === 'idle') {
        // Both panes quiet, no prompt detected. Check how long:
        const quietTime = Math.min(Date.now() - lastClaudeChangeTime, Date.now() - lastEdaChangeTime);
        // A human would wait ~2 minutes before concluding something is stuck.
        // But if it's been very quiet, take a screenshot and log the state.
        if (quietTime > 120000 && pollCount > 10) {
          this._runLog(`Both panes quiet for ${(quietTime / 1000).toFixed(0)}s with no prompt — may be stuck`);
          this._takeScreenshot(`quiet_${pollCount}`);
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
    this._runLog(`Watch complete: ${(totalTime / 1000).toFixed(1)}s, ${approvalCount} approvals, ${questionCount} questions answered`);
    return { elapsed_ms: totalTime, approvals: approvalCount, questions: questionCount, polls: pollCount };
  }

  evaluate(beforeObs, afterObs) {
    const claudeBefore = beforeObs.content?.claude_pane_last50 || '';
    const claudeAfter = afterObs.content?.claude_pane_last50 || '';
    const edaAfter = afterObs.content?.eda_pane_last50 || '';

    const scores = {
      L1_prompt_delivery: this._scoreResponse(claudeBefore, claudeAfter),
      L2_intent_recognition: this._scoreIntent(claudeAfter),
      L3_mcp_tool_usage: this._scoreToolUsage(claudeAfter, edaAfter),
      L4_eda_execution: this._scoreEdaExecution(edaAfter),
      L5_qor_assessment: this._scoreQoR(claudeAfter),
    };

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
    const status = totalScore >= 4.0 ? 'pass' : totalScore >= 2.0 ? 'partial' : 'fail';

    const classification = status !== 'pass'
      ? this._classifyFailure(scores, claudeAfter, edaAfter)
      : null;

    return {
      stage: 'full_flow',
      scores,
      total_score: totalScore,
      max_score: 5.0,
      status,
      failure_classification: classification,
      mcp_calls_count: null,
      evidence_summary: {
        claude_output_lines: claudeAfter.split('\n').length,
        eda_output_lines: edaAfter.split('\n').length,
      },
    };
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
    if (found.length >= 2 && edaHasActivity) return { score: 1.0, detail: `MCP tools used (${found.join(', ')}), EDA tool active` };
    if (found.length >= 1 || edaHasActivity) return { score: 0.5, detail: `Partial: MCP(${found.join(',') || 'none'}), EDA(${edaHasActivity ? 'active' : 'idle'})` };
    if (claudeOutput.includes('tmux send-keys') || claudeOutput.includes('bash:')) return { score: 0.0, detail: 'Claude used direct bash/tmux instead of MCP tools' };
    return { score: 0.0, detail: 'No MCP tool usage or EDA activity detected' };
  }

  _scoreEdaExecution(edaOutput) {
    const errorPatterns = [/\*\*ERROR/i, /FATAL/i, /syntax error/i, /unknown command/i];
    for (const pat of errorPatterns) {
      if (pat.test(edaOutput)) return { score: 0.0, detail: `EDA error: ${edaOutput.match(pat)[0]}` };
    }

    // Check for EDA tool prompt (strongest signal: tool ran and returned)
    const promptPatterns = [/innovus\s*\d+>/i, /icc2_shell>/i, /pt_shell>/i];
    for (const pat of promptPatterns) {
      if (pat.test(edaOutput)) return { score: 1.0, detail: 'EDA tool ran and returned to prompt' };
    }

    // Check for EDA tool activity (weaker: tool output without prompt)
    const activityPatterns = [
      /reading lef/i, /init_design/i, /floorPlan/i, /place_opt/i, /ccopt/i,
      /routeDesign/i, /optDesign/i, /timeDesign/i, /saveDesign/i,
      /checkDesign/i, /source.*\.tcl/i, /source.*\.enc/i,
    ];
    for (const pat of activityPatterns) {
      if (pat.test(edaOutput)) return { score: 0.5, detail: `EDA tool active: ${edaOutput.match(pat)[0]}` };
    }

    // If the pane only has the welcome message or shell prompt, no tool ran
    if (edaOutput.includes('Start your EDA tool') || edaOutput.includes('EDA Tool Pane')) {
      return { score: 0.0, detail: 'EDA pane shows only welcome message — no tool started' };
    }

    if (edaOutput.length < 100) return { score: 0.0, detail: 'No significant EDA tool output' };
    return { score: 0.0, detail: 'EDA pane has text but no tool activity detected' };
  }

  _scoreQoR(claudeOutput) {
    const wnsMatch = claudeOutput.match(/WNS[:\s]*(-?[\d.]+)/i);
    const tnsMatch = claudeOutput.match(/TNS[:\s]*(-?[\d.]+)/i);
    if (wnsMatch && tnsMatch) return { score: 1.0, detail: `QoR reported: WNS=${wnsMatch[1]}, TNS=${tnsMatch[1]}` };
    if (wnsMatch || tnsMatch) return { score: 0.5, detail: `Partial QoR: WNS=${wnsMatch?.[1] ?? 'N/A'}, TNS=${tnsMatch?.[1] ?? 'N/A'}` };
    const metricsKeywords = ['timing', 'violation', 'slack', 'pass', 'fail', 'score'];
    const found = metricsKeywords.filter(k => claudeOutput.toLowerCase().includes(k));
    if (found.length >= 2) return { score: 0.5, detail: `Claude discussed metrics (${found.join(', ')}) but no WNS/TNS numbers` };
    return { score: 0.0, detail: 'No QoR assessment in Claude output' };
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
    const maxWaitMs = options.maxWaitMs || 300000;
    const phase = options.phase ?? null;
    const purpose = options.purpose || command;
    mkdirSync(this.evidenceDir, { recursive: true });
    this.recordingStartTime = Date.now();

    // Prepare clean design copy (extract tarball to timestamped dir)
    // Each test starts from scratch — no leftover results from previous runs.
    const cleanDesignDir = this.prepareCleanDesign();

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
    await this.launchHiPilot();

    // Give the terminal window time to open and render
    await this._sleep(3000);

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

    // Phase 6: Evaluate
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
    // Use -e flag to get escape sequences, or -S -10000 for deep scrollback.
    // Try multiple approaches and return the longest result.
    const target = `${this.session}:0.${paneId}`;
    let best = '';
    const cmds = [
      // Normal visible content
      `tmux -L ${this.socket} capture-pane -t ${target} -p 2>/dev/null`,
      // Full scrollback (catches content that scrolled up)
      `tmux -L ${this.socket} capture-pane -t ${target} -p -S -1000 2>/dev/null`,
      // Start from beginning of visible area
      `tmux -L ${this.socket} capture-pane -t ${target} -p -S - 2>/dev/null`,
    ];
    for (const cmd of cmds) {
      try {
        const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
        if (result.length > best.length) best = result;
      } catch { /* try next */ }
    }
    return best || '';
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

  _runLog(msg) {
    const ts = new Date().toISOString();
    this._runLogLines.push(`[${ts}] ${msg}`);
  }
}
