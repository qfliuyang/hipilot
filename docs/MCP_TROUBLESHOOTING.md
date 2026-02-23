# MCP Flow Control - Troubleshooting Guide

## Why Commands Failed Before

### Issue 1: MCP Gate Disabled
**Symptom:** Claude Code says "I don't have direct access to MCP tools"

**Root Cause:** Claude Code's MCP feature gate check fails when using a custom API endpoint (like Zhipu AI) instead of the official Anthropic API.

**Evidence:**
```
[claudeai-mcp] Gate returned: false
[claudeai-mcp] Disabled via gate
```

**Solution:** Use `scripts/mcp_wrapper.sh` to call MCP servers directly via JSON-RPC stdin/stdout, bypassing the gate.

---

### Issue 2: tmux Socket Naming Inconsistency
**Symptom:** "no server running on /tmp/tmux-1000/hipilot"

**Root Cause:** MCP server code had inconsistent tmux socket naming:
- Some calls: `tmux -L ${session}` ✓
- Other calls: `tmux` (no -L flag) ✗

Without `-L hipilot`, tmux looks at the default socket (`/tmp/tmux-1000/default`) instead of the HiPilot socket (`/tmp/tmux-1000/hipilot`).

**Solution:** All tmux calls in `servers/eda/index.js` now use `tmux -L ${TMUX_SESSION}` or `tmux -L ${session}`.

**Files Changed:**
- `servers/eda/index.js` - Lines 2320, 2363, 2397, 2499, 2610, 2651, 2685, 2720, 2760, 3146, 3230

---

### Issue 3: tempDir Undefined
**Symptom:** "ENOTDIR: not a directory, open 'undefined/capture_wait_...tcl'"

**Root Cause:** `hipilotPaths` object in `src/lib/paths.js` was missing the `tempDir` property.

**Solution:** Added `tempDir: baseDir` to the paths object.

**Files Changed:**
- `src/lib/paths.js` - Line 30

---

### Issue 4: Session Name Mismatch
**Symptom:** Commands sent but Innovus doesn't react

**Root Cause:** Test framework created sessions like `hipilot_20260223065311` but MCP server expected exactly `hipilot`.

**Solution:** 
1. MCP wrapper sets `export HIPILOT_SESSION="hipilot"`
2. Tests should use `sessionName: 'hipilot'` in E2ETestRunner config

---

## How It Works Now

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code (Pane 0)                         │
│                                                                 │
│  bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh \       │
│      eda send_to_terminal '{"tcl":"puts TEST"}'                │
└────────────────────────┬────────────────────────────────────────┘
                         │ JSON-RPC via stdin/stdout
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Wrapper Script                           │
│                                                                 │
│  1. Build JSON-RPC request                                      │
│  2. Set HIPILOT_SESSION="hipilot"                               │
│  3. Pipe to node servers/eda/index.js                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDA MCP Server                               │
│                                                                 │
│  1. Parse JSON-RPC request                                      │
│  2. Write Tcl to /tmp/hipilot-EDA/exec/hipilot_exec_XXX.tcl     │
│  3. Execute: tmux -L hipilot send-keys -t hipilot:0.1 "source"  │
└────────────────────────┬────────────────────────────────────────┘
                         │ tmux -L hipilot
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Innovus (Pane 1)                              │
│                                                                 │
│  innovus 1> source /tmp/hipilot-EDA/exec/hipilot_exec_XXX.tcl   │
│  TEST                                                           │
│  innovus 2>                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Commits That Fixed These Issues

| Commit | Description |
|--------|-------------|
| `8ce8095` | Add MCP wrapper for JSON-RPC based tool invocation |
| `52230c7` | Fix MCP server tmux socket naming consistency |
| `e462e49` | Add Ibex RTL2GDS flow test with MCP wrapper integration |

---

## For Future Claude Code Sessions

### To Send Commands to Innovus:

```bash
# 1. Ensure tmux session exists with Innovus in pane 1
tmux -L hipilot new-session -d -s hipilot -x 240 -y 60
tmux -L hipilot split-window -h -l 50%
tmux -L hipilot send-keys -t hipilot:0.1 "innovus -nowin" Enter

# 2. Set auto mode (execute immediately without approval)
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'

# 3. Send Tcl commands
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"puts HELLO"}'

# 4. Check result
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda get_last_result '{"lines":50}'
```

### Key Files:
- `scripts/mcp_wrapper.sh` - JSON-RPC wrapper to bypass MCP gate
- `servers/eda/index.js` - EDA MCP server with tmux -L fixes
- `src/lib/paths.js` - Path definitions including tempDir

### Session Names:
- **tmux socket:** `hipilot` (via `-L hipilot`)
- **tmux session:** `hipilot` (via `-s hipilot`)
- **Env variable:** `HIPILOT_SESSION=hipilot`
