# HiTestBot - HiPilot Testing Framework

General-purpose test framework with handy tools for E2E testing, skills testing, UI testing, and more.

## Quick Start

```bash
# Run default E2E test
npm run hitestbot

# Or run directly
node src/hitestbot/index.js
```

## Architecture

```
HiTestBot/
├── TestRunner.js          # Base class for all test runners
├── E2ETestRunner.js       # HiPilot E2E test implementation
├── TmuxController.js      # Standardized tmux operations
├── VideoRecorder.js       # Reliable ffmpeg recording
├── TestReporter.js        # Report generation
├── TestUtils.js           # Handy test utilities
└── index.js               # CLI entry & exports
```

## Usage Patterns

### 1. Run Default E2E Test

Tests HiPilot on the EDA server with full video evidence:

```bash
npm run hitestbot
```

**What it does:**
1. Cleanup - Kills all existing sessions
2. Video Recording - Starts ffmpeg with nohup
3. Code Upload - Uploads HiPilot to EDA server
4. Dependencies - Runs npm install
5. MCP Config - Updates MCP server paths
6. Tmux Setup - Creates split-pane workspace
7. Innovus - Starts Innovus in right pane
8. Terminal - Opens windowed gnome-terminal
9. Claude Code - Starts Claude Code in left pane
10. HiPilot Test - Sends "list all HiPilot skills"
11. EDA Test - Executes Innovus commands
12. Evidence - Captures screenshots and logs
13. Download - Downloads all evidence
14. Report - Generates HITESTBOT_REPORT.md

### 2. Extend for Custom Tests

Create your own test runner by extending `TestRunner`:

```javascript
import { TestRunner, TestUtils } from './hitestbot/index.js';

class SkillsTestRunner extends TestRunner {
  constructor(options) {
    super({
      testName: 'Skills Validation Test',
      ...options
    });
  }

  async execute() {
    // Define your test flow
    await this.step('Load Skills', () => this.loadSkills());
    await this.step('Validate Templates', () => this.validateTemplates());
    await this.step('Check Parameters', () => this.checkParameters());

    // Generate report automatically
    await this.generateReport();
  }

  async loadSkills() {
    // Test implementation
    const skills = await this.loadSkillFiles();
    TestUtils.assert(skills.length > 0, 'No skills found');
    return skills;
  }
}

// Run it
const runner = new SkillsTestRunner();
runner.run();
```

### 3. UI Element Testing

```javascript
import { TestUtils } from './hitestbot/index.js';

// Take screenshot
await TestUtils.captureScreenshot('/tmp/before.png', ':0');

// Perform action
await clickButton('#submit');

// Take another screenshot
await TestUtils.captureScreenshot('/tmp/after.png', ':0');

// Compare
const result = await TestUtils.compareImages(
  '/tmp/before.png',
  '/tmp/after.png',
  '/tmp/diff.png'
);

TestUtils.assert(result.similar, 'UI did not change as expected');
```

### 4. Use Individual Tools

```javascript
import { TmuxController, VideoRecorder, TestUtils } from './hitestbot/index.js';

// Control tmux
const tmux = new TmuxController({ sessionName: 'mytest' });
await tmux.createSession(sshFn);
await tmux.sendKeys('mytest:0.0', 'my command', true, 'C-m');

// Record video
const recorder = new VideoRecorder({
  testDir: '/tmp/mytest',
  display: ':0'
});
await recorder.start(sshFn);
// ... run tests ...
await recorder.stop(sshFn);

// Utilities
await TestUtils.waitFor(() => fileExists('/tmp/output.txt'), 30000);
TestUtils.assertContains(fileContent, 'SUCCESS');
```

## TestUtils API

### Timing & Waits
- `sleep(ms)` - Promise-based delay
- `waitFor(condition, timeout, interval)` - Wait for condition
- `waitForFile(path, timeout)` - Wait for file to exist
- `time(fn)` - Time an operation

### Assertions
- `assert(condition, message)` - Assert condition is true
- `assertEquals(actual, expected, message)` - Assert equality
- `assertContains(text, substring, message)` - Assert text contains substring

### File Operations
- `fileContains(path, pattern)` - Check if file contains pattern
- `getFileSize(path)` - Get human-readable file size
- `readLastLines(path, n)` - Read last N lines from file
- `grepFile(path, pattern)` - Search file for pattern
- `createTestDir(baseDir, testName)` - Create timestamped test directory
- `cleanDirectory(path)` - Remove all contents from directory

### Image Comparison
- `captureScreenshot(path, display)` - Capture screen using ImageMagick
- `compareImages(img1, img2, diffOutput, threshold)` - Compare two images

### Utilities
- `retry(fn, retries, delay)` - Retry an async operation
- `formatDuration(ms)` - Format milliseconds as human-readable string
- `randomString(length)` - Generate random string

## Key Features

### Uses C-m (Ctrl+M) for Claude Code

```javascript
// CORRECT - HiTestBot uses C-m
await tmux.sendKeys('hipilot:0.0', 'list all HiPilot skills', true, 'C-m');

// WRONG - Don't use Enter for Claude Code
await tmux.sendKeys('hipilot:0.0', 'list all HiPilot skills', true, 'Enter');
```

### Windowed Terminal

Terminal is opened centered on desktop (not fullscreen):
- Geometry: 160x45
- Position: +560+419 (centered on 2560x1558)
- Desktop visible around window (prevents cheating)

### Reliable Video Recording

Uses `nohup` with stdin redirected to `/dev/null`:
```bash
nohup ffmpeg -f x11grab ... < /dev/null > /tmp/ffmpeg.log 2>&1 &
```

This ensures recording continues even if SSH disconnects.

## Evidence Structure

```
e2e_evidence/YYYYMMDD_HHMMSS/
├── *.mp4          Video recording (full desktop)
├── *.png          Screenshots
├── *_pane.log     Tmux pane captures
└── HITESTBOT_REPORT.md  Test report
```

## Test Report Format

```markdown
# HiTestBot - Skills Validation Test Report

**Timestamp:** 20260221_120000
**Result:** ✅ PASSED

## Summary

| Metric | Value |
|--------|-------|
| Total Steps | 3 |
| Passed | 3 ✅ |
| Failed | 0 |

## Execution Log

| # | Step | Status | Duration |
|---|------|--------|----------|
| 1 | Load Skills | ✅ | 0.5s |
| 2 | Validate Templates | ✅ | 1.2s |
| 3 | Check Parameters | ✅ | 0.3s |
```

## Requirements

- EDA server access (for E2E tests)
- sshpass for non-interactive SSH
- ImageMagick (for screenshots)
- ffmpeg (for video recording)

## Extending HiTestBot

Create new test types by extending `TestRunner`:

1. **Create your runner class:**
```javascript
import { TestRunner } from './TestRunner.js';

class MyCustomTest extends TestRunner {
  async execute() {
    // Define test steps
  }
}
```

2. **Use TestUtils for common operations:**
```javascript
import { TestUtils } from './TestUtils.js';

await TestUtils.waitFor(() => checkCondition());
TestUtils.assert(result, 'Test failed');
```

3. **Use infrastructure classes:**
```javascript
import { TmuxController, VideoRecorder } from './index.js';
```

4. **Generate reports:**
```javascript
await this.generateReport();
```

## No Manual Mistakes

HiTestBot avoids common errors:
- ✅ Uses C-m for Claude Code commands
- ✅ Uses nohup for video recording
- ✅ Opens windowed terminal (not fullscreen)
- ✅ Preserves API key when updating MCP config
- ✅ Waits appropriate times for initialization
- ✅ Captures evidence systematically

---
*Part of HiPilot v0.4.0*
