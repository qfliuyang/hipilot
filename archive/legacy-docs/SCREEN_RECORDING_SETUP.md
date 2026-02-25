# HiPilot Screen Recording Setup

**Status:** ✅ Configured and Tested on EDA Server (192.168.112.163)

## Overview

All major HiPilot features must be demonstrated via screen recording running on the EDA server (CentOS 7). This ensures:
1. HiPilot works correctly on the target platform (CentOS 7)
2. UI can be evaluated on the actual deployment environment
3. Progress is visible and shareable
4. Each feature has a demo video for review

## Quick Reference

### One-time Setup (Already Done)
```bash
ssh EDA@192.168.112.163
cd /home/EDA/hipilot_test
./screen_recording_setup.sh
```

### For Each Recording
```bash
# 1. Start recording
/home/EDA/hipilot_test/start_recording.sh "feature_description"

# 2. Demonstrate your feature
# [work in terminal, show the feature]

# 3. Stop recording
/home/EDA/hipilot_test/stop_recording.sh

# 4. Transfer to local machine
scp EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/FEATURE_NAME_*.mp4 .
```

## Technical Details

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    EDA Server (CentOS 7)                    │
│                                                             │
│  Virtual Display (Xvfb)                                     │
│    ├─ Display :99 (1920x1080)                              │
│    ├─ Runs in background (no physical monitor)             │
│    └─ PID saved in /home/EDA/hipilot_test/xvfb.pid        │
│                                                             │
│  ffmpeg Screen Capture                                      │
│    ├─ Captures display :99 via x11grab                     │
│    ├─ Encodes to H.264 (libx264)                           │
│    ├─ 25 fps, CRF 23, yuv420p                             │
│    └─ Saves to /home/EDA/hipilot_test/recordings/          │
│                                                             │
│  Optional: VNC Server (x11vnc)                             │
│    └─ View virtual display on port 5999                    │
└─────────────────────────────────────────────────────────────┘
```

### Commands Available

| Command | Purpose |
|---------|---------|
| `screen_recording_setup.sh` | One-time setup, starts Xvfb |
| `start_recording.sh [desc]` | Start screen recording |
| `stop_recording.sh` | Stop recording and finalize video |
| `recording_env.sh` | Source for DISPLAY variable |

### Video Specifications

- **Resolution:** 1920x1080 (Full HD)
- **Framerate:** 25 fps
- **Codec:** H.264 (libx264)
- **Quality:** CRF 23 (good quality, reasonable size)
- **Pixel Format:** yuv420p (maximum compatibility)
- **Container:** MP4
- **Typical size:** 5-50 MB for 1-5 minute demos

## Recording Workflow

### Step 1: Connect to EDA Server
```bash
ssh EDA@192.168.112.163
cd /home/EDA/hipilot_test
```

### Step 2: Start Recording
```bash
./start_recording.sh "feature_name"
```

You'll see:
```
=== Starting Screen Recording ===
Description: feature_name
Output: /home/EDA/hipilot_test/recordings/feature_name_20260219_HHMMSS.mp4
Screen size: 1920x1080
Display: :99

Recording... Press Ctrl+C to stop

✓ Recording started (PID: XXXX)
```

### Step 3: Demonstrate Feature
- Work normally in terminal
- Explain what you're doing
- Show key functionality
- Demonstrate edge cases

The recording indicator shows: `⏺ Recording... HH:MM:SS`

### Step 4: Stop Recording
```bash
./stop_recording.sh
```

You'll see:
```
=== Stopping Screen Recording ===
Finalizing...
✓ Recording stopped

Latest recording:
  File: /home/EDA/hipilot_test/recordings/feature_name_20260219_HHMMSS.mp4
  Size: 15M

To transfer to local machine:
  scp EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/feature_name_20260219_HHMMSS.mp4 .
```

### Step 5: Transfer Video
```bash
# From local machine
scp EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/FEATURE_NAME_*.mp4 .
```

## Test Results

### Verification Test (Completed)
```bash
Test: Recording setup and basic capture
Result: ✅ SUCCESS
Output: test_setup_20260219_120436.mp4 (9.9 KB)
Duration: ~3 seconds
Status: Recording works correctly
```

### Files Created
- `/home/EDA/hipilot_test/screen_recording_setup.sh` - Setup script
- `/home/EDA/hipilot_test/start_recording.sh` - Start recording
- `/home/EDA/hipilot_test/stop_recording.sh` - Stop recording
- `/home/EDA/hipilot_test/recording_env.sh` - Environment variables
- `/home/EDA/hipilot_test/recordings/` - Output directory
- `/home/EDA/hipilot_test/logs/` - Log files

## Recording Checklist

### Before Recording
- [ ] Clean terminal window
- [ ] Set up tmux session / terminal layout
- [ ] Start HiPilot components
- [ ] Know what you'll demonstrate
- [ ] Have test data ready

### During Recording
- [ ] Speak clearly (explain what you're doing)
- [ ] Show first steps (how to start)
- [ ] Demonstrate main workflow
- [ ] Show edge cases / error handling
- [ ] Keep it focused (one feature per video)
- [ ] Typical length: 1-5 minutes

### After Recording
- [ ] Verify file was created
- [ ] Check file size (should be reasonable)
- [ ] Transfer to local for review
- [ ] Test video plays correctly
- [ ] Document what was shown

## Feature Demo Template

Each feature video should include:

### Opening (5-10 seconds)
- Show terminal/session start
- Display feature name/title
- Show HiPilot version/status

### Main Content (1-5 minutes)
- How to start/use the feature
- Key functionality demonstration
- Normal workflow
- User interaction

### Edge Cases (30-60 seconds)
- Error handling
- Alternative approaches
- Common pitfalls

### Closing (5-10 seconds)
- Summary of what was shown
- Next steps/related features
- End card

## Naming Conventions

Use descriptive, lowercase names with underscores:

Examples:
- `eda_mcp_tcl_generation_YYYYMMDD_HHMMSS.mp4`
- `tmux_send_to_eda_YYYYMMDD_HHMMSS.mp4`
- `skill_fix_timing_YYYYMMDD_HHMMSS.mp4`
- `ui_enhanced_terminal_YYYYMMDD_HHMMSS.mp4`

## Troubleshooting

### Xvfb not running
```bash
# Check
pgrep -f "Xvfb :99"

# Restart
./screen_recording_setup.sh
```

### Recording won't start
```bash
# Ensure DISPLAY is set
echo $DISPLAY  # Should be :99

# Source environment
source ./recording_env.sh

# Check Xvfb
ps aux | grep Xvfb
```

### Video file too large
- Shorten recording time
- Lower framerate (edit start_recording.sh, change `-framerate 25` to `15`)
- Increase CRF value (change `-crf 23` to `28` for lower quality)

### Video won't play
```bash
# Verify file integrity
ffmpeg -v error -i file.mp4 -f null -

# Try different players
vlc file.mp4
mpv file.mp4
ffplay file.mp4
```

## Optional: VNC Viewing

To see the virtual display in real-time (useful for debugging):

### Install x11vnc
```bash
sudo yum install -y x11vnc
```

### Start VNC Server
```bash
x11vnc -display :99 -nopw -forever -rfbport 5999
```

### Connect with VNC Client
- **Host:** 192.168.112.163
- **Port:** 5999
- **Password:** (none set with `-nopw`)

## Storage Management

Recordings are in: `/home/EDA/hipilot_test/recordings/`

### Clean old recordings (older than 30 days)
```bash
find /home/EDA/hipilot_test/recordings/ -name '*.mp4' -mtime +30 -delete
```

### Keep only last 10 recordings
```bash
cd /home/EDA/hipilot_test/recordings/
ls -t *.mp4 | tail -n +11 | xargs rm -f
```

## Integration with Development

### Development Workflow
1. Implement feature on EDA server
2. Test manually to verify it works
3. **Record demo video**
4. Transfer video to local machine
5. Submit for review with video link
6. Video becomes part of feature documentation

### For Pull Requests
- Attach video to PR/issue
- Or provide download link
- Include description of what's shown
- Note any known limitations

## Environment Variables

The `recording_env.sh` file sets:
```bash
export DISPLAY=:99
export HIPILOT_HOME=/home/EDA/hipilot_test
```

Source this before recording if DISPLAY is not set:
```bash
source /home/EDA/hipilot_test/recording_env.sh
```

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Xvfb (Virtual Display) | ✅ Running | Display :99, 1920x1080 |
| ffmpeg (Screen Capture) | ✅ Installed | Version 2.8.15, with x11grab |
| Recording Scripts | ✅ Created | start/stop/setup all working |
| Test Recording | ✅ Verified | 10KB test file created successfully |
| Storage Directory | ✅ Created | /home/EDA/hipilot_test/recordings/ |
| VNC (Optional) | ⚠️ Not installed | x11vnc available if needed |

## Next Steps

1. ✅ Screen recording infrastructure is ready
2. Build HiPilot features
3. Record each feature as it's completed
4. Maintain video library of all demos
5. Use videos for documentation and reviews
