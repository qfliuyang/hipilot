# Tmux MCP Server - Technical Specification

> **Note:** This is the original Phase 1 design specification. The actual implementation has evolved (8 tools, JavaScript instead of TypeScript). See [../mcp-servers.md](../mcp-servers.md) for the current API reference.

**Component:** `@hipilot/tmux-mcp-server`
**Version:** Phase 1 (original design)
**Date:** 2026-02-19

---

## 1. Overview

The Tmux MCP Server manages the HiPilot workspace layout, provides the chat-to-EDA bridge, and controls the status bar. It wraps tmux CLI commands as MCP tools.

**Key Features:**
- Mode 2 layout: Fixed 50/50 split (not adaptive)
- Send-to-EDA bridge
- Status bar with real-time updates
- Screen recording integration

## 2. MCP Tools

### 2.1 `tmux.setup_layout`

Creates or reconfigures the HiPilot tmux session layout.

**Input Schema:**

```json
{
  "layout": "string | null — layout name (default: 'default')",
  "mode": "number — layout mode (default: 2 for 50/50 split)",
  "chat_width": "number | null — chat pane width percentage (default: 50)",
  "eda_width": "number | null — EDA pane width percentage (default: 50)"
}
```

**Output Schema:**

```json
{
  "session": "string — tmux session name",
  "mode": "number — layout mode (2 = 50/50 split)",
  "panes": {
    "chat": "string — pane identifier (e.g., 'hipilot:0.0')",
    "eda": "string — pane identifier (e.g., 'hipilot:0.1')"
  },
  "status_bar": "enabled"
}
```

**Mode 2 Layout (Fixed 50/50):**

```
┌──────────────────────┬──────────────────────┐
│ Pane 0: "chat" (50%) │ Pane 1: "eda" (50%)  │
│ Claude Code / HiPilot│ EDA tool shell       │
│                      │                      │
│                      │                      │
├──────────────────────┴──────────────────────┤
│ Status Bar                                   │
└──────────────────────────────────────────────┘
```

### 2.2 `tmux.send_keys`

Sends keystrokes to a named pane.

**Input Schema:**

```json
{
  "pane": "string — 'chat' | 'eda' | raw tmux pane ID",
  "keys": "string — keystrokes to send",
  "enter": "boolean — append Enter key (default: true)"
}
```

**Output Schema:**

```json
{
  "sent": true,
  "pane": "string — resolved pane ID",
  "keys_sent": "string"
}
```

**Pane name resolution:**
- `"chat"` → `hipilot:0.0`
- `"eda"` → `hipilot:0.1`
- Raw tmux IDs passed through directly

### 2.3 `tmux.capture_pane`

Reads the current visible content of a pane.

**Input Schema:**

```json
{
  "pane": "string — 'chat' | 'eda' | raw tmux pane ID",
  "lines": "number | null — number of lines to capture (default: all visible)"
}
```

**Output Schema:**

```json
{
  "content": "string — captured pane content",
  "pane": "string",
  "lines_captured": "number"
}
```

**Implementation:** Uses `tmux capture-pane -p -t {pane}`.

### 2.4 `tmux.update_status`

Updates the tmux status bar with current state information.

**Input Schema:**

```json
{
  "tool": "string | null — current EDA tool name",
  "skill": "string | null — active skill name",
  "job_status": "string | null — 'idle' | 'running' | 'complete' | 'failed'",
  "elapsed": "string | null — elapsed time string",
  "design": "string | null — design name",
  "corner": "string | null — current corner",
  "alert": "string | null — alert message (overrides skill field)"
}
```

**Output Schema:**

```json
{
  "updated": true,
  "status_left": "string — rendered left section",
  "status_right": "string — rendered right section"
}
```

**Status bar format:**

```
Left section:
  Normal:  "⚙ {tool} | 📋 {skill} | ▶ {job_status} {elapsed}"
  Alert:   "⚙ {tool} | ⚠ {alert} | ▶ {job_status} {elapsed}"

Right section:
  "{design} @ {corner} | HH:MM"
```

**Implementation:** Uses `tmux set-option status-left` and `tmux set-option status-right`.

### 2.5 `tmux.get_pane_output`

Gets the last N lines from a pane's scrollback buffer.

**Input Schema:**

```json
{
  "pane": "string — 'chat' | 'eda' | raw tmux pane ID",
  "lines": "number — number of lines from the end (default: 50)",
  "start": "number | null — start line number (for pagination)"
}
```

**Output Schema:**

```json
{
  "content": "string — captured content",
  "pane": "string",
  "total_lines": "number",
  "range": { "start": "number", "end": "number" }
}
```

**Implementation:** Uses `tmux capture-pane -p -S -{lines} -t {pane}`.

### 2.6 `tmux.resize_pane`

Adjusts pane sizes (for future use, currently Mode 2 is fixed 50/50).

**Input Schema:**

```json
{
  "pane": "string — 'chat' | 'eda'",
  "width": "number | null — percentage width",
  "height": "number | null — percentage height"
}
```

**Note:** Mode 2 layout is fixed at 50/50 split. This tool is reserved for future layout modes.

### 2.7 `tmux.start_recording`

Starts screen recording for feature demos (integrates with Xvfb + ffmpeg).

**Input Schema:**

```json
{
  "description": "string — feature description for filename",
  "display": "string — X display number (default: ':99')"
}
```

**Output Schema:**

```json
{
  "recording": true,
  "output_file": "string — path to recording file",
  "display": "string — X display being recorded",
  "pid": "number — ffmpeg process ID"
}
```

**Implementation:** Wraps `start_recording.sh` script on EDA server.

### 2.8 `tmux.stop_recording`

Stops screen recording and finalizes video.

**Input Schema:**

```json
{}
```

**Output Schema:**

```json
{
  "stopped": true,
  "output_file": "string — path to finalized video",
  "file_size": "string — human-readable size",
  "duration": "string — recording duration"
}
```

**Implementation:** Wraps `stop_recording.sh` script on EDA server.

---

## 3. Status Bar Engine

### 3.1 Color Scheme

```
Tool name:    cyan (#00d4ff)
Skill name:   yellow (#ffd700)
Job running:  green (#00ff88)
Job failed:   red (#ff4444)
Alert:        orange (#ffa500)
Design info:  white (#e0e0e0)
Background:   dark (#1a1a2e)
```

### 3.2 Status States

| State | Left Display | Example |
|-------|-------------|---------|
| Idle | `⚙ ICC2 \| 📋 idle \| ▶ no job` | Ready state |
| Skill active | `⚙ ICC2 \| 📋 fix-setup-timing \| ▶ running 2m13s` | During skill execution |
| Alert | `⚙ ICC2 \| ⚠ 12 DRC violations \| ▶ route complete` | After problem detected |
| Batch job | `⚙ ICC2 \| 📋 full-flow \| ▶ LSF#48271 45m` | Long-running batch |
| No tool | `⚙ — \| 📋 idle \| ▶ —` | EDA tool not started |

### 3.3 Refresh Interval

Status bar refreshes every 5 seconds via `tmux set-option status-interval 5`.
Active job status polls the job manager on each refresh.

---

## 4. Send-to-EDA Protocol

### 4.1 Flow

```
1. Claude Code generates Tcl → writes to /tmp/hipilot_{session}_{seq}.tcl
2. User sees [▶ Run] action in chat
3. User triggers Run (click or Ctrl+Enter)
4. Claude Code calls eda.send_to_terminal({script_path: ...})
5. EDA MCP calls tmux.send_keys({pane: "eda", keys: "source /tmp/..."})
6. tmux sends keystrokes to EDA pane
7. EDA tool executes the source command
8. Status bar updates to "running"
```

### 4.2 Script File Management

- **Temp scripts:** `/tmp/hipilot_{session_id}_{sequence}.tcl`
- **Archive:** `{project}/.hipilot/history/YYYY-MM-DD_HH-MM-SS_{action}.tcl`
- **Cleanup:** Temp files cleaned on session exit; archives kept indefinitely
- **Sequence counter:** Monotonically increasing per session, prevents collisions

---

## 5. Screen Recording Integration

### 5.1 Recording Infrastructure

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

### 5.2 Recording Workflow

```bash
# Start recording
tmux.start_recording({description: "feature_name"})

# ... demonstrate feature ...

# Stop recording
tmux.stop_recording()

# Output: /home/EDA/hipilot_test/recordings/feature_NAME_TIMESTAMP.mp4
```

### 5.3 Video Specifications

| Parameter | Value |
|-----------|-------|
| Resolution | 1920x1080 |
| Framerate | 25 fps |
| Codec | H.264 (libx264) |
| Quality | CRF 23 |
| Pixel Format | yuv420p |
| Container | MP4 |
| Typical Size | 5-50 MB |

### 5.4 Recording Requirements

Every major feature must have a demo video:
- Recorded on EDA server (CentOS 7)
- Shows complete workflow
- 1-5 minutes per feature
- Stored in recordings directory
- Transferable for review

---

## 6. Layout Modes

### 6.1 Mode 2 (Current Default)

**Fixed 50/50 Split:**

```
┌──────────────────────┬──────────────────────┐
│ Pane 0: "chat" (50%) │ Pane 1: "eda" (50%)  │
│ Claude Code / HiPilot│ EDA tool shell       │
│                      │                      │
│                      │                      │
├──────────────────────┴──────────────────────┤
│ Status Bar                                   │
└──────────────────────────────────────────────┘
```

**Characteristics:**
- Fixed 50/50 split
- Not adaptive
- Predictable and simple
- Works well for most workflows

### 6.2 Future Modes (Reserved)

Additional layout modes may be added in future phases:
- Mode 1: 60/40 split (chat-focused)
- Mode 3: 40/60 split (EDA-focused)
- Mode 4: Full-screen chat
- Mode 5: Full-screen EDA

**Note:** Phase 1 uses Mode 2 exclusively.

---

## 7. File Structure

```
@hipilot/tmux-mcp-server/
├── src/
│   ├── index.ts               # MCP server entry point
│   ├── tools/
│   │   ├── setup-layout.ts
│   │   ├── send-keys.ts
│   │   ├── capture-pane.ts
│   │   ├── update-status.ts
│   │   ├── get-pane-output.ts
│   │   ├── resize-pane.ts
│   │   ├── start-recording.ts
│   │   └── stop-recording.ts
│   ├── status-bar.ts          # Status bar rendering engine
│   ├── pane-resolver.ts       # Named pane → tmux ID resolution
│   ├── layout-manager.ts      # Layout mode management
│   └── config.ts
├── package.json
└── tsconfig.json
```

---

## 8. Platform Compatibility

### CentOS 7 (glibc 2.17)

- **tmux:** 1.8+ (available on CentOS 7)
- **Node.js:** v20.18.3 (glibc-217 build for CentOS 7)
- **Xvfb:** For screen recording
- **ffmpeg:** 2.8.15 (available on CentOS 7)

### Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | v20.18.3 | CentOS 7 compatible (glibc-217 build) |
| TypeScript | 5.x | Development |
| tmux | 1.8+ | Terminal multiplexer |

---

## 9. Testing

### EDA Server Environment

| Item | Value |
|------|-------|
| **Server** | 192.168.112.163 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v20.18.3 |
| **tmux** | 1.8 |

### Test Cases

| Feature | Test Case |
|---------|-----------|
| Layout setup | Create Mode 2 layout (50/50) |
| Send-to-EDA | Send scripts to EDA terminal |
| Status bar | Update status with tool, skill, job |
| Capture pane | Read content from panes |
| Screen recording | Start/stop recording on Xvfb |

### Screen Recording Validation

Every feature tested with screen recording:
- Start recording
- Demonstrate feature
- Stop recording
- Verify video created
- Transfer for review
