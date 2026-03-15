#!/usr/bin/env python3

with open('src/hitestbot/core/FlowCertifier.js', 'r') as f:
    content = f.read()

# Fix: Add command validation and safer execution in typeInHiPilot
old_typein = """  typeInHiPilot(text) {
    const target = `${this.session}:0.0`;
    const escaped = text.replace(/'/g, "'\\\\''");
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
  }"""

new_typein = """  typeInHiPilot(text) {
    // SECURITY: Validate input against allowlist
    const allowedPattern = /^[a-zA-Z0-9_\\-\\/\\s\\.:;,"'`!?@#$%\\^\\&*()\\[\\]{}=+\\<\\>\\|\\~`]+$/;
    if (!allowedPattern.test(text)) {
      this._runLog(`Rejected invalid command characters: "${text}"`);
      return false;
    }

    // Block dangerous command patterns
    const dangerousPatterns = [
      /;\\s*rm\\s+/i, /;\\s*sudo\\s+/i, /;\\s*dd\\s+/i,
      />\\s*\\/dev\\/null/i, /2>&1.*\\/dev\\/null/i,
      /\\$\\(/, /`/, /\\|\\s*sh\\s*$/i, /\\|\\s*bash\\s*$/i,
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
  }"""

content = content.replace(old_typein, new_typein)

with open('src/hitestbot/core/FlowCertifier.js', 'w') as f:
    f.write(content)

print('Fixed command injection vulnerability')
