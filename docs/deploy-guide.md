# HiPilot Deployment Guide

**Installing HiPilot in Various Environments**

---

## Overview

HiPilot can be deployed in multiple environments:
- Local development machine
- EDA server (CentOS 7)
- Docker container
- npm global installation

---

## Quick Install (npm)

### Prerequisites

- Node.js v20+
- npm 10+
- Git

### Install Command

```bash
# Install globally from npm
npm install -g hipilot

# Or install from GitHub
npm install -g github:qfliuyang/hipilot
```

### Verify Installation

```bash
hipilot --version
hipilot --help
```

---

## Method 1: npm Global Install (Recommended)

### Step 1: Install Node.js

**macOS:**
```bash
brew install node@20
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL 7 (glibc 2.17):**
```bash
# Download glibc-217 compatible build
wget https://nodejs.org/dist/v20.18.3/node-v20.18.3-linux-x64-glibc-217.tar.xz
tar -xf node-v20.18.3-linux-x64-glibc-217.tar.xz
sudo mv node-v20.18.3-linux-x64-glibc-217 /opt/nodejs
echo 'export PATH=/opt/nodejs/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**CentOS/RHEL 8+:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### Step 2: Install HiPilot

```bash
# From npm registry
npm install -g hipilot

# Or from GitHub
npm install -g github:qfliuyang/hipilot
```

### Step 3: Configure MCP Servers

```bash
# Run setup script
hipilot setup

# Or manually configure
hipilot config --mcp
```

This will add MCP server configuration to `~/.claude/settings.json`.

### Step 4: Verify

```bash
hipilot --version
hipilot skills list
```

---

## Method 2: Clone and Build

### Step 1: Clone Repository

```bash
git clone https://github.com/qfliuyang/hipilot.git
cd hipilot
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (main + MCP servers)
npm run install:all
```

### Step 3: Link Globally

```bash
# Link for global access
npm link
```

### Step 4: Configure

```bash
# Configure MCP servers
./bin/setup.sh
```

---

## Method 3: Docker Installation

### Dockerfile

```dockerfile
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    tmux \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Clone and install HiPilot
RUN git clone https://github.com/qfliuyang/hipilot.git . && \
    npm run install:all && \
    npm link

# Configure MCP servers
RUN hipilot setup

# Default command
CMD ["hipilot"]
```

### Build and Run

```bash
# Build image
docker build -t hipilot:latest .

# Run container
docker run -it --rm hipilot:latest

# Run with volume for persistence
docker run -it --rm -v ~/.hipilot:/root/.hipilot hipilot:latest
```

---

## Method 4: EDA Server Deployment

HiPilot is deployed **as a tool** on the EDA server (e.g. `/home/EDA/hipilot/current/`). Do not upload full source for each test — use `bin/hitestbot-push` for small updates (skills, test_plan, deploy config). See [docs/testing/hitestbot-guide.md](testing/hitestbot-guide.md) for HiTestBot execution model and sync scripts.

### Environment Requirements

| Requirement | Value |
|-------------|-------|
| OS | CentOS 7+ / RHEL 7+ |
| glibc | 2.17+ |
| Node.js | v20.18.3 (glibc-217 build) |
| tmux | 1.8+ (3.4+ recommended) |
| Disk | 500MB+ |

### Step 1: Prepare Environment

```bash
# SSH to server
ssh user@eda-server

# Create workspace
mkdir -p ~/hipilot
cd ~/hipilot

# Download Node.js (glibc-217 build for CentOS 7)
wget https://nodejs.org/dist/v20.18.3/node-v20.18.3-linux-x64-glibc-217.tar.xz
tar -xf node-v20.18.3-linux-x64-glibc-217.tar.xz

# Add to PATH
export PATH=~/hipilot/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
echo 'export PATH=~/hipilot/node-v20.18.3-linux-x64-glibc-217/bin:$PATH' >> ~/.bashrc
```

### Step 2: Install HiPilot

```bash
# Clone repository
git clone https://github.com/qfliuyang/hipilot.git
cd hipilot

# Install dependencies
npm run install:all
```

### Step 3: Build tmux 3.4 (if needed)

```bash
# Check current version
tmux -V

# If < 3.4, build from source
sudo yum install -y gcc automake libevent-devel ncurses-devel

cd /tmp
git clone https://github.com/tmux/tmux.git
cd tmux
git checkout 3.4
sh autogen.sh
./configure --prefix=$HOME/.local
make
make install

echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Step 4: Configure Claude Code

```bash
# Install Claude Code
npm install -g @anthropic/claude-code

# Configure MCP servers
cat > ~/.claude/settings.json << 'EOF'
{
  "mcpServers": {
    "eda": {
      "command": "node",
      "args": ["/home/user/hipilot/servers/eda/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    },
    "tmux": {
      "command": "node",
      "args": ["/home/user/hipilot/servers/tmux/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    },
    "knowledge": {
      "command": "node",
      "args": ["/home/user/hipilot/servers/knowledge/index.js"]
    }
  }
}
EOF
```

### Step 5: Test Installation

```bash
# Start HiPilot workspace
hipilot

# Or start manually
tmux new-session -d -s hipilot -x 240 -y 60
tmux split-window -h -t hipilot:0
tmux send-keys -t hipilot:0.1 "innovus -nowin" C-m
sleep 10
tmux send-keys -t hipilot:0.0 "claude --dangerously-skip-permissions" C-m
tmux attach -t hipilot
```

---

## Configuration

### MCP Server Configuration

**File:** `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "eda": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/eda/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot",
        "HIPILOT_PATH": "/path/to/hipilot"
      }
    },
    "tmux": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/tmux/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot"
      }
    },
    "knowledge": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/knowledge/index.js"],
      "env": {
        "SKILLS_PATH": "/path/to/hipilot/skills"
      }
    }
  }
}
```

### HiPilot Configuration

**File:** `~/.hipilot/config.yaml`

```yaml
# HiPilot Configuration

# EDA Tools Configuration
tools:
  synopsys:
    icc2: /opt/synopsys/icc2_2022.03/bin/icc2_shell
    dc: /opt/synopsys/syn_2022.03/bin/dc_shell
    pt: /opt/synopsys/prime_2022.03/bin/pt_shell
  cadence:
    innovus: /opt/cadence/INNOVUS20.10/bin/innovus

# Workspace Configuration
workspace:
  default_layout: split  # split | focus
  chat_width: 50
  eda_width: 50

# Logging
logging:
  level: info
  path: ~/.hipilot/logs
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HIPILOT_SESSION` | tmux session name | `hipilot` |
| `HIPILOT_PATH` | Installation path | Auto-detected |
| `HIPILOT_CONFIG` | Config file path | `~/.hipilot/config.yaml` |
| `HIPILOT_LOG_LEVEL` | Logging level | `info` |

---

## Post-Installation

### Add Custom Skills

```bash
# Create skills directory
mkdir -p ~/.hipilot/skills

# Add custom skill
cat > ~/.hipilot/skills/my-skill.md << 'EOF'
---
name: my-skill
description: My custom skill
hipilot:
  triggers:
    - "my trigger"
---
# My Custom Skill

## MCP Commands
...
EOF
```

### Add Tcl Templates

```bash
# Create templates directory
mkdir -p ~/.hipilot/templates/cadence

# Add template
cat > ~/.hipilot/templates/cadence/my_template.tcl << 'EOF'
# My Template
report_timing -max_paths {{ max_paths }}
EOF
```

---

## Upgrading

### npm Upgrade

```bash
npm update -g hipilot
```

### Git Upgrade

```bash
cd /path/to/hipilot
git pull origin main
npm run install:all
```

---

## Uninstallation

### npm Uninstall

```bash
npm uninstall -g hipilot
rm -rf ~/.hipilot
rm -rf ~/.claude/settings.json  # Or edit to remove hipilot servers
```

### Manual Uninstall

```bash
rm -rf /path/to/hipilot
rm -rf ~/.hipilot
# Edit ~/.claude/settings.json to remove hipilot MCP servers
```

---

## Troubleshooting

### "node: command not found"

```bash
# Add Node.js to PATH
export PATH=/path/to/node/bin:$PATH
# Or install Node.js
```

### "tmux: protocol version mismatch"

```bash
# Kill all tmux sessions
pkill -u $USER tmux
# Try again
```

### MCP servers not connecting

```bash
# Check paths in settings.json
cat ~/.claude/settings.json

# Test server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node /path/to/hipilot/servers/eda/index.js
```

### "glibc version too old" (CentOS 7)

```bash
# Use glibc-217 compatible Node.js build
wget https://nodejs.org/dist/v20.18.3/node-v20.18.3-linux-x64-glibc-217.tar.xz
```

---

## Support

- **GitHub Issues:** https://github.com/qfliuyang/hipilot/issues
- **Documentation:** See `docs/` directory

---

**Last Updated:** 2026-02-24
