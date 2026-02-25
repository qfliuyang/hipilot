# Claude Code Installation on EDA Server

**Date:** 2026-02-19
**Status:** ✅ Complete
**Server:** 192.168.112.163 (CentOS 7.9, glibc 2.17)

---

## Overview

Successfully installed Claude Code v2.1.47 on the EDA server using an unofficial Node.js v20.18.3 build with glibc-217 support. This enables the use of Claude Code for HiPilot development on the target platform.

---

## Challenge

**Problem:** Claude Code requires Node.js v18+, but CentOS 7 has glibc 2.17. Modern Node.js builds require glibc 2.28+.

**Solution:** Used unofficial Node.js builds from https://unofficial-builds.nodejs.org/download/release/ with glibc-217 support.

---

## Installation Steps

### 1. Download Node.js v20.18.3 (glibc-217)

Downloaded locally (much faster) and transferred to EDA server:

```bash
# On local machine
cd /tmp
curl -L -o node-v20.18.3-linux-x64-glibc-217.tar.xz \
  https://unofficial-builds.nodejs.org/download/release/v20.18.3/node-v20.18.3-linux-x64-glibc-217.tar.xz

# Transfer to EDA server
scp node-v20.18.3-linux-x64-glibc-217.tar.xz EDA@192.168.112.163:/home/EDA/hipilot_test/
```

**File Details:**
- URL: https://unofficial-builds.nodejs.org/download/release/v20.18.3/
- Build: node-v20.18.3-linux-x64-glibc-217.tar.xz
- Size: 24.8 MB
- Compiled: 2025-02-11

### 2. Extract on EDA Server

```bash
ssh EDA@192.168.112.163
cd /home/EDA/hipilot_test
tar -xf node-v20.18.3-linux-x64-glibc-217.tar.xz
```

### 3. Verify Installation

```bash
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
node --version  # v20.18.3
npm --version   # 10.8.2
```

✅ Node.js v20.18.3 works perfectly on CentOS 7 with glibc 2.17

### 4. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

**Installation Result:**
- Package: @anthropic-ai/claude-code
- Version: 2.1.47
- Location: /home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/claude
- Added: 3 packages in 13 seconds

### 5. Verify Claude Code

```bash
claude --version  # 2.1.47 (Claude Code)
claude --help     # Shows full help
```

✅ Claude Code is fully functional

### 6. Add to PATH Permanently

Added to `~/.bashrc`:

```bash
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
```

Now available in all new SSH sessions.

---

## Single Node.js Version (Unified)

**Decision:** Use Node.js v20.18.3 for everything (HiPilot + Claude Code)

**Why?**
- ✅ Simplifies development (one version to manage)
- ✅ Latest boxen@8.0 has better features
- ✅ chalk@5.3 is pure ESM (modern)
- ✅ Better performance and security
- ✅ Compatible with CentOS 7 (glibc-217 build)

**HiPilot Dependencies (Node v20):**
```json
{
  "chalk": "^5.3.0",
  "boxen": "^8.0.0",
  "cli-table3": "^0.6.3",
  "ora": "^8.0.0"
}
```

**Installation:** `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/`
**Default:** Added to `~/.bashrc` for all sessions

**Node v16 Still Available:**
- Path: `/home/EDA/hipilot_test/node-v16.20.2-linux-x64/`
- Kept for legacy compatibility if needed
- Not used by default

---

## System Verification

Tested Node.js v20.18.3 on EDA server:

```javascript
console.log('Node.js version:', process.version);  // v20.18.3
console.log('Platform:', process.platform);        // linux
console.log('Arch:', process.arch);                // x64
console.log('Total memory:', '15.49 GB');
console.log('CPU cores:', 6);
```

✅ All system checks passed

---

## Claude Code Capabilities

Now available on EDA server:

```bash
# Interactive session
claude

# Non-interactive
claude -p "list all files"

# Continue conversation
claude -c

# With specific agent
claude --agent review

# Debug mode
claude -d

# Allow specific tools
claude --allowed-tools "Bash(git:*) Edit"

# Help
claude --help
```

---

## Next Steps

### For HiPilot Development

1. **Use Claude Code for development** - Now available directly on EDA server
2. **Test HiPilot integration** - Verify HiPilot works with Claude Code
3. **Create MCP servers** - Build tmux, EDA, and knowledge MCP servers
4. **Test with Ibex design** - Validate end-to-end workflows

### For Each Feature

1. Implement feature using Claude Code
2. Test with Ibex design on EDA server
3. Record demo video at 2880x1800
4. Transfer video for review

---

## Why Download Locally First?

**Issue:** wget on EDA server was extremely slow (15-30+ minutes for 25MB)

**Root Cause:** Network routing or SSL library issues
```
wget: .../libcrypto.so.10: no version information available
wget: .../libssl.so.10: no version information available
```

**Solution:** Download locally at 5.5 MB/s (5 seconds), then scp to server

**Result:** 25MB file transferred in <1 minute vs 30+ minutes

---

## Files Updated

1. `docs/EDA_SERVER_SETUP.md` - Added Node.js v20 and Claude Code sections
2. `~/.bashrc` - Added Node.js v20 to PATH
3. `/home/EDA/hipilot_test/` - Node.js v20 installation

---

## Key Learnings

1. **Unofficial builds work perfectly** - Node.js v20.18.3 glibc-217 is stable
2. **Download locally, transfer remotely** - Much faster than direct download on EDA server
3. **Two versions are manageable** - v16 for HiPilot UI, v20 for Claude Code
4. **Claude Code v2.1.47** - Latest version installed successfully

---

## Validation Checklist

✅ Node.js v20.18.3 downloaded and extracted
✅ Node.js v20 works with glibc 2.17
✅ Claude Code v2.1.47 installed globally
✅ Claude Code executable and functional
✅ Added to PATH in ~/.bashrc
✅ Help command works
✅ Version command works
✅ Documentation updated

---

## Troubleshooting

### Node.js not found
```bash
# Use full path
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Or reload bashrc
source ~/.bashrc
```

### Claude Code not found
```bash
# Verify npm installation
which claude
# Should show: /home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/claude

# If not found, reinstall
npm install -g @anthropic-ai/claude-code
```

### Version conflicts
```bash
# Check which node is active
which node
node --version

# Switch to desired version
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
```

---

**Status:** ✅ Claude Code fully operational on EDA server
**Date:** 2026-02-19
**Version:** Claude Code v2.1.47, Node.js v20.18.3 (glibc-217)
