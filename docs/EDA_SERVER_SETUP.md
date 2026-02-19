# HiPilot Development Environment - Complete Setup

## Overview

This document summarizes the complete development environment setup for HiPilot, including EDA server access, real design for testing, and screen recording infrastructure.

---

## Quick Reference Card

### EDA Server Access
```bash
ssh EDA@192.168.112.163  # Password: eda2020
cd /home/EDA/hipilot_test
```

### Real Design: Ibex Core
```bash
cd /home/EDA/hipilot_test/ibex_work_upload
# Complete RTL-to-GDS flow for testing
```

### Screen Recording
```bash
cd /home/EDA/hipilot_test
./start_recording.sh "feature_name"
# ... demonstrate feature ...
./stop_recording.sh
```

---

## 1. EDA Server Environment

### Connection Details
| Item | Value |
|------|-------|
| **Host** | 192.168.112.163 |
| **Username** | EDA |
| **Password** | eda2020 |
| **Root Password** | 2020 |
| **OS** | CentOS 7.9.2009 (Core) |
| **Kernel** | 3.10.0-1160.119.1.el7.x86_64 |
| **glibc** | 2.17 |

### Workspace Location
- **Primary:** `/home/EDA/hipilot_test/`
- **Design:** `/home/EDA/hipilot_test/ibex_work_upload/`
- **Recordings:** `/home/EDA/hipilot_test/recordings/`

---

## 2. Development Tools

### Node.js
```bash
# Unified: Node v20.18.3 for HiPilot + Claude Code
# Location: /home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/
# Setup:
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH

# Verify:
node --version  # v20.18.3
npm --version   # 10.8.2

# Claude Code:
claude --version  # 2.1.47
```

**Unified Platform (Node v20):**
- **v20.18.3** (`/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/`) - For HiPilot + Claude Code
- **HiPilot Dependencies:** chalk@5.3, boxen@8.0, cli-table3@0.6.3, ora@8.0
- **Active Default:** v20.18.3 (in `~/.bashrc`)

**Node v16 (Legacy):**
- **v16.20.2** (`/home/EDA/hipilot_test/node-v16.20.2-linux-x64/`) - Available but not used
- Kept for emergency fallback if needed

### Python
```bash
Python 3.6.8  # /usr/bin/python3
Python 2.7.5  # /usr/bin/python
```

### Tmux
```bash
# Version: 3.4 (built from source)
# Location: /home/EDA/hipilot_test/.local/bin/tmux
# Setup:
export PATH=/home/EDA/hipilot_test/.local/bin:$PATH

# Verify:
tmux -V  # tmux 3.4
```

**Built from source:**
- **libevent 2.1.12** - `/home/EDA/hipilot_test/.local/lib/`
- **tmux 3.4** - Latest stable release
- **Why:** CentOS 7's tmux 1.8 is too old for HiPilot layout features
- **Config:** `/home/EDA/.hipilot-tmux.conf`

### Other Tools
```bash
git   (available) # Version control
gcc/g++ (available) # Compilers
ffmpeg 2.8.15    # Screen recording
```

---

## 3. EDA Tools Available

### Synopsys Tools
| Tool | Version | Path |
|------|---------|------|
| ICC2 | T-2022.03 | `/opt/synopsys/icc2_2022.03/T-2022.03/bin/icc2_shell` |
| PrimeTime | T-2022.03 | `/opt/synopsys/prime_2022.03/T-2022.03/bin/pt_shell` |
| StarRC | Available | `/opt/synopsys/starrc_2022.03/` |
| SpyGlass | Available | `/opt/synopsys/spyglass_2022.06/` |

### Cadence Tools
| Tool | Version | Path |
|------|---------|------|
| Innovus | v20.10-p004_1 | `/opt/cadence/INNOVUS20.10/tools.lnx86/bin/innovus` |
| Tempus | Available | `/opt/cadence/` |
| Voltus | Available | `/opt/cadence/` |

### Mentor/Siemens
| Tool | Status |
|------|--------|
| Calibre | Available (DRC/LVS) |

---

## 4. Real Design: Ibex Core

### Design Overview
```
Design:     Ibex Core - 32-bit RISC-V CPU
Arch:       RV32IMC/EMC (integer, multiply, compressed, debug)
Tech:       Skywater 130nm HD (sky130hd)
Size:       ~15k-20k gates
Source:     Open source (lowRISC)
```

### Directory Structure
```
ibex_work_upload/
├── designs/
│   ├── src/ibex/              # RTL source (20+ Verilog files)
│   │   ├── ibex_core.v        # Top-level
│   │   ├── ibex_alu.v         # ALU
│   │   ├── ibex_controller.v  # Control unit
│   │   └── ...
│   └── sky130hd/
│       ├── ibex/              # Design configs
│       │   ├── config.mk
│       │   ├── constraint.sdc
│       │   └── constraint_for_pr.sdc
│       └── pdk/               # PDK files
│           ├── lib/           # Timing libraries (.db)
│           ├── lef/           # LEF files
│           └── gds/           # GDS files
├── scripts/                   # Flow scripts
│   ├── syn/                   # Synthesis (DC)
│   ├── pr/                    # Place & Route (Innovus)
│   ├── sta/                   # STA (PrimeTime)
│   ├── pv/                    # Phys verification (Calibre)
│   ├── ir_v/                  # Power analysis (Voltus)
│   └── extractRC/             # Parasitic extraction (StarRC)
└── result/                    # Flow outputs
```

### Available Flow Stages

#### Synthesis (Design Compiler)
```bash
make syn
# Output: Netlist, constraints, reports
```

#### Place & Route (Innovus)
```bash
make init         # Initialize design
make floor_plan   # Floorplanning
make place_io     # IO placement
make power_plan   # Power network
make placement    # Standard cell placement
make cts          # Clock tree synthesis
make post_cts_opt # Post-CTS optimization
make routing      # Routing
make routing_opt  # Routing optimization
make chip_done    # Final outputs
```

#### Signoff
```bash
make run_pt       # PrimeTime STA
make drc          # Calibre DRC
make lvs          # Calibre LVS
make static_ir    # Voltus IR drop
```

### Using Ibex for HiPilot Testing

| Purpose | How |
|---------|-----|
| **Tcl Templates** | Use scripts in `scripts/pr/*.tcl` as reference |
| **Report Parsing** | Run flows, capture real timing/DRC/power reports |
| **Skill Testing** | Create skills based on flow stages |
| **Integration** | Test end-to-end workflows |
| **Validation** | Verify HiPilot works on real design |

---

## 5. Screen Recording Infrastructure

### Purpose
Every major feature must be demonstrated via screen recording on CentOS 7 to ensure HiPilot works correctly on the target platform.

### Architecture
```
Virtual Display (Xvfb)
  Display: :99
  Resolution: 1920x1080
  Purpose: Headless virtual display for recording

ffmpeg (Screen Capture)
  Input: x11grab from display :99
  Output: H.264 MP4 files
  Location: /home/EDA/hipilot_test/recordings/
```

### Commands

#### Start Recording
```bash
cd /home/EDA/hipilot_test
./start_recording.sh "feature_description"
```
Output: `recordings/feature_description_YYYYMMDD_HHMMSS.mp4`

#### Stop Recording
```bash
./stop_recording.sh
```
Shows file size and transfer command

#### List Recordings
```bash
ls -lh recordings/
```

#### Transfer to Local
```bash
# From local machine
scp EDA@192.168.112.163:~/hipilot_test/recordings/FEATURE_*.mp4 .
```

### Video Specifications
| Parameter | Value |
|-----------|-------|
| Resolution | 1920x1080 |
| Framerate | 25 fps |
| Codec | H.264 (libx264) |
| Quality | CRF 23 |
| Pixel Format | yuv420p |
| Container | MP4 |
| Typical Size | 5-50 MB |

### Recording Checklist

**Before:**
- [ ] Clean terminal
- [ ] Know what to demonstrate
- [ ] Have test data ready
- [ ] Start recording

**During:**
- [ ] Explain what you're doing
- [ ] Show key features
- [ ] Demonstrate workflows
- [ ] Show edge cases
- [ ] Keep focused (1-5 minutes)

**After:**
- [ ] Stop recording
- [ ] Verify file created
- [ ] Transfer to local
- [ ] Test playback
- [ ] Document what was shown

---

## 6. Development Workflow

### Typical Session
```bash
# 1. Connect to EDA server
ssh EDA@192.168.112.163

# 2. Go to workspace
cd /home/EDA/hipilot_test

# 3. Source environment
source recording_env.sh

# 4. Start recording (for feature demo)
./start_recording.sh "new_feature"

# 5. Test/develop feature
# (work in terminal, test HiPilot)

# 6. Stop recording
./stop_recording.sh

# 7. Exit and transfer video
exit
scp EDA@192.168.112.163:~/hipilot_test/recordings/*.mp4 .
```

### Testing with Real Design
```bash
# 1. Go to Ibex design
cd /home/EDA/hipilot_test/ibex_work_upload

# 2. Run flow stage
make placement

# 3. Capture report output
# (redirect to file or copy from terminal)

# 4. Test HiPilot parser
# (use report to test parsing)

# 5. Test HiPilot Tcl generation
# (generate Tcl based on flow)
```

---

## 7. Environment Variables

### Add to ~/.bashrc
```bash
# Node.js
export PATH=/home/EDA/hipilot_test/node-v16.20.2-linux-x64/bin:$PATH

# HiPilot
export HIPILOT_HOME=/home/EDA/hipilot_test

# Display (for recording)
export DISPLAY=:99

# Ibex Design
export DESIGN_HOME=/home/EDA/hipilot_test/ibex_work_upload/designs
export PLATFORM=sky130hd
export DESIGN_NICKNAME=ibex
export RESULT_DIR=/home/EDA/hipilot_test/ibex_work_upload/result
```

---

## 8. File Locations Summary

### HiPilot Development
| Path | Purpose |
|------|---------|
| `/home/EDA/hipilot_test/` | Main workspace |
| `/home/EDA/hipilot/` | HiPilot application (Node v20) |
| `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/` | Node.js v20 (unified) |
| `/home/EDA/hipilot_test/node-v16.20.2-linux-x64/` | Node.js v16 (legacy, not used) |
| `/home/EDA/hipilot_test/recordings/` | Screen recordings |
| `/home/EDA/hipilot_test/logs/` | Log files |
| `/home/EDA/hipilot_test/scripts/` | Test scripts |
| `/home/EDA/hipilot_test/reports/` | Report outputs |
| `/home/EDA/hipilot_test/templates/` | Tcl templates |

### Ibex Design
| Path | Purpose |
|------|---------|
| `/home/EDA/hipilot_test/ibex_work_upload/` | Ibex design root |
| `/home/EDA/hipilot_test/ibex_work_upload/designs/src/ibex/` | RTL files |
| `/home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/ibex/` | Configs |
| `/home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/` | PDK files |
| `/home/EDA/hipilot_test/ibex_work_upload/scripts/` | Flow scripts |
| `/home/EDA/hipilot_test/ibex_work_upload/result/` | Flow outputs |

---

## 9. Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **EDA Server Access** | ✅ Ready | 192.168.112.163, CentOS 7 |
| **Node.js v20** | ✅ Installed | v20.18.3 glibc-217 (unified platform) |
| **Claude Code** | ✅ Installed | v2.1.47 |
| **HiPilot UI** | ✅ Working | Node v20, boxen@8, chalk@5 |
| **npm** | ✅ Ready | 10.8.2 |
| **EDA Tools** | ✅ Available | ICC2, PrimeTime, Innovus, etc. |
| **Real Design** | ✅ Ready | Ibex core, RTL-to-GDS flow |
| **Screen Recording** | ✅ Setup | Desktop recording at 2880x1800 |
| **Test Videos** | ✅ Verified | Test recording created successfully |

---

## 10. Next Steps

### Immediate
1. ✅ EDA server access configured
2. ✅ Node.js v16 installed
3. ✅ Ibex design extracted
4. ✅ Screen recording infrastructure ready
5. ⏳ Build HiPilot MCP servers
6. ⏳ Test with Ibex design
7. ⏳ Record feature demos

### Development Priority
1. **Terminal UI** - Beautiful, modern TUI
2. **Tmux Integration** - Send-to-EDA bridge
3. **Basic Tcl Generation** - Templates + doc-based
4. **AI Reads Reports** - Comprehend raw output
5. **Skill System** - Manual authoring first
6. **Knowledge System** - Document indexing

### For Each Feature
1. Implement feature
2. Test with Ibex design
3. **Record demo video**
4. Transfer for review
5. Document in CLAUDE.md

---

## 11. Troubleshooting

### Xvfb not running
```bash
cd /home/EDA/hipilot_test
./screen_recording_setup.sh
```

### Node.js not found
```bash
export PATH=/home/EDA/hipilot_test/node-v16.20.2-linux-x64/bin:$PATH
```

### Recording won't start
```bash
source /home/EDA/hipilot_test/recording_env.sh
pgrep -f "Xvfb :99"  # Check if Xvfb running
```

### Design flow won't run
```bash
cd /home/EDA/hipilot_test/ibex_work_upload
# Check environment variables are set
echo $DESIGN_HOME
echo $PLATFORM
```

---

## 12. Documentation References

- `CLAUDE.md` - Main architecture and context
- `docs/SCREEN_RECORDING_SETUP.md` - Recording guide
- `docs/prd.md` - Product requirements
- `docs/plans/2026-02-18-hipilot-architecture-design.md` - Full architecture
- `docs/specs/*.md` - Technical specifications
- `docs/guides/skill-authoring-guide.md` - How to write skills

---

**Last Updated:** 2026-02-19
**Status:** Ready for HiPilot Development
**Server:** 192.168.112.163 (CentOS 7, glibc 2.17)
**Node.js:** v16.20.2 (installed and verified)
**Design:** Ibex Core (RTL-to-GDS flow ready)
**Recording:** Xvfb + ffmpeg (tested and working)
