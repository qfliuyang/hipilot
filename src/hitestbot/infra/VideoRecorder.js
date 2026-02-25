/**
 * VideoRecorder - Reliable video recording for E2E tests
 *
 * Uses nohup to ensure recording persists even if SSH disconnects.
 * Properly stops recording with SIGINT for clean ffmpeg shutdown.
 */

import fs from 'fs';
import path from 'path';

class VideoRecorder {
  constructor(options = {}) {
    this.testDir = options.testDir;
    this.display = options.display || ':0';
    this.resolution = options.resolution || '2560x1558';
    this.framerate = options.framerate || 20;
    this.outputFile = options.outputFile || `e2e_${path.basename(this.testDir)}.mp4`;
    this.pidFile = null;
    this.logFile = null;
  }

  /**
   * Start video recording with nohup to ensure it persists
   */
  async start(sshFn) {
    const recordingsDir = path.join(this.testDir, 'recordings');
    const outputPath = path.join(recordingsDir, this.outputFile);
    this.pidFile = `/tmp/ffmpeg_${path.basename(this.testDir)}.pid`;
    this.logFile = `/tmp/ffmpeg_${path.basename(this.testDir)}.log`;

    // Create recordings directory
    await sshFn(`mkdir -p ${recordingsDir}`);

    const ffmpegCmd = `
      export DISPLAY=${this.display}
      cd ${recordingsDir}

      RESOLUTION=\$(xdpyinfo | grep dimensions | awk '{print \$2}')
      echo "Detected resolution: \$RESOLUTION"

      nohup ffmpeg -y -f x11grab -video_size \$RESOLUTION -framerate ${this.framerate} -i ${this.display} \
        -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
        ${this.outputFile} \
        > ${this.logFile} 2>&1 < /dev/null &

      echo $! > ${this.pidFile}
      sleep 3

      if ps -p $(cat ${this.pidFile}) > /dev/null 2>&1; then
        echo "FFMPEG_STARTED"
        ls -lh ${outputPath} 2>/dev/null || echo "WAITING_FOR_FILE"
      else
        echo "FFMPEG_FAILED"
        cat ${this.logFile}
        exit 1
      fi
    `;

    const result = await sshFn(ffmpegCmd, 30000, true);

    if (!result.includes('FFMPEG_STARTED')) {
      throw new Error('Failed to start video recording');
    }

    console.log('   📹 Recording started');
    return true;
  }

  /**
   * Stop video recording gracefully with SIGINT
   */
  async stop(sshFn) {
    if (!this.pidFile) {
      console.log('   ⚠️  No recording to stop');
      return false;
    }

    const stopCmd = `
      PID=$(cat ${this.pidFile} 2>/dev/null)
      if [ -n "$PID" ]; then
        if ps -p $PID > /dev/null 2>&1; then
          echo "Stopping ffmpeg PID: $PID"
          kill -INT $PID 2>/dev/null || true
          sleep 4

          # Check if still running
          if ps -p $PID > /dev/null 2>&1; then
            echo "Force killing..."
            kill -9 $PID 2>/dev/null || true
          fi
        else
          echo "Process already stopped"
        fi
      else
        echo "No PID file found"
      fi

      # Show final file
      ls -lh ${path.join(this.testDir, 'recordings', this.outputFile)} 2>/dev/null || echo "No video file"
    `;

    try {
      const result = await sshFn(stopCmd, 30000, true);
      console.log('   📹 Recording stopped');
      return result;
    } catch (err) {
      console.log('   ⚠️  Error stopping recording:', err.message);
      return false;
    }
  }

  /**
   * Check if recording is still active
   */
  async isRecording(sshFn) {
    if (!this.pidFile) return false;

    try {
      const result = await sshFn(
        `PID=$(cat ${this.pidFile} 2>/dev/null) && ps -p $PID > /dev/null 2>&1 && echo "RUNNING" || echo "STOPPED"`,
        5000,
        true
      );
      return result.includes('RUNNING');
    } catch {
      return false;
    }
  }

  /**
   * Get video file size
   */
  async getFileSize(sshFn) {
    const videoPath = path.join(this.testDir, 'recordings', this.outputFile);

    try {
      const result = await sshFn(
        `ls -lh ${videoPath} 2>/dev/null | awk '{print $5}' || echo "0"`,
        5000,
        true
      );
      return result.trim();
    } catch {
      return '0';
    }
  }
}

export { VideoRecorder };
