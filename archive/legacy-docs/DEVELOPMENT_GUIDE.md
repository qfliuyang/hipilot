# HiPilot Development Documentation

**Version:** 0.1.0
**Last Updated:** 2026-02-19
**Status:** Complete - All 4 tasks finished

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Development Environment](#development-environment)
4. [Installation Guide](#installation-guide)
5. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Development Workflow](#development-workflow)

---

## Overview

HiPilot is a VLSI Physical Design Copilot built as an extension to Claude Code. It provides AI-powered assistance for EDA workflows through:

- **Terminal UI**: 50/50 split workspace (Chat + EDA panes)
- **MCP Servers**: 3 servers providing tools (tmux, eda, knowledge)
- **Skill System**: 4 initial skills for common workflows
- **Tcl Generation**: Natural language to Tcl scripts

### Project Structure

```
/home/EDA/hipilot/                    # Main HiPilot directory
├── bin/hipilot                       # Launcher script
├── servers/                          # MCP servers
│   ├── tmux/index.js                 # Tmux management
│   ├── eda/index.js                  # Tcl generation, QoR
│   └── knowledge/index.js            # Skills, docs
├── src/lib/ui.js                     # Terminal UI library
└── package.json

/home/EDA/hipilot_test/               # Development workspace
├── .hipilot/
│   ├── skills/                       # Skill definitions
│   └── SKILL_AUTHORING_GUIDE.md
├── templates/                        # Tcl templates
│   ├── synopsys/
│   └── cadence/
└── recordings/                       # Demo videos

/home/EDA/.hipilot-tmux.conf          # Tmux configuration
/home/EDA/.hipilot-mcp.json           # MCP configuration
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code (HiPilot)                │
│                    (Chat Pane - Left 50%)               │
├─────────────────────────────────────────────────────────┤
│                      MCP Host                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Tmux MCP   │  │  EDA MCP   │  │ Knowledge MCP  │   │
│  │            │  │            │  │                │   │
│  │ send_keys  │  │ generate_  │  │ list_skills    │   │
│  │ capture_   │  │ tcl        │  │ get_skill      │   │
│  │ pane       │  │ extract_   │  │ search_docs    │   │
│  │ update_    │  │ qor        │  │                │   │
│  │ status     │  │ detect_    │  │                │   │
│  └────────────┘  │ tool       │  └────────────────┘   │
│                  └────────────┘                        │
├─────────────────────────────────────────────────────────┤
│                   EDA Pane (Right 50%)                  │
│              icc2_shell | innovus | pt_shell            │
└─────────────────────────────────────────────────────────┘
```

### Communication Flow

```
User: "Fix setup timing on pcie_rx"
  ↓
Claude Code: Matches skill "fix-setup-timing"
  ↓
Extracts: path_group="pcie_rx", operation="fix_setup_timing"
  ↓
Calls: EDA MCP Server → generate_tcl(intent, params)
  ↓
Returns: Tcl script written to /tmp/hipilot_generated_*.tcl
  ↓
Claude Code shows Tcl to user for review
  ↓
User approves: "Run it"
  ↓
Calls: Tmux MCP Server → send_keys(pane="eda", keys="source /tmp/...")
  ↓
EDA pane executes Tcl
  ↓
Calls: EDA MCP Server → extract_qor(report)
  ↓
Results shown to user
```

---

## Development Environment

### Server Requirements

| Component | Requirement | Tested Version |
|-----------|-------------|----------------|
| **OS** | CentOS 7+ (glibc 2.17+) | CentOS 7.9.2009 |
| **Node.js** | v20+ | v20.18.3 glibc-217 |
| **tmux** | 3.4+ | 3.4 (built from source) |
| **Python** | 3.6+ (for json parsing) | 3.6.8 |
| **Display** | X11 (for demo videos) | :0 (2560x1558) |

### EDA Tools (Optional)

| Tool | Path | Version |
|------|------|---------|
| ICC2 | `/opt/synopsys/icc2_2022.03/` | T-2022.03 |
| Innovus | `/opt/cadence/INNOVUS20.10/` | v20.10-p004_1 |
| PrimeTime | `/opt/synopsys/prime_2022.03/` | T-2022.03 |

### Environment Variables

```bash
# Add to ~/.bashrc
export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
export PATH=/home/EDA/hipilot/bin:$PATH

export HIPILOT_HOME=/home/EDA/hipilot_test
export HIPILOT_SESSION=hipilot
export DISPLAY=:0  # For demo videos
```

---

## Installation Guide

### Step 1: Install Node.js v20

**CRITICAL:** Use glibc-217 version for CentOS 7.

```bash
# Download Node.js v20.18.3 (glibc-217)
# URL: https://nodejs.org/dist/v20.18.3/
# File: node-v20.18.3-linux-x64-glibc-217.tar.xz

# Extract
tar -xf node-v20.18.3-linux-x64-glibc-217.tar.xz
mv node-v20.18.3-linux-x64-glibc-217 /home/EDA/hipilot_test/

# Add to PATH
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Verify
node --version  # Should show v20.18.3
npm --version   # Should show 10.8.2
```

**Mistake to avoid:** Using Node.js v16 or regular v20 (will have glibc issues).

### Step 2: Build tmux 3.4 from Source

**CRITICAL:** CentOS 7 ships with tmux 1.8 (too old).

```bash
# Download locally (faster)
# libevent 2.1.12: https://github.com/libevent/libevent/releases/
# tmux 3.4: https://github.com/tmux/tmux/releases/

# Transfer to server and extract
tar -xf libevent-2.1.12-stable.tar.gz
tar -xf tmux-3.4.tar.gz

# Build libevent first
cd libevent-2.1.12-stable
./configure --prefix=/home/EDA/hipilot_test/.local --disable-shared
make -j4 && make install

# Build tmux
cd ../tmux-3.4
./configure --prefix=/home/EDA/hipilot_test/.local \
  CFLAGS='-I/home/EDA/hipilot_test/.local/include' \
  LDFLAGS='-L/home/EDA/hipilot_test/.local/lib' \
  PKG_CONFIG_PATH=/home/EDA/hipilot_test/.local/lib/pkgconfig
make -j4 && make install

# Verify
/home/EDA/hipilot_test/.local/bin/tmux -V  # Should show tmux 3.4
```

**Mistake to avoid:** Using system tmux (1.8) - lacks modern features.

### Step 3: Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code

# Verify
claude --version  # Should show 2.1.47 or later
```

### Step 4: Install HiPilot

```bash
# Create directories
mkdir -p /home/EDA/hipilot/servers/{tmux,eda,knowledge}
mkdir -p /home/EDA/hipilot_test/.hipilot/skills
mkdir -p /home/EDA/hipilot_test/templates/{synopsys,cadence}

# Copy MCP servers (from source)
cp -r servers/* /home/EDA/hipilot/servers/

# Install dependencies
cd /home/EDA/hipilot/servers/tmux && npm install
cd /home/EDA/hipilot/servers/eda && npm install
cd /home/EDA/hipilot/servers/knowledge && npm install

# Copy launcher
cp bin/hipilot /home/EDA/hipilot/bin/hipilot
chmod +x /home/EDA/hipilot/bin/hipilot

# Copy configs
cp .hipilot-tmux.conf /home/EDA/.hipilot-tmux.conf
cp .hipilot-mcp.json /home/EDA/.hipilot-mcp.json

# Copy skills
cp -r .hipilot/skills/* /home/EDA/hipilot_test/.hipilot/skills/

# Copy templates
cp -r templates/* /home/EDA/hipilot_test/templates/

# Test
hipilot  # Should open 50/50 workspace
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Pane Targeting in tmux

**Problem:** `can't find pane: 0`

**Cause:** After splitting, tmux uses pane IDs (%0, %1) not indices (0, 1).

**Solution:**
```bash
# WRONG
tmux send-keys -t 0 'command' Enter

# RIGHT - Option 1: Use pane IDs
tmux send-keys -t %0 'command' Enter

# RIGHT - Option 2: Dynamic detection
PANE_LEFT=$(tmux list-panes -F "#{pane_id}" | head -1)
PANE_RIGHT=$(tmux list-panes -F "#{pane_id}" | tail -1)
tmux send-keys -t "$PANE_LEFT" 'command' C-m
```

**Lesson:** Always query pane IDs dynamically after split:
```bash
tmux split-window -h -l 50%
PANE_LEFT=$(tmux list-panes -F "#{pane_id}" | head -1)
PANE_RIGHT=$(tmux list-panes -F "#{pane_id}" | tail -1)
```

### Pitfall 2: Template String Escaping

**Problem:** `SyntaxError: Invalid or unexpected token` at format strings

**Cause:** JavaScript template literals conflict with tmux format strings (`#{var}`)

**Solution:** Use regular strings with concatenation:
```javascript
// WRONG
const cmd = `tmux list-panes -F "#{pane_id}:#{pane_title}"`;

// RIGHT
const cmd = 'tmux list-panes -F "#{pane_id}:#{pane_title}"';
```

**Lesson:** Avoid template literals for tmux commands. Use string concatenation.

### Pitfall 3: Heredoc Escaping Over SSH

**Problem:** Shebang line corrupted when creating files via SSH heredoc

**Cause:** Shell escape sequences mess up the `#!/usr/bin/env node` line

**Solution:** Create files locally, then transfer via scp
```bash
# Create locally
cat > /tmp/server.js << 'EOF'
#!/usr/bin/env node
...
EOF

# Transfer
scp /tmp/server.js user@server:/path/

# Don't do this:
ssh user@server 'cat > /path/server.js << "END"'  # Corrupts shebang!
```

**Lesson:** For complex scripts with special characters, use local files + scp.

### Pitfall 4: Video Codec Compatibility

**Problem:** MP4 videos don't play on macOS

**Cause:** Old ffmpeg creates incompatible codec

**Solution:** Always specify H.264 with yuv420p:
```bash
# WRONG
ffmpeg -f x11grab -i :0 output.mp4

# RIGHT
ffmpeg -f x11grab -video_size ${RESOLUTION} -framerate 15 -i :0 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  output.mp4
```

**Lesson:** Always include `-pix_fmt yuv420p` for Apple compatibility.

### Pitfall 5: Display Resolution

**Problem:** `Capture area outside screen size`

**Cause:** Hardcoded resolution (2880x1800) doesn't match actual (2560x1558)

**Solution:** Always detect resolution dynamically:
```bash
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
ffmpeg -f x11grab -video_size ${RESOLUTION} ...
```

**Lesson:** Never hardcode display resolution.

### Pitfall 6: Node.js Version Mismatch

**Problem:** Node.js fails with GLIBC errors

**Cause:** Regular Node.js v20 requires glibc 2.28+, CentOS 7 has 2.17

**Solution:** Use glibc-217 build:
```bash
# WRONG
node-v20.18.3-linux-x64.tar.xz  # Requires glibc 2.28+

# RIGHT
node-v20.18.3-linux-x64-glibc-217.tar.xz  # Works on CentOS 7
```

**Lesson:** For CentOS 7, always use glibc-217 Node.js builds.

### Pitfall 7: MCP Server Testing

**Problem:** Can't tell if MCP servers are working

**Solution:** Test via JSON-RPC manually:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node server.js

echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tmux.list_panes","arguments":{}}}' | node server.js
```

**Lesson:** Always test MCP servers via stdin/stdout before integrating.

### Pitfall 8: tmux Split Syntax

**Problem:** `size missing` error

**Cause:** Using `-p` instead of `-l`

**Solution:**
```bash
# WRONG
tmux split-window -h -p 50

# RIGHT
tmux split-window -h -l 50%
```

**Lesson:** Use `-l` (length) not `-p` (percentage) for split-window.

---

## Testing Guide

### Unit Testing MCP Servers

```bash
# Test Tmux MCP
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tmux.list_panes","arguments":{}}}' | \
  node /home/EDA/hipilot/servers/tmux/index.js

# Test EDA MCP
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"eda.generate_tcl","arguments":{"intent":"test","operation":"route_design"}}}' | \
  node /home/EDA/hipilot/servers/eda/index.js

# Test Knowledge MCP
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"knowledge.list_skills","arguments":{}}}' | \
  node /home/EDA/hipilot/servers/knowledge/index.js
```

### Integration Testing

```bash
# Start HiPilot
hipilot

# In another terminal, run test
cd /home/EDA/hipilot_test
./test_ibex_integration.sh

# Or manual test
# 1. Check session exists
tmux -L hipilot list-sessions

# 2. Check panes
tmux -L hipilot list-panes -a

# 3. Send test command
tmux -L hipilot send-keys -t %1 'echo "Test"' C-m

# 4. Capture output
tmux -L hipilot capture-pane -t %1 -p
```

### Video Testing

```bash
# Start recording
export DISPLAY=:0
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
ffmpeg -f x11grab -video_size ${RESOLUTION} -framerate 15 -i :0 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  -t 10 test.mp4 &
FFMPEG_PID=$!

# Do work...
sleep 10

# Stop recording
kill $FFMPEG_PID
wait $FFMPEG_PID

# Extract frame for analysis
ffmpeg -i test.mp4 -vf "select=eq(n\,150)" -vframes 1 frame.png
```

---

## Troubleshooting

### HiPilot Won't Start

**Symptom:** `open terminal failed: not a terminal`

**Cause:** launcher uses `exec tmux attach` which fails non-interactively

**Solution:** Use `gnome-terminal` to open window:
```bash
gnome-terminal -- tmux -L hipilot attach
```

### MCP Servers Not Found

**Symptom:** Claude Code can't find MCP servers

**Cause:** MCP config path wrong

**Solution:** Check config location:
```bash
# Claude Code looks in:
~/.config/claude-code/mcp.json  # Linux/Mac
# or
~/.claude-code/mcp.json         # Alternative
```

### Pane Commands Not Working

**Symptom:** Commands sent but nothing happens

**Cause:** Wrong pane ID or pane doesn't exist

**Solution:**
```bash
# List all panes to verify
tmux -L hipilot list-panes -a -F "#{pane_id} #{pane_title} #{pane_current_command}"

# Use correct pane ID
tmux -L hipilot send-keys -t %0 'echo test' C-m  # Use %0, %1, not 0, 1
```

### Video Shows Empty Desktop

**Symptom:** Recording shows no windows

**Cause:** Wrong display or window not visible yet

**Solution:**
```bash
# 1. Check display
echo $DISPLAY
xdpyinfo | grep dimensions

# 2. Check windows
xwininfo -root -tree | grep "HiPilot"

# 3. Wait before recording
sleep 2  # Let window fully render
```

### Tcl Generation Fails

**Symptom:** EDA MCP returns error

**Cause:** Invalid operation or missing parameters

**Solution:**
```bash
# Check valid operations
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node eda/index.js

# Use valid operation: fix_setup_timing, fix_hold_timing, route_design
# Required parameters: intent, operation
# Optional: tool, targets
```

---

## Development Workflow

### 1. Making Changes to MCP Servers

```bash
# Edit server locally
vim servers/tmux/index.js

# Test locally
node servers/tmux/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/tmux/index.js

# Transfer to server
scp servers/tmux/index.js EDA@server:/home/EDA/hipilot/servers/tmux/index.js

# Restart HiPilot to pick up changes
tmux -L hipilot kill-server
hipilot
```

### 2. Adding a New Skill

```bash
# Create skill file
vim .hipilot/skills/new-skill.md

# Format:
---
name: new-skill
description: What it does
triggers:
  - "phrase 1"
  - "phrase 2"
vendor: [synopsys, cadence]
tools_required: [tool1, tool2]
---

## Parameters
| Name | Type | Required | Default | Description |
...

# Test
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"knowledge.list_skills"}}}' | \
  node servers/knowledge/index.js

# Transfer
scp .hipilot/skills/new-skill.md EDA@server:/home/EDA/hipilot_test/.hipilot/skills/
```

### 3. Creating Tcl Templates

```bash
# Create template
vim templates/synopsys/icc2_new_operation.tcl

# Use Jinja2-like syntax (for future implementation)
# For now, use simple variable substitution:
set param1 "{{ param1 }}"
set param2 "{{ param2 }}"

# Test
source templates/synopsys/icc2_new_operation.tcl
```

### 4. Recording Demos

```bash
# Setup
export DISPLAY=:0
pkill -9 gnome-terminal
tmux -L hipilot kill-server

# Start HiPilot
hipilot &
sleep 3

# Start recording
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
ffmpeg -f x11grab -video_size ${RESOLUTION} -framerate 15 -i :0 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  -t 30 demo.mp4 &
FFMPEG_PID=$!

# Do demo
sleep 30

# Stop recording
kill $FFMPEG_PID
wait $FFMPEG_PID

# Transfer locally
scp EDA@server:/path/to/demo.mp4 .
```

---

## Quick Reference Card

### Essential Commands

```bash
# Start HiPilot
hipilot

# Kill session
tmux -L hipilot kill-server

# List sessions
tmux -L hipilot list-sessions

# Attach manually
tmux -L hipilot attach

# Send command to EDA pane
tmux -L hipilot send-keys -t %1 'command' C-m

# Capture EDA pane
tmux -L hipilot capture-pane -t %1 -p

# List MCP tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/*/index.js

# Test skill
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"knowledge.get_skill","arguments":{"name":"fix-setup-timing"}}}' | \
  node /home/EDA/hipilot/servers/knowledge/index.js

# Record video
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
ffmpeg -f x11grab -video_size ${RESOLUTION} -framerate 15 -i :0 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -t 10 demo.mp4

# Extract frame from video
ffmpeg -i demo.mp4 -vf "select=eq(n\,100)" -vframes 1 frame.png
```

### Key Files

| File | Purpose |
|------|---------|
| `/home/EDA/hipilot/bin/hipilot` | Main launcher |
| `/home/EDA/.hipilot-tmux.conf` | Tmux configuration |
| `/home/EDA/.hipilot-mcp.json` | MCP server config |
| `/home/EDA/hipilot/servers/*/index.js` | MCP servers |
| `/home/EDA/hipilot_test/.hipilot/skills/*.md` | Skill definitions |
| `/home/EDA/hipilot_test/templates/**/*.tcl` | Tcl templates |

---

## Getting Help

### Check Logs

```bash
# MCP server logs (stderr)
node servers/tmux/index.js 2>&1 | tee debug.log

# tmux logs
tmux -L hipium show-messages

# Claude Code logs
~/.config/claude-code/logs/
```

### Verify Installation

```bash
# Run this to check everything
/home/EDA/hipilot_test/test_ibex_integration.sh
```

---

## Appendices

### A. Complete File List

After installation, you should have:

```
/home/EDA/
├── .hipilot-tmux.conf              # Tmux config
├── .hipilot-mcp.json               # MCP config
└── hipilot/                        # Main directory
    ├── bin/hipilot                 # Launcher
    ├── package.json                # Dependencies
    ├── servers/
    │   ├── tmux/
    │   │   ├── index.js            # Tmux MCP server
    │   │   └── package.json
    │   ├── eda/
    │   │   ├── index.js            # EDA MCP server
    │   │   └── package.json
    │   └── knowledge/
    │       ├── index.js            # Knowledge MCP server
    │       └── package.json
    └── src/
        └── lib/ui.js                # UI library

/home/EDA/hipilot_test/
├── .hipilot/
│   ├── skills/                     # Skills
│   │   ├── fix-setup-timing.md
│   │   ├── fix-hold-timing.md
│   │   ├── route-design.md
│   │   ├── report-timing.md
│   │   └── SKILL_AUTHORING_GUIDE.md
│   └── history/                    # Generated Tcl archive
├── templates/                      # Tcl templates
│   ├── synopsys/
│   │   ├── icc2_fix_setup_timing.tcl
│   │   └── icc2_report_timing.tcl
│   └── cadence/
├── recordings/                     # Demo videos
├── test_ibex_integration.sh        # Integration test
└── .local/                         # Built tools
    └── bin/tmux                    # tmux 3.4
```

### B. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-02-19 | Initial release - Tasks 1-4 complete |

---

**Last Updated:** 2026-02-19
**Maintained By:** HiPilot Development Team
**Questions:** See CLAUDE.md or project README
