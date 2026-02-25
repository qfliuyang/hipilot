# HiPilot Quick Reference Card

**Version:** 0.1.0 | **Last Updated:** 2026-02-19

---

## 🚀 Quick Start

```bash
# Start HiPilot
hipilot

# In Chat pane: Use Claude Code normally
# In EDA pane: Run EDA tools (icc2_shell, innovus, pt_shell)
```

---

## 📁 Key File Locations

| File | Purpose |
|------|---------|
| `~/hipilot/bin/hipilot` | Launcher script |
| `~/.hipilot-tmux.conf` | Tmux configuration |
| `~/.hipilot-mcp.json` | MCP server configuration |
| `~/hipilot/servers/*/index.js` | MCP servers (3 total) |
| `~/.hipilot/skills/*.md` | Skill definitions (4 total) |
| `~/hipilot_test/templates/**/*.tcl` | Tcl templates |

---

## ⌨️ Key Bindings

| Key | Action |
|-----|--------|
| `Ctrl+Space` | Prefix key |
| `Ctrl+a` | Switch to Chat pane |
| `Ctrl+e` | Switch to EDA pane |
| `h/j/k/l` | Navigate panes |
| `H/J/K/L` | Resize panes |
| `r` | Reload config |
| `*` | Toggle sync-panes |

---

## 🔧 MCP Servers

### Tmux MCP (6 tools)
- `tmux.send_keys` - Send commands to pane
- `tmux.capture_pane` - Read pane content
- `tmux.get_pane_output` - Get last N lines
- `tmux.update_status` - Update status bar
- `tmux.list_panes` - List all panes
- `tmux.resize_pane` - Resize pane

### EDA MCP (5 tools)
- `eda.generate_tcl` - Generate Tcl from intent
- `eda.extract_qor` - Extract timing metrics
- `eda.list_templates` - List Tcl templates
- `eda.detect_tool` - Detect running EDA tool
- `eda.get_job_status` - Check job status

### Knowledge MCP (4 tools)
- `knowledge.search_docs` - Search documentation
- `knowledge.get_command_ref` - Get command reference
- `knowledge.list_skills` - List all skills
- `knowledge.get_skill` - Get skill content

---

## 🎯 Available Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `fix-setup-timing` | Fix setup violations | "fix setup timing" |
| `fix-hold-timing` | Fix hold violations | "fix hold timing" |
| `route-design` | Complete routing | "route design" |
| `report-timing` | Generate reports | "report timing" |

---

## 🧪 Testing Commands

```bash
# Test MCP servers manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node ~/hipilot/servers/tmux/index.js

# Test with Ibex design
cd ~/hipilot_test
./test_ibex_integration.sh

# Record demo video
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
ffmpeg -f x11grab -video_size ${RESOLUTION} -framerate 15 -i :0 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -t 10 demo.mp4
```

---

## ⚠️ Common Pitfalls

### ❌ Wrong
```bash
tmux send-keys -t 0 'command' Enter    # Wrong: index not ID
tmux split-window -h -p 50              # Wrong: -p not valid
echo '{"cmd"...}' | node server.js      # Wrong: no jsonrpc wrapper
```

### ✅ Right
```bash
tmux send-keys -t %0 'command' C-m     # Right: use pane ID
tmux split-window -h -l 50%             # Right: -l for percentage
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node server.js
```

---

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| HiPilot won't start | Check `tmux -L hipilot kill-server` first |
| Pane not found | Use `%0`, `%1` not `0`, `1` |
| Video won't play on Mac | Use `-pix_fmt yuv420p` |
| MCP not found | Check `~/.hipilot-mcp.json` exists |
| Node.js glibc error | Use glibc-217 build for CentOS 7 |

---

## 📊 Environment

```bash
# Node.js v20.18.3 (glibc-217)
node --version

# tmux 3.4 (built from source)
~/hipilot_test/.local/bin/tmux -V

# Claude Code
claude --version

# EDA Tools
which icc2_shell     # /opt/synopsys/icc2_2022.03/...
which innovus        # /opt/cadence/INNOVUS20.10/...
which pt_shell       # /opt/synopsys/prime_2022.03/...
```

---

## 📝 Development Workflow

1. **Edit locally** - Work on files in this repository
2. **Test manually** - Use MCP test commands
3. **Transfer to server** - `scp file EDA@server:/path/`
4. **Test on server** - Run integration tests
5. **Record demo** - Document with video
6. **Update docs** - Keep DEVELOPMENT_GUIDE.md current

---

## 🆘 Getting Help

- Full documentation: `DEVELOPMENT_GUIDE.md`
- Architecture: `docs/plans/2026-02-18-hipilot-architecture-design.md`
- Skill guide: `~/.hipilot/SKILL_AUTHORING_GUIDE.md`
- Task summaries: `TASK*_COMPLETE.md`

---

**Remember:** HiPilot is a terminal-first, AI-powered copilot for VLSI engineers. It's designed for SSH workflows, not browsers.
