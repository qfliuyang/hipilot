# HiPilot - VLSI Physical Design Copilot

**Status:** ✅ v0.1.0 COMPLETE - All Tasks Finished
**Version:** 0.1.0
**Date:** 2026-02-19

---

## 🎉 What is HiPilot?

HiPilot is a **VLSI Physical Design Copilot** - an AI-powered assistant for EDA engineers built as an extension to Claude Code. It provides:

- **50/50 Terminal Workspace** - Chat + EDA tool panes
- **3 MCP Servers** - Tmux, EDA, Knowledge
- **4 Built-in Skills** - Common workflows
- **Natural Language → Tcl** - Generate scripts from intent
- **Real Ibex Design Integration** - Tested on actual RISC-V CPU

**Core Value:** Skills encode team expertise, making senior-level workflows executable by anyone.

---

## 🚀 Quick Start

### Starting HiPilot

```bash
# On EDA server (CentOS 7 with Node.js v20)
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
hipilot
```

### Using HiPilot

```
┌────────────────────┬────────────────────┐
│  Chat (50%)        │  EDA (50%)         │
│  Claude Code       │  icc2_shell        │
│                    │  innovus           │
│  "fix setup timing"│  pt_shell          │
│  → [Tcl generated] │                    │
│  [▶ Run]          │  [Executes here]   │
└────────────────────┴────────────────────┘
```

---

## 📚 Documentation

### Start Here

1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Essential commands & common pitfalls
2. **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - Complete development documentation
3. **[CLAUDE.md](CLAUDE.md)** - Context for Claude Code development

### Completed Tasks

| Task | Status | Document |
|------|--------|----------|
| **Task 1** | ✅ Complete | [TASK1_COMPLETE_FINAL.md](TASK1_COMPLETE_FINAL.md) - Terminal UI & Layout |
| **Task 2** | ✅ Complete | [TASK2_COMPLETE.md](TASK2_COMPLETE.md) - MCP Servers |
| **Task 3** | ✅ Complete | [TASK3_COMPLETE.md](TASK3_COMPLETE.md) - Skill System |
| **Task 4** | ✅ Complete | [TASK4_COMPLETE.md](TASK4_COMPLETE.md) - Ibex Integration & Demos |

### Architecture & Specs

- **[Architecture](docs/plans/2026-02-18-hipilot-architecture-design.md)** - Complete system design
- **[EDA MCP Spec](docs/specs/eda-mcp-server-spec.md)** - Tcl generation & QoR extraction
- **[Tmux MCP Spec](docs/specs/tmux-mcp-server-spec.md)** - Workspace management
- **[Knowledge MCP Spec](docs/specs/knowledge-mcp-server-spec.md)** - Skills & documentation

---

## 🏗️ What's Been Built

### 1. Terminal Workspace (Task 1)
- **tmux 3.4** - Built from source (CentOS 7 compatible)
- **50/50 Split Layout** - Chat pane + EDA pane
- **Launcher Script** - `hipilot` command
- **Beautiful UI** - Dracula-inspired colors
- **Status Bar** - Tool | Skill | Job | Design info

### 2. MCP Servers (Task 2)

**Tmux MCP Server** (6 tools):
- `send_keys` - Send commands to panes
- `capture_pane` - Read pane content
- `get_pane_output` - Get last N lines
- `update_status` - Update status bar
- `list_panes` - List all panes
- `resize_pane` - Resize panes

**EDA MCP Server** (5 tools):
- `generate_tcl` - Generate Tcl from intent
- `extract_qor` - Extract WNS/TNS/violations
- `list_templates` - List available templates
- `detect_tool` - Detect ICC2/Innovus/PT
- `get_job_status` - Check job status

**Knowledge MCP Server** (4 tools):
- `search_docs` - Search documentation
- `get_command_ref` - Get command reference
- `list_skills` - List all skills
- `get_skill` - Get skill content

### 3. Skill System (Task 3)

**4 Built-in Skills:**
- `fix-setup-timing` - Fix setup violations
- `fix-hold-timing` - Fix hold violations
- `route-design` - Complete routing
- `report-timing` - Generate timing reports

**Tcl Templates:**
- `icc2_fix_setup_timing.tcl` - Multi-strategy fixes
- `icc2_report_timing.tcl` - Timing reports

### 4. Ibex Integration (Task 4)

**Design:** Ibex Core (32-bit RISC-V CPU)
**Technology:** Skywater 130nm HD
**Flow:** Complete RTL-to-GDS

**Demos Recorded:**
- MCP servers working (603KB)
- Comprehensive feature demo (1.3MB)

---

## 🔧 Development Environment

### Requirements

| Component | Version | Location |
|-----------|---------|----------|
| **OS** | CentOS 7.9+ | glibc 2.17 |
| **Node.js** | v20.18.3 glibc-217 | `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/` |
| **tmux** | 3.4 (built from source) | `/home/EDA/hipilot_test/.local/bin/tmux` |
| **Claude Code** | v2.1.47 | npm global install |
| **Python** | 3.6+ | `/usr/bin/python3` |

### EDA Tools (Available)

- **ICC2** - T-2022.03 (`/opt/synopsys/icc2_2022.03/`)
- **Innovus** - v20.10 (`/opt/cadence/INNOVUS20.10/`)
- **PrimeTime** - T-2022.03 (`/opt/synopsys/prime_2022.03/`)

---

## ⚠️ Common Mistakes (Avoid These!)

### 1. Wrong Pane Targeting
```bash
# ❌ WRONG - Uses indices
tmux send-keys -t 0 'command' Enter

# ✅ RIGHT - Use pane IDs or dynamic detection
tmux send-keys -t %0 'command' C-m
# Or:
PANE=$(tmux list-panes -F "#{pane_id}" | head -1)
tmux send-keys -t "$PANE" 'command' C-m
```

### 2. Template String Escaping
```javascript
// ❌ WRONG - Conflicts with tmux format strings
const cmd = `tmux list-panes -F "#{pane_id}"`;

// ✅ RIGHT - Use regular strings
const cmd = 'tmux list-panes -F "#{pane_id}"';
```

### 3. Wrong Node.js Version
```bash
# ❌ WRONG - Requires glibc 2.28+
node-v20.18.3-linux-x64.tar.xz

# ✅ RIGHT - Works on CentOS 7
node-v20.18.3-linux-x64-glibc-217.tar.xz
```

### 4. Wrong Video Codec
```bash
# ❌ WRONG - Won't play on Mac
ffmpeg -f x11grab -i :0 output.mp4

# ✅ RIGHT - Always use yuv420p
ffmpeg -f x11grab -video_size ${RESOLUTION} -framerate 15 -i :0 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p output.mp4
```

### 5. Hardcoded Resolution
```bash
# ❌ WRONG - May not match actual display
ffmpeg -video_size 2880x1800 ...

# ✅ RIGHT - Detect dynamically
RESOLUTION=$(xdpyinfo | grep dimensions | awk '{print $2}')
ffmpeg -video_size ${RESOLUTION} ...
```

See **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** for complete pitfalls & solutions.

---

## 📁 Project Structure

```
/home/EDA/hipilot/                    # Main installation
├── bin/hipilot                       # Launcher
├── servers/
│   ├── tmux/index.js                 # 6 tools
│   ├── eda/index.js                  # 5 tools
│   └── knowledge/index.js            # 4 tools
└── src/lib/ui.js                     # Terminal UI library

/home/EDA/hipilot_test/               # Development workspace
├── .hipilot/
│   ├── skills/                       # 4 skills
│   │   ├── fix-setup-timing.md
│   │   ├── fix-hold-timing.md
│   │   ├── route-design.md
│   │   └── report-timing.md
│   └── history/                      # Generated Tcl archive
├── templates/
│   ├── synopsys/
│   │   ├── icc2_fix_setup_timing.tcl
│   │   └── icc2_report_timing.tcl
│   └── cadence/
└── recordings/                       # Demo videos

/home/EDA/
├── .hipilot-tmux.conf                 # Tmux config
└── .hipilot-mcp.json                  # MCP config
```

---

## 🧪 Testing

### Run Integration Tests

```bash
cd /home/EDA/hipilot_test
./test_ibex_integration.sh
```

### Test MCP Servers Manually

```bash
# List tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node ~/hipilot/servers/tmux/index.js

# Call a tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"knowledge.list_skills","arguments":{}}}' | \
  node ~/hipilot/servers/knowledge/index.js
```

---

## 🎥 Demo Videos

All demo videos recorded with H.264/yuv420p for macOS compatibility:

- `hipilot_workspace_final.mp4` - Initial workspace demo
- `hipilot_mcp_demo.mp4` - MCP servers in action
- `hipilot_comprehensive_demo.mp4` - Full feature walkthrough

---

## 🛠️ Installation

### For CentOS 7 (glibc 2.17)

1. **Install Node.js v20 (glibc-217)**
2. **Build tmux 3.4** from source
3. **Install Claude Code**
4. **Run HiPilot installer**
5. **Configure MCP servers**

See **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** for complete installation instructions.

---

## 📖 Documentation Structure

```
docs/
├── prd.md                           # Product requirements
├── plans/
│   └── 2026-02-18-hipilot-architecture-design.md  # Complete architecture
├── specs/
│   ├── eda-mcp-server-spec.md       # EDA MCP server spec
│   ├── tmux-mcp-server-spec.md      # Tmux MCP server spec
│   ├── knowledge-mcp-server-spec.md # Knowledge MCP server spec
│   └── ux-specification.md          # UX design
├── guides/
│   └── skill-authoring-guide.md      # How to write skills
├── roadmap.md                       # Development roadmap
├── SCREEN_RECORDING_SETUP.md        # Recording infrastructure
└── EDA_SERVER_SETUP.md              # Server environment
```

---

## 🤝 Contributing

### For Developers

1. Read **[CLAUDE.md](CLAUDE.md)** first
2. Review **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)**
3. Test on EDA server with Ibex design
4. Record demo videos
5. Document changes

### Adding Skills

1. Create skill file in `.hipilot/skills/`
2. Follow skill format (see **[SKILL_AUTHORING_GUIDE.md](docs/guides/skill-authoring-guide.md)**)
3. Test with `knowledge.get_skill()`
4. Document usage

---

## 📊 Success Metrics

| Metric | Status | Notes |
|--------|--------|-------|
| **50/50 Workspace** | ✅ Complete | tmux 3.4, beautiful UI |
| **MCP Servers** | ✅ Complete | 3 servers, 15 tools |
| **Skills** | ✅ Complete | 4 skills, extendable |
| **Tcl Generation** | ✅ Complete | Works for Ibex |
| **Ibex Integration** | ✅ Complete | Tested on real design |
| **Demos** | ✅ Complete | 3 videos recorded |

---

## 🚧 Next Steps

While v0.1.0 is complete, future enhancements could include:

1. **More Skills** - Add workflows for synthesis, STA, physical verification
2. **Cadence Templates** - Innovus/Tempus templates
3. **Skill Auto-generation** - `/skill-gen` command
4. **QoR Tracking** - Track metrics across iterations
5. **More EDA Tools** - Calibre DRC/LVS integration

---

## 📄 License

Built as a light fork of [Claude Code](https://claude.ai/code) with three specialized MCP servers.

---

## ❓ Questions?

- **Quick help:** [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Development:** [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- **Architecture:** [docs/plans/2026-02-18-hipilot-architecture-design.md](docs/plans/2026-02-18-hipilot-architecture-design.md)
- **Server setup:** [docs/EDA_SERVER_SETUP.md](docs/EDA_SERVER_SETUP.md)

---

**Last Updated:** 2026-02-19
**Version:** 0.1.0
**Status:** ✅ COMPLETE - All 4 Tasks Finished
**Maintained By:** HiPilot Development Team
