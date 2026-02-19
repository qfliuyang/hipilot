# HiPilot Test Stand - Automated Testing via tmux + Claude Code

## Overview

This document describes how to remotely control Claude Code on the EDA server via tmux `send-keys`. This enables:
- **Automated end-to-end testing** of HiPilot MCP servers
- **Demo recording** showing real Claude Code + EDA tool interaction
- **Regression testing** of skills, templates, and MCP tools

## Test Architecture

```
Local Machine (macOS)
    │
    ├── SSH + sshpass ──────────────> EDA Server (CentOS 7)
    │                                    │
    │                                    ├── tmux session "hipilot"
    │                                    │   ├── Pane 0: Claude Code (chat)
    │                                    │   └── Pane 1: Innovus / ICC2 (EDA)
    │                                    │
    │                                    ├── MCP Servers (auto-started by Claude Code)
    │                                    │   ├── hipilot-eda
    │                                    │   ├── hipilot-tmux
    │                                    │   └── hipilot-knowledge
    │                                    │
    │                                    └── ffmpeg (screen recording on :0)
    │
    └── scp ────────────────────────> Download .mp4 recordings
```

## Prerequisites

### EDA Server (192.168.112.163)
- **User:** EDA / password: eda2020
- **Node.js:** v20.18.3 at `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/`
- **Claude Code:** v2.1.47+ globally installed via npm
- **tmux:** v3.4 at `/home/EDA/hipilot_test/.local/bin/tmux`
- **ffmpeg:** for screen recording
- **Display :0:** Real desktop (NOT Xvfb) for recording
- **gnome-terminal:** For proper tmux rendering on desktop

### Local Machine
- **sshpass:** `brew install sshpass` (macOS) for non-interactive SSH

## Setup Steps

### 1. MCP Server Registration (CRITICAL)

MCP servers MUST be registered in the **user-level** settings with **absolute paths**:

**File: `/home/EDA/.claude/settings.json`**
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "<key>",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "skipDangerousModePermissionPrompt": true,
  "mcpServers": {
    "hipilot-eda": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.1.0/servers/eda/index.js"],
      "env": {}
    },
    "hipilot-tmux": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.1.0/servers/tmux/index.js"],
      "env": {}
    },
    "hipilot-knowledge": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.1.0/servers/knowledge/index.js"],
      "env": {}
    }
  }
}
```

**Why user-level, not project-level:**
- Project-level `.claude/settings.json` with relative paths does NOT work reliably
- Absolute paths in user-level settings ensures Claude Code always finds the servers
- The node binary path must also be absolute (not just `node`) because Claude Code may not inherit PATH

### 2. Kill Old tmux Servers

**CRITICAL:** If there's a tmux server running from a different version, you'll get `protocol version mismatch (client 8, server 7)`. Always kill old servers first:

```bash
pkill -u EDA tmux
sleep 1
# Verify clean
tmux list-sessions 2>&1  # Should say "no server running"
```

### 3. Create tmux Workspace

```bash
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
HIPILOT_HOME=/home/EDA/hipilot_test/hipilot-v0.1.0

tmux new-session -d -s hipilot -x 240 -y 60 -c "$HIPILOT_HOME"
tmux split-window -h -t hipilot:0 -c "$HIPILOT_HOME"

# Status bar
tmux set-option -t hipilot status on
tmux set-option -t hipilot status-style "bg=#1a1a2e,fg=#e0e0e0"
tmux set-option -t hipilot status-left "#[fg=#1a1a2e,bg=#00d4ff,bold] HiPilot v0.1.0 "
tmux set-option -t hipilot status-right "#[fg=#ffd700] EDA + Claude Code "
tmux set-option -t hipilot pane-border-status top
tmux set-option -t hipilot pane-border-format " #[bold]#{pane_title} "
tmux select-pane -t hipilot:0.0 -T "Chat - Claude Code"
tmux select-pane -t hipilot:0.1 -T "EDA Terminal"
```

### 4. Start EDA Tool

```bash
# Innovus (no GUI - prevents blocking the tmux screen)
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload && innovus -nowin" Enter

# Or ICC2 (no GUI)
tmux send-keys -t hipilot:0.1 "icc2_shell -no_gui" Enter
```

**IMPORTANT:** Always use `-nowin` (Innovus) or `-no_gui` (ICC2) to prevent the EDA tool GUI from blocking the tmux terminal.

### 5. Start Claude Code

```bash
tmux send-keys -t hipilot:0.0 "cd $HIPILOT_HOME && claude --dangerously-skip-permissions" Enter
sleep 10  # Wait for Claude Code to initialize and connect MCP servers
```

### 6. Open on Real Desktop (for recording)

```bash
export DISPLAY=:0
gnome-terminal --maximize --title="HiPilot Workspace" \
  -- tmux attach-session -t hipilot &
```

## Controlling Claude Code via tmux

### Sending Prompts

```bash
# Type the prompt text
tmux send-keys -t hipilot:0.0 "your prompt here"
sleep 0.5
# Submit with Enter
tmux send-keys -t hipilot:0.0 Enter
# Wait for response (adjust based on complexity)
sleep 30-60
```

### Reading Output

```bash
# Capture pane content (with ANSI codes)
tmux capture-pane -t hipilot:0.0 -e -p -S -200 | strings | grep -v "^$" | tail -50

# Plain text (no ANSI)
tmux capture-pane -t hipilot:0.0 -p -S -100 | tail -30
```

### Handling Permission Prompts

With `--dangerously-skip-permissions`, Claude Code auto-approves most tools. If you see a permission prompt:

```bash
# Select option number and confirm
tmux send-keys -t hipilot:0.0 "2"    # Option 2
sleep 0.5
tmux send-keys -t hipilot:0.0 Enter
```

### Canceling / Clearing Input

```bash
tmux send-keys -t hipilot:0.0 Escape  # Cancel current action
sleep 0.5
tmux send-keys -t hipilot:0.0 C-c     # Interrupt
sleep 1
```

### Exiting Claude Code

```bash
tmux send-keys -t hipilot:0.0 "/exit"
sleep 0.5
tmux send-keys -t hipilot:0.0 Enter
sleep 5
```

## Recording Demos

### Start Recording (real desktop :0)

```bash
export DISPLAY=:0
OUTFILE=/home/EDA/hipilot_test/recordings/my_demo.mp4

ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  "$OUTFILE" </dev/null >/dev/null 2>&1 &
FFMPEG_PID=$!
```

**IMPORTANT:** Always record from `:0` (real desktop), NOT from Xvfb `:99`.

### Stop Recording

```bash
kill $FFMPEG_PID
wait $FFMPEG_PID
```

### Download to Local

```bash
sshpass -p 'eda2020' scp EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/my_demo.mp4 ./
```

## Example Test Prompts

These prompts are verified to work with the HiPilot MCP servers:

### Knowledge MCP
```
use the hipilot-knowledge mcp server tool knowledge.list_skills to show all available skills
```

### EDA MCP
```
use hipilot-eda mcp tool eda.generate_tcl with operation fix_setup_timing and vendor synopsys
```

### Tmux MCP
```
use hipilot-tmux mcp tool tmux.capture_pane with pane_id 1 to see what is in the EDA terminal
```

### Command Reference
```
look up report_timing in the knowledge.get_command_ref mcp tool
```

### Full Pipeline Test
```
I have Innovus running in the right pane. Generate a timing report tcl script and send it to the EDA terminal.
```

## Gotchas & Lessons Learned

### 1. tmux Protocol Version Mismatch
**Symptom:** `protocol version mismatch (client 8, server 7)` on every command
**Cause:** Old tmux server (v1.8) still running, new tmux client (v3.4) can't connect
**Fix:** `pkill -u EDA tmux` then start fresh

### 2. Claude Code Doesn't Find MCP Servers
**Symptom:** Claude says "MCP tools are not currently running"
**Cause:** Project-level `.claude/settings.json` uses relative paths
**Fix:** Register MCP servers in user-level `~/.claude/settings.json` with absolute paths for both the node binary and server script

### 3. Prompts Stack in Input Buffer
**Symptom:** Multiple prompts appear in Claude Code's input without being submitted
**Cause:** Sending prompts too fast - next prompt arrives before Enter is processed
**Fix:** Wait at least 30-60 seconds between prompts for Claude Code to fully respond

### 4. Permission Prompts Block Execution
**Symptom:** Claude Code asks "Do you want to proceed?" for every tool
**Fix:** Start Claude Code with `--dangerously-skip-permissions` flag. Accept the disclaimer with option 2.

### 5. Screen Recording Must Use :0
**Symptom:** Recording shows black screen or wrong content
**Cause:** Recording Xvfb :99 instead of real desktop
**Fix:** Always use `-i :0` for ffmpeg x11grab

### 6. gnome-terminal for Proper Rendering
**Symptom:** xterm renders tmux poorly (bad fonts, missing colors)
**Fix:** Use `gnome-terminal --maximize -- tmux attach-session -t hipilot`

## Complete Test Script Template

```bash
#!/bin/bash
# HiPilot Test Template
# Run from local machine

SERVER="EDA@192.168.112.163"
PASS="eda2020"
SSH="sshpass -p '$PASS' ssh -o StrictHostKeyChecking=no $SERVER"
SCP="sshpass -p '$PASS' scp -o StrictHostKeyChecking=no"

# 1. Kill old tmux, set up workspace
$SSH 'pkill -u EDA tmux 2>/dev/null; sleep 1
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
export DISPLAY=:0
cd /home/EDA/hipilot_test/hipilot-v0.1.0

tmux new-session -d -s hipilot -x 240 -y 60
tmux split-window -h -t hipilot:0
tmux select-pane -t hipilot:0.0 -T "Chat"
tmux select-pane -t hipilot:0.1 -T "EDA"

# Start Innovus (no GUI)
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload && innovus -nowin" Enter
sleep 3

# Start Claude Code with MCP servers
tmux send-keys -t hipilot:0.0 "cd /home/EDA/hipilot_test/hipilot-v0.1.0 && claude --dangerously-skip-permissions" Enter
sleep 15

# Open on desktop
gnome-terminal --maximize -- tmux attach-session -t hipilot &
sleep 2

# Start recording
ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  /home/EDA/hipilot_test/recordings/test.mp4 </dev/null >/dev/null 2>&1 &
FFMPEG_PID=$!
sleep 2

# Send test prompt
tmux send-keys -t hipilot:0.0 "list all hipilot skills" Enter
sleep 40

# Stop recording
kill $FFMPEG_PID; wait $FFMPEG_PID
echo "Done"'

# 2. Download recording
$SCP $SERVER:/home/EDA/hipilot_test/recordings/test.mp4 ./test.mp4
open ./test.mp4
```

## Verified Working Configuration

| Component | Version | Path |
|-----------|---------|------|
| CentOS | 7.9.2009 | - |
| Node.js | v20.18.3 | `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node` |
| npm | 10.8.2 | (same dir) |
| Claude Code | 2.1.47 | (npm global) |
| tmux | 3.4 | `/home/EDA/hipilot_test/.local/bin/tmux` |
| Innovus | v20.10-p004_1 | `/opt/cadence/INNOVUS20.10/` |
| ICC2 | T-2022.03 | `/opt/synopsys/icc2_2022.03/` |
| PrimeTime | T-2022.03 | `/opt/synopsys/prime_2022.03/` |
| ffmpeg | 2.8.15 | `/usr/bin/ffmpeg` |
| Display | :0 (2560x1558) | Real desktop |
| HiPilot | v0.1.0 | `/home/EDA/hipilot_test/hipilot-v0.1.0/` |
