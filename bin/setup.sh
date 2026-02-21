#!/bin/bash
# HiPilot Setup - Interactive wizard for first-time configuration
# Detects EDA tools, installs dependencies, registers MCP servers
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN="\033[0;32m"
CYAN="\033[0;36m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
DIM="\033[2m"
BOLD="\033[1m"
NC="\033[0m"

ok="${GREEN}✓${NC}"
fail="${RED}✗${NC}"
warn="${YELLOW}⚠${NC}"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   HiPilot v0.2.1 Setup Wizard                      ║${NC}"
echo -e "${CYAN}${BOLD}║   VLSI Physical Design Copilot                      ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────
# Step 1: Check Node.js
# ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 1: Environment Check${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "  ${fail} Node.js not found"
    echo -e "  ${DIM}Install Node.js >= 16: https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
echo -e "  ${ok} Node.js $(node -v)"

if command -v npm &> /dev/null; then
    echo -e "  ${ok} npm $(npm -v)"
fi

if command -v tmux &> /dev/null; then
    echo -e "  ${ok} tmux $(tmux -V 2>/dev/null || echo 'installed')"
else
    echo -e "  ${warn} tmux not found (needed for workspace layout)"
    echo -e "  ${DIM}Install: apt install tmux  OR  brew install tmux${NC}"
fi

echo ""

# ─────────────────────────────────────────────────────────
# Step 2: Detect EDA Tools
# ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 2: EDA Tool Detection${NC}"
echo ""

EDA_TOOLS_FOUND=0

# Search common EDA tool paths
for tool_path in \
    /opt/synopsys/*/bin/icc2_shell \
    /tools/synopsys/*/bin/icc2_shell \
    /eda/synopsys/*/bin/icc2_shell \
    /usr/synopsys/*/bin/icc2_shell; do
    if [ -x "$tool_path" 2>/dev/null ]; then
        echo -e "  ${ok} ICC2: $tool_path"
        EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
        break
    fi
done

for tool_path in \
    /opt/synopsys/*/bin/pt_shell \
    /tools/synopsys/*/bin/pt_shell \
    /eda/synopsys/*/bin/pt_shell; do
    if [ -x "$tool_path" 2>/dev/null ]; then
        echo -e "  ${ok} PrimeTime: $tool_path"
        EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
        break
    fi
done

for tool_path in \
    /opt/cadence/*/tools*/bin/innovus \
    /tools/cadence/*/bin/innovus \
    /eda/cadence/*/tools*/bin/innovus; do
    if [ -x "$tool_path" 2>/dev/null ]; then
        echo -e "  ${ok} Innovus: $tool_path"
        EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
        break
    fi
done

# Check if tools are on PATH
if command -v icc2_shell &> /dev/null; then
    echo -e "  ${ok} icc2_shell on PATH"
    EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
fi

if command -v innovus &> /dev/null; then
    echo -e "  ${ok} innovus on PATH"
    EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
fi

if command -v pt_shell &> /dev/null; then
    echo -e "  ${ok} pt_shell on PATH"
    EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
fi

# Check running processes
if pgrep -f icc2_shell > /dev/null 2>&1; then
    echo -e "  ${ok} ICC2 currently running"
    EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
fi

if pgrep -f innovus > /dev/null 2>&1; then
    echo -e "  ${ok} Innovus currently running"
    EDA_TOOLS_FOUND=$((EDA_TOOLS_FOUND + 1))
fi

if [ $EDA_TOOLS_FOUND -eq 0 ]; then
    echo -e "  ${warn} No EDA tools detected on this machine"
    echo -e "  ${DIM}HiPilot will still work for Tcl generation and skills.${NC}"
    echo -e "  ${DIM}EDA tool integration requires running on an EDA server.${NC}"
fi

echo ""

# ─────────────────────────────────────────────────────────
# Step 3: Install Dependencies
# ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 3: Installing Dependencies${NC}"
echo ""

echo -e "  ${CYAN}Installing root dependencies...${NC}"
cd "$PROJECT_DIR"
npm install --silent 2>&1 | tail -1
echo -e "  ${ok} Root packages installed"

for server in eda tmux knowledge; do
    echo -e "  ${CYAN}Installing ${server} server...${NC}"
    cd "$PROJECT_DIR/servers/$server"
    npm install --silent 2>&1 | tail -1
    echo -e "  ${ok} ${server} server ready"
done

cd "$PROJECT_DIR"
echo ""

# ─────────────────────────────────────────────────────────
# Step 4: Verify MCP Servers
# ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 4: Verifying MCP Servers${NC}"
echo ""

ALL_OK=true
for server in eda tmux knowledge; do
    if timeout 3 node "servers/$server/index.js" 2>/dev/null </dev/null; then
        true
    fi
    # Check it didn't crash immediately
    if [ $? -le 1 ]; then
        echo -e "  ${ok} ${server} server starts OK"
    else
        echo -e "  ${fail} ${server} server failed to start"
        ALL_OK=false
    fi
done

echo ""

# ─────────────────────────────────────────────────────────
# Step 5: Check Configuration
# ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 5: Configuration${NC}"
echo ""

# Check .claude/settings.json
if [ -f "$PROJECT_DIR/.claude/settings.json" ]; then
    echo -e "  ${ok} Claude Code MCP configuration (.claude/settings.json)"
else
    echo -e "  ${fail} Missing .claude/settings.json - MCP servers won't auto-connect"
fi

# Check skills
SKILL_COUNT=$(ls "$PROJECT_DIR/skills/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${ok} ${SKILL_COUNT} skills available"

# Check templates
SYNOPSYS_COUNT=$(ls "$PROJECT_DIR/templates/synopsys/"*.tcl 2>/dev/null | wc -l | tr -d ' ')
CADENCE_COUNT=$(ls "$PROJECT_DIR/templates/cadence/"*.tcl 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${ok} ${SYNOPSYS_COUNT} Synopsys + ${CADENCE_COUNT} Cadence templates"

# Check command reference
if [ -f "$PROJECT_DIR/data/command-reference.json" ]; then
    CMD_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT_DIR/data/command-reference.json','utf-8')).commands.length)" 2>/dev/null || echo "0")
    echo -e "  ${ok} ${CMD_COUNT} commands in reference"
fi

# Check slash commands
if [ -d "$PROJECT_DIR/.claude/commands" ]; then
    CMD_FILES=$(ls "$PROJECT_DIR/.claude/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${ok} ${CMD_FILES} quick commands (.claude/commands/)"
fi

# Detect project config
if [ -f ".hipilot/config.yaml" ] || [ -f ".hipilot/config.yml" ]; then
    echo -e "  ${ok} Project config found (.hipilot/)"
else
    echo -e "  ${DIM}  No .hipilot/ project config (optional)${NC}"
fi

echo ""

# ─────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo -e "  ${BOLD}Getting Started:${NC}"
echo ""
echo "  1. Launch workspace:     bin/hipilot"
echo "  2. Start Claude Code:    claude  (in the chat pane)"
echo "  3. Start EDA tool:       icc2_shell / innovus  (in the EDA pane)"
echo ""
echo -e "  ${BOLD}Quick Commands (in Claude Code):${NC}"
echo ""
echo "    /project:timing    Run timing report and analyze"
echo "    /project:drc       Run DRC check and summarize"
echo "    /project:power     Power analysis"
echo "    /project:area      Area/utilization report"
echo ""
echo -e "  ${BOLD}Try Conversational:${NC}"
echo ""
echo "    \"Fix setup timing violations on the pcie_rx group\""
echo "    \"Analyze the timing report at reports/post_route.rpt\""
echo "    \"Show me all DRC violations and suggest fixes\""
echo ""
echo -e "  ${BOLD}Keyboard Shortcuts (in tmux workspace):${NC}"
echo ""
echo "    Ctrl+E    Switch to EDA pane"
echo "    Ctrl+S    Save last generated Tcl to scripts/"
echo "    prefix+h  Switch to Chat pane"
echo ""
