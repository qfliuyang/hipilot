# HiPilot - Session Pickup Guide

**Read this when starting a new Claude Code session on this project.**

## Where We Are (v0.2.0)

HiPilot is a VLSI Physical Design copilot. Claude Code + EDA tools (Innovus/ICC2) run in adjacent tmux panes and communicate through tmux. This feedback loop is the core value: generate Tcl, send to EDA, capture output, analyze, fix, repeat.

**GitHub:** https://github.com/qfliuyang/hipilot

## What's Built and Working

| Component | Count | Status |
|-----------|-------|--------|
| MCP Servers | 3 (EDA, Tmux, Knowledge) | Tested on real EDA server |
| Skills | 10 | Written with YAML frontmatter + workflows |
| Tcl Templates | 20 (10 Synopsys + 10 Cadence) | Tested against Innovus |
| Slash Commands | 6 (/timing, /drc, /power, /area, /compare, /history) | Ready |
| Command Reference | 30 EDA commands | In data/command-reference.json |
| Test Stand | Complete | Documented in docs/TEST_MUSTKNOW.md |

## Project Structure

```
hipilot/
  servers/
    eda/index.js          # EDA MCP - Tcl generation, template engine, QoR
    tmux/index.js         # Tmux MCP - send_keys, capture_pane, layout
    knowledge/index.js    # Knowledge MCP - skills, command ref, docs
  skills/                 # 10 skill files (.md with YAML frontmatter)
  templates/
    synopsys/             # 10 ICC2 Tcl templates
    cadence/              # 10 Innovus Tcl templates
  data/
    command-reference.json  # 30 EDA command definitions
  .claude/
    commands/             # 6 slash commands
    settings.json         # Permissions only (NOT mcpServers - see below)
  src/
    index.js              # CLI entry point
    lib/ui.js             # TUI library
  docs/
    TEST_MUSTKNOW.md      # THE critical doc - test stand + 10 lessons
    PICKUP_GUIDE.md       # This file
```

## EDA Server Access

```
Host: 192.168.112.163
User: EDA
Password: eda2020
Workspace: /home/EDA/hipilot_test/hipilot-v0.1.0/
Node.js: /home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node
```

## Critical Rules (Learned the Hard Way)

### 1. MCP Registration: User-Level Only, Absolute Paths

MCP servers MUST be in `~/.claude/settings.json` on the EDA server with absolute paths. The project-level `.claude/settings.json` must NOT contain `mcpServers` - it caused Claude Code to fail silently when relative paths couldn't resolve.

**Correct (on EDA server at `/home/EDA/.claude/settings.json`):**
```json
{
  "mcpServers": {
    "hipilot-eda": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.1.0/servers/eda/index.js"]
    }
  }
}
```

### 2. Tmux Socket: Use Default

Never use `-L <socket>` in tmux commands. The workspace and MCP server must use the same default socket. The `HIPILOT_TMUX_SOCKET` env var exists for special cases but defaults to empty (= default socket).

### 3. Innovus/ICC2: No GUI in tmux

Always start EDA tools without GUI to prevent blocking tmux:
- Innovus: `innovus -nowin`
- ICC2: `icc2_shell -no_gui`

### 4. Tcl Quoting: No expr Ternaries in puts

Never use `[expr {$var eq \"\" ? \"default\" : $var}]` inside double-quoted `puts` strings. Use `if/else` blocks instead. This bug was found live when Innovus rejected the Tcl.

### 5. Claude Code Automation

Start with `--dangerously-skip-permissions` for automated testing. Wait 30-60s between prompts to avoid input buffer stacking.

## How to Deploy and Test

```bash
# From local machine:

# 1. Sync code to EDA server
sshpass -p 'eda2020' rsync -avz --exclude node_modules --exclude .git \
  /Users/luzi/code/hipilot-v0.1.0/ EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.1.0/

# 2. SSH and set up workspace
sshpass -p 'eda2020' ssh EDA@192.168.112.163
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/home/EDA/hipilot_test/.local/bin:$PATH
export DISPLAY=:0

# 3. Kill old sessions, create fresh workspace
tmux kill-session -t hipilot 2>/dev/null
tmux new-session -d -s hipilot -x 240 -y 60 -c /home/EDA/hipilot_test/hipilot-v0.1.0
tmux split-window -h -t hipilot:0

# 4. Start EDA tool (right pane) and Claude Code (left pane)
tmux send-keys -t hipilot:0.1 "cd /home/EDA/hipilot_test/ibex_work_upload && innovus -nowin" Enter
sleep 3
tmux send-keys -t hipilot:0.0 "cd /home/EDA/hipilot_test/hipilot-v0.1.0 && claude --dangerously-skip-permissions" Enter

# 5. Open on desktop + record
gnome-terminal --maximize -- tmux attach-session -t hipilot &
ffmpeg -y -f x11grab -framerate 25 -video_size 2560x1558 -i :0 \
  -c:v libx264 -preset fast -crf 23 /home/EDA/hipilot_test/recordings/test.mp4 &

# 6. Send test prompts via tmux
tmux send-keys -t hipilot:0.0 "your prompt here" Enter
```

See `docs/TEST_MUSTKNOW.md` for the full test stand documentation with all 10 lessons learned.

## What to Work on Next

Potential v0.3.0 tasks (not started):

1. **MCP tool auto-discovery**: Claude Code still sometimes uses Bash instead of MCP tools for tmux operations. Investigate why MCP servers aren't reliably picked up.
2. **Load Ibex design**: Test the full pipeline with a loaded design (read_design template -> timing reports -> fix timing -> verify).
3. **Skill auto-generation**: The `/skill-gen` command to turn engineer emails/wiki posts into skills.
4. **QoR tracking**: Persist timing/area/power metrics across iterations for comparison.
5. **More Tcl templates**: CTS (clock tree synthesis), power analysis, parasitic extraction.
6. **`src/index.js` CLI**: Replace the demo entry point with a real CLI (status, setup, workspace, skills).

## Git History

```
5017731 Document the breakthrough: AI + EDA tool feedback loop via tmux
1b995dd Bump to v0.2.0 and document lessons from EDA server testing
b1c7ebe Fix MCP registration conflict and Tcl quoting bugs
72a9387 Fix tmux socket mismatch and Innovus GUI blocking
b02e967 Add Test Stand documentation for automated E2E testing
ee16ae8 Update Node.js requirement from v16 to v20
7161d81 HiPilot v0.1.0: VLSI Physical Design copilot with 3 MCP servers
```

## Key Files to Read First

1. `docs/PICKUP_GUIDE.md` - This file (start here)
2. `docs/TEST_MUSTKNOW.md` - Test stand + 10 lessons learned
3. `CLAUDE.md` - Full project context, architecture decisions, EDA server details
4. `servers/eda/index.js` - EDA MCP server (~500 lines)
5. `servers/tmux/index.js` - Tmux MCP server (~280 lines)
6. `servers/knowledge/index.js` - Knowledge MCP server (~400 lines)
